// Internamientos del hospital: el médico interna al paciente en una habitación
// disponible, cambia al médico a cargo, agrega tratamientos y da de alta.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { fecha, fechaHora } from '../formato.js';
import { puede } from '../sesion.jsx';

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

const Pie = ({ onCerrar, enviando, texto }) => (
  <footer>
    <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
    <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : texto}</button>
  </footer>
);

function useMedicos() {
  const [medicos, setMedicos] = useState([]);
  useEffect(() => { api.medicos().then(setMedicos).catch(() => {}); }, []);
  return medicos;
}
const opcionesMedicos = (medicos, excluir) => medicos
  .filter((m) => m.id !== excluir)
  .map((m) => ({ valor: m.id, texto: m.especialidad ? `${m.nombre} · ${m.especialidad}` : m.nombre }));

function DialogoInternar({ paciente, usuario, onCerrar, onListo }) {
  const medicos = useMedicos();
  const [habitaciones, setHabitaciones] = useState([]);
  useEffect(() => { api.habitacionesDisponibles().then(setHabitaciones).catch(() => {}); }, []);
  const [datos, setDatos] = useState({ habitacionId: '', medicoId: usuario.medicoId ?? '', motivoIngreso: '', diagnosticoIngreso: '' });
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const { error, errores, enviando, enviar } = useEnvio(() => api.internar(paciente.id, {
    habitacionId: datos.habitacionId || null,
    medicoId: datos.medicoId || null,
    motivoIngreso: datos.motivoIngreso.trim() || null,
    diagnosticoIngreso: datos.diagnosticoIngreso.trim() || null,
  }), onListo);

  return (
    <Dialogo titulo="Internar paciente" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        {habitaciones.length === 0 && <Alerta tipo="aviso">No hay habitaciones disponibles en este momento.</Alerta>}
        <Selector etiqueta="Habitación *" value={datos.habitacionId} onChange={cambiar('habitacionId')} error={errores.habitacionId}
          opciones={habitaciones.map((h) => ({ valor: h.id, texto: `${h.numero} · ${h.tipo}${h.departamento ? ` · ${h.departamento}` : ''}` }))} />
        <Selector etiqueta="Médico responsable *" value={datos.medicoId} onChange={cambiar('medicoId')} error={errores.medicoId}
          opciones={opcionesMedicos(medicos)} />
        <Campo etiqueta="Motivo de ingreso *" value={datos.motivoIngreso} onChange={cambiar('motivoIngreso')} error={errores.motivoIngreso} />
        <Campo etiqueta="Diagnóstico de ingreso" value={datos.diagnosticoIngreso} onChange={cambiar('diagnosticoIngreso')} error={errores.diagnosticoIngreso} />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Internar" />
      </form>
    </Dialogo>
  );
}

function DialogoCambioMedico({ internamiento, onCerrar, onListo }) {
  const medicos = useMedicos();
  const [datos, setDatos] = useState({ medicoId: '', motivoCambio: '' });
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const { error, errores, enviando, enviar } = useEnvio(() => api.cambiarMedicoACargo(internamiento.id, {
    medicoId: datos.medicoId || null,
    motivoCambio: datos.motivoCambio.trim() || null,
  }), onListo);

  return (
    <Dialogo titulo="Cambiar médico a cargo" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>Actualmente: {internamiento.medicoResponsable}</p>
        <Alerta>{error?.message}</Alerta>
        <Selector etiqueta="Nuevo médico a cargo *" value={datos.medicoId} onChange={cambiar('medicoId')} error={errores.medicoId}
          opciones={opcionesMedicos(medicos, internamiento.medicoResponsableId)} />
        <Campo etiqueta="Motivo del cambio *" value={datos.motivoCambio} onChange={cambiar('motivoCambio')} error={errores.motivoCambio}
          placeholder="Ej. Cambio de turno" />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Cambiar" />
      </form>
    </Dialogo>
  );
}

function DialogoTratamiento({ internamiento, onCerrar, onListo }) {
  const [datos, setDatos] = useState({ descripcion: '', fechaInicio: '', fechaFin: '', indicaciones: '' });
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const { error, errores, enviando, enviar } = useEnvio(() => api.tratamientoInternamiento(internamiento.id, {
    descripcion: datos.descripcion.trim() || null,
    fechaInicio: datos.fechaInicio || null,
    fechaFin: datos.fechaFin || null,
    indicaciones: datos.indicaciones.trim() || null,
  }), onListo);

  return (
    <Dialogo titulo="Agregar tratamiento" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <Campo etiqueta="Descripción *" value={datos.descripcion} onChange={cambiar('descripcion')} error={errores.descripcion} />
        <div className="rejilla">
          <Campo etiqueta="Inicio" type="date" value={datos.fechaInicio} onChange={cambiar('fechaInicio')} error={errores.fechaInicio} />
          <Campo etiqueta="Fin" type="date" value={datos.fechaFin} onChange={cambiar('fechaFin')} error={errores.fechaFin} />
        </div>
        <Campo etiqueta="Indicaciones" value={datos.indicaciones} onChange={cambiar('indicaciones')} error={errores.indicaciones} />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Agregar" />
      </form>
    </Dialogo>
  );
}

function DialogoAlta({ internamiento, onCerrar, onListo }) {
  const [diagnosticoAlta, setDiagnosticoAlta] = useState('');
  const { error, errores, enviando, enviar } = useEnvio(
    () => api.darDeAlta(internamiento.id, { diagnosticoAlta: diagnosticoAlta.trim() || null }),
    onListo,
  );
  return (
    <Dialogo titulo="Dar de alta" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>
          Habitación {internamiento.habitacion}, internado desde {fechaHora(internamiento.fechaIngreso)}. La habitación quedará disponible.
        </p>
        <Alerta>{error?.message}</Alerta>
        <Campo etiqueta="Diagnóstico de alta *" error={errores.diagnosticoAlta}>
          <textarea value={diagnosticoAlta} onChange={(e) => setDiagnosticoAlta(e.target.value)} />
        </Campo>
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Dar de alta" />
      </form>
    </Dialogo>
  );
}

export function PanelInternamientos({ internamientos = [], paciente, usuario, recargar }) {
  const [dialogo, setDialogo] = useState(null); // { tipo, internamiento? }
  const puedeInternar = puede(usuario, 'internar');
  const internado = internamientos.some((i) => i.estado === 'activo');
  const alListo = () => { setDialogo(null); recargar(); };
  const cerrar = () => setDialogo(null);

  if (internamientos.length === 0 && !(puedeInternar && paciente.estado.activo)) return null;

  return (
    <section className="panel vidrio">
      <div className="titulo-panel">
        <h2>Internamientos</h2>
        {puedeInternar && paciente.estado.activo && !internado && (
          <button type="button" className="boton boton-primario boton-chico" onClick={() => setDialogo({ tipo: 'internar' })}>Internar</button>
        )}
      </div>
      {internamientos.length === 0 && <p className="vacio">Sin internamientos.</p>}
      <div className="linea-tiempo">
        {internamientos.map((i) => (
          <article className="consulta" key={i.id}>
            <div className="consulta-cabecera">
              <div>
                <h3>Habitación {i.habitacion}</h3>
                <small>{fechaHora(i.fechaIngreso)}{i.fechaAlta ? ` → ${fechaHora(i.fechaAlta)}` : ''}</small>
              </div>
              <span className={`etiqueta ${i.estado === 'activo' ? 'etiqueta-aviso' : 'etiqueta-gris'}`}>
                {i.estado === 'activo' ? 'Internado' : 'Alta'}
              </span>
            </div>
            <p>{i.motivoIngreso}{i.diagnosticoIngreso ? ` · ${i.diagnosticoIngreso}` : ''}</p>
            {i.diagnosticoAlta && <p><small style={{ color: 'var(--tinta-suave)' }}>Diagnóstico de alta:</small> {i.diagnosticoAlta}</p>}
            <div className="bloque">
              <h4>Médicos a cargo</h4>
              <ul className="items">
                {i.medicosACargo.map((m, n) => (
                  <li key={n}>
                    <strong>{m.medico}</strong>
                    <small>{fechaHora(m.fechaInicio)}{m.fechaFin ? ` → ${fechaHora(m.fechaFin)}` : ' · a cargo'}{m.motivoCambio ? ` · ${m.motivoCambio}` : ''}</small>
                  </li>
                ))}
              </ul>
            </div>
            {i.tratamientos.length > 0 && (
              <div className="bloque">
                <h4>Tratamientos</h4>
                <ul className="items">
                  {i.tratamientos.map((t, n) => (
                    <li key={n}>
                      <strong>{t.descripcion}</strong>
                      <small>{fecha(t.fechaInicio)}{t.fechaFin ? ` – ${fecha(t.fechaFin)}` : ''}{t.indicaciones ? ` · ${t.indicaciones}` : ''}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {puedeInternar && i.estado === 'activo' && (
              <div className="acciones">
                <button type="button" className="boton boton-secundario boton-chico" onClick={() => setDialogo({ tipo: 'tratamiento', internamiento: i })}>+ Tratamiento</button>
                <button type="button" className="boton boton-secundario boton-chico" onClick={() => setDialogo({ tipo: 'medico', internamiento: i })}>Cambiar médico</button>
                <button type="button" className="boton boton-primario boton-chico" onClick={() => setDialogo({ tipo: 'alta', internamiento: i })}>Dar de alta</button>
              </div>
            )}
          </article>
        ))}
      </div>

      {dialogo?.tipo === 'internar' && <DialogoInternar paciente={paciente} usuario={usuario} onCerrar={cerrar} onListo={alListo} />}
      {dialogo?.tipo === 'medico' && <DialogoCambioMedico internamiento={dialogo.internamiento} onCerrar={cerrar} onListo={alListo} />}
      {dialogo?.tipo === 'tratamiento' && <DialogoTratamiento internamiento={dialogo.internamiento} onCerrar={cerrar} onListo={alListo} />}
      {dialogo?.tipo === 'alta' && <DialogoAlta internamiento={dialogo.internamiento} onCerrar={cerrar} onListo={alListo} />}
    </section>
  );
}
