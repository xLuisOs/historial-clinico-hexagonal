import { mensajeHistorico } from '../../../../dominio/catalogos.js';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion } from '../conexion.js';
import { idNumerico } from './pacientes.js';

// Catálogos del hospital que mantiene el admin (ver dominio/catalogos.js), con
// las tablas que ya existen. Los UNIQUE de la base son la última defensa;
// antes se revisa para dar un mensaje claro. Nada se borra: hospital_app no
// tiene DELETE.

/** UPDATE de las columnas que vinieron (un valor null también se guarda). */
async function actualizarColumnas(cx, tabla, columnaId, id, valores) {
  const columnas = Object.keys(valores).filter((c) => valores[c] !== undefined);
  if (columnas.length === 0) return;
  await cx.query(
    `UPDATE ${tabla} SET ${columnas.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE ${columnaId} = $${columnas.length + 1}`,
    [...columnas.map((c) => valores[c]), id],
  );
}

async function exigirUnico(cx, sql, params, mensaje) {
  const { rows } = await cx.query(sql, params);
  if (rows.length > 0) throw new Conflicto(mensaje);
}

async function exigirDepartamento(cx, departamentoId) {
  if (departamentoId == null) return null;
  const id = idNumerico(departamentoId, 'Departamento');
  const { rows } = await cx.query('SELECT 1 FROM departamento WHERE id_departamento = $1', [id]);
  if (rows.length === 0) throw new NoEncontrado('Ese departamento no existe');
  return id;
}

// ------------------------------------------------------------- habitaciones

const SELECT_HABITACION = `
  SELECT h.id_habitacion, h.numero, h.tipo, h.estado, h.departamento_fk, d.nombre AS departamento
  FROM habitacion h LEFT JOIN departamento d ON d.id_departamento = h.departamento_fk`;

const aHabitacion = (f) => ({
  id: String(f.id_habitacion),
  numero: f.numero,
  tipo: f.tipo,
  departamentoId: f.departamento_fk == null ? null : String(f.departamento_fk),
  departamento: f.departamento ?? null,
  // Inactiva = en mantenimiento. Ocupada sigue "activa", pero no se puede tocar su estado.
  activo: f.estado !== 'mantenimiento',
  nota: f.estado === 'ocupada' ? 'Ocupada' : null,
  // Mientras está ocupada, su estado lo manejan internar y dar de alta.
  estadoFijo: f.estado === 'ocupada',
});

function habitaciones(pool) {
  const leer = async (cx, id) => {
    const { rows: [f] } = await cx.query(`${SELECT_HABITACION} WHERE h.id_habitacion = $1`, [id]);
    if (!f) throw new NoEncontrado('Habitación no encontrada');
    return aHabitacion(f);
  };
  return {
    async listar() {
      const { rows } = await pool.query(`${SELECT_HABITACION} ORDER BY h.numero`);
      return rows.map(aHabitacion);
    },
    crear(h) {
      return enTransaccion(pool, async (cx) => {
        await exigirUnico(cx, 'SELECT 1 FROM habitacion WHERE lower(numero) = lower($1)', [h.numero], 'Ya hay una habitación con ese número');
        const departamento = await exigirDepartamento(cx, h.departamentoId);
        const { rows: [nueva] } = await cx.query(
          `INSERT INTO habitacion (numero, tipo, departamento_fk) VALUES ($1, $2, $3) RETURNING id_habitacion`,
          [h.numero, h.tipo, departamento],
        );
        return leer(cx, nueva.id_habitacion);
      });
    },
    actualizar(habitacionId, cambios) {
      const id = idNumerico(habitacionId, 'Habitación');
      return enTransaccion(pool, async (cx) => {
        await leer(cx, id);
        await actualizarColumnas(cx, 'habitacion', 'id_habitacion', id, {
          tipo: cambios.tipo,
          departamento_fk: 'departamentoId' in cambios ? await exigirDepartamento(cx, cambios.departamentoId) : undefined,
        });
        return leer(cx, id);
      });
    },
    // Mantenimiento: no se asigna al internar. Internar y dar de alta bloquean
    // la misma fila (FOR UPDATE), así que no se cruzan con este cambio.
    cambiarEstado(habitacionId, activo) {
      const id = idNumerico(habitacionId, 'Habitación');
      return enTransaccion(pool, async (cx) => {
        const { rows: [h] } = await cx.query('SELECT estado FROM habitacion WHERE id_habitacion = $1 FOR UPDATE', [id]);
        if (!h) throw new NoEncontrado('Habitación no encontrada');
        if (h.estado === 'ocupada') throw new Conflicto('La habitación está ocupada: primero se da de alta al paciente');
        await cx.query('UPDATE habitacion SET estado = $1 WHERE id_habitacion = $2', [activo ? 'disponible' : 'mantenimiento', id]);
        return leer(cx, id);
      });
    },
  };
}

// ------------------------------------------------------------- medicamentos

const SELECT_MEDICAMENTO = `
  SELECT m.id_medicamento, m.nombre, m.presentacion, m.principio_activo,
         EXISTS (SELECT 1 FROM detalle_receta d WHERE d.medicamento_fk = m.id_medicamento) AS recetado
  FROM medicamento m`;

const aMedicamento = (f) => ({
  id: String(f.id_medicamento),
  nombre: f.nombre,
  presentacion: f.presentacion,
  principioActivo: f.principio_activo,
  nota: f.recetado ? 'Ya recetado' : null,
});

function medicamentos(pool) {
  const leer = async (cx, id) => {
    const { rows: [f] } = await cx.query(`${SELECT_MEDICAMENTO} WHERE m.id_medicamento = $1`, [id]);
    if (!f) throw new NoEncontrado('Medicamento no encontrado');
    return f;
  };
  const repetido = (cx, nombre, presentacion, id = 0) => exigirUnico(
    cx,
    `SELECT 1 FROM medicamento WHERE lower(nombre) = lower($1)
       AND lower(coalesce(presentacion, '')) = lower(coalesce($2, '')) AND id_medicamento <> $3`,
    [nombre, presentacion, id],
    'Ya existe ese medicamento con esa presentación',
  );
  return {
    async listar() {
      const { rows } = await pool.query(`${SELECT_MEDICAMENTO} ORDER BY m.nombre, m.presentacion`);
      return rows.map(aMedicamento);
    },
    crear(m) {
      return enTransaccion(pool, async (cx) => {
        await repetido(cx, m.nombre, m.presentacion);
        const { rows: [nuevo] } = await cx.query(
          'INSERT INTO medicamento (nombre, presentacion, principio_activo) VALUES ($1, $2, $3) RETURNING id_medicamento',
          [m.nombre, m.presentacion, m.principioActivo],
        );
        return aMedicamento(await leer(cx, nuevo.id_medicamento));
      });
    },
    actualizar(medicamentoId, cambios) {
      const id = idNumerico(medicamentoId, 'Medicamento');
      return enTransaccion(pool, async (cx) => {
        const actual = await leer(cx, id);
        // Las recetas muestran el medicamento por su llave: no se reescribe lo recetado.
        if (actual.recetado && (cambios.nombre !== undefined || cambios.presentacion !== undefined)) {
          throw new Conflicto(mensajeHistorico('recetas'));
        }
        if (cambios.nombre !== undefined || cambios.presentacion !== undefined) {
          await repetido(cx, cambios.nombre ?? actual.nombre, cambios.presentacion !== undefined ? cambios.presentacion : actual.presentacion, id);
        }
        await actualizarColumnas(cx, 'medicamento', 'id_medicamento', id, {
          nombre: cambios.nombre, presentacion: cambios.presentacion, principio_activo: cambios.principioActivo,
        });
        return aMedicamento(await leer(cx, id));
      });
    },
  };
}

// --------------------------------------------- especialidades y departamentos

/** Catálogo de solo nombre (y ubicación, en departamentos), con nombre único. */
function catalogoSimple(pool, { tabla, columnaId, columnas, entidad, repetido }) {
  const seleccion = `SELECT ${columnaId}, ${Object.values(columnas).join(', ')} FROM ${tabla}`;
  const aRegistro = (f) => ({
    id: String(f[columnaId]),
    ...Object.fromEntries(Object.entries(columnas).map(([clave, col]) => [clave, f[col]])),
  });
  const leer = async (cx, id) => {
    const { rows: [f] } = await cx.query(`${seleccion} WHERE ${columnaId} = $1`, [id]);
    if (!f) throw new NoEncontrado(`${entidad} no encontrado`);
    return aRegistro(f);
  };
  const sinRepetir = (cx, nombre, id = 0) =>
    exigirUnico(cx, `SELECT 1 FROM ${tabla} WHERE lower(nombre) = lower($1) AND ${columnaId} <> $2`, [nombre, id], repetido);
  const aColumnas = (datos) => Object.fromEntries(Object.entries(columnas).map(([clave, col]) => [col, datos[clave]]));
  return {
    async listar() {
      const { rows } = await pool.query(`${seleccion} ORDER BY nombre`);
      return rows.map(aRegistro);
    },
    crear(datos) {
      return enTransaccion(pool, async (cx) => {
        await sinRepetir(cx, datos.nombre);
        const valores = aColumnas(datos);
        const cols = Object.keys(valores);
        const { rows: [nuevo] } = await cx.query(
          `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${columnaId}`,
          cols.map((c) => valores[c]),
        );
        return leer(cx, nuevo[columnaId]);
      });
    },
    actualizar(registroId, cambios) {
      const id = idNumerico(registroId, entidad);
      return enTransaccion(pool, async (cx) => {
        await leer(cx, id);
        if (cambios.nombre !== undefined) await sinRepetir(cx, cambios.nombre, id);
        await actualizarColumnas(cx, tabla, columnaId, id, aColumnas(cambios));
        return leer(cx, id);
      });
    },
  };
}

export function crearCatalogosAdmin(pool) {
  return {
    habitaciones: habitaciones(pool),
    medicamentos: medicamentos(pool),
    especialidades: catalogoSimple(pool, {
      tabla: 'especialidad', columnaId: 'id_especialidad', columnas: { nombre: 'nombre' },
      entidad: 'Especialidad', repetido: 'Ya existe esa especialidad',
    }),
    departamentos: catalogoSimple(pool, {
      tabla: 'departamento', columnaId: 'id_departamento', columnas: { nombre: 'nombre', ubicacion: 'ubicacion' },
      entidad: 'Departamento', repetido: 'Ya existe ese departamento',
    }),
  };
}
