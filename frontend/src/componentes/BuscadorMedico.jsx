// Elegir un médico escribiendo parte de su nombre o de su especialidad
// ("lópez", "cardio"): con muchos médicos, una lista desplegable larga no
// sirve. Se usa con el teclado (flechas, Enter, Escape) o con el mouse.

import { useEffect, useId, useRef, useState } from 'react';

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * `medicos`: [{ id, nombre, especialidad? }]. `value`: id elegido.
 * `etiqueta`: si viene, se muestra arriba como en los demás campos.
 */
export function BuscadorMedico({ medicos, value, onChange, etiqueta, error, placeholder = 'Busca por nombre o especialidad' }) {
  const elegido = medicos.find((m) => m.id === value) ?? null;
  const [texto, setTexto] = useState(elegido?.nombre ?? '');
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caja = useRef(null);
  const idLista = useId();

  // Si cambia el elegido desde afuera (o llega la lista), el campo muestra su nombre.
  useEffect(() => { if (!abierto) setTexto(elegido?.nombre ?? ''); }, [elegido?.nombre, abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const busqueda = sinTildes(texto);
  const filtrados = !abierto || texto === elegido?.nombre
    ? medicos
    : medicos.filter((m) => sinTildes(m.nombre).includes(busqueda) || sinTildes(m.especialidad).includes(busqueda));

  function elegir(m) {
    onChange(m.id);
    setTexto(m.nombre);
    setAbierto(false);
  }

  function teclado(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setMarcado((i) => Math.min(i + 1, filtrados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && abierto) { e.preventDefault(); if (filtrados[marcado]) elegir(filtrados[marcado]); }
    else if (e.key === 'Escape') { setAbierto(false); setTexto(elegido?.nombre ?? ''); }
  }

  const campo = (
    <div className="buscador-medico" ref={caja}>
      <input
        type="text" role="combobox" aria-expanded={abierto} aria-controls={idLista} aria-autocomplete="list"
        aria-label={etiqueta ? undefined : 'Médico'} placeholder={placeholder} value={texto} autoComplete="off"
        onFocus={(e) => { setAbierto(true); setMarcado(0); e.target.select(); }}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setMarcado(0); }}
        onKeyDown={teclado}
      />
      {abierto && (
        <ul id={idLista} role="listbox" className="buscador-medico-lista vidrio">
          {filtrados.length === 0 && <li className="vacio-lista">Nadie coincide</li>}
          {filtrados.map((m, i) => (
            <li key={m.id} role="option" aria-selected={m.id === value}
              className={i === marcado ? 'marcado' : undefined}
              onMouseDown={(e) => { e.preventDefault(); elegir(m); }} onMouseEnter={() => setMarcado(i)}>
              <strong>{m.nombre}</strong>
              {m.especialidad && <small>{m.especialidad}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!etiqueta) return campo;
  return (
    <label className={`campo${error ? ' con-error' : ''}`}>
      <span>{etiqueta}</span>
      {campo}
      {error && <small className="error-campo">{error}</small>}
    </label>
  );
}
