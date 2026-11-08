import { Validador } from './validacion.js';

export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];

export function validarPago(datos = {}) {
  const v = new Validador();
  const monto = v.numero('monto', datos.monto, { requerido: true, min: 0.01, max: 1_000_000 });
  if (monto !== null && Math.round(monto * 100) !== monto * 100) v.error('monto', 'Máximo dos decimales');
  const pago = { monto, metodoPago: v.opcion('metodoPago', datos.metodoPago, METODOS_PAGO, { requerido: true }) };
  v.lanzarSiHayErrores();
  return pago;
}
