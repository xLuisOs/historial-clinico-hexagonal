// Casos de uso exclusivos del Centro Médico Pediátrico (sea cual sea su motor).

import { NoDisponible } from '../dominio/errores.js';
import { validarCobro, validarVacunaAplicada } from '../dominio/pediatrico.js';
import { exigirRol } from './casos-uso.js';

function pediatricoDe(repos) {
  if (!repos.pediatrico) throw new NoDisponible('Solo disponible para el Centro Médico Pediátrico');
  return repos.pediatrico;
}

// Solo un médico aplica vacunas; queda registrado como quien la aplicó.
// Devuelve el esquema de vacunación actualizado del paciente.
export function aplicarVacuna({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'medico');
  return pediatricoDe(repos).aplicarVacuna(pacienteId, validarVacunaAplicada(datos), usuario.medicoId);
}

// Catálogo de servicios facturables con su precio vigente.
export function listarServicios({ repos }) {
  return pediatricoDe(repos).listarServicios();
}

// Cobra la recepción (o el admin): un cobro por consulta, a nombre del encargado.
export function generarCobro({ usuario, repos }, consultaId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return pediatricoDe(repos).generarCobro(consultaId, validarCobro(datos));
}
