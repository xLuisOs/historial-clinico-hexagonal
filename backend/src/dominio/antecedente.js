import { Validador } from './validacion.js';

// Antecedentes médicos del paciente: lo que el médico necesita saber antes de
// atenderlo y que no sale de una consulta en particular (enfermedades de base,
// cirugías previas, antecedentes familiares, hábitos y medicamentos que toma).
//
// Antecedente = {
//   id, tipo, descripcion,
//   anioInicio,                    // año aproximado (opcional)
//   registradoPor: { id, nombre }, fechaRegistro
// }

export const TIPOS_ANTECEDENTE = ['patologico', 'quirurgico', 'familiar', 'habito', 'medicamento'];

export function validarAntecedente(datos = {}) {
  const v = new Validador();
  const antecedente = {
    tipo: v.opcion('tipo', datos.tipo, TIPOS_ANTECEDENTE, { requerido: true }),
    descripcion: v.texto('descripcion', datos.descripcion, { requerido: true, max: 300 }),
    anioInicio: v.numero('anioInicio', datos.anioInicio === '' ? null : datos.anioInicio, {
      entero: true, min: 1900, max: new Date().getFullYear(),
    }),
  };
  v.lanzarSiHayErrores();
  return antecedente;
}
