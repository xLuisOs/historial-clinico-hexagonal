// Citas del paciente: el panel del historial y los diálogos para agendar,
// reprogramar y cancelar (recepción y admin).

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { fechaHora } from '../formato.js';

// Solo la odontológica guarda cuánto dura cada cita; las demás usan 30 min.
const conDuracion = (institucion) => institucion === 'odontologica';

const ESTADO = { programada: 'Programada', confirmada: 'Confirmada' };

/** 'AAAA-MM-DD HH:MM:SS' → valor de <input type="datetime-local"> */
const aEntrada = (texto) => texto?.slice(0, 16).replace(' ', 'T') ?? '';

function ahoraEntrada() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function PanelCitas({ pacienteId, puedeAgendar, version, onReprogramar, onCancelar }) {
  const [citas, setCitas] = useState(null);
  const [disponible, setDisponible] = useState(true);

  useEffect(() => {
    let vigente = true;
    api.citasDelPaciente(pacienteId)
      .then((r) => { if (vigente) setCitas(r); })
      .catch((e) => { if (vigente && e.estado === 503) setDisponible(false); });
    return () => { vigente = false; };
  }, [pacienteId, version]);

  if (!disponible) return null; // institución sin agenda (laboratorio)
  return (
    <section className="panel vidrio">
      <h2>Próximas citas</h2>
      {!citas && <p className="vacio">Cargando…</p>}
      {citas?.length === 0 && <p className="vacio">Sin citas programadas.</p>}
      {citas?.length > 0 && (
        <div className="linea-tiempo">
          {citas.map((c) => (
            <article className="consulta" key={c.id} style={{ padding: 16, gap: 8 }}>
              <div className="consulta-cabecera">
                <div>
                  <strong>{fechaHora(c.fechaHora)}</strong>
                  {c.duracionMin && <small> · {c.duracionMin} min</small>}
                  <br />
                  <small>{c.medico.nombre}{c.motivo ? ` · ${c.motivo}` : ''}</small>
                </div>
                <span className="etiqueta">{ESTADO[c.estado] ?? c.estado}</span>
              </div>
              {puedeAgendar && (
                <div className="acciones">
                  <button type="button" className="boton boton-secundario boton-chico" onClick={() => onReprogramar(c)}>Reprogramar</button>
                  <button type="button" className="boton boton-fantasma boton-chico" onClick={() => onCancelar(c)}>Cancelar cita</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function useEnvio(accion, onListo) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await accion();
      onListo();
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }
  return { error, errores: erroresDe(error), enviando, enviar };
}

const Pie = ({ onCerrar, enviando, texto, peligro }) => (
  <footer>
    <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
    <button className={`boton ${peligro ? 'boton-peligro' : 'boton-primario'}`} disabled={enviando}>
      {enviando ? 'Guardando…' : texto}
    </button>
  </footer>
);

export function DialogoAgendar({ paciente, institucion, onCerrar, onListo }) {
  const [medicos, setMedicos] = useState([]);
  const [datos, setDatos] = useState({ medicoId: '', fechaHora: '', duracionMin: '30', motivo: '' });
  useEffect(() => { api.medicos().then(setMedicos).catch(() => {}); }, []);

  const { error, errores, enviando, enviar } = useEnvio(() => api.agendarCita(paciente.id, {
    medicoId: datos.medicoId || null,
    fechaHora: datos.fechaHora || null,
    duracionMin: conDuracion(institucion) ? Number(datos.duracionMin) : null,
    motivo: datos.motivo.trim() || null,
  }), onListo);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  return (
    <Dialogo titulo="Agendar cita" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <Selector etiqueta={institucion === 'odontologica' ? 'Odontólogo *' : 'Médico *'} value={datos.medicoId}
          onChange={cambiar('medicoId')} error={errores.medicoId}
          opciones={medicos.map((m) => ({ valor: m.id, texto: m.especialidad ? `${m.nombre} · ${m.especialidad}` : m.nombre }))} />
        <div className="rejilla">
          <Campo etiqueta="Fecha y hora *" type="datetime-local" min={ahoraEntrada()} step="300"
            value={datos.fechaHora} onChange={cambiar('fechaHora')} error={errores.fechaHora} />
          {conDuracion(institucion) && (
            <Campo etiqueta="Duración (min)" type="number" min="5" max="480" step="5"
              value={datos.duracionMin} onChange={cambiar('duracionMin')} error={errores.duracionMin} />
          )}
        </div>
        <Campo etiqueta="Motivo" value={datos.motivo} onChange={cambiar('motivo')} error={errores.motivo} />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Agendar" />
      </form>
    </Dialogo>
  );
}

export function DialogoReprogramar({ cita, institucion, onCerrar, onListo }) {
  const [datos, setDatos] = useState({ fechaHora: aEntrada(cita.fechaHora), duracionMin: String(cita.duracionMin ?? 30) });
  const { error, errores, enviando, enviar } = useEnvio(() => api.reprogramarCita(cita.id, {
    fechaHora: datos.fechaHora || null,
    duracionMin: conDuracion(institucion) ? Number(datos.duracionMin) : null,
  }), onListo);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  return (
    <Dialogo titulo="Reprogramar cita" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>{cita.medico.nombre} · antes: {fechaHora(cita.fechaHora)}</p>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Nueva fecha y hora *" type="datetime-local" min={ahoraEntrada()} step="300"
            value={datos.fechaHora} onChange={cambiar('fechaHora')} error={errores.fechaHora} />
          {conDuracion(institucion) && (
            <Campo etiqueta="Duración (min)" type="number" min="5" max="480" step="5"
              value={datos.duracionMin} onChange={cambiar('duracionMin')} error={errores.duracionMin} />
          )}
        </div>
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Reprogramar" />
      </form>
    </Dialogo>
  );
}

export function DialogoCancelarCita({ cita, onCerrar, onListo }) {
  const { error, enviando, enviar } = useEnvio(() => api.cancelarCita(cita.id), onListo);
  return (
    <Dialogo titulo="Cancelar cita" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar}>
        <p>¿Cancelar la cita del <strong>{fechaHora(cita.fechaHora)}</strong> con {cita.medico.nombre}?</p>
        <Alerta>{error?.message}</Alerta>
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Cancelar cita" peligro />
      </form>
    </Dialogo>
  );
}
