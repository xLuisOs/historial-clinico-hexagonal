// Centro Médico Pediátrico: la consulta lleva las medidas de crecimiento; el
// historial muestra la curva de crecimiento y el esquema de vacunación.

import { Campo } from '../componentes/ui.jsx';
import { PanelCobros } from './cobrosPediatrico.jsx';
import { PanelCrecimiento } from './crecimiento.jsx';
import { PanelVacunacion } from './vacunacion.jsx';

const MEDIDAS = [
  ['pesoKg', 'Peso (kg)', '0.1'],
  ['tallaCm', 'Talla (cm)', '0.1'],
  ['perimetroCefalicoCm', 'Perímetro cefálico (cm)', '0.1'],
];

function CamposConsulta({ valor, onChange, errores }) {
  return (
    <section className="seccion-form">
      <header><h2>Crecimiento</h2></header>
      <div className="rejilla">
        {MEDIDAS.map(([campo, texto, paso]) => (
          <Campo key={campo} etiqueta={texto} type="number" step={paso} min="0" value={valor[campo]}
            onChange={(e) => onChange({ ...valor, [campo]: e.target.value })} error={errores[`datosEspecificos.${campo}`]} />
        ))}
      </div>
    </section>
  );
}

function DetalleConsulta({ datos }) {
  const medidas = MEDIDAS.filter(([campo]) => datos[campo] != null);
  if (medidas.length === 0) return null;
  return (
    <div className="bloque">
      <h4>Crecimiento</h4>
      <ul className="items">
        {medidas.map(([campo, texto]) => <li key={campo}><small>{texto}:</small> <strong>{datos[campo]}</strong></li>)}
      </ul>
    </div>
  );
}

function Extras({ extras, paciente, consultas, usuario, recargar }) {
  return (
    <>
      <PanelCrecimiento crecimiento={extras.crecimiento} />
      <PanelVacunacion vacunas={extras.vacunas} paciente={paciente} consultas={consultas} usuario={usuario} recargar={recargar} />
      <PanelCobros cobros={extras.cobros} consultas={consultas} usuario={usuario} recargar={recargar} />
    </>
  );
}

export const pediatrico = {
  datosIniciales: { pesoKg: '', tallaCm: '', perimetroCefalicoCm: '' },
  preparar: (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === '' ? null : Number(v)])),
  conObservaciones: true,
  CamposConsulta,
  DetalleConsulta,
  Extras,
};
