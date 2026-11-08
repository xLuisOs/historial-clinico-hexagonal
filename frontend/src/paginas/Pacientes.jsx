import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { IconoBuscar, IconoMas } from '../componentes/Iconos.jsx';
import { Alerta, Cargando, iniciales } from '../componentes/ui.jsx';
import { edad, nombreCompleto, SEXO } from '../formato.js';
import { puede, useSesion } from '../sesion.jsx';

export function Pacientes() {
  const { usuario } = useSesion();
  const [texto, setTexto] = useState('');
  const [archivados, setArchivados] = useState(false);
  const [pacientes, setPacientes] = useState(null);
  const [error, setError] = useState(null);

  // Busca 300 ms después de la última tecla, para no consultar en cada letra.
  useEffect(() => {
    let vigente = true;
    const espera = setTimeout(() => {
      api.buscarPacientes(texto.trim(), archivados)
        .then((r) => { if (vigente) { setPacientes(r); setError(null); } })
        .catch((e) => { if (vigente) setError(e.message); });
    }, 300);
    return () => { vigente = false; clearTimeout(espera); };
  }, [texto, archivados]);

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Pacientes</h1>
          <p>Busca por nombre, apellido o número de documento.</p>
        </div>
        {puede(usuario, 'registrarPaciente') && (
          <Link to="/pacientes/nuevo" className="boton boton-primario"><IconoMas tam={18} /> Nuevo paciente</Link>
        )}
      </div>

      <section className="panel vidrio" style={{ display: 'grid', gap: 18 }}>
        <div className="buscador">
          <div className="entrada">
            <IconoBuscar tam={18} />
            <input type="search" placeholder="Ej. López o 1234567890101" value={texto}
              onChange={(e) => setTexto(e.target.value)} aria-label="Buscar paciente" autoFocus />
          </div>
          <label className="check">
            <input type="checkbox" checked={archivados} onChange={(e) => setArchivados(e.target.checked)} />
            Incluir archivados
          </label>
        </div>

        <Alerta>{error}</Alerta>
        {!pacientes && !error && <Cargando />}
        {pacientes?.length === 0 && (
          <p className="vacio">No hay pacientes que coincidan con la búsqueda.</p>
        )}
        {pacientes?.length > 0 && (
          <div className="lista-pacientes">
            {pacientes.map((p) => (
              <Link key={p.id} to={`/pacientes/${p.id}`} className="tarjeta-paciente">
                <span className="avatar">{iniciales(p)}</span>
                <span>
                  <strong>{nombreCompleto(p)}</strong>
                  <br />
                  <small>
                    {[edad(p.fechaNacimiento), SEXO[p.sexo], p.documento && `Doc. ${p.documento}`].filter(Boolean).join(' · ')}
                  </small>
                </span>
                <span>
                  {p.estado.activo
                    ? <span className="etiqueta etiqueta-exito">Activo</span>
                    : <span className="etiqueta etiqueta-gris">Archivado</span>}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
