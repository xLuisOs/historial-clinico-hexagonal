import { Validador } from './validacion.js';

// Internamientos del hospital: ingreso a una habitación, médicos a cargo,
// tratamientos durante la estadía y alta.

const id = (v, campo, valor) => v.texto(campo, valor == null ? null : String(valor), { requerido: true });

export function validarIngreso(datos = {}) {
  const v = new Validador();
  const ingreso = {
    habitacionId: id(v, 'habitacionId', datos.habitacionId),
    medicoId: id(v, 'medicoId', datos.medicoId),
    motivoIngreso: v.texto('motivoIngreso', datos.motivoIngreso, { requerido: true, max: 300 }),
    diagnosticoIngreso: v.texto('diagnosticoIngreso', datos.diagnosticoIngreso, { max: 300 }),
  };
  v.lanzarSiHayErrores();
  return ingreso;
}

export function validarCambioMedico(datos = {}) {
  const v = new Validador();
  const cambio = {
    medicoId: id(v, 'medicoId', datos.medicoId),
    motivoCambio: v.texto('motivoCambio', datos.motivoCambio, { requerido: true, max: 300 }),
  };
  v.lanzarSiHayErrores();
  return cambio;
}

export function validarTratamiento(datos = {}) {
  const v = new Validador();
  const tratamiento = {
    descripcion: v.texto('descripcion', datos.descripcion, { requerido: true, max: 300 }),
    fechaInicio: v.fecha('fechaInicio', datos.fechaInicio),
    fechaFin: v.fecha('fechaFin', datos.fechaFin),
    indicaciones: v.texto('indicaciones', datos.indicaciones, { max: 500 }),
  };
  if (tratamiento.fechaInicio && tratamiento.fechaFin && tratamiento.fechaFin < tratamiento.fechaInicio) {
    v.error('fechaFin', 'No puede ser anterior a la fecha de inicio');
  }
  v.lanzarSiHayErrores();
  return tratamiento;
}

export function validarAlta(datos = {}) {
  const v = new Validador();
  const alta = { diagnosticoAlta: v.texto('diagnosticoAlta', datos.diagnosticoAlta, { requerido: true, max: 300 }) };
  v.lanzarSiHayErrores();
  return alta;
}
