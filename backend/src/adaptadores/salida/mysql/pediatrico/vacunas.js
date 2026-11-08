import { Conflicto, DatosInvalidos, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, traducirError } from '../conexion.js';
import { cargarEsquemaVacunas } from './atenciones.js';
import { exigirPacienteActivo } from './pacientes.js';

const MENSAJES = {
  duplicado: 'Esa dosis ya está registrada para el paciente',
  referencia: 'La vacuna o la consulta indicada no existe',
};

/**
 * Registra una dosis aplicada. Todo ocurre en una transacción que bloquea la
 * fila del paciente (FOR UPDATE): dos médicos no pueden registrar a la vez
 * dosis que se contradigan. Reglas:
 *  - el paciente está activo (también lo verifica trg_vacuna_aplicada_consistente);
 *  - la dosis existe en el esquema y no se registró antes (UNIQUE uq_vacuna_aplicada);
 *  - las dosis van en orden: la 2 exige la 1, y no puede ser anterior a ella;
 *  - no se aplica antes del nacimiento;
 *  - si viene de una consulta, la consulta es del mismo paciente (trigger).
 */
export function crearRepositorioVacunas(pool) {
  return {
    aplicarVacuna(pacienteId, vacuna, medicoId) {
      return enTransaccion(pool, async (cx) => {
        await exigirPacienteActivo(cx, pacienteId);

        const [[paciente]] = await cx.query(
          `SELECT DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS nacimiento FROM paciente WHERE id_paciente = ?`,
          [pacienteId],
        );
        if (vacuna.fechaAplicacion < paciente.nacimiento) {
          throw new DatosInvalidos('Datos inválidos', { fechaAplicacion: 'Es anterior al nacimiento del paciente' });
        }

        const [esquema] = await cx.query(
          `SELECT v.nombre, v.dosis_total FROM esquema_dosis ed JOIN vacuna v ON v.id_vacuna = ed.vacuna_fk
           WHERE ed.vacuna_fk = ? AND ed.numero_dosis = ?`,
          [vacuna.vacunaId, vacuna.numeroDosis],
        );
        if (esquema.length === 0) throw new NoEncontrado('Esa dosis no existe en el esquema de vacunación');

        if (vacuna.numeroDosis > 1) {
          const [anterior] = await cx.query(
            `SELECT DATE_FORMAT(fecha_aplicacion, '%Y-%m-%d') AS fecha FROM vacuna_aplicada
             WHERE paciente_fk = ? AND vacuna_fk = ? AND numero_dosis = ?`,
            [pacienteId, vacuna.vacunaId, vacuna.numeroDosis - 1],
          );
          if (anterior.length === 0) {
            throw new Conflicto(`Falta registrar la dosis ${vacuna.numeroDosis - 1} de ${esquema[0].nombre}`);
          }
          if (vacuna.fechaAplicacion < anterior[0].fecha) {
            throw new DatosInvalidos('Datos inválidos', { fechaAplicacion: `Es anterior a la dosis ${vacuna.numeroDosis - 1} (${anterior[0].fecha})` });
          }
        }

        await cx.query(
          `INSERT INTO vacuna_aplicada
             (paciente_fk, vacuna_fk, numero_dosis, medico_fk, consulta_fk, fecha_aplicacion, lote)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [pacienteId, vacuna.vacunaId, vacuna.numeroDosis, medicoId, vacuna.consultaId, vacuna.fechaAplicacion, vacuna.lote],
        ).catch((e) => { throw traducirError(e, MENSAJES); });

        return cargarEsquemaVacunas(cx, pacienteId);
      });
    },
  };
}
