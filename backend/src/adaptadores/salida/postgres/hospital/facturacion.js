import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, traducirError } from '../conexion.js';
import { cargarFacturas } from './atenciones.js';
import { idNumerico } from './pacientes.js';

// Facturación del hospital. El total de la factura y el cierre al pagarla los
// mantienen los triggers de db/postgres/01_esquema.sql; aquí se valida el
// origen y se evita facturar dos veces lo mismo.

async function obtenerFactura(cx, facturaId) {
  const { rows } = await cx.query('SELECT paciente_fk FROM factura WHERE id_factura = $1', [facturaId]);
  if (rows.length === 0) throw new NoEncontrado('Factura no encontrada');
  const [factura] = await cargarFacturas(cx, rows[0].paciente_fk, facturaId);
  return factura;
}

/**
 * Bloquea la consulta o el internamiento (dos cajeros no pueden facturarlo a la
 * vez) y verifica que sea del paciente y que no tenga otra factura vigente.
 */
async function exigirOrigenFacturable(cx, pacienteId, { consultaId, internamientoId }) {
  const [tabla, columna, id, el, este] = consultaId
    ? ['consulta', 'id_consulta', idNumerico(consultaId, 'Consulta'), 'La consulta', 'Esta consulta']
    : ['internamiento', 'id_internamiento', idNumerico(internamientoId, 'Internamiento'), 'El internamiento', 'Este internamiento'];

  const { rows } = await cx.query(`SELECT paciente_fk FROM ${tabla} WHERE ${columna} = $1 FOR UPDATE`, [id]);
  if (rows.length === 0 || rows[0].paciente_fk !== pacienteId) {
    throw new NoEncontrado(`${el} no existe o no es de este paciente`);
  }
  const { rows: vigentes } = await cx.query(
    `SELECT id_factura FROM factura WHERE ${tabla}_fk = $1 AND estado <> 'anulada'`,
    [id],
  );
  if (vigentes.length > 0) throw new Conflicto(`${este} ya tiene la factura #${vigentes[0].id_factura}`);
  return { consulta: tabla === 'consulta' ? id : null, internamiento: tabla === 'internamiento' ? id : null };
}

export function crearRepositorioFacturacion(pool) {
  return {
    crear(pacienteId, factura) {
      return enTransaccion(pool, async (cx) => {
        const idPaciente = idNumerico(pacienteId, 'Paciente');
        const { rows: pacientes } = await cx.query('SELECT 1 FROM paciente WHERE id_paciente = $1', [idPaciente]);
        if (pacientes.length === 0) throw new NoEncontrado('Paciente no encontrado');
        const origen = await exigirOrigenFacturable(cx, idPaciente, factura);

        const { rows: [nueva] } = await cx.query(
          `INSERT INTO factura (paciente_fk, consulta_fk, internamiento_fk) VALUES ($1, $2, $3) RETURNING id_factura`,
          [idPaciente, origen.consulta, origen.internamiento],
        );
        for (const item of factura.items) {
          await cx.query(
            'INSERT INTO detalle_factura (factura_fk, descripcion, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)',
            [nueva.id_factura, item.descripcion, item.cantidad, item.precioUnitario],
          );
        }
        return obtenerFactura(cx, nueva.id_factura);
      });
    },

    registrarPago(facturaId, pago) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(facturaId, 'Factura');
        await cx.query(
          'INSERT INTO pago (factura_fk, monto, metodo_pago, referencia) VALUES ($1, $2, $3, $4)',
          [id, pago.monto, pago.metodoPago, pago.referencia],
        ).catch((e) => {
          if (e.code === '23503') throw new NoEncontrado('Factura no encontrada');
          throw traducirError(e); // el trigger: saldo excedido o factura no pendiente
        });
        return obtenerFactura(cx, id);
      });
    },

    anular(facturaId) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(facturaId, 'Factura');
        const { rows } = await cx.query('SELECT estado FROM factura WHERE id_factura = $1 FOR UPDATE', [id]);
        if (rows.length === 0) throw new NoEncontrado('Factura no encontrada');
        if (rows[0].estado !== 'pendiente') throw new Conflicto(`La factura ya está ${rows[0].estado}`);
        const { rows: [{ n }] } = await cx.query('SELECT COUNT(*)::int AS n FROM pago WHERE factura_fk = $1', [id]);
        if (n > 0) throw new Conflicto('No se puede anular una factura que ya tiene pagos');
        await cx.query(`UPDATE factura SET estado = 'anulada' WHERE id_factura = $1`, [id]);
        return obtenerFactura(cx, id);
      });
    },
  };
}
