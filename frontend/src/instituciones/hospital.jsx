// Hospital General: la consulta lleva tratamientos y si fue por emergencia; el
// historial muestra además internamientos y facturas.

import { Campo } from '../componentes/ui.jsx';
import { dinero, fecha, fechaHora } from '../formato.js';
import { ProximasCitas, Quitar } from './comun.jsx';

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

function Extras({ extras }) {
  return (
    <>
      <ProximasCitas citas={extras.proximasCitas} />

      {extras.internamientos?.length > 0 && (
        <section className="panel vidrio">
          <h2>Internamientos</h2>
          <div className="linea-tiempo">
            {extras.internamientos.map((i) => (
              <article className="consulta" key={i.id}>
                <div className="consulta-cabecera">
                  <div>
                    <h3>Habitación {i.habitacion}</h3>
                    <small>{fechaHora(i.fechaIngreso)}{i.fechaAlta ? ` → ${fechaHora(i.fechaAlta)}` : ''}</small>
                  </div>
                  <span className={`etiqueta ${i.estado === 'activo' ? 'etiqueta-aviso' : 'etiqueta-gris'}`}>
                    {i.estado === 'activo' ? 'Internado' : 'Alta'}
                  </span>
                </div>
                <p>{i.motivoIngreso}{i.diagnosticoIngreso ? ` · ${i.diagnosticoIngreso}` : ''}</p>
                <div className="bloque">
                  <h4>Médicos a cargo</h4>
                  <ul className="items">
                    {i.medicosACargo.map((m, n) => (
                      <li key={n}><strong>{m.medico}</strong><small>desde {fechaHora(m.fechaInicio)}{m.motivoCambio ? ` · ${m.motivoCambio}` : ''}</small></li>
                    ))}
                  </ul>
                </div>
                {i.tratamientos.length > 0 && (
                  <div className="bloque">
                    <h4>Tratamientos</h4>
                    <ul className="items">
                      {i.tratamientos.map((t, n) => (
                        <li key={n}><strong>{t.descripcion}</strong>{t.indicaciones && <small>· {t.indicaciones}</small>}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {extras.facturas?.length > 0 && (
        <section className="panel vidrio">
          <h2>Facturas</h2>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr><th>Fecha</th><th className="numero">Total</th><th className="numero">Saldo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {extras.facturas.map((f) => (
                  <tr key={f.id}>
                    <td>{fecha(f.fechaEmision)}</td>
                    <td className="numero">{dinero(f.total)}</td>
                    <td className="numero">{dinero(f.saldo)}</td>
                    <td><span className={`etiqueta ${f.estado === 'pagada' ? 'etiqueta-exito' : 'etiqueta-aviso'}`}>{f.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
