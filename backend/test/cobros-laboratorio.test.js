import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatosInvalidos } from '../src/dominio/errores.js';
import {
  interpretarValor, TRANSICIONES_ORDEN, validarExamenesNuevos, validarResultados,
} from '../src/dominio/laboratorio.js';
import { validarPagoConReferencia } from '../src/dominio/pago.js';
import { validarCobro, validarPagoCobro, validarVacunaAplicada } from '../src/dominio/pediatrico.js';
import { rechaza } from './ayuda.js';

describe('Referencia de un pago según el método', () => {
  it('el efectivo no lleva referencia', () => {
    assert.equal(validarPagoConReferencia({ monto: 50, metodoPago: 'efectivo' }).referencia, null);
    rechaza(() => validarPagoConReferencia({ monto: 50, metodoPago: 'efectivo', referencia: '123456' }), DatosInvalidos, ['referencia']);
  });

  it('la tarjeta pide 6 letras o números del voucher, con al menos un número', () => {
    assert.equal(validarPagoConReferencia({ monto: 50, metodoPago: 'tarjeta', referencia: 'ab 12cd' }).referencia, 'AB12CD');
    rechaza(() => validarPagoConReferencia({ monto: 50, metodoPago: 'tarjeta', referencia: '4821' }), DatosInvalidos, ['referencia']);
    rechaza(() => validarPagoConReferencia({ monto: 50, metodoPago: 'tarjeta', referencia: 'ABCDEF' }), DatosInvalidos, ['referencia']);
    rechaza(() => validarPagoConReferencia({ monto: 50, metodoPago: 'tarjeta' }), DatosInvalidos, ['referencia']);
  });

  it('la transferencia pide de 6 a 20 dígitos', () => {
    assert.equal(validarPagoConReferencia({ monto: 50, metodoPago: 'transferencia', referencia: '00123456' }).referencia, '00123456');
    rechaza(() => validarPagoConReferencia({ monto: 50, metodoPago: 'transferencia', referencia: 'ABC123' }), DatosInvalidos, ['referencia']);
  });

  it('el monto es positivo y con máximo dos decimales', () => {
    rechaza(() => validarPagoConReferencia({ monto: 0, metodoPago: 'efectivo' }), DatosInvalidos, ['monto']);
    rechaza(() => validarPagoConReferencia({ monto: 10.555, metodoPago: 'efectivo' }), DatosInvalidos, ['monto']);
  });

  it('el pediátrico usa la misma regla que hospital y odontológica', () => {
    rechaza(() => validarPagoCobro({ monto: 50, metodoPago: 'tarjeta', referencia: '4821' }), DatosInvalidos, ['referencia']);
  });
});

describe('Pediátrico: cobros y vacunas', () => {
  it('un cobro lleva al menos un servicio y no los repite (se usa la cantidad)', () => {
    rechaza(() => validarCobro({ items: [] }), DatosInvalidos, ['items']);
    rechaza(() => validarCobro({ items: [{ servicioId: 1 }, { servicioId: 1 }] }), DatosInvalidos, ['items']);
    assert.equal(validarCobro({ items: [{ servicioId: 1, cantidad: 2 }] }).items[0].cantidad, 2);
  });

  it('el precio no lo manda el cliente: se toma del catálogo al guardar', () => {
    assert.equal(validarCobro({ items: [{ servicioId: 1, precio: 1 }] }).items[0].precio, undefined);
  });

  it('una vacuna aplicada no puede tener fecha futura y lleva lote', () => {
    rechaza(() => validarVacunaAplicada({ vacunaId: 1, numeroDosis: 1, lote: 'L1', fechaAplicacion: '2999-01-01' }), DatosInvalidos, ['fechaAplicacion']);
    rechaza(() => validarVacunaAplicada({ vacunaId: 1, numeroDosis: 1 }), DatosInvalidos, ['lote']);
  });
});

describe('Laboratorio: resultados y órdenes', () => {
  const glucosa = { tipo_valor: 'numerico', ref_min: 70, ref_max: 100 };

  it('marca un valor numérico fuera del rango de referencia', () => {
    assert.deepEqual(interpretarValor(glucosa, 85), { valor: 85, fueraDeRango: false });
    assert.deepEqual(interpretarValor(glucosa, '126'), { valor: 126, fueraDeRango: true });
    assert.deepEqual(interpretarValor(glucosa, '65,5'), { valor: 65.5, fueraDeRango: true });
  });

  it('rechaza texto en un parámetro numérico', () => {
    assert.ok(interpretarValor(glucosa, 'alto').error);
  });

  it('un parámetro de opción solo acepta sus opciones y compara con el valor normal', () => {
    const color = { tipo_valor: 'opcion', opciones: ['Amarillo', 'Ámbar', 'Rojizo'], valor_normal: 'Amarillo' };
    assert.equal(interpretarValor(color, 'Amarillo').fueraDeRango, false);
    assert.equal(interpretarValor(color, 'Rojizo').fueraDeRango, true);
    assert.ok(interpretarValor(color, 'Verde').error);
  });

  it('no se registran parámetros repetidos en una misma captura', () => {
    rechaza(() => validarResultados({ resultados: [{ parametro: 'GLU', valor: 90 }, { parametro: 'GLU', valor: 91 }] }), DatosInvalidos, ['resultados']);
  });

  it('una orden completada o anulada ya no cambia de estado', () => {
    assert.deepEqual(TRANSICIONES_ORDEN.completada, []);
    assert.deepEqual(TRANSICIONES_ORDEN.anulada, []);
    assert.ok(TRANSICIONES_ORDEN.pendiente.includes('en_proceso'));
  });

  it('agregar exámenes a una orden: al menos uno y sin repetir', () => {
    rechaza(() => validarExamenesNuevos({ examenes: [] }), DatosInvalidos);
    rechaza(() => validarExamenesNuevos({ examenes: ['a', 'a'] }), DatosInvalidos);
  });
});
