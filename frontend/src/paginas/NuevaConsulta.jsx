import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  DIAGNOSTICO, EditorDiagnosticos, EditorReceta, ITEM_RECETA, prepararDiagnostico, prepararItems,
} from '../componentes/EditoresClinicos.jsx';
import { IconoAtras } from '../componentes/Iconos.jsx';
import { Alerta, Campo, Cargando, erroresDe, Selector } from '../componentes/ui.jsx';
import { fechaHora, nombreCompleto } from '../formato.js';
import { vistaDe } from '../instituciones/index.js';
import { puede, useSesion } from '../sesion.jsx';

export function NuevaConsulta() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const vista = vistaDe(usuario.institucion);

  const [historial, setHistorial] = useState(null);
  const [citas, setCitas] = useState([]);
  const [citaId, setCitaId] = useState(parametros.get('cita') ?? '');
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [diagnosticos, setDiagnosticos] = useState([{ ...DIAGNOSTICO }]);
  const [especificos, setEspecificos] = useState(vista.datosIniciales);
  const [conReceta, setConReceta] = useState(false);
  const [indicaciones, setIndicaciones] = useState('');
  const [items, setItems] = useState([{ ...ITEM_RECETA }]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);

  useEffect(() => { api.historial(id).then(setHistorial).catch(setError); }, [id]);
  // Citas pendientes del paciente desde hoy (incluye las de hoy cuya hora ya pasó).
  useEffect(() => {
    if (usuario.institucion === 'laboratorio') return;
    api.citasDelPaciente(id).then(setCitas).catch(() => {});
  }, [id, usuario]);

  if (!puede(usuario, 'atender')) {
    return <Alerta>Solo el personal médico puede registrar consultas.</Alerta>;
  }
  if (!historial) return error ? <Alerta>{error.message}</Alerta> : <Cargando />;

  const { CamposConsulta } = vista;

  async function guardar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.registrarConsulta(id, {
        citaId: citaId || null,
        motivo: motivo || null,
        observaciones: observaciones || null,
        diagnosticos: diagnosticos.map(prepararDiagnostico),
        datosEspecificos: vista.preparar(especificos),
        receta: conReceta ? { indicaciones: indicaciones || null, items: prepararItems(items) } : null,
      });
      navegar(`/pacientes/${id}`);
    } catch (err) {
      setError(err);
      setEnviando(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <Link to={`/pacientes/${id}`} className="volver"><IconoAtras tam={16} /> {nombreCompleto(historial.paciente)}</Link>
          <h1 style={{ marginTop: 8 }}>Nueva consulta</h1>
          <p>Atiende: {usuario.nombre}. Todo se guarda junto o no se guarda nada.</p>
        </div>
      </div>

      <form className="panel vidrio formulario" onSubmit={guardar} noValidate>
        <Alerta>{error?.message}</Alerta>

        <section className="seccion-form">
          <header><h2>Atención</h2></header>
          <div className="rejilla">
            {citas.length > 0 && (
              <Selector etiqueta="Cita que se atiende" value={citaId} onChange={(e) => setCitaId(e.target.value)}
                vacio="Sin cita previa" error={errores.citaId}
                opciones={citas.map((c) => ({ valor: c.id, texto: `${fechaHora(c.fechaHora)} · ${c.motivo ?? 'sin motivo'}` }))} />
            )}
            <Campo etiqueta="Motivo de la consulta" value={motivo} onChange={(e) => setMotivo(e.target.value)}
              error={errores.motivo} placeholder={citaId ? 'Si se deja vacío, se usa el de la cita' : ''} />
          </div>
          {vista.conObservaciones && (
            <Campo etiqueta="Observaciones" error={errores.observaciones}>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </Campo>
          )}
        </section>

        <EditorDiagnosticos lista={diagnosticos} onChange={setDiagnosticos} errores={errores} />

        <CamposConsulta valor={especificos} onChange={setEspecificos} errores={errores} />

        <section className="seccion-form">
          <header>
            <div>
              <h2>Receta</h2>
              <p>Opcional. También se puede recetar después, desde el historial.</p>
            </div>
            <label className="check">
              <input type="checkbox" checked={conReceta} onChange={(e) => setConReceta(e.target.checked)} />
              Emitir receta
            </label>
          </header>
          {conReceta && (
            <>
              <Campo etiqueta="Indicaciones generales" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)}
                error={errores['receta.indicaciones']} />
              <EditorReceta items={items} onChange={setItems} errores={errores} prefijo="receta.items" />
            </>
          )}
        </section>

        <div className="acciones" style={{ justifyContent: 'flex-end' }}>
          <Link to={`/pacientes/${id}`} className="boton boton-secundario">Cancelar</Link>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar consulta'}</button>
        </div>
      </form>
    </>
  );
}
