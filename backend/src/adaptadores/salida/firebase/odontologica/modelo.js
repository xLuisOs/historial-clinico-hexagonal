// Nombres de las colecciones y reglas del modelo documental de la clínica.
// Lo usan el adaptador y el script de semilla.

export const COLECCIONES = {
  pacientes: 'paciente',
  citas: 'citas',
  consultas: 'consultas',
  usuarios: 'usuarios',
  odontologos: 'odontologos',
  recepcionistas: 'recepcionistas',
  procedimientos: 'procedimientos',
  medicamentos: 'medicamentos',
};

// Roles del modelo de la clínica → roles comunes del backend (casos-uso.js).
export const ROLES = {
  odontologo: 'medico',
  recepcionista: 'recepcion',
  administrador: 'admin',
};

/** Minúsculas y sin tildes: "José Muñoz" → "jose munoz". */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function palabras(texto) {
  return normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Firestore no tiene LIKE: cada paciente guarda los prefijos de cada palabra
 * de su nombre ("lo", "lop", "lope", "lopez"...) y la búsqueda usa
 * array-contains. Así "lop" encuentra a María José López García.
 */
export function terminosBusqueda(nombres, apellidos) {
  const terminos = new Set();
  for (const palabra of palabras(`${nombres} ${apellidos}`)) {
    terminos.add(palabra);
    for (let largo = 2; largo < palabra.length; largo++) terminos.add(palabra.slice(0, largo));
  }
  return [...terminos];
}

export const nombreCompleto = (persona) =>
  [persona?.nombres, persona?.apellidos].filter(Boolean).join(' ') || null;
