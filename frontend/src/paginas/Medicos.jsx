import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconoBuscar, IconoMas } from '../componentes/Iconos.jsx';
import { Alerta, Campo, Cargando, Dialogo, erroresDe } from '../componentes/ui.jsx';
import { fechaHora } from '../formato.js';
import { DialogoMedicoReferente } from '../instituciones/laboratorio.jsx';
import { useSesion } from '../sesion.jsx';

// El correo del médico nuevo debe ser del dominio de su institución: ese
// dominio es el que enruta su inicio de sesión (el backend lo valida igual).
const DOMINIO = { hospital: 'hospital.gt', odontologica: 'odonto.gt', laboratorio: 'lab.gt', pediatrico: 'pediatrico.gt' };
const ESPECIALIDAD_SUGERIDA = { odontologica: 'Odontología general', pediatrico: 'Pediatría general' };

/** Alta de un médico con su usuario (hospital, odontológica y pediátrico). */
function DialogoNuevoMedico({ institucion, onCerrar, onListo }) {
  const odonto = institucion === 'odontologica';
  const [datos, setDatos] = useState({
    nombres: '', apellidos: '', numeroColegiado: '', especialidad: ESPECIALIDAD_SUGERIDA[institucion] ?? '',
    telefono: '', correo: '', password: '',
  });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const { password, ...resto } = datos;
      const limpio = Object.fromEntries(Object.entries(resto).map(([k, v]) => [k, v.trim() || null]));
      onListo(await api.registrarMedico({ ...limpio, password }));
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={odonto ? 'Nuevo odontólogo' : 'Nuevo médico'} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Nombres *" value={datos.nombres} onChange={cambiar('nombres')} error={errores.nombres} />
          <Campo etiqueta="Apellidos *" value={datos.apellidos} onChange={cambiar('apellidos')} error={errores.apellidos} />
          <Campo etiqueta="Colegiado *" inputMode="numeric" maxLength={10} value={datos.numeroColegiado}
            onChange={cambiar('numeroColegiado')} error={errores.numeroColegiado} />
          <Campo etiqueta="Especialidad *" value={datos.especialidad} onChange={cambiar('especialidad')} error={errores.especialidad} />
          {institucion !== 'pediatrico' && (
            <Campo etiqueta="Teléfono" type="tel" value={datos.telefono} onChange={cambiar('telefono')} error={errores.telefono} />
          )}
        </div>
        <h4 style={{ margin: '4px 0 0' }}>Acceso al sistema</h4>
        <div className="rejilla">
          <Campo etiqueta="Correo *" type="email" autoComplete="off" placeholder={`nombre@${DOMINIO[institucion]}`}
            value={datos.correo} onChange={cambiar('correo')} error={errores.correo} />
          <Campo etiqueta="Contraseña inicial *" type="password" autoComplete="new-password" placeholder="8 o más, con letras y números"
            value={datos.password} onChange={cambiar('password')} error={errores.password} />
        </div>
        <small style={{ color: 'var(--tinta-suave)' }}>
          Se crea su usuario con rol de {odonto ? 'odontólogo' : 'médico'}. Entrégale la contraseña en persona.
        </small>
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}

const iniciales = (nombre) => nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Editar datos del médico. El correo no se edita: es su cuenta. */
function DialogoEditarMedico({ medico, institucion, onCerrar, onListo }) {
  const [datos, setDatos] = useState({
    nombres: medico.nombres ?? '', apellidos: medico.apellidos ?? '', numeroColegiado: medico.numeroColegiado ?? '',
    especialidad: medico.especialidad ?? '', telefono: medico.telefono ?? '',
  });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const conTelefono = institucion !== 'pediatrico';

  async function enviar(e) {
    e.preventDefault();
    // Solo se manda lo que cambió.
    const cambios = Object.fromEntries(Object.entries(datos)
      .filter(([k, v]) => (k !== 'telefono' || conTelefono) && v.trim() !== (medico[k] ?? ''))
      .map(([k, v]) => [k, v.trim() || null]));
    if (Object.keys(cambios).length === 0) return onCerrar();
    setEnviando(true);
    setError(null);
    try {
      onListo(await api.actualizarMedico(medico.id, cambios));
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={`Editar a ${medico.nombre}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Nombres *" value={datos.nombres} onChange={cambiar('nombres')} error={errores.nombres} />
          <Campo etiqueta="Apellidos *" value={datos.apellidos} onChange={cambiar('apellidos')} error={errores.apellidos} />
          <Campo etiqueta="Colegiado *" inputMode="numeric" maxLength={10} value={datos.numeroColegiado}
            onChange={cambiar('numeroColegiado')} error={errores.numeroColegiado} />
          <Campo etiqueta="Especialidad *" value={datos.especialidad} onChange={cambiar('especialidad')} error={errores.especialidad} />
          {conTelefono && <Campo etiqueta="Teléfono" type="tel" value={datos.telefono} onChange={cambiar('telefono')} error={errores.telefono} />}
        </div>
        {medico.correo && <small style={{ color: 'var(--tinta-suave)' }}>Inicia sesión con {medico.correo}. El correo no se cambia: es su cuenta.</small>}
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}

/** Cuenta para un médico que está en el catálogo pero nunca tuvo usuario. */
function DialogoCuenta({ medico, institucion, onCerrar, onListo }) {
  const [datos, setDatos] = useState({ correo: '', password: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      onListo(await api.crearCuentaMedico(medico.id, { correo: datos.correo.trim() || null, password: datos.password }));
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={`Cuenta para ${medico.nombre}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)', margin: 0 }}>
          Todavía no puede iniciar sesión. Con esta cuenta entra con su correo y la contraseña que le entregues en persona.
        </p>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Correo *" type="email" autoComplete="off" placeholder={`nombre@${DOMINIO[institucion]}`}
            value={datos.correo} onChange={cambiar('correo')} error={errores.correo} />
          <Campo etiqueta="Contraseña inicial *" type="password" autoComplete="new-password" placeholder="8 o más, con letras y números"
            value={datos.password} onChange={cambiar('password')} error={errores.password} />
        </div>
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Crear cuenta'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}

/** Nueva contraseña para un médico que olvidó la suya. */
function DialogoPassword({ medico, onCerrar, onListo }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.restablecerPasswordMedico(medico.id, { password });
      onListo();
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo="Restablecer contraseña" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)', margin: 0 }}>{medico.nombre} entrará con esta contraseña ({medico.correo}).</p>
        <Alerta>{error?.message}</Alerta>
        <Campo etiqueta="Nueva contraseña *" type="password" autoComplete="new-password" placeholder="8 o más, con letras y números"
          value={password} onChange={(e) => setPassword(e.target.value)} error={errores.password} />
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Restablecer'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}

/**
 * Desactivar o reactivar. Si tiene citas pendientes o pacientes internados a su
 * cargo, el backend no lo deja y manda la lista: se muestra para resolverla.
 */
function DialogoEstado({ medico, onCerrar, onListo }) {
  const desactivar = medico.activo;
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const citas = error?.detalles?.citas ?? [];
  const internamientos = error?.detalles?.internamientos ?? [];
  const bloqueado = citas.length > 0 || internamientos.length > 0;

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      onListo(await api.cambiarEstadoMedico(medico.id, { activo: !desactivar }));
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={desactivar ? `Desactivar a ${medico.nombre}` : `Reactivar a ${medico.nombre}`} onCerrar={onCerrar}>
      <div className="formulario">
        <p style={{ margin: 0 }}>
          {desactivar
            ? `Ya no aparecerá para agendar${medico.correo ? ' ni podrá iniciar sesión' : ''}. Sus consultas pasadas se conservan con su nombre.`
            : `Vuelve a aparecer para agendar${medico.correo ? ' y puede iniciar sesión' : ''}.`}
        </p>
        <Alerta tipo={bloqueado ? 'aviso' : 'error'}>{error?.message}</Alerta>
        {citas.length > 0 && (
          <div className="bloque">
            <h4>Citas pendientes</h4>
            <ul className="items">
              {citas.map((c) => <li key={c.id}><strong>{fechaHora(c.fechaHora)}</strong> <small>{c.paciente}</small></li>)}
            </ul>
          </div>
        )}
        {internamientos.length > 0 && (
          <div className="bloque">
            <h4>Pacientes internados a su cargo</h4>
            <ul className="items">
              {internamientos.map((i) => <li key={i.id}><strong>{i.paciente}</strong> <small>habitación {i.habitacion}</small></li>)}
            </ul>
          </div>
        )}
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          {!bloqueado && (
            <button type="button" className={`boton ${desactivar ? 'boton-peligro' : 'boton-primario'}`} disabled={enviando} onClick={confirmar}>
              {enviando ? 'Guardando…' : desactivar ? 'Desactivar' : 'Reactivar'}
            </button>
          )}
        </footer>
      </div>
    </Dialogo>
  );
}

/**
 * Médicos de la institución, filtrables por especialidad o nombre. El admin ve
 * también a los inactivos y puede darlos de alta, editarlos, restablecer su
 * contraseña y desactivarlos o reactivarlos.
 */
export function Medicos() {
  const { usuario } = useSesion();
  const [medicos, setMedicos] = useState(null);
  const [error, setError] = useState(null);
  const [especialidad, setEspecialidad] = useState('');
  const [texto, setTexto] = useState('');
  const [dialogo, setDialogo] = useState(null); // { tipo, medico? }
  const [aviso, setAviso] = useState(null);

  // En el laboratorio, los médicos son los referentes (quienes ordenan
  // exámenes): no inician sesión, así que no tienen contraseña.
  const laboratorio = usuario.institucion === 'laboratorio';
  const admin = usuario.rol === 'admin';

  const cargar = useCallback(() => {
    (admin ? api.personal() : api.medicos()).then(setMedicos).catch((e) => setError(e.message));
  }, [admin]);
  useEffect(cargar, [cargar]);

  const terminar = (mensaje) => { setDialogo(null); setAviso(mensaje); cargar(); };

  const titulo = usuario.institucion === 'odontologica' ? 'Odontólogos' : laboratorio ? 'Médicos referentes' : 'Médicos';
  const especialidades = [...new Set((medicos ?? []).map((m) => m.especialidad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const visibles = (medicos ?? [])
    .filter((m) => !especialidad || m.especialidad === especialidad)
    .filter((m) => !texto || sinTildes(m.nombre).includes(sinTildes(texto)));
  const activos = (medicos ?? []).filter((m) => m.activo !== false).length;
  const inactivos = (medicos ?? []).length - activos;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>{titulo}</h1>
          <p>
            {laboratorio ? 'Médicos que ordenan exámenes al' : 'Personal de'} {usuario.institucionNombre}
            {medicos ? ` · ${activos} ${activos === 1 ? 'activo' : 'activos'}` : ''}
            {inactivos > 0 ? `, ${inactivos} ${inactivos === 1 ? 'inactivo' : 'inactivos'}` : ''}.
          </p>
        </div>
        {admin && (
          <button type="button" className="boton boton-primario" onClick={() => setDialogo({ tipo: 'nuevo' })}>
            <IconoMas tam={18} /> {usuario.institucion === 'odontologica' ? 'Nuevo odontólogo' : laboratorio ? 'Nuevo médico referente' : 'Nuevo médico'}
          </button>
        )}
      </div>

      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}

      <section className="panel vidrio" style={{ display: 'grid', gap: 18 }}>
        <div className="buscador">
          <div className="entrada">
            <IconoBuscar tam={18} />
            <input type="search" placeholder="Buscar por nombre" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar médico" />
          </div>
          {especialidades.length > 1 && (
            <select className="selector-dia" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} aria-label="Especialidad">
              <option value="">Todas las especialidades</option>
              {especialidades.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
        </div>
        <Alerta>{error}</Alerta>
        {!medicos && !error && <Cargando />}
        {medicos && visibles.length === 0 && <p className="vacio">Nadie coincide con el filtro.</p>}
        <div className="lista-pacientes">
          {visibles.map((m) => (admin ? (
            <div key={m.id} className={`tarjeta-paciente fila-medico${m.activo ? '' : ' inactivo'}`}>
              <span className="avatar">{iniciales(m.nombre)}</span>
              <span>
                <strong>{m.nombre}</strong>
                <br />
                <small>{[m.especialidad, m.numeroColegiado && `col. ${m.numeroColegiado}`, m.correo].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="acciones">
                {!m.activo && <span className="etiqueta etiqueta-gris">Inactivo</span>}
                <button type="button" className="boton boton-secundario boton-chico" onClick={() => setDialogo({ tipo: 'editar', medico: m })}>Editar</button>
                {m.correo && m.activo && (
                  <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setDialogo({ tipo: 'password', medico: m })}>Contraseña</button>
                )}
                {!m.correo && m.activo && !laboratorio && (
                  <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setDialogo({ tipo: 'cuenta', medico: m })}>Crear cuenta</button>
                )}
                <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setDialogo({ tipo: 'estado', medico: m })}>
                  {m.activo ? 'Desactivar' : 'Reactivar'}
                </button>
              </span>
            </div>
          ) : (
            <div key={m.id} className="tarjeta-paciente">
              <span className="avatar">{iniciales(m.nombre)}</span>
              <span><strong>{m.nombre}</strong></span>
              <span>{m.especialidad && <span className="etiqueta">{m.especialidad}</span>}</span>
            </div>
          )))}
        </div>
      </section>

      {dialogo?.tipo === 'nuevo' && (laboratorio
        ? <DialogoMedicoReferente onCerrar={() => setDialogo(null)} onListo={(m) => terminar(`${m.nombre} quedó registrado como médico referente.`)} />
        : <DialogoNuevoMedico institucion={usuario.institucion} onCerrar={() => setDialogo(null)}
            onListo={(m) => terminar(`${m.nombre} quedó registrado y ya puede iniciar sesión con ${m.correo}.`)} />)}
      {dialogo?.tipo === 'editar' && (
        <DialogoEditarMedico medico={dialogo.medico} institucion={usuario.institucion} onCerrar={() => setDialogo(null)}
          onListo={(m) => terminar(`Se guardaron los cambios de ${m.nombre}.`)} />
      )}
      {dialogo?.tipo === 'cuenta' && (
        <DialogoCuenta medico={dialogo.medico} institucion={usuario.institucion} onCerrar={() => setDialogo(null)}
          onListo={(m) => terminar(`${m.nombre} ya puede iniciar sesión con ${m.correo}.`)} />
      )}
      {dialogo?.tipo === 'password' && (
        <DialogoPassword medico={dialogo.medico} onCerrar={() => setDialogo(null)}
          onListo={() => terminar(`${dialogo.medico.nombre} ya puede entrar con la nueva contraseña.`)} />
      )}
      {dialogo?.tipo === 'estado' && (
        <DialogoEstado medico={dialogo.medico} onCerrar={() => setDialogo(null)}
          onListo={(m) => terminar(m.activo ? `${m.nombre} está activo de nuevo.` : `${m.nombre} quedó desactivado.`)} />
      )}
    </>
  );
}
