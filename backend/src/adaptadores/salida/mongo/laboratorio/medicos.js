import { NoEncontrado } from '../../../../dominio/errores.js';
import { aObjectId, traducirError } from '../conexion.js';
import { asegurarEspecialidad } from './catalogos.js';
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
        // Una especialidad nueva ("Otra…") queda también en el catálogo.
        await asegurarEspecialidad(db, m.especialidad);
        return documentoAMedico({ ...doc, _id: insertedId });
      } catch (error) {
        throw traducirError(error, { duplicado: `Ya existe un médico referente con el colegiado ${m.numeroColegiado}` });
      }
    },
  };
}

// Para el admin (puerto `personal`): en el laboratorio, los médicos son los
// referentes. No inician sesión, así que no hay usuario ni contraseña, y
// desactivarlos no deja nada pendiente: las órdenes guardan una copia de su
// nombre y colegiado (referencia extendida), que tampoco cambia al editarlos.
const aPersonal = (d) => ({
  id: d._id.toHexString(),
  nombre: nombreCompleto(d),
  nombres: d.nombres,
  apellidos: d.apellidos,
  numeroColegiado: d.numero_colegiado,
  especialidad: d.especialidad ?? null,
  telefono: d.telefono ?? null,
  correo: null,
  activo: d.activo !== false,
});

export function crearRepositorioPersonalReferentes(db) {
  const referentes = db.collection('medicos_referentes');

  // Una sola escritura sobre un documento: es atómica sin transacción, y el
  // índice único de numero_colegiado rechaza un colegiado repetido.
  async function actualizar(id, cambio, mensajes) {
    try {
      const doc = await referentes.findOneAndUpdate({ _id: aObjectId(id, 'Médico') }, { $set: cambio }, { returnDocument: 'after' });
      if (!doc) throw new NoEncontrado('Médico no encontrado');
      return aPersonal(doc);
    } catch (error) {
      throw traducirError(error, mensajes);
    }
  }

  return {
    async listarPersonal() {
      const docs = await referentes.find().sort({ activo: -1, apellidos: 1, nombres: 1 }).collation({ locale: 'es' }).toArray();
      return docs.map(aPersonal);
    },
    actualizarMedico(id, cambios) {
      const campos = { nombres: 'nombres', apellidos: 'apellidos', numeroColegiado: 'numero_colegiado', especialidad: 'especialidad', telefono: 'telefono' };
      const cambio = Object.fromEntries(Object.entries(cambios).filter(([c]) => campos[c]).map(([c, v]) => [campos[c], v]));
      return actualizar(id, cambio, { duplicado: 'Ya hay un médico referente con ese número de colegiado' })
        .then(async (medico) => { await asegurarEspecialidad(db, cambios.especialidad); return medico; });
    },
    cambiarEstadoMedico(id, activo) {
      return actualizar(id, { activo });
    },
  };
}
