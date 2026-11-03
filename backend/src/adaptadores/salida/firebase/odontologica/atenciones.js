import { FieldValue } from 'firebase-admin/firestore';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, timestampATexto } from '../conexion.js';
import { COLECCIONES, nombreCompleto } from './modelo.js';
import { documentoAPaciente, exigirPacienteActivo } from './pacientes.js';

const redondear = (n) => Math.round(n * 100) / 100;
const copiaDePersona = (snap) => ({ id: snap.id, nombres: snap.get('nombres'), apellidos: snap.get('apellidos') });

// ------------------------------------------------------------------ lectura

function documentoAConsulta(snap, zonaHoraria) {
  const d = snap.data();
  const texto = (valor) => timestampATexto(valor, zonaHoraria);
  return {
    id: snap.id,
    citaId: d.cita_id ?? null,
    fecha: texto(d.fecha_atencion),
    motivo: d.motivo ?? null,
    observaciones: d.notas ?? null,
    medico: { id: d.odontologo?.id ?? null, nombre: nombreCompleto(d.odontologo) },
    // Los diagnósticos van embebidos y no tienen id propio: se numeran.
    diagnosticos: (d.diagnosticos ?? [])
      .map((x, i) => ({ id: String(i + 1), codigoCie10: x.codigo_cie10 ?? null, descripcion: x.descripcion, tipo: x.tipo }))
      .sort((a, b) => (b.tipo === 'principal') - (a.tipo === 'principal')),
    receta: !d.receta ? null : {
      id: snap.id, // una receta por consulta
      fechaEmision: texto(d.receta.fecha_emision),
      indicaciones: d.receta.indicaciones ?? null,
      items: (d.receta.items ?? []).map((i, n) => ({
        id: String(n + 1),
        medicamentoId: i.medicamento_id,
        medicamento: i.medicamento,
        dosis: i.dosis,
        frecuencia: i.frecuencia,
        duracionDias: i.duracion_dias,
        via: i.via,
        indicaciones: i.indicaciones ?? null,
      })),
    },
    datosEspecificos: {
      procedimientos: (d.procedimientos ?? []).map((p) => ({
        procedimientoId: p.procedimiento_id,
        nombre: p.nombre,
        piezaDental: p.pieza_dental ?? null,
        observaciones: p.observaciones ?? null,
        precioAplicado: p.precio_aplicado,
      })),
      total: d.total ?? 0,
      estadoPago: d.estado_pago ?? null,
      pagos: (d.pagos ?? []).map((p) => ({
        fecha: texto(p.fecha),
        metodoPago: p.metodo_pago,
        monto: p.monto,
        registradoPor: p.registrado_por && { id: p.registrado_por.id, nombre: nombreCompleto(p.registrado_por) },
      })),
    },
  };
}

// ---------------------------------------------------------------- escritura

/**
 * Firestore no tiene llaves foráneas: lee los documentos del catálogo dentro
 * de la transacción y falla si alguno no existe o está inactivo.
 */
async function leerCatalogo(t, coleccion, ids, descripcion) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const snaps = await t.getAll(...unicos.map((id) => coleccion.doc(id)));
  for (const snap of snaps) {
    if (!snap.exists || snap.get('activo') === false) {
      throw new NoEncontrado(`El ${descripcion} ${snap.id} no existe en el catálogo`);
    }
  }
  return new Map(snaps.map((s) => [s.id, s]));
}

const itemsDeReceta = (items, medicamentos) => items.map((i) => {
  const m = medicamentos.get(i.medicamentoId);
  return {
    medicamento_id: i.medicamentoId,
    medicamento: `${m.get('nombre')} — ${m.get('presentacion')}`,
    dosis: i.dosis,
    frecuencia: i.frecuencia,
    duracion_dias: i.duracionDias,
    via: i.via,
    indicaciones: i.indicaciones,
  };
});

const diagnosticoADocumento = (d) => ({ codigo_cie10: d.codigoCie10, descripcion: d.descripcion, tipo: d.tipo });

export function crearRepositorioAtenciones(db, zonaHoraria) {
  const col = (nombre) => db.collection(COLECCIONES[nombre]);
  const aConsulta = (snap) => documentoAConsulta(snap, zonaHoraria);

  async function obtenerConsulta(consultaId) {
    const snap = await col('consultas').doc(consultaId).get();
    if (!snap.exists) throw new NoEncontrado('Consulta no encontrada');
    return aConsulta(snap);
  }

  /** Lee la consulta y verifica que el historial de su paciente siga activo. */
  async function exigirConsultaEditable(t, consultaId) {
    const snap = await t.get(col('consultas').doc(consultaId));
    if (!snap.exists) throw new NoEncontrado('Consulta no encontrada');
    await exigirPacienteActivo(t, db, snap.get('paciente_id'));
    return snap;
  }

  return {
    // Consulta + diagnósticos + receta + cita atendida: o se guarda todo, o nada.
    async registrarConsulta(pacienteId, c) {
      const id = await enTransaccion(db, async (t) => {
        // Firestore exige hacer todas las lecturas antes de la primera escritura.
        await exigirPacienteActivo(t, db, pacienteId);

        if (!c.medicoId) throw new Conflicto('El usuario no está asociado a un odontólogo');
        const odontologo = await t.get(col('odontologos').doc(c.medicoId));
        if (!odontologo.exists) throw new NoEncontrado('El odontólogo de la sesión no existe en el catálogo');

        let cita = null;
        if (c.citaId) {
          cita = await t.get(col('citas').doc(c.citaId));
          if (!cita.exists || cita.get('paciente.id') !== pacienteId) {
            throw new NoEncontrado('La cita no existe o no es de este paciente');
          }
          if (cita.get('estado') !== 'programada') {
            throw new Conflicto(`La cita está ${cita.get('estado')}; no se puede atender`);
          }
        }

        const realizados = c.datosEspecificos.procedimientos ?? [];
        const catalogo = await leerCatalogo(t, col('procedimientos'), realizados.map((p) => p.procedimientoId), 'procedimiento');
        const medicamentos = await leerCatalogo(t, col('medicamentos'), c.receta?.items.map((i) => i.medicamentoId) ?? [], 'medicamento');

        // El precio se copia del catálogo: si después cambia, la consulta
        // conserva lo que realmente se cobró.
        const procedimientos = realizados.map((p) => ({
          procedimiento_id: p.procedimientoId,
          nombre: catalogo.get(p.procedimientoId).get('nombre'),
          pieza_dental: p.piezaDental,
          observaciones: p.observaciones,
          precio_aplicado: Number(catalogo.get(p.procedimientoId).get('costo') ?? 0),
        }));
        const total = redondear(procedimientos.reduce((suma, p) => suma + p.precio_aplicado, 0));

        const ref = col('consultas').doc();
        t.set(ref, {
          paciente_id: pacienteId,
          cita_id: c.citaId,
          fecha_atencion: FieldValue.serverTimestamp(),
          odontologo: copiaDePersona(odontologo),
          motivo: c.motivo ?? cita?.get('motivo') ?? null,
          notas: c.observaciones,
          procedimientos,
          diagnosticos: c.diagnosticos.map(diagnosticoADocumento),
          receta: c.receta && {
            fecha_emision: FieldValue.serverTimestamp(),
            indicaciones: c.receta.indicaciones,
            items: itemsDeReceta(c.receta.items, medicamentos),
          },
          total,
          estado_pago: total > 0 ? 'pendiente' : 'pagado',
          pagos: [],
        });
        if (cita) {
          t.update(cita.ref, {
            estado: 'atendida',
            odontologo: copiaDePersona(odontologo),
            ...(c.motivo && { motivo: c.motivo }),
          });
        }
        return ref.id;
      });
      return obtenerConsulta(id);
    },

    async agregarDiagnostico(consultaId, diagnostico) {
      await enTransaccion(db, async (t) => {
        const snap = await exigirConsultaEditable(t, consultaId);
        const actuales = snap.get('diagnosticos') ?? [];
        if (diagnostico.tipo === 'principal' && actuales.some((d) => d.tipo === 'principal')) {
          throw new Conflicto('La consulta ya tiene un diagnóstico principal');
        }
        t.update(snap.ref, { diagnosticos: [...actuales, diagnosticoADocumento(diagnostico)] });
      });
      return obtenerConsulta(consultaId);
    },

    // Crea la receta si la consulta aún no tiene, o le agrega los medicamentos.
    async recetar(consultaId, receta) {
      await enTransaccion(db, async (t) => {
        const snap = await exigirConsultaEditable(t, consultaId);
        const medicamentos = await leerCatalogo(t, col('medicamentos'), receta.items.map((i) => i.medicamentoId), 'medicamento');

        const actual = snap.get('receta');
        const recetados = new Set((actual?.items ?? []).map((i) => i.medicamento_id));
        if (receta.items.some((i) => recetados.has(i.medicamentoId))) {
          throw new Conflicto('Ese medicamento ya está en la receta');
        }
        t.update(snap.ref, {
          receta: {
            fecha_emision: actual?.fecha_emision ?? FieldValue.serverTimestamp(),
            indicaciones: receta.indicaciones ?? actual?.indicaciones ?? null,
            items: [...(actual?.items ?? []), ...itemsDeReceta(receta.items, medicamentos)],
          },
        });
      });
      return obtenerConsulta(consultaId);
    },

    async obtenerHistorial(pacienteId) {
      const paciente = await col('pacientes').doc(pacienteId).get();
      if (!paciente.exists) throw new NoEncontrado('Paciente no encontrado');

      // Se ordena aquí y no en Firestore para no requerir índices compuestos.
      const [consultasSnap, citasSnap] = await Promise.all([
        col('consultas').where('paciente_id', '==', pacienteId).get(),
        col('citas').where('paciente.id', '==', pacienteId).get(),
      ]);
      const consultas = consultasSnap.docs.map(aConsulta).sort((a, b) => b.fecha.localeCompare(a.fecha));

      // Historial dental: qué se le ha hecho a cada pieza y cuándo.
      const procedimientos = consultas.flatMap((c) => c.datosEspecificos.procedimientos.map((p) => ({
        fecha: c.fecha,
        procedimiento: p.nombre,
        piezaDental: p.piezaDental,
        observaciones: p.observaciones,
      })));

      const total = redondear(consultas.reduce((s, c) => s + c.datosEspecificos.total, 0));
      const pagado = redondear(consultas.reduce(
        (s, c) => s + c.datosEspecificos.pagos.reduce((sp, p) => sp + p.monto, 0),
        0,
      ));

      const ahora = Date.now();
      const proximasCitas = citasSnap.docs
        .filter((c) => c.get('estado') === 'programada' && c.get('fecha_hora')?.toMillis() >= ahora)
        .sort((a, b) => a.get('fecha_hora').toMillis() - b.get('fecha_hora').toMillis())
        .map((c) => ({
          id: c.id,
          fechaHora: timestampATexto(c.get('fecha_hora'), zonaHoraria),
          duracionMin: c.get('duracion_min') ?? null,
          motivo: c.get('motivo') ?? null,
          odontologo: nombreCompleto(c.get('odontologo')),
        }));

      return {
        paciente: documentoAPaciente(paciente, zonaHoraria),
        consultas,
        extras: {
          procedimientos,
          cuenta: { total, pagado, saldoPendiente: redondear(total - pagado) },
          proximasCitas,
        },
      };
    },
  };
}
