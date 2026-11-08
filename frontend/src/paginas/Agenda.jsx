import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { IconoAtras } from '../componentes/Iconos.jsx';
import { Alerta, Cargando } from '../componentes/ui.jsx';
import { fecha } from '../formato.js';
import { puede, useSesion } from '../sesion.jsx';

// Fecha local del navegador en 'AAAA-MM-DD' (no en UTC).
const aTexto = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = () => aTexto(new Date());
const ahora = () => `${hoy()} ${new Date().toTimeString().slice(0, 8)}`;
const moverDia = (texto, dias) => {
  const [a, m, d] = texto.split('-').map(Number);
  return aTexto(new Date(a, m - 1, d + dias));
};

export const ESTADO_CITA = {
  programada: ['etiqueta', 'Programada'],
  confirmada: ['etiqueta', 'Confirmada'],
  atendida: ['etiqueta etiqueta-exito', 'Atendida'],
  cancelada: ['etiqueta etiqueta-gris', 'Cancelada'],
  no_asistio: ['etiqueta etiqueta-aviso', 'No asistió'],
};
export const PENDIENTE = ['programada', 'confirmada'];

/** La odontológica no maneja "confirmada" en su modelo. */
export const puedeConfirmar = (institucion, cita) => institucion !== 'odontologica' && cita.estado === 'programada';
/** "No asistió" solo cuando ya pasó la hora de la cita. */
export const puedeMarcarAusencia = (cita) => PENDIENTE.includes(cita.estado) && cita.fechaHora <= ahora();

/**
 * Agenda del día. El médico ve sus propias citas y las atiende; la recepción y
 * el admin eligen el médico, confirman o marcan que el paciente no asistió.
 */
export function Agenda() {
  const { usuario } = useSesion();
  const esMedico = puede(usuario, 'atender');
  const [dia, setDia] = useState(hoy);
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState('');
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (esMedico) return;
    api.medicos().then((lista) => {
      setMedicos(lista);
      setMedicoId((actual) => actual || lista[0]?.id || '');
    }).catch(() => {});
  }, [esMedico]);

  useEffect(() => {
    if (!esMedico && !medicoId) return;
    let vigente = true;
    setCitas(null);
    api.agenda(dia, esMedico ? null : medicoId)
      .then((r) => { if (vigente) { setCitas(r); setError(null); } })
      .catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [dia, medicoId, esMedico, version]);

  async function marcar(cita, estado) {
    try {
      await api.marcarEstadoCita(cita.id, estado);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  const esHoy = dia === hoy();
  const pendientes = citas?.filter((c) => PENDIENTE.includes(c.estado)).length ?? 0;
  const titulo = esMedico ? (esHoy ? 'Mis citas de hoy' : 'Mis citas') : 'Agenda';

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>{titulo}</h1>
          <p>
            {fecha(dia)}
            {citas && ` · ${citas.length} ${citas.length === 1 ? 'cita' : 'citas'}, ${pendientes} por atender`}
          </p>
        </div>
        <div className="acciones" style={{ alignItems: 'center' }}>
          {!esMedico && (
            <select className="selector-dia" value={medicoId} onChange={(e) => setMedicoId(e.target.value)} aria-label="Médico">
              {medicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          )}
          <button type="button" className="boton boton-secundario boton-chico" onClick={() => setDia(moverDia(dia, -1))} aria-label="Día anterior">
            <IconoAtras tam={16} />
          </button>
          <input type="date" className="selector-dia" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} aria-label="Día" />
          <button type="button" className="boton boton-secundario boton-chico" onClick={() => setDia(moverDia(dia, 1))} aria-label="Día siguiente">
            <IconoAtras tam={16} style={{ transform: 'scaleX(-1)' }} />
          </button>
          {!esHoy && <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setDia(hoy())}>Hoy</button>}
        </div>
      </div>

      <section className="panel vidrio">
        <Alerta>{error}</Alerta>
        {!citas && !error && <Cargando />}
        {citas?.length === 0 && <p className="vacio">No hay citas este día.</p>}
        {citas?.length > 0 && (
          <div className="lista-pacientes">
            {citas.map((c) => {
              const [clase, texto] = ESTADO_CITA[c.estado] ?? ['etiqueta etiqueta-gris', c.estado];
              return (
                <div key={c.id} className="tarjeta-paciente cita">
                  <span className="hora">
                    {c.fechaHora.slice(11, 16)}
                    {c.duracionMin && <small>{c.duracionMin} min</small>}
                  </span>
                  <span>
                    <Link to={`/pacientes/${c.paciente.id}`}><strong>{c.paciente.nombre}</strong></Link>
                    <br />
                    <small>{c.motivo ?? 'Sin motivo registrado'}</small>
                  </span>
                  <span className="acciones" style={{ alignItems: 'center' }}>
                    <span className={clase}>{texto}</span>
                    {esMedico && PENDIENTE.includes(c.estado) && (
                      <Link to={`/pacientes/${c.paciente.id}/consulta?cita=${encodeURIComponent(c.id)}`} className="boton boton-primario boton-chico">
                        Atender
                      </Link>
                    )}
                    {!esMedico && puedeConfirmar(usuario.institucion, c) && (
                      <button type="button" className="boton boton-secundario boton-chico" onClick={() => marcar(c, 'confirmada')}>Confirmar</button>
                    )}
                    {!esMedico && puedeMarcarAusencia(c) && (
                      <button type="button" className="boton boton-fantasma boton-chico" onClick={() => marcar(c, 'no_asistio')}>No asistió</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
