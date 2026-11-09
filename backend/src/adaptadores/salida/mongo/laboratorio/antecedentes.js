import { Int32, ObjectId } from 'mongodb';
import { MAX_ANTECEDENTES } from '../../../../dominio/antecedente.js';
import { Conflicto } from '../../../../dominio/errores.js';
import { aObjectId, dateATexto, traducirError } from '../conexion.js';
import { exigirPacienteActivo } from './pacientes.js';

// Antecedentes médicos: arreglo `antecedentes` EMBEBIDO en el paciente. Son
// pocos, solo los tiene ese paciente y se muestran siempre con él, así que no
// ameritan colección aparte. En el laboratorio importan porque alteran la
// interpretación de resultados (la diabetes, la glucosa; un anticoagulante,
// los tiempos de coagulación). Nunca se borran: lab_app no tiene `remove`.

const ORDEN_TIPO = ['patologico', 'quirurgico', 'familiar', 'habito', 'medicamento'];

/** Arreglo del documento → Antecedente[] del dominio, agrupado por tipo. */
export function documentoAAntecedentes(paciente, zonaHoraria) {
  return (paciente.antecedentes ?? [])
    .map((a) => ({
      id: a._id.toHexString(),
      tipo: a.tipo,
      descripcion: a.descripcion,
      anioInicio: a.anio_inicio ?? null,
      registradoPor: { id: a.registrado_por.id.toHexString(), nombre: a.registrado_por.nombre },
      fechaRegistro: dateATexto(a.fecha_registro, zonaHoraria),
    }))
    .sort((a, b) => ORDEN_TIPO.indexOf(a.tipo) - ORDEN_TIPO.indexOf(b.tipo)
      || a.fechaRegistro.localeCompare(b.fechaRegistro));
}

export function crearRepositorioAntecedentes(db, zonaHoraria) {
  const pacientes = db.collection('pacientes');

  return {
    // → Antecedente[] del paciente, ya con el nuevo.
    //
    // No hace falta transacción: todo pasa en UN documento, y en MongoDB la
    // escritura de un documento es atómica. El filtro del updateOne es la
    // condición: solo agrega si el paciente sigue activo y el arreglo no llegó
    // al tope. Si alguien lo archiva al mismo tiempo, el filtro ya no coincide
    // y no se escribe nada (el validador $jsonSchema también exige el tope).
    async agregar(pacienteId, antecedente, usuario) {
      if (!usuario.medicoId) throw new Conflicto('El usuario no está asociado a un químico biólogo');
      const _id = aObjectId(pacienteId, 'Paciente');
      try {
        const { matchedCount } = await pacientes.updateOne(
          { _id, 'estado.activo': true, [`antecedentes.${MAX_ANTECEDENTES - 1}`]: { $exists: false } },
          {
            $push: {
              antecedentes: {
                _id: new ObjectId(),
                tipo: antecedente.tipo,
                descripcion: antecedente.descripcion,
                anio_inicio: antecedente.anioInicio == null ? null : new Int32(antecedente.anioInicio),
                registrado_por: { id: aObjectId(usuario.medicoId, 'Usuario'), nombre: usuario.nombre },
                fecha_registro: new Date(),
              },
            },
          },
        );
        if (matchedCount === 0) {
          // Explica por qué no coincidió: no existe, está archivado o llegó al tope.
          await exigirPacienteActivo(db, pacienteId);
          throw new Conflicto(`El paciente ya tiene el máximo de ${MAX_ANTECEDENTES} antecedentes`);
        }
      } catch (error) {
        throw traducirError(error);
      }
      return documentoAAntecedentes(await pacientes.findOne({ _id }), zonaHoraria);
    },
  };
}
