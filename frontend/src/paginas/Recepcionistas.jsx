// Recepcionistas de la institución (solo admin): alta con su cuenta, edición,
// contraseña y desactivación. Cada recepcionista entra con su propia cuenta,
// así se sabe quién agendó, cobró o facturó.

import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconoBuscar, IconoMas } from '../componentes/Iconos.jsx';
import { Alerta, Campo, CampoCorreo, Cargando, correoCompleto, Dialogo, erroresDe } from '../componentes/ui.jsx';
import { DOMINIO_INSTITUCION } from '../formato.js';
import { useSesion } from '../sesion.jsx';

const iniciales = (nombre) => nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Envía el formulario y deja el error del backend a la vista. */
function useEnvio(accion, onListo) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e?.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      onListo(await accion());
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
    <button className={`boton ${peligro ? 'boton-peligro' : 'boton-primario'}`} disabled={enviando}>{enviando ? 'Guardando…' : texto}</button>
  </footer>
);

function DialogoNueva({ institucion, onCerrar, onListo }) {
  const [datos, setDatos] = useState({ nombres: '', apellidos: '', telefono: '', correo: '', password: '' });
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const { error, errores, enviando, enviar } = useEnvio(() => {
    const { password, correo, ...resto } = datos;
    return api.registrarRecepcionista({
      ...Object.fromEntries(Object.entries(resto).map(([k, v]) => [k, v.trim() || null])),
      correo: correoCompleto(correo, DOMINIO_INSTITUCION[institucion]),
      password,
    });
  }, onListo);

  return (
    <Dialogo titulo="Nueva recepcionista" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Nombres *" value={datos.nombres} onChange={cambiar('nombres')} error={errores.nombres} />
          <Campo etiqueta="Apellidos *" value={datos.apellidos} onChange={cambiar('apellidos')} error={errores.apellidos} />
          <Campo etiqueta="Teléfono" type="tel" inputMode="numeric" maxLength={9} placeholder="5555-1234" value={datos.telefono} onChange={cambiar('telefono')} error={errores.telefono} />
        </div>
        <h4 style={{ margin: '4px 0 0' }}>Acceso al sistema</h4>
        <div className="rejilla">
          <CampoCorreo etiqueta="Correo *" dominio={DOMINIO_INSTITUCION[institucion]}
            value={datos.correo} onChange={(correo) => setDatos({ ...datos, correo })} error={errores.correo} />
          <Campo etiqueta="Contraseña inicial *" type="password" autoComplete="new-password" placeholder="8 o más, con letras y números"
            value={datos.password} onChange={cambiar('password')} error={errores.password} />
        </div>
        <small style={{ color: 'var(--tinta-suave)' }}>Se crea su usuario con rol de recepción. Entrégale la contraseña en persona.</small>
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Registrar" />
      </form>
    </Dialogo>
  );
}

function DialogoEditar({ recepcionista, onCerrar, onListo }) {
  const [datos, setDatos] = useState({
    nombres: recepcionista.nombres ?? '', apellidos: recepcionista.apellidos ?? '', telefono: recepcionista.telefono ?? '',
  });
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  // Solo se manda lo que cambió.
  const cambios = Object.fromEntries(Object.entries(datos)
    .filter(([k, v]) => v.trim() !== (recepcionista[k] ?? ''))
    .map(([k, v]) => [k, v.trim() || null]));
  const { error, errores, enviando, enviar } = useEnvio(
    () => (Object.keys(cambios).length ? api.actualizarRecepcionista(recepcionista.id, cambios) : Promise.resolve(null)),
    (r) => (r ? onListo(r) : onCerrar()),
  );

  return (
    <Dialogo titulo={`Editar a ${recepcionista.nombre}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Nombres *" value={datos.nombres} onChange={cambiar('nombres')} error={errores.nombres} />
          <Campo etiqueta="Apellidos *" value={datos.apellidos} onChange={cambiar('apellidos')} error={errores.apellidos} />
          <Campo etiqueta="Teléfono" type="tel" inputMode="numeric" maxLength={9} placeholder="5555-1234" value={datos.telefono} onChange={cambiar('telefono')} error={errores.telefono} />
        </div>
        {recepcionista.correo && (
          <small style={{ color: 'var(--tinta-suave)' }}>Inicia sesión con {recepcionista.correo}. El correo no se cambia: es su cuenta.</small>
        )}
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Guardar cambios" />
      </form>
    </Dialogo>
  );
}

function DialogoPassword({ recepcionista, onCerrar, onListo }) {
  const [password, setPassword] = useState('');
  const { error, errores, enviando, enviar } = useEnvio(
    () => api.restablecerPasswordRecepcionista(recepcionista.id, { password }), onListo,
  );
  return (
    <Dialogo titulo="Restablecer contraseña" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)', margin: 0 }}>{recepcionista.nombre} entrará con esta contraseña ({recepcionista.correo}).</p>
        <Alerta>{error?.message}</Alerta>
        <Campo etiqueta="Nueva contraseña *" type="password" autoComplete="new-password" placeholder="8 o más, con letras y números"
          value={password} onChange={(e) => setPassword(e.target.value)} error={errores.password} />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Restablecer" />
      </form>
    </Dialogo>
  );
}

function DialogoEstado({ recepcionista, onCerrar, onListo }) {
  const desactivar = recepcionista.activo;
  const { error, enviando, enviar } = useEnvio(
    () => api.cambiarEstadoRecepcionista(recepcionista.id, { activo: !desactivar }), onListo,
  );
  return (
    <Dialogo titulo={desactivar ? `Desactivar a ${recepcionista.nombre}` : `Reactivar a ${recepcionista.nombre}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar}>
        <p style={{ margin: 0 }}>
          {desactivar
            ? 'Ya no podrá iniciar sesión, y si tiene una sesión abierta deja de servir. Lo que registró se conserva.'
            : 'Puede volver a iniciar sesión con su correo y su contraseña.'}
        </p>
        <Alerta>{error?.message}</Alerta>
        <Pie onCerrar={onCerrar} enviando={enviando} texto={desactivar ? 'Desactivar' : 'Reactivar'} peligro={desactivar} />
      </form>
    </Dialogo>
  );
}

export function Recepcionistas() {
  const { usuario } = useSesion();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState('');
  const [dialogo, setDialogo] = useState(null); // { tipo, recepcionista? }
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(() => {
    api.recepcionistas().then(setLista).catch((e) => setError(e.message));
  }, []);
  useEffect(cargar, [cargar]);

  const terminar = (mensaje) => { setDialogo(null); setAviso(mensaje); cargar(); };
  const cerrar = () => setDialogo(null);
  const visibles = (lista ?? []).filter((r) => !texto || sinTildes(r.nombre).includes(sinTildes(texto)));
  const activas = (lista ?? []).filter((r) => r.activo).length;
  const inactivas = (lista ?? []).length - activas;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Recepcionistas</h1>
          <p>
            Personal de recepción de {usuario.institucionNombre}
            {lista ? ` · ${activas} ${activas === 1 ? 'activa' : 'activas'}` : ''}
            {inactivas > 0 ? `, ${inactivas} ${inactivas === 1 ? 'inactiva' : 'inactivas'}` : ''}.
          </p>
        </div>
        <button type="button" className="boton boton-primario" onClick={() => setDialogo({ tipo: 'nueva' })}>
          <IconoMas tam={18} /> Nueva recepcionista
        </button>
      </div>

      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}

      <section className="panel vidrio" style={{ display: 'grid', gap: 18 }}>
        <div className="buscador">
          <div className="entrada">
            <IconoBuscar tam={18} />
            <input type="search" placeholder="Buscar por nombre" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar recepcionista" />
          </div>
        </div>
        <Alerta>{error}</Alerta>
        {!lista && !error && <Cargando />}
        {lista && visibles.length === 0 && <p className="vacio">{lista.length === 0 ? 'Todavía no hay recepcionistas.' : 'Nadie coincide con la búsqueda.'}</p>}
        <div className="lista-pacientes">
          {visibles.map((r) => (
            <div key={r.id} className={`tarjeta-paciente fila-medico${r.activo ? '' : ' inactivo'}`}>
              <span className="avatar">{iniciales(r.nombre)}</span>
              <span>
                <strong>{r.nombre}</strong>
                <br />
                <small>{[r.correo, r.telefono].filter(Boolean).join(' · ') || 'Sin cuenta'}</small>
              </span>
              <span className="acciones">
                {!r.activo && <span className="etiqueta etiqueta-gris">Inactiva</span>}
                <button type="button" className="boton boton-secundario boton-chico" onClick={() => setDialogo({ tipo: 'editar', recepcionista: r })}>Editar</button>
                {r.correo && r.activo && (
                  <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setDialogo({ tipo: 'password', recepcionista: r })}>Contraseña</button>
                )}
                <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setDialogo({ tipo: 'estado', recepcionista: r })}>
                  {r.activo ? 'Desactivar' : 'Reactivar'}
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      {dialogo?.tipo === 'nueva' && (
        <DialogoNueva institucion={usuario.institucion} onCerrar={cerrar}
          onListo={(r) => terminar(`${r.nombre} quedó registrada y ya puede iniciar sesión con ${r.correo}.`)} />
      )}
      {dialogo?.tipo === 'editar' && (
        <DialogoEditar recepcionista={dialogo.recepcionista} onCerrar={cerrar} onListo={(r) => terminar(`Se guardaron los cambios de ${r.nombre}.`)} />
      )}
      {dialogo?.tipo === 'password' && (
        <DialogoPassword recepcionista={dialogo.recepcionista} onCerrar={cerrar}
          onListo={() => terminar(`${dialogo.recepcionista.nombre} ya puede entrar con la nueva contraseña.`)} />
      )}
      {dialogo?.tipo === 'estado' && (
        <DialogoEstado recepcionista={dialogo.recepcionista} onCerrar={cerrar}
          onListo={(r) => terminar(r.activo ? `${r.nombre} está activa de nuevo.` : `${r.nombre} quedó desactivada.`)} />
      )}
    </>
  );
}
