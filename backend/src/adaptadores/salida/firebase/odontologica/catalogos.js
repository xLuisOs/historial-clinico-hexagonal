import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { COLECCIONES } from './modelo.js';

// Catálogos de la clínica que mantiene el admin (ver dominio/catalogos.js):
// procedimientos (con su costo) y medicamentos, con los campos que ya tienen.
// Las consultas y recetas guardan una copia del nombre y del precio aplicado,
// así que corregir el catálogo no altera lo ya registrado. Firestore no tiene
// UNIQUE: el nombre repetido se revisa dentro de la transacción (los catálogos
// son pocos documentos).

/**
 * `campos`: clave del dominio → campo del documento.
 * `unico`: claves que juntas no se pueden repetir (sin importar mayúsculas).
 */
function catalogo(db, coleccion, { campos, unico, repetido, entidad }) {
  const col = db.collection(COLECCIONES[coleccion]);
  const aRegistro = (doc) => ({
    id: doc.id,
    ...Object.fromEntries(Object.entries(campos).map(([clave, campo]) => [clave, doc.get(campo) ?? null])),
    activo: doc.get('activo') !== false,
  });
  const llave = (datos) => unico.map((c) => String(datos[c] ?? '').trim().toLowerCase()).join('|');

  async function sinRepetir(t, datos, id = null) {
    const todos = await t.get(col);
    if (todos.docs.some((d) => d.id !== id && llave(aRegistro(d)) === llave(datos))) throw new Conflicto(repetido);
  }
  async function leer(id) {
    const doc = await col.doc(id).get();
    if (!doc.exists) throw new NoEncontrado(`${entidad} no encontrado`);
    return aRegistro(doc);
  }
  const aDocumento = (datos) => Object.fromEntries(
    Object.entries(campos).filter(([clave]) => datos[clave] !== undefined).map(([clave, campo]) => [campo, datos[clave]]),
  );

  return {
    async listar() {
      const snap = await col.get();
      return snap.docs.map(aRegistro)
        .sort((a, b) => b.activo - a.activo || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    },
    async crear(datos) {
      const ref = col.doc();
      await enTransaccion(db, async (t) => {
        await sinRepetir(t, datos);
        t.set(ref, { ...aDocumento(datos), activo: true });
      });
      return leer(ref.id);
    },
    async actualizar(id, cambios) {
      await enTransaccion(db, async (t) => {
        const actual = await t.get(col.doc(id));
        if (!actual.exists) throw new NoEncontrado(`${entidad} no encontrado`);
        if (unico.some((c) => cambios[c] !== undefined)) await sinRepetir(t, { ...aRegistro(actual), ...cambios }, id);
        t.update(actual.ref, aDocumento(cambios));
      });
      return leer(id);
    },
    async cambiarEstado(id, activo) {
      await enTransaccion(db, async (t) => {
        const actual = await t.get(col.doc(id));
        if (!actual.exists) throw new NoEncontrado(`${entidad} no encontrado`);
        t.update(actual.ref, { activo });
      });
      return leer(id);
    },
  };
}

export function crearCatalogosAdmin(db) {
  return {
    procedimientos: catalogo(db, 'procedimientos', {
      campos: { nombre: 'nombre', descripcion: 'descripcion', costo: 'costo' },
      unico: ['nombre'], repetido: 'Ya existe un procedimiento con ese nombre', entidad: 'Procedimiento',
    }),
    medicamentos: catalogo(db, 'medicamentos', {
      campos: { nombre: 'nombre', presentacion: 'presentacion' },
      unico: ['nombre', 'presentacion'], repetido: 'Ya existe ese medicamento con esa presentación', entidad: 'Medicamento',
    }),
  };
}
