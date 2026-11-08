import { DURACION_POR_DEFECTO, ESTADOS_PENDIENTES, exigirHorarioLibre } from '../../../../dominio/cita.js';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { exigirPacienteActivo } from './pacientes.js';

// El pediátrico no guarda la duración de la cita: se asume DURACION_POR_DEFECTO.

const SELECT_CITA = `
  SELECT ci.id_cita, ci.fecha_hora_programada, ci.estado_cita, ci.motivo_cita,
         p.id_paciente, CONCAT(p.nombres, ' ', p.apellidos) AS paciente,
         m.id_medico, CONCAT(m.nombres, ' ', m.apellidos) AS medico
  FROM cita ci
  JOIN paciente p ON p.id_paciente = ci.paciente_fk
  JOIN medico m   ON m.id_medico = ci.medico_fk`;

const filaACita = (f) => ({
  id: String(f.id_cita),
  fechaHora: f.fecha_hora_programada,
  duracionMin: null,
  estado: f.estado_cita,
  motivo: f.motivo_cita,
  paciente: { id: String(f.id_paciente), nombre: f.paciente },
  medico: { id: String(f.id_medico), nombre: f.medico },
});

async function obtenerCita(cx, citaId) {
  const [filas] = await cx.query(`${SELECT_CITA} WHERE ci.id_cita = ?`, [citaId]);
  if (filas.length === 0) throw new NoEncontrado('Cita no encontrada');
  return filaACita(filas[0]);
}

/**
 * Bloquea al médico (dos recepcionistas no pueden darle la misma hora a la vez)
 * y verifica que no tenga otra cita pendiente que se cruce con la nueva hora.
 */
async function exigirMedicoLibre(cx, medicoId, fechaHora, citaExcluida = 0) {
  const [medicos] = await cx.query('SELECT activo FROM medico WHERE id_medico = ? FOR UPDATE', [medicoId]);
  if (medicos.length === 0) throw new NoEncontrado('Médico no encontrado');
  if (!medicos[0].activo) throw new Conflicto('El médico no está activo');

  const [citas] = await cx.query(
    `SELECT fecha_hora_programada FROM cita
     WHERE medico_fk = ? AND estado_cita IN (?) AND id_cita <> ?
       AND fecha_hora_programada > ? - INTERVAL 1 DAY AND fecha_hora_programada < ? + INTERVAL 1 DAY`,
    [medicoId, ESTADOS_PENDIENTES, citaExcluida, fechaHora, fechaHora],
  );
  exigirHorarioLibre(
    citas.map((c) => ({ fechaHora: c.fecha_hora_programada, duracionMin: DURACION_POR_DEFECTO })),
    { fechaHora, duracionMin: DURACION_POR_DEFECTO },
  );
}

/** Bloquea la cita y verifica que todavía se pueda cambiar. */
async function exigirCitaPendiente(cx, citaId) {
  const [filas] = await cx.query('SELECT medico_fk, estado_cita FROM cita WHERE id_cita = ? FOR UPDATE', [citaId]);
  if (filas.length === 0) throw new NoEncontrado('Cita no encontrada');
  if (!ESTADOS_PENDIENTES.includes(filas[0].estado_cita)) throw new Conflicto(`La cita ya está ${filas[0].estado_cita}`);
  return filas[0];
}

export function crearRepositorioAgenda(pool) {
  return {
    async citasDelMedico(medicoId, fecha) {
      const [filas] = await pool.query(
        `${SELECT_CITA}
         WHERE ci.medico_fk = ? AND ci.fecha_hora_programada >= ?
           AND ci.fecha_hora_programada < ? + INTERVAL 1 DAY
         ORDER BY ci.fecha_hora_programada`,
        [medicoId, fecha, fecha],
      );
      return filas.map(filaACita);
    },

    async citasDelPaciente(pacienteId) {
      const [filas] = await pool.query(
        `${SELECT_CITA}
         WHERE ci.paciente_fk = ? AND ci.estado_cita IN (?) AND ci.fecha_hora_programada >= CURDATE()
         ORDER BY ci.fecha_hora_programada`,
        [pacienteId, ESTADOS_PENDIENTES],
      );
      return filas.map(filaACita);
    },

    agendar(pacienteId, cita) {
      return enTransaccion(pool, async (cx) => {
        await exigirPacienteActivo(cx, pacienteId);
        await exigirMedicoLibre(cx, cita.medicoId, cita.fechaHora);
        const [res] = await cx.query(
          `INSERT INTO cita (paciente_fk, medico_fk, fecha_hora_programada, motivo_cita)
           VALUES (?, ?, ?, ?)`,
          [pacienteId, cita.medicoId, cita.fechaHora, cita.motivo],
        );
        return obtenerCita(cx, res.insertId);
      });
    },

    reprogramar(citaId, { fechaHora }) {
      return enTransaccion(pool, async (cx) => {
        const actual = await exigirCitaPendiente(cx, citaId);
        await exigirMedicoLibre(cx, actual.medico_fk, fechaHora, citaId);
        await cx.query('UPDATE cita SET fecha_hora_programada = ? WHERE id_cita = ?', [fechaHora, citaId]);
        return obtenerCita(cx, citaId);
      });
    },

    cancelar(citaId) {
      return enTransaccion(pool, async (cx) => {
        await exigirCitaPendiente(cx, citaId);
        await cx.query(`UPDATE cita SET estado_cita = 'cancelada' WHERE id_cita = ?`, [citaId]);
        return obtenerCita(cx, citaId);
      });
    },
  };
}
