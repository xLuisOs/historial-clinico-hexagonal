import { DatosInvalidos } from './errores.js';
import { validarPassword } from './medico.js';
import { Validador } from './validacion.js';

// La cuenta de quien inició sesión: ver su perfil y cambiar su contraseña.
// El admin entrega una contraseña inicial en persona; cada quien la cambia
// después por una que solo conozca él.
//
// Perfil = { id, nombre, correo, rol, ultimoAcceso,
//            especialidad?, numeroColegiado?, telefono? }   (según el rol)

/** { actual, nueva }: la nueva sigue las mismas reglas que al crear la cuenta. */
export function validarCambioPassword(datos = {}) {
  const v = new Validador();
  const actual = typeof datos.actual === 'string' ? datos.actual : '';
  if (!actual) v.error('actual', 'Escribe tu contraseña actual');
  const nueva = validarPassword(v, datos.nueva);
  if (v.errores?.password) {
    v.error('nueva', v.errores.password);
    delete v.errores.password;
  }
  if (actual && nueva && actual === nueva) v.error('nueva', 'Debe ser distinta de la actual');
  v.lanzarSiHayErrores();
  return { actual, nueva };
}

export function exigirPasswordCorrecta(coincide) {
  if (!coincide) throw new DatosInvalidos('Datos inválidos', { actual: 'La contraseña actual no es correcta' });
}
