import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validarDiagnostico, validarNuevaConsulta, validarReceta } from '../src/dominio/atencion.js';
import { Conflicto, DatosInvalidos } from '../src/dominio/errores.js';
import {
  exigirHorarioLibre, exigirTransicion, sumarMinutos, validarNuevaCita,
} from '../src/dominio/cita.js';
import { rechaza } from './ayuda.js';

const principal = { codigoCie10: 'J06.9', descripcion: 'Infección respiratoria aguda', tipo: 'principal' };
const secundario = { codigoCie10: 'R50.9', descripcion: 'Fiebre', tipo: 'secundario' };
const item = { medicamentoId: '1', dosis: '5 mL', frecuencia: 'cada 8 horas', duracionDias: 5, via: 'oral' };

describe('Regla "registrar consulta"', () => {
  it('acepta una consulta con un diagnóstico principal', () => {
    const c = validarNuevaConsulta({ motivo: 'Tos', diagnosticos: [principal] }, 'hospital');
    assert.equal(c.diagnosticos.length, 1);
    assert.equal(c.receta, null);
  });

  it('exige al menos un diagnóstico', () => {
    rechaza(() => validarNuevaConsulta({ diagnosticos: [] }, 'hospital'), DatosInvalidos, ['diagnosticos']);
  });

  it('exige exactamente un diagnóstico principal', () => {
    rechaza(() => validarNuevaConsulta({ diagnosticos: [secundario] }, 'hospital'), DatosInvalidos, ['diagnosticos']);
    rechaza(() => validarNuevaConsulta({ diagnosticos: [principal, principal] }, 'hospital'), DatosInvalidos, ['diagnosticos']);
    assert.equal(validarNuevaConsulta({ diagnosticos: [principal, secundario] }, 'hospital').diagnosticos.length, 2);
  });

  it('la receta, si viene, se valida en la misma operación', () => {
    rechaza(() => validarNuevaConsulta({ diagnosticos: [principal], receta: { items: [] } }, 'hospital'), DatosInvalidos, ['receta.items']);
    assert.equal(validarNuevaConsulta({ diagnosticos: [principal], receta: { items: [item] } }, 'hospital').receta.items.length, 1);
  });

  it('pediátrico: el peso, la talla y el perímetro deben ser posibles', () => {
    rechaza(() => validarNuevaConsulta({ diagnosticos: [principal], datosEspecificos: { pesoKg: 500 } }, 'pediatrico'),
      DatosInvalidos, ['datosEspecificos.pesoKg']);
    assert.equal(validarNuevaConsulta({ diagnosticos: [principal], datosEspecificos: { pesoKg: 10.2 } }, 'pediatrico').datosEspecificos.pesoKg, 10.2);
  });

  it('odontológica: la pieza dental usa la notación FDI', () => {
    const consulta = (piezaDental) => ({ diagnosticos: [principal], datosEspecificos: { procedimientos: [{ procedimientoId: 'p1', piezaDental }] } });
    assert.equal(validarNuevaConsulta(consulta(36), 'odontologica').datosEspecificos.procedimientos[0].piezaDental, 36);
    assert.equal(validarNuevaConsulta(consulta(85), 'odontologica').datosEspecificos.procedimientos[0].piezaDental, 85);
    rechaza(() => validarNuevaConsulta(consulta(19), 'odontologica'), DatosInvalidos, ['datosEspecificos.procedimientos[0].piezaDental']);
    rechaza(() => validarNuevaConsulta(consulta(56), 'odontologica'), DatosInvalidos, ['datosEspecificos.procedimientos[0].piezaDental']);
  });

  it('hospital: un tratamiento no termina antes de empezar', () => {
    const consulta = { diagnosticos: [principal], datosEspecificos: { tratamientos: [{ descripcion: 'Reposo', fechaInicio: '2026-11-10', fechaFin: '2026-11-01' }] } };
    rechaza(() => validarNuevaConsulta(consulta, 'hospital'), DatosInvalidos, ['datosEspecificos.tratamientos[0].fechaFin']);
  });

  it('laboratorio: la orden lleva médico referente y exámenes sin repetir', () => {
    rechaza(() => validarNuevaConsulta({ diagnosticos: [principal], datosEspecificos: { examenes: [] } }, 'laboratorio'),
      DatosInvalidos, ['datosEspecificos.examenes', 'datosEspecificos.medicoReferenteId']);
    rechaza(() => validarNuevaConsulta({ diagnosticos: [principal], datosEspecificos: { medicoReferenteId: 'm1', examenes: ['a', 'a'] } }, 'laboratorio'),
      DatosInvalidos, ['datosEspecificos.examenes']);
  });
});

describe('Regla "agregar diagnóstico"', () => {
  it('el código CIE-10 debe tener el formato correcto', () => {
    rechaza(() => validarDiagnostico({ codigoCie10: '123', descripcion: 'x' }), DatosInvalidos, ['diagnostico.codigoCie10']);
    assert.equal(validarDiagnostico({ codigoCie10: 'j06.9', descripcion: 'x' }).codigoCie10, 'J06.9');
  });

  it('la descripción es obligatoria', () => {
    rechaza(() => validarDiagnostico({ codigoCie10: 'J06.9' }), DatosInvalidos, ['diagnostico.descripcion']);
  });
});

describe('Regla "recetar"', () => {
  it('exige al menos un medicamento', () => {
    rechaza(() => validarReceta({ items: [] }), DatosInvalidos, ['items']);
  });

  it('no repite un medicamento en la misma receta', () => {
    rechaza(() => validarReceta({ items: [item, item] }), DatosInvalidos, ['items[1].medicamentoId']);
  });

  it('la duración va de 1 a 365 días y la vía debe existir', () => {
    rechaza(() => validarReceta({ items: [{ ...item, duracionDias: 0 }] }), DatosInvalidos, ['items[0].duracionDias']);
    rechaza(() => validarReceta({ items: [{ ...item, via: 'telepatía' }] }), DatosInvalidos, ['items[0].via']);
  });
});

describe('Agenda de citas', () => {
  it('no se agenda en el pasado', () => {
    rechaza(() => validarNuevaCita({ medicoId: '1', fechaHora: '2000-01-01 10:00' }), DatosInvalidos, ['fechaHora']);
    assert.equal(validarNuevaCita({ medicoId: '1', fechaHora: '2999-01-01 10:00' }).duracionMin, 30);
  });

  it('suma minutos sin depender de la zona horaria', () => {
    assert.equal(sumarMinutos('2026-11-09 23:45:00', 30), '2026-11-10 00:15:00');
  });

  it('detecta choques de horario con otra cita del médico', () => {
    const otras = [{ fechaHora: '2026-12-01 10:00:00', duracionMin: 30 }];
    rechaza(() => exigirHorarioLibre(otras, { fechaHora: '2026-12-01 10:15:00', duracionMin: 30 }), Conflicto, ['fechaHora']);
    rechaza(() => exigirHorarioLibre(otras, { fechaHora: '2026-12-01 09:45:00', duracionMin: 30 }), Conflicto);
  });

  it('una cita que empieza cuando termina la otra no choca', () => {
    const otras = [{ fechaHora: '2026-12-01 10:00:00', duracionMin: 30 }];
    exigirHorarioLibre(otras, { fechaHora: '2026-12-01 10:30:00', duracionMin: 30 });
    exigirHorarioLibre(otras, { fechaHora: '2026-12-01 09:30:00', duracionMin: 30 });
  });

  it('solo una cita pendiente cambia de estado', () => {
    rechaza(() => exigirTransicion({ estado: 'cancelada', fechaHora: '2026-01-01 10:00:00' }, 'confirmada'), Conflicto);
    exigirTransicion({ estado: 'programada', fechaHora: '2999-01-01 10:00:00' }, 'confirmada');
  });

  it('"no asistió" solo cuando ya pasó la hora de la cita', () => {
    rechaza(() => exigirTransicion({ estado: 'programada', fechaHora: '2999-01-01 10:00:00' }, 'no_asistio'), Conflicto);
    exigirTransicion({ estado: 'programada', fechaHora: '2000-01-01 10:00:00' }, 'no_asistio');
  });
});
