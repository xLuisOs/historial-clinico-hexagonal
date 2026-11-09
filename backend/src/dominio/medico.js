import { DatosInvalidos } from './errores.js';
import { validarTelefono } from './telefono.js';
import { Validador } from './validacion.js';

// Personal médico, administrado por el admin de cada institución.
//
// Alta: el médico se registra en el catálogo y, en la MISMA operación, se le
// crea su usuario para iniciar sesión. El correo debe ser del dominio de la
// institución, porque ese dominio es el que enruta el inicio de sesión hacia
// la base de datos correcta. Por eso el correo no se edita después: cambiarlo
// sería cambiar de cuenta.
//
// Desactivar: un médico nunca se borra (sus consultas son parte de historiales
// clínicos). Se desactiva él y su usuario, y solo si no tiene nada pendiente:
// citas programadas o confirmadas a futuro, ni pacientes internados a su cargo.
// Primero se reprograman o reasignan; así ningún paciente queda esperando a un
// médico que ya no está.
//
// NuevoMedico = { nombres, apellidos, numeroColegiado, especialidad, telefono, correo, password }
// Medico (lista del admin) = { id, nombre, nombres, apellidos, numeroColegiado,
//                              especialidad, telefono, correo, activo }

const COLEGIADO = /^\d{3,10}$/;

/** Contraseña inicial o nueva: 8 a 72 caracteres, con letras y números. */
export function validarPassword(v, password) {
  const texto = typeof password === 'string' ? password : '';
  if (texto.length < 8 || texto.length > 72) v.error('password', 'De 8 a 72 caracteres');
  else if (!/[A-Za-z]/.test(texto) || !/\d/.test(texto)) v.error('password', 'Debe tener letras y números');
  return texto;
}

/**
 * Correo de una cuenta: del dominio de la institución, porque ese dominio es
 * el que enruta el inicio de sesión hacia su base de datos.
 */
export function validarCorreoInstitucional(v, valor, dominio) {
  const correo = typeof valor === 'string' ? valor.trim().toLowerCase() : valor;
  const limpio = v.patron('correo', correo, /^[a-z0-9._-]+@[a-z0-9.-]+$/, 'Correo inválido', { requerido: true, max: 120 });
  if (limpio && !limpio.endsWith(`@${dominio}`)) v.error('correo', `Debe ser un correo @${dominio}`);
  return limpio;
}

export function validarNuevoMedico(datos = {}, { dominio }) {
  const v = new Validador();
  const medico = {
    nombres: v.texto('nombres', datos.nombres, { requerido: true, max: 100 }),
    apellidos: v.texto('apellidos', datos.apellidos, { requerido: true, max: 100 }),
    numeroColegiado: v.patron('numeroColegiado', datos.numeroColegiado == null ? null : String(datos.numeroColegiado),
      COLEGIADO, 'Solo números (3 a 10 dígitos)', { requerido: true }),
    especialidad: v.texto('especialidad', datos.especialidad, { requerido: true, max: 80 }),
    telefono: validarTelefono(v, 'telefono', datos.telefono),
    correo: validarCorreoInstitucional(v, datos.correo, dominio),
  };
  // Contraseña inicial: el médico entra con ella. No se recorta ni se guarda tal cual.
  const password = validarPassword(v, datos.password);
  v.lanzarSiHayErrores();
  return { ...medico, password };
}

/** Edición: solo los campos que vienen; el correo no se edita. */
export function validarCambiosMedico(datos = {}) {
  const v = new Validador();
  const cambios = {};
  if ('nombres' in datos) cambios.nombres = v.texto('nombres', datos.nombres, { requerido: true, max: 100 });
  if ('apellidos' in datos) cambios.apellidos = v.texto('apellidos', datos.apellidos, { requerido: true, max: 100 });
  if ('numeroColegiado' in datos) {
    cambios.numeroColegiado = v.patron('numeroColegiado', datos.numeroColegiado == null ? null : String(datos.numeroColegiado),
      COLEGIADO, 'Solo números (3 a 10 dígitos)', { requerido: true });
  }
  if ('especialidad' in datos) cambios.especialidad = v.texto('especialidad', datos.especialidad, { requerido: true, max: 80 });
  if ('telefono' in datos) cambios.telefono = validarTelefono(v, 'telefono', datos.telefono);
  if ('correo' in datos) v.error('correo', 'El correo es la cuenta del médico: no se puede cambiar');
  v.lanzarSiHayErrores();
  if (Object.keys(cambios).length === 0) throw new DatosInvalidos('No hay cambios');
  return cambios;
}

/**
 * Cuenta para un médico que ya está en el catálogo pero nunca tuvo usuario
 * (p. ej. los que se cargaron directo en la base): { correo, password }.
 */
export function validarCuentaNueva(datos = {}, { dominio }) {
  const v = new Validador();
  const correo = validarCorreoInstitucional(v, datos.correo, dominio);
  const password = validarPassword(v, datos.password);
  v.lanzarSiHayErrores();
  return { correo, password };
}

/** Nueva contraseña que el admin le asigna a un médico que olvidó la suya. */
export function validarNuevaPassword(datos = {}) {
  const v = new Validador();
  const password = validarPassword(v, datos.password);
  v.lanzarSiHayErrores();
  return password;
}

/** { activo: true | false } */
export function validarEstadoMedico(datos = {}) {
  if (typeof datos.activo !== 'boolean') throw new DatosInvalidos('Datos inválidos', { activo: 'Indica true o false' });
  return datos.activo;
}
