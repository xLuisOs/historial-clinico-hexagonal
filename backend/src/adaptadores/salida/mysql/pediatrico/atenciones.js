import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, traducirError } from '../conexion.js';
import { exigirPacienteActivo, filaAPaciente, SELECT_PACIENTE } from './pacientes.js';

const MENSAJES_RECETA = {
  duplicado: 'Ese medicamento ya está en la receta',
  referencia: 'El medicamento indicado no existe en el catálogo',
};

// ------------------------------------------------------------------ lectura

/** Carga consultas completas (diagnósticos + receta) con 3 consultas en lugar de N+1. */
async function cargarConsultas(cx, where, params) {
  const [filas] = await cx.query(
    `SELECT co.id_consulta, co.fecha_hora_real, co.peso_kg, co.talla_cm,
            co.perimetro_cefalico_cm, co.observaciones,
            ci.id_cita, ci.motivo_cita,
            m.id_medico, CONCAT(m.nombres, ' ', m.apellidos) AS medico_nombre
     FROM consulta co
     JOIN cita ci  ON ci.id_cita = co.cita_fk
     JOIN medico m ON m.id_medico = ci.medico_fk
     WHERE ${where}
     ORDER BY co.fecha_hora_real DESC`,
    params,
  );
  if (filas.length === 0) return [];

  const ids = filas.map((f) => f.id_consulta);
  const [diagnosticos] = await cx.query(
    `SELECT id_diagnostico, consulta_fk, codigo_cie10, descripcion, tipo
     FROM diagnostico WHERE consulta_fk IN (?)
     ORDER BY tipo = 'principal' DESC, id_diagnostico`,
    [ids],
  );
  const [items] = await cx.query(
    `SELECT r.id_receta, r.consulta_fk, r.fecha_emision, r.indicaciones_generales,
            d.id_detalle_receta, d.dosis, d.frecuencia, d.duracion_dias, d.via, d.indicaciones,
            md.id_medicamento, md.nombre_generico, md.presentacion
     FROM receta r
     LEFT JOIN detalle_receta d ON d.receta_fk = r.id_receta
     LEFT JOIN medicamento md   ON md.id_medicamento = d.medicamento_fk
     WHERE r.consulta_fk IN (?)
     ORDER BY d.id_detalle_receta`,
    [ids],
  );

  return filas.map((f) => {
    const filasReceta = items.filter((i) => i.consulta_fk === f.id_consulta);
    return {
      id: String(f.id_consulta),
      citaId: String(f.id_cita),
      fecha: f.fecha_hora_real,
      motivo: f.motivo_cita,
      observaciones: f.observaciones,
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
          .filter((i) => i.id_detalle_receta !== null)
          .map((i) => ({
            id: String(i.id_detalle_receta),
            medicamentoId: String(i.id_medicamento),
            medicamento: `${i.nombre_generico} — ${i.presentacion}`,
            dosis: i.dosis,
            frecuencia: i.frecuencia,
            duracionDias: i.duracion_dias,
            via: i.via,
            indicaciones: i.indicaciones,
          })),
      },
      datosEspecificos: {
        pesoKg: f.peso_kg,
        tallaCm: f.talla_cm,
        perimetroCefalicoCm: f.perimetro_cefalico_cm,
      },
    };
  });
}

async function obtenerConsulta(cx, consultaId) {
  const [consulta] = await cargarConsultas(cx, 'co.id_consulta = ?', [consultaId]);
  if (!consulta) throw new NoEncontrado('Consulta no encontrada');
  return consulta;
}

/** Esquema de vacunación del paciente: cada dosis aplicada, pendiente o próxima. */
async function cargarEsquemaVacunas(cx, pacienteId) {
  const [filas] = await cx.query(
    `SELECT v.id_vacuna, v.nombre, ed.numero_dosis, v.dosis_total, ed.edad_recomendada_meses,
            va.fecha_aplicacion, va.lote,
            TIMESTAMPDIFF(MONTH, p.fecha_nacimiento, CURDATE()) AS edad_meses
     FROM esquema_dosis ed
     JOIN vacuna v   ON v.id_vacuna = ed.vacuna_fk
     JOIN paciente p ON p.id_paciente = ?
     LEFT JOIN vacuna_aplicada va
            ON va.paciente_fk = p.id_paciente
           AND va.vacuna_fk = ed.vacuna_fk
           AND va.numero_dosis = ed.numero_dosis
     ORDER BY ed.edad_recomendada_meses, v.nombre, ed.numero_dosis`,
    [pacienteId],
  );
  return filas.map((f) => ({
    vacunaId: String(f.id_vacuna),
    vacuna: f.nombre,
    dosis: `${f.numero_dosis} de ${f.dosis_total}`,
    edadRecomendadaMeses: f.edad_recomendada_meses,
    estado: f.fecha_aplicacion ? 'aplicada' : f.edad_meses >= f.edad_recomendada_meses ? 'pendiente' : 'proxima',
    fechaAplicacion: f.fecha_aplicacion,
    lote: f.lote,
  }));
}

// ---------------------------------------------------------------- escritura

async function exigirConsultaEditable(cx, consultaId) {
  const [filas] = await cx.query(
    `SELECT p.id_paciente FROM consulta co
     JOIN cita ci    ON ci.id_cita = co.cita_fk
     JOIN paciente p ON p.id_paciente = ci.paciente_fk
     WHERE co.id_consulta = ?`,
    [consultaId],
  );
  if (filas.length === 0) throw new NoEncontrado('Consulta no encontrada');
  await exigirPacienteActivo(cx, filas[0].id_paciente);
}

async function insertarDiagnosticos(cx, consultaId, diagnosticos) {
  await cx.query(
    'INSERT INTO diagnostico (consulta_fk, codigo_cie10, descripcion, tipo) VALUES ?',
    [diagnosticos.map((d) => [consultaId, d.codigoCie10, d.descripcion, d.tipo])],
  ).catch((e) => { throw traducirError(e, { duplicado: 'La consulta ya tiene un diagnóstico principal' }); });
}

async function insertarReceta(cx, consultaId, receta) {
  const [existente] = await cx.query(
    'SELECT id_receta FROM receta WHERE consulta_fk = ? FOR UPDATE',
    [consultaId],
  );
  let recetaId = existente[0]?.id_receta;
  if (recetaId) {
    if (receta.indicaciones) {
      await cx.query('UPDATE receta SET indicaciones_generales = ? WHERE id_receta = ?', [receta.indicaciones, recetaId]);
    }
  } else {
    const [res] = await cx.query(
      'INSERT INTO receta (consulta_fk, indicaciones_generales) VALUES (?, ?)',
      [consultaId, receta.indicaciones],
    );
    recetaId = res.insertId;
  }
  await cx.query(
    `INSERT INTO detalle_receta (receta_fk, medicamento_fk, dosis, frecuencia, duracion_dias, via, indicaciones)
     VALUES ?`,
    [receta.items.map((i) => [recetaId, i.medicamentoId, i.dosis, i.frecuencia, i.duracionDias, i.via, i.indicaciones])],
  ).catch((e) => { throw traducirError(e, MENSAJES_RECETA); });
}

export function crearRepositorioAtenciones(pool) {
  return {
    // Cita + consulta + diagnósticos + receta: o se guarda todo, o nada.
    registrarConsulta(pacienteId, c) {
      return enTransaccion(pool, async (cx) => {
        await exigirPacienteActivo(cx, pacienteId);

        let citaId = c.citaId;
        if (citaId) {
          const [citas] = await cx.query(
            'SELECT paciente_fk, estado_cita FROM cita WHERE id_cita = ? FOR UPDATE',
            [citaId],
          );
          if (citas.length === 0 || String(citas[0].paciente_fk) !== String(pacienteId)) {
            throw new NoEncontrado('La cita no existe o no es de este paciente');
          }
          if (!['programada', 'confirmada'].includes(citas[0].estado_cita)) {
            throw new Conflicto(`La cita está ${citas[0].estado_cita}; no se puede atender`);
          }
          await cx.query(
            `UPDATE cita SET estado_cita = 'atendida', medico_fk = ?,
                             motivo_cita = COALESCE(?, motivo_cita)
             WHERE id_cita = ?`,
            [c.medicoId, c.motivo, citaId],
          );
        } else {
          // Paciente sin cita previa: se registra la cita ya atendida.
          const [res] = await cx.query(
            `INSERT INTO cita (paciente_fk, medico_fk, fecha_hora_programada, motivo_cita, estado_cita)
             VALUES (?, ?, NOW(), ?, 'atendida')`,
            [pacienteId, c.medicoId, c.motivo],
          );
          citaId = res.insertId;
        }

        const d = c.datosEspecificos;
        const [res] = await cx.query(
          `INSERT INTO consulta (cita_fk, peso_kg, talla_cm, perimetro_cefalico_cm, observaciones)
           VALUES (?, ?, ?, ?, ?)`,
          [citaId, d.pesoKg, d.tallaCm, d.perimetroCefalicoCm, c.observaciones],
        );
        const consultaId = res.insertId;

        await insertarDiagnosticos(cx, consultaId, c.diagnosticos);
        if (c.receta) await insertarReceta(cx, consultaId, c.receta);

        return obtenerConsulta(cx, consultaId);
      });
    },

    agregarDiagnostico(consultaId, diagnostico) {
      return enTransaccion(pool, async (cx) => {
        await exigirConsultaEditable(cx, consultaId);
        await insertarDiagnosticos(cx, consultaId, [diagnostico]);
        return obtenerConsulta(cx, consultaId);
      });
    },

    recetar(consultaId, receta) {
      return enTransaccion(pool, async (cx) => {
        await exigirConsultaEditable(cx, consultaId);
        await insertarReceta(cx, consultaId, receta);
        return obtenerConsulta(cx, consultaId);
      });
    },

    async obtenerHistorial(pacienteId) {
      const [filas] = await pool.query(`${SELECT_PACIENTE} WHERE p.id_paciente = ?`, [pacienteId]);
      if (filas.length === 0) throw new NoEncontrado('Paciente no encontrado');

      const consultas = await cargarConsultas(pool, 'ci.paciente_fk = ?', [pacienteId]);
      const crecimiento = consultas
        .filter((c) => c.datosEspecificos.pesoKg || c.datosEspecificos.tallaCm)
        .map((c) => ({ fecha: c.fecha, ...c.datosEspecificos }))
        .reverse();

      return {
        paciente: filaAPaciente(filas[0]),
        consultas,
        extras: {
          crecimiento,
          vacunas: await cargarEsquemaVacunas(pool, pacienteId),
        },
      };
    },
  };
}
