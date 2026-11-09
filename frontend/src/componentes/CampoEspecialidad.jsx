// Especialidad de un médico: se elige de la lista de la institución y, si no
// está, se escribe en "Otra…". El backend compara lo escrito con la lista sin
// importar tildes ni mayúsculas, así no se duplican ("Cardiologia" queda como
// "Cardiología").

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Campo, Selector } from './ui.jsx';

const OTRA = '__otra__';

export function CampoEspecialidad({ value, onChange, error, requerido = false }) {
  const [lista, setLista] = useState(null);
  const [escribiendo, setEscribiendo] = useState(false);

  useEffect(() => { api.especialidades().then(setLista).catch(() => setLista([])); }, []);

  // Una especialidad que no está en la lista (o la opción "Otra…") se escribe a mano.
  const enLista = !value || (lista ?? []).includes(value);
  const aMano = escribiendo || (lista !== null && !enLista);
  const etiqueta = `Especialidad${requerido ? ' *' : ''}`;

  if (lista === null) return <Campo etiqueta={etiqueta} value="Cargando…" disabled readOnly />;

  return (
    <>
      <Selector etiqueta={etiqueta} value={aMano ? OTRA : value ?? ''} error={aMano ? undefined : error}
        vacio={requerido ? 'Selecciona…' : 'Sin especialidad'}
        opciones={[...lista.map((e) => ({ valor: e, texto: e })), { valor: OTRA, texto: 'Otra…' }]}
        onChange={(e) => {
          const elegida = e.target.value;
          setEscribiendo(elegida === OTRA);
          onChange(elegida === OTRA ? '' : elegida);
        }} />
      {aMano && (
        <Campo etiqueta="Nueva especialidad *" value={value ?? ''} onChange={(e) => onChange(e.target.value)} error={error}
          maxLength={80} placeholder="p. ej. Neurología" autoFocus />
      )}
    </>
  );
}
