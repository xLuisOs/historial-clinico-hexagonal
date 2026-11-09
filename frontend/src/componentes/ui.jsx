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

/**
 * Correo de una cuenta nueva: se escribe solo lo de antes de la @ y el dominio
 * de la institución queda fijo. `value` y `onChange` manejan esa primera parte;
 * si pegan el correo completo, se queda con lo de antes de la @.
 */
export function CampoCorreo({ etiqueta, dominio, value, onChange, error }) {
  return (
    <label className={`campo${error ? ' con-error' : ''}`}>
      <span>{etiqueta}</span>
      <div className="correo-institucional">
        <input type="text" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="nombre"
          value={value} onChange={(e) => onChange(e.target.value.split('@')[0].replace(/\s/g, ''))} />
        <span>@{dominio}</span>
      </div>
      {error && <small className="error-campo">{error}</small>}
    </label>
  );
}

/** Correo completo a partir de lo que se escribió en CampoCorreo, o null si está vacío. */
export const correoCompleto = (usuario, dominio) => (usuario.trim() ? `${usuario.trim()}@${dominio}` : null);

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
