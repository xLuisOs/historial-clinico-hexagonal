// Gráfica de línea de UNA serie en el tiempo (un solo eje Y). La usan la curva
// de crecimiento del pediátrico y la evolución de parámetros del laboratorio.
// El eje X es tiempo real, para que se note cuánto pasó entre mediciones.
// `rango` (opcional) dibuja la banda del valor de referencia.

import { useEffect, useRef, useState } from 'react';
import { fecha } from '../formato.js';

const COLOR = '#008c9e';            // turquesa validado: croma ≥ 0.10 y contraste ≥ 3:1 sobre el panel
const BANDA = 'rgba(47, 138, 91, 0.10)';
const GRILLA = 'rgba(15, 45, 54, 0.08)';
const ALTO = 132;
const M = { arriba: 12, derecha: 52, abajo: 22, izquierda: 34 };

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (t) => { const [a, m] = t.split('-'); return `${MESES[Number(m) - 1]} ${a.slice(2)}`; };
const dia = (t) => Date.parse(`${t.slice(0, 10)}T00:00:00Z`);

/** Tres o cuatro marcas "redondas" (1, 2, 5 × 10ⁿ) que cubren [min, max]. */
function marcasY(min, max) {
  if (min === max) { min -= 1; max += 1; }
  const crudo = (max - min) / 3;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 5, 10].map((f) => f * potencia).find((p) => p >= crudo);
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;
  const marcas = [];
  for (let v = desde; v <= hasta + paso / 2; v += paso) marcas.push(Math.round(v * 100) / 100);
  return marcas;
}

/** Ancho real del contenedor, para dibujar el SVG sin deformar puntos ni texto. */
function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // Medida inicial inmediata: el ResizeObserver solo avisa cuando el navegador
    // pinta un cuadro (no ocurre en una pestaña oculta o al imprimir).
    setAncho(Math.floor(el.getBoundingClientRect().width));
    const obs = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, ancho];
}

const fueraDe = (rango, v) => {
  if (!rango) return null;
  if (rango.max != null && v > rango.max) return '↑ Alto';
  if (rango.min != null && v < rango.min) return '↓ Bajo';
  return null;
};

export function GraficaLinea({ titulo, unidad, puntos, rango = null }) {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);

  const xs = puntos.map((p) => dia(p.fecha));
  const valores = puntos.map((p) => p.valor);
  // La escala incluye la banda de referencia para que siempre se vea dónde queda "lo normal".
  const extremos = [...valores, ...(rango ? [rango.min, rango.max].filter((v) => v != null) : [])];
  const marcas = marcasY(Math.min(...extremos), Math.max(...extremos));
  const [yMin, yMax] = [marcas[0], marcas[marcas.length - 1]];
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const ancho_ = Math.max(ancho - M.izquierda - M.derecha, 10);
  const alto_ = ALTO - M.arriba - M.abajo;
  const x = (t) => M.izquierda + (x1 === x0 ? ancho_ / 2 : ((t - x0) / (x1 - x0)) * ancho_);
  const y = (v) => M.arriba + (1 - (v - yMin) / (yMax - yMin)) * alto_;
  const coords = puntos.map((p, i) => ({ ...p, cx: x(xs[i]), cy: y(p.valor) }));
  const ultimo = coords[coords.length - 1];
  const sufijo = unidad ? ` ${unidad}` : '';

  // El punto activo es el más cercano en X al puntero: no hace falta atinarle al círculo.
  function alMover(e) {
    const caja = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - caja.left;
    let cerca = 0;
    coords.forEach((c, i) => { if (Math.abs(c.cx - px) < Math.abs(coords[cerca].cx - px)) cerca = i; });
    setActivo(cerca);
  }

  const a = activo === null ? null : coords[activo];
  const banda = rango && {
    arriba: y(rango.max ?? yMax),
    abajo: y(rango.min ?? yMin),
  };
  const cambio = Math.round((ultimo.valor - coords[0].valor) * 10) / 10;

  return (
    <figure style={{ margin: '14px 0 0' }}>
      <figcaption style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.85rem' }}>
        <strong>{titulo} {unidad && <small style={{ color: 'var(--tinta-tenue)', fontWeight: 400 }}>({unidad})</small>}</strong>
        <small style={{ color: 'var(--tinta-suave)' }}>
          {coords.length > 1 && `${cambio >= 0 ? '+' : ''}${cambio}${sufijo} desde ${fecha(coords[0].fecha)}`}
        </small>
      </figcaption>
      <div ref={ref} style={{ position: 'relative' }}>
        {ancho > 0 && (
          <svg width={ancho} height={ALTO} role="img" style={{ display: 'block', touchAction: 'none' }}
            aria-label={`${titulo}: ${coords.map((c) => `${fecha(c.fecha)} ${c.valor}${sufijo}`).join(', ')}`}
            onPointerMove={alMover} onPointerLeave={() => setActivo(null)}>
            {banda && (
              <rect x={M.izquierda} width={ancho_} y={banda.arriba} height={Math.max(banda.abajo - banda.arriba, 0)} fill={BANDA} />
            )}
            {marcas.map((m) => (
              <g key={m}>
                <line x1={M.izquierda} x2={M.izquierda + ancho_} y1={y(m)} y2={y(m)} stroke={GRILLA} strokeWidth="1" />
                <text x={M.izquierda - 6} y={y(m)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--tinta-tenue)">{m}</text>
              </g>
            ))}
            <text x={coords[0].cx} y={ALTO - 6} textAnchor="start" fontSize="10" fill="var(--tinta-tenue)">{fechaCorta(coords[0].fecha)}</text>
            {coords.length > 1 && (
              <text x={ultimo.cx} y={ALTO - 6} textAnchor="end" fontSize="10" fill="var(--tinta-tenue)">{fechaCorta(ultimo.fecha)}</text>
            )}
            {a && <line x1={a.cx} x2={a.cx} y1={M.arriba} y2={M.arriba + alto_} stroke="var(--tinta-tenue)" strokeWidth="1" />}
            <polyline points={coords.map((c) => `${c.cx},${c.cy}`).join(' ')} fill="none" stroke={COLOR}
              strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {coords.map((c, i) => (
              <circle key={i} cx={c.cx} cy={c.cy} r={i === activo ? 6 : 4} fill={COLOR} stroke="#f4fafb" strokeWidth="2" />
            ))}
            <text x={ultimo.cx + 9} y={ultimo.cy} dy="0.32em" fontSize="11" fontWeight="600" fill="var(--tinta)">
              {ultimo.valor}
            </text>
          </svg>
        )}
        {a && (
          <div role="status" style={{
            position: 'absolute', top: Math.max(a.cy - 52, 0), left: Math.min(Math.max(a.cx - 64, 0), ancho - 128),
            width: 128, padding: '6px 8px', borderRadius: 10, background: 'var(--vidrio-fuerte)',
            boxShadow: 'var(--sombra-suave)', fontSize: '0.78rem', pointerEvents: 'none', textAlign: 'center',
          }}>
            <strong>{a.valor}{sufijo}</strong>
            {fueraDe(rango, a.valor) && <span style={{ color: 'var(--peligro)' }}> {fueraDe(rango, a.valor)}</span>}
            <br /><span style={{ color: 'var(--tinta-suave)' }}>{fecha(a.fecha)}</span>
          </div>
        )}
      </div>
      {rango && (
        <small style={{ color: 'var(--tinta-tenue)' }}>
          Franja verde: rango de referencia
          {rango.min != null && rango.max != null ? ` (${rango.min} – ${rango.max}${sufijo})` : rango.max != null ? ` (< ${rango.max}${sufijo})` : ` (> ${rango.min}${sufijo})`}
        </small>
      )}
    </figure>
  );
}
