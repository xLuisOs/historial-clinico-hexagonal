// Laboratorio Clínico: la "consulta" es una ORDEN DE EXAMEN. Se elige el
// médico referente (puede no ser del laboratorio) y los exámenes del catálogo;
// cada examen trae sus propios parámetros, que cambian según el tipo.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { GraficaLinea } from '../componentes/GraficaLinea.jsx';
import { fecha } from '../formato.js';
import { puede } from '../sesion.jsx';
import { DialogoResultados, TablaResultados } from './resultados.jsx';

export const ESTADO_ORDEN = {
  pendiente: ['etiqueta-aviso', 'Pendiente'],
  en_proceso: ['etiqueta', 'En proceso'],
  completada: ['etiqueta-exito', 'Completada'],
  anulada: ['etiqueta-gris', 'Anulada'],
};
export const ESTADO_EXAMEN = {
  pendiente: ['etiqueta-gris', 'Pendiente'],
  en_proceso: ['etiqueta-aviso', 'Resultados parciales'],
  resultados_completos: ['etiqueta', 'Por validar'],
  validado: ['etiqueta-exito', 'Validado'],
};
export const Estado = ({ mapa, valor }) => {
  const [clase, texto] = mapa[valor] ?? ['etiqueta-gris', valor];
  return <span className={`etiqueta ${clase}`}>{texto}</span>;
};

const MEDICO_VACIO = { nombres: '', apellidos: '', numeroColegiado: '', especialidad: '', telefono: '', institucionProcedencia: '' };

function DialogoMedicoReferente({ onCerrar, onListo }) {
  const [datos, setDatos] = useState(MEDICO_VACIO);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    e.stopPropagation(); // el diálogo vive dentro del formulario de la orden
    setEnviando(true);
    setError(null);
    try {
      const vacioANulo = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v.trim() || null]));
      onListo(await api.registrarMedicoReferente(vacioANulo));
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo="Nuevo médico referente" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Nombres *" value={datos.nombres} onChange={cambiar('nombres')} error={errores.nombres} />
          <Campo etiqueta="Apellidos *" value={datos.apellidos} onChange={cambiar('apellidos')} error={errores.apellidos} />
          <Campo etiqueta="Colegiado *" inputMode="numeric" maxLength={10} value={datos.numeroColegiado}
            onChange={cambiar('numeroColegiado')} error={errores.numeroColegiado} />
          <Campo etiqueta="Especialidad" value={datos.especialidad} onChange={cambiar('especialidad')} error={errores.especialidad} />
          <Campo etiqueta="Teléfono" type="tel" value={datos.telefono} onChange={cambiar('telefono')} error={errores.telefono} />
          <Campo etiqueta="Institución de procedencia" value={datos.institucionProcedencia}
            onChange={cambiar('institucionProcedencia')} error={errores.institucionProcedencia} />
        </div>
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar médico'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}

function CamposConsulta({ valor, onChange, errores }) {
  const [medicos, setMedicos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [nuevoMedico, setNuevoMedico] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  useEffect(() => {
    Promise.all([api.medicos(), api.tiposExamen()])
      .then(([m, t]) => { setMedicos(m); setTipos(t); })
      .catch(setErrorCarga);
  }, []);

  const categorias = [...new Set(tipos.map((t) => t.categoria))];
  const alternar = (id) => onChange({
    ...valor,
    examenes: valor.examenes.includes(id) ? valor.examenes.filter((x) => x !== id) : [...valor.examenes, id],
  });

  return (
    <section className="seccion-form">
      <header>
        <div>
          <h2>Orden de examen</h2>
          <p>El médico que la solicita y los exámenes que incluye. Cada examen trae sus propios parámetros.</p>
        </div>
      </header>
      <Alerta>{errorCarga?.message}</Alerta>
      <div style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
        <div style={{ flex: 1 }}>
          <Selector etiqueta="Médico referente *" value={valor.medicoReferenteId}
            onChange={(e) => onChange({ ...valor, medicoReferenteId: e.target.value })}
            error={errores['datosEspecificos.medicoReferenteId']}
            opciones={medicos.map((m) => ({ valor: m.id, texto: `${m.nombre}${m.especialidad ? ` · ${m.especialidad}` : ''}` }))} />
        </div>
        <button type="button" className="boton boton-secundario" onClick={() => setNuevoMedico(true)}>+ Nuevo médico</button>
      </div>

      <div>
        <strong style={{ fontSize: '0.9rem' }}>Exámenes *</strong>
        {errores['datosEspecificos.examenes'] && <small className="error-campo"> {errores['datosEspecificos.examenes']}</small>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, marginTop: 8 }}>
          {categorias.map((cat) => (
            <fieldset key={cat} style={{ border: '1px solid rgba(15, 45, 54, 0.08)', borderRadius: 14, padding: '10px 14px', margin: 0 }}>
              <legend style={{ fontSize: '0.78rem', color: 'var(--tinta-tenue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cat}</legend>
              {tipos.filter((t) => t.categoria === cat).map((t) => (
                <label key={t.id} className="check" style={{ display: 'flex', margin: '6px 0' }}>
                  <input type="checkbox" checked={valor.examenes.includes(t.id)} onChange={() => alternar(t.id)} />
                  <span>
                    {t.nombre}
                    <br />
                    <small style={{ color: 'var(--tinta-suave)' }}>{t.muestra} · {t.parametros.length} {t.parametros.length === 1 ? 'parámetro' : 'parámetros'}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </div>

      {nuevoMedico && (
        <DialogoMedicoReferente onCerrar={() => setNuevoMedico(false)}
          onListo={(m) => {
            setMedicos([...medicos, m].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            onChange({ ...valor, medicoReferenteId: m.id });
            setNuevoMedico(false);
          }} />
      )}
    </section>
  );
}

function Examen({ examen, editable, onResultados, onValidar }) {
  // En la vista administrativa (recepción) los resultados no llegan: parametros es null.
  const conResultados = Array.isArray(examen.parametros);
  const conValor = conResultados ? examen.parametros.filter((p) => p.valor != null).length : 0;
  return (
    <div style={{ borderTop: '1px solid rgba(15, 45, 54, 0.08)', paddingTop: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{examen.nombre}</strong>
          <Estado mapa={ESTADO_EXAMEN} valor={examen.estado} />
          {conResultados && <small style={{ color: 'var(--tinta-suave)' }}>{conValor} de {examen.parametros.length}</small>}
        </span>
        {editable && examen.estado !== 'validado' && (
          <span className="acciones">
            <button type="button" className={`boton boton-chico ${examen.estado === 'resultados_completos' ? 'boton-secundario' : 'boton-primario'}`} onClick={onResultados}>
              {conValor === 0 ? 'Registrar resultados' : 'Editar resultados'}
            </button>
            {examen.estado === 'resultados_completos' && (
              <button type="button" className="boton boton-primario boton-chico" onClick={onValidar}>Validar</button>
            )}
          </span>
        )}
      </div>
      {examen.validadoPor && (
        <small style={{ color: 'var(--tinta-suave)' }}>Validado por {examen.validadoPor.nombre} el {fecha(examen.fechaValidacion)}</small>
      )}
      {conResultados && <TablaResultados examen={examen} />}
    </div>
  );
}

/** Agregar exámenes a una orden abierta: solo se ofrecen los que todavía no tiene. */
function DialogoAgregarExamenes({ ordenId, incluidos, onCerrar, onListo }) {
  const [tipos, setTipos] = useState(null);
  const [elegidos, setElegidos] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { api.tiposExamen().then(setTipos).catch(setError); }, []);
  const disponibles = (tipos ?? []).filter((t) => !incluidos.includes(t.id));
  const alternar = (id) => setElegidos(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.agregarExamenes(ordenId, { examenes: elegidos });
      onListo();
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo="Agregar exámenes" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>Cada examen se agrega con la definición vigente del catálogo (parámetros y rangos).</p>
        <Alerta>{error?.detalles?.examenes ?? error?.message}</Alerta>
        {tipos && disponibles.length === 0 && <p className="vacio">La orden ya incluye todos los exámenes del catálogo.</p>}
        {disponibles.map((t) => (
          <label key={t.id} className="check" style={{ display: 'flex' }}>
            <input type="checkbox" checked={elegidos.includes(t.id)} onChange={() => alternar(t.id)} />
            <span>
              {t.nombre} <small style={{ color: 'var(--tinta-tenue)' }}>· {t.categoria}</small>
              <br />
              <small style={{ color: 'var(--tinta-suave)' }}>{t.muestra} · {t.parametros.length} {t.parametros.length === 1 ? 'parámetro' : 'parámetros'}</small>
            </span>
          </label>
        ))}
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando || elegidos.length === 0}>
            {enviando ? 'Guardando…' : `Agregar${elegidos.length ? ` (${elegidos.length})` : ''}`}
          </button>
        </footer>
      </form>
    </Dialogo>
  );
}

/** Confirmación para acciones que no se deshacen (validar, anular). */
function DialogoConfirmar({ titulo, mensaje, texto, peligro, accion, onCerrar, onListo }) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      await accion();
      onListo();
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }
  return (
    <Dialogo titulo={titulo} onCerrar={onCerrar}>
      <div className="formulario">
        <p>{mensaje}</p>
        <Alerta>{error?.message}</Alerta>
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button type="button" className={`boton ${peligro ? 'boton-peligro' : 'boton-primario'}`} disabled={enviando} onClick={confirmar}>
            {enviando ? 'Guardando…' : texto}
          </button>
        </footer>
      </div>
    </Dialogo>
  );
}

// Cambios manuales permitidos (los mismos que TRANSICIONES_ORDEN del backend):
// "completada" no está porque la orden se completa sola al validar el último examen.
const ACCIONES_ORDEN = {
  pendiente: ['en_proceso', 'anulada'],
  en_proceso: ['anulada'],
};

function DetalleConsulta({ datos, consulta, usuario, recargar }) {
  const [capturando, setCapturando] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [agregando, setAgregando] = useState(false);
  if (!datos.numero) return null;
  const abierta = ['pendiente', 'en_proceso'].includes(datos.estado);
  const editable = abierta && puede(usuario, 'atender');
  const acciones = puede(usuario, 'gestionarOrden') ? (ACCIONES_ORDEN[datos.estado] ?? []) : [];
  const listo = () => { setCapturando(null); setConfirmando(null); setAgregando(false); recargar(); };

  const validar = (e) => setConfirmando({
    titulo: `Validar ${e.nombre}`,
    mensaje: 'Validar equivale a firmar el examen: sus resultados ya no se podrán modificar. Si es el último examen pendiente, la orden se completa.',
    texto: 'Validar examen',
    accion: () => api.validarExamen(consulta.id, e.codigo),
  });
  const cambiarEstado = (estado) => setConfirmando(estado === 'anulada' ? {
    titulo: `Anular ${datos.numero}`,
    mensaje: 'La orden queda anulada y ya no admite resultados ni exámenes nuevos. No se puede deshacer.',
    texto: 'Anular orden',
    peligro: true,
    accion: () => api.cambiarEstadoOrden(consulta.id, 'anulada'),
  } : {
    titulo: `Iniciar ${datos.numero}`,
    mensaje: 'La orden pasa a "en proceso": se tomaron las muestras y se empiezan a procesar.',
    texto: 'Iniciar proceso',
    accion: () => api.cambiarEstadoOrden(consulta.id, 'en_proceso'),
  });

  return (
    <div className="bloque">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h4 style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
          <span className="codigo">{datos.numero}</span>
          <Estado mapa={ESTADO_ORDEN} valor={datos.estado} />
        </h4>
        {(acciones.length > 0 || editable) && (
          <span className="acciones">
            {editable && (
              <button type="button" className="boton boton-secundario boton-chico" onClick={() => setAgregando(true)}>+ Exámenes</button>
            )}
            {acciones.includes('en_proceso') && (
              <button type="button" className="boton boton-secundario boton-chico" onClick={() => cambiarEstado('en_proceso')}>Iniciar proceso</button>
            )}
            {acciones.includes('anulada') && (
              <button type="button" className="boton boton-fantasma boton-chico" onClick={() => cambiarEstado('anulada')}>Anular orden</button>
            )}
          </span>
        )}
      </div>
      <ul className="items" style={{ marginTop: 8 }}>
        <li><small>Médico referente:</small> <span>{datos.medicoReferente?.nombre} (col. {datos.medicoReferente?.numeroColegiado})</span></li>
        {datos.registradaPor && <li><small>Registró:</small> <span>{datos.registradaPor.nombre}</span></li>}
      </ul>
      {datos.examenes.map((e) => (
        <Examen key={e.codigo} examen={e} editable={editable}
          onResultados={() => setCapturando(e)} onValidar={() => validar(e)} />
      ))}
      {capturando && (
        <DialogoResultados ordenId={consulta.id} examen={capturando} onCerrar={() => setCapturando(null)} onListo={listo} />
      )}
      {confirmando && <DialogoConfirmar {...confirmando} onCerrar={() => setConfirmando(null)} onListo={listo} />}
      {agregando && (
        <DialogoAgregarExamenes ordenId={consulta.id} incluidos={datos.examenes.map((e) => e.tipoExamenId)}
          onCerrar={() => setAgregando(false)} onListo={listo} />
      )}
    </div>
  );
}

/**
 * Evolución de un parámetro numérico en las órdenes del paciente (la calcula
 * MongoDB con un pipeline de agregación). Un parámetro a la vez: glucosa,
 * colesterol o leucocitos tienen escalas distintas y no comparten eje.
 */
function PanelEvolucion({ evolucion = [] }) {
  // Solo tiene sentido una tendencia con 2 o más mediciones.
  const series = evolucion.filter((s) => s.puntos.length >= 2);
  const [elegido, setElegido] = useState(null);
  if (series.length === 0) return null;
  const serie = series.find((s) => s.parametro === elegido)
    ?? series.find((s) => s.parametro === 'GLU')
    ?? series[0];

  return (
    <section className="panel vidrio">
      <h2>Evolución de resultados</h2>
      <Selector etiqueta="Parámetro" value={serie.parametro} vacio={null} onChange={(e) => setElegido(e.target.value)}
        opciones={series.map((s) => ({ valor: s.parametro, texto: `${s.nombre} (${s.puntos.length} mediciones)` }))} />
      <GraficaLinea key={serie.parametro} titulo={serie.nombre} unidad={serie.unidad} puntos={serie.puntos}
        rango={serie.refMin != null || serie.refMax != null ? { min: serie.refMin, max: serie.refMax } : null} />
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--tinta-suave)', fontSize: '0.85rem' }}>Ver como tabla</summary>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th className="numero">{serie.nombre}{serie.unidad ? ` (${serie.unidad})` : ''}</th></tr></thead>
            <tbody>
              {serie.puntos.map((p, i) => (
                <tr key={i}>
                  <td>{fecha(p.fecha)}</td>
                  <td className="numero">{p.valor}{p.fueraDeRango && <span className="etiqueta etiqueta-peligro" style={{ marginLeft: 6 }}>Fuera de rango</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Extras({ extras }) {
  return (
    <>
      {extras.ordenesEnCurso > 0 && (
        <section className="panel vidrio">
          <h2>Órdenes en curso</h2>
          <p style={{ color: 'var(--tinta-suave)' }}>
            {extras.ordenesEnCurso} {extras.ordenesEnCurso === 1 ? 'orden pendiente' : 'órdenes pendientes'} de resultados o validación.
          </p>
        </section>
      )}
      <PanelEvolucion evolucion={extras.evolucion} />
    </>
  );
}

export const laboratorio = {
  datosIniciales: { medicoReferenteId: '', examenes: [] },
  preparar: (d) => ({ medicoReferenteId: d.medicoReferenteId || null, examenes: d.examenes }),
  conObservaciones: true,
  // En el laboratorio las reglas comunes cambian de nombre (ver README).
  textos: {
    nuevaConsulta: 'Nueva orden',
    tituloNueva: 'Nueva orden de examen',
    guardar: 'Registrar orden',
    consultas: 'Órdenes de examen',
    motivo: 'Motivo del estudio',
    diagnosticos: 'Diagnóstico presuntivo',
    receta: 'Medicación actual',
    recetaAyuda: 'Opcional. Medicamentos que toma el paciente y que pueden alterar los resultados.',
    conReceta: 'Registrar medicación',
    botonReceta: 'Medicación',
    sinMotivo: 'Orden de examen',
    notaAdministrativa: 'Vista administrativa: resultados, diagnóstico presuntivo, medicación y antecedentes solo los ve el químico biólogo.',
  },
  CamposConsulta,
  DetalleConsulta,
  Extras,
};
