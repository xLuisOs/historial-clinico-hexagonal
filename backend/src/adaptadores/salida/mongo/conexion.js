import dns from 'node:dns';
import { MongoClient, ObjectId } from 'mongodb';
import { Conflicto, DatosInvalidos, NoDisponible, NoEncontrado } from '../../../dominio/errores.js';

const DNS_PUBLICOS = ['1.1.1.1', '8.8.8.8'];

/**
 * Las URL mongodb+srv:// (Atlas) necesitan una consulta DNS de tipo SRV que
 * Node hace con su propio resolvedor. En algunas máquinas Windows (VPN o proxy
 * del navegador) ese resolvedor queda apuntando a 127.0.0.1 sin nadie que
 * responda y la conexión falla con "querySrv ECONNREFUSED", aunque el resto del
 * sistema resuelva bien. En ese caso se usan DNS públicos. MONGO_DNS permite
 * fijar otros servidores (separados por coma) o desactivarlo con "sistema".
 */
export function prepararDns(url) {
  if (!url?.startsWith('mongodb+srv://')) return;
  const preferidos = process.env.MONGO_DNS?.trim();
  if (preferidos === 'sistema') return;
  if (preferidos) {
    dns.setServers(preferidos.split(',').map((s) => s.trim()).filter(Boolean));
    return;
  }
  const soloLocales = dns.getServers().every((s) => /^(127\.|::1$|\[::1\])/.test(s));
  if (soloLocales) dns.setServers(DNS_PUBLICOS);
}

/**
 * Cliente de MongoDB. Atlas (y el contenedor local con replica set) permiten
 * transacciones de varios documentos, que se usan para las operaciones atómicas.
 */
export function crearClienteMongo({ url }) {
  if (!url) throw new NoDisponible('MongoDB no está configurado (falta MONGO_URL)');
  prepararDns(url);
  return new MongoClient(url, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
}

/** Ejecuta `fn(sesion)` dentro de una transacción; se reintenta sola ante errores transitorios. */
export async function enTransaccionMongo(cliente, fn) {
  const sesion = cliente.startSession();
  try {
    return await sesion.withTransaction(() => fn(sesion), {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } catch (error) {
    throw traducirError(error);
  } finally {
    await sesion.endSession();
  }
}

/** Traduce errores del driver de MongoDB a errores del dominio. */
export function traducirError(error, mensajes = {}) {
  switch (error?.code) {
    case 11000: // índice único
      return new Conflicto(mensajes.duplicado ?? 'El registro ya existe');
    case 121: // el documento no cumple el validador $jsonSchema de la colección
      return new DatosInvalidos('Un dato no cumple las reglas de la base', {
        validacion: error.errInfo?.details?.schemaRulesNotSatisfied ? 'esquema' : error.message,
      });
    default:
      return error;
  }
}

/** Convierte un id de texto a ObjectId; si no tiene el formato, el registro no existe. */
export function aObjectId(id, entidad = 'Registro') {
  if (!ObjectId.isValid(String(id)) || String(id).length !== 24) {
    throw new NoEncontrado(`${entidad} no encontrado`);
  }
  return new ObjectId(String(id));
}

// ------------------------------------------------------------------ fechas
//
// Mongo guarda instantes (Date, UTC). La API trabaja con texto en hora de
// Guatemala, igual que los demás motores: 'AAAA-MM-DD HH:MM:SS'.
// Las fechas sin hora (nacimiento) se guardan a medianoche UTC para que el
// día nunca se corra.

function minutosDeDesfase(zonaHoraria) {
  const [, signo, horas, minutos] = zonaHoraria.match(/^([+-])(\d{2}):(\d{2})$/);
  return (signo === '-' ? -1 : 1) * (Number(horas) * 60 + Number(minutos));
}

export const fechaADate = (fecha) => (fecha ? new Date(`${fecha}T00:00:00Z`) : null);
export const dateAFecha = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : null);

export function dateATexto(d, zonaHoraria) {
  if (!(d instanceof Date)) return null;
  const local = new Date(d.getTime() + minutosDeDesfase(zonaHoraria) * 60_000);
  return local.toISOString().slice(0, 19).replace('T', ' ');
}
