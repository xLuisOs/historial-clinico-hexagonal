// Acciones cortas sobre un historial existente. Cada diálogo llama a la API y,
// si sale bien, avisa con onListo para que el historial se vuelva a cargar.

import { useState } from 'react';
import { api } from '../api.js';
import {
  CamposDiagnostico, DIAGNOSTICO, EditorReceta, ITEM_RECETA, prepararDiagnostico, prepararItems,
} from '../componentes/EditoresClinicos.jsx';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { conTipoSangre, MOTIVOS_BAJA, TIPOS_SANGRE } from '../formato.js';

function useEnvio(accion, onListo) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
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
  return { error, errores: erroresDe(error), enviando, enviar };
}

const Pie = ({ onCerrar, enviando, texto, peligro }) => (
  <footer>
    <button type="button" className="boton boton-secundario" onClick={onCerrar}>Cancelar</button>
    <button className={`boton ${peligro ? 'boton-peligro' : 'boton-primario'}`} disabled={enviando}>
      {enviando ? 'Guardando…' : texto}
    </button>
  </footer>
);

/** Tipo de sangre y alergias, que se descubren o se confirman después del registro (médico). */
export function DialogoDatosClinicos({ paciente, institucion, onCerrar, onListo }) {
  const conSangre = conTipoSangre(institucion);
  const [datos, setDatos] = useState({
    tipoSangre: paciente.datosClinicos?.tipoSangre ?? '',
    alergias: paciente.datosClinicos?.alergias ?? '',
  });
  const { error, errores, enviando, enviar } = useEnvio(() => api.actualizarDatosClinicos(paciente.id, {
    ...(conSangre && { tipoSangre: datos.tipoSangre || null }),
    alergias: datos.alergias.trim() || null,
  }), onListo);
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  return (
    <Dialogo titulo="Datos clínicos" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        {conSangre && (
          <Selector etiqueta="Tipo de sangre" value={datos.tipoSangre} onChange={cambiar('tipoSangre')} error={errores.tipoSangre}
            vacio="Sin registrar" opciones={TIPOS_SANGRE.map((t) => ({ valor: t, texto: t }))} />
        )}
        <Campo etiqueta="Alergias" error={errores.alergias}>
          <textarea value={datos.alergias} onChange={cambiar('alergias')} maxLength={500}
            placeholder="p. ej. Penicilina, látex. Déjalo vacío si no tiene alergias conocidas." />
        </Campo>
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Guardar" />
      </form>
    </Dialogo>
  );
}

export function DialogoContacto({ paciente, onCerrar, onListo }) {
  const [datos, setDatos] = useState({
    telefono: paciente.contacto?.telefono ?? '',
    direccion: paciente.contacto?.direccion ?? '',
    correo: paciente.contacto?.correo ?? '',
  });
  const { error, errores, enviando, enviar } = useEnvio(
    () => api.actualizarContacto(paciente.id, Object.fromEntries(
      Object.entries(datos).map(([k, v]) => [k, v.trim() || null]),
    )),
    onListo,
  );
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  return (
    <Dialogo titulo="Actualizar contacto" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <Campo etiqueta="Teléfono" type="tel" value={datos.telefono} onChange={cambiar('telefono')} error={errores['contacto.telefono']} />
        <Campo etiqueta="Dirección" value={datos.direccion} onChange={cambiar('direccion')} error={errores['contacto.direccion']} />
        <Campo etiqueta="Correo" type="email" value={datos.correo} onChange={cambiar('correo')} error={errores['contacto.correo']} />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Guardar" />
      </form>
    </Dialogo>
  );
}

export function DialogoBaja({ paciente, onCerrar, onListo }) {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const { error, errores, enviando, enviar } = useEnvio(
    () => api.darDeBaja(paciente.id, { motivo: motivo || null, detalle: detalle.trim() || null }),
    onListo,
  );
  return (
    <Dialogo titulo="Archivar historial" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta tipo="aviso">
          El historial no se borra: queda archivado y ya no se le pueden registrar atenciones.
          Sus citas futuras se cancelan.
        </Alerta>
        <Alerta>{error?.message}</Alerta>
        <Selector etiqueta="Motivo *" value={motivo} onChange={(e) => setMotivo(e.target.value)} error={errores.motivo}
          opciones={Object.entries(MOTIVOS_BAJA).map(([valor, texto]) => ({ valor, texto }))} />
        <Campo etiqueta={motivo === 'otro' ? 'Detalle *' : 'Detalle'} error={errores.detalle}>
          <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} />
        </Campo>
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Archivar" peligro />
      </form>
    </Dialogo>
  );
}

export function DialogoDiagnostico({ consulta, onCerrar, onListo }) {
  const yaHayPrincipal = consulta.diagnosticos.some((d) => d.tipo === 'principal');
  const [diagnostico, setDiagnostico] = useState({ ...DIAGNOSTICO, tipo: yaHayPrincipal ? 'secundario' : 'principal' });
  const { error, errores, enviando, enviar } = useEnvio(
    () => api.agregarDiagnostico(consulta.id, prepararDiagnostico(diagnostico)),
    onListo,
  );
  return (
    <Dialogo titulo="Agregar diagnóstico" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <CamposDiagnostico valor={diagnostico} onChange={setDiagnostico} errores={errores} prefijo="diagnostico" />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Agregar" />
      </form>
    </Dialogo>
  );
}

export function DialogoReceta({ consulta, onCerrar, onListo }) {
  const [indicaciones, setIndicaciones] = useState('');
  const [items, setItems] = useState([{ ...ITEM_RECETA }]);
  const { error, errores, enviando, enviar } = useEnvio(
    () => api.recetar(consulta.id, { indicaciones: indicaciones.trim() || null, items: prepararItems(items) }),
    onListo,
  );
  return (
    <Dialogo titulo={consulta.receta ? 'Agregar a la receta' : 'Emitir receta'} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <Campo etiqueta="Indicaciones generales" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)}
          error={errores.indicaciones} placeholder={consulta.receta?.indicaciones ?? ''} />
        <EditorReceta items={items} onChange={setItems} errores={errores} prefijo="items" />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Recetar" />
      </form>
    </Dialogo>
  );
}
