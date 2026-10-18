import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { Conflicto, DatosInvalidos, NoDisponible } from '../../../dominio/errores.js';

const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1'];

/**
 * Convierte una URL mysql://usuario:clave@host:puerto/base en la configuración
 * de mysql2. Fuera de localhost exige SSL (Aiven lo requiere): si se indica
 * `ca`, se valida el certificado del servidor contra ese archivo.
 */
export function configDesdeUrl(url, ca) {
  const u = new URL(url);
  const local = HOSTS_LOCALES.includes(u.hostname);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || undefined,
    ssl: ca ? { ca: fs.readFileSync(ca, 'utf8') } : local ? undefined : { rejectUnauthorized: true },
  };
}

export function crearPoolMysql({ url, ca, zonaHoraria }) {
  if (!url) throw new NoDisponible('MySQL no está configurado (falta MYSQL_URL)');
  const pool = mysql.createPool({
    ...configDesdeUrl(url, ca),
    connectionLimit: 5,
    dateStrings: true, // fechas como texto: evita corrimientos por zona horaria
    decimalNumbers: true, // DECIMAL como number y no como string
    charset: 'utf8mb4',
  });
  // Los servidores en la nube corren en UTC; NOW() y CURRENT_TIMESTAMP deben
  // quedar en hora de Guatemala.
  pool.on('connection', (conexion) => conexion.query(`SET time_zone = '${zonaHoraria}'`));
  return pool;
}

/** Ejecuta `fn(conexion)` dentro de una transacción; si algo falla, hace ROLLBACK. */
export async function enTransaccion(pool, fn) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw traducirError(error);
  } finally {
    conexion.release();
  }
}

/** Traduce errores del driver de MySQL a errores del dominio. */
export function traducirError(error, mensajes = {}) {
  switch (error?.code) {
    case 'ER_DUP_ENTRY':
      return new Conflicto(mensajes.duplicado ?? 'El registro ya existe');
    case 'ER_SIGNAL_EXCEPTION': // SIGNAL de un trigger
      return new Conflicto(error.sqlMessage);
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new DatosInvalidos('Un dato no cumple las reglas de la base', { restriccion: error.sqlMessage });
    case 'ER_NO_REFERENCED_ROW_2':
      return new DatosInvalidos(mensajes.referencia ?? 'Se hace referencia a un registro que no existe');
    default:
      return error;
  }
}
