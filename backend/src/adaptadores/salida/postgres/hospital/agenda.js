import { DURACION_POR_DEFECTO, ESTADOS_PENDIENTES, exigirHorarioLibre, exigirTransicion } from '../../../../dominio/cita.js';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { exigirPacienteActivo, idNumerico } from './pacientes.js';

// El hospital no guarda la duración de la cita: se asume DURACION_POR_DEFECTO.

const SELECT_CITA = `
  SELECT c.id_cita, c.fecha_hora, c.estado, c.motivo,
         p.id_paciente, p.nombres || ' ' || p.apellidos AS paciente,
         m.id_medico, m.nombres || ' ' || m.apellidos AS medico
  FROM cita c
  JOIN paciente p ON p.id_paciente = c.paciente_fk
  JOIN medico m   ON m.id_medico = c.medico_fk`;

const filaACita = (f) => ({
  id: String(f.id_cita),
  fechaHora: f.fecha_hora,
  duracionMin: null,
  estado: f.estado,
  motivo: f.motivo,
  paciente: { id: String(f.id_paciente), nombre: f.paciente },
  medico: { id: String(f.id_medico), nombre: f.medico },
});

async function obtenerCita(cx, citaId) {
  const { rows } = await cx.query(`${SELECT_CITA} WHERE c.id_cita = $1`, [citaId]);
  if (rows.length === 0) throw new NoEncontrado('Cita no encontrada');
  return filaACita(rows[0]);
}

/**
 * Bloquea al médico (dos recepcionistas no pueden darle la misma hora a la vez)
 * y verifica que no tenga otra cita pendiente que se cruce con la nueva hora.
 */
async function exigirMedicoLibre(cx, medicoId, fechaHora, citaExcluida = 0) {
  const { rows } = await cx.query('SELECT estado FROM medico WHERE id_medico = $1 FOR UPDATE', [medicoId]);
  if (rows.length === 0) throw new NoEncontrado('Médico no encontrado');
  if (rows[0].estado !== 'activo') throw new Conflicto('El médico no está activo');

  const { rows: citas } = await cx.query(
    `SELECT fecha_hora FROM cita
     WHERE medico_fk = $1 AND estado = ANY($2) AND id_cita <> $3
       AND fecha_hora > $4::timestamp - interval '1 day' AND fecha_hora < $4::timestamp + interval '1 day'`,
    [medicoId, ESTADOS_PENDIENTES, citaExcluida, fechaHora],
  );
  exigirHorarioLibre(
    citas.map((c) => ({ fechaHora: c.fecha_hora, duracionMin: DURACION_POR_DEFECTO })),
    { fechaHora, duracionMin: DURACION_POR_DEFECTO },
  );
}

/** Bloquea la cita y verifica que todavía se pueda cambiar. */
async function exigirCitaPendiente(cx, citaId) {
  const { rows } = await cx.query('SELECT medico_fk, estado FROM cita WHERE id_cita = $1 FOR UPDATE', [citaId]);
  if (rows.length === 0) throw new NoEncontrado('Cita no encontrada');
  if (!ESTADOS_PENDIENTES.includes(rows[0].estado)) throw new Conflicto(`La cita ya está ${rows[0].estado}`);
  return rows[0];
}

export function crearRepositorioAgenda(pool) {
  return {
    async citasDelMedico(medicoId, fecha) {
      const { rows } = await pool.query(
        `${SELECT_CITA}
         WHERE c.medico_fk = $1 AND c.fecha_hora >= $2::date AND c.fecha_hora < $2::date + 1
         ORDER BY c.fecha_hora`,
        [idNumerico(medicoId, 'Médico'), fecha],
      );
      return rows.map(filaACita);
    },

    async citasDelPaciente(pacienteId) {
      const { rows } = await pool.query(
        `${SELECT_CITA}
         WHERE c.paciente_fk = $1 AND c.estado = ANY($2) AND c.fecha_hora >= current_date
         ORDER BY c.fecha_hora`,
        [idNumerico(pacienteId, 'Paciente'), ESTADOS_PENDIENTES],
      );
      return rows.map(filaACita);
    },

    agendar(pacienteId, cita) {
      return enTransaccion(pool, async (cx) => {
        const idPaciente = idNumerico(pacienteId, 'Paciente');
        const idMedico = idNumerico(cita.medicoId, 'Médico');
        await exigirPacienteActivo(cx, idPaciente);
        await exigirMedicoLibre(cx, idMedico, cita.fechaHora);
        const { rows: [nueva] } = await cx.query(
          `INSERT INTO cita (paciente_fk, medico_fk, fecha_hora, motivo)
           VALUES ($1, $2, $3, $4) RETURNING id_cita`,
          [idPaciente, idMedico, cita.fechaHora, cita.motivo],
        );
        return obtenerCita(cx, nueva.id_cita);
      });
    },

    reprogramar(citaId, { fechaHora }) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(citaId, 'Cita');
        const actual = await exigirCitaPendiente(cx, id);
        await exigirMedicoLibre(cx, actual.medico_fk, fechaHora, id);
        await cx.query('UPDATE cita SET fecha_hora = $1 WHERE id_cita = $2', [fechaHora, id]);
        return obtenerCita(cx, id);
      });
    },

    marcarEstado(citaId, estado) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(citaId, 'Cita');
        const { rows } = await cx.query('SELECT estado, fecha_hora FROM cita WHERE id_cita = $1 FOR UPDATE', [id]);
        if (rows.length === 0) throw new NoEncontrado('Cita no encontrada');
        exigirTransicion({ estado: rows[0].estado, fechaHora: rows[0].fecha_hora }, estado);
        await cx.query('UPDATE cita SET estado = $1 WHERE id_cita = $2', [estado, id]);
        return obtenerCita(cx, id);
      });
    },

    cancelar(citaId) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(citaId, 'Cita');
        await exigirCitaPendiente(cx, id);
        await cx.query(`UPDATE cita SET estado = 'cancelada' WHERE id_cita = $1`, [id]);
        return obtenerCita(cx, id);
      });
    },
  };
}
