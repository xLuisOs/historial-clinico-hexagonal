// =====================================================================
// CASOS DE USO
//
// La lógica de negocio vive aquí y es la misma para las cuatro instituciones.
// Cada función recibe un contexto { usuario, repos } donde `repos` ya es el
// adaptador del motor de la institución del usuario (lo resuelve el
// contenedor a partir del token). Por eso aquí no aparece ningún motor.
// =====================================================================

import { SinPermiso } from '../dominio/errores.js';
import { validarNuevoPaciente, validarContacto, validarBaja } from '../dominio/paciente.js';
import { validarNuevaConsulta, validarDiagnostico, validarReceta } from '../dominio/atencion.js';

function exigirRol(usuario, ...roles) {
  if (!roles.includes(usuario.rol)) {
    throw new SinPermiso(`Esta acción requiere rol: ${roles.join(' o ')}`);
  }
}

// ---------------------------------------------------------------- pacientes

export function registrarPaciente({ usuario, repos }, datos) {
  exigirRol(usuario, 'recepcion', 'medico', 'admin');
  return repos.pacientes.registrar(validarNuevoPaciente(datos));
}

export function buscarPacientes({ repos }, { texto = '', incluirArchivados = false } = {}) {
  return repos.pacientes.buscar({ texto: String(texto).trim(), incluirArchivados });
}

export function obtenerPaciente({ repos }, pacienteId) {
  return repos.pacientes.obtenerPorId(pacienteId);
}

export function actualizarContacto({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return repos.pacientes.actualizarContacto(pacienteId, validarContacto(datos));
}

export function darDeBaja({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'admin');
  return repos.pacientes.darDeBaja(pacienteId, validarBaja(datos));
}

// ---------------------------------------------------------------- historial

export function obtenerHistorial({ repos }, pacienteId) {
  return repos.atenciones.obtenerHistorial(pacienteId);
}

// Regla de negocio: registrar consulta (con diagnóstico y, opcionalmente, receta).
// El médico que atiende es siempre el usuario que inició sesión.
export function registrarConsulta({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'medico');
  const consulta = validarNuevaConsulta(datos, usuario.institucion);
  consulta.medicoId = usuario.medicoId;
  return repos.atenciones.registrarConsulta(pacienteId, consulta);
}

// Regla de negocio: agregar diagnóstico a una consulta existente.
export function agregarDiagnostico({ usuario, repos }, consultaId, datos) {
  exigirRol(usuario, 'medico');
  return repos.atenciones.agregarDiagnostico(consultaId, validarDiagnostico(datos));
}

// Regla de negocio: recetar medicamento(s) en una consulta existente.
export function recetar({ usuario, repos }, consultaId, datos) {
  exigirRol(usuario, 'medico');
  return repos.atenciones.recetar(consultaId, validarReceta(datos));
}

// ---------------------------------------------------------------- catálogos

export function listarMedicos({ repos }) {
  return repos.catalogos.listarMedicos();
}

export function listarMedicamentos({ repos }) {
  return repos.catalogos.listarMedicamentos();
}
