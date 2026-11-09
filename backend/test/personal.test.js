import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tiposAntecedente, validarAntecedente } from '../src/dominio/antecedente.js';
import { validarCambioPassword } from '../src/dominio/cuenta.js';
import { DatosInvalidos } from '../src/dominio/errores.js';
import { listaDeEspecialidades, mismaEspecialidad, normalizarEspecialidad } from '../src/dominio/especialidades.js';
import { validarCambiosMedico, validarNuevoMedico } from '../src/dominio/medico.js';
import { historialParaRol, pacienteParaRol } from '../src/dominio/privacidad.js';
import { diaSiguiente, validarPeriodo } from '../src/dominio/reportes.js';
import { rechaza } from './ayuda.js';

const medico = {
  nombres: 'Sofía', apellidos: 'Hernández', numeroColegiado: '18230', especialidad: 'Pediatría general',
  correo: 'sofia.hernandez@pediatrico.gt', password: 'Inicial2026',
};
const pediatrico = { dominio: 'pediatrico.gt' };

describe('Alta y edición de médicos', () => {
  it('acepta un médico con su cuenta del dominio de la institución', () => {
    const m = validarNuevoMedico(medico, pediatrico);
    assert.equal(m.correo, 'sofia.hernandez@pediatrico.gt');
    assert.equal(m.password, 'Inicial2026');
  });

  it('el correo debe ser del dominio de la institución (enruta el inicio de sesión)', () => {
    rechaza(() => validarNuevoMedico({ ...medico, correo: 'sofia@hospital.gt' }, pediatrico), DatosInvalidos, ['correo']);
  });

  it('la contraseña lleva de 8 a 72 caracteres, con letras y números', () => {
    rechaza(() => validarNuevoMedico({ ...medico, password: 'corta1' }, pediatrico), DatosInvalidos, ['password']);
    rechaza(() => validarNuevoMedico({ ...medico, password: 'sololetras' }, pediatrico), DatosInvalidos, ['password']);
  });

  it('el colegiado son solo números, de 3 a 10 dígitos', () => {
    rechaza(() => validarNuevoMedico({ ...medico, numeroColegiado: 'A-12' }, pediatrico), DatosInvalidos, ['numeroColegiado']);
  });

  it('al editar, el correo no se puede cambiar (es la cuenta)', () => {
    rechaza(() => validarCambiosMedico({ correo: 'otro@pediatrico.gt' }), DatosInvalidos, ['correo']);
    assert.deepEqual(validarCambiosMedico({ nombres: 'Sofía María' }), { nombres: 'Sofía María' });
  });

  it('cambiar mi contraseña: la nueva debe ser distinta de la actual', () => {
    rechaza(() => validarCambioPassword({ actual: 'Inicial2026', nueva: 'Inicial2026' }), DatosInvalidos, ['nueva']);
    rechaza(() => validarCambioPassword({ nueva: 'Nueva2026x' }), DatosInvalidos, ['actual']);
  });
});

describe('Especialidades', () => {
  it('"Cardiologia" y "cardiología " son la misma especialidad', () => {
    assert.ok(mismaEspecialidad('Cardiologia', ' cardiología '));
    assert.ok(!mismaEspecialidad('Cardiología', 'Cardiología pediátrica'));
  });

  it('lo escrito a mano se cambia por la que ya existe', () => {
    assert.equal(normalizarEspecialidad('cardiologia', ['Cardiología', 'Urología']), 'Cardiología');
  });

  it('una nueva se guarda ordenada: mayúscula inicial y sin espacios de más', () => {
    assert.equal(normalizarEspecialidad('  nefrología   pediátrica '), 'Nefrología pediátrica');
  });

  it('la lista no repite especialidades que solo difieren en tildes', () => {
    assert.deepEqual(listaDeEspecialidades(['Urología', 'Cardiología', 'Cardiologia', null]), ['Cardiología', 'Urología']);
  });
});

describe('Antecedentes médicos', () => {
  it('el tipo perinatal existe solo en el pediátrico', () => {
    assert.ok(tiposAntecedente('pediatrico').includes('perinatal'));
    assert.ok(!tiposAntecedente('hospital').includes('perinatal'));
    rechaza(() => validarAntecedente({ tipo: 'perinatal', descripcion: 'Prematuro' }, 'laboratorio'), DatosInvalidos, ['tipo']);
  });

  it('un antecedente perinatal no lleva año (es del nacimiento)', () => {
    assert.equal(validarAntecedente({ tipo: 'perinatal', descripcion: 'Prematuro', anioInicio: 2020 }, 'pediatrico').anioInicio, null);
  });

  it('el año no puede ser futuro', () => {
    rechaza(() => validarAntecedente({ tipo: 'patologico', descripcion: 'Asma', anioInicio: 2999 }, 'hospital'), DatosInvalidos, ['anioInicio']);
  });
});

describe('Vista administrativa (recepción no recibe datos clínicos)', () => {
  const recepcion = (institucion) => ({ rol: 'recepcion', institucion });
  const paciente = { id: '1', nombres: 'Ana', datosClinicos: { tipoSangre: 'O+', alergias: 'Penicilina' } };
  const consulta = (datosEspecificos) => ({
    id: 'c1', fecha: '2026-11-01', medico: { nombre: 'Dra. X' }, motivo: 'Tos', observaciones: 'Notas clínicas',
    diagnosticos: [{ descripcion: 'Asma' }], receta: { items: [] }, datosEspecificos,
  });

  it('el paciente solo conserva las alergias (dato de seguridad)', () => {
    assert.deepEqual(pacienteParaRol(paciente, recepcion('hospital')).datosClinicos, { alergias: 'Penicilina' });
    assert.equal(pacienteParaRol(paciente, { rol: 'medico', institucion: 'hospital' }).datosClinicos.tipoSangre, 'O+');
  });

  it('las consultas pierden motivo, notas, diagnósticos y receta', () => {
    const h = historialParaRol({ paciente, antecedentes: [{ tipo: 'patologico' }], consultas: [consulta({ pesoKg: 10 })], extras: { cobros: [] } }, recepcion('pediatrico'));
    assert.equal(h.vista, 'administrativa');
    assert.equal(h.antecedentes, undefined);
    const [c] = h.consultas;
    assert.equal(c.motivo, null);
    assert.equal(c.observaciones, null);
    assert.deepEqual(c.diagnosticos, []);
    assert.equal(c.receta, null);
    assert.deepEqual(c.datosEspecificos, {});
  });

  it('pediátrico: recepción ve los cobros, pero no crecimiento ni vacunas', () => {
    const h = historialParaRol({ paciente, consultas: [], extras: { cobros: [{ id: 1 }], crecimiento: [1], vacunas: [1] } }, recepcion('pediatrico'));
    assert.deepEqual(Object.keys(h.extras), ['cobros']);
  });

  it('laboratorio: recepción ve los exámenes y su estado, pero no los resultados', () => {
    const orden = consulta({ numero: 'LAB-1', estado: 'en_proceso', examenes: [{ codigo: 'HEMA', estado: 'validado', parametros: [{ valor: 10 }] }] });
    const h = historialParaRol({ paciente, consultas: [orden], extras: { ordenesEnCurso: 1, evolucion: [1] } }, recepcion('laboratorio'));
    const [examen] = h.consultas[0].datosEspecificos.examenes;
    assert.equal(examen.estado, 'validado');
    assert.equal(examen.parametros, null);
    assert.deepEqual(Object.keys(h.extras), ['ordenesEnCurso']);
  });

  it('médicos y admin reciben el historial completo', () => {
    const completo = { paciente, consultas: [consulta({})], extras: {} };
    assert.equal(historialParaRol(completo, { rol: 'medico', institucion: 'pediatrico' }), completo);
    assert.equal(historialParaRol(completo, { rol: 'admin', institucion: 'laboratorio' }), completo);
  });
});

describe('Periodo de los reportes', () => {
  it('no acepta un periodo al revés ni de más de un año', () => {
    rechaza(() => validarPeriodo({ desde: '2026-02-01', hasta: '2026-01-01' }), DatosInvalidos, ['hasta']);
    rechaza(() => validarPeriodo({ desde: '2024-01-01', hasta: '2026-01-01' }), DatosInvalidos, ['hasta']);
    assert.deepEqual(validarPeriodo({ desde: '2026-01-01', hasta: '2026-01-31' }), { desde: '2026-01-01', hasta: '2026-01-31' });
  });

  it('el día siguiente cruza meses y años', () => {
    assert.equal(diaSiguiente('2026-12-31'), '2027-01-01');
    assert.equal(diaSiguiente('2028-02-28'), '2028-02-29');
  });
});
