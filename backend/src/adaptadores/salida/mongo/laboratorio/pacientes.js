import { Conflicto, DatosInvalidos, NoEncontrado } from '../../../../dominio/errores.js';
import { aObjectId, dateAFecha, dateATexto, enTransaccionMongo, fechaADate, traducirError } from '../conexion.js';
import { filtroPorNombre, nombreBusqueda } from './modelo.js';

export function documentoAPaciente(d, zonaHoraria) {
  const r = d.responsable;
  return {
    id: d._id.toHexString(),
    nombres: d.nombres,
    apellidos: d.apellidos,
    fechaNacimiento: dateAFecha(d.fecha_nacimiento),
    sexo: d.sexo,
    documento: d.documento ?? null,
    contacto: {
      telefono: d.contacto?.telefono ?? null,
      direccion: d.contacto?.direccion ?? null,
      correo: d.contacto?.correo ?? null,
    },
    // El responsable va embebido: en el laboratorio no tiene vida propia
    // (no se comparte entre pacientes ni se consulta por separado).
    responsable: r ? {
      id: null,
      nombres: r.nombres,
      apellidos: r.apellidos,
      parentesco: r.parentesco,
      documento: r.documento ?? null,
      telefono: r.telefono,
      direccion: null,
      correo: null,
    } : null,
    datosClinicos: {
      tipoSangre: d.datos_clinicos?.tipo_sangre ?? null,
      alergias: d.datos_clinicos?.alergias ?? null,
    },
    estado: {
      activo: d.estado.activo,
      fechaRegistro: dateATexto(d.estado.fecha_registro, zonaHoraria),
      fechaBaja: dateATexto(d.estado.fecha_baja, zonaHoraria),
      motivoBaja: d.estado.motivo_baja ?? null,
      detalleBaja: d.estado.detalle_baja ?? null,
    },
  };
}

/** Lee el paciente (dentro de la sesión si la hay) y verifica que esté activo. */
export async function exigirPacienteActivo(db, pacienteId, session) {
  const paciente = await db.collection('pacientes').findOne({ _id: aObjectId(pacienteId, 'Paciente') }, { session });
  if (!paciente) throw new NoEncontrado('Paciente no encontrado');
  if (!paciente.estado.activo) throw new Conflicto('El historial del paciente está archivado');
  return paciente;
}

export function crearRepositorioPacientes(cliente, db, zonaHoraria) {
  const pacientes = db.collection('pacientes');
  const aPaciente = (d) => documentoAPaciente(d, zonaHoraria);

  async function obtenerPorId(pacienteId, session) {
    const d = await pacientes.findOne({ _id: aObjectId(pacienteId, 'Paciente') }, { session });
    if (!d) throw new NoEncontrado('Paciente no encontrado');
    return aPaciente(d);
  }

  return {
    obtenerPorId: (id) => obtenerPorId(id),

    // Un solo documento: la escritura ya es atómica, no hace falta transacción.
    // El índice único parcial sobre `documento` impide duplicados.
    async registrar(p) {
      if (p.responsable?.id) {
        throw new DatosInvalidos('Datos inválidos', {
          responsable: 'En el laboratorio el responsable se registra con el paciente, no se selecciona',
        });
      }
      const r = p.responsable;
      const documento = {
        nombres: p.nombres,
        apellidos: p.apellidos,
        nombre_busqueda: nombreBusqueda(p.nombres, p.apellidos),
        fecha_nacimiento: fechaADate(p.fechaNacimiento),
        sexo: p.sexo,
        documento: p.documento,
        contacto: { ...p.contacto },
        responsable: r ? {
          nombres: r.nombres,
          apellidos: r.apellidos,
          parentesco: r.parentesco,
          documento: r.documento,
          telefono: r.telefono,
        } : null,
        datos_clinicos: { tipo_sangre: p.datosClinicos.tipoSangre, alergias: p.datosClinicos.alergias },
        estado: { activo: true, fecha_registro: new Date(), fecha_baja: null, motivo_baja: null, detalle_baja: null },
      };
      try {
        const { insertedId } = await pacientes.insertOne(documento);
        return obtenerPorId(insertedId.toHexString());
      } catch (error) {
        throw traducirError(error, { duplicado: 'Ya existe un paciente con ese documento' });
      }
    },

    async buscar({ texto, incluirArchivados }) {
      const condiciones = [];
      if (/^\d{4,13}$/.test(texto)) condiciones.push({ documento: texto });
      else if (texto) condiciones.push(filtroPorNombre(texto));
      if (!incluirArchivados) condiciones.push({ 'estado.activo': true });

      const docs = await pacientes
        .find(condiciones.length ? { $and: condiciones } : {})
        .sort({ apellidos: 1, nombres: 1 })
        .collation({ locale: 'es' })
        .limit(50)
        .toArray();
      return docs.map(aPaciente);
    },

    async actualizarContacto(pacienteId, contacto) {
      const cambios = Object.fromEntries(
        Object.entries(contacto).filter(([, v]) => v).map(([k, v]) => [`contacto.${k}`, v]),
      );
      const res = await pacientes.updateOne(
        { _id: aObjectId(pacienteId, 'Paciente'), 'estado.activo': true },
        { $set: cambios },
      );
      if (res.matchedCount === 0) {
        await exigirPacienteActivo(db, pacienteId); // lanza el error que corresponda
      }
      return obtenerPorId(pacienteId);
    },

    // Tipo de sangre y alergias: solo lo que viene; null = sin registrar.
    async actualizarDatosClinicos(pacienteId, datos) {
      const campos = { tipoSangre: 'datos_clinicos.tipo_sangre', alergias: 'datos_clinicos.alergias' };
      const cambios = Object.fromEntries(Object.keys(datos).filter((c) => campos[c]).map((c) => [campos[c], datos[c]]));
      const res = await pacientes.updateOne({ _id: aObjectId(pacienteId, 'Paciente'), 'estado.activo': true }, { $set: cambios });
      if (res.matchedCount === 0) await exigirPacienteActivo(db, pacienteId); // lanza el error que corresponda
      return obtenerPorId(pacienteId);
    },

    // Archivar = marcar inactivo + anular sus órdenes que no se procesaron,
    // todo o nada (transacción de varios documentos).
    darDeBaja(pacienteId, { motivo, detalle }) {
      return enTransaccionMongo(cliente, async (session) => {
        const paciente = await exigirPacienteActivo(db, pacienteId, session);
        await pacientes.updateOne(
          { _id: paciente._id },
          {
            $set: {
              'estado.activo': false,
              'estado.fecha_baja': new Date(),
              'estado.motivo_baja': motivo,
              'estado.detalle_baja': detalle,
            },
          },
          { session },
        );
        await db.collection('ordenes').updateMany(
          { paciente_id: paciente._id, estado: 'pendiente' },
          { $set: { estado: 'anulada' } },
          { session },
        );
        return obtenerPorId(pacienteId, session);
      });
    },
  };
}
