// Documentos para imprimir o guardar en PDF (receta, comprobante, informe de
// resultados, reporte). Se muestran en una hoja blanca encima de la página y
// se imprimen con la impresión del navegador ("Guardar como PDF"), sin
// librerías: al imprimir, la hoja de estilos oculta todo lo demás.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { edad, fecha, fechaHora, nombreCompleto, SEXO } from '../formato.js';
import { useSesion } from '../sesion.jsx';

const ahora = () => {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

/**
 * Hoja imprimible. `titulo` y `numero` van arriba a la derecha (p. ej.
 * "Receta médica", "Cobro #12"); `firma` agrega la línea para firmar.
 */
export function DocumentoImprimible({ titulo, numero, firma, onCerrar, children }) {
  const { usuario } = useSesion();

  // Mientras la hoja está abierta, la impresión solo muestra la hoja; Esc la cierra.
  useEffect(() => {
    document.body.classList.add('con-documento');
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => {
      document.body.classList.remove('con-documento');
      window.removeEventListener('keydown', alTeclear);
    };
  }, [onCerrar]);

  return createPortal(
    <div className="documento-fondo" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="documento-barra no-imprimir">
        <span>Vista previa · {titulo}</span>
        <span className="acciones">
          <button type="button" className="boton boton-primario boton-chico" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
          <button type="button" className="boton boton-secundario boton-chico" onClick={onCerrar}>Cerrar</button>
        </span>
      </div>
      <article className="hoja">
        <header className="hoja-encabezado">
          <div>
            <strong>{usuario.institucionNombre}</strong>
            <small>Historial clínico compartido</small>
          </div>
          <div className="hoja-titulo">
            <strong>{titulo}</strong>
            {numero && <small>{numero}</small>}
          </div>
        </header>
        {children}
        {firma && (
          <div className="hoja-firma">
            <span />
            <small>{firma}</small>
          </div>
        )}
        <footer className="hoja-pie">Emitido el {fechaHora(ahora())} por {usuario.nombre}</footer>
      </article>
    </div>,
    document.body,
  );
}

/** Pares "dato: valor" en dos columnas. Los vacíos no se muestran. */
export function DatosHoja({ datos }) {
  return (
    <dl className="hoja-datos">
      {datos.filter(([, valor]) => valor != null && valor !== '').map(([titulo, valor]) => (
        <div key={titulo}><dt>{titulo}</dt><dd>{valor}</dd></div>
      ))}
    </dl>
  );
}

/** Datos del paciente que van en todo documento clínico. */
export function DatosPaciente({ paciente, extra = [] }) {
  return (
    <DatosHoja datos={[
      ['Paciente', nombreCompleto(paciente)],
      ['Edad', paciente.fechaNacimiento ? `${edad(paciente.fechaNacimiento)} (${fecha(paciente.fechaNacimiento)})` : null],
      ['Sexo', SEXO[paciente.sexo]],
      ['Documento', paciente.documento],
      ...extra,
    ]} />
  );
}

/** Botón que abre un documento imprimible. */
export function BotonImprimir({ texto = 'Imprimir', onClick }) {
  return (
    <button type="button" className="boton boton-fantasma boton-chico no-imprimir" onClick={onClick}>{texto}</button>
  );
}
