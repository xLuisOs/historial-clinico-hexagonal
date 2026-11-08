import { Validador } from './validacion.js';

// Operaciones propias del laboratorio (Entrega I, operaciones 5 y 6):
// registrar el resultado de cada parámetro y cambiar el estado de la orden.
// Dependen de la institución, no del motor.

export const ESTADOS_ORDEN = ['pendiente', 'en_proceso', 'completada', 'anulada'];

// Cambios de estado permitidos manualmente. 'completada' no está: la orden se
// completa sola cuando todos sus exámenes quedan validados.
export const TRANSICIONES_ORDEN = {
  pendiente: ['en_proceso', 'anulada'],
  en_proceso: ['anulada'],
  completada: [],
  anulada: [],
};

export function validarResultados(datos = {}) {
  const v = new Validador();
  const lista = Array.isArray(datos.resultados) ? datos.resultados : [];
  if (lista.length === 0) v.error('resultados', 'Registra al menos un resultado');

  const resultados = lista.map((r = {}, i) => {
    const p = `resultados[${i}]`;
    const valor = typeof r.valor === 'number'
      ? v.numero(`${p}.valor`, r.valor)
      : v.texto(`${p}.valor`, r.valor, { requerido: true, max: 100 });
    return {
      parametro: v.texto(`${p}.parametro`, r.parametro, { requerido: true, max: 20 }),
      valor,
      observacion: v.texto(`${p}.observacion`, r.observacion, { max: 300 }),
    };
  });

  const codigos = resultados.map((r) => r.parametro);
  if (new Set(codigos).size !== codigos.length) v.error('resultados', 'Hay parámetros repetidos');

  v.lanzarSiHayErrores();
  return resultados;
}

/**
 * Interpreta un valor contra la definición del parámetro: convierte texto
 * numérico a número y dice si está fuera del rango de referencia.
 * Devuelve { valor, fueraDeRango } o { error }.
 */
export function interpretarValor(parametro, valor) {
  if (parametro.tipo_valor === 'numerico') {
    const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(n)) return { error: 'Debe ser numérico' };
    const bajo = parametro.ref_min != null && n < parametro.ref_min;
    const alto = parametro.ref_max != null && n > parametro.ref_max;
    return { valor: n, fueraDeRango: bajo || alto };
  }
  const texto = String(valor).trim();
  if (parametro.tipo_valor === 'opcion' && parametro.opciones?.length && !parametro.opciones.includes(texto)) {
    return { error: `Valores permitidos: ${parametro.opciones.join(', ')}` };
  }
  return {
    valor: texto,
    fueraDeRango: parametro.valor_normal ? texto.toLowerCase() !== parametro.valor_normal.toLowerCase() : null,
  };
}

export function validarCambioEstado(datos = {}) {
  const v = new Validador();
  const estado = v.opcion('estado', datos.estado, ESTADOS_ORDEN, { requerido: true });
  v.lanzarSiHayErrores();
  return estado;
}

/**
 * Médico referente nuevo (Entrega I, operación 2): quien ordena los exámenes,
 * aunque no pertenezca al laboratorio. El colegiado es único.
 */
export function validarMedicoReferente(datos = {}) {
  const v = new Validador();
  const medico = {
    nombres: v.texto('nombres', datos.nombres, { requerido: true, max: 100 }),
    apellidos: v.texto('apellidos', datos.apellidos, { requerido: true, max: 100 }),
    numeroColegiado: v.patron('numeroColegiado', datos.numeroColegiado == null ? null : String(datos.numeroColegiado),
      /^\d{3,10}$/, 'Solo números (3 a 10 dígitos)', { requerido: true }),
    especialidad: v.texto('especialidad', datos.especialidad, { max: 80 }),
    telefono: v.patron('telefono', datos.telefono, /^[0-9+\-\s]{8,20}$/, 'Teléfono inválido'),
    institucionProcedencia: v.texto('institucionProcedencia', datos.institucionProcedencia, { max: 150 }),
  };
  v.lanzarSiHayErrores();
  return medico;
}
