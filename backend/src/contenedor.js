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
import { NoDisponible } from './dominio/errores.js';
import { verificarAdaptador } from './puertos/repositorios.js';

import { crearPoolMysql } from './adaptadores/salida/mysql/conexion.js';
import { crearAdaptadorPediatricoMysql } from './adaptadores/salida/mysql/pediatrico/index.js';
import { crearClienteMongo } from './adaptadores/salida/mongo/conexion.js';
import { crearAdaptadorLaboratorioMongo } from './adaptadores/salida/mongo/laboratorio/index.js';
import { crearAdaptadorHospitalPostgres } from './adaptadores/salida/postgres/hospital/index.js';
import { crearAdaptadorOdontologicaFirebase } from './adaptadores/salida/firebase/odontologica/index.js';

// Conexiones compartidas, creadas bajo demanda.
const conexiones = {};
const mysqlPool = () => (conexiones.mysql ??= crearPoolMysql(entorno.mysql));
const mongoCliente = () => (conexiones.mongo ??= crearClienteMongo(entorno.mongo));

// "institución:motor" → fábrica del adaptador. Cada esquema/modelo
// pertenece a una institución, por eso la clave combina ambos.
const FABRICAS = {
  'pediatrico:mysql': () => crearAdaptadorPediatricoMysql(mysqlPool()),
  'laboratorio:mongodb': () => crearAdaptadorLaboratorioMongo(mongoCliente(), entorno.mongo.db),
  'hospital:postgresql': () => crearAdaptadorHospitalPostgres(entorno.postgres),
  'odontologica:firebase': () => crearAdaptadorOdontologicaFirebase(entorno.firebase),
};

const adaptadores = new Map();

export function repositoriosDe(claveInstitucion) {
  const institucion = INSTITUCIONES[claveInstitucion];
  if (!institucion) throw new NoDisponible(`Institución desconocida: ${claveInstitucion}`);

  const clave = `${institucion.clave}:${institucion.motor}`;
  if (!adaptadores.has(clave)) {
    const fabrica = FABRICAS[clave];
    if (!fabrica) throw new NoDisponible(`No hay adaptador para ${institucion.nombre} con ${institucion.motor}`);
    adaptadores.set(clave, verificarAdaptador(clave, fabrica()));
  }
  return adaptadores.get(clave);
}

export async function cerrarConexiones() {
  await Promise.allSettled([conexiones.mysql?.end(), conexiones.mongo?.close()]);
}
