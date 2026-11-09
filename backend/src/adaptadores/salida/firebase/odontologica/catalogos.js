import { mismaEspecialidad } from '../../../../dominio/especialidades.js';
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

/** Nombre de la especialidad de un odontólogo (los que no tienen una son de odontología general). */
export const especialidadDe = (doc) => doc.get('especialidad') ?? 'Odontología';

/**
 * Dentro de una transacción: si la especialidad no está en el catálogo, la
 * agrega. Devuelve una función que hace la escritura, porque Firestore exige
 * hacer todas las lecturas antes de la primera escritura.
 */
export async function prepararEspecialidad(t, db, nombre) {
  if (!nombre) return () => {};
  const catalogo = db.collection(COLECCIONES.especialidades);
  const todas = await t.get(catalogo);
  if (todas.docs.some((d) => mismaEspecialidad(d.get('nombre'), nombre))) return () => {};
  return () => t.set(catalogo.doc(), { nombre });
}

/**
 * Catálogo de especialidades (colección especialidades). Los odontólogos
 * guardan una copia del nombre: renombrar cambia el catálogo y a todos sus
 * odontólogos en UNA transacción. Firestore no tiene UNIQUE: el nombre
 * repetido (sin importar tildes ni mayúsculas) se revisa dentro de la
 * transacción.
 */
function especialidades(db) {
  const catalogo = db.collection(COLECCIONES.especialidades);
  const odontologos = db.collection(COLECCIONES.odontologos);
  const cuenta = (n) => `${n} ${n === 1 ? 'odontólogo' : 'odontólogos'}`;
  const aRegistro = (doc, docsOdontologos) => ({
    id: doc.id,
    nombre: doc.get('nombre'),
    nota: cuenta(docsOdontologos.filter((o) => mismaEspecialidad(especialidadDe(o), doc.get('nombre'))).length),
  });

  return {
    async listar() {
      const [docs, odon] = await Promise.all([catalogo.get(), odontologos.get()]);
      return docs.docs.map((d) => aRegistro(d, odon.docs))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    },
    async crear({ nombre }) {
      const ref = catalogo.doc();
      await enTransaccion(db, async (t) => {
        const todas = await t.get(catalogo);
        if (todas.docs.some((d) => mismaEspecialidad(d.get('nombre'), nombre))) throw new Conflicto('Ya existe esa especialidad');
        t.set(ref, { nombre });
      });
      return { id: ref.id, nombre, nota: cuenta(0) };
    },
    async actualizar(id, { nombre }) {
      return enTransaccion(db, async (t) => {
        const [actual, todas, odon] = await Promise.all([t.get(catalogo.doc(id)), t.get(catalogo), t.get(odontologos)]);
        if (!actual.exists) throw new NoEncontrado('Especialidad no encontrada');
        if (todas.docs.some((d) => d.id !== id && mismaEspecialidad(d.get('nombre'), nombre))) throw new Conflicto('Ya existe esa especialidad');
        const suyos = odon.docs.filter((o) => mismaEspecialidad(especialidadDe(o), actual.get('nombre')));
        t.update(actual.ref, { nombre });
        for (const o of suyos) t.update(o.ref, { especialidad: nombre });
        return { id, nombre, nota: cuenta(suyos.length) };
      });
    },
  };
}

export function crearCatalogosAdmin(db) {
  return {
    especialidades: especialidades(db),
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
