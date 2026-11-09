import { Timestamp } from 'firebase-admin/firestore';
import { Conflicto } from '../../../../dominio/errores.js';
import { enTransaccion, timestampATexto } from '../conexion.js';
import { COLECCIONES, nombreCompleto } from './modelo.js';
import { exigirPacienteActivo } from './pacientes.js';

// Antecedentes médicos: un arreglo `antecedentes` dentro del documento del
// paciente. Son pocos y siempre se leen junto con él, así que no ameritan
// una colección aparte. Nunca se borran.

const ORDEN_TIPO = ['patologico', 'quirurgico', 'familiar', 'habito', 'medicamento'];

/** Arreglo del documento → Antecedente[] del dominio. */
export function documentoAAntecedentes(snap, zonaHoraria) {
  return (snap.get('antecedentes') ?? [])
    .map((a, i) => ({
      id: String(i),
      tipo: a.tipo,
      descripcion: a.descripcion,
      anioInicio: a.anio_inicio ?? null,
      registradoPor: a.registrado_por && { id: a.registrado_por.id, nombre: nombreCompleto(a.registrado_por) },
      fechaRegistro: timestampATexto(a.fecha_registro, zonaHoraria),
    }))
    .sort((a, b) => ORDEN_TIPO.indexOf(a.tipo) - ORDEN_TIPO.indexOf(b.tipo)
      || (a.fechaRegistro ?? '').localeCompare(b.fechaRegistro ?? ''));
}

export function crearRepositorioAntecedentes(db, zonaHoraria) {
  return {
    // → Antecedente[] del paciente, ya con el nuevo.
    async agregar(pacienteId, antecedente, usuario) {
      if (!usuario.medicoId) throw new Conflicto('El usuario no está asociado a un odontólogo');
      await enTransaccion(db, async (t) => {
        const paciente = await exigirPacienteActivo(t, db, pacienteId);
        const odontologo = await t.get(db.collection(COLECCIONES.odontologos).doc(usuario.medicoId));
        // serverTimestamp no se permite dentro de un arreglo: se usa la hora del servidor de la app.
        t.update(paciente.ref, {
          antecedentes: [...(paciente.get('antecedentes') ?? []), {
            tipo: antecedente.tipo,
            descripcion: antecedente.descripcion,
            anio_inicio: antecedente.anioInicio,
            registrado_por: {
              id: odontologo.id,
              nombres: odontologo.get('nombres') ?? usuario.nombre,
              apellidos: odontologo.get('apellidos') ?? null,
            },
            fecha_registro: Timestamp.now(),
          }],
        });
      });
      const snap = await db.collection(COLECCIONES.pacientes).doc(pacienteId).get();
      return documentoAAntecedentes(snap, zonaHoraria);
    },
  };
}
