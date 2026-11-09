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

// En pediatría también se pregunta cómo fue el nacimiento: semanas de
// gestación, peso al nacer, complicaciones del parto (antecedente perinatal).
const TIPOS_EXTRA = { pediatrico: ['perinatal'] };

/** Tipos de antecedente que acepta la institución. */
export const tiposAntecedente = (institucion) => [...TIPOS_ANTECEDENTE, ...(TIPOS_EXTRA[institucion] ?? [])];

export function validarAntecedente(datos = {}, institucion) {
  const v = new Validador();
  const tipo = v.opcion('tipo', datos.tipo, tiposAntecedente(institucion), { requerido: true });
  const antecedente = {
    tipo,
    descripcion: v.texto('descripcion', datos.descripcion, { requerido: true, max: 300 }),
    // El perinatal es del nacimiento: no lleva año.
    anioInicio: tipo === 'perinatal' ? null : v.numero('anioInicio', datos.anioInicio === '' ? null : datos.anioInicio, {
      entero: true, min: 1900, max: new Date().getFullYear(),
    }),
  };
  v.lanzarSiHayErrores();
  return antecedente;
}
