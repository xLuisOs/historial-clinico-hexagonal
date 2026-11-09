import { ESTADOS_PENDIENTES } from '../../../../dominio/cita.js';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { idNumerico } from './pacientes.js';

// Personal médico del hospital, administrado por el admin (ver dominio/medico.js).
// Cada operación que toca médico, especialidad y usuario va en UNA transacción.
// Los UNIQUE de la base (uq_medico_colegiado, uq_usuario_correo,
// uq_especialidad_nombre) son la última defensa; antes se revisa para dar un
// mensaje claro.

const SELECT_MEDICO = `
  SELECT m.id_medico, m.nombres, m.apellidos, m.numero_colegiado, m.telefono, m.estado,
         e.nombre AS especialidad, u.correo
  FROM medico m
  LEFT JOIN especialidad e ON e.id_especialidad = m.especialidad_fk
  LEFT JOIN usuario u      ON u.medico_fk = m.id_medico`;

const filaAMedico = (f) => ({
  id: String(f.id_medico),
  nombre: `${f.nombres} ${f.apellidos}`,
  nombres: f.nombres,
  apellidos: f.apellidos,
  numeroColegiado: f.numero_colegiado,
  especialidad: f.especialidad,
  telefono: f.telefono,
  correo: f.correo ?? null,
  activo: f.estado === 'activo',
});

async function leerMedico(cx, id) {
  const { rows: [fila] } = await cx.query(`${SELECT_MEDICO} WHERE m.id_medico = $1`, [id]);
  if (!fila) throw new NoEncontrado('Médico no encontrado');
  return filaAMedico(fila);
}

/**
 * Bloquea la fila del médico (FOR UPDATE). Agendar e internar también la
 * bloquean (FOR UPDATE / FOR SHARE), así que no se cruzan con desactivarlo.
 */
async function bloquearMedico(cx, id) {
  const { rows: [fila] } = await cx.query('SELECT id_medico FROM medico WHERE id_medico = $1 FOR UPDATE', [id]);
  if (!fila) throw new NoEncontrado('Médico no encontrado');
}

/** La especialidad es un catálogo: se reutiliza si ya existe (sin importar mayúsculas) y si no, se agrega. */
async function idEspecialidad(cx, nombre) {
  const { rows: [existente] } = await cx.query('SELECT id_especialidad FROM especialidad WHERE lower(nombre) = lower($1)', [nombre]);
  if (existente) return existente.id_especialidad;
  const { rows: [nueva] } = await cx.query('INSERT INTO especialidad (nombre) VALUES ($1) RETURNING id_especialidad', [nombre]);
  return nueva.id_especialidad;
}

export function crearRepositorioPersonal(pool) {
  return {
    async listarPersonal() {
      const { rows } = await pool.query(`${SELECT_MEDICO} ORDER BY m.estado = 'activo' DESC, m.apellidos, m.nombres`);
      return rows.map(filaAMedico);
    },

    registrarMedico(m) {
      return enTransaccion(pool, async (cx) => {
        const { rows: [repetido] } = await cx.query(
          `SELECT EXISTS (SELECT 1 FROM medico  WHERE numero_colegiado = $1) AS colegiado,
                  EXISTS (SELECT 1 FROM usuario WHERE lower(correo) = $2)   AS correo`,
          [m.numeroColegiado, m.correo],
        );
        if (repetido.colegiado) throw new Conflicto('Ya hay un médico con ese número de colegiado');
        if (repetido.correo) throw new Conflicto('Ya hay un usuario con ese correo');

        const { rows: [medico] } = await cx.query(
          `INSERT INTO medico (nombres, apellidos, numero_colegiado, especialidad_fk, telefono, correo)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_medico`,
          [m.nombres, m.apellidos, m.numeroColegiado, await idEspecialidad(cx, m.especialidad), m.telefono, m.correo],
        );
        await cx.query(
          `INSERT INTO usuario (correo, password_hash, nombre_mostrar, rol, medico_fk) VALUES ($1, $2, $3, 'medico', $4)`,
          [m.correo, m.passwordHash, `${m.nombres} ${m.apellidos}`.slice(0, 120), medico.id_medico],
        );
        return leerMedico(cx, medico.id_medico);
      });
    },

    actualizarMedico(medicoId, cambios) {
      const id = idNumerico(medicoId, 'Médico');
      return enTransaccion(pool, async (cx) => {
        await bloquearMedico(cx, id);
        if (cambios.numeroColegiado) {
          const { rows: [otro] } = await cx.query(
            'SELECT 1 FROM medico WHERE numero_colegiado = $1 AND id_medico <> $2', [cambios.numeroColegiado, id],
          );
          if (otro) throw new Conflicto('Ya hay un médico con ese número de colegiado');
        }
        const valores = {
          nombres: cambios.nombres,
          apellidos: cambios.apellidos,
          numero_colegiado: cambios.numeroColegiado,
          telefono: cambios.telefono,
          especialidad_fk: cambios.especialidad ? await idEspecialidad(cx, cambios.especialidad) : undefined,
        };
        // Solo se omite lo que no vino (el teléfono puede venir en null para borrarlo).
        const columnas = Object.keys(valores).filter((c) => valores[c] !== undefined);
        if (columnas.length > 0) {
          await cx.query(
            `UPDATE medico SET ${columnas.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id_medico = $${columnas.length + 1}`,
            [...columnas.map((c) => valores[c]), id],
          );
        }
        // El nombre que se muestra al iniciar sesión sigue al del médico.
        const medico = await leerMedico(cx, id);
        await cx.query('UPDATE usuario SET nombre_mostrar = $1 WHERE medico_fk = $2', [medico.nombre.slice(0, 120), id]);
        return medico;
      });
    },

    // Cuenta para un médico que ya está en el catálogo pero no tiene usuario.
    crearCuentaMedico(medicoId, { correo, passwordHash }) {
      const id = idNumerico(medicoId, 'Médico');
      return enTransaccion(pool, async (cx) => {
        const { rows: [medico] } = await cx.query(
          `SELECT m.estado, m.nombres || ' ' || m.apellidos AS nombre,
                  EXISTS (SELECT 1 FROM usuario u WHERE u.medico_fk = m.id_medico) AS tiene_cuenta
           FROM medico m WHERE m.id_medico = $1 FOR UPDATE`,
          [id],
        );
        if (!medico) throw new NoEncontrado('Médico no encontrado');
        if (medico.estado !== 'activo') throw new Conflicto('Reactiva al médico antes de crearle una cuenta');
        if (medico.tiene_cuenta) throw new Conflicto('Ese médico ya tiene cuenta');
        const { rows: [repetido] } = await cx.query('SELECT 1 FROM usuario WHERE lower(correo) = $1', [correo]);
        if (repetido) throw new Conflicto('Ya hay un usuario con ese correo');

        await cx.query(
          `INSERT INTO usuario (correo, password_hash, nombre_mostrar, rol, medico_fk) VALUES ($1, $2, $3, 'medico', $4)`,
          [correo, passwordHash, medico.nombre.slice(0, 120), id],
        );
        return leerMedico(cx, id);
      });
    },

    async restablecerPassword(medicoId, passwordHash) {
      const { rowCount } = await pool.query(
        'UPDATE usuario SET password_hash = $1 WHERE medico_fk = $2', [passwordHash, idNumerico(medicoId, 'Médico')],
      );
      if (rowCount === 0) throw new NoEncontrado('Ese médico no tiene usuario');
    },

    cambiarEstadoMedico(medicoId, activo) {
      const id = idNumerico(medicoId, 'Médico');
      return enTransaccion(pool, async (cx) => {
        await bloquearMedico(cx, id);
        if (!activo) {
          const { rows: citas } = await cx.query(
            `SELECT c.id_cita, to_char(c.fecha_hora, 'YYYY-MM-DD HH24:MI') AS fecha_hora,
                    p.nombres || ' ' || p.apellidos AS paciente
             FROM cita c JOIN paciente p ON p.id_paciente = c.paciente_fk
             WHERE c.medico_fk = $1 AND c.estado = ANY($2) AND c.fecha_hora >= localtimestamp
             ORDER BY c.fecha_hora`,
            [id, ESTADOS_PENDIENTES],
          );
          const { rows: internamientos } = await cx.query(
            `SELECT i.id_internamiento, h.numero AS habitacion, p.nombres || ' ' || p.apellidos AS paciente
             FROM internamiento i
             JOIN paciente p   ON p.id_paciente = i.paciente_fk
             JOIN habitacion h ON h.id_habitacion = i.habitacion_fk
             WHERE i.medico_responsable_fk = $1 AND i.estado = 'activo'`,
            [id],
          );
          if (citas.length > 0 || internamientos.length > 0) {
            const partes = [
              citas.length && `${citas.length} ${citas.length === 1 ? 'cita pendiente' : 'citas pendientes'}`,
              internamientos.length && `${internamientos.length} ${internamientos.length === 1 ? 'paciente internado' : 'pacientes internados'} a su cargo`,
            ].filter(Boolean);
            const pasos = [
              citas.length && 'reprograma o cancela las citas',
              internamientos.length && 'cambia el médico responsable de los internamientos',
            ].filter(Boolean);
            throw new Conflicto(
              `No se puede desactivar: tiene ${partes.join(' y ')}. Primero ${pasos.join(' y ')}.`,
              {
                citas: citas.map((c) => ({ id: String(c.id_cita), fechaHora: c.fecha_hora, paciente: c.paciente })),
                internamientos: internamientos.map((i) => ({ id: String(i.id_internamiento), habitacion: i.habitacion, paciente: i.paciente })),
              },
            );
          }
        }
        await cx.query('UPDATE medico SET estado = $1 WHERE id_medico = $2', [activo ? 'activo' : 'inactivo', id]);
        await cx.query('UPDATE usuario SET activo = $1 WHERE medico_fk = $2', [activo, id]);
        return leerMedico(cx, id);
      });
    },
  };
}
