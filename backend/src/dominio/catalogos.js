import { DatosInvalidos, NoEncontrado } from './errores.js';
import { Validador } from './validacion.js';

// Catálogos que administra el admin de cada institución: las listas de las que
// el sistema escoge (habitaciones, procedimientos y sus precios, servicios,
// medicamentos, tipos de examen...). Qué catálogos hay y qué campos tienen
// depende de la INSTITUCIÓN, nunca del motor; cada adaptador los guarda con
// las tablas o colecciones que ya tiene (sin cambiar su base).
//
// Reglas comunes:
//   * Nada se borra: lo que ya se usó en historiales, cobros o facturas se
//     desactiva (si el catálogo tiene estado) y deja de ofrecerse.
//   * Cambiar un precio no altera lo ya cobrado: cada cobro guarda su precio.
//   * `soloAlCrear`: el campo no se edita después (p. ej. el número de una
//     habitación o el código de un examen).
//   * `historico`: donde la base lee ese dato del catálogo para mostrar
//     historiales (PostgreSQL y MySQL, por llave foránea), el adaptador no deja
//     cambiarlo si el registro ya se usó; así no se reescribe lo ya recetado o
//     cobrado. Firestore y MongoDB guardan una copia en cada receta u orden.
//
// Campo = { clave, etiqueta, tipo: 'texto' | 'dinero' | 'opcion' | 'referencia',
//           requerido?, max?, opciones?, catalogo? (de la referencia),
//           soloAlCrear?, historico? }
// Registro (lo que devuelve un adaptador) = { id, ...campos, activo?, nota?,
//   estadoFijo? (true si ahora no se puede activar ni desactivar) }

const nombre = (max = 100, extra = {}) => ({ clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, max, ...extra });
const presentacion = (requerido) => ({ clave: 'presentacion', etiqueta: 'Presentación', tipo: 'texto', requerido, max: 100, historico: true });
const descripcion = { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', max: 300 };

const ESTADO_COMUN = { activo: 'Activo', inactivo: 'Inactivo', desactivar: 'Desactivar', activar: 'Reactivar' };

const CATALOGOS = {
  hospital: {
    habitaciones: {
      titulo: 'Habitaciones',
      singular: 'habitación',
      campos: [
        { clave: 'numero', etiqueta: 'Número', tipo: 'texto', requerido: true, max: 10, soloAlCrear: true },
        { clave: 'tipo', etiqueta: 'Tipo', tipo: 'opcion', requerido: true, opciones: ['individual', 'compartida', 'intensivos'] },
        { clave: 'departamentoId', etiqueta: 'Departamento', tipo: 'referencia', catalogo: 'departamentos' },
      ],
      // Una habitación "inactiva" está en mantenimiento: no se asigna al internar.
      estado: { activo: 'Disponible', inactivo: 'En mantenimiento', desactivar: 'Poner en mantenimiento', activar: 'Habilitar' },
    },
    medicamentos: {
      titulo: 'Medicamentos',
      singular: 'medicamento',
      campos: [
        nombre(100, { historico: true }),
        presentacion(false),
        { clave: 'principioActivo', etiqueta: 'Principio activo', tipo: 'texto', max: 100 },
      ],
    },
    especialidades: { titulo: 'Especialidades', singular: 'especialidad', campos: [nombre(80)] },
    departamentos: {
      titulo: 'Departamentos',
      singular: 'departamento',
      campos: [nombre(80), { clave: 'ubicacion', etiqueta: 'Ubicación', tipo: 'texto', max: 120 }],
    },
  },

  odontologica: {
    procedimientos: {
      titulo: 'Procedimientos',
      singular: 'procedimiento',
      campos: [nombre(), descripcion, { clave: 'costo', etiqueta: 'Costo (Q)', tipo: 'dinero', requerido: true }],
      estado: ESTADO_COMUN,
    },
    medicamentos: { titulo: 'Medicamentos', singular: 'medicamento', campos: [nombre(), presentacion(true)], estado: ESTADO_COMUN },
  },

  pediatrico: {
    servicios: {
      titulo: 'Servicios',
      singular: 'servicio',
      campos: [nombre(100, { historico: true }), descripcion, { clave: 'precio', etiqueta: 'Precio (Q)', tipo: 'dinero', requerido: true }],
      estado: ESTADO_COMUN,
    },
    medicamentos: {
      titulo: 'Medicamentos',
      singular: 'medicamento',
      campos: [nombre(100, { historico: true }), presentacion(true)],
      estado: ESTADO_COMUN,
    },
  },

  laboratorio: {
    // Un tipo de examen nuevo necesita sus parámetros y rangos de referencia:
    // se cargan con la semilla. Aquí se editan sus datos generales y su precio.
    tiposExamen: {
      titulo: 'Tipos de examen',
      singular: 'tipo de examen',
      sinAlta: true,
      campos: [
        { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', requerido: true, max: 15, soloAlCrear: true },
        nombre(),
        { clave: 'categoria', etiqueta: 'Categoría', tipo: 'texto', requerido: true, max: 50 },
        { clave: 'muestra', etiqueta: 'Muestra', tipo: 'texto', requerido: true, max: 50 },
        descripcion,
        { clave: 'precio', etiqueta: 'Precio (Q)', tipo: 'dinero' },
      ],
      estado: ESTADO_COMUN,
    },
    medicamentos: { titulo: 'Medicamentos', singular: 'medicamento', campos: [nombre(), presentacion(true)], estado: ESTADO_COMUN },
  },
};

/** Catálogos de la institución, para la pantalla (sin las reglas internas). */
export function catalogosDe(institucion) {
  return Object.entries(CATALOGOS[institucion] ?? {}).map(([clave, c]) => ({
    clave,
    titulo: c.titulo,
    singular: c.singular,
    sinAlta: Boolean(c.sinAlta),
    estado: c.estado ?? null,
    campos: c.campos,
  }));
}

export function definicionCatalogo(institucion, clave) {
  const c = CATALOGOS[institucion]?.[clave];
  if (!c) throw new NoEncontrado('Esa institución no tiene ese catálogo');
  return c;
}

function validarCampo(v, campo, valor) {
  const req = { requerido: Boolean(campo.requerido) };
  switch (campo.tipo) {
    case 'texto':
      return v.texto(campo.clave, valor, { ...req, max: campo.max });
    case 'opcion':
      return v.opcion(campo.clave, valor, campo.opciones, req);
    case 'dinero': {
      const monto = v.numero(campo.clave, valor === '' ? null : valor, { ...req, min: 0, max: 1_000_000 });
      if (monto !== null && Math.round(monto * 100) !== monto * 100) v.error(campo.clave, 'Máximo dos decimales');
      return monto;
    }
    case 'referencia':
      return v.texto(campo.clave, valor == null || valor === '' ? null : String(valor), req);
    default:
      throw new Error(`Tipo de campo desconocido: ${campo.tipo}`);
  }
}

/** Registro nuevo: todos los campos del catálogo. */
export function validarNuevoRegistro(institucion, clave, datos = {}) {
  const def = definicionCatalogo(institucion, clave);
  if (def.sinAlta) throw new DatosInvalidos(`Los ${def.titulo.toLowerCase()} nuevos se cargan con la semilla`);
  const v = new Validador();
  const registro = Object.fromEntries(def.campos.map((c) => [c.clave, validarCampo(v, c, datos[c.clave])]));
  v.lanzarSiHayErrores();
  return registro;
}

/** Edición: solo los campos que vienen; los de `soloAlCrear` no se cambian. */
export function validarCambiosRegistro(institucion, clave, datos = {}) {
  const def = definicionCatalogo(institucion, clave);
  const v = new Validador();
  const cambios = {};
  for (const campo of def.campos) {
    if (!(campo.clave in datos)) continue;
    if (campo.soloAlCrear) v.error(campo.clave, `${campo.etiqueta} no se cambia después de registrarlo`);
    else cambios[campo.clave] = validarCampo(v, campo, datos[campo.clave]);
  }
  v.lanzarSiHayErrores();
  if (Object.keys(cambios).length === 0) throw new DatosInvalidos('No hay cambios');
  return cambios;
}

/** { activo: true | false }, solo en catálogos con estado. */
export function validarEstadoRegistro(institucion, clave, datos = {}) {
  const def = definicionCatalogo(institucion, clave);
  if (!def.estado) throw new DatosInvalidos(`Los ${def.titulo.toLowerCase()} no se desactivan: no tienen estado en la base`);
  if (typeof datos.activo !== 'boolean') throw new DatosInvalidos('Datos inválidos', { activo: 'Indica true o false' });
  return datos.activo;
}

/** Mensaje cuando un dato histórico ya no se puede cambiar. */
export const mensajeHistorico = (que) => (que === 'recetas'
  ? 'Ya se usó en recetas: su nombre y presentación no se cambian para no alterar lo registrado. Si es otro, regístralo aparte.'
  : `Ya se usó en ${que}: su nombre no se cambia para no alterar lo registrado. Si es otro, regístralo aparte.`);
