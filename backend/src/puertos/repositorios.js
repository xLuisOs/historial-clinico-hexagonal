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
    // → { paciente, consultas: Consulta[], extras: {...propio de la institución} }
    obtenerHistorial: '(pacienteId)',
  },

  catalogos: {
    // → [{ id, nombre, especialidad }]
    listarMedicos: '()',
    // → [{ id, nombre, presentacion }]
    listarMedicamentos: '()',
  },
};

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
