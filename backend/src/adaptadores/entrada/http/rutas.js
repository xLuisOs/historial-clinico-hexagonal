import { Router } from 'express';
import * as casos from '../../../aplicacion/casos-uso.js';
import * as hospital from '../../../aplicacion/hospital.js';
import * as odontologica from '../../../aplicacion/odontologica.js';
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

rutas.get('/agenda', async (req, res) => {
  res.json(await casos.citasDelDia(req.contexto, req.query.fecha));
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
rutas.post('/pacientes/:id/baja', async (req, res) => {
  res.json(await casos.darDeBaja(req.contexto, req.params.id, req.body));
});

rutas.get('/pacientes/:id/historial', async (req, res) => {
  res.json(await casos.obtenerHistorial(req.contexto, req.params.id));
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
