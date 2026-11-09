import { Router } from 'express';
import * as casos from '../../../aplicacion/casos-uso.js';
import * as hospital from '../../../aplicacion/hospital.js';
import * as odontologica from '../../../aplicacion/odontologica.js';
import * as laboratorio from '../../../aplicacion/laboratorio.js';
import * as pediatrico from '../../../aplicacion/pediatrico.js';
import { iniciarSesion } from '../../../aplicacion/autenticacion.js';
import { INSTITUCIONES } from '../../../config/instituciones.js';
import { repositoriosDe } from '../../../contenedor.js';
import { firmarToken, requiereSesion } from './sesion.js';

// Adaptador de entrada HTTP: solo traduce peticiones a llamadas de casos de uso.
export const rutas = Router();

rutas.get('/salud', (_req, res) => res.json({ ok: true }));

rutas.get('/instituciones', (_req, res) => {
  res.json(Object.values(INSTITUCIONES).map(({ clave, nombre, dominio, motor }) => ({ clave, nombre, dominio, motor })));
});

rutas.post('/auth/login', async (req, res) => {
  res.json(await iniciarSesion(req.body, repositoriosDe, firmarToken));
});

// --------------------------------------------- todo lo de abajo requiere sesión
rutas.use(requiereSesion);

rutas.get('/auth/yo', (req, res) => res.json(req.contexto.usuario));
rutas.get('/auth/perfil', async (req, res) => {
  res.json(await casos.obtenerPerfil(req.contexto));
});
rutas.post('/auth/password', async (req, res) => {
  await casos.cambiarMiPassword(req.contexto, req.body);
  res.status(204).end();
});

rutas.get('/agenda', async (req, res) => {
  res.json(await casos.citasDelDia(req.contexto, req.query.fecha, req.query.medicoId));
});
rutas.get('/pacientes/:id/citas', async (req, res) => {
  res.json(await casos.citasDelPaciente(req.contexto, req.params.id));
});
rutas.post('/pacientes/:id/citas', async (req, res) => {
  res.status(201).json(await casos.agendarCita(req.contexto, req.params.id, req.body));
});
rutas.patch('/citas/:id', async (req, res) => {
  res.json(await casos.reprogramarCita(req.contexto, req.params.id, req.body));
});
rutas.post('/citas/:id/estado', async (req, res) => {
  res.json(await casos.marcarEstadoCita(req.contexto, req.params.id, req.body));
});
rutas.post('/citas/:id/cancelacion', async (req, res) => {
  res.json(await casos.cancelarCita(req.contexto, req.params.id));
});

rutas.get('/pacientes', async (req, res) => {
  res.json(await casos.buscarPacientes(req.contexto, {
    texto: req.query.q,
    incluirArchivados: req.query.archivados === 'true',
  }));
});
rutas.post('/pacientes', async (req, res) => {
  res.status(201).json(await casos.registrarPaciente(req.contexto, req.body));
});
rutas.get('/pacientes/:id', async (req, res) => {
  res.json(await casos.obtenerPaciente(req.contexto, req.params.id));
});
rutas.patch('/pacientes/:id/contacto', async (req, res) => {
  res.json(await casos.actualizarContacto(req.contexto, req.params.id, req.body));
});
rutas.patch('/pacientes/:id/datos-clinicos', async (req, res) => {
  res.json(await casos.actualizarDatosClinicos(req.contexto, req.params.id, req.body));
});
rutas.post('/pacientes/:id/baja', async (req, res) => {
  res.json(await casos.darDeBaja(req.contexto, req.params.id, req.body));
});

rutas.get('/pacientes/:id/historial', async (req, res) => {
  res.json(await casos.obtenerHistorial(req.contexto, req.params.id));
});
rutas.post('/pacientes/:id/antecedentes', async (req, res) => {
  res.status(201).json(await casos.agregarAntecedente(req.contexto, req.params.id, req.body));
});
rutas.post('/pacientes/:id/consultas', async (req, res) => {
  res.status(201).json(await casos.registrarConsulta(req.contexto, req.params.id, req.body));
});
rutas.post('/consultas/:id/diagnosticos', async (req, res) => {
  res.status(201).json(await casos.agregarDiagnostico(req.contexto, req.params.id, req.body));
});
rutas.post('/consultas/:id/recetas', async (req, res) => {
  res.status(201).json(await casos.recetar(req.contexto, req.params.id, req.body));
});

rutas.get('/catalogos/medicos', async (req, res) => {
  res.json(await casos.listarMedicos(req.contexto));
});

// Personal médico (solo admin).
rutas.get('/personal/medicos', async (req, res) => {
  res.json(await casos.listarPersonal(req.contexto));
});
rutas.post('/personal/medicos', async (req, res) => {
  res.status(201).json(await casos.registrarMedico(req.contexto, req.body));
});
rutas.patch('/personal/medicos/:id', async (req, res) => {
  res.json(await casos.actualizarMedico(req.contexto, req.params.id, req.body));
});
rutas.post('/personal/medicos/:id/cuenta', async (req, res) => {
  res.status(201).json(await casos.crearCuentaMedico(req.contexto, req.params.id, req.body));
});
rutas.post('/personal/medicos/:id/password', async (req, res) => {
  await casos.restablecerPasswordMedico(req.contexto, req.params.id, req.body);
  res.status(204).end();
});
rutas.post('/personal/medicos/:id/estado', async (req, res) => {
  res.json(await casos.cambiarEstadoMedico(req.contexto, req.params.id, req.body));
});
// Recepcionistas (solo admin).
rutas.get('/personal/recepcionistas', async (req, res) => {
  res.json(await casos.listarRecepcionistas(req.contexto));
});
rutas.post('/personal/recepcionistas', async (req, res) => {
  res.status(201).json(await casos.registrarRecepcionista(req.contexto, req.body));
});
rutas.patch('/personal/recepcionistas/:id', async (req, res) => {
  res.json(await casos.actualizarRecepcionista(req.contexto, req.params.id, req.body));
});
rutas.post('/personal/recepcionistas/:id/password', async (req, res) => {
  await casos.restablecerPasswordRecepcionista(req.contexto, req.params.id, req.body);
  res.status(204).end();
});
rutas.post('/personal/recepcionistas/:id/estado', async (req, res) => {
  res.json(await casos.cambiarEstadoRecepcionista(req.contexto, req.params.id, req.body));
});
// Catálogos que mantiene el admin (habitaciones, procedimientos, servicios...).
rutas.get('/admin/catalogos', async (req, res) => {
  res.json(await casos.listarCatalogosAdmin(req.contexto));
});
rutas.get('/admin/catalogos/:clave', async (req, res) => {
  res.json(await casos.listarRegistrosCatalogo(req.contexto, req.params.clave));
});
rutas.post('/admin/catalogos/:clave', async (req, res) => {
  res.status(201).json(await casos.crearRegistroCatalogo(req.contexto, req.params.clave, req.body));
});
rutas.patch('/admin/catalogos/:clave/:id', async (req, res) => {
  res.json(await casos.actualizarRegistroCatalogo(req.contexto, req.params.clave, req.params.id, req.body));
});
rutas.post('/admin/catalogos/:clave/:id/estado', async (req, res) => {
  res.json(await casos.cambiarEstadoRegistroCatalogo(req.contexto, req.params.clave, req.params.id, req.body));
});
rutas.get('/catalogos/medicamentos', async (req, res) => {
  res.json(await casos.listarMedicamentos(req.contexto));
});

// ---------------------------------------- exclusivas de la clínica odontológica
rutas.get('/odontologica/procedimientos', async (req, res) => {
  res.json(await odontologica.listarProcedimientos(req.contexto));
});
rutas.post('/consultas/:id/pagos', async (req, res) => {
  res.status(201).json(await odontologica.registrarPago(req.contexto, req.params.id, req.body));
});

// ------------------------------------------------ exclusivas del hospital general
rutas.get('/hospital/habitaciones', async (req, res) => {
  res.json(await hospital.habitacionesDisponibles(req.contexto));
});
rutas.post('/pacientes/:id/internamientos', async (req, res) => {
  res.status(201).json(await hospital.internar(req.contexto, req.params.id, req.body));
});
rutas.post('/internamientos/:id/cambio-medico', async (req, res) => {
  res.json(await hospital.cambiarMedicoACargo(req.contexto, req.params.id, req.body));
});
rutas.post('/internamientos/:id/tratamientos', async (req, res) => {
  res.status(201).json(await hospital.agregarTratamientoInternamiento(req.contexto, req.params.id, req.body));
});
rutas.post('/internamientos/:id/alta', async (req, res) => {
  res.json(await hospital.darDeAlta(req.contexto, req.params.id, req.body));
});
rutas.post('/pacientes/:id/facturas', async (req, res) => {
  res.status(201).json(await hospital.crearFactura(req.contexto, req.params.id, req.body));
});
rutas.post('/facturas/:id/pagos', async (req, res) => {
  res.status(201).json(await hospital.registrarPagoFactura(req.contexto, req.params.id, req.body));
});
rutas.post('/facturas/:id/anulacion', async (req, res) => {
  res.json(await hospital.anularFactura(req.contexto, req.params.id));
});

// ------------------------------------------- exclusivas del laboratorio clínico
// En el laboratorio, la "consulta" es una orden de examen: :id es el de la orden.
rutas.get('/laboratorio/tipos-examen', async (req, res) => {
  res.json(await laboratorio.listarTiposExamen(req.contexto));
});
rutas.post('/laboratorio/medicos-referentes', async (req, res) => {
  res.status(201).json(await laboratorio.registrarMedicoReferente(req.contexto, req.body));
});
rutas.post('/laboratorio/ordenes/:id/examenes', async (req, res) => {
  res.json(await laboratorio.agregarExamenes(req.contexto, req.params.id, req.body));
});
rutas.post('/laboratorio/ordenes/:id/examenes/:codigo/resultados', async (req, res) => {
  res.json(await laboratorio.registrarResultados(req.contexto, req.params.id, req.params.codigo, req.body));
});
rutas.post('/laboratorio/ordenes/:id/examenes/:codigo/validacion', async (req, res) => {
  res.json(await laboratorio.validarExamen(req.contexto, req.params.id, req.params.codigo));
});
rutas.patch('/laboratorio/ordenes/:id/estado', async (req, res) => {
  res.json(await laboratorio.cambiarEstadoOrden(req.contexto, req.params.id, req.body));
});

// ---------------------------------------- exclusivas del centro médico pediátrico
rutas.post('/pacientes/:id/vacunas', async (req, res) => {
  res.status(201).json(await pediatrico.aplicarVacuna(req.contexto, req.params.id, req.body));
});
rutas.get('/pediatrico/servicios', async (req, res) => {
  res.json(await pediatrico.listarServicios(req.contexto));
});
rutas.post('/consultas/:id/cobro', async (req, res) => {
  res.status(201).json(await pediatrico.generarCobro(req.contexto, req.params.id, req.body));
});
rutas.post('/cobros/:id/pagos', async (req, res) => {
  res.status(201).json(await pediatrico.registrarPago(req.contexto, req.params.id, req.body));
});
rutas.post('/pediatrico/encargados/busqueda', async (req, res) => {
  res.json(await pediatrico.buscarEncargado(req.contexto, req.body));
});
