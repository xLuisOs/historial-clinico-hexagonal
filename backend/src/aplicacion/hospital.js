// Casos de uso exclusivos del Hospital General (sea cual sea su motor):
// internamientos. Los decide el médico; cualquiera puede ver las habitaciones.

import { NoDisponible } from '../dominio/errores.js';
import { validarAlta, validarCambioMedico, validarIngreso, validarTratamiento } from '../dominio/internamiento.js';
import { exigirRol } from './casos-uso.js';

function internamientosDe(repos) {
  if (!repos.internamientos) throw new NoDisponible('Solo disponible para el Hospital General');
  return repos.internamientos;
}

export function habitacionesDisponibles({ repos }) {
  return internamientosDe(repos).habitacionesDisponibles();
}

// Regla: un paciente activo, sin otro internamiento abierto, a una habitación
// disponible. Internamiento + médico a cargo + habitación ocupada: todo o nada.
export function internar({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'medico');
  return internamientosDe(repos).internar(pacienteId, validarIngreso(datos));
}

export function cambiarMedicoACargo({ usuario, repos }, internamientoId, datos) {
  exigirRol(usuario, 'medico');
  return internamientosDe(repos).cambiarMedico(internamientoId, validarCambioMedico(datos));
}

export function agregarTratamientoInternamiento({ usuario, repos }, internamientoId, datos) {
  exigirRol(usuario, 'medico');
  return internamientosDe(repos).agregarTratamiento(internamientoId, validarTratamiento(datos));
}

// Alta: cierra el internamiento y libera la habitación.
export function darDeAlta({ usuario, repos }, internamientoId, datos) {
  exigirRol(usuario, 'medico');
  return internamientosDe(repos).darDeAlta(internamientoId, validarAlta(datos));
}
