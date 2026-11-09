// Especialidades de los médicos. El hospital las tiene en su propia tabla; en
// las demás instituciones son un dato de cada médico, así que la lista es la
// de las especialidades en uso. En ambos casos el formulario ofrece la lista
// y una opción para escribir una nueva.
//
// Para no terminar con "Cardiología" y "Cardiologia" como si fueran dos, una
// especialidad escrita a mano se compara con las que ya existen sin importar
// tildes, mayúsculas ni espacios de más; si coincide, se usa la que ya existe.

const clave = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** ¿Son la misma especialidad? (sin importar tildes, mayúsculas ni espacios) */
export const mismaEspecialidad = (a, b) => clave(a) === clave(b);

/** Nombre a guardar: el de la lista si ya existe, o el escrito (con espacios ordenados). */
export function normalizarEspecialidad(nombre, existentes = []) {
  if (nombre == null || String(nombre).trim() === '') return nombre ?? null;
  const igual = existentes.find((e) => clave(e) === clave(nombre));
  if (igual) return igual;
  const limpio = String(nombre).replace(/\s+/g, ' ').trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Lista sin repetidos (por la misma comparación), ordenada. */
export function listaDeEspecialidades(nombres) {
  const unicas = new Map(); // se queda con la primera forma escrita de cada una
  for (const n of nombres) if (n && String(n).trim() && !unicas.has(clave(n))) unicas.set(clave(n), String(n).trim());
  return [...unicas.values()].sort((a, b) => a.localeCompare(b, 'es'));
}
