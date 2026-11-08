import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, traducirError } from '../conexion.js';

// Cobros del pediátrico. El total no se guarda en `cobro`: sale de la vista
// v_cobro_resumen (suma de detalle_cobro.subtotal, que es columna generada).
// El precio de cada línea se copia del catálogo al cobrar.

/** Cobros del paciente (o uno solo) con su detalle y pagos, en 3 consultas. */
export async function cargarCobros(cx, pacienteId, cobroId = null) {
  const [cobros] = await cx.query(
    `SELECT r.id_cobro, r.consulta_fk, r.fecha_cobro, r.estado_cobro, r.monto_total, r.monto_pagado,
            CONCAT(e.nombres, ' ', e.apellidos) AS encargado
     FROM v_cobro_resumen r
     JOIN consulta co ON co.id_consulta = r.consulta_fk
     JOIN cita ci     ON ci.id_cita = co.cita_fk
     JOIN encargado e ON e.id_encargado = r.encargado_fk
     WHERE ci.paciente_fk = ? ${cobroId ? 'AND r.id_cobro = ?' : ''}
     ORDER BY r.fecha_cobro DESC`,
    cobroId ? [pacienteId, cobroId] : [pacienteId],
  );
  if (cobros.length === 0) return [];
  const ids = cobros.map((c) => c.id_cobro);

  const [detalle] = await cx.query(
    `SELECT d.cobro_fk, s.nombre, d.cantidad, d.precio_unitario, d.subtotal
     FROM detalle_cobro d JOIN servicio s ON s.id_servicio = d.servicio_fk
     WHERE d.cobro_fk IN (?) ORDER BY d.id_detalle_cobro`,
    [ids],
  );
  const [pagos] = await cx.query(
    `SELECT p.id_pago, p.cobro_fk, p.fecha_pago, p.monto, p.referencia, mp.nombre AS metodo
     FROM pago p JOIN metodo_pago mp ON mp.id_metodo_pago = p.metodo_pago_fk
     WHERE p.cobro_fk IN (?) ORDER BY p.fecha_pago`,
    [ids],
  );

  return cobros.map((c) => ({
    id: String(c.id_cobro),
    consultaId: String(c.consulta_fk),
    fecha: c.fecha_cobro,
    estado: c.estado_cobro,
    encargado: c.encargado,
    total: Number(c.monto_total),
    pagado: Number(c.monto_pagado),
    saldo: Math.round((c.monto_total - c.monto_pagado) * 100) / 100,
    detalle: detalle.filter((d) => d.cobro_fk === c.id_cobro).map((d) => ({
      servicio: d.nombre, cantidad: d.cantidad, precioUnitario: d.precio_unitario, subtotal: d.subtotal,
    })),
    pagos: pagos.filter((p) => p.cobro_fk === c.id_cobro).map((p) => ({
      id: String(p.id_pago), fecha: p.fecha_pago, metodo: p.metodo, monto: p.monto, referencia: p.referencia,
    })),
  }));
}

export function crearRepositorioCobros(pool) {
  return {
    async listarServicios() {
      const [filas] = await pool.query(
        'SELECT id_servicio, nombre, descripcion, precio FROM servicio WHERE activo = TRUE ORDER BY nombre',
      );
      return filas.map((f) => ({ id: String(f.id_servicio), nombre: f.nombre, descripcion: f.descripcion, precio: f.precio }));
    },

    /**
     * Genera el cobro de una consulta a nombre del encargado del paciente.
     * Bloquea la consulta (dos recepcionistas no la cobran a la vez); además
     * UNIQUE(consulta_fk) impide un segundo cobro aunque algo se escape.
     */
    generarCobro(consultaId, { items }) {
      return enTransaccion(pool, async (cx) => {
        const [consultas] = await cx.query(
          `SELECT ci.paciente_fk, p.encargado_fk FROM consulta co
           JOIN cita ci     ON ci.id_cita = co.cita_fk
           JOIN paciente p  ON p.id_paciente = ci.paciente_fk
           WHERE co.id_consulta = ? FOR UPDATE`,
          [consultaId],
        );
        if (consultas.length === 0) throw new NoEncontrado('Consulta no encontrada');
        const { paciente_fk: pacienteId, encargado_fk: encargadoId } = consultas[0];

        const [servicios] = await cx.query(
          'SELECT id_servicio, nombre, precio, activo FROM servicio WHERE id_servicio IN (?)',
          [items.map((i) => i.servicioId)],
        );
        const porId = new Map(servicios.map((s) => [String(s.id_servicio), s]));
        for (const item of items) {
          const s = porId.get(item.servicioId);
          if (!s) throw new NoEncontrado(`El servicio ${item.servicioId} no existe`);
          if (!s.activo) throw new Conflicto(`El servicio "${s.nombre}" ya no se ofrece`);
        }

        const [res] = await cx.query(
          'INSERT INTO cobro (consulta_fk, encargado_fk) VALUES (?, ?)',
          [consultaId, encargadoId],
        ).catch((e) => { throw traducirError(e, { duplicado: 'Esta consulta ya tiene un cobro' }); });

        await cx.query(
          'INSERT INTO detalle_cobro (cobro_fk, servicio_fk, cantidad, precio_unitario) VALUES ?',
          [items.map((i) => [res.insertId, i.servicioId, i.cantidad, porId.get(i.servicioId).precio])],
        );
        const [cobro] = await cargarCobros(cx, pacienteId, res.insertId);
        return cobro;
      });
    },
  };
}
