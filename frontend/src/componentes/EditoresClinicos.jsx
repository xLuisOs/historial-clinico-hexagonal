// Partes del formulario de atención que son comunes a las cuatro instituciones:
// diagnósticos (CIE-10) y medicamentos de una receta. Se usan en la consulta
// nueva y en los diálogos de "agregar diagnóstico" y "recetar".

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { etiqueta, VIAS } from '../formato.js';
import { Quitar } from '../instituciones/comun.jsx';
import { Campo, Selector } from './ui.jsx';

export const DIAGNOSTICO = { codigoCie10: '', descripcion: '', tipo: 'principal' };
export const ITEM_RECETA = { medicamentoId: '', dosis: '', frecuencia: '', duracionDias: '', via: 'oral', indicaciones: '' };

export function CamposDiagnostico({ valor, onChange, errores, prefijo, conTipo = true }) {
  const cambiar = (campo) => (e) => onChange({ ...valor, [campo]: e.target.value });
  return (
    <>
      <Campo etiqueta="Código CIE-10" placeholder="Ej. J06.9" value={valor.codigoCie10}
        onChange={(e) => onChange({ ...valor, codigoCie10: e.target.value.toUpperCase() })}
        error={errores[`${prefijo}.codigoCie10`]} />
      <Campo etiqueta="Descripción *" value={valor.descripcion} onChange={cambiar('descripcion')} error={errores[`${prefijo}.descripcion`]} />
      {conTipo && (
        <Selector etiqueta="Tipo" value={valor.tipo} onChange={cambiar('tipo')} vacio={null} error={errores[`${prefijo}.tipo`]}
          opciones={[{ valor: 'principal', texto: 'Principal' }, { valor: 'secundario', texto: 'Secundario' }]} />
      )}
    </>
  );
}

export function EditorDiagnosticos({ lista, onChange, errores, titulo = 'Diagnósticos' }) {
  const cambiar = (i) => (d) => onChange(lista.map((x, j) => (j === i ? d : x)));
  return (
    <section className="seccion-form">
      <header>
        <div>
          <h2>{titulo}</h2>
          <p>Al menos uno, y exactamente un principal.</p>
        </div>
      </header>
      {errores.diagnosticos && <small className="error-campo" style={{ color: 'var(--peligro)' }}>{errores.diagnosticos}</small>}
      {lista.map((d, i) => (
        <div className="fila-lista" key={i}>
          <CamposDiagnostico valor={d} onChange={cambiar(i)} errores={errores} prefijo={`diagnosticos[${i}]`} />
          {lista.length > 1 && <Quitar onClick={() => onChange(lista.filter((_, j) => j !== i))} />}
        </div>
      ))}
      <div>
        <button type="button" className="boton boton-secundario boton-chico"
          onClick={() => onChange([...lista, { ...DIAGNOSTICO, tipo: 'secundario' }])}>
          + Agregar diagnóstico
        </button>
      </div>
    </section>
  );
}

/** Catálogo de medicamentos de la institución del usuario. */
export function useMedicamentos() {
  const [medicamentos, setMedicamentos] = useState([]);
  useEffect(() => { api.medicamentos().then(setMedicamentos).catch(() => {}); }, []);
  return medicamentos;
}

export function EditorReceta({ items, onChange, errores, prefijo }) {
  const medicamentos = useMedicamentos();
  const cambiar = (i, campo) => (e) => onChange(items.map((x, j) => (j === i ? { ...x, [campo]: e.target.value } : x)));
  const error = (i, campo) => errores[`${prefijo}[${i}].${campo}`];

  return (
    <>
      {errores[prefijo] && <small className="error-campo" style={{ color: 'var(--peligro)' }}>{errores[prefijo]}</small>}
      {items.map((item, i) => (
        <div className="fila-lista" key={i}>
          <Selector etiqueta="Medicamento *" value={item.medicamentoId} onChange={cambiar(i, 'medicamentoId')} error={error(i, 'medicamentoId')}
            opciones={medicamentos.map((m) => ({ valor: m.id, texto: `${m.nombre} — ${m.presentacion ?? ''}` }))} />
          <Campo etiqueta="Dosis *" placeholder="1 tableta" value={item.dosis} onChange={cambiar(i, 'dosis')} error={error(i, 'dosis')} />
          <Campo etiqueta="Frecuencia *" placeholder="cada 8 horas" value={item.frecuencia} onChange={cambiar(i, 'frecuencia')} error={error(i, 'frecuencia')} />
          <Campo etiqueta="Días *" type="number" min="1" max="365" value={item.duracionDias} onChange={cambiar(i, 'duracionDias')} error={error(i, 'duracionDias')} />
          <Selector etiqueta="Vía" value={item.via} onChange={cambiar(i, 'via')} vacio={null} error={error(i, 'via')}
            opciones={VIAS.map((v) => ({ valor: v, texto: etiqueta(v) }))} />
          <Campo etiqueta="Indicaciones" value={item.indicaciones} onChange={cambiar(i, 'indicaciones')} error={error(i, 'indicaciones')} />
          {items.length > 1 && <Quitar onClick={() => onChange(items.filter((_, j) => j !== i))} />}
        </div>
      ))}
      <div>
        <button type="button" className="boton boton-secundario boton-chico" onClick={() => onChange([...items, { ...ITEM_RECETA }])}>
          + Agregar medicamento
        </button>
      </div>
    </>
  );
}

/** Convierte lo que se escribió en el formulario en lo que espera la API. */
export const prepararDiagnostico = (d) => ({
  codigoCie10: d.codigoCie10.trim() || null,
  descripcion: d.descripcion,
  tipo: d.tipo,
});

export const prepararItems = (items) => items.map((i) => ({
  medicamentoId: i.medicamentoId || null,
  dosis: i.dosis,
  frecuencia: i.frecuencia,
  duracionDias: i.duracionDias === '' ? null : Number(i.duracionDias),
  via: i.via,
  indicaciones: i.indicaciones || null,
}));
