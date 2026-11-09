import { ESTADOS_PENDIENTES } from '../../../../dominio/cita.js';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';

// Personal médico del pediátrico, administrado por el admin (ver dominio/medico.js).
// Cada operación que toca médico y usuario va en UNA transacción. Los UNIQUE de
// la base (uq_medico_colegiado, uq_usuario_correo) son la última defensa; antes
// se revisa para dar un mensaje claro.

const SELECT_MEDICO = `
  SELECT m.id_medico, m.nombres, m.apellidos, m.especialidad, m.numero_colegiado, m.activo, u.correo
  FROM medico m LEFT JOIN usuario u ON u.medico_fk = m.id_medico`;

const filaAMedico = (f) => ({
  id: String(f.id_medico),
  nombre: `${f.nombres} ${f.apellidos}`,
  nombres: f.nombres,
  apellidos: f.apellidos,
  numeroColegiado: f.numero_colegiado,
  especialidad: f.especialidad,
  telefono: null, // el pediátrico no guarda teléfono del médico
  correo: f.correo ?? null,
  activo: Boolean(f.activo),
});

async function leerMedico(cx, id) {
  const [[fila]] = await cx.query(`${SELECT_MEDICO} WHERE m.id_medico = ?`, [id]);
  if (!fila) throw new NoEncontrado('Médico no encontrado');
  return filaAMedico(fila);
}

/** Bloquea la fila del médico (FOR UPDATE): agendar también la bloquea, así no se cruzan. */
async function bloquearMedico(cx, id) {
  const [[fila]] = await cx.query('SELECT id_medico FROM medico WHERE id_medico = ? FOR UPDATE', [id]);
  if (!fila) throw new NoEncontrado('Médico no encontrado');
}

export function crearRepositorioPersonal(pool) {
  return {
    async listarPersonal() {
      const [filas] = await pool.query(`${SELECT_MEDICO} ORDER BY m.activo DESC, m.apellidos, m.nombres`);
      return filas.map(filaAMedico);
    },

    registrarMedico(m) {
      return enTransaccion(pool, async (cx) => {
        const [[repetido]] = await cx.query(
          `SELECT
             EXISTS (SELECT 1 FROM medico  WHERE numero_colegiado = ?) AS colegiado,
             EXISTS (SELECT 1 FROM usuario WHERE correo = ?)           AS correo`,
          [m.numeroColegiado, m.correo],
        );
        if (repetido.colegiado) throw new Conflicto('Ya hay un médico con ese número de colegiado');
        if (repetido.correo) throw new Conflicto('Ya hay un usuario con ese correo');

        const [medico] = await cx.query(
          'INSERT INTO medico (nombres, apellidos, especialidad, numero_colegiado) VALUES (?, ?, ?, ?)',
          [m.nombres, m.apellidos, m.especialidad, m.numeroColegiado],
        );
        await cx.query(
          `INSERT INTO usuario (correo, password_hash, nombre_mostrar, rol, medico_fk) VALUES (?, ?, ?, 'medico', ?)`,
          [m.correo, m.passwordHash, `${m.nombres} ${m.apellidos}`.slice(0, 120), medico.insertId],
        );
        return leerMedico(cx, medico.insertId);
      });
    },

    actualizarMedico(id, cambios) {
      return enTransaccion(pool, async (cx) => {
        await bloquearMedico(cx, id);
        if (cambios.numeroColegiado) {
          const [[otro]] = await cx.query(
            'SELECT 1 AS hay FROM medico WHERE numero_colegiado = ? AND id_medico <> ?', [cambios.numeroColegiado, id],
          );
          if (otro) throw new Conflicto('Ya hay un médico con ese número de colegiado');
        }
        const columnas = { nombres: 'nombres', apellidos: 'apellidos', especialidad: 'especialidad', numeroColegiado: 'numero_colegiado' };
        const campos = Object.keys(cambios).filter((c) => columnas[c]);
        if (campos.length > 0) {
          await cx.query(
            `UPDATE medico SET ${campos.map((c) => `${columnas[c]} = ?`).join(', ')} WHERE id_medico = ?`,
            [...campos.map((c) => cambios[c]), id],
          );
        }
        // El nombre que se muestra al iniciar sesión sigue al del médico.
        const medico = await leerMedico(cx, id);
        await cx.query('UPDATE usuario SET nombre_mostrar = ? WHERE medico_fk = ?', [medico.nombre.slice(0, 120), id]);
        return medico;
      });
    },

    // Cuenta para un médico que ya está en el catálogo pero no tiene usuario.
    crearCuentaMedico(id, { correo, passwordHash }) {
      return enTransaccion(pool, async (cx) => {
        const [[medico]] = await cx.query(
          `SELECT m.activo, CONCAT(m.nombres, ' ', m.apellidos) AS nombre,
                  EXISTS (SELECT 1 FROM usuario u WHERE u.medico_fk = m.id_medico) AS tiene_cuenta
           FROM medico m WHERE m.id_medico = ? FOR UPDATE`,
          [id],
        );
        if (!medico) throw new NoEncontrado('Médico no encontrado');
        if (!medico.activo) throw new Conflicto('Reactiva al médico antes de crearle una cuenta');
        if (medico.tiene_cuenta) throw new Conflicto('Ese médico ya tiene cuenta');
        const [[repetido]] = await cx.query('SELECT 1 AS si FROM usuario WHERE correo = ?', [correo]);
        if (repetido) throw new Conflicto('Ya hay un usuario con ese correo');

        await cx.query(
          `INSERT INTO usuario (correo, password_hash, nombre_mostrar, rol, medico_fk) VALUES (?, ?, ?, 'medico', ?)`,
          [correo, passwordHash, medico.nombre.slice(0, 120), id],
        );
        return leerMedico(cx, id);
      });
    },

    async restablecerPassword(id, passwordHash) {
      const [r] = await pool.query('UPDATE usuario SET password_hash = ? WHERE medico_fk = ?', [passwordHash, id]);
      if (r.affectedRows === 0) throw new NoEncontrado('Ese médico no tiene usuario');
    },

    cambiarEstadoMedico(id, activo) {
      return enTransaccion(pool, async (cx) => {
        await bloquearMedico(cx, id);
        if (!activo) {
          const [citas] = await cx.query(
            `SELECT ci.id_cita, DATE_FORMAT(ci.fecha_hora_programada, '%Y-%m-%d %H:%i') AS fecha_hora,
                    CONCAT(p.nombres, ' ', p.apellidos) AS paciente
             FROM cita ci JOIN paciente p ON p.id_paciente = ci.paciente_fk
             WHERE ci.medico_fk = ? AND ci.estado_cita IN (?) AND ci.fecha_hora_programada >= NOW()
             ORDER BY ci.fecha_hora_programada`,
            [id, ESTADOS_PENDIENTES],
          );
          if (citas.length > 0) {
            throw new Conflicto(
              `No se puede desactivar: tiene ${citas.length} ${citas.length === 1 ? 'cita pendiente' : 'citas pendientes'}. Reprográmalas o cancélalas primero.`,
              { citas: citas.map((c) => ({ id: String(c.id_cita), fechaHora: c.fecha_hora, paciente: c.paciente })), internamientos: [] },
            );
          }
        }
        await cx.query('UPDATE medico SET activo = ? WHERE id_medico = ?', [activo, id]);
        await cx.query('UPDATE usuario SET activo = ? WHERE medico_fk = ?', [activo, id]);
        return leerMedico(cx, id);
      });
    },
  };
}
