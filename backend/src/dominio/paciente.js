import { DatosInvalidos } from './errores.js';
import { validarTelefono } from './telefono.js';
import { Validador } from './validacion.js';

// Modelo común de paciente: es la "forma" que todos los adaptadores
// (PostgreSQL, MySQL, MongoDB, Firebase) reciben y devuelven, sin importar
// cómo lo guarde cada motor por dentro.
//
// Paciente = {
//   id, nombres, apellidos, fechaNacimiento, sexo, documento,
//   contacto:     { telefono, direccion, correo },
//   responsable:  null | { id, nombres, apellidos, parentesco, documento, telefono, direccion, correo },
//   datosClinicos:{ tipoSangre, alergias },
//   estado:       { activo, fechaRegistro, fechaBaja, motivoBaja, detalleBaja }
// }

export const SEXOS = ['M', 'F'];
export const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const MOTIVOS_BAJA = ['traslado', 'fallecimiento', 'mayoria_edad', 'administrativo', 'otro'];
export const PARENTESCOS = [
  'madre', 'padre', 'abuela', 'abuelo', 'tia', 'tio', 'hermana', 'hermano',
  'conyuge', 'hija', 'hijo', 'tutor_legal', 'otro',
];

// Quién puede ser responsable de un MENOR (el paciente del pediátrico es un
// niño): un cónyuge o un hijo no aplican. Coincide con el CHECK
// chk_encargado_parentesco de db/mysql/01_esquema.sql.
export const PARENTESCOS_DE_MENOR = PARENTESCOS.filter((p) => !['conyuge', 'hija', 'hijo'].includes(p));

// Reglas del responsable que dependen de la institución (nunca del motor).
const RESPONSABLE_POR_INSTITUCION = {
  pediatrico: { obligatorio: true, parentescos: PARENTESCOS_DE_MENOR },
};

const CUI = /^\d{13}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarContactoEn(v, prefijo, datos = {}, { telefonoRequerido = false } = {}) {
  return {
    telefono: validarTelefono(v, `${prefijo}.telefono`, datos.telefono, { requerido: telefonoRequerido }),
    direccion: v.texto(`${prefijo}.direccion`, datos.direccion, { max: 200 }),
    correo: v.patron(`${prefijo}.correo`, datos.correo, CORREO, 'Correo inválido', { max: 120 }),
  };
}

export function validarNuevoPaciente(datos = {}, institucion = null) {
  const v = new Validador();
  const regla = RESPONSABLE_POR_INSTITUCION[institucion] ?? { obligatorio: false, parentescos: PARENTESCOS };
  const paciente = {
    nombres: v.texto('nombres', datos.nombres, { requerido: true, max: 100 }),
    apellidos: v.texto('apellidos', datos.apellidos, { requerido: true, max: 100 }),
    fechaNacimiento: v.fecha('fechaNacimiento', datos.fechaNacimiento, { requerido: true, noFutura: true }),
    sexo: v.opcion('sexo', datos.sexo, SEXOS, { requerido: true }),
    documento: v.patron('documento', datos.documento, CUI, 'Debe tener 13 dígitos'),
    contacto: validarContactoEn(v, 'contacto', datos.contacto),
    datosClinicos: {
      tipoSangre: v.opcion('datosClinicos.tipoSangre', datos.datosClinicos?.tipoSangre, TIPOS_SANGRE),
      alergias: v.texto('datosClinicos.alergias', datos.datosClinicos?.alergias, { max: 500 }),
    },
    responsable: null,
  };

  const r = datos.responsable;
  if (r?.id) {
    paciente.responsable = { id: String(r.id) };
  } else if (r) {
    paciente.responsable = {
      nombres: v.texto('responsable.nombres', r.nombres, { requerido: true, max: 100 }),
      apellidos: v.texto('responsable.apellidos', r.apellidos, { requerido: true, max: 100 }),
      parentesco: v.opcion('responsable.parentesco', r.parentesco, regla.parentescos, { requerido: true }),
      documento: v.patron('responsable.documento', r.documento, CUI, 'DPI de 13 dígitos', { requerido: true }),
      ...validarContactoEn(v, 'responsable', r, { telefonoRequerido: true }),
    };
  } else if (regla.obligatorio) {
    v.error('responsable', 'El paciente necesita un responsable');
  }

  v.lanzarSiHayErrores();
  return paciente;
}

/**
 * Corregir datos personales mal capturados (nombre, fecha de nacimiento, sexo,
 * documento). Solo lo que viene; un documento vacío lo quita.
 */
export function validarDatosPersonales(datos = {}) {
  const v = new Validador();
  const cambios = {};
  if ('nombres' in datos) cambios.nombres = v.texto('nombres', datos.nombres, { requerido: true, max: 100 });
  if ('apellidos' in datos) cambios.apellidos = v.texto('apellidos', datos.apellidos, { requerido: true, max: 100 });
  if ('fechaNacimiento' in datos) {
    cambios.fechaNacimiento = v.fecha('fechaNacimiento', datos.fechaNacimiento, { requerido: true, noFutura: true });
  }
  if ('sexo' in datos) cambios.sexo = v.opcion('sexo', datos.sexo, SEXOS, { requerido: true });
  if ('documento' in datos) cambios.documento = v.patron('documento', datos.documento, CUI, 'Debe tener 13 dígitos');
  v.lanzarSiHayErrores();
  if (Object.keys(cambios).length === 0) throw new DatosInvalidos('No hay cambios');
  return cambios;
}

// Datos clínicos que se pueden actualizar después del registro, por
// institución. La clínica odontológica no registra tipo de sangre.
const CAMPOS_CLINICOS = { odontologica: ['alergias'] };
export const camposClinicos = (institucion) => CAMPOS_CLINICOS[institucion] ?? ['tipoSangre', 'alergias'];

/** Actualizar tipo de sangre y alergias: solo lo que viene; vacío = sin registrar. */
export function validarDatosClinicos(datos = {}, institucion) {
  const v = new Validador();
  const permitidos = camposClinicos(institucion);
  const cambios = {};
  for (const campo of Object.keys(datos)) {
    if (!permitidos.includes(campo)) v.error(campo, 'Esta institución no registra este dato');
  }
  if ('tipoSangre' in datos && permitidos.includes('tipoSangre')) {
    cambios.tipoSangre = v.opcion('tipoSangre', datos.tipoSangre === '' ? null : datos.tipoSangre, TIPOS_SANGRE);
  }
  if ('alergias' in datos) cambios.alergias = v.texto('alergias', datos.alergias, { max: 500 });
  v.lanzarSiHayErrores();
  if (Object.keys(cambios).length === 0) throw new DatosInvalidos('No hay cambios');
  return cambios;
}

export function validarContacto(datos = {}) {
  const v = new Validador();
  const contacto = validarContactoEn(v, 'contacto', datos);
  // Solo si no hubo otro error: un teléfono mal escrito ya dice qué corregir.
  if (Object.keys(v.errores).length === 0 && !contacto.telefono && !contacto.direccion && !contacto.correo) {
    v.error('contacto', 'Indica al menos un dato a actualizar');
  }
  v.lanzarSiHayErrores();
  return contacto;
}

export function validarBaja(datos = {}) {
  const v = new Validador();
  const baja = {
    motivo: v.opcion('motivo', datos.motivo, MOTIVOS_BAJA, { requerido: true }),
    detalle: v.texto('detalle', datos.detalle, { max: 300 }),
  };
  if (baja.motivo === 'otro' && !baja.detalle) v.error('detalle', 'Describe el motivo');
  v.lanzarSiHayErrores();
  return baja;
}
