// Casos de uso exclusivos de la Clínica Odontológica (sea cual sea su motor).

import { NoDisponible } from '../dominio/errores.js';

// Catálogo de procedimientos con su precio, para el formulario de consulta.
export function listarProcedimientos({ repos }) {
  if (!repos.odontologica) throw new NoDisponible('Solo disponible para la Clínica Odontológica');
  return repos.odontologica.listarProcedimientos();
}
