// Centro Médico Pediátrico: la consulta lleva las medidas de crecimiento; el
// historial muestra la curva de crecimiento y el esquema de vacunación.

import { Campo } from '../componentes/ui.jsx';
import { fecha } from '../formato.js';

const MEDIDAS = [
  ['pesoKg', 'Peso (kg)', '0.1'],
  ['tallaCm', 'Talla (cm)', '0.1'],
  ['perimetroCefalicoCm', 'Perímetro cefálico (cm)', '0.1'],
];

function CamposConsulta({ valor, onChange, errores }) {
  return (
    <section className="seccion-form">
      <header><h2>Crecimiento</h2></header>
      <div className="rejilla">
        {MEDIDAS.map(([campo, texto, paso]) => (
          <Campo key={campo} etiqueta={texto} type="number" step={paso} min="0" value={valor[campo]}
            onChange={(e) => onChange({ ...valor, [campo]: e.target.value })} error={errores[`datosEspecificos.${campo}`]} />
        ))}
      </div>
    </section>
  );
}

function DetalleConsulta({ datos }) {
  const medidas = MEDIDAS.filter(([campo]) => datos[campo] != null);
  if (medidas.length === 0) return null;
  return (
    <div className="bloque">
      <h4>Crecimiento</h4>
      <ul className="items">
        {medidas.map(([campo, texto]) => <li key={campo}><small>{texto}:</small> <strong>{datos[campo]}</strong></li>)}
      </ul>
    </div>
  );
}

const ESTADO_VACUNA = {
  aplicada: ['etiqueta-exito', 'Aplicada'],
  pendiente: ['etiqueta-peligro', 'Pendiente'],
  proxima: ['etiqueta-gris', 'Próxima'],
};

function Extras({ extras }) {
  return (
    <>
      {extras.crecimiento?.length > 0 && (
        <section className="panel vidrio">
          <h2>Crecimiento</h2>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th className="numero">Peso (kg)</th><th className="numero">Talla (cm)</th><th className="numero">P. cefálico (cm)</th></tr></thead>
              <tbody>
                {extras.crecimiento.map((c, n) => (
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
        </section>
      )}
      {extras.vacunas?.length > 0 && (
        <section className="panel vidrio">
          <h2>Esquema de vacunación</h2>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>Vacuna</th><th>Dosis</th><th>Edad</th><th>Estado</th></tr></thead>
              <tbody>
                {extras.vacunas.map((v, n) => {
                  const [clase, texto] = ESTADO_VACUNA[v.estado] ?? ['etiqueta-gris', v.estado];
                  return (
                    <tr key={n}>
                      <td>{v.vacuna}</td>
                      <td>{v.dosis}</td>
                      <td>{v.edadRecomendadaMeses} m</td>
                      <td><span className={`etiqueta ${clase}`}>{texto}</span>{v.fechaAplicacion && <small> {fecha(v.fechaAplicacion)}</small>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export const pediatrico = {
  datosIniciales: { pesoKg: '', tallaCm: '', perimetroCefalicoCm: '' },
  preparar: (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === '' ? null : Number(v)])),
  conObservaciones: true,
  CamposConsulta,
  DetalleConsulta,
  Extras,
};
