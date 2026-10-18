import bcrypt from 'bcryptjs';
import { institucionPorCorreo } from '../config/instituciones.js';
import { NoAutenticado } from '../dominio/errores.js';

// Hash de relleno: si el correo no existe se compara igual contra algo, para que
// la respuesta tarde lo mismo y no se pueda adivinar qué correos existen.
const HASH_RELLENO = bcrypt.hashSync('relleno-no-es-una-clave', 10);

/**
 * Inicia sesión y decide a qué institución (y por tanto a qué motor)
 * pertenecen todas las operaciones siguientes del usuario.
 *
 * @param {{ correo: string, password: string }} credenciales
 * @param {(institucion: string) => object} repositoriosDe  resuelve el adaptador del motor
 * @param {(sesion: object) => string} firmar  genera el token de sesión
 */
export async function iniciarSesion({ correo, password } = {}, repositoriosDe, firmar) {
  const correoLimpio = String(correo ?? '').trim().toLowerCase();
  const institucion = institucionPorCorreo(correoLimpio);
  if (!institucion || !password) throw new NoAutenticado('Correo o contraseña incorrectos');

  const repos = repositoriosDe(institucion.clave);
  const usuario = await repos.usuarios.buscarPorCorreo(correoLimpio);
  const coincide = await bcrypt.compare(String(password), usuario?.passwordHash ?? HASH_RELLENO);
  if (!usuario || !usuario.activo || !coincide) {
    throw new NoAutenticado('Correo o contraseña incorrectos');
  }

  await repos.usuarios.registrarAcceso(usuario.id);

  const sesion = {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
    medicoId: usuario.medicoId ?? null,
    institucion: institucion.clave,
  };
  return {
    token: firmar(sesion),
    usuario: { ...sesion, institucionNombre: institucion.nombre, motor: institucion.motor },
  };
}
