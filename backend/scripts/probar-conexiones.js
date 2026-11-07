// Verifica que cada motor configurado en backend/.env responda.
//   npm run db:probar

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { configDesdeUrl } from '../src/adaptadores/salida/mysql/conexion.js';
import { crearPoolPostgres } from '../src/adaptadores/salida/postgres/conexion.js';
import { crearFirestore } from '../src/adaptadores/salida/firebase/conexion.js';
import { COLECCIONES } from '../src/adaptadores/salida/firebase/odontologica/modelo.js';

dotenv.config({ quiet: true });

const pruebas = {
  async 'MySQL (pediátrico)'() {
    if (!process.env.MYSQL_URL) return 'sin configurar (MYSQL_URL)';
    const cx = await mysql.createConnection(configDesdeUrl(process.env.MYSQL_URL, process.env.MYSQL_SSL_CA));
    try {
      const [[v]] = await cx.query('SELECT VERSION() AS version, CURRENT_USER() AS usuario');
      const [[p]] = await cx.query('SELECT COUNT(*) AS n FROM paciente');
      return `MySQL ${v.version} como ${v.usuario} · ${p.n} pacientes`;
    } finally {
      await cx.end();
    }
  },

  async 'MongoDB (laboratorio)'() {
    if (!process.env.MONGO_URL) return 'sin configurar (MONGO_URL)';
    const cliente = new MongoClient(process.env.MONGO_URL, { serverSelectionTimeoutMS: 8000 });
    try {
      await cliente.connect();
      const db = cliente.db(process.env.MONGO_DB ?? 'laboratorio');
      const hola = await db.command({ hello: 1 });
      const { version } = await db.admin().command({ buildInfo: 1 });
      const transacciones = hola.setName ? `replica set "${hola.setName}" (transacciones OK)` : 'SIN replica set (no hay transacciones)';
      return `MongoDB ${version} · ${transacciones}`;
    } finally {
      await cliente.close();
    }
  },

  async 'PostgreSQL (hospital)'() {
    if (!process.env.POSTGRES_URL) return 'sin configurar (POSTGRES_URL)';
    const pool = crearPoolPostgres({
      url: process.env.POSTGRES_URL,
      ca: process.env.POSTGRES_SSL_CA,
    });
    try {
      const { rows: [v] } = await pool.query(
        `SELECT split_part(version(), ' ', 2) AS version, current_user AS usuario, current_schema() AS esquema`,
      );
      const { rows: [p] } = await pool.query('SELECT COUNT(*) AS n FROM paciente');
      return `PostgreSQL ${v.version} como ${v.usuario} (esquema ${v.esquema}) · ${p.n} pacientes`;
    } finally {
      await pool.end();
    }
  },

  async 'Firebase (odontológica)'() {
    if (!process.env.FIREBASE_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST) {
      return 'sin configurar (FIREBASE_CREDENTIALS)';
    }
    const db = crearFirestore({
      projectId: process.env.FIREBASE_PROJECT_ID,
      credenciales: process.env.FIREBASE_CREDENTIALS,
    });
    try {
      const conteo = await db.collection(COLECCIONES.pacientes).count().get();
      const destino = process.env.FIRESTORE_EMULATOR_HOST ? `emulador ${process.env.FIRESTORE_EMULATOR_HOST}` : `proyecto ${db.projectId}`;
      return `Firestore (${destino}) · ${conteo.data().count} pacientes`;
    } finally {
      await db.terminate();
    }
  },
};

let fallo = false;
for (const [nombre, probar] of Object.entries(pruebas)) {
  try {
    console.log(`✔ ${nombre.padEnd(24)} ${await probar()}`);
  } catch (error) {
    fallo = true;
    console.log(`✘ ${nombre.padEnd(24)} ${error.message}`);
    if (/self[- ]signed|certificate/i.test(error.message)) {
      console.log(nombre.startsWith('PostgreSQL')
        ? '    → Descarga el certificado SSL de Supabase y pon su ruta en POSTGRES_SSL_CA'
        : '    → Descarga el CA certificate de Aiven y pon su ruta en MYSQL_SSL_CA');
    }
    if (/relation "paciente" does not exist/.test(error.message)) {
      console.log('    → El usuario no ve el esquema del hospital: conéctate como hospital_app (ver README)');
    }
  }
}
process.exitCode = fallo ? 1 : 0;
