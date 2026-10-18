// Crea la base del pediátrico ejecutando los scripts de db/mysql/ en orden.
// Funciona igual contra el MySQL de Docker y contra Aiven, sin instalar el
// cliente de MySQL.
//
//   npm run db:mysql                    esquema + triggers + usuarios
//   npm run db:mysql:semilla            ... y además datos de prueba
//   npm run db:mysql -- --reiniciar     BORRA la base y la vuelve a crear
//
// Usa MYSQL_ADMIN_URL (un usuario con permisos de administración), no el
// usuario de la aplicación, que a propósito no puede crear tablas.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { configDesdeUrl } from '../src/adaptadores/salida/mysql/conexion.js';

dotenv.config({ quiet: true });

const carpeta = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'mysql');
const conSemilla = process.argv.includes('--semilla');
const reiniciar = process.argv.includes('--reiniciar');

/** Divide un script en sentencias respetando DELIMITER (necesario para triggers). */
function dividirSentencias(sql) {
  const sentencias = [];
  let delimitador = ';';
  let actual = [];
  for (const linea of sql.split(/\r?\n/)) {
    const cambio = linea.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (cambio) {
      delimitador = cambio[1];
      continue;
    }
    actual.push(linea);
    if (linea.trimEnd().endsWith(delimitador)) {
      const texto = actual.join('\n').trimEnd().slice(0, -delimitador.length).trim();
      if (texto.replace(/--.*$/gm, '').trim()) sentencias.push(texto);
      actual = [];
    }
  }
  return sentencias;
}

/** Reemplaza los marcadores __VARIABLE__ por valores del .env. */
function sustituirSecretos(sql) {
  return sql.replace(/__([A-Z_]+)__/g, (_, nombre) => {
    const valor = process.env[nombre];
    if (!valor) throw new Error(`Falta ${nombre} en backend/.env`);
    return valor.replace(/'/g, "''");
  });
}

const url = process.env.MYSQL_ADMIN_URL;
if (!url) {
  console.error('Falta MYSQL_ADMIN_URL en backend/.env');
  process.exit(1);
}

const config = configDesdeUrl(url, process.env.MYSQL_SSL_CA);
const conexion = await mysql.createConnection({ ...config, database: undefined });
console.log(`Conectado a ${config.host}:${config.port} como ${config.user}`);

try {
  if (reiniciar) {
    console.log('· Eliminando la base pediatrico...');
    await conexion.query('DROP DATABASE IF EXISTS pediatrico');
  }

  const archivos = fs.readdirSync(carpeta)
    .filter((a) => a.endsWith('.sql'))
    .filter((a) => conSemilla || !a.includes('semilla'))
    .sort();

  for (const archivo of archivos) {
    const sql = sustituirSecretos(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
    const sentencias = dividirSentencias(sql);
    process.stdout.write(`· ${archivo} (${sentencias.length} sentencias)... `);
    for (const sentencia of sentencias) {
      try {
        await conexion.query(sentencia);
      } catch (error) {
        console.log('ERROR');
        console.error(`\n${sentencia.slice(0, 300)}\n\n→ ${error.message}`);
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.error('\nLa base ya existe. Para recrearla usa: npm run db:mysql -- --reiniciar');
        }
        process.exitCode = 1;
        throw error;
      }
    }
    console.log('ok');
  }
  console.log('\nBase pediatrico lista.');
} catch {
  // el detalle ya se mostró arriba
} finally {
  await conexion.end();
}
