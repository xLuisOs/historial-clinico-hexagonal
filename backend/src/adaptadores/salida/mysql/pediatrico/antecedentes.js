import { Conflicto } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { exigirPacienteActivo } from './pacientes.js';

// Antecedentes médicos del paciente (tabla antecedente). Nunca se borran:
// forman parte de la historia clínica, y pedi_app no tiene DELETE.

// Mismo orden que el hospital; en pediatría el perinatal va primero.
const ORDEN_TIPO = ['perinatal', 'patologico', 'quirurgico', 'familiar', 'habito', 'medicamento'];

/** Antecedentes del paciente, agrupados por tipo y del más antiguo al más reciente. */
export async function cargarAntecedentes(cx, pacienteId) {
  const [filas] = await cx.query(
    `SELECT a.id_antecedente, a.tipo, a.descripcion, a.anio_inicio, a.fecha_registro,
            m.id_medico, CONCAT(m.nombres, ' ', m.apellidos) AS medico
     FROM antecedente a JOIN medico m ON m.id_medico = a.registrado_por
     WHERE a.paciente_fk = ?
     ORDER BY FIELD(a.tipo, ?), a.fecha_registro, a.id_antecedente`,
    [pacienteId, ORDEN_TIPO],
  );
  return filas.map((f) => ({
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
    // → Antecedente[] del paciente, ya con el nuevo. Bloquea la fila del
    // paciente (FOR UPDATE) para que no lo archiven a medio registro; el
    // trigger trg_antecedente_paciente_activo lo vuelve a comprobar.
    agregar(pacienteId, antecedente, usuario) {
      if (!usuario.medicoId) throw new Conflicto('El usuario no está asociado a un médico');
      return enTransaccion(pool, async (cx) => {
        await exigirPacienteActivo(cx, pacienteId);
        await cx.query(
          `INSERT INTO antecedente (paciente_fk, tipo, descripcion, anio_inicio, registrado_por)
           VALUES (?, ?, ?, ?, ?)`,
          [pacienteId, antecedente.tipo, antecedente.descripcion, antecedente.anioInicio, usuario.medicoId],
        );
        return cargarAntecedentes(cx, pacienteId);
      });
    },
  };
}
