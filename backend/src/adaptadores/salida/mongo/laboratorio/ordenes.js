import { Conflicto, DatosInvalidos, NoEncontrado } from '../../../../dominio/errores.js';
import { interpretarValor, TRANSICIONES_ORDEN } from '../../../../dominio/laboratorio.js';
import { aObjectId, dateATexto, enTransaccionMongo } from '../conexion.js';
import { nombreCompleto } from './modelo.js';
import { documentoAPaciente, exigirPacienteActivo } from './pacientes.js';

// ------------------------------------------------------------------ lectura

/** Orden de examen (documento) → Consulta del modelo común. */
function ordenAConsulta(o, zonaHoraria) {
  const texto = (d) => dateATexto(d, zonaHoraria);
  const persona = (p) => p && { id: p.id.toHexString(), nombre: p.nombre };
  return {
    id: o._id.toHexString(),
    citaId: null,
    fecha: texto(o.fecha_orden),
    motivo: o.motivo ?? null,
    observaciones: o.observaciones ?? null,
    medico: persona(o.medico_referente),
    // Los diagnósticos van embebidos y no tienen id propio: se numeran.
    diagnosticos: o.diagnosticos
      .map((d, i) => ({ id: String(i + 1), codigoCie10: d.codigo_cie10 ?? null, descripcion: d.descripcion, tipo: d.tipo }))
      .sort((a, b) => (b.tipo === 'principal') - (a.tipo === 'principal')),
    receta: o.medicacion_actual ? {
      id: o._id.toHexString(), // una por orden
      fechaEmision: texto(o.medicacion_actual.fecha_registro),
      indicaciones: o.medicacion_actual.indicaciones ?? null,
      items: o.medicacion_actual.items.map((i, n) => ({
        id: String(n + 1),
        medicamentoId: i.medicamento_id.toHexString(),
        medicamento: i.medicamento,
        dosis: i.dosis,
        frecuencia: i.frecuencia,
        duracionDias: i.duracion_dias,
        via: i.via,
        indicaciones: i.indicaciones ?? null,
      })),
    } : null,
    datosEspecificos: {
      numero: o.numero,
      estado: o.estado,
      registradaPor: persona(o.registrada_por),
      medicoReferente: {
        ...persona(o.medico_referente),
        numeroColegiado: o.medico_referente.numero_colegiado,
      },
      examenes: o.examenes.map((e) => ({
        tipoExamenId: e.tipo_examen_id.toHexString(),
        codigo: e.codigo,
        nombre: e.nombre,
        estado: e.estado,
        fechaTomaMuestra: texto(e.fecha_toma_muestra),
        validadoPor: persona(e.validado_por),
        fechaValidacion: texto(e.fecha_validacion),
        parametros: e.parametros.map((p) => ({
          codigo: p.codigo,
          nombre: p.nombre,
          tipoValor: p.tipo_valor,
          unidad: p.unidad ?? null,
          refMin: p.ref_min ?? null,
          refMax: p.ref_max ?? null,
          opciones: p.opciones ?? null,
          valorNormal: p.valor_normal ?? null,
          valor: p.valor ?? null,
          fueraDeRango: p.fuera_de_rango ?? null,
          observacion: p.observacion ?? null,
          fechaResultado: texto(p.fecha_resultado),
        })),
      })),
    },
  };
}

/**
 * Evolución de cada parámetro numérico del paciente a lo largo del tiempo
 * (p. ej. glucosa en ayunas en sus últimas órdenes). Se calcula con un
 * pipeline de agregación directamente en MongoDB.
 */
async function evolucionDeParametros(db, pacienteId, zonaHoraria) {
  const series = await db.collection('ordenes').aggregate([
    { $match: { paciente_id: pacienteId, estado: { $ne: 'anulada' } } },
    { $unwind: '$examenes' },
    { $unwind: '$examenes.parametros' },
    { $match: { 'examenes.parametros.tipo_valor': 'numerico', 'examenes.parametros.valor': { $type: 'number' } } },
    { $sort: { fecha_orden: 1 } },
    {
      $group: {
        _id: '$examenes.parametros.codigo',
        nombre: { $first: '$examenes.parametros.nombre' },
        unidad: { $first: '$examenes.parametros.unidad' },
        refMin: { $last: '$examenes.parametros.ref_min' },
        refMax: { $last: '$examenes.parametros.ref_max' },
        puntos: {
          $push: {
            fecha: '$fecha_orden',
            valor: '$examenes.parametros.valor',
            fueraDeRango: '$examenes.parametros.fuera_de_rango',
          },
        },
      },
    },
    { $sort: { nombre: 1 } },
  ]).toArray();

  return series.map((s) => ({
    parametro: s._id,
    nombre: s.nombre,
    unidad: s.unidad,
    refMin: s.refMin,
    refMax: s.refMax,
    puntos: s.puntos.map((p) => ({ ...p, fecha: dateATexto(p.fecha, zonaHoraria) })),
  }));
}

// ---------------------------------------------------------------- escritura

const medicamentoADocumento = (i, catalogo) => ({
  medicamento_id: catalogo.get(i.medicamentoId)._id,
  medicamento: `${catalogo.get(i.medicamentoId).nombre} — ${catalogo.get(i.medicamentoId).presentacion}`,
  dosis: i.dosis,
  frecuencia: i.frecuencia,
  duracion_dias: i.duracionDias,
  via: i.via,
  indicaciones: i.indicaciones,
});

/**
 * MongoDB no tiene llaves foráneas: se leen los documentos del catálogo dentro
 * de la transacción y se falla si alguno no existe o está inactivo.
 */
async function leerCatalogo(coleccion, ids, descripcion, session) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const objectIds = unicos.map((id) => aObjectId(id, descripcion));
  const docs = await coleccion.find({ _id: { $in: objectIds }, activo: true }, { session }).toArray();
  const porId = new Map(docs.map((d) => [d._id.toHexString(), d]));
  const faltante = unicos.find((id) => !porId.has(id));
  if (faltante) throw new DatosInvalidos(`El ${descripcion.toLowerCase()} ${faltante} no existe en el catálogo`);
  return porId;
}

function examenDesdeCatalogo(tipo) {
  return {
    tipo_examen_id: tipo._id,
    codigo: tipo.codigo,
    nombre: tipo.nombre,
    estado: 'pendiente',
    fecha_toma_muestra: null,
    validado_por: null,
    fecha_validacion: null,
    // Copia de la definición vigente: el resultado se interpreta con el rango
    // de referencia del día del examen, aunque el catálogo cambie después.
    parametros: tipo.parametros.map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      tipo_valor: p.tipo_valor,
      unidad: p.unidad ?? null,
      ref_min: p.ref_min ?? null,
      ref_max: p.ref_max ?? null,
      opciones: p.opciones ?? null,
      valor_normal: p.valor_normal ?? null,
      valor: null,
      fuera_de_rango: null,
      observacion: null,
      fecha_resultado: null,
    })),
  };
}

export function crearRepositorioOrdenes(cliente, db, zonaHoraria) {
  const col = (nombre) => db.collection(nombre);
  const aConsulta = (o) => ordenAConsulta(o, zonaHoraria);

  async function leerOrden(ordenId, session) {
    const orden = await col('ordenes').findOne({ _id: aObjectId(ordenId, 'Orden') }, { session });
    if (!orden) throw new NoEncontrado('Orden no encontrada');
    return orden;
  }

  /** Orden de un paciente activo y que todavía admite cambios. */
  async function exigirOrdenEditable(ordenId, session) {
    const orden = await leerOrden(ordenId, session);
    await exigirPacienteActivo(db, orden.paciente_id.toHexString(), session);
    if (['anulada', 'completada'].includes(orden.estado)) {
      throw new Conflicto(`La orden está ${orden.estado}; ya no admite cambios`);
    }
    return orden;
  }

  /** Siguiente número de orden del año: LAB-2026-00001. */
  async function siguienteNumero(session) {
    const anio = dateATexto(new Date(), zonaHoraria).slice(0, 4);
    const { valor } = await col('contadores').findOneAndUpdate(
      { _id: `ordenes-${anio}` },
      { $inc: { valor: 1 } },
      { upsert: true, returnDocument: 'after', session },
    );
    return `LAB-${anio}-${String(valor).padStart(5, '0')}`;
  }

  const atenciones = {
    // Regla "registrar consulta": crea la orden con sus exámenes, el
    // diagnóstico presuntivo y la medicación actual, en una sola transacción.
    registrarConsulta(pacienteId, c) {
      return enTransaccionMongo(cliente, async (session) => {
        const paciente = await exigirPacienteActivo(db, pacienteId, session);

        const quimico = await col('usuarios').findOne({ _id: aObjectId(c.medicoId, 'Usuario'), activo: true }, { session });
        if (!quimico) throw new NoEncontrado('El usuario de la sesión no existe o está inactivo');

        const { medicoReferenteId, examenes } = c.datosEspecificos;
        const [referente] = (await leerCatalogo(col('medicos_referentes'), [medicoReferenteId], 'Médico referente', session)).values();
        const tipos = await leerCatalogo(col('tipos_examen'), examenes, 'Tipo de examen', session);
        const medicamentos = await leerCatalogo(col('medicamentos'), c.receta?.items.map((i) => i.medicamentoId) ?? [], 'Medicamento', session);

        const ahora = new Date();
        const orden = {
          numero: await siguienteNumero(session),
          paciente_id: paciente._id,
          fecha_orden: ahora,
          estado: 'pendiente',
          motivo: c.motivo,
          observaciones: c.observaciones,
          registrada_por: { id: quimico._id, nombre: nombreCompleto(quimico) },
          medico_referente: {
            id: referente._id,
            nombre: nombreCompleto(referente),
            numero_colegiado: referente.numero_colegiado,
          },
          diagnosticos: c.diagnosticos.map((d) => ({
            codigo_cie10: d.codigoCie10, descripcion: d.descripcion, tipo: d.tipo, fecha_registro: ahora,
          })),
          medicacion_actual: c.receta ? {
            fecha_registro: ahora,
            indicaciones: c.receta.indicaciones,
            items: c.receta.items.map((i) => medicamentoADocumento(i, medicamentos)),
          } : null,
          examenes: examenes.map((id) => examenDesdeCatalogo(tipos.get(id))),
        };
        const { insertedId } = await col('ordenes').insertOne(orden, { session });
        return aConsulta({ ...orden, _id: insertedId });
      });
    },

    // Regla "agregar diagnóstico" (presuntivo).
    agregarDiagnostico(ordenId, d) {
      return enTransaccionMongo(cliente, async (session) => {
        const orden = await exigirOrdenEditable(ordenId, session);
        if (d.tipo === 'principal' && orden.diagnosticos.some((x) => x.tipo === 'principal')) {
          throw new Conflicto('La orden ya tiene un diagnóstico principal');
        }
        await col('ordenes').updateOne(
          { _id: orden._id },
          { $push: { diagnosticos: { codigo_cie10: d.codigoCie10, descripcion: d.descripcion, tipo: d.tipo, fecha_registro: new Date() } } },
          { session },
        );
        return aConsulta(await leerOrden(ordenId, session));
      });
    },

    // Regla "recetar medicamento": en el laboratorio se registra la medicación
    // que el paciente toma y que puede alterar los resultados.
    recetar(ordenId, receta) {
      return enTransaccionMongo(cliente, async (session) => {
        const orden = await exigirOrdenEditable(ordenId, session);
        const catalogo = await leerCatalogo(col('medicamentos'), receta.items.map((i) => i.medicamentoId), 'Medicamento', session);

        const registrados = new Set((orden.medicacion_actual?.items ?? []).map((i) => i.medicamento_id.toHexString()));
        if (receta.items.some((i) => registrados.has(i.medicamentoId))) {
          throw new Conflicto('Ese medicamento ya está registrado en la orden');
        }
        const nuevos = receta.items.map((i) => medicamentoADocumento(i, catalogo));
        const cambio = orden.medicacion_actual
          ? {
              $push: { 'medicacion_actual.items': { $each: nuevos } },
              ...(receta.indicaciones && { $set: { 'medicacion_actual.indicaciones': receta.indicaciones } }),
            }
          : { $set: { medicacion_actual: { fecha_registro: new Date(), indicaciones: receta.indicaciones, items: nuevos } } };
        await col('ordenes').updateOne({ _id: orden._id }, cambio, { session });
        return aConsulta(await leerOrden(ordenId, session));
      });
    },

    async obtenerHistorial(pacienteId) {
      const paciente = await col('pacientes').findOne({ _id: aObjectId(pacienteId, 'Paciente') });
      if (!paciente) throw new NoEncontrado('Paciente no encontrado');

      const ordenes = await col('ordenes').find({ paciente_id: paciente._id }).sort({ fecha_orden: -1 }).toArray();

      return {
        paciente: documentoAPaciente(paciente, zonaHoraria),
        consultas: ordenes.map(aConsulta),
        extras: {
          ordenesEnCurso: ordenes.filter((o) => ['pendiente', 'en_proceso'].includes(o.estado)).length,
          evolucion: await evolucionDeParametros(db, paciente._id, zonaHoraria),
        },
      };
    },
  };

  const laboratorio = {
    async listarTiposExamen() {
      const tipos = await col('tipos_examen').find({ activo: true }).sort({ categoria: 1, nombre: 1 }).toArray();
      return tipos.map((t) => ({
        id: t._id.toHexString(),
        codigo: t.codigo,
        nombre: t.nombre,
        categoria: t.categoria,
        muestra: t.muestra,
        precio: t.precio ?? null,
        parametros: t.parametros.map((p) => ({
          codigo: p.codigo,
          nombre: p.nombre,
          tipoValor: p.tipo_valor,
          unidad: p.unidad ?? null,
          refMin: p.ref_min ?? null,
          refMax: p.ref_max ?? null,
          opciones: p.opciones ?? null,
          valorNormal: p.valor_normal ?? null,
        })),
      }));
    },

    registrarResultados(ordenId, codigoExamen, resultados) {
      return enTransaccionMongo(cliente, async (session) => {
        const orden = await exigirOrdenEditable(ordenId, session);
        const indice = orden.examenes.findIndex((e) => e.codigo === codigoExamen);
        if (indice === -1) throw new NoEncontrado(`La orden no incluye el examen ${codigoExamen}`);
        const examen = orden.examenes[indice];
        if (examen.estado === 'validado') throw new Conflicto('El examen ya fue validado; sus resultados no se modifican');

        const ahora = new Date();
        const errores = {};
        const parametros = examen.parametros.map((p) => ({ ...p }));
        resultados.forEach((r, i) => {
          const p = parametros.find((x) => x.codigo === r.parametro);
          if (!p) {
            errores[`resultados[${i}].parametro`] = `El examen ${codigoExamen} no tiene el parámetro ${r.parametro}`;
            return;
          }
          const interpretado = interpretarValor(p, r.valor);
          if (interpretado.error) {
            errores[`resultados[${i}].valor`] = interpretado.error;
            return;
          }
          Object.assign(p, {
            valor: interpretado.valor,
            fuera_de_rango: interpretado.fueraDeRango,
            observacion: r.observacion ?? p.observacion,
            fecha_resultado: ahora,
          });
        });
        if (Object.keys(errores).length > 0) throw new DatosInvalidos('Resultados inválidos', errores);

        const completos = parametros.every((p) => p.valor !== null);
        await col('ordenes').updateOne(
          { _id: orden._id },
          {
            $set: {
              [`examenes.${indice}.parametros`]: parametros,
              [`examenes.${indice}.estado`]: completos ? 'resultados_completos' : 'en_proceso',
              [`examenes.${indice}.fecha_toma_muestra`]: examen.fecha_toma_muestra ?? ahora,
              ...(orden.estado === 'pendiente' && { estado: 'en_proceso' }),
            },
          },
          { session },
        );
        return aConsulta(await leerOrden(ordenId, session));
      });
    },

    // Validar = el químico biólogo firma el examen. Al validar el último, la
    // orden se completa sola.
    validarExamen(ordenId, codigoExamen, usuario) {
      return enTransaccionMongo(cliente, async (session) => {
        const orden = await exigirOrdenEditable(ordenId, session);
        const indice = orden.examenes.findIndex((e) => e.codigo === codigoExamen);
        if (indice === -1) throw new NoEncontrado(`La orden no incluye el examen ${codigoExamen}`);
        const examen = orden.examenes[indice];
        if (examen.estado === 'validado') throw new Conflicto('El examen ya fue validado');
        if (examen.estado !== 'resultados_completos') {
          throw new Conflicto('Faltan resultados: registra todos los parámetros antes de validar');
        }

        const restantes = orden.examenes.filter((e, i) => i !== indice && e.estado !== 'validado').length;
        await col('ordenes').updateOne(
          { _id: orden._id },
          {
            $set: {
              [`examenes.${indice}.estado`]: 'validado',
              [`examenes.${indice}.validado_por`]: { id: aObjectId(usuario.id, 'Usuario'), nombre: usuario.nombre },
              [`examenes.${indice}.fecha_validacion`]: new Date(),
              estado: restantes === 0 ? 'completada' : 'en_proceso',
            },
          },
          { session },
        );
        return aConsulta(await leerOrden(ordenId, session));
      });
    },

    /**
     * Agrega exámenes a una orden existente (Entrega I, operación 4). Cada
     * examen copia la definición vigente del catálogo, igual que al crear la
     * orden. El filtro del update repite las condiciones (editable y sin esos
     * exámenes): si otra petición cambió la orden a la vez, no se aplica.
     */
    agregarExamenes(ordenId, idsTipos) {
      return enTransaccionMongo(cliente, async (session) => {
        const orden = await exigirOrdenEditable(ordenId, session);
        const tipos = await leerCatalogo(col('tipos_examen'), idsTipos, 'Tipo de examen', session);

        const yaIncluidos = idsTipos.filter((id) => orden.examenes.some((e) => e.tipo_examen_id.toHexString() === id));
        if (yaIncluidos.length > 0) {
          throw new Conflicto(`La orden ya incluye: ${yaIncluidos.map((id) => tipos.get(id).nombre).join(', ')}`);
        }

        const objectIds = idsTipos.map((id) => tipos.get(id)._id);
        const { matchedCount } = await col('ordenes').updateOne(
          { _id: orden._id, estado: { $in: ['pendiente', 'en_proceso'] }, 'examenes.tipo_examen_id': { $nin: objectIds } },
          { $push: { examenes: { $each: idsTipos.map((id) => examenDesdeCatalogo(tipos.get(id))) } } },
          { session },
        );
        if (matchedCount === 0) throw new Conflicto('La orden cambió mientras se agregaban los exámenes; vuelve a intentarlo');
        return aConsulta(await leerOrden(ordenId, session));
      });
    },

    cambiarEstadoOrden(ordenId, estado) {
      return enTransaccionMongo(cliente, async (session) => {
        const orden = await leerOrden(ordenId, session);
        if (!TRANSICIONES_ORDEN[orden.estado].includes(estado)) {
          throw new Conflicto(
            estado === 'completada'
              ? 'La orden se completa sola al validar todos sus exámenes'
              : `No se puede pasar de ${orden.estado} a ${estado}`,
          );
        }
        await col('ordenes').updateOne({ _id: orden._id }, { $set: { estado } }, { session });
        return aConsulta(await leerOrden(ordenId, session));
      });
    },
  };

  return { atenciones, laboratorio };
}
