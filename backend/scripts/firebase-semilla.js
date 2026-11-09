// Carga datos de prueba de la Clínica Odontológica en Firestore.
//
//   npm run db:firebase:semilla                    agrega lo que falte
//   npm run db:firebase:semilla -- --reiniciar     BORRA todas las colecciones y las vuelve a llenar
//
// Sin --reiniciar no borra ni sobrescribe nada: si ya existe un registro con
// la misma clave (nombre del procedimiento, correo del usuario, documento del
// paciente...), lo reutiliza. Así convive con los datos creados a mano en la
// consola. Al final recalcula terminos_busqueda de todos los pacientes.
//
// Usuarios de prueba (contraseña de todos: Odonto#2026)
//   dra.ramirez@odonto.gt   odontóloga
//   dr.estrada@odonto.gt    odontólogo
//   recepcion@odonto.gt     recepcionista
//   admin@odonto.gt         administrador

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Timestamp } from 'firebase-admin/firestore';
import { crearFirestore, fechaATimestamp } from '../src/adaptadores/salida/firebase/conexion.js';
import { COLECCIONES, terminosBusqueda } from '../src/adaptadores/salida/firebase/odontologica/modelo.js';

dotenv.config({ quiet: true });

const ZONA = process.env.ZONA_HORARIA ?? '-06:00';
const CLAVE_PRUEBA = 'Odonto#2026';

const db = crearFirestore({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credenciales: process.env.FIREBASE_CREDENTIALS,
});
const col = (nombre) => db.collection(COLECCIONES[nombre]);

/** Fecha y hora local relativa a hoy: instante(-3, '09:00') = hace 3 días a las 9. */
function instante(dias, hora) {
  const hoyLocal = new Date(Date.now() + Number(ZONA.slice(0, 3)) * 3_600_000);
  hoyLocal.setUTCDate(hoyLocal.getUTCDate() + dias);
  return Timestamp.fromDate(new Date(`${hoyLocal.toISOString().slice(0, 10)}T${hora}:00${ZONA}`));
}

/**
 * Devuelve el id del documento cuya clave coincide; si no existe, lo crea.
 * `clave` son los campos que identifican al registro (p. ej. { correo }).
 */
async function asegurar(nombre, clave, datos) {
  let consulta = col(nombre);
  for (const [campo, valor] of Object.entries(clave)) consulta = consulta.where(campo, '==', valor);
  const existente = await consulta.limit(1).get();
  if (!existente.empty) return { id: existente.docs[0].id, nuevo: false };
  const ref = await col(nombre).add({ ...clave, ...datos });
  return { id: ref.id, nuevo: true };
}

/** Crea el documento con id fijo solo si todavía no existe. */
async function crearSiFalta(nombre, id, datos) {
  try {
    await col(nombre).doc(id).create(datos);
    return true;
  } catch (error) {
    if (error.code === 6) return false; // ALREADY_EXISTS
    throw error;
  }
}

function informar(nombre, resultados) {
  const nuevos = resultados.filter((r) => r.nuevo === true || r === true).length;
  console.log(`· ${COLECCIONES[nombre].padEnd(15)} ${nuevos} nuevos, ${resultados.length - nuevos} ya existían`);
}

// ---------------------------------------------------------------- reinicio

if (process.argv.includes('--reiniciar')) {
  console.log('· Borrando todas las colecciones de la clínica...');
  for (const nombre of Object.values(COLECCIONES)) await db.recursiveDelete(db.collection(nombre));
}

// --------------------------------------------------------------- catálogos

const procedimientos = {};
const resultadosProc = [];
for (const [clave, nombre, descripcion, costo] of [
  ['limpieza', 'Limpieza dental', 'Profilaxis y remoción de sarro', 150],
  ['resina', 'Resina', 'Restauración con resina compuesta', 350],
  ['extraccion', 'Extracción simple', 'Extracción de pieza sin cirugía', 250],
  ['sellante', 'Sellante de fosas y fisuras', 'Prevención de caries en molares', 100],
  ['endodoncia', 'Endodoncia unirradicular', 'Tratamiento de conductos de una raíz', 1200],
  ['evaluacion', 'Consulta de evaluación', 'Revisión general y plan de tratamiento', 100],
]) {
  const r = await asegurar('procedimientos', { nombre }, { descripcion, costo, activo: true });
  procedimientos[clave] = { id: r.id, nombre, costo };
  resultadosProc.push(r);
}
informar('procedimientos', resultadosProc);

const medicamentos = {};
const resultadosMed = [];
for (const [clave, nombre, presentacion] of [
  ['ibuprofeno', 'Ibuprofeno', 'Tabletas 400 mg'],
  ['amoxicilina', 'Amoxicilina', 'Cápsulas 500 mg'],
  ['acetaminofen', 'Acetaminofén', 'Tabletas 500 mg'],
  ['clorhexidina', 'Clorhexidina', 'Enjuague bucal 0.12 %'],
  ['ketorolaco', 'Ketorolaco', 'Tabletas 10 mg'],
]) {
  const r = await asegurar('medicamentos', { nombre, presentacion }, { activo: true });
  medicamentos[clave] = { id: r.id, texto: `${nombre} — ${presentacion}` };
  resultadosMed.push(r);
}
informar('medicamentos', resultadosMed);

// ---------------------------------------------------------------- personal

const ramirez = await asegurar('odontologos', { numero_colegiado: '23456' }, {
  nombres: 'Lucía Fernanda', apellidos: 'Ramírez Ortiz', telefono: '5521-3344', activo: true,
});
const estrada = await asegurar('odontologos', { numero_colegiado: '34567' }, {
  nombres: 'Jorge Luis', apellidos: 'Estrada Molina', telefono: '5598-7766', activo: true,
});
informar('odontologos', [ramirez, estrada]);

const juarez = await asegurar('recepcionistas', { nombres: 'Andrea Sofía', apellidos: 'Juárez Castillo' }, { activo: true });
informar('recepcionistas', [juarez]);

const hash = await bcrypt.hash(CLAVE_PRUEBA, 10);
const usuarios = [
  ['dra.ramirez@odonto.gt', 'Lucía Fernanda', 'Ramírez Ortiz', 'odontologo', ramirez.id, null],
  ['dr.estrada@odonto.gt', 'Jorge Luis', 'Estrada Molina', 'odontologo', estrada.id, null],
  ['recepcion@odonto.gt', 'Andrea Sofía', 'Juárez Castillo', 'recepcionista', null, juarez.id],
  ['admin@odonto.gt', 'Administración', 'Clínica', 'administrador', null, null],
];
const resultadosUsu = [];
for (const [correo, nombres, apellidos, rol, odontologoId, recepcionistaId] of usuarios) {
  resultadosUsu.push(await asegurar('usuarios', { correo }, {
    password_hash: hash,
    nombres,
    apellidos,
    rol,
    odontologo_id: odontologoId,
    recepcionista_id: recepcionistaId,
    activo: true,
    ultimo_acceso: null,
  }));
}
informar('usuarios', resultadosUsu);

// --------------------------------------------------------------- pacientes

const nuevoPaciente = (nombres, apellidos, fechaNacimiento, sexo, alergias, telefono, direccion) => ({
  nombres,
  apellidos,
  terminos_busqueda: terminosBusqueda(nombres, apellidos),
  fecha_nacimiento: fechaATimestamp(fechaNacimiento, ZONA),
  sexo,
  alergias,
  contacto: { telefono, direccion },
  estado: { activo: true, fecha_registro: instante(-90, '08:00'), fecha_baja: null, motivo_baja: null, detalle_baja: null },
});

const perez = await asegurar('pacientes', { documento: '2456789010101' },
  nuevoPaciente('Luis Fernando', 'Pérez Gómez', '1990-05-14', 'M', null, '5512-3456', 'Zona 1, Guatemala'));
const cifuentes = await asegurar('pacientes', { documento: '3012345670101' },
  nuevoPaciente('Ana Gabriela', 'Cifuentes Rodas', '2001-11-02', 'F', 'Látex', '4433-2211', 'Zona 7, Mixco'));
const diaz = await asegurar('pacientes', { documento: '4123456780108' },
  nuevoPaciente('Mateo Alejandro', 'Díaz Barrios', '2015-08-20', 'M', 'Penicilina', '3011-4455', 'Zona 18, Guatemala'));
informar('pacientes', [perez, cifuentes, diaz]);

// ------------------------------------------------------- citas y consultas

const copia = (id, nombres, apellidos) => ({ id, nombres, apellidos });
const pacPerez = copia(perez.id, 'Luis Fernando', 'Pérez Gómez');
const pacCifuentes = copia(cifuentes.id, 'Ana Gabriela', 'Cifuentes Rodas');
const pacDiaz = copia(diaz.id, 'Mateo Alejandro', 'Díaz Barrios');
const odoRamirez = copia(ramirez.id, 'Lucía Fernanda', 'Ramírez Ortiz');
const odoEstrada = copia(estrada.id, 'Jorge Luis', 'Estrada Molina');
const recJuarez = copia(juarez.id, 'Andrea Sofía', 'Juárez Castillo');

const cita = (paciente, odontologo, dias, hora, duracion, estado, motivo) => ({
  fecha_hora: instante(dias, hora),
  duracion_min: duracion,
  estado,
  motivo,
  paciente,
  odontologo,
  agendada_por: recJuarez,
  fecha_registro: instante(dias - 7, '10:00'),
});

const citas = [
  await crearSiFalta('citas', 'semilla-cita-1', cita(pacPerez, odoRamirez, -10, '09:00', 60, 'atendida', 'Limpieza y molestia en muela superior')),
  await crearSiFalta('citas', 'semilla-cita-2', cita(pacPerez, odoRamirez, 5, '10:00', 30, 'programada', 'Control de resina')),
  await crearSiFalta('citas', 'semilla-cita-3', cita(pacCifuentes, odoEstrada, 3, '15:30', 30, 'programada', 'Evaluación general')),
  await crearSiFalta('citas', 'semilla-cita-4', cita(pacDiaz, odoEstrada, -4, '14:00', 30, 'no_asistio', 'Aplicación de sellantes')),
];
informar('citas', citas);

const procedimiento = (clave, piezaDental, observaciones) => ({
  procedimiento_id: procedimientos[clave].id,
  nombre: procedimientos[clave].nombre,
  pieza_dental: piezaDental,
  observaciones,
  precio_aplicado: procedimientos[clave].costo,
});
const item = (clave, dosis, frecuencia, duracionDias) => ({
  medicamento_id: medicamentos[clave].id,
  medicamento: medicamentos[clave].texto,
  dosis,
  frecuencia,
  duracion_dias: duracionDias,
  via: 'oral',
  indicaciones: null,
});
const pago = (dias, hora, metodo, monto, referencia = null) => ({
  fecha: instante(dias, hora), metodo_pago: metodo, monto, referencia, registrado_por: recJuarez,
});

const consultas = [
  // Con cita: limpieza + resina, abono parcial.
  await crearSiFalta('consultas', 'semilla-consulta-1', {
    paciente_id: perez.id,
    cita_id: 'semilla-cita-1',
    fecha_atencion: instante(-10, '09:10'),
    odontologo: odoRamirez,
    motivo: 'Limpieza y molestia en muela superior',
    notas: 'Sarro moderado. Caries en pieza 26, se restaura con resina.',
    procedimientos: [procedimiento('limpieza', null, 'Sarro moderado'), procedimiento('resina', 26, 'Cara oclusal')],
    diagnosticos: [
      { codigo_cie10: 'K02.1', descripcion: 'Caries de la dentina', tipo: 'principal' },
      { codigo_cie10: 'K03.6', descripcion: 'Depósitos en los dientes (sarro)', tipo: 'secundario' },
    ],
    receta: {
      fecha_emision: instante(-10, '10:00'),
      indicaciones: 'Tomar después de comer',
      items: [item('ibuprofeno', '1 tableta', 'cada 8 horas', 3)],
    },
    total: procedimientos.limpieza.costo + procedimientos.resina.costo,
    estado_pago: 'parcial',
    pagos: [pago(-10, '10:15', 'efectivo', 300)],
  }),
  // Sin cita (llegó por dolor): extracción, pagada completa.
  await crearSiFalta('consultas', 'semilla-consulta-2', {
    paciente_id: cifuentes.id,
    cita_id: null,
    fecha_atencion: instante(-20, '11:30'),
    odontologo: odoEstrada,
    motivo: 'Dolor intenso en muela del juicio',
    notas: 'Tercer molar inferior derecho con caries extensa, se extrae.',
    procedimientos: [procedimiento('extraccion', 48, 'Sin complicaciones')],
    diagnosticos: [{ codigo_cie10: 'K02.1', descripcion: 'Caries de la dentina', tipo: 'principal' }],
    receta: {
      fecha_emision: instante(-20, '12:00'),
      indicaciones: 'No enjuagar con fuerza las primeras 24 horas',
      items: [
        item('amoxicilina', '1 cápsula', 'cada 8 horas', 7),
        item('ibuprofeno', '1 tableta', 'cada 8 horas', 3),
      ],
    },
    total: procedimientos.extraccion.costo,
    estado_pago: 'pagado',
    pagos: [pago(-20, '12:10', 'tarjeta', procedimientos.extraccion.costo, '482913')],
  }),
];
informar('consultas', consultas);

// ------------------------------------------- términos de búsqueda (todos)

const todos = await col('pacientes').get();
let actualizados = 0;
for (const doc of todos.docs) {
  const terminos = terminosBusqueda(doc.get('nombres'), doc.get('apellidos'));
  if (JSON.stringify(terminos) !== JSON.stringify(doc.get('terminos_busqueda'))) {
    await doc.ref.update({ terminos_busqueda: terminos });
    actualizados++;
  }
}
console.log(`· terminos_busqueda recalculados en ${actualizados} de ${todos.size} pacientes`);

console.log(`\nClínica odontológica lista. Usuarios de prueba: contraseña ${CLAVE_PRUEBA}`);
await db.terminate();
