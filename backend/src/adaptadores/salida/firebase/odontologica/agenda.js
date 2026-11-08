import { FieldValue } from 'firebase-admin/firestore';
import { ahoraEnGuatemala, ESTADOS_PENDIENTES, exigirHorarioLibre, exigirTransicion } from '../../../../dominio/cita.js';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, textoATimestamp, timestampATexto } from '../conexion.js';
import { COLECCIONES, nombreCompleto } from './modelo.js';
import { exigirPacienteActivo } from './pacientes.js';

// Las citas viven en su propia colección, con copias del paciente, del
// odontólogo y de quien la agendó. Las consultas por odontólogo o paciente
// usan un solo filtro de igualdad (sin índices compuestos); el resto se filtra aquí.

const copiaDePersona = (snap) => ({ id: snap.id, nombres: snap.get('nombres'), apellidos: snap.get('apellidos') });

export function crearRepositorioAgenda(db, zonaHoraria) {
  const col = (nombre) => db.collection(COLECCIONES[nombre]);
  const texto = (valor) => timestampATexto(valor, zonaHoraria);

  const aCita = (snap) => ({
    id: snap.id,
    fechaHora: texto(snap.get('fecha_hora')),
    duracionMin: snap.get('duracion_min') ?? null,
    estado: snap.get('estado'),
    motivo: snap.get('motivo') ?? null,
    paciente: { id: snap.get('paciente.id'), nombre: nombreCompleto(snap.get('paciente')) },
    medico: { id: snap.get('odontologo.id'), nombre: nombreCompleto(snap.get('odontologo')) },
  });

  async function obtenerCita(citaId) {
    const snap = await col('citas').doc(citaId).get();
    if (!snap.exists) throw new NoEncontrado('Cita no encontrada');
    return aCita(snap);
  }

  /** Lee dentro de la transacción las citas pendientes del odontólogo y revisa choques. */
  async function exigirOdontologoLibre(t, odontologoId, cambio, citaExcluida = null) {
    const snap = await t.get(col('citas').where('odontologo.id', '==', odontologoId));
    const pendientes = snap.docs
      .filter((c) => c.id !== citaExcluida && ESTADOS_PENDIENTES.includes(c.get('estado')))
      .map((c) => ({ fechaHora: texto(c.get('fecha_hora')), duracionMin: c.get('duracion_min') }));
    exigirHorarioLibre(pendientes, cambio);
  }

  async function exigirCitaPendiente(t, citaId) {
    const snap = await t.get(col('citas').doc(citaId));
    if (!snap.exists) throw new NoEncontrado('Cita no encontrada');
    if (!ESTADOS_PENDIENTES.includes(snap.get('estado'))) throw new Conflicto(`La cita ya está ${snap.get('estado')}`);
    return snap;
  }

  return {
    async citasDelMedico(odontologoId, fecha) {
      const snap = await col('citas').where('odontologo.id', '==', odontologoId).get();
      return snap.docs
        .map(aCita)
        .filter((c) => c.fechaHora?.startsWith(fecha))
        .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
    },

    async citasDelPaciente(pacienteId) {
      const hoy = ahoraEnGuatemala().slice(0, 10);
      const snap = await col('citas').where('paciente.id', '==', pacienteId).get();
      return snap.docs
        .map(aCita)
        .filter((c) => ESTADOS_PENDIENTES.includes(c.estado) && c.fechaHora >= hoy)
        .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
    },

    // La recepcionista que agenda queda registrada en agendada_por.
    async agendar(pacienteId, cita, usuario) {
      const id = await enTransaccion(db, async (t) => {
        const paciente = await exigirPacienteActivo(t, db, pacienteId);
        const odontologo = await t.get(col('odontologos').doc(cita.medicoId));
        if (!odontologo.exists) throw new NoEncontrado('Odontólogo no encontrado');
        if (odontologo.get('activo') === false) throw new Conflicto('El odontólogo no está activo');
        const quien = await t.get(col('usuarios').doc(usuario.id));
        await exigirOdontologoLibre(t, cita.medicoId, cita);

        const ref = col('citas').doc();
        t.set(ref, {
          fecha_hora: textoATimestamp(cita.fechaHora, zonaHoraria),
          duracion_min: cita.duracionMin,
          estado: 'programada',
          motivo: cita.motivo,
          paciente: copiaDePersona(paciente),
          odontologo: copiaDePersona(odontologo),
          agendada_por: {
            id: quien.get('recepcionista_id') ?? null,
            nombres: quien.get('nombres') ?? usuario.nombre,
            apellidos: quien.get('apellidos') ?? null,
          },
          fecha_registro: FieldValue.serverTimestamp(),
        });
        return ref.id;
      });
      return obtenerCita(id);
    },

    async reprogramar(citaId, cambio) {
      await enTransaccion(db, async (t) => {
        const actual = await exigirCitaPendiente(t, citaId);
        await exigirOdontologoLibre(t, actual.get('odontologo.id'), cambio, citaId);
        t.update(actual.ref, {
          fecha_hora: textoATimestamp(cambio.fechaHora, zonaHoraria),
          duracion_min: cambio.duracionMin,
        });
      });
      return obtenerCita(citaId);
    },

    // El modelo de la clínica no tiene "confirmada": solo programada, atendida,
    // cancelada y no_asistio.
    async marcarEstado(citaId, estado) {
      if (estado === 'confirmada') throw new Conflicto('La clínica no maneja confirmación de citas');
      await enTransaccion(db, async (t) => {
        const snap = await t.get(col('citas').doc(citaId));
        if (!snap.exists) throw new NoEncontrado('Cita no encontrada');
        exigirTransicion({ estado: snap.get('estado'), fechaHora: texto(snap.get('fecha_hora')) }, estado);
        t.update(snap.ref, { estado });
      });
      return obtenerCita(citaId);
    },

    async cancelar(citaId) {
      await enTransaccion(db, async (t) => {
        const actual = await exigirCitaPendiente(t, citaId);
        t.update(actual.ref, { estado: 'cancelada' });
      });
      return obtenerCita(citaId);
    },
  };
}
