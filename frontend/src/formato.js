// Formatos para mostrar datos. El backend manda fechas en texto y en hora de
// Guatemala ('AAAA-MM-DD' o 'AAAA-MM-DD HH:MM:SS'): se muestran tal cual, sin
// convertir zonas horarias.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fecha(texto) {
  if (!texto) return '—';
  const [a, m, d] = texto.slice(0, 10).split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]} ${a}`;
}

export function fechaHora(texto) {
  if (!texto) return '—';
  const hora = texto.slice(11, 16);
  return hora ? `${fecha(texto)}, ${hora}` : fecha(texto);
}

export function edad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const [a, m, d] = fechaNacimiento.split('-').map(Number);
  const hoy = new Date();
  let anios = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) anios--;
  if (anios >= 2) return `${anios} años`;
  const meses = (hoy.getFullYear() - a) * 12 + (hoy.getMonth() + 1 - m) - (hoy.getDate() < d ? 1 : 0);
  return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

const QUETZALES = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
export const dinero = (n) => (n == null ? '—' : QUETZALES.format(n));

export const nombreCompleto = (p) => [p?.nombres, p?.apellidos].filter(Boolean).join(' ');

export const SEXO = { M: 'Masculino', F: 'Femenino' };

export const MOTIVOS_BAJA = {
  traslado: 'Traslado a otra institución',
  fallecimiento: 'Fallecimiento',
  mayoria_edad: 'Mayoría de edad',
  administrativo: 'Causa administrativa',
  otro: 'Otro',
};

export const PARENTESCOS = [
  'madre', 'padre', 'abuela', 'abuelo', 'tia', 'tio', 'hermana', 'hermano',
  'conyuge', 'hija', 'hijo', 'tutor_legal', 'otro',
];
// El responsable de un menor (pediátrico) no puede ser cónyuge ni hijo: lo valida también el backend.
export const PARENTESCOS_DE_MENOR = PARENTESCOS.filter((p) => !['conyuge', 'hija', 'hijo'].includes(p));
export const parentescosPara = (institucion) => (institucion === 'pediatrico' ? PARENTESCOS_DE_MENOR : PARENTESCOS);
export const etiqueta = (valor) => (valor ?? '').replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase());

export const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const VIAS = ['oral', 'intramuscular', 'intravenosa', 'subcutanea', 'topica', 'inhalada', 'oftalmica', 'otica', 'nasal', 'rectal'];
