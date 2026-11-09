// Cobros del pediátrico: la recepción cobra cada consulta con servicios del
// catálogo (el precio lo pone el backend) y registra abonos hasta saldarla.
// El total y el cierre del cobro los calcula MySQL (vista + triggers).

import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alerta, Campo, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { dinero, fecha, fechaHora, REFERENCIA_PAGO, textoReferencia } from '../formato.js';
import { puede } from '../sesion.jsx';
import { CampoReferencia, Quitar } from './comun.jsx';

const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
const ESTADO = {
  pendiente: ['etiqueta-aviso', 'Pendiente'],
  pagado: ['etiqueta-exito', 'Pagado'],
  anulado: ['etiqueta-gris', 'Anulado'],
};

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

const Pie = ({ onCerrar, enviando, texto }) => (
  <footer>
    <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
    <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : texto}</button>
  </footer>
);

function DialogoCobro({ consulta, onCerrar, onListo }) {
  const [servicios, setServicios] = useState(null);
  const [lineas, setLineas] = useState([{ servicioId: '', cantidad: '1' }]);
  const [errorCarga, setErrorCarga] = useState(null);

  useEffect(() => {
    api.serviciosPediatrico().then(setServicios).catch(setErrorCarga);
  }, []);

  const precio = (id) => Number(servicios?.find((s) => s.id === id)?.precio ?? 0);
  const total = lineas.reduce((s, l) => s + precio(l.servicioId) * (Number(l.cantidad) || 0), 0);
  const cambiar = (i, campo) => (e) => setLineas(lineas.map((l, j) => (j === i ? { ...l, [campo]: e.target.value } : l)));

  const { error, errores, enviando, enviar } = useEnvio(() => api.generarCobro(consulta.id, {
    items: lineas.map((l) => ({ servicioId: l.servicioId || null, cantidad: l.cantidad === '' ? null : Number(l.cantidad) })),
  }), onListo);

  return (
    <Dialogo titulo="Cobrar consulta" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>
          {consulta.motivo || 'Consulta'} · {fecha(consulta.fecha)}. Se cobra al encargado del paciente con el precio vigente del catálogo.
        </p>
        <Alerta>{errorCarga?.message ?? error?.message}</Alerta>
        {lineas.map((l, i) => (
          <div className="rejilla" key={i} style={{ alignItems: 'end' }}>
            <Selector etiqueta={i === 0 ? 'Servicio *' : ''} value={l.servicioId} onChange={cambiar(i, 'servicioId')}
              error={errores[`items[${i}].servicioId`]}
              opciones={(servicios ?? []).map((s) => ({ valor: s.id, texto: `${s.nombre} · ${dinero(s.precio)}` }))} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
              <Campo etiqueta={i === 0 ? 'Cantidad' : ''} type="number" min="1" max="20" value={l.cantidad}
                onChange={cambiar(i, 'cantidad')} error={errores[`items[${i}].cantidad`]} />
              {lineas.length > 1 && <Quitar onClick={() => setLineas(lineas.filter((_, j) => j !== i))} />}
            </div>
          </div>
        ))}
        {errores.items && <small className="error-campo">{errores.items}</small>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="boton boton-fantasma boton-chico"
            onClick={() => setLineas([...lineas, { servicioId: '', cantidad: '1' }])}>+ Agregar servicio</button>
          <strong>Total estimado: {dinero(total)}</strong>
        </div>
        <Pie onCerrar={onCerrar} enviando={enviando || !servicios} texto="Generar cobro" />
      </form>
    </Dialogo>
  );
}

function DialogoPago({ cobro, onCerrar, onListo }) {
  const [monto, setMonto] = useState(String(cobro.saldo));
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const { error, errores, enviando, enviar } = useEnvio(() => api.pagarCobro(cobro.id, {
    monto: monto === '' ? null : Number(monto),
    metodoPago,
    referencia: REFERENCIA_PAGO[metodoPago] ? referencia.trim() || null : null,
  }), onListo);

  return (
    <Dialogo titulo="Registrar pago" onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <p style={{ color: 'var(--tinta-suave)' }}>
          Cobro #{cobro.id} · total {dinero(cobro.total)} · saldo pendiente <strong>{dinero(cobro.saldo)}</strong>
        </p>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          <Campo etiqueta="Monto (Q) *" type="number" min="0.01" step="0.01" max={cobro.saldo} value={monto}
            onChange={(e) => setMonto(e.target.value)} error={errores.monto} />
          <Selector etiqueta="Método *" value={metodoPago} onChange={(e) => { setMetodoPago(e.target.value); setReferencia(''); }} vacio={null}
            error={errores.metodoPago} opciones={Object.entries(METODOS).map(([valor, texto]) => ({ valor, texto }))} />
        </div>
        <CampoReferencia metodo={metodoPago} value={referencia} onChange={(e) => setReferencia(e.target.value)} error={errores.referencia} />
        <Pie onCerrar={onCerrar} enviando={enviando} texto="Registrar pago" />
      </form>
    </Dialogo>
  );
}

function Cobro({ cobro, consulta, puedeCobrar, onPagar }) {
  const [clase, texto] = ESTADO[cobro.estado] ?? ['etiqueta-gris', cobro.estado];
  return (
    <li style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '12px 0', borderTop: '1px solid rgba(15, 45, 54, 0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span>
          <strong>{consulta?.motivo || `Consulta #${cobro.consultaId}`}</strong>
          <br />
          <small style={{ color: 'var(--tinta-suave)' }}>Cobro #{cobro.id} · {fecha(cobro.fecha)} · {cobro.encargado}</small>
        </span>
        <span className={`etiqueta ${clase}`}>{texto}</span>
      </div>
      <small>
        {cobro.detalle.map((d) => `${d.cantidad} × ${d.servicio}`).join(' · ')}
      </small>
      {cobro.pagos.length > 0 && (
        <small style={{ color: 'var(--tinta-suave)' }}>
          Pagos: {cobro.pagos.map((p) => `${dinero(p.monto)} ${METODOS[p.metodo]?.toLowerCase() ?? p.metodo}${p.referencia ? ` · ${textoReferencia(p.metodo, p.referencia)}` : ''} (${fechaHora(p.fecha)})`).join(' · ')}
        </small>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <small>Total <strong>{dinero(cobro.total)}</strong> · pagado {dinero(cobro.pagado)} · saldo <strong>{dinero(cobro.saldo)}</strong></small>
        {puedeCobrar && cobro.estado === 'pendiente' && (
          <button type="button" className="boton boton-primario boton-chico" onClick={onPagar}>Registrar pago</button>
        )}
      </div>
    </li>
  );
}

export function PanelCobros({ cobros = [], consultas = [], usuario, recargar }) {
  const [dialogo, setDialogo] = useState(null);
  const puedeCobrar = puede(usuario, 'cobrar');
  const conCobro = new Set(cobros.map((c) => c.consultaId));
  const porCobrar = consultas.filter((c) => !conCobro.has(c.id));
  const porId = new Map(consultas.map((c) => [c.id, c]));
  if (cobros.length === 0 && (porCobrar.length === 0 || !puedeCobrar)) return null;

  const vigentes = cobros.filter((c) => c.estado !== 'anulado');
  const suma = (campo) => vigentes.reduce((s, c) => s + c[campo], 0);
  const listo = () => { setDialogo(null); recargar(); };

  return (
    <section className="panel vidrio">
      <h2>Cobros</h2>
      {vigentes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
          {[['Cobrado', 'total'], ['Pagado', 'pagado'], ['Saldo', 'saldo']].map(([texto, campo]) => (
            <div key={campo} className="cifra" style={{ padding: '10px 12px' }}>
              <small>{texto}</small>
              <strong style={{ fontSize: '1rem' }}>{dinero(suma(campo))}</strong>
            </div>
          ))}
        </div>
      )}

      {puedeCobrar && porCobrar.length > 0 && (
        <>
          <h4 style={{ marginTop: 18 }}>Consultas por cobrar</h4>
          <ul className="items">
            {porCobrar.map((c) => (
              <li key={c.id} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>{c.motivo || 'Consulta'}</strong><br /><small>{fecha(c.fecha)}</small></span>
                <button type="button" className="boton boton-primario boton-chico" onClick={() => setDialogo({ tipo: 'cobro', consulta: c })}>Cobrar</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {cobros.length > 0 && (
        <>
          <h4 style={{ marginTop: 18 }}>Historial de cobros</h4>
          <ul className="items">
            {cobros.map((c) => (
              <Cobro key={c.id} cobro={c} consulta={porId.get(c.consultaId)} puedeCobrar={puedeCobrar}
                onPagar={() => setDialogo({ tipo: 'pago', cobro: c })} />
            ))}
          </ul>
        </>
      )}

      {dialogo?.tipo === 'cobro' && <DialogoCobro consulta={dialogo.consulta} onCerrar={() => setDialogo(null)} onListo={listo} />}
      {dialogo?.tipo === 'pago' && <DialogoPago cobro={dialogo.cobro} onCerrar={() => setDialogo(null)} onListo={listo} />}
    </section>
  );
}
