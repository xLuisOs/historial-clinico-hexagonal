import { mensajeHistorico } from '../../../../dominio/catalogos.js';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';

// Catálogos del pediátrico que mantiene el admin (ver dominio/catalogos.js):
// servicios (con su precio) y medicamentos, con las tablas que ya existen.
// Cambiar un precio no altera lo cobrado (detalle_cobro guarda su
// precio_unitario). Los cobros y las recetas muestran el nombre leyéndolo del
// catálogo, así que un registro ya usado no cambia de nombre (ni de
// presentación). Los UNIQUE de la base son la última defensa.

/**
 * `columnas`: clave del dominio → columna. `usado`: subconsulta que dice si el
 * registro ya se usó (recibe el id como ?). `historicos`: claves que no se
 * cambian si ya se usó.
 */
function catalogo(pool, { tabla, columnaId, columnas, unico, repetido, entidad, usado, usadoEn, historicos }) {
  const lista = Object.entries(columnas);
  const seleccion = `SELECT ${columnaId}, ${lista.map(([, c]) => c).join(', ')}, activo, EXISTS (${usado}) AS usado FROM ${tabla}`;
  const aRegistro = (f) => ({
    id: String(f[columnaId]),
    ...Object.fromEntries(lista.map(([clave, col]) => [clave, f[col]])),
    activo: Boolean(f.activo),
    nota: f.usado ? `Ya usado en ${usadoEn}` : null,
  });
  // La subconsulta `usado` compara contra la fila externa por su id.
  const leerFila = async (cx, id) => {
    const [[f]] = await cx.query(`${seleccion} WHERE ${columnaId} = ?`, [id]);
    if (!f) throw new NoEncontrado(`${entidad} no encontrado`);
    return f;
  };
  async function sinRepetir(cx, datos, id = 0) {
    const condicion = unico.map((c) => `LOWER(${columnas[c]}) = LOWER(?)`).join(' AND ');
    const [filas] = await cx.query(`SELECT 1 AS si FROM ${tabla} WHERE ${condicion} AND ${columnaId} <> ?`, [...unico.map((c) => datos[c]), id]);
    if (filas.length > 0) throw new Conflicto(repetido);
  }
  const aColumnas = (datos) => Object.fromEntries(lista.filter(([clave]) => datos[clave] !== undefined).map(([clave, col]) => [col, datos[clave]]));

  return {
    async listar() {
      const [filas] = await pool.query(`${seleccion} ORDER BY activo DESC, ${columnas.nombre}`);
      return filas.map(aRegistro);
    },
    crear(datos) {
      return enTransaccion(pool, async (cx) => {
        await sinRepetir(cx, datos);
        const valores = aColumnas(datos);
        const [r] = await cx.query(`INSERT INTO ${tabla} SET ?`, [valores]);
        return aRegistro(await leerFila(cx, r.insertId));
      });
    },
    actualizar(id, cambios) {
      return enTransaccion(pool, async (cx) => {
        const [[bloqueada]] = await cx.query(`SELECT ${columnaId} FROM ${tabla} WHERE ${columnaId} = ? FOR UPDATE`, [id]);
        if (!bloqueada) throw new NoEncontrado(`${entidad} no encontrado`);
        const actual = aRegistro(await leerFila(cx, id));
        if (actual.nota && historicos.some((c) => cambios[c] !== undefined && cambios[c] !== actual[c])) {
          throw new Conflicto(mensajeHistorico(usadoEn));
        }
        if (unico.some((c) => cambios[c] !== undefined)) await sinRepetir(cx, { ...actual, ...cambios }, id);
        const valores = aColumnas(cambios);
        if (Object.keys(valores).length > 0) await cx.query(`UPDATE ${tabla} SET ? WHERE ${columnaId} = ?`, [valores, id]);
        return aRegistro(await leerFila(cx, id));
      });
    },
    cambiarEstado(id, activo) {
      return enTransaccion(pool, async (cx) => {
        await leerFila(cx, id);
        await cx.query(`UPDATE ${tabla} SET activo = ? WHERE ${columnaId} = ?`, [activo, id]);
        return aRegistro(await leerFila(cx, id));
      });
    },
  };
}

/**
 * Catálogo de especialidades (tabla especialidad). medico.especialidad la
 * referencia por nombre con ON UPDATE CASCADE: renombrar aquí la corrige sola
 * en todos sus médicos. La collation ignora mayúsculas y tildes, así que el
 * UNIQUE también impide "Cardiologia" junto a "Cardiología".
 */
function especialidades(pool) {
  const cuenta = (n) => `${n} ${n === 1 ? 'médico' : 'médicos'}`;
  const SELECCION = `SELECT e.id_especialidad, e.nombre,
                            (SELECT COUNT(*) FROM medico m WHERE m.especialidad = e.nombre) AS medicos
                     FROM especialidad e`;
  const aRegistro = (f) => ({ id: String(f.id_especialidad), nombre: f.nombre, nota: cuenta(Number(f.medicos)) });
  async function leer(cx, id) {
    const [[f]] = await cx.query(`${SELECCION} WHERE e.id_especialidad = ?`, [id]);
    if (!f) throw new NoEncontrado('Especialidad no encontrada');
    return aRegistro(f);
  }
  async function sinRepetir(cx, nombre, id = 0) {
    const [[otra]] = await cx.query('SELECT 1 AS si FROM especialidad WHERE nombre = ? AND id_especialidad <> ?', [nombre, id]);
    if (otra) throw new Conflicto('Ya existe esa especialidad');
  }
  return {
    async listar() {
      const [filas] = await pool.query(`${SELECCION} ORDER BY e.nombre`);
      return filas.map(aRegistro);
    },
    crear({ nombre }) {
      return enTransaccion(pool, async (cx) => {
        await sinRepetir(cx, nombre);
        const [r] = await cx.query('INSERT INTO especialidad (nombre) VALUES (?)', [nombre]);
        return leer(cx, r.insertId);
      });
    },
    actualizar(id, { nombre }) {
      return enTransaccion(pool, async (cx) => {
        const [[actual]] = await cx.query('SELECT id_especialidad FROM especialidad WHERE id_especialidad = ? FOR UPDATE', [id]);
        if (!actual) throw new NoEncontrado('Especialidad no encontrada');
        await sinRepetir(cx, nombre, id);
        // El ON UPDATE CASCADE de fk_medico_especialidad corrige a los médicos.
        await cx.query('UPDATE especialidad SET nombre = ? WHERE id_especialidad = ?', [nombre, id]);
        return leer(cx, id);
      });
    },
  };
}

/** Agrega la especialidad al catálogo si todavía no está (al registrar o editar un médico con "Otra…"). */
export async function asegurarEspecialidad(cx, nombre) {
  if (nombre) await cx.query('INSERT IGNORE INTO especialidad (nombre) VALUES (?)', [nombre]);
}

export function crearCatalogosAdmin(pool) {
  return {
    especialidades: especialidades(pool),
    servicios: catalogo(pool, {
      tabla: 'servicio', columnaId: 'id_servicio',
      columnas: { nombre: 'nombre', descripcion: 'descripcion', precio: 'precio' },
      unico: ['nombre'], repetido: 'Ya existe un servicio con ese nombre', entidad: 'Servicio',
      usado: 'SELECT 1 FROM detalle_cobro d WHERE d.servicio_fk = servicio.id_servicio',
      usadoEn: 'cobros', historicos: ['nombre'],
    }),
    medicamentos: catalogo(pool, {
      tabla: 'medicamento', columnaId: 'id_medicamento',
      columnas: { nombre: 'nombre_generico', presentacion: 'presentacion' },
      unico: ['nombre', 'presentacion'], repetido: 'Ya existe ese medicamento con esa presentación', entidad: 'Medicamento',
      usado: 'SELECT 1 FROM detalle_receta d WHERE d.medicamento_fk = medicamento.id_medicamento',
      usadoEn: 'recetas', historicos: ['nombre', 'presentacion'],
    }),
  };
}
