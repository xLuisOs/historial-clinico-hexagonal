import { Link, NavLink } from 'react-router-dom';
import { NOMBRE_ROL, puede, useSesion } from '../sesion.jsx';
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
        <div className="chip-usuario">
          <strong>{usuario.nombre}</strong>
          <small>{NOMBRE_ROL[usuario.rol] ?? usuario.rol}</small>
        </div>
        <button type="button" className="boton boton-secundario boton-chico" onClick={cerrar}>
          <IconoSalir tam={16} /> Salir
        </button>
      </div>
    </header>
  );
}
