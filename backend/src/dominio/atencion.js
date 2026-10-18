import { Validador } from './validacion.js';

// Modelo común de una atención (consulta) con sus diagnósticos y receta.
//
// Consulta = {
//   id, fecha, motivo, observaciones,
//   medico:       { id, nombre },
//   diagnosticos: [{ id, codigoCie10, descripcion, tipo }],
//   receta:       null | { id, fechaEmision, indicaciones, items: [ItemReceta] },
//   datosEspecificos: { ... }   // propio de cada institución (crecimiento, pieza dental, etc.)
// }
// ItemReceta = { medicamentoId, medicamento, dosis, frecuencia, duracionDias, via, indicaciones }

export const TIPOS_DIAGNOSTICO = ['principal', 'secundario'];
export const VIAS = [
  'oral', 'intramuscular', 'intravenosa', 'subcutanea', 'topica',
  'inhalada', 'oftalmica', 'otica', 'nasal', 'rectal',
];
const CIE10 = /^[A-Z]\d{2}(\.[0-9A-Z]{1,4})?$/;

function validarDiagnosticoEn(v, prefijo, d = {}) {
  return {
    codigoCie10: v.patron(`${prefijo}.codigoCie10`, d.codigoCie10?.toUpperCase?.(), CIE10, 'Código CIE-10 inválido (ej. J06.9)'),
    descripcion: v.texto(`${prefijo}.descripcion`, d.descripcion, { requerido: true, max: 300 }),
    tipo: v.opcion(`${prefijo}.tipo`, d.tipo ?? 'principal', TIPOS_DIAGNOSTICO),
  };
}

function validarItemsRecetaEn(v, prefijo, items) {
  if (!Array.isArray(items) || items.length === 0) {
    v.error(prefijo, 'Agrega al menos un medicamento');
    return [];
  }
  const vistos = new Set();
  return items.map((item = {}, i) => {
    const p = `${prefijo}[${i}]`;
    const medicamentoId = v.texto(`${p}.medicamentoId`, item.medicamentoId == null ? null : String(item.medicamentoId), { requerido: true });
    if (medicamentoId && vistos.has(medicamentoId)) v.error(`${p}.medicamentoId`, 'Medicamento repetido en la receta');
    vistos.add(medicamentoId);
    return {
      medicamentoId,
      dosis: v.texto(`${p}.dosis`, item.dosis, { requerido: true, max: 60 }),
      frecuencia: v.texto(`${p}.frecuencia`, item.frecuencia, { requerido: true, max: 60 }),
      duracionDias: v.numero(`${p}.duracionDias`, item.duracionDias, { requerido: true, entero: true, min: 1, max: 365 }),
      via: v.opcion(`${p}.via`, item.via ?? 'oral', VIAS),
      indicaciones: v.texto(`${p}.indicaciones`, item.indicaciones, { max: 300 }),
    };
  });
}

// Datos propios de cada institución. Dependen de la institución, no del motor.
const VALIDADORES_ESPECIFICOS = {
  pediatrico(v, d = {}) {
    return {
      pesoKg: v.numero('datosEspecificos.pesoKg', d.pesoKg, { min: 0.3, max: 150 }),
      tallaCm: v.numero('datosEspecificos.tallaCm', d.tallaCm, { min: 20, max: 220 }),
      perimetroCefalicoCm: v.numero('datosEspecificos.perimetroCefalicoCm', d.perimetroCefalicoCm, { min: 20, max: 70 }),
    };
  },
};

export function validarNuevaConsulta(datos = {}, institucion) {
  const v = new Validador();

  const diagnosticos = Array.isArray(datos.diagnosticos)
    ? datos.diagnosticos.map((d, i) => validarDiagnosticoEn(v, `diagnosticos[${i}]`, d))
    : [];
  if (diagnosticos.length === 0) {
    v.error('diagnosticos', 'Registra al menos un diagnóstico');
  } else if (diagnosticos.filter((d) => d.tipo === 'principal').length !== 1) {
    v.error('diagnosticos', 'Debe haber exactamente un diagnóstico principal');
  }

  const consulta = {
    citaId: datos.citaId == null ? null : String(datos.citaId),
    medicoId: datos.medicoId == null ? null : String(datos.medicoId),
    motivo: v.texto('motivo', datos.motivo, { max: 300 }),
    observaciones: v.texto('observaciones', datos.observaciones, { max: 5000 }),
    diagnosticos,
    receta: datos.receta
      ? {
          indicaciones: v.texto('receta.indicaciones', datos.receta.indicaciones, { max: 500 }),
          items: validarItemsRecetaEn(v, 'receta.items', datos.receta.items),
        }
      : null,
    datosEspecificos: VALIDADORES_ESPECIFICOS[institucion]?.(v, datos.datosEspecificos) ?? {},
  };

  v.lanzarSiHayErrores();
  return consulta;
}

export function validarDiagnostico(datos) {
  const v = new Validador();
  const diagnostico = validarDiagnosticoEn(v, 'diagnostico', datos);
  v.lanzarSiHayErrores();
  return diagnostico;
}

export function validarReceta(datos = {}) {
  const v = new Validador();
  const receta = {
    indicaciones: v.texto('indicaciones', datos.indicaciones, { max: 500 }),
    items: validarItemsRecetaEn(v, 'items', datos.items),
  };
  v.lanzarSiHayErrores();
  return receta;
}
