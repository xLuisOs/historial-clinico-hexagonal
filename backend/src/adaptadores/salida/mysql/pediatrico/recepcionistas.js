import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';

// Recepcionistas del pediátrico, administradas por el admin (ver
// dominio/recepcionista.js). La persona va en recepcionista y su cuenta en
// usuario (rol 'recepcion', recepcionista_fk): se crean y se desactivan juntas.

const SELECT_RECEPCIONISTA = `
  SELECT r.id_recepcionista, r.nombres, r.apellidos, r.telefono, r.activo, u.correo
  FROM recepcionista r LEFT JOIN usuario u ON u.recepcionista_fk = r.id_recepcionista`;

const filaARecepcionista = (f) => ({
  id: String(f.id_recepcionista),
  nombre: `${f.nombres} ${f.apellidos}`,
  nombres: f.nombres,
  apellidos: f.apellidos,
  telefono: f.telefono,
  correo: f.correo ?? null,
  activo: Boolean(f.activo),
});

async function leerRecepcionista(cx, id) {
  const [[fila]] = await cx.query(`${SELECT_RECEPCIONISTA} WHERE r.id_recepcionista = ?`, [id]);
  if (!fila) throw new NoEncontrado('Recepcionista no encontrada');
  return filaARecepcionista(fila);
}

async function bloquear(cx, id) {
  const [[fila]] = await cx.query('SELECT id_recepcionista FROM recepcionista WHERE id_recepcionista = ? FOR UPDATE', [id]);
  if (!fila) throw new NoEncontrado('Recepcionista no encontrada');
}

export function crearRepositorioRecepcionistas(pool) {
  return {
    async listarRecepcionistas() {
      const [filas] = await pool.query(`${SELECT_RECEPCIONISTA} ORDER BY r.activo DESC, r.apellidos, r.nombres`);
      return filas.map(filaARecepcionista);
    },

    registrarRecepcionista(r) {
      return enTransaccion(pool, async (cx) => {
        const [[repetido]] = await cx.query('SELECT 1 AS si FROM usuario WHERE correo = ?', [r.correo]);
        if (repetido) throw new Conflicto('Ya hay un usuario con ese correo');
        const [nueva] = await cx.query(
          'INSERT INTO recepcionista (nombres, apellidos, telefono) VALUES (?, ?, ?)',
          [r.nombres, r.apellidos, r.telefono],
        );
        await cx.query(
          `INSERT INTO usuario (correo, password_hash, nombre_mostrar, rol, recepcionista_fk) VALUES (?, ?, ?, 'recepcion', ?)`,
          [r.correo, r.passwordHash, `${r.nombres} ${r.apellidos}`.slice(0, 120), nueva.insertId],
        );
        return leerRecepcionista(cx, nueva.insertId);
      });
    },

    actualizarRecepcionista(id, cambios) {
      return enTransaccion(pool, async (cx) => {
        await bloquear(cx, id);
        // Solo se omite lo que no vino (el teléfono puede venir en null para borrarlo).
        const columnas = ['nombres', 'apellidos', 'telefono'].filter((c) => cambios[c] !== undefined);
        if (columnas.length > 0) {
          await cx.query(
            `UPDATE recepcionista SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id_recepcionista = ?`,
            [...columnas.map((c) => cambios[c]), id],
          );
        }
        // El nombre que se muestra al iniciar sesión sigue al de la recepcionista.
        const recepcionista = await leerRecepcionista(cx, id);
        await cx.query('UPDATE usuario SET nombre_mostrar = ? WHERE recepcionista_fk = ?', [recepcionista.nombre.slice(0, 120), id]);
        return recepcionista;
      });
    },

    async restablecerPasswordRecepcionista(id, passwordHash) {
      const [r] = await pool.query('UPDATE usuario SET password_hash = ? WHERE recepcionista_fk = ?', [passwordHash, id]);
      if (r.affectedRows === 0) throw new NoEncontrado('Esa recepcionista no tiene usuario');
    },

    cambiarEstadoRecepcionista(id, activo) {
      return enTransaccion(pool, async (cx) => {
        await bloquear(cx, id);
        await cx.query('UPDATE recepcionista SET activo = ? WHERE id_recepcionista = ?', [activo, id]);
        await cx.query('UPDATE usuario SET activo = ? WHERE recepcionista_fk = ?', [activo, id]);
        return leerRecepcionista(cx, id);
      });
    },
  };
}
