import { Conflicto } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { exigirPacienteActivo, idNumerico } from './pacientes.js';

// Antecedentes médicos del paciente (tabla antecedente). Nunca se borran:
// forman parte de la historia clínica.

/** Antecedentes del paciente, agrupados por tipo y del más antiguo al más reciente. */
export async function cargarAntecedentes(cliente, pacienteId) {
  const { rows } = await cliente.query(
    `SELECT a.id_antecedente, a.tipo, a.descripcion, a.anio_inicio, a.fecha_registro,
            m.id_medico, m.nombres || ' ' || m.apellidos AS medico
     FROM antecedente a JOIN medico m ON m.id_medico = a.registrado_por
     WHERE a.paciente_fk = $1
     ORDER BY array_position(ARRAY['patologico', 'quirurgico', 'familiar', 'habito', 'medicamento']::varchar[], a.tipo),
              a.fecha_registro`,
    [pacienteId],
  );
  return rows.map((f) => ({
    id: String(f.id_antecedente),
    tipo: f.tipo,
    descripcion: f.descripcion,
    anioInicio: f.anio_inicio,
    registradoPor: { id: String(f.id_medico), nombre: f.medico },
    fechaRegistro: f.fecha_registro,
  }));
}

export function crearRepositorioAntecedentes(pool) {
  return {
    // → Antecedente[] del paciente, ya con el nuevo.
    agregar(pacienteId, antecedente, usuario) {
      const id = idNumerico(pacienteId, 'Paciente');
      if (!usuario.medicoId) throw new Conflicto('El usuario no está asociado a un médico');
      return enTransaccion(pool, async (cx) => {
        await exigirPacienteActivo(cx, id);
        await cx.query(
          `INSERT INTO antecedente (paciente_fk, tipo, descripcion, anio_inicio, registrado_por)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, antecedente.tipo, antecedente.descripcion, antecedente.anioInicio, usuario.medicoId],
        );
        return cargarAntecedentes(cx, id);
      });
    },
  };
}
