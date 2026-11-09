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
    // Las especialidades son un dato de cada médico: aquí se listan las que
    // están en uso y se corrige su nombre en todos los médicos a la vez.
    especialidades: {
      titulo: 'Especialidades',
      singular: 'especialidad',
      sinAlta: true,
      ayuda: 'Una especialidad nueva aparece aquí al registrar un médico con ella. Si le cambias el nombre, se corrige en todos los médicos que la tienen.',
      campos: [nombre(80)],
    },
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
    // Las especialidades son un dato de cada médico: aquí se listan las que
    // están en uso y se corrige su nombre en todos los médicos a la vez.
    especialidades: {
      titulo: 'Especialidades',
      singular: 'especialidad',
      sinAlta: true,
      ayuda: 'Una especialidad nueva aparece aquí al registrar un médico con ella. Si le cambias el nombre, se corrige en todos los médicos que la tienen.',
      campos: [nombre(80)],
    },
  },

  laboratorio: {
    // Cada examen lleva sus parámetros (qué se mide y su rango de referencia).
    // Las órdenes guardan una copia de los parámetros, así que cambiarlos no
    // altera resultados ya registrados.
    tiposExamen: {
      titulo: 'Tipos de examen',
      singular: 'tipo de examen',
      campos: [
        {
          clave: 'codigo', etiqueta: 'Código', tipo: 'texto', requerido: true, max: 15, soloAlCrear: true,
          mayusculas: true, patron: '^[A-Z0-9_]{2,15}$', mensajePatron: 'De 2 a 15 letras, números o guion bajo (p. ej. GLU)',
        },
        nombre(),
        { clave: 'categoria', etiqueta: 'Categoría', tipo: 'texto', requerido: true, max: 50 },
        { clave: 'muestra', etiqueta: 'Muestra', tipo: 'texto', requerido: true, max: 50 },
        descripcion,
        { clave: 'precio', etiqueta: 'Precio (Q)', tipo: 'dinero' },
        { clave: 'parametros', etiqueta: 'Parámetros', tipo: 'parametros', requerido: true },
      ],
      estado: ESTADO_COMUN,
    },
    medicamentos: { titulo: 'Medicamentos', singular: 'medicamento', campos: [nombre(), presentacion(true)], estado: ESTADO_COMUN },
    // Las especialidades son un dato de cada médico: aquí se listan las que
    // están en uso y se corrige su nombre en todos los médicos a la vez.
    especialidades: {
      titulo: 'Especialidades',
      singular: 'especialidad',
      sinAlta: true,
      ayuda: 'Una especialidad nueva aparece aquí al registrar un médico con ella. Si le cambias el nombre, se corrige en todos los médicos que la tienen.',
      campos: [nombre(80)],
    },
  },
};

// Parámetros de un tipo de examen. Las mismas reglas que el validador de la
// colección tipos_examen (db/mongo/esquemas.js).
export const TIPOS_VALOR = ['numerico', 'texto', 'opcion'];
const CODIGO_PARAMETRO = /^[A-Z0-9_]{1,20}$/;

function validarParametros(v, clave, lista) {
  if (!Array.isArray(lista) || lista.length === 0) {
    v.error(clave, 'Agrega al menos un parámetro');
    return [];
  }
  const codigos = new Set();
  return lista.map((p = {}, i) => {
    const pre = `${clave}[${i}]`;
    const codigo = typeof p.codigo === 'string' ? p.codigo.trim().toUpperCase() : p.codigo;
    if (!codigo) v.error(`${pre}.codigo`, 'Es obligatorio');
    else if (!CODIGO_PARAMETRO.test(codigo)) v.error(`${pre}.codigo`, 'Letras, números o guion bajo');
    else if (codigos.has(codigo)) v.error(`${pre}.codigo`, 'Repetido en este examen');
    codigos.add(codigo);
    const tipoValor = v.opcion(`${pre}.tipoValor`, p.tipoValor, TIPOS_VALOR, { requerido: true });
    const parametro = {
      codigo,
      nombre: v.texto(`${pre}.nombre`, p.nombre, { requerido: true, max: 100 }),
      tipoValor,
      unidad: null,
      refMin: null,
      refMax: null,
      opciones: null,
      valorNormal: null,
    };
    if (tipoValor === 'numerico') {
      parametro.unidad = v.texto(`${pre}.unidad`, p.unidad, { max: 30 });
      parametro.refMin = v.numero(`${pre}.refMin`, p.refMin === '' ? null : p.refMin, { min: -1_000_000, max: 1_000_000 });
      parametro.refMax = v.numero(`${pre}.refMax`, p.refMax === '' ? null : p.refMax, { min: -1_000_000, max: 1_000_000 });
      if (parametro.refMin !== null && parametro.refMax !== null && parametro.refMin > parametro.refMax) {
        v.error(`${pre}.refMax`, 'Debe ser mayor o igual que el mínimo');
      }
    } else {
      parametro.valorNormal = v.texto(`${pre}.valorNormal`, p.valorNormal, { max: 100 });
    }
    if (tipoValor === 'opcion') {
      const opciones = (Array.isArray(p.opciones) ? p.opciones : String(p.opciones ?? '').split(','))
        .map((o) => String(o).trim()).filter(Boolean);
      if (opciones.length < 2) v.error(`${pre}.opciones`, 'Escribe al menos dos opciones, separadas por coma');
      if (parametro.valorNormal && !opciones.includes(parametro.valorNormal)) v.error(`${pre}.valorNormal`, 'Debe ser una de las opciones');
      parametro.opciones = opciones;
    }
    return parametro;
  });
}

/** Catálogos de la institución, para la pantalla (sin las reglas internas). */
export function catalogosDe(institucion) {
  return Object.entries(CATALOGOS[institucion] ?? {}).map(([clave, c]) => ({
    clave,
    titulo: c.titulo,
    singular: c.singular,
    sinAlta: Boolean(c.sinAlta),
    ayuda: c.ayuda ?? null,
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
    case 'texto': {
      const texto = campo.mayusculas && typeof valor === 'string' ? valor.trim().toUpperCase() : valor;
      const limpio = v.texto(campo.clave, texto, { ...req, max: campo.max });
      if (limpio && campo.patron && !new RegExp(campo.patron).test(limpio)) v.error(campo.clave, campo.mensajePatron);
      return limpio;
    }
    case 'parametros':
      return validarParametros(v, campo.clave, valor);
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
  if (def.sinAlta) throw new DatosInvalidos('Este catálogo no admite registros nuevos');
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
  if (!def.estado) throw new DatosInvalidos(`Los ${def.titulo.toLowerCase()} no se pueden desactivar`);
  if (typeof datos.activo !== 'boolean') throw new DatosInvalidos('Datos inválidos', { activo: 'Indica true o false' });
  return datos.activo;
}

/** Mensaje cuando un dato histórico ya no se puede cambiar. */
export const mensajeHistorico = (que) => (que === 'recetas'
  ? 'Ya se usó en recetas: su nombre y presentación no se cambian para no alterar lo registrado. Si es otro, regístralo aparte.'
  : `Ya se usó en ${que}: su nombre no se cambia para no alterar lo registrado. Si es otro, regístralo aparte.`);
