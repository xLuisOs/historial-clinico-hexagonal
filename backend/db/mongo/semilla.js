// =====================================================================
// Laboratorio Clínico — datos de prueba
//
// Usuarios de prueba (contraseña de todos: Laboratorio#2026)
//   qb.lopez@lab.gt      químico biólogo
//   qb.mendez@lab.gt     químico biólogo
//   recepcion@lab.gt     recepción
//   admin@lab.gt         administrador
// =====================================================================

import { ObjectId } from 'mongodb';
import { interpretarValor } from '../../src/dominio/laboratorio.js';
import { nombreBusqueda } from '../../src/adaptadores/salida/mongo/laboratorio/modelo.js';

const HASH = '$2b$10$iEHNZZKpI9k0OGiUGLogpeHfkYRPGYiD9N2uaXjCLb7kGDu79Xxem';
const fecha = (texto) => new Date(`${texto}-06:00`); // hora de Guatemala

// ------------------------------------------------------------------ catálogos

const num = (codigo, nombre, unidad, ref_min, ref_max) => ({ codigo, nombre, tipo_valor: 'numerico', unidad, ref_min, ref_max });
const opc = (codigo, nombre, opciones, valor_normal) => ({ codigo, nombre, tipo_valor: 'opcion', opciones, valor_normal });
const txt = (codigo, nombre, valor_normal = null) => ({ codigo, nombre, tipo_valor: 'texto', valor_normal });

const TIPOS = [
  {
    codigo: 'HEMA', nombre: 'Hematología completa', categoria: 'Hematología', muestra: 'Sangre (EDTA)', precio: 75,
    descripcion: 'Recuento de células sanguíneas',
    parametros: [
      num('HB', 'Hemoglobina', 'g/dL', 12, 16),
      num('HTO', 'Hematocrito', '%', 36, 46),
      num('LEU', 'Leucocitos', 'x10³/µL', 4.5, 11),
      num('PLT', 'Plaquetas', 'x10³/µL', 150, 450),
      num('NEU', 'Neutrófilos', '%', 40, 70),
      num('LIN', 'Linfocitos', '%', 20, 40),
    ],
  },
  {
    codigo: 'GLU', nombre: 'Glucosa en ayunas', categoria: 'Química sanguínea', muestra: 'Suero', precio: 30,
    parametros: [num('GLU', 'Glucosa', 'mg/dL', 70, 100)],
  },
  {
    codigo: 'HBA1C', nombre: 'Hemoglobina glicosilada', categoria: 'Química sanguínea', muestra: 'Sangre (EDTA)', precio: 120,
    parametros: [num('HBA1C', 'HbA1c', '%', 4, 5.6)],
  },
  {
    codigo: 'LIPIDOS', nombre: 'Perfil lipídico', categoria: 'Química sanguínea', muestra: 'Suero', precio: 140,
    parametros: [
      num('COL', 'Colesterol total', 'mg/dL', null, 200),
      num('TG', 'Triglicéridos', 'mg/dL', null, 150),
      num('HDL', 'Colesterol HDL', 'mg/dL', 40, null),
      num('LDL', 'Colesterol LDL', 'mg/dL', null, 130),
    ],
  },
  {
    codigo: 'CREA', nombre: 'Creatinina', categoria: 'Química sanguínea', muestra: 'Suero', precio: 35,
    parametros: [num('CREA', 'Creatinina', 'mg/dL', 0.6, 1.2)],
  },
  {
    codigo: 'ORINA', nombre: 'Examen general de orina', categoria: 'Uroanálisis', muestra: 'Orina', precio: 40,
    parametros: [
      txt('COLOR', 'Color', 'Amarillo'),
      opc('ASPECTO', 'Aspecto', ['Claro', 'Ligeramente turbio', 'Turbio'], 'Claro'),
      num('PH', 'pH', null, 5, 8),
      num('DENS', 'Densidad', null, 1.005, 1.03),
      opc('PROT', 'Proteínas', ['Negativo', 'Trazas', '+', '++', '+++'], 'Negativo'),
      opc('GLU_O', 'Glucosa', ['Negativo', 'Trazas', '+', '++', '+++'], 'Negativo'),
      num('LEU_O', 'Leucocitos', '/campo', 0, 5),
    ],
  },
  {
    codigo: 'UROCULT', nombre: 'Urocultivo', categoria: 'Microbiología', muestra: 'Orina (chorro medio)', precio: 150,
    descripcion: 'Cultivo con antibiograma si es positivo',
    parametros: [
      opc('RESULT', 'Resultado', ['Negativo', 'Positivo'], 'Negativo'),
      txt('MICRO', 'Microorganismo aislado'),
      txt('RECUENTO', 'Recuento'),
      txt('ANTIBIO', 'Antibiograma'),
    ],
  },
].map((t) => ({ _id: new ObjectId(), activo: true, descripcion: null, ...t }));

const tipo = (codigo) => TIPOS.find((t) => t.codigo === codigo);

const MEDICAMENTOS = [
  ['Metformina', 'Tabletas 850 mg'],
  ['Warfarina', 'Tabletas 5 mg'],
  ['Atorvastatina', 'Tabletas 20 mg'],
  ['Levotiroxina', 'Tabletas 100 mcg'],
  ['Losartán', 'Tabletas 50 mg'],
  ['Ácido acetilsalicílico', 'Tabletas 100 mg'],
].map(([nombre, presentacion]) => ({ _id: new ObjectId(), nombre, presentacion, activo: true }));

const medicamento = (nombre) => MEDICAMENTOS.find((m) => m.nombre === nombre);

const REFERENTES = [
  ['Carlos Eduardo', 'Pineda Rosales', '10234', 'Medicina interna', '2334-5566', 'Hospital General'],
  ['Mariela', 'Cifuentes Arana', '11876', 'Endocrinología', '2245-7788', 'Consultorio privado'],
  ['Ana Lucía', 'Morales Pérez', '12345', 'Pediatría general', '2289-1010', 'Centro Médico Pediátrico'],
  ['Héctor', 'Barrios Monzón', '9821', 'Urología', '2390-4433', 'Clínica Zona 10'],
].map(([nombres, apellidos, numero_colegiado, especialidad, telefono, institucion_procedencia]) => ({
  _id: new ObjectId(), nombres, apellidos, numero_colegiado, especialidad, telefono, institucion_procedencia, activo: true,
}));

// -------------------------------------------------------------------- personal

const USUARIOS = [
  ['qb.lopez@lab.gt', 'Andrea Beatriz', 'López Santizo', 'quimico_biologo', 'QB-3021'],
  ['qb.mendez@lab.gt', 'Rodrigo', 'Méndez Ochoa', 'quimico_biologo', 'QB-2877'],
  ['recepcion@lab.gt', 'Gabriela', 'Tum Xicará', 'recepcion', null],
  ['admin@lab.gt', 'Mario', 'Estrada Coyoy', 'admin', null],
].map(([correo, nombres, apellidos, rol, numero_colegiado]) => ({
  _id: new ObjectId(), correo, password_hash: HASH, nombres, apellidos, rol, numero_colegiado, activo: true, ultimo_acceso: null,
}));

const [lopez, mendez] = USUARIOS;
const firma = (u) => ({ id: u._id, nombre: `${u.nombres} ${u.apellidos}` });

// ------------------------------------------------------------------- pacientes

function paciente({ nombres, apellidos, nacimiento, sexo, documento = null, telefono, direccion = null, correo = null, responsable = null, alergias = null, sangre = null, registro }) {
  return {
    _id: new ObjectId(),
    nombres,
    apellidos,
    nombre_busqueda: nombreBusqueda(nombres, apellidos),
    fecha_nacimiento: new Date(`${nacimiento}T00:00:00Z`),
    sexo,
    documento,
    contacto: { telefono, direccion, correo },
    responsable,
    datos_clinicos: { tipo_sangre: sangre, alergias },
    estado: { activo: true, fecha_registro: fecha(registro), fecha_baja: null, motivo_baja: null, detalle_baja: null },
  };
}

const roberto = paciente({
  nombres: 'Roberto Antonio', apellidos: 'Gómez Fuentes', nacimiento: '1968-04-12', sexo: 'M',
  documento: '1845632980101', telefono: '5512-8899', direccion: '12 calle 5-40, zona 7, Guatemala',
  correo: 'roberto.gomez@correo.gt', sangre: 'B+', registro: '2025-02-03T08:10:00',
});
const ana = paciente({
  nombres: 'Ana Sofía', apellidos: 'Morales Recinos', nacimiento: '1994-09-30', sexo: 'F',
  documento: '2987456120101', telefono: '4433-2211', direccion: 'Villa Nueva, colonia Las Margaritas',
  alergias: 'Sulfas', registro: '2026-07-14T07:40:00',
});
const pedro = paciente({
  nombres: 'Pedro José', apellidos: 'Ixcot Ramírez', nacimiento: '2018-02-17', sexo: 'M',
  telefono: '3322-1100',
  responsable: { nombres: 'Marta Lidia', apellidos: 'Ramírez Coj', parentesco: 'madre', documento: '2233445560101', telefono: '3322-1100' },
  registro: '2026-10-28T09:00:00',
});
const lucia = paciente({
  nombres: 'Lucía Fernanda', apellidos: 'Castañeda Vela', nacimiento: '1985-12-05', sexo: 'F',
  documento: '1678904320101', telefono: '5000-1122', registro: '2024-03-11T10:20:00',
});

// --------------------------------------------------------------------- órdenes

/**
 * Examen de la orden a partir del catálogo, con los valores indicados
 * (código → valor). Si se indica `validado`, queda firmado.
 */
function examen(codigo, valores = {}, { tomado = null, validado = null } = {}) {
  const t = tipo(codigo);
  const parametros = t.parametros.map((p) => {
    const tieneValor = valores[p.codigo] !== undefined;
    const { valor, fueraDeRango } = tieneValor ? interpretarValor(p, valores[p.codigo]) : {};
    return {
      codigo: p.codigo, nombre: p.nombre, tipo_valor: p.tipo_valor, unidad: p.unidad ?? null,
      ref_min: p.ref_min ?? null, ref_max: p.ref_max ?? null, opciones: p.opciones ?? null, valor_normal: p.valor_normal ?? null,
      valor: tieneValor ? valor : null,
      fuera_de_rango: tieneValor ? fueraDeRango : null,
      observacion: null,
      fecha_resultado: tieneValor ? tomado : null,
    };
  });
  const completos = parametros.every((p) => p.valor !== null);
  const algunos = parametros.some((p) => p.valor !== null);
  return {
    tipo_examen_id: t._id,
    codigo: t.codigo,
    nombre: t.nombre,
    estado: validado ? 'validado' : completos ? 'resultados_completos' : algunos ? 'en_proceso' : 'pendiente',
    fecha_toma_muestra: tomado,
    validado_por: validado ? firma(validado.por) : null,
    fecha_validacion: validado ? validado.fecha : null,
    parametros,
  };
}

const referente = (r) => ({ id: r._id, nombre: `${r.nombres} ${r.apellidos}`, numero_colegiado: r.numero_colegiado });
const diagnostico = (codigo_cie10, descripcion, cuando, tipo = 'principal') => ({ codigo_cie10, descripcion, tipo, fecha_registro: cuando });
const med = (nombre, dosis, frecuencia, duracion_dias = 30) => ({
  medicamento_id: medicamento(nombre)._id,
  medicamento: `${medicamento(nombre).nombre} — ${medicamento(nombre).presentacion}`,
  dosis, frecuencia, duracion_dias, via: 'oral', indicaciones: null,
});

let correlativo = 0;
function orden({ anio, paciente: p, cuando, estado, por, ref, motivo, diagnosticos, medicacion = null, examenes }) {
  correlativo += 1;
  return {
    _id: new ObjectId(),
    numero: `LAB-${anio}-${String(correlativo).padStart(5, '0')}`,
    paciente_id: p._id,
    fecha_orden: cuando,
    estado,
    motivo,
    observaciones: null,
    registrada_por: firma(por),
    medico_referente: referente(ref),
    diagnosticos,
    medicacion_actual: medicacion && { fecha_registro: cuando, indicaciones: null, items: medicacion },
    examenes,
  };
}

const [pineda, cifuentes, morales, barrios] = REFERENTES;

// Roberto: diabético en control; tres órdenes muestran la evolución de su glucosa.
const ordenes2025 = [
  (() => {
    const c = fecha('2025-02-03T08:15:00');
    return orden({
      anio: 2025, paciente: roberto, cuando: c, estado: 'completada', por: lopez, ref: cifuentes,
      motivo: 'Control metabólico inicial',
      diagnosticos: [diagnostico('E11.9', 'Diabetes mellitus tipo 2 sin complicaciones', c)],
      examenes: [
        examen('GLU', { GLU: 168 }, { tomado: c, validado: { por: lopez, fecha: fecha('2025-02-03T11:00:00') } }),
        examen('HBA1C', { HBA1C: 8.4 }, { tomado: c, validado: { por: lopez, fecha: fecha('2025-02-03T11:05:00') } }),
        examen('LIPIDOS', { COL: 236, TG: 210, HDL: 38, LDL: 156 }, { tomado: c, validado: { por: lopez, fecha: fecha('2025-02-03T11:10:00') } }),
      ],
    });
  })(),
  (() => {
    const c = fecha('2025-08-20T07:50:00');
    return orden({
      anio: 2025, paciente: roberto, cuando: c, estado: 'completada', por: mendez, ref: cifuentes,
      motivo: 'Control trimestral',
      diagnosticos: [diagnostico('E11.9', 'Diabetes mellitus tipo 2 sin complicaciones', c)],
      medicacion: [med('Metformina', '1 tableta', 'cada 12 horas'), med('Atorvastatina', '1 tableta', 'cada noche')],
      examenes: [
        examen('GLU', { GLU: 132 }, { tomado: c, validado: { por: mendez, fecha: fecha('2025-08-20T10:30:00') } }),
        examen('HBA1C', { HBA1C: 7.1 }, { tomado: c, validado: { por: mendez, fecha: fecha('2025-08-20T10:35:00') } }),
      ],
    });
  })(),
];
correlativo = 0;
const ordenes2026 = [
  (() => {
    const c = fecha('2026-03-10T08:05:00');
    return orden({
      anio: 2026, paciente: roberto, cuando: c, estado: 'completada', por: lopez, ref: cifuentes,
      motivo: 'Control semestral',
      diagnosticos: [diagnostico('E11.9', 'Diabetes mellitus tipo 2 sin complicaciones', c)],
      medicacion: [med('Metformina', '1 tableta', 'cada 12 horas'), med('Atorvastatina', '1 tableta', 'cada noche')],
      examenes: [
        examen('GLU', { GLU: 104 }, { tomado: c, validado: { por: lopez, fecha: fecha('2026-03-10T10:00:00') } }),
        examen('HBA1C', { HBA1C: 6.4 }, { tomado: c, validado: { por: lopez, fecha: fecha('2026-03-10T10:05:00') } }),
        examen('LIPIDOS', { COL: 188, TG: 142, HDL: 44, LDL: 116 }, { tomado: c, validado: { por: lopez, fecha: fecha('2026-03-10T10:10:00') } }),
        examen('CREA', { CREA: 1.0 }, { tomado: c, validado: { por: lopez, fecha: fecha('2026-03-10T10:15:00') } }),
      ],
    });
  })(),
  (() => {
    const c = fecha('2026-07-14T07:45:00');
    return orden({
      anio: 2026, paciente: ana, cuando: c, estado: 'completada', por: mendez, ref: barrios,
      motivo: 'Disuria y polaquiuria de 4 días',
      diagnosticos: [diagnostico('N39.0', 'Infección de vías urinarias, sitio no especificado', c)],
      examenes: [
        examen('ORINA', { COLOR: 'Amarillo oscuro', ASPECTO: 'Turbio', PH: 6.5, DENS: 1.025, PROT: 'Trazas', GLU_O: 'Negativo', LEU_O: 25 },
          { tomado: c, validado: { por: mendez, fecha: fecha('2026-07-14T10:00:00') } }),
        examen('UROCULT', {
          RESULT: 'Positivo', MICRO: 'Escherichia coli', RECUENTO: '>100,000 UFC/mL',
          ANTIBIO: 'Sensible: nitrofurantoína, fosfomicina. Resistente: ampicilina, TMP-SMX',
        }, { tomado: c, validado: { por: mendez, fecha: fecha('2026-07-17T12:00:00') } }),
      ],
    });
  })(),
  // Orden en proceso: hematología con resultados parciales, glucosa pendiente.
  (() => {
    const c = fecha('2026-10-30T07:30:00');
    return orden({
      anio: 2026, paciente: roberto, cuando: c, estado: 'en_proceso', por: lopez, ref: pineda,
      motivo: 'Fatiga y palidez',
      diagnosticos: [
        diagnostico('D64.9', 'Anemia no especificada', c),
        diagnostico('E11.9', 'Diabetes mellitus tipo 2 sin complicaciones', c, 'secundario'),
      ],
      medicacion: [med('Metformina', '1 tableta', 'cada 12 horas'), med('Ácido acetilsalicílico', '1 tableta', 'cada 24 horas')],
      examenes: [
        examen('HEMA', { HB: 10.8, HTO: 33, LEU: 7.2 }, { tomado: c }),
        examen('GLU'),
      ],
    });
  })(),
  // Orden pendiente de un niño referido desde el pediátrico.
  (() => {
    const c = fecha('2026-10-28T09:05:00');
    return orden({
      anio: 2026, paciente: pedro, cuando: c, estado: 'pendiente', por: mendez, ref: morales,
      motivo: 'Control por palidez',
      diagnosticos: [diagnostico('R23.1', 'Palidez', c)],
      examenes: [examen('HEMA')],
    });
  })(),
];

// Lucía: historial archivado (se trasladó); su orden pendiente quedó anulada.
const ordenLucia = (() => {
  const c = fecha('2024-03-11T10:25:00');
  correlativo = 0;
  return orden({
    anio: 2024, paciente: lucia, cuando: c, estado: 'anulada', por: lopez, ref: pineda,
    motivo: 'Chequeo general',
    diagnosticos: [diagnostico('Z00.0', 'Examen médico general', c)],
    examenes: [examen('HEMA'), examen('CREA')],
  });
})();
lucia.estado = {
  activo: false, fecha_registro: lucia.estado.fecha_registro, fecha_baja: fecha('2024-06-02T15:00:00'),
  motivo_baja: 'traslado', detalle_baja: 'Continúa sus controles en un laboratorio de Escuintla.',
};

export const SEMILLA = {
  tipos_examen: TIPOS,
  medicamentos: MEDICAMENTOS,
  medicos_referentes: REFERENTES,
  usuarios: USUARIOS,
  pacientes: [roberto, ana, pedro, lucia],
  ordenes: [...ordenes2025, ...ordenes2026, ordenLucia],
  contadores: [
    { _id: 'ordenes-2024', valor: 1 },
    { _id: 'ordenes-2025', valor: ordenes2025.length },
    { _id: 'ordenes-2026', valor: ordenes2026.length },
  ],
};
