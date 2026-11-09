// Curva de crecimiento del pediátrico, en la franja de arriba del historial.
// Peso, talla y perímetro cefálico tienen escalas distintas (kg vs cm), así que
// van en gráficas pequeñas separadas, lado a lado, nunca en una sola con dos ejes. El eje X es tiempo real (no una consulta por
// columna), para que se note si pasaron 2 o 6 meses entre controles.

import { GraficaLinea } from '../componentes/GraficaLinea.jsx';
import { fecha } from '../formato.js';

const MEDIDAS = [
  ['pesoKg', 'Peso', 'kg'],
  ['tallaCm', 'Talla', 'cm'],
  ['perimetroCefalicoCm', 'Perímetro cefálico', 'cm'],
];

export function PanelCrecimiento({ crecimiento = [] }) {
  if (crecimiento.length === 0) return null;
  const series = MEDIDAS
    .map(([campo, titulo, unidad]) => ({
      campo, titulo, unidad,
      puntos: crecimiento.filter((c) => c[campo] != null).map((c) => ({ fecha: c.fecha, valor: Number(c[campo]) })),
    }))
    .filter((s) => s.puntos.length > 0);

  return (
    <section className="panel vidrio resumen-historial">
      <h2>Crecimiento</h2>
      <div className="graficas-fila">
        {series.map((s) => <GraficaLinea key={s.campo} titulo={s.titulo} unidad={s.unidad} puntos={s.puntos} />)}
      </div>
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--tinta-suave)', fontSize: '0.85rem' }}>Ver como tabla</summary>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th className="numero">Peso (kg)</th><th className="numero">Talla (cm)</th><th className="numero">P. cef. (cm)</th></tr></thead>
            <tbody>
              {crecimiento.map((c, n) => (
                <tr key={n}>
                  <td>{fecha(c.fecha)}</td>
                  <td className="numero">{c.pesoKg ?? '—'}</td>
                  <td className="numero">{c.tallaCm ?? '—'}</td>
                  <td className="numero">{c.perimetroCefalicoCm ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
