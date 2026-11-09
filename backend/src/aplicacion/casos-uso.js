// =====================================================================
// CASOS DE USO
//
// La lógica de negocio vive aquí y es la misma para las cuatro instituciones.
// Cada función recibe un contexto { usuario, repos } donde `repos` ya es el
// adaptador del motor de la institución del usuario (lo resuelve el
// contenedor a partir del token). Por eso aquí no aparece ningún motor.
// =====================================================================

import bcrypt from 'bcryptjs';
import { INSTITUCIONES } from '../config/instituciones.js';
import { DatosInvalidos, NoDisponible, SinPermiso } from '../dominio/errores.js';
import { Validador } from '../dominio/validacion.js';
import {
  validarBaja, validarContacto, validarDatosClinicos, validarDatosPersonales, validarNuevoPaciente,
} from '../dominio/paciente.js';
import { exigirPasswordCorrecta, validarCambioPassword } from '../dominio/cuenta.js';
import { validarNuevaConsulta, validarDiagnostico, validarReceta } from '../dominio/atencion.js';
import { validarAntecedente } from '../dominio/antecedente.js';
import { normalizarEspecialidad } from '../dominio/especialidades.js';
import {
  catalogosDe, definicionCatalogo, validarCambiosRegistro, validarEstadoRegistro, validarNuevoRegistro,
} from '../dominio/catalogos.js';
import {
  validarCambiosMedico, validarCuentaNueva, validarEstadoMedico, validarNuevaPassword, validarNuevoMedico,
} from '../dominio/medico.js';
import { validarCambiosRecepcionista, validarNuevaRecepcionista } from '../dominio/recepcionista.js';
import { historialParaRol, pacienteParaRol } from '../dominio/privacidad.js';
import { validarPeriodo } from '../dominio/reportes.js';
import { validarCambioEstado, validarNuevaCita, validarReprogramacion } from '../dominio/cita.js';

export function exigirRol(usuario, ...roles) {
  if (!roles.includes(usuario.rol)) {
    throw new SinPermiso(`Esta acción requiere rol: ${roles.join(' o ')}`);
  }
}

// ---------------------------------------------------------------- mi cuenta

/** Perfil de quien inició sesión (cualquier rol). */
export async function obtenerPerfil({ usuario, repos }) {
  const perfil = await repos.usuarios.obtenerPerfil?.(usuario.id);
  if (!perfil) throw new NoDisponible('No se pudo cargar tu perfil');
  return { ...perfil, institucion: usuario.institucion };
}

/** Cambiar mi contraseña: pide la actual para confirmar que soy yo. */
export async function cambiarMiPassword({ usuario, repos }, datos) {
  const { actual, nueva } = validarCambioPassword(datos);
  const perfil = await repos.usuarios.obtenerPerfil?.(usuario.id);
  const cuenta = perfil && await repos.usuarios.buscarPorCorreo(perfil.correo);
  if (!cuenta || typeof repos.usuarios.cambiarPassword !== 'function') throw new NoDisponible('No se pudo cambiar la contraseña');
  exigirPasswordCorrecta(await bcrypt.compare(actual, cuenta.passwordHash));
  await repos.usuarios.cambiarPassword(usuario.id, await bcrypt.hash(nueva, 10));
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

// Corregir datos personales mal capturados (nombre, fecha de nacimiento, sexo,
// documento): lo hace la administración. El contacto lo actualiza recepción y
// los datos clínicos el médico.
export async function actualizarDatosPersonales({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'admin');
  return repos.pacientes.actualizarDatosPersonales(pacienteId, validarDatosPersonales(datos));
}

// Tipo de sangre y alergias después del registro: los actualiza el médico.
export async function actualizarDatosClinicos({ usuario, repos }, pacienteId, datos) {
  exigirRol(usuario, 'medico');
  if (typeof repos.pacientes.actualizarDatosClinicos !== 'function') {
    throw new NoDisponible('Esta institución no permite actualizar datos clínicos');
  }
  const cambios = validarDatosClinicos(datos, usuario.institucion);
  return pacienteParaRol(await repos.pacientes.actualizarDatosClinicos(pacienteId, cambios), usuario);
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
  return repos.antecedentes.agregar(pacienteId, validarAntecedente(datos, usuario.institucion), usuario);
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

// ---------------------------------------------------------------- personal
//
// El admin de cada institución administra a sus médicos (ver dominio/medico.js).
// Las contraseñas llegan en claro solo hasta aquí: el adaptador recibe el hash.

function repoPersonal(repos, metodo) {
  if (typeof repos.personal?.[metodo] !== 'function') {
    throw new NoDisponible('Esta institución no permite esta operación sobre su personal');
  }
  return repos.personal;
}

export function listarPersonal({ usuario, repos }) {
  exigirRol(usuario, 'admin');
  return repoPersonal(repos, 'listarPersonal').listarPersonal();
}

// Alta: queda en el catálogo y con su usuario, en una sola operación atómica.
/**
 * Especialidad a guardar: si ya existe escrita de otra forma ("Cardiologia" vs
 * "Cardiología"), se usa la que ya existe (ver dominio/especialidades.js).
 */
export async function especialidadParaGuardar(repos, especialidad) {
  if (!especialidad || typeof repos.catalogos.listarEspecialidades !== 'function') return especialidad;
  return normalizarEspecialidad(especialidad, await repos.catalogos.listarEspecialidades());
}

/** Especialidades que se ofrecen al registrar o editar un médico. */
export function listarEspecialidades({ repos }) {
  return repos.catalogos.listarEspecialidades?.() ?? [];
}

export async function registrarMedico({ usuario, repos }, datos) {
  exigirRol(usuario, 'admin');
  const personal = repoPersonal(repos, 'registrarMedico');
  const { password, ...medico } = validarNuevoMedico(datos, INSTITUCIONES[usuario.institucion]);
  medico.especialidad = await especialidadParaGuardar(repos, medico.especialidad);
  return personal.registrarMedico({ ...medico, passwordHash: await bcrypt.hash(password, 10) });
}

export async function actualizarMedico({ usuario, repos }, medicoId, datos) {
  exigirRol(usuario, 'admin');
  const personal = repoPersonal(repos, 'actualizarMedico');
  const cambios = validarCambiosMedico(datos);
  if (cambios.especialidad) cambios.especialidad = await especialidadParaGuardar(repos, cambios.especialidad);
  return personal.actualizarMedico(medicoId, cambios);
}

// Cuenta para un médico que ya estaba en el catálogo sin usuario.
export async function crearCuentaMedico({ usuario, repos }, medicoId, datos) {
  exigirRol(usuario, 'admin');
  const personal = repoPersonal(repos, 'crearCuentaMedico');
  const { correo, password } = validarCuentaNueva(datos, INSTITUCIONES[usuario.institucion]);
  return personal.crearCuentaMedico(medicoId, { correo, passwordHash: await bcrypt.hash(password, 10) });
}

export async function restablecerPasswordMedico({ usuario, repos }, medicoId, datos) {
  exigirRol(usuario, 'admin');
  const personal = repoPersonal(repos, 'restablecerPassword');
  await personal.restablecerPassword(medicoId, await bcrypt.hash(validarNuevaPassword(datos), 10));
}

// Desactivar exige que no tenga citas pendientes a futuro ni pacientes
// internados a su cargo: el adaptador lo revisa en la misma transacción en la
// que cambia el estado, con el médico bloqueado para que nadie le agende a la vez.
export function cambiarEstadoMedico({ usuario, repos }, medicoId, datos) {
  exigirRol(usuario, 'admin');
  return repoPersonal(repos, 'cambiarEstadoMedico').cambiarEstadoMedico(medicoId, validarEstadoMedico(datos));
}

// Recepcionistas: cada una con su cuenta (ver dominio/recepcionista.js).
export function listarRecepcionistas({ usuario, repos }) {
  exigirRol(usuario, 'admin');
  return repoPersonal(repos, 'listarRecepcionistas').listarRecepcionistas();
}

export async function registrarRecepcionista({ usuario, repos }, datos) {
  exigirRol(usuario, 'admin');
  const personal = repoPersonal(repos, 'registrarRecepcionista');
  const { password, ...recepcionista } = validarNuevaRecepcionista(datos, INSTITUCIONES[usuario.institucion]);
  return personal.registrarRecepcionista({ ...recepcionista, passwordHash: await bcrypt.hash(password, 10) });
}

export function actualizarRecepcionista({ usuario, repos }, recepcionistaId, datos) {
  exigirRol(usuario, 'admin');
  return repoPersonal(repos, 'actualizarRecepcionista').actualizarRecepcionista(recepcionistaId, validarCambiosRecepcionista(datos));
}

export async function restablecerPasswordRecepcionista({ usuario, repos }, recepcionistaId, datos) {
  exigirRol(usuario, 'admin');
  const personal = repoPersonal(repos, 'restablecerPasswordRecepcionista');
  await personal.restablecerPasswordRecepcionista(recepcionistaId, await bcrypt.hash(validarNuevaPassword(datos), 10));
}

export function cambiarEstadoRecepcionista({ usuario, repos }, recepcionistaId, datos) {
  exigirRol(usuario, 'admin');
  return repoPersonal(repos, 'cambiarEstadoRecepcionista').cambiarEstadoRecepcionista(recepcionistaId, validarEstadoMedico(datos));
}

// ---------------------------------------------------------------- catálogos
//
// El admin mantiene los catálogos de su institución (ver dominio/catalogos.js).
// Cada adaptador implementa los que tiene en su base, en `catalogosAdmin`.

function repoCatalogo({ usuario, repos }, clave, metodo) {
  exigirRol(usuario, 'admin');
  definicionCatalogo(usuario.institucion, clave);
  const repo = repos.catalogosAdmin?.[clave];
  if (typeof repo?.[metodo] !== 'function') throw new NoDisponible('Esta institución no administra ese catálogo');
  return repo;
}

/** Catálogos que el admin puede mantener, con sus campos (la pantalla se arma con esto). */
export function listarCatalogosAdmin({ usuario, repos }) {
  exigirRol(usuario, 'admin');
  return catalogosDe(usuario.institucion).filter((c) => repos.catalogosAdmin?.[c.clave]);
}

export function listarRegistrosCatalogo(contexto, clave) {
  return repoCatalogo(contexto, clave, 'listar').listar();
}

export function crearRegistroCatalogo(contexto, clave, datos) {
  const repo = repoCatalogo(contexto, clave, 'crear');
  return repo.crear(validarNuevoRegistro(contexto.usuario.institucion, clave, datos));
}

export function actualizarRegistroCatalogo(contexto, clave, id, datos) {
  const repo = repoCatalogo(contexto, clave, 'actualizar');
  return repo.actualizar(id, validarCambiosRegistro(contexto.usuario.institucion, clave, datos));
}

export function cambiarEstadoRegistroCatalogo(contexto, clave, id, datos) {
  exigirRol(contexto.usuario, 'admin');
  // Primero la regla del catálogo: si no tiene estado, el mensaje lo dice.
  const activo = validarEstadoRegistro(contexto.usuario.institucion, clave, datos);
  return repoCatalogo(contexto, clave, 'cambiarEstado').cambiarEstado(id, activo);
}

// ---------------------------------------------------------------- reportes

/** Totales del periodo para el admin (ver dominio/reportes.js). Sin datos clínicos de pacientes. */
export function generarReporte({ usuario, repos }, datos) {
  exigirRol(usuario, 'admin');
  if (typeof repos.reportes?.generar !== 'function') throw new NoDisponible('Esta institución todavía no tiene reportes');
  return repos.reportes.generar(validarPeriodo(datos));
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
