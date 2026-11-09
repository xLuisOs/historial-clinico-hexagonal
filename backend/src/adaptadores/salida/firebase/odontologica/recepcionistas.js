import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { COLECCIONES, nombreCompleto } from './modelo.js';

// Recepcionistas de la clínica, administradas por el admin (ver
// dominio/recepcionista.js). La persona va en `recepcionistas` y su cuenta en
// `usuarios` (rol 'recepcionista', recepcionista_id). Firestore no tiene UNIQUE:
// el correo repetido se revisa dentro de la transacción, y la persona y su
// usuario se escriben juntos.

export function crearRepositorioRecepcionistas(db) {
  const col = (nombre) => db.collection(COLECCIONES[nombre]);

  const aRecepcionista = (doc, usuario) => ({
    id: doc.id,
    nombre: nombreCompleto(doc.data()),
    nombres: doc.get('nombres'),
    apellidos: doc.get('apellidos'),
    telefono: doc.get('telefono') ?? null,
    correo: usuario?.get('correo') ?? null,
    activo: doc.get('activo') !== false,
  });

  // Usuario de la recepcionista: dentro de una transacción se lee con t.get(); fuera, con .get().
  const usuarioDe = (id, t = null) => {
    const consulta = col('usuarios').where('recepcionista_id', '==', id).limit(1);
    return t ? t.get(consulta) : consulta.get();
  };

  async function exigir(t, id) {
    const snap = await t.get(col('recepcionistas').doc(id));
    if (!snap.exists) throw new NoEncontrado('Recepcionista no encontrada');
    return snap;
  }

  async function leer(id) {
    const [doc, usuario] = await Promise.all([col('recepcionistas').doc(id).get(), usuarioDe(id)]);
    return aRecepcionista(doc, usuario.docs[0]);
  }

  return {
    async listarRecepcionistas() {
      const [recepcionistas, usuarios] = await Promise.all([
        col('recepcionistas').get(),
        col('usuarios').where('rol', '==', 'recepcionista').get(),
      ]);
      const porRecepcionista = new Map(usuarios.docs.map((u) => [u.get('recepcionista_id'), u]));
      return recepcionistas.docs
        .map((d) => aRecepcionista(d, porRecepcionista.get(d.id)))
        .sort((a, b) => b.activo - a.activo || (a.apellidos ?? '').localeCompare(b.apellidos ?? '', 'es'));
    },

    async registrarRecepcionista(r) {
      const ref = col('recepcionistas').doc();
      await enTransaccion(db, async (t) => {
        const repetido = await t.get(col('usuarios').where('correo', '==', r.correo).limit(1));
        if (!repetido.empty) throw new Conflicto('Ya hay un usuario con ese correo');
        t.set(ref, { nombres: r.nombres, apellidos: r.apellidos, telefono: r.telefono, activo: true });
        t.set(col('usuarios').doc(), {
          correo: r.correo,
          password_hash: r.passwordHash,
          nombres: r.nombres,
          apellidos: r.apellidos,
          rol: 'recepcionista',
          odontologo_id: null,
          recepcionista_id: ref.id,
          activo: true,
          ultimo_acceso: null,
        });
      });
      return leer(ref.id);
    },

    async actualizarRecepcionista(id, cambios) {
      await enTransaccion(db, async (t) => {
        const actual = await exigir(t, id);
        const usuario = await usuarioDe(id, t);
        const datos = Object.fromEntries(['nombres', 'apellidos', 'telefono']
          .filter((c) => cambios[c] !== undefined).map((c) => [c, cambios[c]]));
        t.update(actual.ref, datos);
        // El usuario guarda una copia del nombre (es lo que se muestra al iniciar sesión).
        if (!usuario.empty) {
          t.update(usuario.docs[0].ref, {
            nombres: datos.nombres ?? actual.get('nombres'),
            apellidos: datos.apellidos ?? actual.get('apellidos'),
          });
        }
      });
      return leer(id);
    },

    async restablecerPasswordRecepcionista(id, passwordHash) {
      const usuario = await usuarioDe(id);
      if (usuario.empty) throw new NoEncontrado('Esa recepcionista no tiene usuario');
      await usuario.docs[0].ref.update({ password_hash: passwordHash });
    },

    async cambiarEstadoRecepcionista(id, activo) {
      await enTransaccion(db, async (t) => {
        const recepcionista = await exigir(t, id);
        const usuario = await usuarioDe(id, t);
        t.update(recepcionista.ref, { activo });
        if (!usuario.empty) t.update(usuario.docs[0].ref, { activo });
      });
      return leer(id);
    },
  };
}
