import { Validador } from './validacion.js';

export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];

// Qué referencia pide cada método de pago y qué forma debe tener. El efectivo
// no lleva ninguna. No se puede comprobar con el banco o la aseguradora que
// exista, pero sí que no falte y que tenga el formato correcto.
export const REFERENCIA_POR_METODO = {
  tarjeta: {
    nombre: 'No. de autorización',
    patron: /^(?=.*\d)[A-Z0-9]{6}$/,
    mensaje: 'La autorización del voucher tiene 6 letras o números (al menos un número)',
  },
  transferencia: {
    nombre: 'No. de boleta o transacción',
    patron: /^\d{6,20}$/,
    mensaje: 'El número de boleta o transacción lleva de 6 a 20 dígitos',
  },
  seguro: {
    nombre: 'No. de póliza',
    patron: /^(?=.*\d)[A-Z0-9-]{5,20}$/,
    mensaje: 'La póliza lleva de 5 a 20 letras, números o guiones (al menos un número)',
  },
};

/**
 * Valida la referencia según el método (ya validado) y la devuelve en
 * mayúsculas y sin espacios, o null si el método no la usa.
 */
export function validarReferencia(v, metodoPago, referencia) {
  const texto = typeof referencia === 'string' ? referencia.replace(/\s+/g, '').toUpperCase() : referencia;
  const regla = REFERENCIA_POR_METODO[metodoPago];
  if (!regla) {
    if (texto) v.error('referencia', 'El pago en efectivo no lleva referencia');
    return null;
  }
  if (!texto) {
    v.error('referencia', `Indica el ${regla.nombre.replace('No.', 'número')}`);
    return null;
  }
  if (typeof texto !== 'string' || !regla.patron.test(texto)) {
    v.error('referencia', regla.mensaje);
    return null;
  }
  return texto;
}

export function validarPago(datos = {}) {
  const v = new Validador();
  const monto = v.numero('monto', datos.monto, { requerido: true, min: 0.01, max: 1_000_000 });
  if (monto !== null && Math.round(monto * 100) !== monto * 100) v.error('monto', 'Máximo dos decimales');
  const pago = { monto, metodoPago: v.opcion('metodoPago', datos.metodoPago, METODOS_PAGO, { requerido: true }) };
  v.lanzarSiHayErrores();
  return pago;
}

/** Pago con referencia según el método (odontológica). */
export function validarPagoConReferencia(datos = {}) {
  const v = new Validador();
  const monto = v.numero('monto', datos.monto, { requerido: true, min: 0.01, max: 1_000_000 });
  if (monto !== null && Math.round(monto * 100) !== monto * 100) v.error('monto', 'Máximo dos decimales');
  const metodoPago = v.opcion('metodoPago', datos.metodoPago, METODOS_PAGO, { requerido: true });
  const referencia = metodoPago ? validarReferencia(v, metodoPago, datos.referencia) : null;
  v.lanzarSiHayErrores();
  return { monto, metodoPago, referencia };
}
