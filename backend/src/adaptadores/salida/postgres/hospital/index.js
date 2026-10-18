// Adaptador PostgreSQL (Supabase) del Hospital General.
// TODO (Fer): implementar los puertos de puertos/repositorios.js.
// Referencia: adaptadores/salida/mysql/pediatrico/ ya implementa el contrato completo.
// Driver sugerido: `pg` (npm install pg) con POSTGRES_URL del .env.

import { adaptadorPendiente } from '../../pendiente.js';

export function crearAdaptadorHospitalPostgres() {
  return adaptadorPendiente('Hospital General (PostgreSQL)');
}
