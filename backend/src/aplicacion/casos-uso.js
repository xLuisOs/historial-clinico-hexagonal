// =====================================================================
// CASOS DE USO
//
// La lógica de negocio vive aquí y es la misma para las cuatro instituciones.
// Cada función recibe un contexto { usuario, repos } donde `repos` ya es el
// adaptador del motor de la institución del usuario (lo resuelve el
// contenedor a partir del token). Por eso aquí no aparece ningún motor.
// =====================================================================

import { DatosInvalidos, NoDisponible, SinPermiso } from '../dominio/errores.js';
import { Validador } from '../dominio/validacion.js';
import { validarNuevoPaciente, validarContacto, validarBaja } from '../dominio/paciente.js';
import { validarNuevaConsulta, validarDiagnostico, validarReceta } from '../dominio/atencion.js';
import { validarAntecedente } from '../dominio/antecedente.js';
import { historialParaRol, pacienteParaRol } from '../dominio/privacidad.js';
import { validarCambioEstado, validarNuevaCita, validarReprogramacion } from '../dominio/cita.js';

export function exigirRol(usuario, ...roles) {
  if (!roles.includes(usuario.rol)) {
    throw new SinPermiso(`Esta acción requiere rol: ${roles.join(' o ')}`);
  }
}

// ---------------------------------------------------------------- pacientes

// Lo que devuelven pasa por pacienteParaRol: la recepción no recibe datos
// clínicos más allá de las alergias (ver dominio/privacidad.js).

export async function registrarPaciente({ usuario, repos }, datos) {
  exigirRol(usuario, 'recepcion', 'medico', 'admin');
  return pacienteParaRol(await repos.pacientes.registrar(validarNuevoPaciente(datos, usuario.institucion)), usuario);
}

export async function buscarPacientes({ usuario, repos }, { texto = '', incluirArchivados = false } = {}) {
  const pacientes = await repos.pacientes.buscar({ texto: String(texto).trim(), incluirArchivados });
  return pacientes.map((p) => pacienteParaRol(p, usuario));
}

export async function obtenerPaciente({ usuario, repos }, pacienteId) {
  return pacienteParaRol(await repos.pacientes.obtenerPorId(pacienteId), usuario);
}

export async function actualizarContacto({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return pacienteParaRol(await repos.pacientes.actualizarContacto(pacienteId, validarContacto(datos)), usuario);
}

export function darDeBaja({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'admin');
  return repos.pacientes.darDeBaja(pacienteId, validarBaja(datos));
}

// ---------------------------------------------------------------- historial

// La recepción recibe la vista administrativa (sin datos clínicos): ver dominio/privacidad.js.
export async function obtenerHistorial({ usuario, repos }, pacienteId) {
  return historialParaRol(await repos.atenciones.obtenerHistorial(pacienteId), usuario);
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

// Antecedentes médicos del paciente (enfermedades de base, cirugías,
// familiares, hábitos, medicamentos). Los registra el médico que atiende.
export function agregarAntecedente({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'medico');
  if (!repos.antecedentes) throw new NoDisponible('Esta institución no registra antecedentes médicos');
  return repos.antecedentes.agregar(pacienteId, validarAntecedente(datos), usuario);
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

// ---------------------------------------------------------------- agenda
//
// Puerto opcional `agenda`: el laboratorio trabaja con órdenes, no con citas.
// Agenda la recepción (las secretarias, en la odontológica) o el admin; el
// médico ve sus citas del día y las atiende al registrar la consulta.

const hoyEnGuatemala = () => new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);

function agendaDe(repos) {
  if (!repos.agenda) throw new NoDisponible('Esta institución no maneja agenda de citas');
  return repos.agenda;
}

// Citas de un médico en un día (hoy si no se indica). El médico ve las suyas;
// la recepción y el admin, las del médico que elijan.
export function citasDelDia({ usuario, repos }, fecha, medicoId) {
  exigirRol(usuario, 'medico', 'recepcion', 'admin');
  const v = new Validador();
  const dia = v.fecha('fecha', fecha) ?? hoyEnGuatemala();
  v.lanzarSiHayErrores();
  const medico = usuario.rol === 'medico' ? usuario.medicoId : medicoId;
  if (!medico) throw new DatosInvalidos('Datos inválidos', { medicoId: 'Elige un médico' });
  return agendaDe(repos).citasDelMedico(String(medico), dia);
}

// Citas pendientes del paciente, de hoy en adelante.
export function citasDelPaciente({ repos }, pacienteId) {
  return agendaDe(repos).citasDelPaciente(pacienteId);
}

// Regla: no se agenda en el pasado, ni a un paciente archivado, ni a un médico
// que ya tiene otra cita a esa hora (lo verifica el adaptador en una transacción).
export function agendarCita({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return agendaDe(repos).agendar(pacienteId, validarNuevaCita(datos), usuario);
}

export function reprogramarCita({ usuario, repos }, citaId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return agendaDe(repos).reprogramar(citaId, validarReprogramacion(datos));
}

// Confirmar la cita o marcar que el paciente no asistió.
export function marcarEstadoCita({ usuario, repos }, citaId, datos) {
  exigirRol(usuario, 'recepcion', 'admin');
  return agendaDe(repos).marcarEstado(citaId, validarCambioEstado(datos));
}

export function cancelarCita({ usuario, repos }, citaId) {
  exigirRol(usuario, 'recepcion', 'admin');
  return agendaDe(repos).cancelar(citaId);
}
