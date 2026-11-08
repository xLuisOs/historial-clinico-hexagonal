import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconoBuscar } from '../componentes/Iconos.jsx';
import { Alerta, Cargando } from '../componentes/ui.jsx';
import { useSesion } from '../sesion.jsx';

const iniciales = (nombre) => nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Médicos activos de la institución, filtrables por especialidad o nombre. */
export function Medicos() {
  const { usuario } = useSesion();
  const [medicos, setMedicos] = useState(null);
  const [error, setError] = useState(null);
  const [especialidad, setEspecialidad] = useState('');
  const [texto, setTexto] = useState('');

  useEffect(() => { api.medicos().then(setMedicos).catch((e) => setError(e.message)); }, []);

  const titulo = usuario.institucion === 'odontologica' ? 'Odontólogos' : 'Médicos';
  const especialidades = [...new Set((medicos ?? []).map((m) => m.especialidad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const visibles = (medicos ?? [])
    .filter((m) => !especialidad || m.especialidad === especialidad)
    .filter((m) => !texto || sinTildes(m.nombre).includes(sinTildes(texto)));

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>{titulo}</h1>
          <p>Personal activo de {usuario.institucionNombre}{medicos ? ` · ${medicos.length} en total` : ''}.</p>
        </div>
      </div>

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
          {visibles.map((m) => (
            <div key={m.id} className="tarjeta-paciente">
              <span className="avatar">{iniciales(m.nombre)}</span>
              <span><strong>{m.nombre}</strong></span>
              <span>{m.especialidad && <span className="etiqueta">{m.especialidad}</span>}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
