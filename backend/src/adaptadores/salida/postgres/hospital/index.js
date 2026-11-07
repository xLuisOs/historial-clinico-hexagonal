// Adaptador PostgreSQL (Supabase) del Hospital General: implementa los puertos
// de puertos/repositorios.js sobre el esquema de db/postgres/01_esquema.sql.
// El esquema (hospital01) lo fija el usuario hospital_app con su search_path.

import { crearRepositorioAtenciones } from './atenciones.js';
import { crearRepositorioPacientes } from './pacientes.js';

export function crearAdaptadorHospitalPostgres(pool) {
  return {
    usuarios: {
      async buscarPorCorreo(correo) {
        const { rows } = await pool.query(
          `SELECT id_usuario, correo, password_hash, nombre_mostrar, rol, medico_fk, activo
           FROM usuario WHERE correo = $1`,
          [correo],
        );
        const u = rows[0];
        return u && {
          id: String(u.id_usuario),
          correo: u.correo,
          passwordHash: u.password_hash,
          nombre: u.nombre_mostrar,
          rol: u.rol,
          medicoId: u.medico_fk && String(u.medico_fk),
          activo: u.activo,
        };
      },
      async registrarAcceso(usuarioId) {
        await pool.query('UPDATE usuario SET ultimo_acceso = localtimestamp WHERE id_usuario = $1', [usuarioId]);
      },
    },

    pacientes: crearRepositorioPacientes(pool),
    atenciones: crearRepositorioAtenciones(pool),

    catalogos: {
      async listarMedicos() {
        const { rows } = await pool.query(
          `SELECT m.id_medico, m.nombres || ' ' || m.apellidos AS nombre, e.nombre AS especialidad
           FROM medico m LEFT JOIN especialidad e ON e.id_especialidad = m.especialidad_fk
           WHERE m.estado = 'activo' ORDER BY m.apellidos`,
        );
        return rows.map((f) => ({ id: String(f.id_medico), nombre: f.nombre, especialidad: f.especialidad }));
      },
      async listarMedicamentos() {
        const { rows } = await pool.query(
          'SELECT id_medicamento, nombre, presentacion FROM medicamento ORDER BY nombre, presentacion',
        );
        return rows.map((f) => ({ id: String(f.id_medicamento), nombre: f.nombre, presentacion: f.presentacion }));
      },
    },
  };
}
