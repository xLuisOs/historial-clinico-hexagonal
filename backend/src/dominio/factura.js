import { validarReferencia } from './pago.js';
import { Validador } from './validacion.js';

// Facturación del hospital: una factura sale de una consulta O de un
// internamiento; su total lo calcula la base a partir del detalle.

export const METODOS_PAGO_FACTURA = ['efectivo', 'tarjeta', 'transferencia', 'seguro'];

export function validarNuevaFactura(datos = {}) {
  const v = new Validador();
  const consultaId = datos.consultaId == null || datos.consultaId === '' ? null : String(datos.consultaId);
  const internamientoId = datos.internamientoId == null || datos.internamientoId === '' ? null : String(datos.internamientoId);
  if (Boolean(consultaId) === Boolean(internamientoId)) {
    v.error('origen', 'Indica una consulta o un internamiento (solo uno)');
  }

  const items = Array.isArray(datos.items) ? datos.items : [];
  if (items.length === 0) v.error('items', 'Agrega al menos una línea');
  const factura = {
    consultaId,
    internamientoId,
    items: items.map((item = {}, i) => {
      const p = `items[${i}]`;
      const precioUnitario = v.numero(`${p}.precioUnitario`, item.precioUnitario, { requerido: true, min: 0, max: 1_000_000 });
      if (precioUnitario !== null && Math.round(precioUnitario * 100) !== precioUnitario * 100) {
        v.error(`${p}.precioUnitario`, 'Máximo dos decimales');
      }
      return {
        descripcion: v.texto(`${p}.descripcion`, item.descripcion, { requerido: true, max: 200 }),
        cantidad: v.numero(`${p}.cantidad`, item.cantidad ?? 1, { entero: true, min: 1, max: 999 }),
        precioUnitario,
      };
    }),
  };
  v.lanzarSiHayErrores();
  return factura;
}

export function validarPagoFactura(datos = {}) {
  const v = new Validador();
  const monto = v.numero('monto', datos.monto, { requerido: true, min: 0.01, max: 1_000_000 });
  if (monto !== null && Math.round(monto * 100) !== monto * 100) v.error('monto', 'Máximo dos decimales');
  const metodoPago = v.opcion('metodoPago', datos.metodoPago, METODOS_PAGO_FACTURA, { requerido: true });
  const pago = {
    monto,
    metodoPago,
    referencia: metodoPago ? validarReferencia(v, metodoPago, datos.referencia) : null,
  };
  v.lanzarSiHayErrores();
  return pago;
}
