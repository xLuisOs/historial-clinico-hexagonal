// Casos de uso con repositorios falsos en memoria: comprueban los permisos por
// rol y que a la base solo llegue lo validado, sin tocar ningún motor. Es lo
// que permite la arquitectura hexagonal: la lógica no sabe qué hay detrás.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import * as casos from '../src/aplicacion/casos-uso.js';
import { Conflicto, DatosInvalidos, NoDisponible, SinPermiso } from '../src/dominio/errores.js';
import { rechaza, rechazaAsync } from './ayuda.js';

const usuario = (rol, institucion = 'pediatrico') => ({ id: 'u1', rol, institucion, medicoId: rol === 'medico' ? 'm1' : null, nombre: 'Prueba' });

/** Repositorios falsos que solo anotan lo que se les pidió. */
function reposFalsos() {
  const llamadas = [];
  const anotar = (nombre, resultado = {}) => (...args) => { llamadas.push([nombre, ...args]); return resultado; };
  return {
    llamadas,
    pacientes: { darDeBaja: anotar('darDeBaja'), actualizarContacto: anotar('actualizarContacto', { id: '1', datosClinicos: {} }) },
    atenciones: {
      registrarConsulta: anotar('registrarConsulta'),
      obtenerHistorial: anotar('obtenerHistorial', { paciente: { datosClinicos: { tipoSangre: 'O+', alergias: null } }, consultas: [], extras: {} }),
    },
    antecedentes: { agregar: anotar('agregarAntecedente', []) },
    catalogos: { listarEspecialidades: async () => ['Pediatría general', 'Cardiología pediátrica'] },
    catalogosAdmin: { especialidades: { crear: anotar('crearEspecialidad', { id: 'e1' }) } },
    personal: { registrarMedico: anotar('registrarMedico', { id: 'm9' }) },
  };
}

const consulta = { diagnosticos: [{ codigoCie10: 'J06.9', descripcion: 'Resfriado', tipo: 'principal' }] };

describe('Permisos por rol', () => {
  it('solo un médico registra consultas, y el médico es quien inició sesión', () => {
    const repos = reposFalsos();
    rechaza(() => casos.registrarConsulta({ usuario: usuario('recepcion'), repos }, 'p1', consulta), SinPermiso);
    casos.registrarConsulta({ usuario: usuario('medico'), repos }, 'p1', { ...consulta, medicoId: 'otro' });
    const [, pacienteId, guardada] = repos.llamadas.find(([n]) => n === 'registrarConsulta');
    assert.equal(pacienteId, 'p1');
    assert.equal(guardada.medicoId, 'm1');
  });

  it('a la base no llega nada si los datos son inválidos', () => {
    const repos = reposFalsos();
    rechaza(() => casos.registrarConsulta({ usuario: usuario('medico'), repos }, 'p1', { diagnosticos: [] }), DatosInvalidos);
    assert.equal(repos.llamadas.length, 0);
  });

  it('solo el admin archiva un historial', () => {
    const repos = reposFalsos();
    rechaza(() => casos.darDeBaja({ usuario: usuario('medico'), repos }, 'p1', { motivo: 'traslado' }), SinPermiso);
    casos.darDeBaja({ usuario: usuario('admin'), repos }, 'p1', { motivo: 'traslado' });
    assert.equal(repos.llamadas[0][0], 'darDeBaja');
  });

  it('el contacto lo actualiza recepción, no el médico', async () => {
    const repos = reposFalsos();
    await rechazaAsync(() => casos.actualizarContacto({ usuario: usuario('medico'), repos }, 'p1', { telefono: '55551234' }), SinPermiso);
    await casos.actualizarContacto({ usuario: usuario('recepcion'), repos }, 'p1', { telefono: '55551234' });
    assert.deepEqual(repos.llamadas[0][2], { telefono: '5555-1234', direccion: null, correo: null });
  });

  it('una institución sin el puerto de antecedentes responde "no disponible"', () => {
    const repos = reposFalsos();
    delete repos.antecedentes;
    rechaza(() => casos.agregarAntecedente({ usuario: usuario('medico'), repos }, 'p1', { tipo: 'patologico', descripcion: 'Asma' }), NoDisponible);
  });

  it('recepción recibe el historial sin tipo de sangre', async () => {
    const repos = reposFalsos();
    const h = await casos.obtenerHistorial({ usuario: usuario('recepcion'), repos }, 'p1');
    assert.equal(h.vista, 'administrativa');
    assert.equal(h.paciente.datosClinicos.tipoSangre, undefined);
  });
});

describe('Alta de médicos', () => {
  it('solo el admin da de alta médicos', async () => {
    await rechazaAsync(() => casos.registrarMedico({ usuario: usuario('recepcion'), repos: reposFalsos() }, {}), SinPermiso);
  });

  it('el adaptador recibe el hash de la contraseña, nunca la contraseña', async () => {
    const repos = reposFalsos();
    await casos.registrarMedico({ usuario: usuario('admin'), repos }, {
      nombres: 'Ana', apellidos: 'Ruiz', numeroColegiado: '4455', especialidad: 'cardiologia pediatrica',
      correo: 'ana.ruiz@pediatrico.gt', password: 'Inicial2026',
    });
    const [, guardado] = repos.llamadas.find(([n]) => n === 'registrarMedico');
    assert.equal(guardado.password, undefined);
    assert.ok(await bcrypt.compare('Inicial2026', guardado.passwordHash));
    // La especialidad escrita a mano se cambia por la del catálogo.
    assert.equal(guardado.especialidad, 'Cardiología pediátrica');
  });
});

describe('Catálogo de especialidades', () => {
  it('no se agrega una especialidad que ya existe con otras tildes o mayúsculas', async () => {
    const repos = reposFalsos();
    await rechazaAsync(() => casos.crearRegistroCatalogo({ usuario: usuario('admin'), repos }, 'especialidades', { nombre: 'PEDIATRIA GENERAL' }), Conflicto);
    assert.equal(repos.llamadas.length, 0);
  });

  it('una nueva se guarda con el nombre ordenado', async () => {
    const repos = reposFalsos();
    await casos.crearRegistroCatalogo({ usuario: usuario('admin'), repos }, 'especialidades', { nombre: '  nefrología   pediátrica ' });
    assert.deepEqual(repos.llamadas[0][1], { nombre: 'Nefrología pediátrica' });
  });

  it('solo el admin mantiene los catálogos', async () => {
    await rechazaAsync(() => casos.crearRegistroCatalogo({ usuario: usuario('medico'), repos: reposFalsos() }, 'especialidades', { nombre: 'X' }), SinPermiso);
  });
});
