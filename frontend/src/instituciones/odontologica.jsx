// Clínica Odontológica: la consulta lleva los procedimientos realizados y la
// pieza dental (notación FDI); el historial muestra el saldo por cobrar.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Campo, Selector } from '../componentes/ui.jsx';
import { dinero, fecha } from '../formato.js';
import { ProximasCitas, Quitar } from './comun.jsx';

const PROCEDIMIENTO = { procedimientoId: '', piezaDental: '', observaciones: '' };

function CamposConsulta({ valor, onChange, errores }) {
  const [catalogo, setCatalogo] = useState([]);
  useEffect(() => { api.procedimientosOdontologicos().then(setCatalogo).catch(() => {}); }, []);

  const lista = valor.procedimientos;
  const cambiar = (i, campo) => (e) =>
    onChange({ ...valor, procedimientos: lista.map((p, j) => (j === i ? { ...p, [campo]: e.target.value } : p)) });
  const error = (i, campo) => errores[`datosEspecificos.procedimientos[${i}].${campo}`];
  const total = lista.reduce((s, p) => s + (catalogo.find((c) => c.id === p.procedimientoId)?.costo ?? 0), 0);

  return (
    <section className="seccion-form">
      <header>
        <div>
          <h2>Procedimientos</h2>
          <p>El precio se toma del catálogo al guardar. Total estimado: <strong>{dinero(total)}</strong></p>
        </div>
      </header>
      {lista.map((p, i) => (
        <div className="fila-lista" key={i}>
          <Selector etiqueta="Procedimiento *" value={p.procedimientoId} onChange={cambiar(i, 'procedimientoId')}
            error={error(i, 'procedimientoId')}
            opciones={catalogo.map((c) => ({ valor: c.id, texto: `${c.nombre} · ${dinero(c.costo)}` }))} />
          <Campo etiqueta="Pieza (FDI)" type="number" min="11" max="85" placeholder="Ej. 36" value={p.piezaDental}
            onChange={cambiar(i, 'piezaDental')} error={error(i, 'piezaDental')} />
          <Campo etiqueta="Observaciones" value={p.observaciones} onChange={cambiar(i, 'observaciones')} error={error(i, 'observaciones')} />
          <Quitar onClick={() => onChange({ ...valor, procedimientos: lista.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <div>
        <button type="button" className="boton boton-secundario boton-chico"
          onClick={() => onChange({ ...valor, procedimientos: [...lista, { ...PROCEDIMIENTO }] })}>
          + Agregar procedimiento
        </button>
      </div>
    </section>
  );
}

const ESTADO_PAGO = { pagado: 'etiqueta-exito', parcial: 'etiqueta-aviso', pendiente: 'etiqueta-peligro' };

function DetalleConsulta({ datos }) {
  if (!datos.procedimientos?.length) return null;
  return (
    <div className="bloque">
      <h4>Procedimientos</h4>
      <ul className="items">
        {datos.procedimientos.map((p, n) => (
          <li key={n}>
            <strong>{p.nombre}</strong>
            {p.piezaDental && <span className="codigo">pieza {p.piezaDental}</span>}
            <small>{dinero(p.precioAplicado)}{p.observaciones ? ` · ${p.observaciones}` : ''}</small>
          </li>
        ))}
      </ul>
      <div className="acciones" style={{ alignItems: 'center' }}>
        <small>Total {dinero(datos.total)}</small>
        {datos.estadoPago && <span className={`etiqueta ${ESTADO_PAGO[datos.estadoPago] ?? ''}`}>{datos.estadoPago}</span>}
      </div>
    </div>
  );
}

function Extras({ extras }) {
  return (
    <>
      {extras.cuenta && (
        <section className="panel vidrio">
          <h2>Cuenta del paciente</h2>
          <div className="resumen">
            <div className="cifra"><small>Total atendido</small><strong>{dinero(extras.cuenta.total)}</strong></div>
            <div className="cifra"><small>Pagado</small><strong>{dinero(extras.cuenta.pagado)}</strong></div>
            <div className="cifra"><small>Saldo pendiente</small><strong>{dinero(extras.cuenta.saldoPendiente)}</strong></div>
          </div>
        </section>
      )}
      <ProximasCitas citas={extras.proximasCitas} />
      {extras.procedimientos?.length > 0 && (
        <section className="panel vidrio">
          <h2>Historial dental</h2>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Pieza</th><th>Procedimiento</th></tr></thead>
              <tbody>
                {extras.procedimientos.map((p, n) => (
                  <tr key={n}>
                    <td>{fecha(p.fecha)}</td>
                    <td>{p.piezaDental ?? '—'}</td>
                    <td>{p.procedimiento}{p.observaciones ? <small style={{ color: 'var(--tinta-suave)' }}> · {p.observaciones}</small> : null}</td>
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

export const odontologica = {
  datosIniciales: { procedimientos: [] },
  preparar: (d) => ({
    procedimientos: d.procedimientos.map((p) => ({
      procedimientoId: p.procedimientoId || null,
      piezaDental: p.piezaDental === '' ? null : Number(p.piezaDental),
      observaciones: p.observaciones || null,
    })),
  }),
  conObservaciones: true,
  CamposConsulta,
  DetalleConsulta,
  Extras,
};
