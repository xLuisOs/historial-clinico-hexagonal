// Teléfonos de Guatemala: exactamente 8 dígitos (no se manejan códigos de
// país ni extensiones). Se aceptan con guion o espacio en medio
// ("5555-1234", "5555 1234", "55551234") y siempre se guardan igual:
// "5555-1234".

const OCHO_DIGITOS = /^\d{8}$/;
export const MENSAJE_TELEFONO = 'Debe tener 8 dígitos (p. ej. 5555-1234)';

/** Valida y normaliza; null si viene vacío (y no es obligatorio). */
export function validarTelefono(v, campo, valor, { requerido = false } = {}) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
    if (requerido) v.error(campo, 'Es obligatorio');
    return null;
  }
  const digitos = String(valor).replace(/[\s-]/g, '');
  if (!OCHO_DIGITOS.test(digitos)) {
    v.error(campo, MENSAJE_TELEFONO);
    return null;
  }
  return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
}
