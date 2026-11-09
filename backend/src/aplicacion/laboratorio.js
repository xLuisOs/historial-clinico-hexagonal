// Casos de uso exclusivos del Laboratorio Clínico. Igual que los comunes,
// no saben qué motor hay detrás: usan el puerto `laboratorio` del adaptador.

import { NoDisponible, SinPermiso } from '../dominio/errores.js';
import { validarCambioEstado, validarExamenesNuevos, validarMedicoReferente, validarResultados } from '../dominio/laboratorio.js';
import { especialidadParaGuardar } from './casos-uso.js';

function repoLaboratorio(repos) {
  if (!repos.laboratorio) throw new NoDisponible('Operación exclusiva del Laboratorio Clínico');
  return repos.laboratorio;
}

function exigirRol(usuario, ...roles) {
  if (!roles.includes(usuario.rol)) throw new SinPermiso(`Esta acción requiere rol: ${roles.join(' o ')}`);
}

const autor = (usuario) => ({ id: usuario.id, nombre: usuario.nombre });

export function listarTiposExamen({ repos }) {
  return repoLaboratorio(repos).listarTiposExamen();
}

// Solo el personal técnico (químico biólogo) registra y valida resultados.
export function registrarResultados({ usuario, repos }, ordenId, codigoExamen, datos) {
  exigirRol(usuario, 'medico');
  return repoLaboratorio(repos).registrarResultados(ordenId, codigoExamen, validarResultados(datos), autor(usuario));
}

export function validarExamen({ usuario, repos }, ordenId, codigoExamen) {
  exigirRol(usuario, 'medico');
  return repoLaboratorio(repos).validarExamen(ordenId, codigoExamen, autor(usuario));
}

export function cambiarEstadoOrden({ usuario, repos }, ordenId, datos) {
  exigirRol(usuario, 'medico', 'admin');
  return repoLaboratorio(repos).cambiarEstadoOrden(ordenId, validarCambioEstado(datos));
}

// Registrar un médico referente nuevo si no está en el catálogo. Lo hace quien
// recibe la orden: recepción, el químico biólogo o el admin.
export async function registrarMedicoReferente({ usuario, repos }, datos) {
  exigirRol(usuario, 'recepcion', 'medico', 'admin');
  const medico = validarMedicoReferente(datos);
  medico.especialidad = await especialidadParaGuardar(repos, medico.especialidad);
  return repoLaboratorio(repos).registrarMedicoReferente(medico);
}

// Agregar exámenes a una orden que todavía no se completa (químico biólogo).
export function agregarExamenes({ usuario, repos }, ordenId, datos) {
  exigirRol(usuario, 'medico');
  return repoLaboratorio(repos).agregarExamenes(ordenId, validarExamenesNuevos(datos));
}
