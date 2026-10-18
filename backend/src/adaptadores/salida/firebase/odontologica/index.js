// Adaptador Firebase (Firestore) de la Clínica Odontológica.
// TODO (Fer): implementar los puertos de puertos/repositorios.js.
// Referencia: adaptadores/salida/mysql/pediatrico/ ya implementa el contrato completo.
// Driver sugerido: `firebase-admin` (npm install firebase-admin) con las
// credenciales de cuenta de servicio indicadas en FIREBASE_CREDENTIALS.

import { adaptadorPendiente } from '../../pendiente.js';

export function crearAdaptadorOdontologicaFirebase() {
  return adaptadorPendiente('Clínica Odontológica (Firebase)');
}
