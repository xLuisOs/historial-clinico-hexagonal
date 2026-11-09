import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { aObjectId, traducirError } from '../conexion.js';

// Catálogos del laboratorio que mantiene el admin (ver dominio/catalogos.js):
// tipos de examen (datos generales y precio) y medicamentos, con las
// colecciones que ya existen. Las órdenes y recetas guardan una copia del
// nombre, así que corregir el catálogo no altera lo ya registrado. Cada cambio
// es una sola escritura sobre un documento (atómica sin transacción); los
// índices únicos y el validador $jsonSchema de la colección son la última
// defensa.

/**
 * `campos`: clave del dominio → campo del documento.
 * `convertir`: para los campos que no se guardan tal cual, { aDocumento, aDominio }.
 */
function catalogo(db, coleccion, { campos, unico, repetido, entidad, orden, convertir = {} }) {
  const col = db.collection(coleccion);
  const aRegistro = (doc) => ({
    id: doc._id.toHexString(),
    ...Object.fromEntries(Object.entries(campos).map(([clave, campo]) => {
      const valor = doc[campo] ?? null;
      return [clave, convertir[clave] && valor !== null ? convertir[clave].aDominio(valor) : valor];
    })),
    activo: doc.activo === true,
  });
  const aDocumento = (datos) => Object.fromEntries(
    Object.entries(campos).filter(([clave]) => datos[clave] !== undefined).map(([clave, campo]) => [
      campo, convertir[clave] && datos[clave] !== null ? convertir[clave].aDocumento(datos[clave]) : datos[clave],
    ]),
  );
  // Revisión previa sin importar mayúsculas (el índice único sí distingue).
  async function sinRepetir(datos, id = null) {
    const filtro = Object.fromEntries(unico.map((c) => [campos[c], datos[c]]));
    const otro = await col.findOne({ ...filtro, ...(id && { _id: { $ne: id } }) }, { collation: { locale: 'es', strength: 2 } });
    if (otro) throw new Conflicto(repetido);
  }
  // En un documento, "sin valor" es no tener el campo: los null se quitan ($unset).
  async function escribir(id, cambio) {
    const quitar = Object.keys(cambio).filter((c) => cambio[c] === null);
    const poner = Object.fromEntries(Object.entries(cambio).filter(([, v]) => v !== null));
    try {
      const doc = await col.findOneAndUpdate(
        { _id: id },
        { ...(Object.keys(poner).length && { $set: poner }), ...(quitar.length && { $unset: Object.fromEntries(quitar.map((c) => [c, ''])) }) },
        { returnDocument: 'after' },
      );
      if (!doc) throw new NoEncontrado(`${entidad} no encontrado`);
      return aRegistro(doc);
    } catch (error) {
      throw traducirError(error, { duplicado: repetido });
    }
  }

  return {
    async listar() {
      const docs = await col.find().sort({ activo: -1, ...orden }).collation({ locale: 'es' }).toArray();
      return docs.map(aRegistro);
    },
    async crear(datos) {
      await sinRepetir(datos);
      const doc = { ...Object.fromEntries(Object.entries(aDocumento(datos)).filter(([, v]) => v !== null)), activo: true };
      try {
        const { insertedId } = await col.insertOne(doc);
        return aRegistro({ ...doc, _id: insertedId });
      } catch (error) {
        throw traducirError(error, { duplicado: repetido });
      }
    },
    async actualizar(registroId, cambios) {
      const id = aObjectId(registroId, entidad);
      const actual = await col.findOne({ _id: id });
      if (!actual) throw new NoEncontrado(`${entidad} no encontrado`);
      if (unico.some((c) => cambios[c] !== undefined)) await sinRepetir({ ...aRegistro(actual), ...cambios }, id);
      return escribir(id, aDocumento(cambios));
    },
    cambiarEstado(registroId, activo) {
      return escribir(aObjectId(registroId, entidad), { activo });
    },
  };
}

// Parámetro de un examen: dominio (camelCase) ↔ documento (snake_case). En el
// documento no se guardan los campos vacíos (el validador no acepta opciones: null).
const parametros = {
  aDocumento: (lista) => lista.map((p) => Object.fromEntries(Object.entries({
    codigo: p.codigo,
    nombre: p.nombre,
    tipo_valor: p.tipoValor,
    unidad: p.unidad,
    ref_min: p.refMin,
    ref_max: p.refMax,
    opciones: p.opciones,
    valor_normal: p.valorNormal,
  }).filter(([, v]) => v !== null && v !== undefined))),
  aDominio: (lista) => lista.map((p) => ({
    codigo: p.codigo,
    nombre: p.nombre,
    tipoValor: p.tipo_valor,
    unidad: p.unidad ?? null,
    refMin: p.ref_min ?? null,
    refMax: p.ref_max ?? null,
    opciones: p.opciones ?? null,
    valorNormal: p.valor_normal ?? null,
  })),
};

/**
 * Especialidades en uso entre los médicos referentes. Cambiar el nombre lo
 * corrige en todos con updateMany; la colación 'es' (nivel 1) ignora
 * mayúsculas y tildes al buscar.
 */
function especialidades(db) {
  const referentes = db.collection('medicos_referentes');
  const cuenta = (n) => `${n} ${n === 1 ? 'médico referente' : 'médicos referentes'}`;
  return {
    async listar() {
      const grupos = await referentes.aggregate([
        { $match: { especialidad: { $type: 'string' } } },
        { $group: { _id: '$especialidad', medicos: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ], { collation: { locale: 'es', strength: 1 } }).toArray();
      return grupos.map((g) => ({ id: g._id, nombre: g._id, nota: cuenta(g.medicos) }));
    },
    async actualizar(id, { nombre }) {
      const r = await referentes.updateMany({ especialidad: id }, { $set: { especialidad: nombre } }, { collation: { locale: 'es', strength: 1 } });
      if (r.matchedCount === 0) throw new NoEncontrado('Especialidad no encontrada');
      return { id: nombre, nombre, nota: cuenta(r.matchedCount) };
    },
  };
}

export function crearCatalogosAdmin(db) {
  return {
    especialidades: especialidades(db),
    // Las órdenes guardan una copia de los parámetros: cambiarlos aquí no
    // altera resultados ya registrados.
    tiposExamen: catalogo(db, 'tipos_examen', {
      campos: {
        codigo: 'codigo', nombre: 'nombre', categoria: 'categoria', muestra: 'muestra',
        descripcion: 'descripcion', precio: 'precio', parametros: 'parametros',
      },
      convertir: { parametros },
      unico: ['codigo'], repetido: 'Ya existe un tipo de examen con ese código', entidad: 'Tipo de examen',
      orden: { categoria: 1, nombre: 1 },
    }),
    medicamentos: catalogo(db, 'medicamentos', {
      campos: { nombre: 'nombre', presentacion: 'presentacion' },
      unico: ['nombre', 'presentacion'], repetido: 'Ya existe ese medicamento con esa presentación', entidad: 'Medicamento',
      orden: { nombre: 1, presentacion: 1 },
    }),
  };
}
