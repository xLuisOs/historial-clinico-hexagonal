import {
  cuenta, diaSiguiente, tablaCitasPorProfesional, tablaIngresosPorMetodo, tasaInasistencia,
} from '../../../../dominio/reportes.js';

// Reportes del pediátrico (ver dominio/reportes.js): totales con GROUP BY de
// MySQL. Las fechas filtran con >= desde y < día siguiente a hasta.

const n = (valor) => Number(valor ?? 0);

export function crearRepositorioReportes(pool) {
  return {
    async generar({ desde, hasta }) {
      const rango = [desde, diaSiguiente(hasta)];
      const [citasPorEstado] = await pool.query(
        `SELECT estado_cita AS estado, COUNT(*) AS total FROM cita
         WHERE fecha_hora_programada >= ? AND fecha_hora_programada < ? GROUP BY estado_cita`,
        rango,
      );
      const [citasPorMedico] = await pool.query(
        `SELECT CONCAT(m.nombres, ' ', m.apellidos) AS profesional,
                COUNT(*) AS total,
                SUM(c.estado_cita = 'atendida')   AS atendidas,
                SUM(c.estado_cita = 'no_asistio') AS no_asistio,
                SUM(c.estado_cita = 'cancelada')  AS canceladas
         FROM cita c JOIN medico m ON m.id_medico = c.medico_fk
         WHERE c.fecha_hora_programada >= ? AND c.fecha_hora_programada < ?
         GROUP BY m.id_medico, m.nombres, m.apellidos ORDER BY total DESC, profesional`,
        rango,
      );
      const [[consultas]] = await pool.query(
        'SELECT COUNT(*) AS total FROM consulta WHERE fecha_hora_real >= ? AND fecha_hora_real < ?',
        rango,
      );
      const [ingresos] = await pool.query(
        `SELECT mp.nombre AS metodo, COUNT(*) AS pagos, SUM(p.monto) AS monto
         FROM pago p JOIN metodo_pago mp ON mp.id_metodo_pago = p.metodo_pago_fk
         WHERE p.fecha_pago >= ? AND p.fecha_pago < ?
         GROUP BY mp.nombre ORDER BY monto DESC`,
        rango,
      );
      // Saldo por cobrar hoy (no depende del periodo), con la vista de resumen de cobros.
      const [[saldo]] = await pool.query(
        `SELECT COUNT(*) AS cobros, COALESCE(SUM(monto_total - monto_pagado), 0) AS monto
         FROM v_cobro_resumen WHERE estado_cobro = 'pendiente'`,
      );
      const [vacunas] = await pool.query(
        `SELECT v.nombre AS vacuna, COUNT(*) AS dosis
         FROM vacuna_aplicada va JOIN vacuna v ON v.id_vacuna = va.vacuna_fk
         WHERE va.fecha_aplicacion >= ? AND va.fecha_aplicacion < ?
         GROUP BY v.id_vacuna, v.nombre ORDER BY dosis DESC, vacuna`,
        rango,
      );
      const [servicios] = await pool.query(
        `SELECT s.nombre AS servicio, SUM(d.cantidad) AS cantidad, SUM(d.subtotal) AS monto
         FROM detalle_cobro d
         JOIN cobro c    ON c.id_cobro = d.cobro_fk
         JOIN servicio s ON s.id_servicio = d.servicio_fk
         WHERE c.estado_cobro <> 'anulado' AND c.fecha_cobro >= ? AND c.fecha_cobro < ?
         GROUP BY s.id_servicio, s.nombre ORDER BY monto DESC, servicio`,
        rango,
      );

      const citas = Object.fromEntries(citasPorEstado.map((f) => [f.estado, n(f.total)]));
      const totalCitas = Object.values(citas).reduce((s, x) => s + x, 0);
      const dosis = vacunas.reduce((s, f) => s + n(f.dosis), 0);

      return {
        desde,
        hasta,
        indicadores: [
          { titulo: 'Consultas', valor: n(consultas.total), formato: 'numero' },
          { titulo: 'Citas', valor: totalCitas, formato: 'numero', nota: cuenta(citas.atendida ?? 0, 'atendida') },
          { titulo: 'Inasistencia', valor: tasaInasistencia(citas), formato: 'porcentaje', nota: cuenta(citas.no_asistio ?? 0, 'paciente no llegó', 'pacientes no llegaron') },
          { titulo: 'Ingresos', valor: ingresos.reduce((s, f) => s + n(f.monto), 0), formato: 'dinero', nota: cuenta(ingresos.reduce((s, f) => s + n(f.pagos), 0), 'pago') },
          { titulo: 'Saldo por cobrar (hoy)', valor: n(saldo.monto), formato: 'dinero', nota: cuenta(n(saldo.cobros), 'cobro pendiente', 'cobros pendientes') },
          { titulo: 'Vacunas aplicadas', valor: dosis, formato: 'numero', nota: cuenta(vacunas.length, 'vacuna distinta', 'vacunas distintas') },
        ],
        tablas: [
          tablaCitasPorProfesional('Citas por médico', citasPorMedico.map((f) => ({
            profesional: f.profesional, total: n(f.total), atendidas: n(f.atendidas), noAsistio: n(f.no_asistio), canceladas: n(f.canceladas),
          }))),
          {
            titulo: 'Servicios cobrados',
            columnas: [
              { clave: 'servicio', titulo: 'Servicio' },
              { clave: 'cantidad', titulo: 'Cantidad', formato: 'numero' },
              { clave: 'monto', titulo: 'Monto', formato: 'dinero' },
            ],
            filas: servicios.map((f) => ({ servicio: f.servicio, cantidad: n(f.cantidad), monto: n(f.monto) })),
          },
          tablaIngresosPorMetodo(ingresos.map((f) => ({ metodo: f.metodo, pagos: n(f.pagos), monto: n(f.monto) }))),
          {
            titulo: 'Vacunas aplicadas',
            columnas: [{ clave: 'vacuna', titulo: 'Vacuna' }, { clave: 'dosis', titulo: 'Dosis', formato: 'numero' }],
            filas: vacunas.map((f) => ({ vacuna: f.vacuna, dosis: n(f.dosis) })),
          },
        ],
      };
    },
  };
}
