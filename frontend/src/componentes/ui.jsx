import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconoCerrar } from './Iconos.jsx';

/** Campo de formulario con su etiqueta y el error que mande el backend. */
export function Campo({ etiqueta, error, children, ...props }) {
  return (
    <label className={`campo${error ? ' con-error' : ''}`}>
      <span>{etiqueta}</span>
      {children ?? <input {...props} />}
      {error && <small className="error-campo">{error}</small>}
    </label>
  );
}

export function Selector({ etiqueta, error, opciones, vacio = 'Selecciona…', ...props }) {
  return (
    <Campo etiqueta={etiqueta} error={error}>
      <select {...props}>
        {vacio !== null && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>{o.texto}</option>
        ))}
      </select>
    </Campo>
  );
}

export function Alerta({ tipo = 'error', children }) {
  if (!children) return null;
  return <div className={`alerta alerta-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>{children}</div>;
}

/**
 * Ventana encima de la página. Se cierra con Esc o tocando el fondo.
 * Se dibuja directamente en <body>: dentro de un panel de vidrio
 * (backdrop-filter) un elemento fijo quedaría encerrado en ese panel.
 */
export function Dialogo({ titulo, onCerrar, children }) {
  useEffect(() => {
    const alPresionar = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  return createPortal(
    <div className="fondo-dialogo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <section className="dialogo vidrio" role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button type="button" className="boton boton-fantasma" onClick={onCerrar} aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}

export const Cargando = ({ texto = 'Cargando…' }) => <div className="cargando">{texto}</div>;

/** Iniciales para el avatar: "María José López" → "ML". */
export const iniciales = (p) => `${p?.nombres?.[0] ?? ''}${p?.apellidos?.[0] ?? ''}`.toUpperCase();

/** Convierte los errores campo por campo del backend en un objeto fácil de consultar. */
export const erroresDe = (error) => error?.detalles ?? {};
