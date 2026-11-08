// Hospital General: la consulta lleva tratamientos y si fue por emergencia; el
// historial suma internamientos y facturación.

import { Campo } from '../componentes/ui.jsx';
import { fecha } from '../formato.js';
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

function Extras({ extras, paciente, consultas, usuario, recargar }) {
  return (
    <>
      <PanelInternamientos internamientos={extras.internamientos} paciente={paciente} usuario={usuario} recargar={recargar} />

      <PanelFacturas facturas={extras.facturas} consultas={consultas} internamientos={extras.internamientos}
        paciente={paciente} usuario={usuario} recargar={recargar} />
    </>
  );
}

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
  Extras,
};
