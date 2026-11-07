import fs from 'node:fs';
import pg from 'pg';
import { Conflicto, DatosInvalidos, NoDisponible } from '../../../dominio/errores.js';

const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1'];

// Fechas como texto, igual que MySQL con dateStrings: así no hay corrimientos
// por la zona horaria del servidor de Node. NUMERIC llega como number.
const TIPOS = {
  1082: (v) => v, // date      → 'AAAA-MM-DD'
  1114: (v) => v.slice(0, 19), // timestamp → 'AAAA-MM-DD HH:MM:SS'
  1700: (v) => Number(v), // numeric
};
const types = { getTypeParser: (oid, formato) => TIPOS[oid] ?? pg.types.getTypeParser(oid, formato) };

/**
 * Convierte una URL postgresql://usuario:clave@host:puerto/base en la
 * configuración de pg. Fuera de localhost la conexión va cifrada (Supabase la
 * exige): si se indica `ca`, además se valida el certificado del servidor.
 * Se ignora un ?sslmode= de la URL para que mande esta configuración.
 */
export function configDesdeUrl(url, ca) {
  const u = new URL(url);
  const local = HOSTS_LOCALES.includes(u.hostname);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'postgres',
    ssl: ca ? { ca: fs.readFileSync(ca, 'utf8') } : local ? false : { rejectUnauthorized: false },
  };
}

export function crearPoolPostgres({ url, ca, zonaHoraria }) {
  if (!url) throw new NoDisponible('PostgreSQL no está configurado (falta POSTGRES_URL)');
  const pool = new pg.Pool({ ...configDesdeUrl(url, ca), max: 5, types });
  // localtimestamp y current_date deben quedar en hora de Guatemala.
  pool.on('connect', (cliente) => cliente.query(`SET timezone = '${zonaHoraria}'`));
  return pool;
}

/** Ejecuta `fn(cliente)` dentro de una transacción; si algo falla, hace ROLLBACK. */
export async function enTransaccion(pool, fn) {
  const cliente = await pool.connect().catch((e) => { throw traducirError(e); });
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw traducirError(error);
  } finally {
    cliente.release();
  }
}

/** Traduce errores del driver de PostgreSQL a errores del dominio. */
export function traducirError(error, mensajes = {}) {
  switch (error?.code) {
    case '23505': // unique_violation
      return new Conflicto(mensajes.duplicado ?? 'El registro ya existe');
    case 'P0001': // RAISE EXCEPTION de un trigger
      return new Conflicto(error.message);
    case '23514': // check_violation
      return new DatosInvalidos('Un dato no cumple las reglas de la base', { restriccion: error.constraint });
    case '23503': // foreign_key_violation
      return new DatosInvalidos(mensajes.referencia ?? 'Se hace referencia a un registro que no existe');
    case '28P01': // invalid_password
    case '42501': // insufficient_privilege
      return new NoDisponible('PostgreSQL rechazó el acceso (revisa POSTGRES_URL)');
    default:
      return error;
  }
}
