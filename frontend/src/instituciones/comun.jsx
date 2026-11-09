import { Campo } from '../componentes/ui.jsx';
import { REFERENCIA_PAGO } from '../formato.js';

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
  return (
    <div className="pila">
      {entradas.map(([k, v]) => (
        <section className="panel vidrio" key={k}>
          <h2 style={{ textTransform: 'capitalize' }}>{k}</h2>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}>{JSON.stringify(v, null, 2)}</pre>
        </section>
      ))}
    </div>
  );
}

/** Botón para quitar una fila de una lista editable. */
export const Quitar = ({ onClick }) => (
  <button type="button" className="boton boton-fantasma boton-chico quitar" onClick={onClick}>Quitar</button>
);

/** Campo de referencia del pago: cambia de nombre según el método y no aparece en efectivo. */
export function CampoReferencia({ metodo, value, onChange, error }) {
  const regla = REFERENCIA_PAGO[metodo];
  if (!regla) return null;
  return (
    <Campo etiqueta={`${regla.campo} *`} value={value} onChange={onChange} error={error} placeholder={regla.ayuda}
      maxLength={regla.max} autoComplete="off" style={{ textTransform: 'uppercase' }} />
  );
}
