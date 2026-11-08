import { traducirError } from '../conexion.js';
import { nombreCompleto } from './modelo.js';

// Médicos referentes: colección propia (se referencian desde las órdenes con
// una "referencia extendida": su _id más nombre y colegiado copiados, para que
// la orden se lea sin $lookup y conserve cómo se llamaba el médico ese día).

export const documentoAMedico = (d) => ({
  id: d._id.toHexString(),
  nombre: nombreCompleto(d),
  numeroColegiado: d.numero_colegiado,
  especialidad: d.especialidad ?? null,
  institucionProcedencia: d.institucion_procedencia ?? null,
});

export function crearRepositorioMedicos(db) {
  return {
    /** Un solo insertOne: el índice único de numero_colegiado evita duplicados aunque dos lo registren a la vez. */
    async registrarMedicoReferente(m) {
      const doc = {
        nombres: m.nombres,
        apellidos: m.apellidos,
        numero_colegiado: m.numeroColegiado,
        especialidad: m.especialidad,
        telefono: m.telefono,
        institucion_procedencia: m.institucionProcedencia,
        activo: true,
      };
      try {
        const { insertedId } = await db.collection('medicos_referentes').insertOne(doc);
        return documentoAMedico({ ...doc, _id: insertedId });
      } catch (error) {
        throw traducirError(error, { duplicado: `Ya existe un médico referente con el colegiado ${m.numeroColegiado}` });
      }
    },
  };
}
