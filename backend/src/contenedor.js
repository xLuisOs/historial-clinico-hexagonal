// =====================================================================
// CONTENEDOR (raíz de composición)
//
// Único lugar que conoce a la vez instituciones, motores y adaptadores.
// Dada la institución del usuario, entrega el adaptador del motor
// configurado para ella. Los adaptadores se crean la primera vez que se
// piden y se reutilizan (una sola conexión/pool por motor).
// =====================================================================

import { entorno } from './config/entorno.js';
import { INSTITUCIONES } from './config/instituciones.js';
import { FallaTecnica } from './dominio/errores.js';
import { verificarAdaptador } from './puertos/repositorios.js';

import { crearPoolMysql } from './adaptadores/salida/mysql/conexion.js';
import { crearAdaptadorPediatricoMysql } from './adaptadores/salida/mysql/pediatrico/index.js';
import { crearClienteMongo } from './adaptadores/salida/mongo/conexion.js';
import { crearAdaptadorLaboratorioMongo } from './adaptadores/salida/mongo/laboratorio/index.js';
import { crearPoolPostgres } from './adaptadores/salida/postgres/conexion.js';
import { crearAdaptadorHospitalPostgres } from './adaptadores/salida/postgres/hospital/index.js';
import { crearFirestore } from './adaptadores/salida/firebase/conexion.js';
import { crearAdaptadorOdontologicaFirebase } from './adaptadores/salida/firebase/odontologica/index.js';

// Conexiones compartidas, creadas bajo demanda.
const conexiones = {};
const mysqlPool = () => (conexiones.mysql ??= crearPoolMysql(entorno.mysql));
const mongoCliente = () => (conexiones.mongo ??= crearClienteMongo(entorno.mongo));
const postgresPool = () => (conexiones.postgres ??= crearPoolPostgres(entorno.postgres));
const firestore = () => (conexiones.firebase ??= crearFirestore(entorno.firebase));

// "institución:motor" → fábrica del adaptador. Cada esquema/modelo
// pertenece a una institución, por eso la clave combina ambos.
const FABRICAS = {
  'pediatrico:mysql': () => crearAdaptadorPediatricoMysql(mysqlPool()),
  'laboratorio:mongodb': () => crearAdaptadorLaboratorioMongo(mongoCliente(), entorno.mongo.db, entorno.mongo.zonaHoraria),
  'hospital:postgresql': () => crearAdaptadorHospitalPostgres(postgresPool()),
  'odontologica:firebase': () => crearAdaptadorOdontologicaFirebase(firestore(), entorno.firebase.zonaHoraria),
};

const adaptadores = new Map();

export function repositoriosDe(claveInstitucion) {
  const institucion = INSTITUCIONES[claveInstitucion];
  if (!institucion) throw new FallaTecnica(`Institución desconocida: ${claveInstitucion}`);

  const clave = `${institucion.clave}:${institucion.motor}`;
  if (!adaptadores.has(clave)) {
    const fabrica = FABRICAS[clave];
    if (!fabrica) throw new FallaTecnica(`No hay adaptador para ${institucion.nombre} con ${institucion.motor}`);
    adaptadores.set(clave, verificarAdaptador(clave, fabrica()));
  }
  return adaptadores.get(clave);
}

export async function cerrarConexiones() {
  await Promise.allSettled([conexiones.mysql?.end(), conexiones.mongo?.close(), conexiones.postgres?.end(), conexiones.firebase?.terminate()]);
}
