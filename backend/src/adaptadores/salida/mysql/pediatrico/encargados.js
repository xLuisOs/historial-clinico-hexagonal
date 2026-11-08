import { NoEncontrado } from '../../../../dominio/errores.js';

// Encargados (tutores) del pediátrico. Un mismo encargado puede tener varios
// niños a cargo (hermanos): al registrar a otro, se busca por DPI y se asocia
// en lugar de crearlo de nuevo (dpi es UNIQUE).

export function crearRepositorioEncargados(pool) {
  return {
    async buscarEncargado(dpi) {
      const [filas] = await pool.query(
        'SELECT id_encargado, nombres, apellidos, parentesco, telefono FROM encargado WHERE dpi = ?',
        [dpi],
      );
      if (filas.length === 0) throw new NoEncontrado('No hay un encargado registrado con ese DPI');
      const e = filas[0];
      const [ninos] = await pool.query(
        `SELECT CONCAT(nombres, ' ', apellidos) AS nombre FROM paciente
         WHERE encargado_fk = ? AND activo = TRUE ORDER BY fecha_nacimiento`,
        [e.id_encargado],
      );
      return {
        id: String(e.id_encargado),
        nombres: e.nombres,
        apellidos: e.apellidos,
        parentesco: e.parentesco,
        telefono: e.telefono,
        pacientes: ninos.map((n) => n.nombre),
      };
    },
  };
}
