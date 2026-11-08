// Pediátrico: antes de capturar al encargado se busca por DPI. Si ya está
// registrado (p. ej. la mamá de un hermanito), se asocia; si no, se llenan
// sus datos. Evita duplicar encargados (dpi es UNIQUE en MySQL).

import { useState } from 'react';
import { api } from '../api.js';
import { Campo } from '../componentes/ui.jsx';
import { etiqueta, nombreCompleto } from '../formato.js';

/**
 * Llama a onEncontrado(encargado) si existe, o a onNuevo(dpi) si no.
 * Con `encontrado` muestra a quién se asociará y permite deshacerlo.
 */
export function BuscadorEncargado({ encontrado, onEncontrado, onNuevo, onQuitar }) {
  const [dpi, setDpi] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [buscando, setBuscando] = useState(false);

  async function buscar() {
    setBuscando(true);
    setMensaje(null);
    try {
      onEncontrado(await api.buscarEncargado(dpi.trim()));
    } catch (err) {
      if (err.estado === 404) {
        setMensaje('No está registrado: llena sus datos abajo.');
        onNuevo(dpi.trim());
      } else {
        setMensaje(err.detalles?.dpi ?? err.message);
      }
    } finally {
      setBuscando(false);
    }
  }

  if (encontrado) {
    return (
      <div className="alerta alerta-exito" role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span>
          Se asociará a <strong>{nombreCompleto(encontrado)}</strong> ({etiqueta(encontrado.parentesco)}) · {encontrado.telefono}
          {encontrado.pacientes.length > 0 && <><br /><small>Ya es responsable de: {encontrado.pacientes.join(', ')}</small></>}
        </span>
        <button type="button" className="boton boton-secundario boton-chico" onClick={onQuitar}>Cambiar</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'end', marginBottom: 12 }}>
      <div style={{ flex: 1 }}>
        <Campo etiqueta="Buscar encargado por DPI" inputMode="numeric" maxLength={13} value={dpi} placeholder="13 dígitos"
          onChange={(e) => setDpi(e.target.value)} error={mensaje && !mensaje.startsWith('No está') ? mensaje : null}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }} />
      </div>
      <button type="button" className="boton boton-secundario" onClick={buscar} disabled={buscando || dpi.trim().length !== 13}>
        {buscando ? 'Buscando…' : 'Buscar'}
      </button>
      {mensaje?.startsWith('No está') && <small style={{ color: 'var(--tinta-suave)', paddingBottom: 10 }}>{mensaje}</small>}
    </div>
  );
}
