// Centro Médico Pediátrico: la consulta lleva las medidas de crecimiento. En el
// historial, la curva de crecimiento va arriba (junto a las citas) y el menú
// suma el esquema de vacunación y los cobros.

import { Campo } from '../componentes/ui.jsx';
import { puede } from '../sesion.jsx';
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

const secciones = [
  {
    id: 'vacunas',
    titulo: 'Esquema de vacunación',
    // No llega en la vista administrativa de recepción.
    visible: ({ extras }) => extras.vacunas?.length > 0,
    insignia: ({ extras }) => extras.vacunas.filter((v) => v.estado === 'pendiente').length || null,
    alerta: true,
    Componente: ({ extras, paciente, consultas, usuario, recargar }) => (
      <PanelVacunacion vacunas={extras.vacunas} paciente={paciente} consultas={consultas} usuario={usuario} recargar={recargar} />
    ),
  },
  {
    id: 'cobros',
    titulo: 'Cobros',
    visible: ({ extras, usuario }) => extras.cobros?.length > 0 || puede(usuario, 'cobrar'),
    insignia: ({ extras }) => extras.cobros.filter((c) => c.estado === 'pendiente').length || null,
    Componente: ({ extras, paciente, consultas, usuario, recargar }) => (
      <PanelCobros cobros={extras.cobros} consultas={consultas} paciente={paciente} usuario={usuario} recargar={recargar} />
    ),
  },
];

export const pediatrico = {
  datosIniciales: { pesoKg: '', tallaCm: '', perimetroCefalicoCm: '' },
  preparar: (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === '' ? null : Number(v)])),
  conObservaciones: true,
  textos: {
    notaAdministrativa: 'Vista administrativa: medidas de crecimiento, vacunas, diagnósticos, recetas y antecedentes solo los ve el personal médico.',
  },
  CamposConsulta,
  DetalleConsulta,
  Resumen: ({ extras }) => <PanelCrecimiento crecimiento={extras.crecimiento} />,
  secciones,
};
