import cors from 'cors';
import express from 'express';
import { entorno } from './config/entorno.js';
import { manejarErrores } from './adaptadores/entrada/http/errores.js';
import { rutas } from './adaptadores/entrada/http/rutas.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: entorno.corsOrigen.split(',') }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', rutas);
  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use(manejarErrores);
  return app;
}
