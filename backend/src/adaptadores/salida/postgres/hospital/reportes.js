import {
  cuenta, diaSiguiente, porcentaje, tablaCitasPorProfesional, tablaIngresosPorMetodo, tasaInasistencia,
} from '../../../../dominio/reportes.js';

// Reportes del hospital (ver dominio/reportes.js): totales con GROUP BY y
// FILTER de PostgreSQL. Las fechas filtran con >= desde y < día siguiente a
// hasta, para incluir todo el último día.

const n = (valor) => Number(valor ?? 0);

export function crearRepositorioReportes(pool) {
  return {
    async generar({ desde, hasta }) {
      const rango = [desde, diaSiguiente(hasta)];
      // Consultas secuenciales: cada una es corta y así no se apartan varias conexiones a la vez.
      const { rows: citasPorEstado } = await pool.query(
        `SELECT estado, count(*) AS total FROM cita
         WHERE fecha_hora >= $1 AND fecha_hora < $2 GROUP BY estado`,
        rango,
      );
      const { rows: citasPorMedico } = await pool.query(
        `SELECT m.nombres || ' ' || m.apellidos AS profesional,
                count(*) AS total,
                count(*) FILTER (WHERE c.estado = 'atendida')   AS atendidas,
                count(*) FILTER (WHERE c.estado = 'no_asistio') AS no_asistio,
                count(*) FILTER (WHERE c.estado = 'cancelada')  AS canceladas
         FROM cita c JOIN medico m ON m.id_medico = c.medico_fk
         WHERE c.fecha_hora >= $1 AND c.fecha_hora < $2
         GROUP BY m.id_medico, m.nombres, m.apellidos ORDER BY total DESC, profesional`,
        rango,
      );
      const { rows: [consultas] } = await pool.query(
        `SELECT count(*) AS total, count(*) FILTER (WHERE es_emergencia) AS emergencias
         FROM consulta WHERE fecha_hora_atencion >= $1 AND fecha_hora_atencion < $2`,
        rango,
      );
      const { rows: ingresos } = await pool.query(
        `SELECT metodo_pago AS metodo, count(*) AS pagos, sum(monto) AS monto
         FROM pago WHERE fecha_pago >= $1 AND fecha_pago < $2
         GROUP BY metodo_pago ORDER BY monto DESC`,
        rango,
      );
      // Saldo por cobrar hoy (no depende del periodo): facturas pendientes menos lo abonado.
      const { rows: [saldo] } = await pool.query(
        `SELECT count(*) AS facturas,
                coalesce(sum(f.total - coalesce((SELECT sum(p.monto) FROM pago p WHERE p.factura_fk = f.id_factura), 0)), 0) AS monto
         FROM factura f WHERE f.estado = 'pendiente'`,
      );
      const { rows: habitaciones } = await pool.query('SELECT estado, count(*) AS total FROM habitacion GROUP BY estado');
      const { rows: [internamientos] } = await pool.query(
        `SELECT count(*) FILTER (WHERE fecha_ingreso >= $1 AND fecha_ingreso < $2) AS ingresos,
                count(*) FILTER (WHERE fecha_alta >= $1 AND fecha_alta < $2)       AS altas
         FROM internamiento`,
        rango,
      );

      const citas = Object.fromEntries(citasPorEstado.map((f) => [f.estado, n(f.total)]));
      const totalCitas = Object.values(citas).reduce((s, x) => s + x, 0);
      const cuarto = Object.fromEntries(habitaciones.map((h) => [h.estado, n(h.total)]));
      const habilitadas = (cuarto.disponible ?? 0) + (cuarto.ocupada ?? 0);
      const totalIngresos = ingresos.reduce((s, f) => s + n(f.monto), 0);

      return {
        desde,
        hasta,
        indicadores: [
          { titulo: 'Consultas', valor: n(consultas.total), formato: 'numero', nota: `${n(consultas.emergencias)} de emergencia` },
          { titulo: 'Citas', valor: totalCitas, formato: 'numero', nota: cuenta(citas.atendida ?? 0, 'atendida') },
          { titulo: 'Inasistencia', valor: tasaInasistencia(citas), formato: 'porcentaje', nota: cuenta(citas.no_asistio ?? 0, 'paciente no llegó', 'pacientes no llegaron') },
          { titulo: 'Ingresos', valor: totalIngresos, formato: 'dinero', nota: cuenta(ingresos.reduce((s, f) => s + n(f.pagos), 0), 'pago') },
          { titulo: 'Saldo por cobrar (hoy)', valor: n(saldo.monto), formato: 'dinero', nota: cuenta(n(saldo.facturas), 'factura pendiente', 'facturas pendientes') },
          {
            titulo: 'Ocupación (hoy)',
            valor: porcentaje(cuarto.ocupada ?? 0, habilitadas),
            formato: 'porcentaje',
            nota: `${cuarto.ocupada ?? 0} de ${habilitadas} habitaciones${cuarto.mantenimiento ? ` · ${cuarto.mantenimiento} en mantenimiento` : ''}`,
          },
          { titulo: 'Internamientos', valor: n(internamientos.ingresos), formato: 'numero', nota: cuenta(n(internamientos.altas), 'alta') },
        ],
        tablas: [
          tablaCitasPorProfesional('Citas por médico', citasPorMedico.map((f) => ({
            profesional: f.profesional, total: n(f.total), atendidas: n(f.atendidas), noAsistio: n(f.no_asistio), canceladas: n(f.canceladas),
          }))),
          tablaIngresosPorMetodo(ingresos.map((f) => ({ metodo: f.metodo, pagos: n(f.pagos), monto: n(f.monto) }))),
        ],
      };
    },
  };
}
