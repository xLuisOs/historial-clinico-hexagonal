import { FieldValue } from 'firebase-admin/firestore';
import { Conflicto, DatosInvalidos, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, fechaATimestamp, timestampAFecha, timestampATexto } from '../conexion.js';
import { COLECCIONES, palabras, terminosBusqueda } from './modelo.js';

// Firestore no limita cuántos documentos devuelve una búsqueda: se leen como
// máximo LECTURA_MAXIMA y al cliente le llegan RESULTADOS_MAXIMOS.
const LECTURA_MAXIMA = 200;
const RESULTADOS_MAXIMOS = 50;

// La clínica no registra correo ni tipo de sangre del paciente, ni un
// responsable: esos campos del modelo común se devuelven vacíos.
export function documentoAPaciente(snap, zonaHoraria) {
  const d = snap.data();
  const e = d.estado ?? {};
  return {
    id: snap.id,
    nombres: d.nombres,
    apellidos: d.apellidos,
    fechaNacimiento: timestampAFecha(d.fecha_nacimiento, zonaHoraria),
    sexo: d.sexo ?? null,
    documento: d.documento ?? null,
    contacto: {
      telefono: d.contacto?.telefono ?? null,
      direccion: d.contacto?.direccion ?? null,
      correo: null,
    },
    responsable: null,
    datosClinicos: { tipoSangre: null, alergias: d.alergias ?? null },
    estado: {
      activo: Boolean(e.activo),
      fechaRegistro: timestampATexto(e.fecha_registro, zonaHoraria),
      fechaBaja: timestampATexto(e.fecha_baja, zonaHoraria),
      motivoBaja: e.motivo_baja ?? null,
      detalleBaja: e.detalle_baja ?? null,
    },
  };
}

/** Lee el paciente dentro de la transacción y verifica que exista y esté activo. */
export async function exigirPacienteActivo(transaccion, db, pacienteId) {
  const snap = await transaccion.get(db.collection(COLECCIONES.pacientes).doc(pacienteId));
  if (!snap.exists) throw new NoEncontrado('Paciente no encontrado');
  if (!snap.get('estado.activo')) throw new Conflicto('El historial del paciente está archivado');
  return snap;
}

const ordenarPorNombre = (a, b) =>
  a.apellidos.localeCompare(b.apellidos, 'es') || a.nombres.localeCompare(b.nombres, 'es');

export function crearRepositorioPacientes(db, zonaHoraria) {
  const pacientes = db.collection(COLECCIONES.pacientes);
  const aPaciente = (snap) => documentoAPaciente(snap, zonaHoraria);

  async function obtenerPorId(pacienteId) {
    const snap = await pacientes.doc(pacienteId).get();
    if (!snap.exists) throw new NoEncontrado('Paciente no encontrado');
    return aPaciente(snap);
  }

  return {
    obtenerPorId,

    async registrar(paciente) {
      if (paciente.responsable) {
        throw new DatosInvalidos('Datos inválidos', { responsable: 'La clínica odontológica no registra responsables' });
      }
      const id = await enTransaccion(db, async (t) => {
        // Firestore no tiene UNIQUE: el documento se verifica dentro de la transacción.
        if (paciente.documento) {
          const repetido = await t.get(pacientes.where('documento', '==', paciente.documento).limit(1));
          if (!repetido.empty) throw new Conflicto('Ya existe un paciente con ese documento');
        }
        const ref = pacientes.doc();
        t.set(ref, {
          nombres: paciente.nombres,
          apellidos: paciente.apellidos,
          terminos_busqueda: terminosBusqueda(paciente.nombres, paciente.apellidos),
          documento: paciente.documento,
          fecha_nacimiento: fechaATimestamp(paciente.fechaNacimiento, zonaHoraria),
          sexo: paciente.sexo,
          alergias: paciente.datosClinicos.alergias,
          contacto: {
            telefono: paciente.contacto.telefono,
            direccion: paciente.contacto.direccion,
          },
          estado: {
            activo: true,
            fecha_registro: FieldValue.serverTimestamp(),
            fecha_baja: null,
            motivo_baja: null,
            detalle_baja: null,
          },
        });
        return ref.id;
      });
      return obtenerPorId(id);
    },

    // Sin LIKE: un número se busca como documento exacto; un texto, por la
    // palabra más larga en terminos_busqueda, y el resto se filtra aquí.
    async buscar({ texto, incluirArchivados }) {
      let consulta;
      let buscadas = [];
      if (/^\d+$/.test(texto)) {
        consulta = pacientes.where('documento', '==', texto);
      } else if (texto) {
        buscadas = palabras(texto);
        const masLarga = buscadas.reduce((a, b) => (b.length > a.length ? b : a), '');
        consulta = masLarga.length >= 2
          ? pacientes.where('terminos_busqueda', 'array-contains', masLarga)
          : pacientes.orderBy('apellidos');
      } else {
        consulta = pacientes.orderBy('apellidos');
      }

      const snap = await consulta.limit(LECTURA_MAXIMA).get();
      return snap.docs
        .filter((doc) => incluirArchivados || doc.get('estado.activo'))
        .filter((doc) => {
          const terminos = doc.get('terminos_busqueda') ?? [];
          return buscadas.every((p) => terminos.some((t) => t.startsWith(p)));
        })
        .map(aPaciente)
        .sort(ordenarPorNombre)
        .slice(0, RESULTADOS_MAXIMOS);
    },

    async actualizarContacto(pacienteId, contacto) {
      if (!contacto.telefono && !contacto.direccion) {
        throw new DatosInvalidos('Datos inválidos', { contacto: 'La clínica solo registra teléfono y dirección' });
      }
      await enTransaccion(db, async (t) => {
        const snap = await exigirPacienteActivo(t, db, pacienteId);
        t.update(snap.ref, {
          ...(contacto.telefono && { 'contacto.telefono': contacto.telefono }),
          ...(contacto.direccion && { 'contacto.direccion': contacto.direccion }),
        });
      });
      return obtenerPorId(pacienteId);
    },

    // Corregir datos personales (admin). Si cambia el nombre, se recalculan los
    // terminos_busqueda; Firestore no tiene UNIQUE, el documento repetido se
    // revisa dentro de la transacción.
    async actualizarDatosPersonales(pacienteId, cambios) {
      await enTransaccion(db, async (t) => {
        const snap = await exigirPacienteActivo(t, db, pacienteId);
        if (cambios.documento) {
          const repetido = await t.get(pacientes.where('documento', '==', cambios.documento).limit(2));
          if (repetido.docs.some((d) => d.id !== pacienteId)) throw new Conflicto('Ya hay otro paciente con ese documento');
        }
        const nombres = cambios.nombres ?? snap.get('nombres');
        const apellidos = cambios.apellidos ?? snap.get('apellidos');
        t.update(snap.ref, {
          ...(cambios.nombres !== undefined && { nombres }),
          ...(cambios.apellidos !== undefined && { apellidos }),
          ...((cambios.nombres !== undefined || cambios.apellidos !== undefined) && { terminos_busqueda: terminosBusqueda(nombres, apellidos) }),
          ...(cambios.fechaNacimiento !== undefined && { fecha_nacimiento: fechaATimestamp(cambios.fechaNacimiento, zonaHoraria) }),
          ...(cambios.sexo !== undefined && { sexo: cambios.sexo }),
          ...(cambios.documento !== undefined && { documento: cambios.documento }),
        });
      });
      return obtenerPorId(pacienteId);
    },

    // La clínica solo registra alergias (no tipo de sangre); null = ninguna registrada.
    async actualizarDatosClinicos(pacienteId, datos) {
      await enTransaccion(db, async (t) => {
        const snap = await exigirPacienteActivo(t, db, pacienteId);
        t.update(snap.ref, { alergias: datos.alergias ?? null });
      });
      return obtenerPorId(pacienteId);
    },

    // Archivar = marcar inactivo + cancelar sus citas futuras, todo o nada.
    async darDeBaja(pacienteId, { motivo, detalle }) {
      await enTransaccion(db, async (t) => {
        const snap = await exigirPacienteActivo(t, db, pacienteId);
        const citas = await t.get(db.collection(COLECCIONES.citas).where('paciente.id', '==', pacienteId));
        const ahora = Date.now();

        t.update(snap.ref, {
          'estado.activo': false,
          'estado.fecha_baja': FieldValue.serverTimestamp(),
          'estado.motivo_baja': motivo,
          'estado.detalle_baja': detalle,
        });
        for (const cita of citas.docs) {
          if (cita.get('estado') === 'programada' && cita.get('fecha_hora')?.toMillis() >= ahora) {
            t.update(cita.ref, { estado: 'cancelada' });
          }
        }
      });
      return obtenerPorId(pacienteId);
    },
  };
}
