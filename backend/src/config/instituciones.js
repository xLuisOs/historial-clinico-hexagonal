// Catálogo de instituciones y el motor que usa cada una.
//
// El motor es configuración: se puede cambiar con la variable MOTOR_<CLAVE>
// (p. ej. MOTOR_PEDIATRICO=mysql) sin tocar la lógica de negocio.
// El dominio del correo del usuario decide a qué institución pertenece.

const CATALOGO = {
  hospital: {
    nombre: 'Hospital General',
    dominio: 'hospital.gt',
    motorPorDefecto: 'postgresql',
  },
  odontologica: {
    nombre: 'Clínica Odontológica',
    dominio: 'odonto.gt',
    motorPorDefecto: 'firebase',
  },
  laboratorio: {
    nombre: 'Laboratorio Clínico',
    dominio: 'lab.gt',
    motorPorDefecto: 'mongodb',
  },
  pediatrico: {
    nombre: 'Centro Médico Pediátrico',
    dominio: 'pediatrico.gt',
    motorPorDefecto: 'mysql',
  },
};

export const INSTITUCIONES = Object.fromEntries(
  Object.entries(CATALOGO).map(([clave, inst]) => [
    clave,
    {
      clave,
      nombre: inst.nombre,
      dominio: inst.dominio,
      motor: process.env[`MOTOR_${clave.toUpperCase()}`] ?? inst.motorPorDefecto,
    },
  ]),
);

export function institucionPorCorreo(correo) {
  const dominio = String(correo ?? '').split('@')[1]?.toLowerCase();
  return Object.values(INSTITUCIONES).find((i) => i.dominio === dominio) ?? null;
}
