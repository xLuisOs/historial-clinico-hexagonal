// Adaptador PostgreSQL (Supabase) del Hospital General: implementa los puertos
// de puertos/repositorios.js sobre el esquema de db/postgres/01_esquema.sql.
// El esquema (hospital01) lo fija el usuario hospital_app con su search_path.

import { crearRepositorioAgenda } from './agenda.js';
import { crearRepositorioAntecedentes } from './antecedentes.js';
import { crearRepositorioAtenciones } from './atenciones.js';
import { crearCatalogosAdmin } from './catalogos.js';
import { crearRepositorioFacturacion } from './facturacion.js';
import { crearRepositorioInternamientos } from './internamientos.js';
import { crearRepositorioPacientes } from './pacientes.js';
import { crearRepositorioPersonal } from './personal.js';
import { crearRepositorioRecepcionistas } from './recepcionistas.js';
import { crearRepositorioReportes } from './reportes.js';

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
      async estaActivo(usuarioId) {
        const { rows: [u] } = await pool.query('SELECT activo FROM usuario WHERE id_usuario = $1', [Number(usuarioId)]);
        return Boolean(u?.activo);
      },
      // Perfil de quien inició sesión: su cuenta y, según el rol, sus datos de médico o de recepción.
      async obtenerPerfil(usuarioId) {
        const { rows: [u] } = await pool.query(
          `SELECT u.id_usuario, u.correo, u.nombre_mostrar, u.rol, u.ultimo_acceso,
                  m.nombres || ' ' || m.apellidos AS medico, m.numero_colegiado, m.telefono AS telefono_medico,
                  e.nombre AS especialidad,
                  r.nombres || ' ' || r.apellidos AS recepcionista, r.telefono AS telefono_recepcion
           FROM usuario u
           LEFT JOIN medico m        ON m.id_medico = u.medico_fk
           LEFT JOIN especialidad e  ON e.id_especialidad = m.especialidad_fk
           LEFT JOIN recepcionista r ON r.id_recepcionista = u.recepcionista_fk
           WHERE u.id_usuario = $1`,
          [Number(usuarioId)],
        );
        return u && {
          id: String(u.id_usuario),
          nombre: u.medico ?? u.recepcionista ?? u.nombre_mostrar,
          correo: u.correo,
          rol: u.rol,
          ultimoAcceso: u.ultimo_acceso,
          especialidad: u.especialidad ?? null,
          numeroColegiado: u.numero_colegiado ?? null,
          telefono: u.telefono_medico ?? u.telefono_recepcion ?? null,
        };
      },
      async cambiarPassword(usuarioId, passwordHash) {
        await pool.query('UPDATE usuario SET password_hash = $1 WHERE id_usuario = $2', [passwordHash, Number(usuarioId)]);
      },
    },

    // Puerto opcional (fuera del contrato común): citas.
    agenda: crearRepositorioAgenda(pool),
    // Puerto opcional: antecedentes médicos.
    antecedentes: crearRepositorioAntecedentes(pool),
    // Puerto opcional: médicos y recepcionistas (con su usuario), por el administrador.
    personal: { ...crearRepositorioPersonal(pool), ...crearRepositorioRecepcionistas(pool) },
    // Puerto opcional: catálogos que mantiene el admin.
    catalogosAdmin: crearCatalogosAdmin(pool),
    // Puerto opcional: reportes del admin (totales del periodo).
    reportes: crearRepositorioReportes(pool),
    // Puertos propios del hospital (fuera del contrato común).
    internamientos: crearRepositorioInternamientos(pool),
    facturacion: crearRepositorioFacturacion(pool),

    pacientes: crearRepositorioPacientes(pool),
    atenciones: crearRepositorioAtenciones(pool),

    catalogos: {
      // → string[]: el catálogo de especialidades del hospital.
      async listarEspecialidades() {
        const { rows } = await pool.query('SELECT nombre FROM especialidad ORDER BY nombre');
        return rows.map((f) => f.nombre);
      },
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
