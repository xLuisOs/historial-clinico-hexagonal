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
  'madre', 'padre', 'abuela', 'abuelo', 'tia', 'tio', 'hermana', 'hermano', 'tutor_legal', 'otro',
];

const CUI = /^\d{13}$/;
const TELEFONO = /^[0-9+\-\s]{8,20}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarContactoEn(v, prefijo, datos = {}, { telefonoRequerido = false } = {}) {
  return {
    telefono: v.patron(`${prefijo}.telefono`, datos.telefono, TELEFONO, 'Teléfono inválido', {
      requerido: telefonoRequerido,
    }),
    direccion: v.texto(`${prefijo}.direccion`, datos.direccion, { max: 200 }),
    correo: v.patron(`${prefijo}.correo`, datos.correo, CORREO, 'Correo inválido', { max: 120 }),
  };
}

export function validarNuevoPaciente(datos = {}) {
  const v = new Validador();
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
      parentesco: v.opcion('responsable.parentesco', r.parentesco, PARENTESCOS, { requerido: true }),
      documento: v.patron('responsable.documento', r.documento, CUI, 'DPI de 13 dígitos', { requerido: true }),
      ...validarContactoEn(v, 'responsable', r, { telefonoRequerido: true }),
    };
  }

  v.lanzarSiHayErrores();
  return paciente;
}

export function validarContacto(datos = {}) {
  const v = new Validador();
  const contacto = validarContactoEn(v, 'contacto', datos);
  if (!contacto.telefono && !contacto.direccion && !contacto.correo) {
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
