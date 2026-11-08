import { Validador } from './validacion.js';

// Reglas propias del Centro Médico Pediátrico que no dependen del motor.

/** Fecha de hoy en Guatemala (UTC-6), en formato AAAA-MM-DD. */
export const hoyEnGuatemala = () => new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);

/**
 * Vacuna aplicada = { vacunaId, numeroDosis, fechaAplicacion, lote, consultaId }
 * La fecha es hoy si no se indica y nunca futura. consultaId es opcional: una
 * vacuna también se puede aplicar fuera de consulta (jornada de vacunación).
 */
export function validarVacunaAplicada(datos = {}) {
  const v = new Validador();
  const aTexto = (x) => (x == null || x === '' ? null : String(x));
  const vacuna = {
    vacunaId: v.texto('vacunaId', aTexto(datos.vacunaId), { requerido: true }),
    numeroDosis: v.numero('numeroDosis', datos.numeroDosis, { requerido: true, entero: true, min: 1, max: 10 }),
    fechaAplicacion: v.fecha('fechaAplicacion', datos.fechaAplicacion) ?? hoyEnGuatemala(),
    lote: v.texto('lote', datos.lote, { requerido: true, max: 30 }),
    consultaId: v.texto('consultaId', aTexto(datos.consultaId)),
  };
  if (vacuna.fechaAplicacion > hoyEnGuatemala()) v.error('fechaAplicacion', 'No puede ser una fecha futura');
  v.lanzarSiHayErrores();
  return vacuna;
}
