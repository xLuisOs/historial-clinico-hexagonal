// Esquema de vacunación del pediátrico: una fila por vacuna y una bolita por
// dosis (aplicada, le toca por edad o próxima). Al tocar una bolita se ve su
// detalle; si es la siguiente dosis de esa vacuna, el médico puede aplicarla.
// El backend verifica el orden, que no se repita y la fecha.

import { useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { fecha } from '../formato.js';
import { puede } from '../sesion.jsx';

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

/** Agrupa las dosis por vacuna, en el orden en que le toca la primera dosis. */
function porVacuna(vacunas) {
  const grupos = new Map();
  for (const v of vacunas) {
    if (!grupos.has(v.vacunaId)) grupos.set(v.vacunaId, { vacunaId: v.vacunaId, nombre: v.vacuna, dosis: [] });
    grupos.get(v.vacunaId).dosis.push(v);
  }
  for (const g of grupos.values()) g.dosis.sort((a, b) => a.numeroDosis - b.numeroDosis);
  return [...grupos.values()];
}

const edadTexto = (meses) => (meses === 0 ? 'al nacer' : meses % 12 === 0 && meses >= 24 ? `a los ${meses / 12} años` : `a los ${meses} meses`);

function describir(d) {
  const base = `${d.vacuna} · dosis ${d.dosis} · ${edadTexto(d.edadRecomendadaMeses)}`;
  if (d.estado === 'aplicada') return `${base} · aplicada el ${fecha(d.fechaAplicacion)}${d.lote ? ` · lote ${d.lote}` : ''}`;
  return `${base} · ${d.estado === 'pendiente' ? 'le toca ya' : 'todavía no le toca'}`;
}

export function PanelVacunacion({ vacunas = [], paciente, consultas = [], usuario, recargar }) {
  const [elegida, setElegida] = useState(null);
  const [aplicando, setAplicando] = useState(null);
  if (vacunas.length === 0) return null;

  const puedeAplicar = paciente?.estado?.activo && puede(usuario, 'aplicarVacuna');
  const siguientes = siguientesDosis(vacunas);
  const grupos = porVacuna(vacunas);
  // "Le toca": la siguiente dosis de cada vacuna que ya está en edad.
  const leToca = [...siguientes].filter((d) => d.estado === 'pendiente');
  const clave = (d) => `${d.vacunaId}-${d.numeroDosis}`;
  const detalle = elegida && vacunas.find((d) => clave(d) === elegida);

  return (
    <section className="panel vidrio">
      <div className="titulo-panel">
        <h2>Esquema de vacunación</h2>
        {leToca.length > 0 && <span className="etiqueta etiqueta-peligro">{leToca.length} pendiente{leToca.length > 1 ? 's' : ''}</span>}
      </div>

      <p style={{ color: 'var(--tinta-suave)', marginTop: 0 }}>
        {leToca.length > 0
          ? <>Le toca: <strong style={{ color: 'var(--tinta)' }}>{leToca.map((d) => `${d.vacuna} ${d.numeroDosis}`).join(', ')}</strong></>
          : 'Está al día con las vacunas que le tocan por edad.'}
      </p>

      <div className="vacunas">
        {grupos.map((g) => {
          const aplicadas = g.dosis.filter((d) => d.estado === 'aplicada').length;
          return (
            <div key={g.vacunaId} className="fila-vacuna">
              <span className="nombre-vacuna">{g.nombre}</span>
              <span className="dosis-vacuna">
                {g.dosis.map((d) => (
                  <button key={clave(d)} type="button" className={`dosis dosis-${d.estado}`}
                    aria-pressed={elegida === clave(d)} aria-label={describir(d)} title={describir(d)}
                    onClick={() => setElegida(elegida === clave(d) ? null : clave(d))} />
                ))}
              </span>
              <small className="avance-vacuna">{aplicadas} de {g.dosis.length}</small>
            </div>
          );
        })}
      </div>

      <div className="leyenda-vacunas" aria-hidden="true">
        <span><i className="dosis dosis-aplicada" /> Aplicada</span>
        <span><i className="dosis dosis-pendiente" /> Le toca</span>
        <span><i className="dosis dosis-proxima" /> Próxima</span>
        <span>· Toca una dosis para ver su fecha y lote</span>
      </div>

      {detalle && (
        <div className="detalle-dosis">
          <span>{describir(detalle)}</span>
          {puedeAplicar && siguientes.has(detalle) && (
            <button type="button" className="boton boton-primario boton-chico" onClick={() => setAplicando(detalle)}>Aplicar</button>
          )}
        </div>
      )}

      {aplicando && (
        <DialogoVacuna paciente={paciente} dosis={aplicando} consultas={consultas}
          onCerrar={() => setAplicando(null)} onListo={() => { setAplicando(null); setElegida(null); recargar(); }} />
      )}
    </section>
  );
}
