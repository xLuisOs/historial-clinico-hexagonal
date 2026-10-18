import { Conflicto, DatosInvalidos, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, traducirError } from '../conexion.js';

// En pediatría el contacto del paciente es el de su encargado: el niño no
// tiene teléfono ni dirección propios.
export const SELECT_PACIENTE = `
  SELECT p.id_paciente, p.nombres, p.apellidos, p.fecha_nacimiento, p.sexo, p.cui,
         p.tipo_sangre, p.alergias, p.fecha_registro, p.activo, p.fecha_baja,
         p.motivo_baja, p.detalle_baja,
         e.id_encargado, e.nombres AS e_nombres, e.apellidos AS e_apellidos,
         e.parentesco, e.dpi, e.telefono, e.direccion, e.correo
  FROM paciente p
  JOIN encargado e ON e.id_encargado = p.encargado_fk`;

export function filaAPaciente(f) {
  return {
    id: String(f.id_paciente),
    nombres: f.nombres,
    apellidos: f.apellidos,
    fechaNacimiento: f.fecha_nacimiento,
    sexo: f.sexo,
    documento: f.cui,
    contacto: { telefono: f.telefono, direccion: f.direccion, correo: f.correo },
    responsable: {
      id: String(f.id_encargado),
      nombres: f.e_nombres,
      apellidos: f.e_apellidos,
      parentesco: f.parentesco,
      documento: f.dpi,
      telefono: f.telefono,
      direccion: f.direccion,
      correo: f.correo,
    },
    datosClinicos: { tipoSangre: f.tipo_sangre, alergias: f.alergias },
    estado: {
      activo: Boolean(f.activo),
      fechaRegistro: f.fecha_registro,
      fechaBaja: f.fecha_baja,
      motivoBaja: f.motivo_baja,
      detalleBaja: f.detalle_baja,
    },
  };
}

/** Bloquea la fila del paciente y verifica que exista y esté activo. */
export async function exigirPacienteActivo(conexion, pacienteId) {
  const [filas] = await conexion.query(
    'SELECT activo FROM paciente WHERE id_paciente = ? FOR UPDATE',
    [pacienteId],
  );
  if (filas.length === 0) throw new NoEncontrado('Paciente no encontrado');
  if (!filas[0].activo) throw new Conflicto('El historial del paciente está archivado');
}

export function crearRepositorioPacientes(pool) {
  async function obtenerPorId(pacienteId, conexion = pool) {
    const [filas] = await conexion.query(`${SELECT_PACIENTE} WHERE p.id_paciente = ?`, [pacienteId]);
    if (filas.length === 0) throw new NoEncontrado('Paciente no encontrado');
    return filaAPaciente(filas[0]);
  }

  return {
    obtenerPorId: (id) => obtenerPorId(id),

    registrar(paciente) {
      if (!paciente.responsable) {
        throw new DatosInvalidos('Datos inválidos', { responsable: 'En pediatría el encargado es obligatorio' });
      }
      return enTransaccion(pool, async (cx) => {
        let encargadoId = paciente.responsable.id;
        if (encargadoId) {
          const [e] = await cx.query('SELECT 1 FROM encargado WHERE id_encargado = ?', [encargadoId]);
          if (e.length === 0) throw new NoEncontrado('El encargado indicado no existe');
        } else {
          const r = paciente.responsable;
          const [existente] = await cx.query('SELECT id_encargado FROM encargado WHERE dpi = ?', [r.documento]);
          if (existente.length > 0) {
            throw new Conflicto(
              `Ya existe un encargado con DPI ${r.documento} (id ${existente[0].id_encargado}); selecciónalo en lugar de crearlo`,
            );
          }
          const [res] = await cx.query(
            `INSERT INTO encargado (nombres, apellidos, parentesco, dpi, telefono, direccion, correo)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [r.nombres, r.apellidos, r.parentesco, r.documento, r.telefono, r.direccion, r.correo],
          );
          encargadoId = res.insertId;
        }

        const [res] = await cx.query(
          `INSERT INTO paciente (nombres, apellidos, fecha_nacimiento, sexo, cui, encargado_fk, tipo_sangre, alergias)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paciente.nombres, paciente.apellidos, paciente.fechaNacimiento, paciente.sexo,
            paciente.documento, encargadoId, paciente.datosClinicos.tipoSangre, paciente.datosClinicos.alergias,
          ],
        ).catch((e) => { throw traducirError(e, { duplicado: 'Ya existe un paciente con ese CUI' }); });

        return obtenerPorId(res.insertId, cx);
      });
    },

    async buscar({ texto, incluirArchivados }) {
      const condiciones = [];
      const params = [];
      if (texto) {
        condiciones.push(`(CONCAT(p.nombres, ' ', p.apellidos) LIKE ? OR p.cui = ? OR e.dpi = ?)`);
        params.push(`%${texto}%`, texto, texto);
      }
      if (!incluirArchivados) condiciones.push('p.activo = TRUE');
      const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
      const [filas] = await pool.query(
        `${SELECT_PACIENTE} ${where} ORDER BY p.apellidos, p.nombres LIMIT 50`,
        params,
      );
      return filas.map(filaAPaciente);
    },

    actualizarContacto(pacienteId, contacto) {
      return enTransaccion(pool, async (cx) => {
        await exigirPacienteActivo(cx, pacienteId);
        await cx.query(
          `UPDATE encargado e JOIN paciente p ON p.encargado_fk = e.id_encargado
           SET e.telefono  = COALESCE(?, e.telefono),
               e.direccion = COALESCE(?, e.direccion),
               e.correo    = COALESCE(?, e.correo)
           WHERE p.id_paciente = ?`,
          [contacto.telefono, contacto.direccion, contacto.correo, pacienteId],
        );
        return obtenerPorId(pacienteId, cx);
      });
    },

    // Archivar = marcar inactivo + cancelar sus citas futuras, todo o nada.
    darDeBaja(pacienteId, { motivo, detalle }) {
      return enTransaccion(pool, async (cx) => {
        await exigirPacienteActivo(cx, pacienteId);
        await cx.query(
          `UPDATE paciente
           SET activo = FALSE, fecha_baja = NOW(), motivo_baja = ?, detalle_baja = ?
           WHERE id_paciente = ?`,
          [motivo, detalle, pacienteId],
        );
        await cx.query(
          `UPDATE cita SET estado_cita = 'cancelada'
           WHERE paciente_fk = ? AND estado_cita IN ('programada', 'confirmada')
             AND fecha_hora_programada >= NOW()`,
          [pacienteId],
        );
        return obtenerPorId(pacienteId, cx);
      });
    },
  };
}
