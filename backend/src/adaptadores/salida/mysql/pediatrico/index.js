// Adaptador MySQL del Centro Médico Pediátrico: implementa los puertos de
// puertos/repositorios.js sobre el esquema de db/mysql/01_esquema.sql.

import { crearRepositorioAtenciones } from './atenciones.js';
import { crearRepositorioPacientes } from './pacientes.js';

export function crearAdaptadorPediatricoMysql(pool) {
  return {
    usuarios: {
      async buscarPorCorreo(correo) {
        const [filas] = await pool.query(
          `SELECT id_usuario, correo, password_hash, nombre_mostrar, rol, medico_fk, activo
           FROM usuario WHERE correo = ?`,
          [correo],
        );
        const u = filas[0];
        return u && {
          id: String(u.id_usuario),
          correo: u.correo,
          passwordHash: u.password_hash,
          nombre: u.nombre_mostrar,
          rol: u.rol,
          medicoId: u.medico_fk && String(u.medico_fk),
          activo: Boolean(u.activo),
        };
      },
      async registrarAcceso(usuarioId) {
        await pool.query('UPDATE usuario SET ultimo_acceso = NOW() WHERE id_usuario = ?', [usuarioId]);
      },
    },

    pacientes: crearRepositorioPacientes(pool),
    atenciones: crearRepositorioAtenciones(pool),

    catalogos: {
      async listarMedicos() {
        const [filas] = await pool.query(
          `SELECT id_medico, CONCAT(nombres, ' ', apellidos) AS nombre, especialidad
           FROM medico WHERE activo = TRUE ORDER BY apellidos`,
        );
        return filas.map((f) => ({ id: String(f.id_medico), nombre: f.nombre, especialidad: f.especialidad }));
      },
      async listarMedicamentos() {
        const [filas] = await pool.query(
          `SELECT id_medicamento, nombre_generico, presentacion
           FROM medicamento WHERE activo = TRUE ORDER BY nombre_generico, presentacion`,
        );
        return filas.map((f) => ({
          id: String(f.id_medicamento),
          nombre: f.nombre_generico,
          presentacion: f.presentacion,
        }));
      },
    },
  };
}
