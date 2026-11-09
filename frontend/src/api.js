// Cliente de la API. El frontend no sabe qué motor de base de datos hay detrás:
// siempre habla con las mismas rutas y el backend decide según el token.

const CLAVE_SESION = 'historial-clinico:sesion';

export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles ?? {};
  }
}

export function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION));
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    // Sin almacenamiento (modo privado): la sesión dura mientras la pestaña esté abierta.
  }
}

async function pedir(metodo, ruta, cuerpo) {
  const token = leerSesion()?.token;
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor');
  }

  const datos = await respuesta.json().catch(() => null);
  if (respuesta.status === 401 && ruta !== '/auth/login') {
    window.dispatchEvent(new Event('sesion-vencida'));
  }
  if (!respuesta.ok) {
    // Sin JSON, la respuesta no vino del backend sino del proxy de Vite: el
    // backend está apagado o se reinició a mitad de la petición.
    const mensaje = datos?.error
      ?? (respuesta.status >= 500 ? 'No se pudo conectar con el servidor. Revisa que el backend esté corriendo e intenta de nuevo.' : 'Error inesperado');
    throw new ErrorApi(respuesta.status, mensaje, datos?.detalles);
  }
  return datos;
}

const q = (texto) => encodeURIComponent(texto);

export const api = {
  instituciones: () => pedir('GET', '/instituciones'),
  login: (correo, password) => pedir('POST', '/auth/login', { correo, password }),
  perfil: () => pedir('GET', '/auth/perfil'),
  cambiarMiPassword: (datos) => pedir('POST', '/auth/password', datos),

  buscarPacientes: (texto, archivados) =>
    pedir('GET', `/pacientes?q=${q(texto)}${archivados ? '&archivados=true' : ''}`),
  registrarPaciente: (datos) => pedir('POST', '/pacientes', datos),
  historial: (id) => pedir('GET', `/pacientes/${q(id)}/historial`),
  actualizarContacto: (id, datos) => pedir('PATCH', `/pacientes/${q(id)}/contacto`, datos),
  actualizarDatosPersonales: (id, datos) => pedir('PATCH', `/pacientes/${q(id)}/datos-personales`, datos),
  actualizarDatosClinicos: (id, datos) => pedir('PATCH', `/pacientes/${q(id)}/datos-clinicos`, datos),
  darDeBaja: (id, datos) => pedir('POST', `/pacientes/${q(id)}/baja`, datos),

  agregarAntecedente: (pacienteId, datos) => pedir('POST', `/pacientes/${q(pacienteId)}/antecedentes`, datos),
  registrarConsulta: (pacienteId, datos) => pedir('POST', `/pacientes/${q(pacienteId)}/consultas`, datos),
  agregarDiagnostico: (consultaId, datos) => pedir('POST', `/consultas/${q(consultaId)}/diagnosticos`, datos),
  recetar: (consultaId, datos) => pedir('POST', `/consultas/${q(consultaId)}/recetas`, datos),

  agenda: (fecha, medicoId) => pedir('GET', `/agenda?fecha=${q(fecha)}${medicoId ? `&medicoId=${q(medicoId)}` : ''}`),
  marcarEstadoCita: (citaId, estado) => pedir('POST', `/citas/${q(citaId)}/estado`, { estado }),
  citasDelPaciente: (pacienteId) => pedir('GET', `/pacientes/${q(pacienteId)}/citas`),
  agendarCita: (pacienteId, datos) => pedir('POST', `/pacientes/${q(pacienteId)}/citas`, datos),
  reprogramarCita: (citaId, datos) => pedir('PATCH', `/citas/${q(citaId)}`, datos),
  cancelarCita: (citaId) => pedir('POST', `/citas/${q(citaId)}/cancelacion`),

  medicos: () => pedir('GET', '/catalogos/medicos'),
  personal: () => pedir('GET', '/personal/medicos'),
  registrarMedico: (datos) => pedir('POST', '/personal/medicos', datos),
  actualizarMedico: (id, datos) => pedir('PATCH', `/personal/medicos/${q(id)}`, datos),
  crearCuentaMedico: (id, datos) => pedir('POST', `/personal/medicos/${q(id)}/cuenta`, datos),
  recepcionistas: () => pedir('GET', '/personal/recepcionistas'),
  registrarRecepcionista: (datos) => pedir('POST', '/personal/recepcionistas', datos),
  actualizarRecepcionista: (id, datos) => pedir('PATCH', `/personal/recepcionistas/${q(id)}`, datos),
  restablecerPasswordRecepcionista: (id, datos) => pedir('POST', `/personal/recepcionistas/${q(id)}/password`, datos),
  cambiarEstadoRecepcionista: (id, datos) => pedir('POST', `/personal/recepcionistas/${q(id)}/estado`, datos),
  restablecerPasswordMedico: (id, datos) => pedir('POST', `/personal/medicos/${q(id)}/password`, datos),
  cambiarEstadoMedico: (id, datos) => pedir('POST', `/personal/medicos/${q(id)}/estado`, datos),
  medicamentos: () => pedir('GET', '/catalogos/medicamentos'),
  especialidades: () => pedir('GET', '/catalogos/especialidades'),
  reporte: (desde, hasta) => pedir('GET', `/admin/reportes?desde=${q(desde)}&hasta=${q(hasta)}`),
  catalogosAdmin: () => pedir('GET', '/admin/catalogos'),
  registrosCatalogo: (clave) => pedir('GET', `/admin/catalogos/${q(clave)}`),
  crearRegistroCatalogo: (clave, datos) => pedir('POST', `/admin/catalogos/${q(clave)}`, datos),
  actualizarRegistroCatalogo: (clave, id, datos) => pedir('PATCH', `/admin/catalogos/${q(clave)}/${q(id)}`, datos),
  cambiarEstadoRegistroCatalogo: (clave, id, datos) => pedir('POST', `/admin/catalogos/${q(clave)}/${q(id)}/estado`, datos),
  procedimientosOdontologicos: () => pedir('GET', '/odontologica/procedimientos'),
  registrarPago: (consultaId, datos) => pedir('POST', `/consultas/${q(consultaId)}/pagos`, datos),

  habitacionesDisponibles: () => pedir('GET', '/hospital/habitaciones'),
  internar: (pacienteId, datos) => pedir('POST', `/pacientes/${q(pacienteId)}/internamientos`, datos),
  cambiarMedicoACargo: (id, datos) => pedir('POST', `/internamientos/${q(id)}/cambio-medico`, datos),
  tratamientoInternamiento: (id, datos) => pedir('POST', `/internamientos/${q(id)}/tratamientos`, datos),
  darDeAlta: (id, datos) => pedir('POST', `/internamientos/${q(id)}/alta`, datos),
  crearFactura: (pacienteId, datos) => pedir('POST', `/pacientes/${q(pacienteId)}/facturas`, datos),
  pagarFactura: (id, datos) => pedir('POST', `/facturas/${q(id)}/pagos`, datos),
  anularFactura: (id) => pedir('POST', `/facturas/${q(id)}/anulacion`),

  aplicarVacuna: (pacienteId, datos) => pedir('POST', `/pacientes/${q(pacienteId)}/vacunas`, datos),
  tiposExamen: () => pedir('GET', '/laboratorio/tipos-examen'),
  registrarResultados: (ordenId, codigo, datos) => pedir('POST', `/laboratorio/ordenes/${q(ordenId)}/examenes/${q(codigo)}/resultados`, datos),
  validarExamen: (ordenId, codigo) => pedir('POST', `/laboratorio/ordenes/${q(ordenId)}/examenes/${q(codigo)}/validacion`),
  cambiarEstadoOrden: (ordenId, estado) => pedir('PATCH', `/laboratorio/ordenes/${q(ordenId)}/estado`, { estado }),
  agregarExamenes: (ordenId, datos) => pedir('POST', `/laboratorio/ordenes/${q(ordenId)}/examenes`, datos),
  registrarMedicoReferente: (datos) => pedir('POST', '/laboratorio/medicos-referentes', datos),

  serviciosPediatrico: () => pedir('GET', '/pediatrico/servicios'),
  buscarEncargado: (dpi) => pedir('POST', '/pediatrico/encargados/busqueda', { dpi }),
  generarCobro: (consultaId, datos) => pedir('POST', `/consultas/${q(consultaId)}/cobro`, datos),
  pagarCobro: (cobroId, datos) => pedir('POST', `/cobros/${q(cobroId)}/pagos`, datos),
};
