// Casos de uso exclusivos del Centro Médico Pediátrico (sea cual sea su motor).

import { NoDisponible } from '../dominio/errores.js';
import { validarVacunaAplicada } from '../dominio/pediatrico.js';
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
