// Reportes del admin: totales del periodo de su institución (citas,
// inasistencia, ingresos, saldo, ocupación, vacunas, órdenes...). Lo que se
// mide lo decide el backend según la institución; aquí solo se muestra.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alerta, Cargando } from '../componentes/ui.jsx';
import { dinero, fecha } from '../formato.js';
import { useSesion } from '../sesion.jsx';

const aTexto = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Periodos rápidos, calculados con la fecha del navegador. */
function periodos() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const hace30 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29);
  return [
    { clave: 'mes', texto: 'Este mes', desde: aTexto(inicioMes), hasta: aTexto(hoy) },
    { clave: 'pasado', texto: 'Mes pasado', desde: aTexto(inicioMesPasado), hasta: aTexto(finMesPasado) },
    { clave: '30', texto: 'Últimos 30 días', desde: aTexto(hace30), hasta: aTexto(hoy) },
    { clave: 'anio', texto: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: aTexto(hoy) },
  ];
}

const NUMERO = new Intl.NumberFormat('es-GT');

function formatear(valor, formato) {
  if (valor == null) return '—';
  switch (formato) {
    case 'dinero': return dinero(valor);
    case 'numero': return NUMERO.format(valor);
    case 'porcentaje': return `${NUMERO.format(valor)} %`;
    case 'horas': return `${NUMERO.format(valor)} h`;
    default: return String(valor);
  }
}

export function Reportes() {
  const { usuario } = useSesion();
  const opciones = periodos();
  const [periodo, setPeriodo] = useState({ desde: opciones[0].desde, hasta: opciones[0].hasta });
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    setReporte(null);
    setError(null);
    api.reporte(periodo.desde, periodo.hasta)
      .then((r) => { if (vigente) setReporte(r); })
      .catch((e) => { if (vigente) setError(e.detalles?.hasta ?? e.detalles?.desde ?? e.message); });
    return () => { vigente = false; };
  }, [periodo]);

  const elegido = opciones.find((o) => o.desde === periodo.desde && o.hasta === periodo.hasta)?.clave;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Reportes</h1>
          <p>{usuario.institucionNombre} · del {fecha(periodo.desde)} al {fecha(periodo.hasta)}</p>
        </div>
      </div>

      <section className="panel vidrio filtros-reporte">
        <div className="acciones" role="group" aria-label="Periodo">
          {opciones.map((o) => (
            <button key={o.clave} type="button" className={`boton boton-chico ${elegido === o.clave ? 'boton-primario' : 'boton-secundario'}`}
              aria-pressed={elegido === o.clave} onClick={() => setPeriodo({ desde: o.desde, hasta: o.hasta })}>
              {o.texto}
            </button>
          ))}
        </div>
        <div className="acciones" style={{ alignItems: 'center' }}>
          <label className="campo-en-linea">Desde
            <input type="date" className="selector-dia" value={periodo.desde} max={periodo.hasta}
              onChange={(e) => e.target.value && setPeriodo({ ...periodo, desde: e.target.value })} />
          </label>
          <label className="campo-en-linea">Hasta
            <input type="date" className="selector-dia" value={periodo.hasta} min={periodo.desde}
              onChange={(e) => e.target.value && setPeriodo({ ...periodo, hasta: e.target.value })} />
          </label>
        </div>
      </section>

      <Alerta>{error}</Alerta>
      {!reporte && !error && <Cargando />}
      {reporte && (
        <>
          <section className="indicadores">
            {reporte.indicadores.map((i) => (
              <div key={i.titulo} className="panel vidrio indicador">
                <small>{i.titulo}</small>
                <strong>{formatear(i.valor, i.formato)}</strong>
                {i.nota && <span>{i.nota}</span>}
              </div>
            ))}
          </section>

          <div className="tablas-reporte">
            {reporte.tablas.map((t) => (
              <section key={t.titulo} className="panel vidrio">
                <h2>{t.titulo}</h2>
                {t.filas.length === 0
                  ? <p className="vacio">Sin datos en este periodo.</p>
                  : (
                    <div className="tabla-envoltura">
                      <table className="tabla">
                        <thead>
                          <tr>{t.columnas.map((c) => <th key={c.clave} className={c.formato ? 'num' : undefined}>{c.titulo}</th>)}</tr>
                        </thead>
                        <tbody>
                          {t.filas.map((f, n) => (
                            <tr key={n}>
                              {t.columnas.map((c) => (
                                <td key={c.clave} className={c.formato ? 'num' : undefined}>{formatear(f[c.clave], c.formato)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
