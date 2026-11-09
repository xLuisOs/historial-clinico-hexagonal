// =====================================================================
// PUERTOS DE SALIDA
//
// Contrato que TODO adaptador de base de datos debe cumplir. Los casos de uso
// solo conocen estos métodos; no saben si detrás hay PostgreSQL, MySQL,
// MongoDB o Firebase. Cada motor implementa los cuatro repositorios en su
// carpeta adaptadores/salida/<motor>/ y los devuelve desde su index.js.
//
// Reglas comunes para los adaptadores:
//   * Los ids viajan siempre como string (ObjectId, int, docId... da igual).
//   * Reciben y devuelven los objetos del dominio (ver dominio/paciente.js
//     y dominio/atencion.js), nunca filas o documentos crudos.
//   * Las operaciones que tocan varias tablas/colecciones son atómicas
//     (transacción del motor).
//   * Lanzan errores de dominio/errores.js (NoEncontrado, Conflicto...),
//     nunca errores propios del driver.
// =====================================================================

export const PUERTOS = {
  usuarios: {
    // → { id, correo, passwordHash, nombre, rol, medicoId, activo } | null
    buscarPorCorreo: '(correo)',
    // Guarda la fecha del último inicio de sesión.
    registrarAcceso: '(usuarioId)',
  },

  pacientes: {
    // → Paciente. Crea también al responsable si viene nuevo.
    registrar: '(paciente)',
    // → Paciente[] (resumen). Busca por nombre, apellido o documento.
    buscar: '({ texto, incluirArchivados })',
    // → Paciente | lanza NoEncontrado
    obtenerPorId: '(pacienteId)',
    // → Paciente
    actualizarContacto: '(pacienteId, contacto)',
    // → Paciente. Archiva el historial (nunca lo borra).
    darDeBaja: '(pacienteId, { motivo, detalle })',
  },

  atenciones: {
    // → Consulta. Consulta + diagnósticos + receta en UNA transacción.
    registrarConsulta: '(pacienteId, consulta)',
    // → Consulta
    agregarDiagnostico: '(consultaId, diagnostico)',
    // → Consulta. Crea la receta si no existe y le agrega los medicamentos.
    recetar: '(consultaId, receta)',
    // → { paciente, consultas: Consulta[], extras: {...propio de la institución},
    //     antecedentes?: Antecedente[] (solo si el adaptador trae el puerto antecedentes) }
    obtenerHistorial: '(pacienteId)',
  },

  catalogos: {
    // → [{ id, nombre, especialidad }]
    listarMedicos: '()',
    // → [{ id, nombre, presentacion }]
    listarMedicamentos: '()',
  },
};

// Puertos opcionales que un adaptador puede traer o no (los casos de uso
// responden "no disponible" si falta):
//   agenda:       citas (ver aplicacion/casos-uso.js)
//   antecedentes: { agregar(pacienteId, antecedente, usuario) → Antecedente[] }
//                 antecedentes médicos (ver dominio/antecedente.js)
//   personal:     médicos administrados por el admin (ver dominio/medico.js).
//                 Medico = { id, nombre, nombres, apellidos, numeroColegiado,
//                            especialidad, telefono, correo, activo }
//     listarPersonal()                      → Medico[] (activos e inactivos)
//     registrarMedico({ nombres, apellidos, numeroColegiado, especialidad,
//                       telefono, correo, passwordHash })  → Medico
//         médico + usuario en una sola operación atómica; colegiado o correo
//         repetidos → Conflicto
//     actualizarMedico(id, cambios)         → Medico
//     crearCuentaMedico(id, { correo, passwordHash }) → Medico
//         usuario para un médico activo que no tenía; correo repetido o
//         médico con cuenta → Conflicto
//     restablecerPassword(id, passwordHash)
//     cambiarEstadoMedico(id, activo)       → Medico
//         desactivar cambia médico y usuario a la vez, y falla con Conflicto
//         (detalles: { citas, internamientos }) si tiene citas pendientes a
//         futuro o pacientes internados a su cargo
//     Recepcionista = { id, nombre, nombres, apellidos, telefono, correo, activo }
//     listarRecepcionistas()                → Recepcionista[] (activas e inactivas)
//     registrarRecepcionista({ nombres, apellidos, telefono, correo,
//                              passwordHash })  → Recepcionista (con su usuario)
//     actualizarRecepcionista(id, cambios)  → Recepcionista
//     restablecerPasswordRecepcionista(id, passwordHash)
//     cambiarEstadoRecepcionista(id, activo) → Recepcionista (y su usuario)
//     Cada método es opcional: el laboratorio trae listar, actualizar y
//     cambiar estado de sus médicos referentes, que no inician sesión.
//   usuarios.estaActivo(usuarioId) → boolean (opcional): con él, una sesión
//     abierta deja de servir en cuanto el usuario se desactiva.

// Puerto adicional, solo para el adaptador del Laboratorio Clínico (sea cual
// sea su motor). Si un adaptador trae `laboratorio`, debe implementarlo completo.
export const PUERTO_LABORATORIO = {
  laboratorio: {
    // → [{ id, codigo, nombre, categoria, muestra, parametros: [...] }]
    listarTiposExamen: '()',
    // → Consulta (orden). Guarda valores y marca los que están fuera de rango.
    registrarResultados: '(ordenId, codigoExamen, resultados, usuario)',
    // → Consulta (orden). Exige todos los parámetros con valor.
    validarExamen: '(ordenId, codigoExamen, usuario)',
    // → Consulta (orden)
    cambiarEstadoOrden: '(ordenId, estado)',
    // → { id, nombre, numeroColegiado, especialidad, institucionProcedencia }
    registrarMedicoReferente: '(medico)',
    // → Consulta (orden). No repite exámenes ni toca órdenes cerradas.
    agregarExamenes: '(ordenId, idsTiposExamen)',
  },
};

/** Revisa al arrancar que un adaptador implemente todo el contrato. */
export function verificarAdaptador(nombre, repositorios) {
  const faltantes = [];
  const contrato = repositorios?.laboratorio ? { ...PUERTOS, ...PUERTO_LABORATORIO } : PUERTOS;
  for (const [repo, metodos] of Object.entries(contrato)) {
    for (const metodo of Object.keys(metodos)) {
      if (typeof repositorios?.[repo]?.[metodo] !== 'function') faltantes.push(`${repo}.${metodo}`);
    }
  }
  if (faltantes.length > 0) {
    throw new Error(`El adaptador "${nombre}" no implementa: ${faltantes.join(', ')}`);
  }
  return repositorios;
}
