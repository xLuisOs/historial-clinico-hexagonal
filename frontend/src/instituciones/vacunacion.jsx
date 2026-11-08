// Esquema de vacunación del pediátrico: cada dosis aplicada, pendiente (ya le
// toca por edad) o próxima. El médico aplica la siguiente dosis de cada vacuna;
// el backend verifica el orden, que no se repita y la fecha.

import { useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { fecha } from '../formato.js';
import { puede } from '../sesion.jsx';

const ESTADO_VACUNA = {
  aplicada: ['etiqueta-exito', 'Aplicada'],
  pendiente: ['etiqueta-peligro', 'Pendiente'],
  proxima: ['etiqueta-gris', 'Próxima'],
};

const hoy = () => new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);

/** Por vacuna, la dosis más baja que todavía no se aplicó: es la única que se puede aplicar. */
function siguientesDosis(vacunas) {
  const siguiente = new Map();
  for (const v of vacunas) {
    if (v.estado === 'aplicada') continue;
    const actual = siguiente.get(v.vacunaId);
    if (!actual || v.numeroDosis < actual.numeroDosis) siguiente.set(v.vacunaId, v);
  }
  return new Set([...siguiente.values()]);
}

function DialogoVacuna({ paciente, dosis, consultas, onCerrar, onListo }) {
  const [lote, setLote] = useState('');
  const [fechaAplicacion, setFechaAplicacion] = useState(hoy());
  const [consultaId, setConsultaId] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.aplicarVacuna(paciente.id, {
        vacunaId: dosis.vacunaId,
        numeroDosis: dosis.numeroDosis,
        lote: lote.trim() || null,
        fechaAplicacion: fechaAplicacion || null,
        consultaId: consultaId || null,
      });
      onListo();
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={`Aplicar ${dosis.vacuna}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>
          Dosis <strong>{dosis.dosis}</strong> · recomendada a los {dosis.edadRecomendadaMeses} meses
        </p>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Lote *" value={lote} maxLength={30} placeholder="p. ej. PENTA-26-0101"
            onChange={(e) => setLote(e.target.value)} error={errores.lote} />
          <Campo etiqueta="Fecha de aplicación" type="date" max={hoy()} value={fechaAplicacion}
            onChange={(e) => setFechaAplicacion(e.target.value)} error={errores.fechaAplicacion} />
        </div>
        <Selector etiqueta="Consulta" value={consultaId} onChange={(e) => setConsultaId(e.target.value)}
          vacio="Fuera de consulta (jornada de vacunación)" error={errores.consultaId}
          opciones={consultas.map((c) => ({ valor: c.id, texto: `${fecha(c.fecha)} · ${c.motivo || 'Consulta'}` }))} />
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar dosis'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}

export function PanelVacunacion({ vacunas = [], paciente, consultas = [], usuario, recargar }) {
  const [aplicando, setAplicando] = useState(null);
  if (vacunas.length === 0) return null;

  const puedeAplicar = paciente?.estado?.activo && puede(usuario, 'aplicarVacuna');
  const siguientes = puedeAplicar ? siguientesDosis(vacunas) : new Set();
  const pendientes = vacunas.filter((v) => v.estado === 'pendiente').length;

  return (
    <section className="panel vidrio">
      <div className="titulo-panel">
        <h2>Esquema de vacunación</h2>
        {pendientes > 0 && <span className="etiqueta etiqueta-peligro">{pendientes} pendiente{pendientes > 1 ? 's' : ''}</span>}
      </div>
      <div className="tabla-envoltura">
        <table className="tabla">
          <thead><tr><th>Vacuna</th><th>Estado</th>{puedeAplicar && <th />}</tr></thead>
          <tbody>
            {vacunas.map((v) => {
              const [clase, texto] = ESTADO_VACUNA[v.estado] ?? ['etiqueta-gris', v.estado];
              return (
                <tr key={`${v.vacunaId}-${v.numeroDosis}`}>
                  <td style={{ whiteSpace: 'normal' }}>
                    <strong>{v.vacuna}</strong>
                    <br />
                    <small style={{ color: 'var(--tinta-suave)' }}>Dosis {v.dosis} · {v.edadRecomendadaMeses} meses</small>
                  </td>
                  <td>
                    <span className={`etiqueta ${clase}`}>{texto}</span>
                    {v.fechaAplicacion && (
                      <>
                        <br />
                        <small style={{ color: 'var(--tinta-suave)' }}>{fecha(v.fechaAplicacion)}{v.lote && ` · ${v.lote}`}</small>
                      </>
                    )}
                  </td>
                  {puedeAplicar && (
                    <td className="numero">
                      {siguientes.has(v) && (
                        <button type="button" className="boton boton-primario boton-chico" onClick={() => setAplicando(v)}>Aplicar</button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {aplicando && (
        <DialogoVacuna paciente={paciente} dosis={aplicando} consultas={consultas}
          onCerrar={() => setAplicando(null)} onListo={() => { setAplicando(null); recargar(); }} />
      )}
    </section>
  );
}
