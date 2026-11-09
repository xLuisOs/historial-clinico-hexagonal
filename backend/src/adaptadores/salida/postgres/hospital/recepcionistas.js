import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { idNumerico } from './pacientes.js';

// Recepcionistas del hospital, administradas por el admin (ver
// dominio/recepcionista.js). La persona va en recepcionista y su cuenta en
// usuario (rol 'recepcion', recepcionista_fk): se crean y se desactivan juntas.

const SELECT_RECEPCIONISTA = `
  SELECT r.id_recepcionista, r.nombres, r.apellidos, r.telefono, r.estado, u.correo
  FROM recepcionista r
  LEFT JOIN usuario u ON u.recepcionista_fk = r.id_recepcionista`;

const filaARecepcionista = (f) => ({
  id: String(f.id_recepcionista),
  nombre: `${f.nombres} ${f.apellidos}`,
  nombres: f.nombres,
  apellidos: f.apellidos,
  telefono: f.telefono,
  correo: f.correo ?? null,
  activo: f.estado === 'activo',
});

async function leerRecepcionista(cx, id) {
  const { rows: [fila] } = await cx.query(`${SELECT_RECEPCIONISTA} WHERE r.id_recepcionista = $1`, [id]);
  if (!fila) throw new NoEncontrado('Recepcionista no encontrada');
  return filaARecepcionista(fila);
}

async function bloquear(cx, id) {
  const { rows: [fila] } = await cx.query('SELECT 1 FROM recepcionista WHERE id_recepcionista = $1 FOR UPDATE', [id]);
  if (!fila) throw new NoEncontrado('Recepcionista no encontrada');
}

export function crearRepositorioRecepcionistas(pool) {
  return {
    async listarRecepcionistas() {
      const { rows } = await pool.query(`${SELECT_RECEPCIONISTA} ORDER BY r.estado = 'activo' DESC, r.apellidos, r.nombres`);
      return rows.map(filaARecepcionista);
    },

    registrarRecepcionista(r) {
      return enTransaccion(pool, async (cx) => {
        const { rows: [repetido] } = await cx.query('SELECT 1 FROM usuario WHERE lower(correo) = $1', [r.correo]);
        if (repetido) throw new Conflicto('Ya hay un usuario con ese correo');
        const { rows: [nueva] } = await cx.query(
          'INSERT INTO recepcionista (nombres, apellidos, telefono) VALUES ($1, $2, $3) RETURNING id_recepcionista',
          [r.nombres, r.apellidos, r.telefono],
        );
        await cx.query(
          `INSERT INTO usuario (correo, password_hash, nombre_mostrar, rol, recepcionista_fk) VALUES ($1, $2, $3, 'recepcion', $4)`,
          [r.correo, r.passwordHash, `${r.nombres} ${r.apellidos}`.slice(0, 120), nueva.id_recepcionista],
        );
        return leerRecepcionista(cx, nueva.id_recepcionista);
      });
    },

    actualizarRecepcionista(recepcionistaId, cambios) {
      const id = idNumerico(recepcionistaId, 'Recepcionista');
      return enTransaccion(pool, async (cx) => {
        await bloquear(cx, id);
        // Solo se omite lo que no vino (el teléfono puede venir en null para borrarlo).
        const columnas = ['nombres', 'apellidos', 'telefono'].filter((c) => cambios[c] !== undefined);
        if (columnas.length > 0) {
          await cx.query(
            `UPDATE recepcionista SET ${columnas.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id_recepcionista = $${columnas.length + 1}`,
            [...columnas.map((c) => cambios[c]), id],
          );
        }
        // El nombre que se muestra al iniciar sesión sigue al de la recepcionista.
        const recepcionista = await leerRecepcionista(cx, id);
        await cx.query('UPDATE usuario SET nombre_mostrar = $1 WHERE recepcionista_fk = $2', [recepcionista.nombre.slice(0, 120), id]);
        return recepcionista;
      });
    },

    async restablecerPasswordRecepcionista(recepcionistaId, passwordHash) {
      const { rowCount } = await pool.query(
        'UPDATE usuario SET password_hash = $1 WHERE recepcionista_fk = $2',
        [passwordHash, idNumerico(recepcionistaId, 'Recepcionista')],
      );
      if (rowCount === 0) throw new NoEncontrado('Esa recepcionista no tiene usuario');
    },

    cambiarEstadoRecepcionista(recepcionistaId, activo) {
      const id = idNumerico(recepcionistaId, 'Recepcionista');
      return enTransaccion(pool, async (cx) => {
        await bloquear(cx, id);
        await cx.query('UPDATE recepcionista SET estado = $1 WHERE id_recepcionista = $2', [activo ? 'activo' : 'inactivo', id]);
        await cx.query('UPDATE usuario SET activo = $1 WHERE recepcionista_fk = $2', [activo, id]);
        return leerRecepcionista(cx, id);
      });
    },
  };
}
