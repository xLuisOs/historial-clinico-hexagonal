import { Timestamp } from 'firebase-admin/firestore';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { COLECCIONES } from './modelo.js';

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Agrega un pago al arreglo `pagos` de la consulta y actualiza su estado_pago,
 * en una transacción: si otra recepcionista cobra a la vez, Firestore la
 * reintenta con el saldo ya actualizado.
 */
export async function registrarPago(db, consultaId, { monto, metodoPago, referencia }, usuario) {
  return enTransaccion(db, async (t) => {
    const consulta = await t.get(db.collection(COLECCIONES.consultas).doc(consultaId));
    if (!consulta.exists) throw new NoEncontrado('Consulta no encontrada');
    const quien = await t.get(db.collection(COLECCIONES.usuarios).doc(usuario.id));

    const total = Number(consulta.get('total') ?? 0);
    const pagos = consulta.get('pagos') ?? [];
    const pagado = redondear(pagos.reduce((s, p) => s + Number(p.monto ?? 0), 0));
    const saldo = redondear(total - pagado);
    if (saldo <= 0) throw new Conflicto('La consulta ya está pagada');
    if (monto > saldo) throw new Conflicto('El pago excede el saldo', { monto: `El saldo es de Q ${saldo.toFixed(2)}` });

    const nuevoPagado = redondear(pagado + monto);
    const estadoPago = nuevoPagado >= total ? 'pagado' : 'parcial';
    t.update(consulta.ref, {
      // serverTimestamp no se permite dentro de un arreglo: se usa la hora del servidor de la app.
      pagos: [...pagos, {
        fecha: Timestamp.now(),
        metodo_pago: metodoPago,
        monto,
        referencia: referencia ?? null,
        registrado_por: {
          id: quien.get('recepcionista_id') ?? null,
          nombres: quien.get('nombres') ?? usuario.nombre,
          apellidos: quien.get('apellidos') ?? null,
        },
      }],
      estado_pago: estadoPago,
    });
    return { consultaId, total, pagado: nuevoPagado, saldo: redondear(total - nuevoPagado), estadoPago };
  });
}
