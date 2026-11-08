// Casos de uso exclusivos del Centro Médico Pediátrico (sea cual sea su motor).

import { NoDisponible } from '../dominio/errores.js';
import { Validador } from '../dominio/validacion.js';
import { validarCobro, validarPagoCobro, validarVacunaAplicada } from '../dominio/pediatrico.js';
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

// Abonos contra un cobro (recepción o admin). No se paga más que el saldo.
export function registrarPago({ usuario, repos }, cobroId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return pediatricoDe(repos).registrarPago(cobroId, validarPagoCobro(datos));
}

// Buscar al encargado por DPI para asociarle otro niño (hermanos). Lo usan
// quienes registran pacientes. El DPI viaja en el cuerpo, no en la URL, para
// que no quede en los registros de peticiones (es un dato restringido).
export function buscarEncargado({ usuario, repos }, datos = {}) {
  exigirRol(usuario, 'recepcion', 'medico', 'admin');
  const v = new Validador();
  const dpi = v.patron('dpi', datos.dpi == null ? null : String(datos.dpi), /^\d{13}$/, 'DPI de 13 dígitos', { requerido: true });
  v.lanzarSiHayErrores();
  return pediatricoDe(repos).buscarEncargado(dpi);
}
