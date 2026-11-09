// Adaptador MySQL del Centro Médico Pediátrico: implementa los puertos de
// puertos/repositorios.js sobre el esquema de db/mysql/01_esquema.sql.

import { listaDeEspecialidades } from '../../../../dominio/especialidades.js';
import { crearRepositorioAgenda } from './agenda.js';
import { crearRepositorioAntecedentes } from './antecedentes.js';
import { crearRepositorioAtenciones } from './atenciones.js';
import { crearCatalogosAdmin } from './catalogos.js';
import { crearRepositorioCobros } from './cobros.js';
import { crearRepositorioEncargados } from './encargados.js';
import { crearRepositorioPacientes } from './pacientes.js';
import { crearRepositorioPersonal } from './personal.js';
import { crearRepositorioRecepcionistas } from './recepcionistas.js';
import { crearRepositorioReportes } from './reportes.js';
import { crearRepositorioVacunas } from './vacunas.js';

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
      async estaActivo(usuarioId) {
        const [[u]] = await pool.query('SELECT activo FROM usuario WHERE id_usuario = ?', [usuarioId]);
        return Boolean(u?.activo);
      },
      // Perfil de quien inició sesión: su cuenta y, según el rol, sus datos de médico o de recepción.
      async obtenerPerfil(usuarioId) {
        const [[u]] = await pool.query(
          `SELECT u.id_usuario, u.correo, u.nombre_mostrar, u.rol, u.ultimo_acceso,
                  CONCAT(m.nombres, ' ', m.apellidos) AS medico, m.especialidad, m.numero_colegiado,
                  CONCAT(r.nombres, ' ', r.apellidos) AS recepcionista, r.telefono
           FROM usuario u
           LEFT JOIN medico m        ON m.id_medico = u.medico_fk
           LEFT JOIN recepcionista r ON r.id_recepcionista = u.recepcionista_fk
           WHERE u.id_usuario = ?`,
          [usuarioId],
        );
        return u && {
          id: String(u.id_usuario),
          nombre: u.medico ?? u.recepcionista ?? u.nombre_mostrar,
          correo: u.correo,
          rol: u.rol,
          ultimoAcceso: u.ultimo_acceso,
          especialidad: u.especialidad ?? null,
          numeroColegiado: u.numero_colegiado ?? null,
          telefono: u.telefono ?? null,
        };
      },
      async cambiarPassword(usuarioId, passwordHash) {
        await pool.query('UPDATE usuario SET password_hash = ? WHERE id_usuario = ?', [passwordHash, usuarioId]);
      },
    },

    // Puerto opcional (fuera del contrato común): citas.
    agenda: crearRepositorioAgenda(pool),

    // Puerto opcional: antecedentes médicos (incluye los perinatales).
    antecedentes: crearRepositorioAntecedentes(pool),
    // Puerto opcional: alta de médicos (con su usuario) por el administrador.
    personal: { ...crearRepositorioPersonal(pool), ...crearRepositorioRecepcionistas(pool) },
    // Puerto opcional: catálogos que mantiene el admin.
    catalogosAdmin: crearCatalogosAdmin(pool),
    // Puerto opcional: reportes del admin (totales del periodo).
    reportes: crearRepositorioReportes(pool),

    // Puerto propio del pediátrico: vacunación, cobros y encargados.
    pediatrico: {
      ...crearRepositorioVacunas(pool),
      ...crearRepositorioCobros(pool),
      ...crearRepositorioEncargados(pool),
    },

    pacientes: crearRepositorioPacientes(pool),
    atenciones: crearRepositorioAtenciones(pool),

    catalogos: {
      // → string[]: las especialidades en uso.
      async listarEspecialidades() {
        const [filas] = await pool.query('SELECT nombre FROM especialidad');
        return listaDeEspecialidades(filas.map((f) => f.nombre));
      },
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
