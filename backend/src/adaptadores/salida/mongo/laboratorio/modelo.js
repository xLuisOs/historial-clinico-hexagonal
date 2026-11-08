// Utilidades del modelo documental del laboratorio (ver db/mongo/esquemas.js).

// Roles del laboratorio → roles comunes del backend (casos-uso.js).
// El químico biólogo es quien atiende: registra órdenes, resultados y los valida.
export const ROLES = {
  quimico_biologo: 'medico',
  recepcion: 'recepcion',
  admin: 'admin',
};

/** Minúsculas y sin tildes: "José Muñoz" → "jose munoz". */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const nombreBusqueda = (nombres, apellidos) => normalizar(`${nombres} ${apellidos}`);

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Filtro de búsqueda por nombre: cada palabra escrita debe ser el inicio de
 * alguna palabra del nombre. "lop mar" encuentra a "María López".
 */
export function filtroPorNombre(texto) {
  const palabras = normalizar(texto).split(' ').filter(Boolean);
  return { $and: palabras.map((p) => ({ nombre_busqueda: { $regex: `(^| )${escaparRegex(p)}` } })) };
}

export const nombreCompleto = (p) => [p?.nombres, p?.apellidos].filter(Boolean).join(' ');
