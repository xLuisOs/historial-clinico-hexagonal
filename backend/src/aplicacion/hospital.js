// Casos de uso exclusivos del Hospital General (sea cual sea su motor):
// internamientos (los decide el médico) y facturación (recepción y admin).

import { NoDisponible } from '../dominio/errores.js';
import { validarNuevaFactura, validarPagoFactura } from '../dominio/factura.js';
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

// ------------------------------------------------------------- facturación

function facturacionDe(repos) {
  if (!repos.facturacion) throw new NoDisponible('Solo disponible para el Hospital General');
  return repos.facturacion;
}

// Regla: una consulta o un internamiento del mismo paciente, sin otra factura
// vigente. El total lo calcula la base a partir del detalle.
export function crearFactura({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return facturacionDe(repos).crear(pacienteId, validarNuevaFactura(datos));
}

// La base rechaza un pago mayor al saldo y cierra la factura al completarse.
export function registrarPagoFactura({ usuario, repos }, facturaId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return facturacionDe(repos).registrarPago(facturaId, validarPagoFactura(datos));
}

// Solo el admin, y solo si la factura no tiene pagos.
export function anularFactura({ usuario, repos }, facturaId) {
  exigirRol(usuario, 'admin');
  return facturacionDe(repos).anular(facturaId);
}
