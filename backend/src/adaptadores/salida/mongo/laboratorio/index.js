// Adaptador MongoDB del Laboratorio Clínico.
// TODO (Luis): implementar los puertos de puertos/repositorios.js sobre el
// modelo documental del laboratorio (pendiente de definir qué se embebe y qué
// se referencia: pacientes, órdenes, resultados por parámetro).

import { adaptadorPendiente } from '../../pendiente.js';

export function crearAdaptadorLaboratorioMongo() {
  return adaptadorPendiente('Laboratorio (MongoDB)');
}
