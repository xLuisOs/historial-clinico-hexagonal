import { Conflicto } from './errores.js';
import { Validador } from './validacion.js';

// Modelo común de una cita. La duración solo la guarda la odontológica; en el
// hospital y el pediátrico se asume DURACION_POR_DEFECTO para evitar choques.
//
// Cita = {
//   id, fechaHora: 'AAAA-MM-DD HH:MM:SS', duracionMin, estado, motivo,
//   paciente: { id, nombre }, medico: { id, nombre }
// }

export const DURACION_POR_DEFECTO = 30;
export const ESTADOS_PENDIENTES = ['programada', 'confirmada'];

const FECHA_HORA = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(:\d{2})?$/;

/** Hora actual de Guatemala en el mismo formato que las citas. */
export const ahoraEnGuatemala = () =>
  new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');

function validarFechaHora(v, valor) {
  if (!valor) {
    v.error('fechaHora', 'Es obligatoria');
    return null;
  }
  const m = FECHA_HORA.exec(String(valor));
  if (!m || Number.isNaN(Date.parse(`${m[1]}T${m[2]}:${m[3]}:00`))) {
    v.error('fechaHora', 'Formato esperado AAAA-MM-DD HH:MM');
    return null;
  }
  const texto = `${m[1]} ${m[2]}:${m[3]}:00`;
  if (texto < ahoraEnGuatemala().slice(0, 16)) v.error('fechaHora', 'No se puede agendar en el pasado');
  return texto;
}

const validarDuracion = (v, valor) =>
  v.numero('duracionMin', valor, { entero: true, min: 5, max: 480 }) ?? DURACION_POR_DEFECTO;

export function validarNuevaCita(datos = {}) {
  const v = new Validador();
  const cita = {
    medicoId: v.texto('medicoId', datos.medicoId == null ? null : String(datos.medicoId), { requerido: true }),
    fechaHora: validarFechaHora(v, datos.fechaHora),
    duracionMin: validarDuracion(v, datos.duracionMin),
    motivo: v.texto('motivo', datos.motivo, { max: 300 }),
  };
  v.lanzarSiHayErrores();
  return cita;
}

export function validarReprogramacion(datos = {}) {
  const v = new Validador();
  const cambio = {
    fechaHora: validarFechaHora(v, datos.fechaHora),
    duracionMin: validarDuracion(v, datos.duracionMin),
  };
  v.lanzarSiHayErrores();
  return cambio;
}

/** Suma minutos a 'AAAA-MM-DD HH:MM:SS' sin pasar por zonas horarias. */
export function sumarMinutos(fechaHora, minutos) {
  const d = new Date(`${fechaHora.replace(' ', 'T')}Z`);
  return new Date(d.getTime() + minutos * 60_000).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Busca, entre las citas pendientes del médico, una que se cruce con
 * [inicio, inicio + duración). Cada cita trae { fechaHora, duracionMin }.
 */
export function exigirHorarioLibre(citas, { fechaHora, duracionMin }) {
  const fin = sumarMinutos(fechaHora, duracionMin);
  const choque = citas.find((c) => {
    const finOtra = sumarMinutos(c.fechaHora, c.duracionMin ?? DURACION_POR_DEFECTO);
    return c.fechaHora < fin && finOtra > fechaHora;
  });
  if (choque) {
    throw new Conflicto('El médico ya tiene una cita en ese horario', {
      fechaHora: `Se cruza con la cita de las ${choque.fechaHora.slice(11, 16)}`,
    });
  }
}

// Estados que la recepción puede marcar a mano; "atendida" la pone la consulta.
export const ESTADOS_MARCABLES = ['confirmada', 'no_asistio'];

export function validarCambioEstado(datos = {}) {
  const v = new Validador();
  const estado = v.opcion('estado', datos.estado, ESTADOS_MARCABLES, { requerido: true });
  v.lanzarSiHayErrores();
  return estado;
}

const ESTADO_LEGIBLE = { no_asistio: 'marcada como "no asistió"' };

/** Solo una cita pendiente cambia de estado, y "no asistió" solo cuando ya pasó su hora. */
export function exigirTransicion({ estado, fechaHora }, nuevo) {
  if (!ESTADOS_PENDIENTES.includes(estado) || estado === nuevo) {
    throw new Conflicto(`La cita ya está ${ESTADO_LEGIBLE[estado] ?? estado}`);
  }
  if (nuevo === 'no_asistio' && fechaHora > ahoraEnGuatemala()) throw new Conflicto('Todavía no es la hora de la cita');
}
