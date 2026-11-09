import { DatosInvalidos } from './errores.js';
import { validarCorreoInstitucional, validarPassword } from './medico.js';
import { validarTelefono } from './telefono.js';
import { Validador } from './validacion.js';

// Recepcionistas, administradas por el admin de cada institución.
//
// Cada recepcionista tiene su propia cuenta: con una cuenta compartida no se
// sabe quién agendó, cobró o facturó. Igual que con los médicos, la persona y
// su usuario se crean en la misma operación, el correo (del dominio de la
// institución) no se edita y nunca se borran: se desactivan. Desactivar no
// tiene requisitos previos, porque las citas y los internamientos son del
// médico, no de quien los registró.
//
// NuevaRecepcionista = { nombres, apellidos, telefono, correo, password }
// Recepcionista = { id, nombre, nombres, apellidos, telefono, correo, activo }

export function validarNuevaRecepcionista(datos = {}, { dominio }) {
  const v = new Validador();
  const recepcionista = {
    nombres: v.texto('nombres', datos.nombres, { requerido: true, max: 100 }),
    apellidos: v.texto('apellidos', datos.apellidos, { requerido: true, max: 100 }),
    telefono: validarTelefono(v, 'telefono', datos.telefono),
    correo: validarCorreoInstitucional(v, datos.correo, dominio),
  };
  const password = validarPassword(v, datos.password);
  v.lanzarSiHayErrores();
  return { ...recepcionista, password };
}

/** Edición: solo los campos que vienen; el correo no se edita. */
export function validarCambiosRecepcionista(datos = {}) {
  const v = new Validador();
  const cambios = {};
  if ('nombres' in datos) cambios.nombres = v.texto('nombres', datos.nombres, { requerido: true, max: 100 });
  if ('apellidos' in datos) cambios.apellidos = v.texto('apellidos', datos.apellidos, { requerido: true, max: 100 });
  if ('telefono' in datos) cambios.telefono = validarTelefono(v, 'telefono', datos.telefono);
  if ('correo' in datos) v.error('correo', 'El correo es la cuenta de la recepcionista: no se puede cambiar');
  v.lanzarSiHayErrores();
  if (Object.keys(cambios).length === 0) throw new DatosInvalidos('No hay cambios');
  return cambios;
}
