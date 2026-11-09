import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { aObjectId, enTransaccionMongo, traducirError } from '../conexion.js';

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

// Sin tildes ni mayúsculas: "cardiologia" encuentra "Cardiología".
const SIN_TILDES = { locale: 'es', strength: 1 };

/** Agrega la especialidad al catálogo si todavía no está (al registrar o editar un médico referente). */
export async function asegurarEspecialidad(db, nombre) {
  if (!nombre) return;
  await db.collection('especialidades').updateOne({ nombre }, { $setOnInsert: { nombre } }, { upsert: true, collation: SIN_TILDES });
}

/**
 * Catálogo de especialidades (colección especialidades). Los médicos
 * referentes guardan una copia del nombre: renombrar cambia el catálogo y a
 * todos sus médicos en UNA transacción. El índice único (collation es, fuerza
 * 1) impide dos especialidades que solo difieran en tildes o mayúsculas.
 */
function especialidades(cliente, db) {
  const catalogo = db.collection('especialidades');
  const referentes = db.collection('medicos_referentes');
  const cuenta = (n) => `${n} ${n === 1 ? 'médico referente' : 'médicos referentes'}`;
  const repetida = { duplicado: 'Ya existe esa especialidad' };
  const contar = (nombre, session) => referentes.countDocuments({ especialidad: nombre }, { collation: SIN_TILDES, session });
  const aRegistro = async (doc, session) => ({ id: doc._id.toHexString(), nombre: doc.nombre, nota: cuenta(await contar(doc.nombre, session)) });

  return {
    async listar() {
      const docs = await catalogo.find().sort({ nombre: 1 }).collation({ locale: 'es' }).toArray();
      return Promise.all(docs.map((d) => aRegistro(d)));
    },
    async crear({ nombre }) {
      try {
        const { insertedId } = await catalogo.insertOne({ nombre });
        return { id: insertedId.toHexString(), nombre, nota: cuenta(0) };
      } catch (error) {
        throw traducirError(error, repetida);
      }
    },
    actualizar(id, { nombre }) {
      return enTransaccionMongo(cliente, async (session) => {
        const actual = await catalogo.findOne({ _id: aObjectId(id, 'Especialidad') }, { session });
        if (!actual) throw new NoEncontrado('Especialidad no encontrada');
        try {
          await catalogo.updateOne({ _id: actual._id }, { $set: { nombre } }, { session });
        } catch (error) {
          throw traducirError(error, repetida);
        }
        await referentes.updateMany({ especialidad: actual.nombre }, { $set: { especialidad: nombre } }, { collation: SIN_TILDES, session });
        return aRegistro({ ...actual, nombre }, session);
      });
    },
  };
}

export function crearCatalogosAdmin(cliente, db) {
  return {
    especialidades: especialidades(cliente, db),
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
