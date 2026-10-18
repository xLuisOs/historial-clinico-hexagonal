import jwt from 'jsonwebtoken';
import { entorno } from '../../../config/entorno.js';
import { NoAutenticado } from '../../../dominio/errores.js';
import { repositoriosDe } from '../../../contenedor.js';

export function firmarToken(sesion) {
  return jwt.sign(sesion, entorno.jwtSecreto, { expiresIn: entorno.jwtExpira });
}

/**
 * Enrutamiento por usuario: valida el token y deja en `req.contexto` el usuario
 * y los repositorios del motor de SU institución. Desde aquí en adelante, los
 * casos de uso trabajan sin saber qué motor hay detrás.
 */
export function requiereSesion(req, _res, next) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) throw new NoAutenticado('Inicia sesión para continuar');

  let usuario;
  try {
    const { iat, exp, ...datos } = jwt.verify(token, entorno.jwtSecreto);
    usuario = datos;
  } catch {
    throw new NoAutenticado('La sesión expiró o no es válida');
  }

  req.contexto = { usuario, repos: repositoriosDe(usuario.institucion) };
  next();
}
