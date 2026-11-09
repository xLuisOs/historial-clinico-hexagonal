import { Validador } from './validacion.js';

// Reportes para el admin: totales de un periodo, nunca datos clínicos de un
// paciente. Cada institución mide lo suyo (citas, ingresos, ocupación,
// vacunas, órdenes...) y cada adaptador lo calcula con su motor: GROUP BY en
// PostgreSQL y MySQL, pipelines de agregación en MongoDB y consultas + sumas
// en Firestore (que no agrupa).
//
// Reporte = {
//   desde, hasta,                       // 'AAAA-MM-DD', ambos incluidos
//   indicadores: [{ titulo, valor, formato, nota? }],
//   tablas: [{ titulo, columnas: [{ clave, titulo, formato? }], filas: [...] }],
// }
// formato: 'numero' | 'dinero' | 'porcentaje' | 'horas' | undefined (texto)

const MAX_DIAS = 366;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const hoyEnGuatemala = () => new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);

/** { desde?, hasta? } → periodo válido. Por defecto, del 1 del mes a hoy. */
export function validarPeriodo(datos = {}) {
  const v = new Validador();
  const hoy = hoyEnGuatemala();
  const desde = datos.desde || `${hoy.slice(0, 8)}01`;
  const hasta = datos.hasta || hoy;
  if (!FECHA.test(desde) || Number.isNaN(Date.parse(desde))) v.error('desde', 'Fecha inválida');
  if (!FECHA.test(hasta) || Number.isNaN(Date.parse(hasta))) v.error('hasta', 'Fecha inválida');
  if (FECHA.test(desde) && FECHA.test(hasta)) {
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000;
    if (dias < 0) v.error('hasta', 'Debe ser igual o posterior a la fecha inicial');
    else if (dias > MAX_DIAS) v.error('hasta', 'El periodo puede ser de hasta un año');
  }
  v.lanzarSiHayErrores();
  return { desde, hasta };
}

/** Día siguiente a `hasta`: los adaptadores filtran con fecha >= desde y < este día. */
export function diaSiguiente(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "1 pago", "3 pagos": cantidad con la palabra en singular o plural. */
export const cuenta = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

/** Proporción en porcentaje con un decimal; null si no hay base. */
export const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

/**
 * Inasistencia: de las citas que ya debían ocurrir (atendidas o "no asistió"),
 * cuántas fueron "no asistió". Las canceladas y las pendientes no cuentan.
 */
export const tasaInasistencia = ({ atendida = 0, no_asistio: noAsistio = 0 }) => porcentaje(noAsistio, atendida + noAsistio);

const ETIQUETA_METODO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', seguro: 'Seguro' };
export const etiquetaMetodo = (m) => ETIQUETA_METODO[m] ?? m;

/** Tabla de citas por profesional, igual en todas las instituciones con agenda. */
export const tablaCitasPorProfesional = (titulo, filas) => ({
  titulo,
  columnas: [
    { clave: 'profesional', titulo: 'Profesional' },
    { clave: 'total', titulo: 'Citas', formato: 'numero' },
    { clave: 'atendidas', titulo: 'Atendidas', formato: 'numero' },
    { clave: 'noAsistio', titulo: 'No asistió', formato: 'numero' },
    { clave: 'canceladas', titulo: 'Canceladas', formato: 'numero' },
  ],
  filas,
});

export const tablaIngresosPorMetodo = (filas) => ({
  titulo: 'Ingresos por método de pago',
  columnas: [
    { clave: 'metodo', titulo: 'Método' },
    { clave: 'pagos', titulo: 'Pagos', formato: 'numero' },
    { clave: 'monto', titulo: 'Monto', formato: 'dinero' },
  ],
  filas: filas.map((f) => ({ ...f, metodo: etiquetaMetodo(f.metodo) })),
});
