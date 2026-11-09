// =====================================================================
// Laboratorio Clínico — MongoDB
// Modelo documental: colecciones, validadores ($jsonSchema) e índices.
//
// Decisiones de embeber / referenciar:
//   * pacientes      contacto, responsable y estado de baja van EMBEBIDOS: son
//                    pocos datos, pertenecen solo a ese paciente y se leen juntos.
//                    Los antecedentes médicos también van EMBEBIDOS (arreglo
//                    `antecedentes`): son pocos, solo los tiene ese paciente y
//                    se muestran siempre con él. El arreglo tiene tope
//                    (MAX_ANTECEDENTES) para que el documento no crezca sin
//                    límite; quien los registró va como referencia extendida.
//   * ordenes        REFERENCIAN al paciente (paciente_id): un paciente acumula
//                    cientos de órdenes en su vida; embeberlas haría crecer el
//                    documento del paciente sin límite (tope de 16 MB).
//                    Los exámenes y sus resultados van EMBEBIDOS en la orden:
//                    una orden tiene pocos exámenes, nunca crece sin límite y
//                    siempre se consulta completa.
//                    El médico referente se guarda como REFERENCIA EXTENDIDA
//                    (id + nombre + colegiado): la orden debe mostrar quién la
//                    pidió aunque el catálogo cambie después.
//                    Los parámetros y rangos de referencia se COPIAN del
//                    catálogo al crear la orden: un resultado se interpreta con
//                    el rango vigente el día del examen.
//   * tipos_examen   cada tipo EMBEBE su lista de parámetros (pocos, fijos).
//                    La estructura cambia por examen (hematología numérica,
//                    orina mixta, cultivo de texto): por eso cada parámetro
//                    declara su tipo_valor.
//
// MongoDB no tiene CHECK ni llaves foráneas: los validadores de abajo hacen el
// papel de los CHECK, los índices únicos el de UNIQUE, y la existencia de las
// referencias se verifica en el adaptador dentro de transacciones.
// =====================================================================

import { MAX_ANTECEDENTES, TIPOS_ANTECEDENTE } from '../../src/dominio/antecedente.js';

const texto = (maxLength = 200) => ({ bsonType: 'string', maxLength });
const textoONulo = (maxLength = 200) => ({ bsonType: ['string', 'null'], maxLength });
const fechaONula = { bsonType: ['date', 'null'] };
const persona = {
  bsonType: 'object',
  required: ['id', 'nombre'],
  properties: { id: { bsonType: 'objectId' }, nombre: texto(200) },
};

export const MOTIVOS_BAJA = ['traslado', 'fallecimiento', 'mayoria_edad', 'administrativo', 'otro'];
export const ESTADOS_ORDEN = ['pendiente', 'en_proceso', 'completada', 'anulada'];
export const ESTADOS_EXAMEN = ['pendiente', 'en_proceso', 'resultados_completos', 'validado'];
export const TIPOS_VALOR = ['numerico', 'texto', 'opcion'];
export const ROLES_LAB = ['quimico_biologo', 'recepcion', 'admin'];

export const COLECCIONES = {
  usuarios: {
    validador: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['correo', 'password_hash', 'nombres', 'apellidos', 'rol', 'activo'],
        properties: {
          correo: { bsonType: 'string', pattern: '^[^@\\s]+@lab\\.gt$' },
          password_hash: { bsonType: 'string', minLength: 60, maxLength: 60 },
          nombres: texto(100),
          apellidos: texto(100),
          rol: { enum: ROLES_LAB },
          numero_colegiado: textoONulo(10),
          telefono: textoONulo(20),
          activo: { bsonType: 'bool' },
          ultimo_acceso: fechaONula,
        },
      },
    },
    indices: [{ llave: { correo: 1 }, opciones: { unique: true } }],
  },

  pacientes: {
    validador: {
      $and: [
        {
          $jsonSchema: {
            bsonType: 'object',
            required: ['nombres', 'apellidos', 'nombre_busqueda', 'fecha_nacimiento', 'sexo', 'contacto', 'estado'],
            properties: {
              nombres: texto(100),
              apellidos: texto(100),
              nombre_busqueda: texto(250),
              fecha_nacimiento: { bsonType: 'date' },
              sexo: { enum: ['M', 'F'] },
              documento: { bsonType: ['string', 'null'], pattern: '^[0-9]{13}$' },
              contacto: {
                bsonType: 'object',
                properties: {
                  telefono: textoONulo(20),
                  direccion: textoONulo(200),
                  correo: textoONulo(120),
                },
              },
              responsable: {
                bsonType: ['object', 'null'],
                required: ['nombres', 'apellidos', 'parentesco', 'telefono'],
                properties: {
                  nombres: texto(100),
                  apellidos: texto(100),
                  parentesco: texto(20),
                  documento: { bsonType: ['string', 'null'], pattern: '^[0-9]{13}$' },
                  telefono: texto(20),
                },
              },
              datos_clinicos: {
                bsonType: 'object',
                properties: { tipo_sangre: textoONulo(3), alergias: textoONulo(500) },
              },
              antecedentes: {
                bsonType: 'array',
                maxItems: MAX_ANTECEDENTES,
                items: {
                  bsonType: 'object',
                  required: ['_id', 'tipo', 'descripcion', 'anio_inicio', 'registrado_por', 'fecha_registro'],
                  additionalProperties: false,
                  properties: {
                    _id: { bsonType: 'objectId' },
                    tipo: { enum: TIPOS_ANTECEDENTE },
                    descripcion: texto(300),
                    anio_inicio: { bsonType: ['int', 'null'], minimum: 1900, maximum: 2100 },
                    // Referencia extendida al químico biólogo que lo registró.
                    registrado_por: {
                      bsonType: 'object',
                      required: ['id', 'nombre'],
                      properties: { id: { bsonType: 'objectId' }, nombre: texto(220) },
                    },
                    fecha_registro: { bsonType: 'date' },
                  },
                },
              },
              estado: {
                bsonType: 'object',
                required: ['activo', 'fecha_registro'],
                properties: {
                  activo: { bsonType: 'bool' },
                  fecha_registro: { bsonType: 'date' },
                  fecha_baja: fechaONula,
                  motivo_baja: { enum: [...MOTIVOS_BAJA, null] },
                  detalle_baja: textoONulo(300),
                },
              },
            },
          },
        },
        // Equivalente al CHECK chk_paciente_baja de MySQL.
        {
          $or: [
            { 'estado.activo': true, 'estado.fecha_baja': null, 'estado.motivo_baja': null },
            { 'estado.activo': false, 'estado.fecha_baja': { $type: 'date' }, 'estado.motivo_baja': { $in: MOTIVOS_BAJA } },
          ],
        },
      ],
    },
    indices: [
      // Único solo si existe: varios pacientes pueden no tener documento.
      { llave: { documento: 1 }, opciones: { unique: true, partialFilterExpression: { documento: { $type: 'string' } } } },
      { llave: { nombre_busqueda: 1 } },
      { llave: { 'estado.activo': 1, apellidos: 1 } },
    ],
  },

  medicos_referentes: {
    validador: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['nombres', 'apellidos', 'numero_colegiado', 'activo'],
        properties: {
          nombres: texto(100),
          apellidos: texto(100),
          numero_colegiado: texto(10),
          especialidad: textoONulo(80),
          telefono: textoONulo(20),
          institucion_procedencia: textoONulo(150),
          activo: { bsonType: 'bool' },
        },
      },
    },
    indices: [{ llave: { numero_colegiado: 1 }, opciones: { unique: true } }],
  },

  // Catálogo de especialidades. Los médicos referentes guardan una copia del
  // nombre (como en la Entrega I); renombrar aquí la corrige en todos ellos.
  // El índice único usa collation es con fuerza 1: ignora mayúsculas y
  // tildes, así que "Cardiologia" y "Cardiología" chocan.
  especialidades: {
    validador: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['nombre'],
        properties: { nombre: texto(80) },
      },
    },
    indices: [{ llave: { nombre: 1 }, opciones: { unique: true, collation: { locale: 'es', strength: 1 } } }],
  },

  tipos_examen: {
    validador: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['codigo', 'nombre', 'categoria', 'muestra', 'parametros', 'activo'],
        properties: {
          codigo: { bsonType: 'string', pattern: '^[A-Z0-9_]{2,15}$' },
          nombre: texto(100),
          categoria: texto(50),
          muestra: texto(50),
          descripcion: textoONulo(300),
          precio: { bsonType: ['double', 'int', 'decimal'], minimum: 0 },
          activo: { bsonType: 'bool' },
          parametros: {
            bsonType: 'array',
            minItems: 1,
            items: {
              bsonType: 'object',
              required: ['codigo', 'nombre', 'tipo_valor'],
              properties: {
                codigo: { bsonType: 'string', pattern: '^[A-Z0-9_]{1,20}$' },
                nombre: texto(100),
                tipo_valor: { enum: TIPOS_VALOR },
                unidad: textoONulo(30),
                ref_min: { bsonType: ['double', 'int', 'null'] },
                ref_max: { bsonType: ['double', 'int', 'null'] },
                opciones: { bsonType: 'array', items: { bsonType: 'string' } },
                valor_normal: textoONulo(100),
              },
            },
          },
        },
      },
    },
    indices: [{ llave: { codigo: 1 }, opciones: { unique: true } }],
  },

  medicamentos: {
    validador: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['nombre', 'presentacion', 'activo'],
        properties: {
          nombre: texto(100),
          presentacion: texto(100),
          activo: { bsonType: 'bool' },
        },
      },
    },
    indices: [{ llave: { nombre: 1, presentacion: 1 }, opciones: { unique: true } }],
  },

  ordenes: {
    validador: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'numero', 'paciente_id', 'fecha_orden', 'estado', 'registrada_por',
          'medico_referente', 'diagnosticos', 'examenes',
        ],
        properties: {
          numero: { bsonType: 'string', pattern: '^LAB-[0-9]{4}-[0-9]{5}$' },
          paciente_id: { bsonType: 'objectId' },
          fecha_orden: { bsonType: 'date' },
          estado: { enum: ESTADOS_ORDEN },
          motivo: textoONulo(300),
          observaciones: textoONulo(5000),
          registrada_por: persona,
          medico_referente: {
            bsonType: 'object',
            required: ['id', 'nombre', 'numero_colegiado'],
            properties: {
              id: { bsonType: 'objectId' },
              nombre: texto(200),
              numero_colegiado: texto(10),
            },
          },
          diagnosticos: {
            bsonType: 'array',
            minItems: 1,
            items: {
              bsonType: 'object',
              required: ['descripcion', 'tipo'],
              properties: {
                codigo_cie10: { bsonType: ['string', 'null'], pattern: '^[A-Z][0-9]{2}(\\.[0-9A-Z]{1,4})?$' },
                descripcion: texto(300),
                tipo: { enum: ['principal', 'secundario'] },
                fecha_registro: { bsonType: 'date' },
              },
            },
          },
          // Regla "recetar medicamento" en el laboratorio: medicación que el
          // paciente toma y que puede alterar la interpretación de resultados.
          medicacion_actual: {
            bsonType: ['object', 'null'],
            required: ['fecha_registro', 'items'],
            properties: {
              fecha_registro: { bsonType: 'date' },
              indicaciones: textoONulo(500),
              items: {
                bsonType: 'array',
                minItems: 1,
                items: {
                  bsonType: 'object',
                  required: ['medicamento_id', 'medicamento', 'dosis', 'frecuencia', 'duracion_dias', 'via'],
                  properties: {
                    medicamento_id: { bsonType: 'objectId' },
                    medicamento: texto(220),
                    dosis: texto(60),
                    frecuencia: texto(60),
                    duracion_dias: { bsonType: 'int', minimum: 1, maximum: 365 },
                    via: texto(15),
                    indicaciones: textoONulo(300),
                  },
                },
              },
            },
          },
          examenes: {
            bsonType: 'array',
            minItems: 1,
            items: {
              bsonType: 'object',
              required: ['tipo_examen_id', 'codigo', 'nombre', 'estado', 'parametros'],
              properties: {
                tipo_examen_id: { bsonType: 'objectId' },
                codigo: texto(15),
                nombre: texto(100),
                estado: { enum: ESTADOS_EXAMEN },
                fecha_toma_muestra: fechaONula,
                validado_por: { anyOf: [persona, { bsonType: 'null' }] },
                fecha_validacion: fechaONula,
                parametros: {
                  bsonType: 'array',
                  minItems: 1,
                  items: {
                    bsonType: 'object',
                    required: ['codigo', 'nombre', 'tipo_valor'],
                    properties: {
                      codigo: texto(20),
                      nombre: texto(100),
                      tipo_valor: { enum: TIPOS_VALOR },
                      unidad: textoONulo(30),
                      ref_min: { bsonType: ['double', 'int', 'null'] },
                      ref_max: { bsonType: ['double', 'int', 'null'] },
                      opciones: { bsonType: ['array', 'null'], items: { bsonType: 'string' } },
                      valor_normal: textoONulo(100),
                      // El valor cambia de tipo según el examen: número o texto.
                      valor: { bsonType: ['double', 'int', 'string', 'null'] },
                      fuera_de_rango: { bsonType: ['bool', 'null'] },
                      observacion: textoONulo(300),
                      fecha_resultado: fechaONula,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    indices: [
      { llave: { numero: 1 }, opciones: { unique: true } },
      { llave: { paciente_id: 1, fecha_orden: -1 } },
      { llave: { estado: 1, fecha_orden: 1 } },
    ],
  },

  // Correlativo de órdenes por año (LAB-2026-00001). Se incrementa dentro de la
  // misma transacción que crea la orden, así nunca se repite ni se salta.
  contadores: {
    validador: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'valor'],
        properties: { _id: { bsonType: 'string' }, valor: { bsonType: ['int', 'long'], minimum: 0 } },
      },
    },
    indices: [],
  },
};
