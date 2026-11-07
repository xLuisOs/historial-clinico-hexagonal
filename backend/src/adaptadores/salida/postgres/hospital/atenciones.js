import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, traducirError } from '../conexion.js';
import { exigirPacienteActivo, filaAPaciente, idNumerico, SELECT_PACIENTE } from './pacientes.js';

const MENSAJES_RECETA = {
  duplicado: 'Ese medicamento ya está en la receta',
  referencia: 'El medicamento indicado no existe en el catálogo',
};

// ------------------------------------------------------------------ lectura

/** Carga consultas completas (diagnósticos, receta, tratamientos) con 4 consultas en lugar de N+1. */
async function cargarConsultas(cx, where, params) {
  const { rows: filas } = await cx.query(
    `SELECT co.id_consulta, co.cita_fk, co.fecha_hora_atencion, co.motivo_consulta, co.es_emergencia,
            m.id_medico, m.nombres || ' ' || m.apellidos AS medico_nombre
     FROM consulta co
     JOIN medico m ON m.id_medico = co.medico_fk
     WHERE ${where}
     ORDER BY co.fecha_hora_atencion DESC`,
    params,
  );
  if (filas.length === 0) return [];

  const ids = filas.map((f) => f.id_consulta);
  const [{ rows: diagnosticos }, { rows: items }, { rows: tratamientos }] = await Promise.all([
    cx.query(
      `SELECT id_diagnostico, consulta_fk, codigo_cie10, descripcion, tipo
       FROM diagnostico WHERE consulta_fk = ANY($1)
       ORDER BY tipo = 'principal' DESC, id_diagnostico`,
      [ids],
    ),
    cx.query(
      `SELECT r.id_receta, r.consulta_fk, r.fecha_emision, r.indicaciones AS indicaciones_generales,
              d.id_detalle, d.dosis, d.frecuencia, d.duracion_dias, d.via, d.indicaciones,
              md.id_medicamento, md.nombre, md.presentacion
       FROM receta r
       LEFT JOIN detalle_receta d ON d.receta_fk = r.id_receta
       LEFT JOIN medicamento md   ON md.id_medicamento = d.medicamento_fk
       WHERE r.consulta_fk = ANY($1)
       ORDER BY d.id_detalle`,
      [ids],
    ),
    cx.query(
      `SELECT id_tratamiento, consulta_fk, descripcion, fecha_inicio, fecha_fin, indicaciones
       FROM tratamiento WHERE consulta_fk = ANY($1)
       ORDER BY id_tratamiento`,
      [ids],
    ),
  ]);

  return filas.map((f) => {
    const filasReceta = items.filter((i) => i.consulta_fk === f.id_consulta);
    return {
      id: String(f.id_consulta),
      citaId: f.cita_fk === null ? null : String(f.cita_fk),
      fecha: f.fecha_hora_atencion,
      motivo: f.motivo_consulta,
      observaciones: null, // el hospital registra la atención como diagnósticos y tratamientos
      medico: { id: String(f.id_medico), nombre: f.medico_nombre },
      diagnosticos: diagnosticos
        .filter((d) => d.consulta_fk === f.id_consulta)
        .map((d) => ({
          id: String(d.id_diagnostico),
          codigoCie10: d.codigo_cie10,
          descripcion: d.descripcion,
          tipo: d.tipo,
        })),
      receta: filasReceta.length === 0 ? null : {
        id: String(filasReceta[0].id_receta),
        fechaEmision: filasReceta[0].fecha_emision,
        indicaciones: filasReceta[0].indicaciones_generales,
        items: filasReceta
          .filter((i) => i.id_detalle !== null)
          .map((i) => ({
            id: String(i.id_detalle),
            medicamentoId: String(i.id_medicamento),
            medicamento: `${i.nombre} — ${i.presentacion}`,
            dosis: i.dosis,
            frecuencia: i.frecuencia,
            duracionDias: i.duracion_dias,
            via: i.via,
            indicaciones: i.indicaciones,
          })),
      },
      datosEspecificos: {
        esEmergencia: f.es_emergencia,
        tratamientos: tratamientos
          .filter((t) => t.consulta_fk === f.id_consulta)
          .map((t) => ({
            id: String(t.id_tratamiento),
            descripcion: t.descripcion,
            fechaInicio: t.fecha_inicio,
            fechaFin: t.fecha_fin,
            indicaciones: t.indicaciones,
          })),
      },
    };
  });
}

async function obtenerConsulta(cx, consultaId) {
  const [consulta] = await cargarConsultas(cx, 'co.id_consulta = $1', [consultaId]);
  if (!consulta) throw new NoEncontrado('Consulta no encontrada');
  return consulta;
}

/** Internamientos del paciente, con sus tratamientos y el historial de médicos a cargo. */
async function cargarInternamientos(cx, pacienteId) {
  const { rows: filas } = await cx.query(
    `SELECT i.id_internamiento, i.fecha_ingreso, i.fecha_alta, i.estado, i.motivo_ingreso,
            i.diagnostico_ingreso, i.diagnostico_alta, h.numero AS habitacion,
            m.nombres || ' ' || m.apellidos AS medico_responsable
     FROM internamiento i
     JOIN habitacion h ON h.id_habitacion = i.habitacion_fk
     JOIN medico m     ON m.id_medico = i.medico_responsable_fk
     WHERE i.paciente_fk = $1
     ORDER BY i.fecha_ingreso DESC`,
    [pacienteId],
  );
  if (filas.length === 0) return [];

  const ids = filas.map((f) => f.id_internamiento);
  const [{ rows: medicos }, { rows: tratamientos }] = await Promise.all([
    cx.query(
      `SELECT im.internamiento_fk, m.nombres || ' ' || m.apellidos AS medico,
              im.fecha_inicio, im.fecha_fin, im.motivo_cambio
       FROM internamiento_medico im JOIN medico m ON m.id_medico = im.medico_fk
       WHERE im.internamiento_fk = ANY($1) ORDER BY im.fecha_inicio`,
      [ids],
    ),
    cx.query(
      `SELECT internamiento_fk, descripcion, fecha_inicio, fecha_fin, indicaciones
       FROM tratamiento WHERE internamiento_fk = ANY($1) ORDER BY id_tratamiento`,
      [ids],
    ),
  ]);

  return filas.map((f) => ({
    id: String(f.id_internamiento),
    fechaIngreso: f.fecha_ingreso,
    fechaAlta: f.fecha_alta,
    estado: f.estado,
    habitacion: f.habitacion,
    motivoIngreso: f.motivo_ingreso,
    diagnosticoIngreso: f.diagnostico_ingreso,
    diagnosticoAlta: f.diagnostico_alta,
    medicoResponsable: f.medico_responsable,
    medicosACargo: medicos
      .filter((m) => m.internamiento_fk === f.id_internamiento)
      .map(({ internamiento_fk, fecha_inicio, fecha_fin, motivo_cambio, ...m }) => ({
        ...m, fechaInicio: fecha_inicio, fechaFin: fecha_fin, motivoCambio: motivo_cambio,
      })),
    tratamientos: tratamientos
      .filter((t) => t.internamiento_fk === f.id_internamiento)
      .map(({ internamiento_fk, fecha_inicio, fecha_fin, ...t }) => ({ ...t, fechaInicio: fecha_inicio, fechaFin: fecha_fin })),
  }));
}

/** Facturas con lo pagado y el saldo de cada una. */
async function cargarFacturas(cx, pacienteId) {
  const { rows } = await cx.query(
    `SELECT f.id_factura, f.fecha_emision, f.total, f.estado,
            COALESCE((SELECT SUM(monto) FROM pago p WHERE p.factura_fk = f.id_factura), 0) AS pagado
     FROM factura f WHERE f.paciente_fk = $1
     ORDER BY f.fecha_emision DESC`,
    [pacienteId],
  );
  return rows.map((f) => ({
    id: String(f.id_factura),
    fechaEmision: f.fecha_emision,
    total: f.total,
    pagado: f.pagado,
    saldo: Math.round((f.total - f.pagado) * 100) / 100,
    estado: f.estado,
  }));
}

// ---------------------------------------------------------------- escritura

/** Bloquea la consulta y verifica que el historial de su paciente siga activo. */
async function exigirConsultaEditable(cx, consultaId) {
  const { rows } = await cx.query(
    'SELECT paciente_fk, medico_fk FROM consulta WHERE id_consulta = $1 FOR UPDATE',
    [consultaId],
  );
  if (rows.length === 0) throw new NoEncontrado('Consulta no encontrada');
  await exigirPacienteActivo(cx, rows[0].paciente_fk);
  return rows[0];
}

async function insertarDiagnosticos(cx, consultaId, diagnosticos) {
  for (const d of diagnosticos) {
    await cx.query(
      'INSERT INTO diagnostico (consulta_fk, codigo_cie10, descripcion, tipo) VALUES ($1, $2, $3, $4)',
      [consultaId, d.codigoCie10, d.descripcion, d.tipo],
    ).catch((e) => { throw traducirError(e, { duplicado: 'La consulta ya tiene un diagnóstico principal' }); });
  }
}

async function insertarReceta(cx, consultaId, medicoId, receta) {
  const { rows: existente } = await cx.query(
    'SELECT id_receta FROM receta WHERE consulta_fk = $1 FOR UPDATE',
    [consultaId],
  );
  let recetaId = existente[0]?.id_receta;
  if (recetaId) {
    if (receta.indicaciones) {
      await cx.query('UPDATE receta SET indicaciones = $1 WHERE id_receta = $2', [receta.indicaciones, recetaId]);
    }
  } else {
    const { rows: [nueva] } = await cx.query(
      'INSERT INTO receta (consulta_fk, medico_fk, indicaciones) VALUES ($1, $2, $3) RETURNING id_receta',
      [consultaId, medicoId, receta.indicaciones],
    );
    recetaId = nueva.id_receta;
  }
  for (const i of receta.items) {
    await cx.query(
      `INSERT INTO detalle_receta (receta_fk, medicamento_fk, dosis, frecuencia, duracion_dias, via, indicaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [recetaId, idNumerico(i.medicamentoId, 'Medicamento'), i.dosis, i.frecuencia, i.duracionDias, i.via, i.indicaciones],
    ).catch((e) => { throw traducirError(e, MENSAJES_RECETA); });
  }
}

export function crearRepositorioAtenciones(pool) {
  return {
    // Consulta + diagnósticos + tratamientos + receta + cita atendida: o se guarda todo, o nada.
    registrarConsulta(pacienteId, c) {
      return enTransaccion(pool, async (cx) => {
        const idPaciente = idNumerico(pacienteId, 'Paciente');
        await exigirPacienteActivo(cx, idPaciente);
        if (!c.medicoId) throw new Conflicto('El usuario no está asociado a un médico');

        let citaId = null;
        let motivo = c.motivo;
        if (c.citaId) {
          citaId = idNumerico(c.citaId, 'Cita');
          const { rows: citas } = await cx.query(
            'SELECT paciente_fk, estado, motivo FROM cita WHERE id_cita = $1 FOR UPDATE',
            [citaId],
          );
          if (citas.length === 0 || citas[0].paciente_fk !== idPaciente) {
            throw new NoEncontrado('La cita no existe o no es de este paciente');
          }
          if (!['programada', 'confirmada'].includes(citas[0].estado)) {
            throw new Conflicto(`La cita está ${citas[0].estado}; no se puede atender`);
          }
          await cx.query(
            `UPDATE cita SET estado = 'atendida', medico_fk = $1, motivo = COALESCE($2, motivo)
             WHERE id_cita = $3`,
            [c.medicoId, c.motivo, citaId],
          );
          motivo ??= citas[0].motivo;
        }

        const d = c.datosEspecificos;
        const { rows: [consulta] } = await cx.query(
          `INSERT INTO consulta (cita_fk, paciente_fk, medico_fk, motivo_consulta, es_emergencia)
           VALUES ($1, $2, $3, $4, $5) RETURNING id_consulta`,
          [citaId, idPaciente, c.medicoId, motivo, d.esEmergencia ?? false],
        );
        const consultaId = consulta.id_consulta;

        await insertarDiagnosticos(cx, consultaId, c.diagnosticos);
        for (const t of d.tratamientos ?? []) {
          await cx.query(
            `INSERT INTO tratamiento (consulta_fk, descripcion, fecha_inicio, fecha_fin, indicaciones)
             VALUES ($1, $2, COALESCE($3::date, current_date), $4, $5)`,
            [consultaId, t.descripcion, t.fechaInicio, t.fechaFin, t.indicaciones],
          );
        }
        if (c.receta) await insertarReceta(cx, consultaId, c.medicoId, c.receta);

        return obtenerConsulta(cx, consultaId);
      });
    },

    agregarDiagnostico(consultaId, diagnostico) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(consultaId, 'Consulta');
        await exigirConsultaEditable(cx, id);
        await insertarDiagnosticos(cx, id, [diagnostico]);
        return obtenerConsulta(cx, id);
      });
    },

    // La receta queda a nombre del médico que atendió la consulta.
    recetar(consultaId, receta) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(consultaId, 'Consulta');
        const consulta = await exigirConsultaEditable(cx, id);
        await insertarReceta(cx, id, consulta.medico_fk, receta);
        return obtenerConsulta(cx, id);
      });
    },

    async obtenerHistorial(pacienteId) {
      const id = idNumerico(pacienteId, 'Paciente');
      const { rows } = await pool.query(`${SELECT_PACIENTE} WHERE p.id_paciente = $1`, [id]);
      if (rows.length === 0) throw new NoEncontrado('Paciente no encontrado');

      const [consultas, internamientos, facturas, { rows: citas }] = await Promise.all([
        cargarConsultas(pool, 'co.paciente_fk = $1', [id]),
        cargarInternamientos(pool, id),
        cargarFacturas(pool, id),
        pool.query(
          `SELECT c.id_cita, c.fecha_hora, c.motivo, m.nombres || ' ' || m.apellidos AS medico
           FROM cita c JOIN medico m ON m.id_medico = c.medico_fk
           WHERE c.paciente_fk = $1 AND c.estado IN ('programada', 'confirmada') AND c.fecha_hora >= localtimestamp
           ORDER BY c.fecha_hora`,
          [id],
        ),
      ]);

      return {
        paciente: filaAPaciente(rows[0]),
        consultas,
        extras: {
          internamientos,
          facturas,
          proximasCitas: citas.map((c) => ({
            id: String(c.id_cita), fechaHora: c.fecha_hora, motivo: c.motivo, medico: c.medico,
          })),
        },
      };
    },
  };
}
