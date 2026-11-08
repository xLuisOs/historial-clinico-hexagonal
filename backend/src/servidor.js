import { crearApp } from './app.js';
import { entorno } from './config/entorno.js';
import { INSTITUCIONES } from './config/instituciones.js';
import { cerrarConexiones } from './contenedor.js';

const servidor = crearApp().listen(entorno.puerto, () => {
  console.log(`API escuchando en http://localhost:${entorno.puerto}/api`);
  for (const i of Object.values(INSTITUCIONES)) {
    console.log(`  ${i.nombre.padEnd(26)} → ${i.motor.padEnd(10)} (@${i.dominio})`);
  }
});

async function apagar() {
  servidor.close();
  await cerrarConexiones();
  process.exit(0);
}
// Un error que se escape de una petición se registra en lugar de apagar el
// servidor completo (y con él, las cuatro instituciones).
process.on('unhandledRejection', (error) => console.error('[sin manejar]', error));
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
