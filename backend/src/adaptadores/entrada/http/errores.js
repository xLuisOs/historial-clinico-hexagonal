import {
  Conflicto, DatosInvalidos, NoAutenticado, NoDisponible, NoEncontrado, SinPermiso,
} from '../../../dominio/errores.js';

const ESTADOS = new Map([
  [DatosInvalidos, 400],
  [NoAutenticado, 401],
  [SinPermiso, 403],
  [NoEncontrado, 404],
  [Conflicto, 409],
  [NoDisponible, 503],
]);

// Traduce errores del dominio a respuestas HTTP. Los errores inesperados se
// registran en consola pero al cliente solo le llega un mensaje genérico,
// para no filtrar detalles internos de la base de datos.
// Express reconoce un manejador de errores porque recibe 4 parámetros.
export function manejarErrores(error, req, res, _next) {
  for (const [Tipo, estado] of ESTADOS) {
    if (error instanceof Tipo) {
      return res.status(estado).json({ error: error.message, detalles: error.detalles });
    }
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }
  console.error(`[${req.method} ${req.originalUrl}]`, error);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
