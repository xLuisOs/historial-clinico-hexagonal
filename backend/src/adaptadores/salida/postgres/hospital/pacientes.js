import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, traducirError } from '../conexion.js';

// El paciente tiene su propio contacto; el responsable que se devuelve es el
// principal vigente (paciente_responsable guarda el historial completo).
export const SELECT_PACIENTE = `
  SELECT p.id_paciente, p.nombres, p.apellidos, p.fecha_nacimiento, p.sexo, p.dpi,
         p.telefono, p.direccion, p.correo, p.tipo_sangre, p.alergias,
         p.fecha_registro, p.estado, p.fecha_baja, p.motivo_baja, p.detalle_baja,
         r.id_responsable, r.nombres AS r_nombres, r.apellidos AS r_apellidos, r.dpi AS r_dpi,
         r.telefono AS r_telefono, r.direccion AS r_direccion, pr.parentesco
  FROM paciente p
  LEFT JOIN paciente_responsable pr
         ON pr.paciente_fk = p.id_paciente AND pr.es_principal AND pr.fecha_fin IS NULL
  LEFT JOIN responsable r ON r.id_responsable = pr.responsable_fk`;

export function filaAPaciente(f) {
  return {
    id: String(f.id_paciente),
    nombres: f.nombres,
    apellidos: f.apellidos,
    fechaNacimiento: f.fecha_nacimiento,
    sexo: f.sexo,
    documento: f.dpi,
    contacto: { telefono: f.telefono, direccion: f.direccion, correo: f.correo },
    responsable: f.id_responsable === null ? null : {
      id: String(f.id_responsable),
      nombres: f.r_nombres,
      apellidos: f.r_apellidos,
      parentesco: f.parentesco,
      documento: f.r_dpi,
      telefono: f.r_telefono,
      direccion: f.r_direccion,
      correo: null,
    },
    datosClinicos: { tipoSangre: f.tipo_sangre, alergias: f.alergias },
    estado: {
      activo: f.estado === 'activo',
      fechaRegistro: f.fecha_registro,
      fechaBaja: f.fecha_baja,
      motivoBaja: f.motivo_baja,
      detalleBaja: f.detalle_baja,
    },
  };
}

/** Bloquea la fila del paciente y verifica que exista y esté activo. */
export async function exigirPacienteActivo(cliente, pacienteId) {
  const { rows } = await cliente.query(
    'SELECT estado FROM paciente WHERE id_paciente = $1 FOR UPDATE',
    [pacienteId],
  );
  if (rows.length === 0) throw new NoEncontrado('Paciente no encontrado');
  if (rows[0].estado !== 'activo') throw new Conflicto('El historial del paciente está archivado');
}

/** Los ids de la API son texto; uno que no es número no puede existir en la base. */
export function idNumerico(id, entidad) {
  if (!/^\d{1,9}$/.test(String(id))) throw new NoEncontrado(`${entidad} no encontrado`);
  return Number(id);
}

// Sin tildes y en minúsculas, para que "perez" encuentre a "Pérez".
const SIN_TILDES = (expr) => `translate(lower(${expr}), 'áéíóúüñ', 'aeiouun')`;

export function crearRepositorioPacientes(pool) {
  async function obtenerPorId(pacienteId, cliente = pool) {
    const { rows } = await cliente.query(`${SELECT_PACIENTE} WHERE p.id_paciente = $1`, [idNumerico(pacienteId, 'Paciente')]);
    if (rows.length === 0) throw new NoEncontrado('Paciente no encontrado');
    return filaAPaciente(rows[0]);
  }

  return {
    obtenerPorId: (id) => obtenerPorId(id),

    registrar(paciente) {
      return enTransaccion(pool, async (cx) => {
        const { rows: [nuevo] } = await cx.query(
          `INSERT INTO paciente (nombres, apellidos, fecha_nacimiento, sexo, dpi, telefono, direccion, correo, tipo_sangre, alergias)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id_paciente`,
          [
            paciente.nombres, paciente.apellidos, paciente.fechaNacimiento, paciente.sexo, paciente.documento,
            paciente.contacto.telefono, paciente.contacto.direccion, paciente.contacto.correo,
            paciente.datosClinicos.tipoSangre, paciente.datosClinicos.alergias,
          ],
        ).catch((e) => { throw traducirError(e, { duplicado: 'Ya existe un paciente con ese DPI' }); });

        // El responsable es opcional en el hospital (pacientes adultos).
        const r = paciente.responsable;
        if (r) {
          let responsableId = r.id;
          if (responsableId) {
            const { rows } = await cx.query('SELECT 1 FROM responsable WHERE id_responsable = $1', [idNumerico(responsableId, 'Responsable')]);
            if (rows.length === 0) throw new NoEncontrado('El responsable indicado no existe');
          } else {
            const { rows: existente } = await cx.query('SELECT id_responsable FROM responsable WHERE dpi = $1', [r.documento]);
            if (existente.length > 0) {
              throw new Conflicto(
                `Ya existe un responsable con DPI ${r.documento} (id ${existente[0].id_responsable}); selecciónalo en lugar de crearlo`,
              );
            }
            const { rows: [creado] } = await cx.query(
              `INSERT INTO responsable (nombres, apellidos, dpi, telefono, direccion)
               VALUES ($1, $2, $3, $4, $5) RETURNING id_responsable`,
              [r.nombres, r.apellidos, r.documento, r.telefono, r.direccion],
            );
            responsableId = creado.id_responsable;
          }
          await cx.query(
            `INSERT INTO paciente_responsable (paciente_fk, responsable_fk, parentesco, es_principal)
             VALUES ($1, $2, $3, true)`,
            [nuevo.id_paciente, responsableId, r.parentesco ?? 'otro'],
          );
        }

        return obtenerPorId(nuevo.id_paciente, cx);
      });
    },

    async buscar({ texto, incluirArchivados }) {
      const condiciones = [];
      const params = [];
      if (texto) {
        params.push(`%${texto}%`, texto);
        condiciones.push(`(${SIN_TILDES("p.nombres || ' ' || p.apellidos")} LIKE ${SIN_TILDES('$1')} OR p.dpi = $2)`);
      }
      if (!incluirArchivados) condiciones.push(`p.estado = 'activo'`);
      const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `${SELECT_PACIENTE} ${where} ORDER BY p.apellidos, p.nombres LIMIT 50`,
        params,
      ).catch((e) => { throw traducirError(e); });
      return rows.map(filaAPaciente);
    },

    actualizarContacto(pacienteId, contacto) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(pacienteId, 'Paciente');
        await exigirPacienteActivo(cx, id);
        await cx.query(
          `UPDATE paciente
           SET telefono  = COALESCE($1, telefono),
               direccion = COALESCE($2, direccion),
               correo    = COALESCE($3, correo)
           WHERE id_paciente = $4`,
          [contacto.telefono, contacto.direccion, contacto.correo, id],
        );
        return obtenerPorId(id, cx);
      });
    },

    // Corregir datos personales (admin). El UNIQUE de dpi es la última defensa.
    actualizarDatosPersonales(pacienteId, cambios) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(pacienteId, 'Paciente');
        await exigirPacienteActivo(cx, id);
        if (cambios.documento) {
          const { rows } = await cx.query('SELECT 1 FROM paciente WHERE dpi = $1 AND id_paciente <> $2', [cambios.documento, id]);
          if (rows.length > 0) throw new Conflicto('Ya hay otro paciente con ese documento');
        }
        const columnas = { nombres: 'nombres', apellidos: 'apellidos', fechaNacimiento: 'fecha_nacimiento', sexo: 'sexo', documento: 'dpi' };
        const campos = Object.keys(cambios).filter((c) => columnas[c]);
        await cx.query(
          `UPDATE paciente SET ${campos.map((c, i) => `${columnas[c]} = $${i + 1}`).join(', ')} WHERE id_paciente = $${campos.length + 1}`,
          [...campos.map((c) => cambios[c]), id],
        );
        return obtenerPorId(id, cx);
      });
    },

    // Tipo de sangre y alergias: solo lo que viene; null = sin registrar.
    actualizarDatosClinicos(pacienteId, datos) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(pacienteId, 'Paciente');
        await exigirPacienteActivo(cx, id);
        const columnas = { tipoSangre: 'tipo_sangre', alergias: 'alergias' };
        const campos = Object.keys(datos).filter((c) => columnas[c]);
        await cx.query(
          `UPDATE paciente SET ${campos.map((c, i) => `${columnas[c]} = $${i + 1}`).join(', ')} WHERE id_paciente = $${campos.length + 1}`,
          [...campos.map((c) => datos[c]), id],
        );
        return obtenerPorId(id, cx);
      });
    },

    // Archivar = marcar archivado + cancelar sus citas futuras, todo o nada.
    darDeBaja(pacienteId, { motivo, detalle }) {
      return enTransaccion(pool, async (cx) => {
        const id = idNumerico(pacienteId, 'Paciente');
        await exigirPacienteActivo(cx, id);
        await cx.query(
          `UPDATE paciente
           SET estado = 'archivado', fecha_baja = localtimestamp, motivo_baja = $1, detalle_baja = $2
           WHERE id_paciente = $3`,
          [motivo, detalle, id],
        );
        await cx.query(
          `UPDATE cita SET estado = 'cancelada'
           WHERE paciente_fk = $1 AND estado IN ('programada', 'confirmada') AND fecha_hora >= localtimestamp`,
          [id],
        );
        return obtenerPorId(id, cx);
      });
    },
  };
}
