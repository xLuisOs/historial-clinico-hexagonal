import { MongoClient } from 'mongodb';
import { NoDisponible } from '../../../dominio/errores.js';

/**
 * Cliente de MongoDB. Atlas (y el contenedor local con replica set) permiten
 * transacciones de varios documentos, que se usan para las operaciones atómicas.
 */
export function crearClienteMongo({ url }) {
  if (!url) throw new NoDisponible('MongoDB no está configurado (falta MONGO_URL)');
  return new MongoClient(url, { maxPoolSize: 5 });
}

/** Ejecuta `fn(sesion)` dentro de una transacción; se reintenta sola ante errores transitorios. */
export async function enTransaccionMongo(cliente, fn) {
  const sesion = cliente.startSession();
  try {
    return await sesion.withTransaction(() => fn(sesion), {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } finally {
    await sesion.endSession();
  }
}
