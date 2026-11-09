import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatosInvalidos } from '../src/dominio/errores.js';
import {
  validarBaja, validarContacto, validarDatosClinicos, validarDatosPersonales, validarNuevoPaciente,
} from '../src/dominio/paciente.js';
import { validarTelefono } from '../src/dominio/telefono.js';
import { Validador } from '../src/dominio/validacion.js';
import { rechaza } from './ayuda.js';

const base = { nombres: 'Ana', apellidos: 'López', fechaNacimiento: '1990-05-10', sexo: 'F' };
const encargado = { nombres: 'Rosa', apellidos: 'López', parentesco: 'madre', documento: '1234567890101', telefono: '5555-1234' };

describe('Registro de pacientes', () => {
  it('acepta un paciente con los datos mínimos', () => {
    const p = validarNuevoPaciente(base, 'hospital');
    assert.equal(p.nombres, 'Ana');
    assert.equal(p.responsable, null);
  });

  it('exige nombres, apellidos, fecha de nacimiento y sexo', () => {
    rechaza(() => validarNuevoPaciente({}, 'hospital'), DatosInvalidos, ['nombres', 'apellidos', 'fechaNacimiento', 'sexo']);
  });

  it('no acepta una fecha de nacimiento futura', () => {
    rechaza(() => validarNuevoPaciente({ ...base, fechaNacimiento: '2999-01-01' }, 'hospital'), DatosInvalidos, ['fechaNacimiento']);
  });

  it('el documento (DPI/CUI) lleva exactamente 13 dígitos', () => {
    rechaza(() => validarNuevoPaciente({ ...base, documento: '12345' }, 'hospital'), DatosInvalidos, ['documento']);
    assert.equal(validarNuevoPaciente({ ...base, documento: '1234567890101' }, 'hospital').documento, '1234567890101');
  });

  it('en el pediátrico el responsable es obligatorio', () => {
    rechaza(() => validarNuevoPaciente(base, 'pediatrico'), DatosInvalidos, ['responsable']);
    assert.equal(validarNuevoPaciente({ ...base, responsable: encargado }, 'pediatrico').responsable.parentesco, 'madre');
  });

  it('en el pediátrico el encargado no puede ser cónyuge ni hijo del menor', () => {
    rechaza(() => validarNuevoPaciente({ ...base, responsable: { ...encargado, parentesco: 'conyuge' } }, 'pediatrico'),
      DatosInvalidos, ['responsable.parentesco']);
    // En el hospital, un adulto sí puede tener a su cónyuge como responsable.
    assert.equal(validarNuevoPaciente({ ...base, responsable: { ...encargado, parentesco: 'conyuge' } }, 'hospital').responsable.parentesco, 'conyuge');
  });

  it('el teléfono del responsable es obligatorio', () => {
    rechaza(() => validarNuevoPaciente({ ...base, responsable: { ...encargado, telefono: '' } }, 'pediatrico'),
      DatosInvalidos, ['responsable.telefono']);
  });
});

describe('Teléfonos de Guatemala', () => {
  const telefono = (valor) => {
    const v = new Validador();
    return { valor: validarTelefono(v, 'telefono', valor), errores: v.errores };
  };

  it('se guardan como 5555-1234, sin importar cómo se escriban', () => {
    assert.equal(telefono('55551234').valor, '5555-1234');
    assert.equal(telefono('5555 1234').valor, '5555-1234');
    assert.equal(telefono('5555-1234').valor, '5555-1234');
  });

  it('deben tener exactamente 8 dígitos', () => {
    assert.ok(telefono('5555-123').errores.telefono);
    assert.ok(telefono('502 5555 1234').errores.telefono);
  });

  it('vacío es válido si no es obligatorio', () => {
    assert.equal(telefono('').valor, null);
  });
});

describe('Mantenimiento del historial', () => {
  it('actualizar contacto exige al menos un dato', () => {
    rechaza(() => validarContacto({}), DatosInvalidos, ['contacto']);
    assert.equal(validarContacto({ telefono: '22334455' }).telefono, '2233-4455');
  });

  it('corregir datos personales: solo lo que viene, y algo debe venir', () => {
    assert.deepEqual(validarDatosPersonales({ nombres: 'Ana María' }), { nombres: 'Ana María' });
    rechaza(() => validarDatosPersonales({}), DatosInvalidos);
  });

  it('la odontológica solo registra alergias, no tipo de sangre', () => {
    rechaza(() => validarDatosClinicos({ tipoSangre: 'O+' }, 'odontologica'), DatosInvalidos, ['tipoSangre']);
    assert.deepEqual(validarDatosClinicos({ tipoSangre: 'O+' }, 'hospital'), { tipoSangre: 'O+' });
  });

  it('el tipo de sangre debe ser uno válido', () => {
    rechaza(() => validarDatosClinicos({ tipoSangre: 'C+' }, 'pediatrico'), DatosInvalidos, ['tipoSangre']);
  });
});

describe('Baja (archivo) del historial', () => {
  it('exige un motivo de la lista', () => {
    rechaza(() => validarBaja({}), DatosInvalidos, ['motivo']);
    rechaza(() => validarBaja({ motivo: 'aburrimiento' }), DatosInvalidos, ['motivo']);
  });

  it('el motivo "otro" necesita detalle', () => {
    rechaza(() => validarBaja({ motivo: 'otro' }), DatosInvalidos, ['detalle']);
    assert.equal(validarBaja({ motivo: 'traslado' }).motivo, 'traslado');
  });
});
