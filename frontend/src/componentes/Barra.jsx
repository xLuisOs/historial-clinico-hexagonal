import { Link, NavLink } from 'react-router-dom';
import { nombreRol, puede, useSesion } from '../sesion.jsx';
import { IconoCruz, IconoSalir } from './Iconos.jsx';

/** Barra flotante de vidrio, igual para las cuatro instituciones. */
export function Barra() {
  const { usuario, cerrar } = useSesion();
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
        <NavLink to="/medicos">{usuario.institucion === 'odontologica' ? 'Odontólogos' : 'Médicos'}</NavLink>
        {usuario.rol === 'admin' && <NavLink to="/recepcionistas">Recepcionistas</NavLink>}
        {usuario.rol === 'admin' && <NavLink to="/catalogos">Catálogos</NavLink>}
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
