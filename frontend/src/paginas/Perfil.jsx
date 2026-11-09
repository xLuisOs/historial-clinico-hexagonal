// Mi perfil: los datos de quien inició sesión y el cambio de su contraseña.
// El admin entrega la contraseña inicial en persona; aquí cada quien la cambia
// por una que solo conozca él.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Cargando, erroresDe } from '../componentes/ui.jsx';
import { nombreRol, useSesion } from '../sesion.jsx';

const iniciales = (nombre) => String(nombre ?? '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const Dato = ({ titulo, children }) => (children ? <div className="dato"><small>{titulo}</small><span>{children}</span></div> : null);

function CambiarPassword() {
  const [datos, setDatos] = useState({ actual: '', nueva: '', confirmar: '' });
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);
  const cambiar = (campo) => (e) => { setDatos({ ...datos, [campo]: e.target.value }); setListo(false); };

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    if (datos.nueva !== datos.confirmar) {
      setError({ message: 'Datos inválidos', detalles: { confirmar: 'No coincide con la nueva contraseña' } });
      return;
    }
    setEnviando(true);
    try {
      await api.cambiarMiPassword({ actual: datos.actual, nueva: datos.nueva });
      setDatos({ actual: '', nueva: '', confirmar: '' });
      setListo(true);
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="panel vidrio">
      <h2>Cambiar contraseña</h2>
      <p style={{ color: 'var(--tinta-suave)', marginTop: 4 }}>
        Si te la dio la administración, cámbiala por una que solo tú conozcas.
      </p>
      <form className="formulario" onSubmit={enviar} noValidate style={{ marginTop: 14 }}>
        {listo && <Alerta tipo="exito">Listo: desde ahora entras con tu nueva contraseña.</Alerta>}
        {error && !Object.keys(errores).length && <Alerta>{error.message}</Alerta>}
        <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password"
          value={datos.actual} onChange={cambiar('actual')} error={errores.actual} />
        <div className="rejilla">
          <Campo etiqueta="Nueva contraseña" type="password" autoComplete="new-password" placeholder="8 o más, con letras y números"
            value={datos.nueva} onChange={cambiar('nueva')} error={errores.nueva} />
          <Campo etiqueta="Repite la nueva" type="password" autoComplete="new-password"
            value={datos.confirmar} onChange={cambiar('confirmar')} error={errores.confirmar} />
        </div>
        <footer>
          <button className="boton boton-primario" disabled={enviando || !datos.actual || !datos.nueva}>
            {enviando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </footer>
      </form>
    </section>
  );
}

export function Perfil() {
  const { usuario } = useSesion();
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.perfil().then(setPerfil).catch((e) => setError(e.message)); }, []);

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Mi perfil</h1>
          <p>Tus datos en {usuario.institucionNombre}.</p>
        </div>
      </div>
      <Alerta>{error}</Alerta>
      {!perfil && !error && <Cargando />}
      {perfil && (
        <div className="columnas">
          <section className="panel vidrio ficha">
            <span className="avatar">{iniciales(perfil.nombre)}</span>
            <div>
              <div className="ficha-titulo">
                <h2 style={{ margin: 0 }}>{perfil.nombre}</h2>
                <span className="etiqueta">{nombreRol({ ...usuario, rol: perfil.rol })}</span>
              </div>
              <div className="datos">
                <Dato titulo="Correo">{perfil.correo}</Dato>
                <Dato titulo="Institución">{usuario.institucionNombre}</Dato>
                <Dato titulo="Especialidad">{perfil.especialidad}</Dato>
                <Dato titulo="Colegiado">{perfil.numeroColegiado}</Dato>
                <Dato titulo="Teléfono">{perfil.telefono}</Dato>
              </div>
              <p style={{ color: 'var(--tinta-suave)', fontSize: '0.85rem', marginTop: 16 }}>
                Para corregir tu nombre, teléfono o especialidad, pídeselo a la administración.
              </p>
            </div>
          </section>
          <CambiarPassword />
        </div>
      )}
    </>
  );
}
