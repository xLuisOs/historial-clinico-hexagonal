import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { IconoAtras } from '../componentes/Iconos.jsx';
import { Alerta, Cargando } from '../componentes/ui.jsx';
import { fecha } from '../formato.js';

// Fecha local del navegador en 'AAAA-MM-DD' (no en UTC).
const aTexto = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = () => aTexto(new Date());
const moverDia = (texto, dias) => {
  const [a, m, d] = texto.split('-').map(Number);
  return aTexto(new Date(a, m - 1, d + dias));
};

const ESTADO = {
  programada: ['etiqueta', 'Programada'],
  confirmada: ['etiqueta', 'Confirmada'],
  atendida: ['etiqueta etiqueta-exito', 'Atendida'],
  cancelada: ['etiqueta etiqueta-gris', 'Cancelada'],
  no_asistio: ['etiqueta etiqueta-aviso', 'No asistió'],
};
const PENDIENTE = ['programada', 'confirmada'];

/** Citas del médico que inició sesión, día por día. */
export function Agenda() {
  const [dia, setDia] = useState(hoy);
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    setCitas(null);
    api.agenda(dia)
      .then((r) => { if (vigente) { setCitas(r); setError(null); } })
      .catch((e) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [dia]);

  const esHoy = dia === hoy();
  const pendientes = citas?.filter((c) => PENDIENTE.includes(c.estado)).length ?? 0;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>{esHoy ? 'Mis citas de hoy' : 'Mis citas'}</h1>
          <p>
            {fecha(dia)}
            {citas && ` · ${citas.length} ${citas.length === 1 ? 'cita' : 'citas'}, ${pendientes} por atender`}
          </p>
        </div>
        <div className="acciones" style={{ alignItems: 'center' }}>
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
        {citas?.length === 0 && <p className="vacio">No tienes citas este día.</p>}
        {citas?.length > 0 && (
          <div className="lista-pacientes">
            {citas.map((c) => {
              const [clase, texto] = ESTADO[c.estado] ?? ['etiqueta etiqueta-gris', c.estado];
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
                    {PENDIENTE.includes(c.estado) && (
                      <Link to={`/pacientes/${c.paciente.id}/consulta?cita=${encodeURIComponent(c.id)}`} className="boton boton-primario boton-chico">
                        Atender
                      </Link>
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
