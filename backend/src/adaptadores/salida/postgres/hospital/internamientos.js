import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { cargarInternamientos } from './atenciones.js';
import { exigirPacienteActivo, idNumerico } from './pacientes.js';

// Internamientos del hospital. Cada operación toca varias tablas (internamiento,
// internamiento_medico, habitacion, tratamiento) dentro de una sola transacción.

async function exigirMedicoActivo(cx, medicoId) {
  const { rows } = await cx.query('SELECT estado FROM medico WHERE id_medico = $1 FOR SHARE', [medicoId]);
  if (rows.length === 0) throw new NoEncontrado('Médico no encontrado');
  if (rows[0].estado !== 'activo') throw new Conflicto('El médico no está activo');
}

/** Bloquea el internamiento y verifica que siga abierto. */
async function exigirInternamientoActivo(cx, internamientoId) {
  const { rows } = await cx.query(
    `SELECT paciente_fk, habitacion_fk, medico_responsable_fk, estado
     FROM internamiento WHERE id_internamiento = $1 FOR UPDATE`,
    [internamientoId],
  );
  if (rows.length === 0) throw new NoEncontrado('Internamiento no encontrado');
  if (rows[0].estado !== 'activo') throw new Conflicto('El paciente ya fue dado de alta');
  return rows[0];
}

async function obtenerInternamiento(cx, pacienteId, internamientoId) {
  const lista = await cargarInternamientos(cx, pacienteId);
  return lista.find((i) => i.id === String(internamientoId));
}

/** Cierra la asignación vigente del médico a cargo. */
const cerrarAsignacion = (cx, internamientoId) => cx.query(
  'UPDATE internamiento_medico SET fecha_fin = localtimestamp WHERE internamiento_fk = $1 AND fecha_fin IS NULL',
  [internamientoId],
);

export function crearRepositorioInternamientos(pool) {
  return {
    async habitacionesDisponibles() {
      const { rows } = await pool.query(
        `SELECT h.id_habitacion, h.numero, h.tipo, d.nombre AS departamento
         FROM habitacion h LEFT JOIN departamento d ON d.id_departamento = h.departamento_fk
         WHERE h.estado = 'disponible' ORDER BY h.numero`,
      );
      return rows.map((h) => ({ id: String(h.id_habitacion), numero: h.numero, tipo: h.tipo, departamento: h.departamento }));
    },

    internar(pacienteId, ingreso) {
      return enTransaccion(pool, async (cx) => {
        const idPaciente = idNumerico(pacienteId, 'Paciente');
        const idHabitacion = idNumerico(ingreso.habitacionId, 'Habitación');
        const idMedico = idNumerico(ingreso.medicoId, 'Médico');
        await exigirPacienteActivo(cx, idPaciente);

        const { rows: abiertos } = await cx.query(
          `SELECT 1 FROM internamiento WHERE paciente_fk = $1 AND estado = 'activo'`,
          [idPaciente],
        );
        if (abiertos.length > 0) throw new Conflicto('El paciente ya está internado');

        const { rows: habitaciones } = await cx.query(
          'SELECT numero, estado FROM habitacion WHERE id_habitacion = $1 FOR UPDATE',
          [idHabitacion],
        );
        if (habitaciones.length === 0) throw new NoEncontrado('Habitación no encontrada');
        if (habitaciones[0].estado !== 'disponible') {
          throw new Conflicto(`La habitación ${habitaciones[0].numero} está ${habitaciones[0].estado}`);
        }
        await exigirMedicoActivo(cx, idMedico);

        const { rows: [nuevo] } = await cx.query(
          `INSERT INTO internamiento (paciente_fk, habitacion_fk, medico_responsable_fk, motivo_ingreso, diagnostico_ingreso)
           VALUES ($1, $2, $3, $4, $5) RETURNING id_internamiento`,
          [idPaciente, idHabitacion, idMedico, ingreso.motivoIngreso, ingreso.diagnosticoIngreso],
        );
        await cx.query(
          `INSERT INTO internamiento_medico (internamiento_fk, medico_fk, motivo_cambio) VALUES ($1, $2, 'Ingreso')`,
          [nuevo.id_internamiento, idMedico],
        );
        await cx.query(`UPDATE habitacion SET estado = 'ocupada' WHERE id_habitacion = $1`, [idHabitacion]);
        return obtenerInternamiento(cx, idPaciente, nuevo.id_internamiento);
      });
    },

    cambiarMedico(internamientoId, { medicoId, motivoCambio }) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(internamientoId, 'Internamiento');
        const idMedico = idNumerico(medicoId, 'Médico');
        const actual = await exigirInternamientoActivo(cx, id);
        if (actual.medico_responsable_fk === idMedico) throw new Conflicto('Ese médico ya está a cargo');
        await exigirMedicoActivo(cx, idMedico);

        await cerrarAsignacion(cx, id);
        await cx.query(
          'INSERT INTO internamiento_medico (internamiento_fk, medico_fk, motivo_cambio) VALUES ($1, $2, $3)',
          [id, idMedico, motivoCambio],
        );
        await cx.query('UPDATE internamiento SET medico_responsable_fk = $1 WHERE id_internamiento = $2', [idMedico, id]);
        return obtenerInternamiento(cx, actual.paciente_fk, id);
      });
    },

    agregarTratamiento(internamientoId, t) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(internamientoId, 'Internamiento');
        const actual = await exigirInternamientoActivo(cx, id);
        await cx.query(
          `INSERT INTO tratamiento (internamiento_fk, descripcion, fecha_inicio, fecha_fin, indicaciones)
           VALUES ($1, $2, COALESCE($3::date, current_date), $4, $5)`,
          [id, t.descripcion, t.fechaInicio, t.fechaFin, t.indicaciones],
        );
        return obtenerInternamiento(cx, actual.paciente_fk, id);
      });
    },

    darDeAlta(internamientoId, { diagnosticoAlta }) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(internamientoId, 'Internamiento');
        const actual = await exigirInternamientoActivo(cx, id);
        await cx.query(
          `UPDATE internamiento SET estado = 'alta', fecha_alta = localtimestamp, diagnostico_alta = $1
           WHERE id_internamiento = $2`,
          [diagnosticoAlta, id],
        );
        await cerrarAsignacion(cx, id);
        await cx.query(`UPDATE habitacion SET estado = 'disponible' WHERE id_habitacion = $1`, [actual.habitacion_fk]);
        return obtenerInternamiento(cx, actual.paciente_fk, id);
      });
    },
  };
}
