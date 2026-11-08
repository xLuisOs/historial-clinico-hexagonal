// Facturación del hospital: recepción y admin facturan una consulta o un
// internamiento, registran pagos (abonos, seguro…) y el admin anula facturas
// sin pagos. El total y el cierre al pagarse los calcula la base de datos.

import { useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { dinero, fecha, fechaHora } from '../formato.js';
import { puede } from '../sesion.jsx';
import { Quitar } from './comun.jsx';

const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', seguro: 'Seguro' };
const ESTADO = { pendiente: 'etiqueta-aviso', pagada: 'etiqueta-exito', anulada: 'etiqueta-gris' };
const LINEA = { descripcion: '', cantidad: '1', precioUnitario: '' };

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
    <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
    <button className={`boton ${peligro ? 'boton-peligro' : 'boton-primario'}`} disabled={enviando}>{enviando ? 'Guardando…' : texto}</button>
  </footer>
);

function DialogoNuevaFactura({ paciente, origenes, onCerrar, onListo }) {
  const [origen, setOrigen] = useState(origenes[0]?.valor ?? '');
  const [lineas, setLineas] = useState([{ ...LINEA }]);
  const total = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0);
  const [tipo, idOrigen] = origen.split(':');

  const { error, errores, enviando, enviar } = useEnvio(() => api.crearFactura(paciente.id, {
    consultaId: tipo === 'consulta' ? idOrigen : null,
    internamientoId: tipo === 'internamiento' ? idOrigen : null,
    items: lineas.map((l) => ({
      descripcion: l.descripcion.trim() || null,
      cantidad: l.cantidad === '' ? null : Number(l.cantidad),
      precioUnitario: l.precioUnitario === '' ? null : Number(l.precioUnitario),
    })),
  }), onListo);
  const cambiar = (i, campo) => (e) => setLineas(lineas.map((l, j) => (j === i ? { ...l, [campo]: e.target.value } : l)));
  const error_ = (i, campo) => errores[`items[${i}].${campo}`];

  return (
    <Dialogo titulo="Nueva factura" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        {origenes.length === 0 && <Alerta tipo="aviso">Este paciente no tiene consultas ni internamientos sin facturar.</Alerta>}
        <Selector etiqueta="Se factura *" value={origen} onChange={(e) => setOrigen(e.target.value)} vacio={null}
          error={errores.origen} opciones={origenes} />
        {errores.items && <small className="error-campo" style={{ color: 'var(--peligro)' }}>{errores.items}</small>}
        {lineas.map((l, i) => (
          <div className="fila-lista fila-factura" key={i}>
            <Campo etiqueta="Descripción *" value={l.descripcion} onChange={cambiar(i, 'descripcion')} error={error_(i, 'descripcion')}
              placeholder="Ej. Día de encamamiento" />
            <Campo etiqueta="Cantidad" type="number" min="1" value={l.cantidad} onChange={cambiar(i, 'cantidad')} error={error_(i, 'cantidad')} />
            <Campo etiqueta="Precio (Q) *" type="number" min="0" step="0.01" value={l.precioUnitario}
              onChange={cambiar(i, 'precioUnitario')} error={error_(i, 'precioUnitario')} />
            {lineas.length > 1 && <Quitar onClick={() => setLineas(lineas.filter((_, j) => j !== i))} />}
          </div>
        ))}
        <div className="acciones" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" className="boton boton-secundario boton-chico" onClick={() => setLineas([...lineas, { ...LINEA }])}>+ Agregar línea</button>
          <strong>Total {dinero(total)}</strong>
        </div>
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Emitir factura" />
      </form>
    </Dialogo>
  );
}

function DialogoPagoFactura({ factura, onCerrar, onListo }) {
  const [datos, setDatos] = useState({ monto: String(factura.saldo), metodoPago: 'efectivo', referencia: '' });
  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const { error, errores, enviando, enviar } = useEnvio(() => api.pagarFactura(factura.id, {
    monto: datos.monto === '' ? null : Number(datos.monto),
    metodoPago: datos.metodoPago,
    referencia: datos.referencia.trim() || null,
  }), onListo);

  return (
    <Dialogo titulo={`Pago de la factura #${factura.id}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>Total {dinero(factura.total)} · saldo pendiente <strong>{dinero(factura.saldo)}</strong></p>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Monto (Q) *" type="number" min="0.01" step="0.01" value={datos.monto} onChange={cambiar('monto')} error={errores.monto} />
          <Selector etiqueta="Método *" value={datos.metodoPago} onChange={cambiar('metodoPago')} vacio={null} error={errores.metodoPago}
            opciones={Object.entries(METODOS).map(([valor, texto]) => ({ valor, texto }))} />
        </div>
        <Campo etiqueta="Referencia" value={datos.referencia} onChange={cambiar('referencia')} error={errores.referencia}
          placeholder="No. de autorización, póliza…" />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Registrar pago" />
      </form>
    </Dialogo>
  );
}

function DialogoAnular({ factura, onCerrar, onListo }) {
  const { error, enviando, enviar } = useEnvio(() => api.anularFactura(factura.id), onListo);
  return (
    <Dialogo titulo="Anular factura" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar}>
        <p>¿Anular la factura <strong>#{factura.id}</strong> por {dinero(factura.total)}? No se borra: queda registrada como anulada.</p>
        <Alerta>{error?.message}</Alerta>
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Anular" peligro />
      </form>
    </Dialogo>
  );
}

export function PanelFacturas({ facturas = [], consultas = [], internamientos = [], paciente, usuario, recargar }) {
  const [dialogo, setDialogo] = useState(null); // { tipo, factura? }
  const puedeFacturar = puede(usuario, 'facturar');
  const alListo = () => { setDialogo(null); recargar(); };
  const cerrar = () => setDialogo(null);

  // Lo que todavía se puede facturar: consultas e internamientos sin factura vigente.
  const facturado = new Set(facturas.filter((f) => f.estado !== 'anulada').map((f) => `${f.origen.tipo}:${f.origen.id}`));
  const origenes = [
    ...consultas.map((c) => ({ valor: `consulta:${c.id}`, texto: `Consulta · ${fechaHora(c.fecha)} · ${c.motivo ?? 'sin motivo'}` })),
    ...internamientos.map((i) => ({ valor: `internamiento:${i.id}`, texto: `Internamiento · habitación ${i.habitacion} · ${fecha(i.fechaIngreso)}` })),
  ].filter((o) => !facturado.has(o.valor));

  if (facturas.length === 0 && !puedeFacturar) return null;

  return (
    <section className="panel vidrio">
      <div className="titulo-panel">
        <h2>Facturas</h2>
        {puedeFacturar && (
          <button type="button" className="boton boton-primario boton-chico" onClick={() => setDialogo({ tipo: 'nueva' })}>Nueva factura</button>
        )}
      </div>
      {facturas.length === 0 && <p className="vacio">Sin facturas.</p>}
      <div className="linea-tiempo">
        {facturas.map((f) => (
          <article className="consulta" key={f.id} style={{ padding: 16, gap: 10 }}>
            <div className="consulta-cabecera">
              <div>
                <strong>Factura #{f.id}</strong> <small>· {fecha(f.fechaEmision)}</small>
                <br />
                <small>{f.origen.tipo === 'consulta' ? 'Consulta' : 'Internamiento'} · {f.origen.descripcion ?? fecha(f.origen.fecha)}</small>
              </div>
              <span className={`etiqueta ${ESTADO[f.estado] ?? ''}`}>{f.estado}</span>
            </div>
            <div className="tabla-envoltura">
              <table className="tabla">
                <tbody>
                  {f.detalle.map((d, n) => (
                    <tr key={n}>
                      <td style={{ whiteSpace: 'normal' }}>{d.descripcion}{d.cantidad > 1 && <small style={{ color: 'var(--tinta-suave)' }}> × {d.cantidad}</small>}</td>
                      <td className="numero">{dinero(d.subtotal)}</td>
                    </tr>
                  ))}
                  <tr><td><strong>Total</strong></td><td className="numero"><strong>{dinero(f.total)}</strong></td></tr>
                </tbody>
              </table>
            </div>
            {f.pagos.length > 0 && (
              <ul className="items">
                {f.pagos.map((p, n) => (
                  <li key={n}>
                    <strong>{dinero(p.monto)}</strong>
                    <small>{fecha(p.fecha)} · {METODOS[p.metodoPago] ?? p.metodoPago}{p.referencia ? ` · ${p.referencia}` : ''}</small>
                  </li>
                ))}
              </ul>
            )}
            <div className="acciones" style={{ alignItems: 'center' }}>
              {f.estado === 'pendiente' && <small>Saldo <strong>{dinero(f.saldo)}</strong></small>}
              {puedeFacturar && f.estado === 'pendiente' && (
                <button type="button" className="boton boton-primario boton-chico" onClick={() => setDialogo({ tipo: 'pago', factura: f })}>Registrar pago</button>
              )}
              {puede(usuario, 'anularFactura') && f.estado === 'pendiente' && f.pagos.length === 0 && (
                <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setDialogo({ tipo: 'anular', factura: f })}>Anular</button>
              )}
            </div>
          </article>
        ))}
      </div>

      {dialogo?.tipo === 'nueva' && <DialogoNuevaFactura paciente={paciente} origenes={origenes} onCerrar={cerrar} onListo={alListo} />}
      {dialogo?.tipo === 'pago' && <DialogoPagoFactura factura={dialogo.factura} onCerrar={cerrar} onListo={alListo} />}
      {dialogo?.tipo === 'anular' && <DialogoAnular factura={dialogo.factura} onCerrar={cerrar} onListo={alListo} />}
    </section>
  );
}
