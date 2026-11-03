import fs from 'node:fs';
import path from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { NoDisponible } from '../../../dominio/errores.js';

/**
 * Cliente de Firestore con la clave de la cuenta de servicio. El Admin SDK no
 * pasa por las reglas de seguridad (que bloquean todo acceso directo): solo el
 * backend, con esta clave, puede leer y escribir.
 *
 * Si existe FIRESTORE_EMULATOR_HOST, el SDK se conecta al emulador local y la
 * clave no hace falta.
 */
export function crearFirestore({ projectId, credenciales }) {
  const emulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (!credenciales && !emulador) {
    throw new NoDisponible('Firebase no está configurado (falta FIREBASE_CREDENTIALS)');
  }

  let cuenta = null;
  if (credenciales) {
    const ruta = path.resolve(credenciales);
    if (!fs.existsSync(ruta)) throw new NoDisponible(`No se encontró la clave de Firebase en ${ruta}`);
    cuenta = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  }

  // App con nombre propio para no chocar con otra inicialización por defecto.
  const app = initializeApp(
    {
      ...(cuenta && { credential: cert(cuenta) }),
      projectId: projectId || cuenta?.project_id || 'demo-odontologica',
    },
    'odontologica',
  );
  return getFirestore(app);
}

/**
 * Ejecuta `fn(transaccion)` como transacción de Firestore: todas las
 * escrituras se aplican juntas o ninguna. Firestore exige leer antes de
 * escribir, y reintenta solo si otro proceso modificó lo que se leyó.
 */
export async function enTransaccion(db, fn) {
  try {
    return await db.runTransaction(fn);
  } catch (error) {
    throw traducirError(error);
  }
}

/** Traduce errores del SDK de Firebase (códigos gRPC) a errores del dominio. */
export function traducirError(error) {
  switch (error?.code) {
    case 7: // PERMISSION_DENIED
    case 16: // UNAUTHENTICATED
      return new NoDisponible('Firebase rechazó las credenciales (revisa FIREBASE_CREDENTIALS)');
    case 14: // UNAVAILABLE
      return new NoDisponible('No se pudo conectar con Firebase');
    default:
      return error;
  }
}

// ------------------------------------------------------------------ fechas
//
// Firestore guarda instantes (timestamp). El resto de la API trabaja con
// fechas en texto y en hora de Guatemala, igual que MySQL con dateStrings:
// 'AAAA-MM-DD' para fechas y 'AAAA-MM-DD HH:MM:SS' para fechas con hora.

function minutosDeDesfase(zonaHoraria) {
  const [, signo, horas, minutos] = zonaHoraria.match(/^([+-])(\d{2}):(\d{2})$/);
  return (signo === '-' ? -1 : 1) * (Number(horas) * 60 + Number(minutos));
}

/** 'AAAA-MM-DD' (medianoche local) → Timestamp */
export function fechaATimestamp(fecha, zonaHoraria) {
  return fecha ? Timestamp.fromDate(new Date(`${fecha}T00:00:00${zonaHoraria}`)) : null;
}

/** Timestamp → 'AAAA-MM-DD HH:MM:SS' en hora local */
export function timestampATexto(valor, zonaHoraria) {
  if (!valor?.toDate) return null;
  const local = new Date(valor.toMillis() + minutosDeDesfase(zonaHoraria) * 60_000);
  return local.toISOString().slice(0, 19).replace('T', ' ');
}

/** Timestamp → 'AAAA-MM-DD' en hora local */
export function timestampAFecha(valor, zonaHoraria) {
  return timestampATexto(valor, zonaHoraria)?.slice(0, 10) ?? null;
}
