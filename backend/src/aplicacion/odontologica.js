// Casos de uso exclusivos de la Clínica Odontológica (sea cual sea su motor).

import { NoDisponible } from '../dominio/errores.js';
import { validarPago } from '../dominio/pago.js';
import { exigirRol } from './casos-uso.js';

// Catálogo de procedimientos con su precio, para el formulario de consulta.
export function listarProcedimientos({ repos }) {
  if (!repos.odontologica) throw new NoDisponible('Solo disponible para la Clínica Odontológica');
  return repos.odontologica.listarProcedimientos();
}

// Cobra la recepcionista (o el admin). No se puede cobrar más que el saldo.
export function registrarPago({ usuario, repos }, consultaId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  if (!repos.odontologica) throw new NoDisponible('Solo disponible para la Clínica Odontológica');
  return repos.odontologica.registrarPago(consultaId, validarPago(datos), usuario);
}
