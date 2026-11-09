import jwt from 'jsonwebtoken';
import { entorno } from '../../../config/entorno.js';
import { NoAutenticado } from '../../../dominio/errores.js';
import { repositoriosDe } from '../../../contenedor.js';

export function firmarToken(sesion) {
  return jwt.sign(sesion, entorno.jwtSecreto, { expiresIn: entorno.jwtExpira });
}

// Un token firmado sigue siendo válido hasta que vence, aunque al usuario lo
// desactiven después. Por eso, en cada petición se pregunta a la base si el
// usuario sigue activo. Para no hacer esa consulta en cada clic, la respuesta
// se recuerda unos segundos: una cuenta desactivada deja de servir, como mucho,
// ACTIVO_TTL_MS después.
const ACTIVO_TTL_MS = 30_000;
const activos = new Map(); // "institucion:usuarioId" → { activo, hasta }

async function sigueActivo(usuario, repos) {
  if (typeof repos.usuarios?.estaActivo !== 'function') return true;
  const clave = `${usuario.institucion}:${usuario.id}`;
  const guardado = activos.get(clave);
  if (guardado && guardado.hasta > Date.now()) return guardado.activo;
  const activo = await repos.usuarios.estaActivo(usuario.id);
  activos.set(clave, { activo, hasta: Date.now() + ACTIVO_TTL_MS });
  return activo;
}

/**
 * Enrutamiento por usuario: valida el token y deja en `req.contexto` el usuario
 * y los repositorios del motor de SU institución. Desde aquí en adelante, los
 * casos de uso trabajan sin saber qué motor hay detrás.
 */
export async function requiereSesion(req, _res, next) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) throw new NoAutenticado('Inicia sesión para continuar');

  let usuario;
  try {
    const { iat, exp, ...datos } = jwt.verify(token, entorno.jwtSecreto);
    usuario = datos;
  } catch {
    throw new NoAutenticado('La sesión expiró o no es válida');
  }

  const repos = repositoriosDe(usuario.institucion);
  if (!(await sigueActivo(usuario, repos))) throw new NoAutenticado('Tu usuario fue desactivado');
  req.contexto = { usuario, repos };
  next();
}
