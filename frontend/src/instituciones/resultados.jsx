// Resultados del laboratorio. La estructura cambia según el tipo de examen
// (una hematología tiene 6 valores numéricos con rango; un urocultivo, un
// Positivo/Negativo y textos libres), así que la tabla y el formulario se
// arman a partir de los parámetros que trae cada examen, no de campos fijos.

import { useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';

/** Rango de referencia legible: "70 – 100 mg/dL", "< 200 mg/dL", "Normal: Claro". */
export function referencia(p) {
  const u = p.unidad ? ` ${p.unidad}` : '';
  if (p.refMin != null && p.refMax != null) return `${p.refMin} – ${p.refMax}${u}`;
  if (p.refMax != null) return `< ${p.refMax}${u}`;
  if (p.refMin != null) return `> ${p.refMin}${u}`;
  if (p.valorNormal) return `Normal: ${p.valorNormal}`;
  return '—';
}

/** "Alto" / "Bajo" para un numérico fuera de rango (texto, no solo color). */
export function direccion(p, valor = p.valor) {
  const n = Number(valor);
  if (p.tipoValor !== 'numerico' || valor === '' || valor == null || !Number.isFinite(n)) return null;
  if (p.refMax != null && n > p.refMax) return 'alto';
  if (p.refMin != null && n < p.refMin) return 'bajo';
  return null;
}

const Marca = ({ dir }) => (dir
  ? <span className="etiqueta etiqueta-peligro" style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>{dir === 'alto' ? '↑ Alto' : '↓ Bajo'}</span>
  : null);

export function TablaResultados({ examen }) {
  return (
    <div className="tabla-envoltura">
      <table className="tabla" style={{ fontSize: '0.85rem' }}>
        <thead><tr><th>Parámetro</th><th>Resultado</th><th>Referencia</th></tr></thead>
        <tbody>
          {examen.parametros.map((p) => {
            const fuera = p.fueraDeRango || (p.tipoValor !== 'numerico' && p.valorNormal && p.valor != null && p.valor !== p.valorNormal);
            return (
              <tr key={p.codigo}>
                <td style={{ whiteSpace: 'normal' }}>{p.nombre}</td>
                <td style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  {p.valor == null
                    ? <small style={{ color: 'var(--tinta-tenue)' }}>Pendiente</small>
                    : <strong style={fuera ? { color: 'var(--peligro)' } : undefined}>{p.valor}{p.unidad && p.tipoValor === 'numerico' ? ` ${p.unidad}` : ''}</strong>}
                  <Marca dir={p.fueraDeRango ? direccion(p) : null} />
                  {p.observacion && <><br /><small style={{ color: 'var(--tinta-suave)' }}>{p.observacion}</small></>}
                </td>
                <td style={{ whiteSpace: 'normal' }}><small style={{ color: 'var(--tinta-suave)' }}>{referencia(p)}</small></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Un campo por parámetro, según su tipo de valor. */
function CampoParametro({ p, valor, onValor, observacion, onObservacion, error }) {
  const dir = direccion(p, valor);
  const ayuda = `Referencia: ${referencia(p)}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
      {p.tipoValor === 'opcion' ? (
        <Selector etiqueta={p.nombre} value={valor} onChange={(e) => onValor(e.target.value)} error={error} vacio="Sin resultado"
          opciones={(p.opciones ?? []).map((o) => ({ valor: o, texto: o }))} />
      ) : (
        <Campo etiqueta={`${p.nombre}${p.unidad && p.tipoValor === 'numerico' ? ` (${p.unidad})` : ''}`} error={error}>
          <input type={p.tipoValor === 'numerico' ? 'number' : 'text'} step="any" value={valor}
            placeholder={p.tipoValor === 'texto' ? (p.valorNormal ?? '') : ''} onChange={(e) => onValor(e.target.value)} />
          <small style={{ color: dir ? 'var(--peligro)' : 'var(--tinta-tenue)' }}>
            {dir ? `${dir === 'alto' ? '↑ Por encima' : '↓ Por debajo'} del rango · ` : ''}{ayuda}
          </small>
        </Campo>
      )}
      <Campo etiqueta="Observación" value={observacion} maxLength={300} onChange={(e) => onObservacion(e.target.value)} />
    </div>
  );
}

export function DialogoResultados({ ordenId, examen, onCerrar, onListo }) {
  const inicial = Object.fromEntries(examen.parametros.map((p) => [p.codigo, {
    valor: p.valor == null ? '' : String(p.valor),
    observacion: p.observacion ?? '',
  }]));
  const [valores, setValores] = useState(inicial);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (codigo, campo) => (texto) => setValores({ ...valores, [codigo]: { ...valores[codigo], [campo]: texto } });

  // Solo se envían los parámetros con valor; los errores del backend vienen por
  // posición en la lista enviada y se traducen de vuelta al código del parámetro.
  const enviados = examen.parametros.filter((p) => valores[p.codigo].valor.trim() !== '');
  const detalles = erroresDe(error);
  const errorDe = (codigo) => {
    const i = enviados.findIndex((p) => p.codigo === codigo);
    return i === -1 ? null : detalles[`resultados[${i}].valor`];
  };

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.registrarResultados(ordenId, examen.codigo, {
        resultados: enviados.map((p) => {
          const { valor, observacion } = valores[p.codigo];
          return {
            parametro: p.codigo,
            valor: p.tipoValor === 'numerico' ? Number(valor) : valor.trim(),
            observacion: observacion.trim() || null,
          };
        }),
      });
      onListo();
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  const faltan = examen.parametros.length - enviados.length;
  return (
    <Dialogo titulo={`Resultados · ${examen.nombre}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>
          Puedes guardar resultados parciales. Cuando estén los {examen.parametros.length} parámetros, el examen queda listo para validar.
        </p>
        <Alerta>{error?.message === 'Datos inválidos' ? null : error?.message}</Alerta>
        {detalles.resultados && <Alerta>{detalles.resultados}</Alerta>}
        {examen.parametros.map((p) => (
          <CampoParametro key={p.codigo} p={p} valor={valores[p.codigo].valor} observacion={valores[p.codigo].observacion}
            onValor={cambiar(p.codigo, 'valor')} onObservacion={cambiar(p.codigo, 'observacion')} error={errorDe(p.codigo)} />
        ))}
        <footer>
          <small style={{ color: 'var(--tinta-suave)', marginRight: 'auto' }}>
            {faltan === 0 ? 'Todos los parámetros con resultado' : `Faltan ${faltan} de ${examen.parametros.length}`}
          </small>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando || enviados.length === 0}>{enviando ? 'Guardando…' : 'Guardar resultados'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}
