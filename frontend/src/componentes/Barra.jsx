import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { nombreRol, puede, useSesion } from '../sesion.jsx';
import { IconoCruz, IconoSalir } from './Iconos.jsx';

/**
 * Menú "Administración" del admin: personal, catálogos y reportes en un solo
 * lugar, para que la barra no se sature. Se cierra al elegir, con Escape o al
 * hacer clic afuera.
 */
function MenuAdministracion({ usuario }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const { pathname } = useLocation();
  const enlaces = [
    ['/medicos', usuario.institucion === 'odontologica' ? 'Odontólogos' : 'Médicos'],
    ['/recepcionistas', 'Recepcionistas'],
    ['/catalogos', 'Catálogos'],
    ['/reportes', 'Reportes'],
  ];
  const activo = enlaces.some(([ruta]) => pathname.startsWith(ruta));

  useEffect(() => { setAbierto(false); }, [pathname]);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    const escape = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', escape); };
  }, [abierto]);

  return (
    <div className={`menu-admin${abierto ? ' abierto' : ''}`} ref={caja}>
      <button type="button" className={activo ? 'active' : undefined} aria-expanded={abierto} aria-haspopup="true"
        onClick={() => setAbierto((a) => !a)}>
        Administración <span aria-hidden="true">▾</span>
      </button>
      {/* Siempre en el DOM: en pantallas angostas los enlaces van en la misma fila del menú. */}
      <div className="menu-admin-lista vidrio" role="menu">
        {enlaces.map(([ruta, texto]) => <NavLink key={ruta} to={ruta} role="menuitem">{texto}</NavLink>)}
      </div>
    </div>
  );
}

/** Barra flotante de vidrio, igual para las cuatro instituciones. */
export function Barra() {
  const { usuario, cerrar } = useSesion();
  const admin = usuario.rol === 'admin';
  return (
    <header className="barra">
      <Link to="/" className="marca">
        <span className="marca-icono"><IconoCruz tam={18} /></span>
        <span>
          <strong>Historial Clínico</strong>
          <small>{usuario.institucionNombre}</small>
        </span>
      </Link>
      <nav aria-label="Principal">
        {usuario.institucion !== 'laboratorio' && (puede(usuario, 'atender') || puede(usuario, 'agendar')) && (
          <NavLink to="/agenda">{puede(usuario, 'atender') ? 'Mis citas de hoy' : 'Agenda'}</NavLink>
        )}
        <NavLink to="/" end>Pacientes</NavLink>
        {puede(usuario, 'registrarPaciente') && <NavLink to="/pacientes/nuevo">Nuevo paciente</NavLink>}
        {admin
          ? <MenuAdministracion usuario={usuario} />
          : <NavLink to="/medicos">{usuario.institucion === 'odontologica' ? 'Odontólogos' : 'Médicos'}</NavLink>}
      </nav>
      <div className="barra-usuario">
        <NavLink to="/perfil" className="chip-usuario" title="Mi perfil" aria-label={`Mi perfil: ${usuario.nombre}`}>
          <strong>{usuario.nombre}</strong>
          <small>{nombreRol(usuario)}</small>
          <span className="chip-inicial" aria-hidden="true">
            {usuario.nombre.split(' ').filter((p) => p && !p.endsWith('.')).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
          </span>
        </NavLink>
        <button type="button" className="boton boton-secundario boton-chico" onClick={cerrar}>
          <IconoSalir tam={16} /> Salir
        </button>
      </div>
    </header>
  );
}
