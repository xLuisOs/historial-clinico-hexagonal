import { cuenta, diaSiguiente, porcentaje } from '../../../../dominio/reportes.js';

// Reportes del laboratorio (ver dominio/reportes.js) con un solo pipeline de
// agregación: $match del periodo y $facet para sacar varios resúmenes en una
// pasada sobre las órdenes (por estado, por examen, por médico referente,
// resultados fuera de rango y tiempo hasta validar). Las órdenes no guardan
// precio, así que aquí no hay reporte de ingresos.

const ETIQUETA_ESTADO = { pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada', anulada: 'Anulada' };

export function crearRepositorioReportes(db, zonaHoraria) {
  return {
    async generar({ desde, hasta }) {
      const inicio = new Date(`${desde}T00:00:00${zonaHoraria}`);
      const fin = new Date(`${diaSiguiente(hasta)}T00:00:00${zonaHoraria}`);

      const [r] = await db.collection('ordenes').aggregate([
        { $match: { fecha_orden: { $gte: inicio, $lt: fin } } },
        {
          $facet: {
            porEstado: [{ $group: { _id: '$estado', total: { $sum: 1 } } }],
            porExamen: [
              { $match: { estado: { $ne: 'anulada' } } },
              { $unwind: '$examenes' },
              {
                $group: {
                  _id: { codigo: '$examenes.codigo', nombre: '$examenes.nombre' },
                  cantidad: { $sum: 1 },
                  validados: { $sum: { $cond: [{ $eq: ['$examenes.estado', 'validado'] }, 1, 0] } },
                },
              },
              { $sort: { cantidad: -1, '_id.nombre': 1 } },
            ],
            porReferente: [
              { $match: { estado: { $ne: 'anulada' } } },
              { $group: { _id: '$medico_referente.nombre', ordenes: { $sum: 1 } } },
              { $sort: { ordenes: -1, _id: 1 } },
            ],
            resultados: [
              { $unwind: '$examenes' },
              { $unwind: '$examenes.parametros' },
              { $match: { 'examenes.parametros.valor': { $ne: null } } },
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  fueraDeRango: { $sum: { $cond: [{ $eq: ['$examenes.parametros.fuera_de_rango', true] }, 1, 0] } },
                },
              },
            ],
            validacion: [
              { $unwind: '$examenes' },
              { $match: { 'examenes.fecha_validacion': { $ne: null } } },
              { $group: { _id: null, examenes: { $sum: 1 }, promedioMs: { $avg: { $subtract: ['$examenes.fecha_validacion', '$fecha_orden'] } } } },
            ],
          },
        },
      ]).toArray();

      const estados = Object.fromEntries(r.porEstado.map((e) => [e._id, e.total]));
      const ordenes = Object.values(estados).reduce((s, x) => s + x, 0);
      const examenes = r.porExamen.reduce((s, e) => s + e.cantidad, 0);
      const validados = r.porExamen.reduce((s, e) => s + e.validados, 0);
      const resultados = r.resultados[0] ?? { total: 0, fueraDeRango: 0 };
      const validacion = r.validacion[0];

      return {
        desde,
        hasta,
        indicadores: [
          { titulo: 'Órdenes', valor: ordenes, formato: 'numero', nota: cuenta(estados.anulada ?? 0, 'anulada') },
          { titulo: 'Exámenes', valor: examenes, formato: 'numero', nota: cuenta(validados, 'validado') },
          { titulo: 'Exámenes validados', valor: porcentaje(validados, examenes), formato: 'porcentaje' },
          {
            titulo: 'Resultados fuera de rango',
            valor: porcentaje(resultados.fueraDeRango, resultados.total),
            formato: 'porcentaje',
            nota: `${resultados.fueraDeRango} de ${resultados.total} resultados`,
          },
          {
            titulo: 'Tiempo hasta validar',
            valor: validacion ? Math.round((validacion.promedioMs / 3_600_000) * 10) / 10 : null,
            formato: 'horas',
            nota: validacion ? `promedio de ${cuenta(validacion.examenes, 'examen', 'exámenes')}` : 'sin exámenes validados',
          },
        ],
        tablas: [
          {
            titulo: 'Órdenes por estado',
            columnas: [{ clave: 'estado', titulo: 'Estado' }, { clave: 'ordenes', titulo: 'Órdenes', formato: 'numero' }],
            filas: Object.keys(ETIQUETA_ESTADO).filter((e) => estados[e]).map((e) => ({ estado: ETIQUETA_ESTADO[e], ordenes: estados[e] })),
          },
          {
            titulo: 'Exámenes realizados',
            columnas: [
              { clave: 'examen', titulo: 'Examen' },
              { clave: 'cantidad', titulo: 'Cantidad', formato: 'numero' },
              { clave: 'validados', titulo: 'Validados', formato: 'numero' },
            ],
            filas: r.porExamen.map((e) => ({ examen: `${e._id.nombre} (${e._id.codigo})`, cantidad: e.cantidad, validados: e.validados })),
          },
          {
            titulo: 'Órdenes por médico referente',
            columnas: [{ clave: 'medico', titulo: 'Médico referente' }, { clave: 'ordenes', titulo: 'Órdenes', formato: 'numero' }],
            filas: r.porReferente.map((m) => ({ medico: m._id, ordenes: m.ordenes })),
          },
        ],
      };
    },
  };
}
