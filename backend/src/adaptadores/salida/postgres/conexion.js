import fs from 'node:fs';
import pg from 'pg';
import { Conflicto, DatosInvalidos, FallaTecnica } from '../../../dominio/errores.js';

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

// localtimestamp y current_date quedan en hora de Guatemala porque el usuario
// hospital_app tiene la zona horaria configurada (ALTER ROLE ... SET timezone
// en db/postgres/01_esquema.sql).
export function crearPoolPostgres({ url, ca }) {
  if (!url) throw new FallaTecnica('PostgreSQL no está configurado (falta POSTGRES_URL)');
  // Abrir una conexión a Supabase cuesta varios viajes de ida y vuelta (TLS +
  // autenticación): se mantienen abiertas 5 minutos en vez de los 10 s por defecto.
  // Si no hay conexión en 10 s, la petición falla en vez de quedarse esperando.
  const pool = new pg.Pool({
    ...configDesdeUrl(url, ca), max: 5, types,
    idleTimeoutMillis: 300_000, keepAlive: true, connectionTimeoutMillis: 10_000,
  });
  // Supabase o la red pueden cortar una conexión que está sin usar. Sin este
  // manejador, pg lanza el error fuera de cualquier petición y Node apaga el
  // servidor entero. Con él, el pool descarta esa conexión y abre otra.
  pool.on('error', (error) => console.warn(`[postgres] conexión inactiva descartada: ${error.message}`));
  // Las consultas sueltas (fuera de transacción) también traducen sus errores:
  // una caída de red llega al cliente como "base no disponible", no como error 500.
  const consultar = pool.query.bind(pool);
  pool.query = (...args) => consultar(...args).catch((error) => { throw traducirError(error); });
  return pool;
}

// Errores de red o de servidor caído: la base no está disponible en este momento.
const SIN_CONEXION = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', '57P01', '57P03', '08001', '08006'];

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
      return new DatosInvalidos('Revisa los datos e intenta de nuevo', { restriccion: error.constraint });
    case '23503': // foreign_key_violation
      return new DatosInvalidos(mensajes.referencia ?? 'Se hace referencia a un registro que no existe');
    case '28P01': // invalid_password
    case '42501': // insufficient_privilege
      return new FallaTecnica('PostgreSQL rechazó el acceso (revisa POSTGRES_URL)');
    default:
      if (SIN_CONEXION.includes(error?.code) || /Connection terminated|timeout exceeded when trying to connect/i.test(error?.message ?? '')) {
        return new FallaTecnica(`Sin conexión con PostgreSQL: ${error.code ?? error.message}`, 'No se pudo conectar. Intenta de nuevo en un momento.');
      }
      return error;
  }
}
