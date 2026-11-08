import { fechaHora } from '../formato.js';

/** Próximas citas (hospital y odontológica las devuelven en extras.proximasCitas). */
export function ProximasCitas({ citas }) {
  if (!citas) return null;
  return (
    <section className="panel vidrio">
      <h2>Próximas citas</h2>
      {citas.length === 0 ? <p className="vacio">Sin citas programadas.</p> : (
        <ul className="items">
          {citas.map((c) => (
            <li key={c.id}>
              <strong>{fechaHora(c.fechaHora)}</strong>
              <small>{[c.medico ?? c.odontologo, c.motivo].filter(Boolean).join(' · ')}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Para una institución sin vista propia: muestra los datos tal como llegan,
 * así la interfaz sigue funcionando aunque cambie lo que devuelve su adaptador.
 */
export function DatosGenericos({ datos }) {
  const entradas = Object.entries(datos ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entradas.length === 0) return null;
  return (
    <ul className="items">
      {entradas.map(([k, v]) => (
        <li key={k}>
          <small>{k}:</small> <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ExtrasGenericos({ extras }) {
  const entradas = Object.entries(extras ?? {});
  if (entradas.length === 0) return null;
  return entradas.map(([k, v]) => (
    <section className="panel vidrio" key={k}>
      <h2 style={{ textTransform: 'capitalize' }}>{k}</h2>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}>{JSON.stringify(v, null, 2)}</pre>
    </section>
  ));
}

/** Botón para quitar una fila de una lista editable. */
export const Quitar = ({ onClick }) => (
  <button type="button" className="boton boton-fantasma boton-chico quitar" onClick={onClick}>Quitar</button>
);
