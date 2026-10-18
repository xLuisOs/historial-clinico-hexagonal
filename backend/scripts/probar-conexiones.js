// Verifica que cada motor configurado en backend/.env responda.
//   npm run db:probar

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { configDesdeUrl } from '../src/adaptadores/salida/mysql/conexion.js';

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
    return process.env.POSTGRES_URL ? 'configurado (prueba pendiente: adaptador de Fer)' : 'sin configurar (POSTGRES_URL)';
  },

  async 'Firebase (odontológica)'() {
    return process.env.FIREBASE_PROJECT_ID ? 'configurado (prueba pendiente: adaptador de Fer)' : 'sin configurar (FIREBASE_PROJECT_ID)';
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
      console.log('    → Descarga el CA certificate de Aiven y pon su ruta en MYSQL_SSL_CA');
    }
  }
}
process.exitCode = fallo ? 1 : 0;
