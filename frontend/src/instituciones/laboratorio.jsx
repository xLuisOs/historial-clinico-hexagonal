// Laboratorio Clínico: la "consulta" es una ORDEN DE EXAMEN. Se elige el
// médico referente (puede no ser del laboratorio) y los exámenes del catálogo;
// cada examen trae sus propios parámetros, que cambian según el tipo.

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
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

function Examen({ examen, editable, onResultados }) {
  const conValor = examen.parametros.filter((p) => p.valor != null).length;
  return (
    <div style={{ borderTop: '1px solid rgba(15, 45, 54, 0.08)', paddingTop: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{examen.nombre}</strong>
          <Estado mapa={ESTADO_EXAMEN} valor={examen.estado} />
          <small style={{ color: 'var(--tinta-suave)' }}>{conValor} de {examen.parametros.length}</small>
        </span>
        {editable && examen.estado !== 'validado' && (
          <button type="button" className="boton boton-primario boton-chico" onClick={onResultados}>
            {conValor === 0 ? 'Registrar resultados' : 'Editar resultados'}
          </button>
        )}
      </div>
      {examen.validadoPor && (
        <small style={{ color: 'var(--tinta-suave)' }}>Validado por {examen.validadoPor.nombre} el {fecha(examen.fechaValidacion)}</small>
      )}
      <TablaResultados examen={examen} />
    </div>
  );
}

function DetalleConsulta({ datos, consulta, usuario, recargar }) {
  const [capturando, setCapturando] = useState(null);
  if (!datos.numero) return null;
  const editable = ['pendiente', 'en_proceso'].includes(datos.estado) && puede(usuario, 'atender');
  return (
    <div className="bloque">
      <h4 style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="codigo">{datos.numero}</span>
        <Estado mapa={ESTADO_ORDEN} valor={datos.estado} />
      </h4>
      <ul className="items">
        <li><small>Médico referente:</small> <span>{datos.medicoReferente?.nombre} (col. {datos.medicoReferente?.numeroColegiado})</span></li>
        {datos.registradaPor && <li><small>Registró:</small> <span>{datos.registradaPor.nombre}</span></li>}
      </ul>
      {datos.examenes.map((e) => (
        <Examen key={e.codigo} examen={e} editable={editable} onResultados={() => setCapturando(e)} />
      ))}
      {capturando && (
        <DialogoResultados ordenId={consulta.id} examen={capturando}
          onCerrar={() => setCapturando(null)} onListo={() => { setCapturando(null); recargar(); }} />
      )}
    </div>
  );
}

function Extras({ extras }) {
  if (!extras.ordenesEnCurso) return null;
  return (
    <section className="panel vidrio">
      <h2>Órdenes en curso</h2>
      <p style={{ color: 'var(--tinta-suave)' }}>
        {extras.ordenesEnCurso} {extras.ordenesEnCurso === 1 ? 'orden pendiente' : 'órdenes pendientes'} de resultados o validación.
      </p>
    </section>
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
  },
  CamposConsulta,
  DetalleConsulta,
  Extras,
};
