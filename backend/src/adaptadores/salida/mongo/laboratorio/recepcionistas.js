import { NoEncontrado } from '../../../../dominio/errores.js';
import { aObjectId, traducirError } from '../conexion.js';
import { nombreCompleto } from './modelo.js';

// Recepcionistas del laboratorio, administradas por el admin (ver
// dominio/recepcionista.js). En el modelo documental la persona y su cuenta
// son el mismo documento de `usuarios` (rol 'recepcion'), así que cada
// operación es una sola escritura atómica. El índice único de correo es la
// última defensa contra un correo repetido.

const MENSAJES = { duplicado: 'Ya hay un usuario con ese correo' };

const aRecepcionista = (u) => ({
  id: u._id.toHexString(),
  nombre: nombreCompleto(u),
  nombres: u.nombres,
  apellidos: u.apellidos,
  telefono: u.telefono ?? null,
  correo: u.correo,
  activo: u.activo === true,
});

export function crearRepositorioRecepcionistas(db) {
  const usuarios = db.collection('usuarios');

  async function actualizar(id, cambio) {
    try {
      const doc = await usuarios.findOneAndUpdate(
        { _id: aObjectId(id, 'Recepcionista'), rol: 'recepcion' },
        { $set: cambio },
        { returnDocument: 'after' },
      );
      if (!doc) throw new NoEncontrado('Recepcionista no encontrada');
      return aRecepcionista(doc);
    } catch (error) {
      throw traducirError(error, MENSAJES);
    }
  }

  return {
    async listarRecepcionistas() {
      const docs = await usuarios.find({ rol: 'recepcion' })
        .sort({ activo: -1, apellidos: 1, nombres: 1 }).collation({ locale: 'es' }).toArray();
      return docs.map(aRecepcionista);
    },

    async registrarRecepcionista(r) {
      const doc = {
        correo: r.correo,
        password_hash: r.passwordHash,
        nombres: r.nombres,
        apellidos: r.apellidos,
        rol: 'recepcion',
        numero_colegiado: null,
        telefono: r.telefono,
        activo: true,
        ultimo_acceso: null,
      };
      try {
        const { insertedId } = await usuarios.insertOne(doc);
        return aRecepcionista({ ...doc, _id: insertedId });
      } catch (error) {
        throw traducirError(error, MENSAJES);
      }
    },

    actualizarRecepcionista(id, cambios) {
      const cambio = Object.fromEntries(['nombres', 'apellidos', 'telefono']
        .filter((c) => cambios[c] !== undefined).map((c) => [c, cambios[c]]));
      return actualizar(id, cambio);
    },

    async restablecerPasswordRecepcionista(id, passwordHash) {
      await actualizar(id, { password_hash: passwordHash });
    },

    cambiarEstadoRecepcionista(id, activo) {
      return actualizar(id, { activo });
    },
  };
}
