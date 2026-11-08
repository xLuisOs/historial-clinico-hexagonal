// Crea las colecciones del laboratorio con sus validadores ($jsonSchema) e
// índices. Funciona igual contra el Mongo de Docker y contra Atlas.
//
//   npm run db:mongo                    colecciones + validadores + índices
//   npm run db:mongo:semilla            ... y además datos de prueba
//   npm run db:mongo -- --reiniciar     BORRA las colecciones y las vuelve a crear
//
// Usa MONGO_ADMIN_URL si existe (un usuario que puede crear colecciones y
// cambiar validadores); si no, MONGO_URL.

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { COLECCIONES } from '../db/mongo/esquemas.js';
import { SEMILLA } from '../db/mongo/semilla.js';
import { prepararDns } from '../src/adaptadores/salida/mongo/conexion.js';

dotenv.config({ quiet: true });

const url = process.env.MONGO_ADMIN_URL || process.env.MONGO_URL;
if (!url) {
  console.error('Falta MONGO_URL en backend/.env');
  process.exit(1);
}
const nombreDb = process.env.MONGO_DB ?? 'laboratorio';
const conSemilla = process.argv.includes('--semilla');
const reiniciar = process.argv.includes('--reiniciar');

prepararDns(url);
const cliente = new MongoClient(url, { serverSelectionTimeoutMS: 8000 });

try {
  await cliente.connect();
  const db = cliente.db(nombreDb);
  console.log(`Conectado a la base "${nombreDb}"`);

  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  if (reiniciar) {
    console.log('· Eliminando colecciones del laboratorio...');
    for (const nombre of Object.keys(COLECCIONES)) {
      if (existentes.has(nombre)) await db.collection(nombre).drop();
      existentes.delete(nombre);
    }
  }

  for (const [nombre, { validador, indices }] of Object.entries(COLECCIONES)) {
    // validationLevel strict + action error: un documento que no cumple el
    // esquema se rechaza, igual que un CHECK en SQL.
    const opciones = { validator: validador, validationLevel: 'strict', validationAction: 'error' };
    if (existentes.has(nombre)) {
      await db.command({ collMod: nombre, ...opciones });
    } else {
      await db.createCollection(nombre, opciones);
    }
    for (const { llave, opciones: opcionesIndice = {} } of indices) {
      await db.collection(nombre).createIndex(llave, opcionesIndice);
    }
    console.log(`· ${nombre.padEnd(20)} validador + ${indices.length} índice(s)`);
  }

  if (conSemilla) {
    if ((await db.collection('pacientes').countDocuments()) > 0) {
      console.log('\nYa hay pacientes: no se cargan datos de prueba. Usa --reiniciar para empezar de cero.');
    } else {
      for (const [nombre, documentos] of Object.entries(SEMILLA)) {
        await db.collection(nombre).insertMany(documentos);
        console.log(`· semilla ${nombre.padEnd(18)} ${documentos.length} documentos`);
      }
    }
  }
  console.log('\nBase del laboratorio lista.');
} catch (error) {
  console.error(`\n✘ ${error.message}`);
  if (error.code === 121) console.error(JSON.stringify(error.errInfo?.details, null, 2));
  process.exitCode = 1;
} finally {
  await cliente.close();
}
