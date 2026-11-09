// Antecedentes médicos del paciente (hospital y odontológica): enfermedades de
// base, cirugías, antecedentes familiares, hábitos y medicamentos que toma.
// Los ve todo el personal; los agrega el médico. En el pediátrico también hay
// antecedentes perinatales (cómo fue el nacimiento).

import { useState } from 'react';
import { api } from '../api.js';
import { IconoMas } from '../componentes/Iconos.jsx';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { fecha } from '../formato.js';
import { useSesion } from '../sesion.jsx';

// tipo → [título del grupo, nombre en el selector, ejemplo]
const TIPOS = {
  perinatal: ['Perinatales', 'Perinatal (nacimiento)', 'p. ej. Prematuro de 34 semanas, peso al nacer 2.1 kg'],
  patologico: ['Enfermedades', 'Enfermedad', 'p. ej. Diabetes mellitus tipo 2'],
  quirurgico: ['Cirugías', 'Cirugía', 'p. ej. Apendicectomía'],
  familiar: ['Familiares', 'Antecedente familiar', 'p. ej. Padre: hipertensión arterial'],
  habito: ['Hábitos', 'Hábito', 'p. ej. Fuma 10 cigarrillos al día'],
  medicamento: ['Medicamentos que toma', 'Medicamento que toma', 'p. ej. Losartán 50 mg cada 24 horas'],
};

// Tipos que solo existen en algunas instituciones (el backend valida lo mismo).
const SOLO_EN = { perinatal: ['pediatrico'] };

/** "desde 2012" para lo que sigue vigente; el año a secas para una cirugía. */
const cuando = (a) => (a.anioInicio ? (a.tipo === 'quirurgico' ? String(a.anioInicio) : `desde ${a.anioInicio}`) : null);

export function PanelAntecedentes({ antecedentes, puedeAgregar, onAgregar }) {
  const grupos = Object.keys(TIPOS)
    .map((tipo) => [tipo, antecedentes.filter((a) => a.tipo === tipo)])
    .filter(([, lista]) => lista.length > 0);

  return (
    <section className="panel vidrio">
      <div className="titulo-panel">
        <h2>Antecedentes médicos</h2>
        {puedeAgregar && (
          <button type="button" className="boton boton-secundario boton-chico" onClick={onAgregar}>
            <IconoMas tam={16} /> Antecedente
          </button>
        )}
      </div>
      {grupos.length === 0
        ? <p className="vacio">Sin antecedentes registrados.</p>
        : (
          <div className="antecedentes">
            {grupos.map(([tipo, lista]) => (
              <div key={tipo} className="bloque">
                <h4>{TIPOS[tipo][0]}</h4>
                <ul className="items">
                  {lista.map((a) => (
                    <li key={a.id} title={a.registradoPor?.nombre ? `Registró ${a.registradoPor.nombre} el ${fecha(a.fechaRegistro)}` : undefined}>
                      <span>{a.descripcion}</span>
                      {cuando(a) && <small>{cuando(a)}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

export function DialogoAntecedente({ pacienteId, onCerrar, onListo }) {
  const { usuario } = useSesion();
  const tipos = Object.entries(TIPOS).filter(([tipo]) => !SOLO_EN[tipo] || SOLO_EN[tipo].includes(usuario?.institucion));
  const [datos, setDatos] = useState({ tipo: 'patologico', descripcion: '', anioInicio: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const conAnio = !['familiar', 'perinatal'].includes(datos.tipo);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.agregarAntecedente(pacienteId, {
        tipo: datos.tipo,
        descripcion: datos.descripcion.trim() || null,
        anioInicio: conAnio && datos.anioInicio !== '' ? Number(datos.anioInicio) : null,
      });
      onListo();
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo="Agregar antecedente" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <Selector etiqueta="Tipo *" value={datos.tipo} onChange={cambiar('tipo')} vacio={null} error={errores.tipo}
          opciones={tipos.map(([valor, [, texto]]) => ({ valor, texto }))} />
        <Campo etiqueta="Descripción *" value={datos.descripcion} onChange={cambiar('descripcion')} error={errores.descripcion}
          placeholder={TIPOS[datos.tipo][2]} maxLength={300} />
        {conAnio && (
          <Campo etiqueta={datos.tipo === 'quirurgico' ? 'Año (aproximado)' : 'Desde (año aproximado)'} type="number"
            min="1900" max={new Date().getFullYear()} value={datos.anioInicio} onChange={cambiar('anioInicio')} error={errores.anioInicio} />
        )}
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Agregar'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}
