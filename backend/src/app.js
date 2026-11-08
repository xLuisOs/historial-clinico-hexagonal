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
  // Cuánto tarda cada petición, para saber si la lentitud viene de la base de
  // datos. Sin los parámetros de la URL: pueden llevar nombres de pacientes.
  app.use('/api', (req, res, next) => {
    const inicio = performance.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.baseUrl}${req.path} → ${res.statusCode} · ${Math.round(performance.now() - inicio)} ms`);
    });
    next();
  });
  app.use('/api', rutas);
  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  app.use(manejarErrores);
  return app;
}
