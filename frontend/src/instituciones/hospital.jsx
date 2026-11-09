// Hospital General: la consulta lleva tratamientos y si fue por emergencia. En
// el historial, arriba va un resumen (internamiento actual y saldo) y el menú
// suma internamientos y facturas.

import { Campo } from '../componentes/ui.jsx';
import { dinero, fecha, fechaHora } from '../formato.js';
import { puede } from '../sesion.jsx';
import { Quitar } from './comun.jsx';
import { PanelFacturas } from './facturacion.jsx';
import { PanelInternamientos } from './internamientos.jsx';

const TRATAMIENTO = { descripcion: '', fechaInicio: '', fechaFin: '', indicaciones: '' };

function CamposConsulta({ valor, onChange, errores }) {
  const tratamientos = valor.tratamientos;
  const cambiar = (i, campo) => (e) =>
    onChange({ ...valor, tratamientos: tratamientos.map((t, j) => (j === i ? { ...t, [campo]: e.target.value } : t)) });
  const error = (i, campo) => errores[`datosEspecificos.tratamientos[${i}].${campo}`];

  return (
    <section className="seccion-form">
      <header>
        <div>
          <h2>Tratamientos</h2>
          <p>Indicaciones que el paciente debe seguir después de la consulta.</p>
        </div>
        <label className="check">
          <input type="checkbox" checked={valor.esEmergencia}
            onChange={(e) => onChange({ ...valor, esEmergencia: e.target.checked })} />
          Atención por emergencia
        </label>
      </header>
      {tratamientos.map((t, i) => (
        <div className="fila-lista" key={i}>
          <Campo etiqueta="Descripción *" value={t.descripcion} onChange={cambiar(i, 'descripcion')} error={error(i, 'descripcion')} />
          <Campo etiqueta="Inicio" type="date" value={t.fechaInicio} onChange={cambiar(i, 'fechaInicio')} error={error(i, 'fechaInicio')} />
          <Campo etiqueta="Fin" type="date" value={t.fechaFin} onChange={cambiar(i, 'fechaFin')} error={error(i, 'fechaFin')} />
          <Campo etiqueta="Indicaciones" value={t.indicaciones} onChange={cambiar(i, 'indicaciones')} error={error(i, 'indicaciones')} />
          <Quitar onClick={() => onChange({ ...valor, tratamientos: tratamientos.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <div>
        <button type="button" className="boton boton-secundario boton-chico"
          onClick={() => onChange({ ...valor, tratamientos: [...tratamientos, { ...TRATAMIENTO }] })}>
          + Agregar tratamiento
        </button>
      </div>
    </section>
  );
}

function DetalleConsulta({ datos }) {
  return (
    <>
      {datos.esEmergencia && <div><span className="etiqueta etiqueta-peligro">Emergencia</span></div>}
      {datos.tratamientos?.length > 0 && (
        <div className="bloque">
          <h4>Tratamientos</h4>
          <ul className="items">
            {datos.tratamientos.map((t) => (
              <li key={t.id}>
                <strong>{t.descripcion}</strong>
                <small>{fecha(t.fechaInicio)}{t.fechaFin ? ` – ${fecha(t.fechaFin)}` : ' · en curso'}</small>
                {t.indicaciones && <small>· {t.indicaciones}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Resumen({ extras }) {
  const internamientos = extras.internamientos ?? [];
  const facturas = extras.facturas ?? [];
  const actual = internamientos.find((i) => i.estado === 'activo');
  const pendientes = facturas.filter((f) => f.estado === 'pendiente');
  return (
    <section className="panel vidrio resumen-historial">
      <h2>Resumen</h2>
      <div className="resumen">
        <div className="cifra">
          <small>Internamiento</small>
          <strong>{actual ? `Habitación ${actual.habitacion}` : 'No está internado'}</strong>
          {actual && <small>Desde {fechaHora(actual.fechaIngreso)}</small>}
        </div>
        <div className="cifra">
          <small>Saldo por cobrar</small>
          <strong>{dinero(pendientes.reduce((s, f) => s + f.saldo, 0))}</strong>
          <small>{pendientes.length} {pendientes.length === 1 ? 'factura pendiente' : 'facturas pendientes'}</small>
        </div>
        <div className="cifra">
          <small>Internamientos</small>
          <strong>{internamientos.length}</strong>
          <small>en su historial</small>
        </div>
      </div>
    </section>
  );
}

const secciones = [
  {
    id: 'internamientos',
    titulo: 'Internamientos',
    visible: ({ extras, paciente, usuario }) => extras.internamientos?.length > 0 || (puede(usuario, 'internar') && paciente.estado.activo),
    insignia: ({ extras }) => (extras.internamientos ?? []).some((i) => i.estado === 'activo') ? 'internado' : null,
    Componente: ({ extras, paciente, usuario, recargar }) => (
      <PanelInternamientos internamientos={extras.internamientos} paciente={paciente} usuario={usuario} recargar={recargar} />
    ),
  },
  {
    id: 'facturas',
    titulo: 'Facturas',
    visible: ({ extras, usuario }) => extras.facturas?.length > 0 || puede(usuario, 'facturar'),
    insignia: ({ extras }) => (extras.facturas ?? []).filter((f) => f.estado === 'pendiente').length || null,
    Componente: ({ extras, paciente, consultas, usuario, recargar }) => (
      <PanelFacturas facturas={extras.facturas} consultas={consultas} internamientos={extras.internamientos}
        paciente={paciente} usuario={usuario} recargar={recargar} />
    ),
  },
];

export const hospital = {
  datosIniciales: { esEmergencia: false, tratamientos: [] },
  // Las fechas vacías no se mandan: el backend usa la de hoy.
  preparar: (d) => ({
    esEmergencia: d.esEmergencia,
    tratamientos: d.tratamientos.map((t) => ({
      descripcion: t.descripcion,
      fechaInicio: t.fechaInicio || null,
      fechaFin: t.fechaFin || null,
      indicaciones: t.indicaciones || null,
    })),
  }),
  conObservaciones: false, // su modelo registra la atención como diagnósticos y tratamientos
  CamposConsulta,
  DetalleConsulta,
  Resumen,
  secciones,
};
