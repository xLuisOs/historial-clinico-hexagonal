// Contenido de cada documento imprimible. La hoja, el encabezado de la
// institución y el botón de imprimir están en Imprimible.jsx.

import { dinero, etiqueta, fecha, fechaHora, nombreCompleto, textoReferencia } from '../formato.js';
import { direccion, referencia } from '../instituciones/resultados.jsx';
import { DatosHoja, DatosPaciente, DocumentoImprimible } from './Imprimible.jsx';

const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', seguro: 'Seguro' };
const dias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

/** Pagos de un cobro o factura: fecha, método con su referencia y monto. */
function TablaPagos({ pagos, metodoDe = (p) => p.metodoPago ?? p.metodo }) {
  if (!pagos?.length) return <p className="hoja-nota">Sin pagos registrados.</p>;
  return (
    <table className="tabla-hoja">
      <thead><tr><th>Fecha</th><th>Método</th><th className="num">Monto</th></tr></thead>
      <tbody>
        {pagos.map((p, n) => (
          <tr key={p.id ?? n}>
            <td>{fechaHora(p.fecha)}</td>
            <td>{METODOS[metodoDe(p)] ?? metodoDe(p)}{p.referencia ? ` · ${textoReferencia(metodoDe(p), p.referencia)}` : ''}</td>
            <td className="num">{dinero(p.monto)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Totales al pie: total, pagado y saldo. */
function Totales({ total, pagado, saldo }) {
  return (
    <DatosHoja datos={[['Total', dinero(total)], ['Pagado', dinero(pagado)], ['Saldo pendiente', dinero(saldo)]]} />
  );
}

// ------------------------------------------------------------------ receta

export function RecetaImprimible({ consulta, paciente, onCerrar }) {
  const { receta } = consulta;
  const principal = consulta.diagnosticos?.find((d) => d.tipo === 'principal');
  return (
    <DocumentoImprimible titulo="Receta médica" numero={fecha(receta.fechaEmision ?? consulta.fecha)} onCerrar={onCerrar}
      firma={`Firma y sello · ${consulta.medico?.nombre ?? ''}`}>
      <DatosPaciente paciente={paciente} extra={[
        ['Alergias', paciente.datosClinicos?.alergias],
        ['Médico', consulta.medico?.nombre],
        ['Diagnóstico', principal ? `${principal.codigoCie10 ? `${principal.codigoCie10} · ` : ''}${principal.descripcion}` : null],
      ]} />
      <table className="tabla-hoja">
        <thead><tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th><th>Vía</th></tr></thead>
        <tbody>
          {receta.items.map((i) => (
            <tr key={i.id}>
              <td><strong>{i.medicamento}</strong>{i.indicaciones && <><br /><small>{i.indicaciones}</small></>}</td>
              <td>{i.dosis}</td>
              <td>{i.frecuencia}</td>
              <td>{dias(i.duracionDias)}</td>
              <td>{etiqueta(i.via)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {receta.indicaciones && <p className="hoja-nota"><strong>Indicaciones:</strong> {receta.indicaciones}</p>}
    </DocumentoImprimible>
  );
}

// ------------------------------------------------- comprobante del pediátrico

export function ComprobanteCobro({ cobro, consulta, paciente, onCerrar }) {
  return (
    <DocumentoImprimible titulo="Comprobante de cobro" numero={`Cobro #${cobro.id} · ${fecha(cobro.fecha)}`} onCerrar={onCerrar}>
      <DatosHoja datos={[
        ['Paciente', paciente ? nombreCompleto(paciente) : null],
        ['Encargado', cobro.encargado],
        ['Consulta', consulta ? `${consulta.motivo ?? 'Consulta'} · ${fecha(consulta.fecha)}` : `#${cobro.consultaId}`],
        ['Estado', etiqueta(cobro.estado)],
      ]} />
      <table className="tabla-hoja">
        <thead><tr><th>Servicio</th><th className="num">Cantidad</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
        <tbody>
          {cobro.detalle.map((d, n) => (
            <tr key={n}>
              <td>{d.servicio}</td>
              <td className="num">{d.cantidad}</td>
              <td className="num">{dinero(d.precioUnitario)}</td>
              <td className="num">{dinero(d.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={3}>Total</td><td className="num">{dinero(cobro.total)}</td></tr></tfoot>
      </table>
      <h3>Pagos</h3>
      <TablaPagos pagos={cobro.pagos} metodoDe={(p) => p.metodo} />
      <Totales total={cobro.total} pagado={cobro.pagado} saldo={cobro.saldo} />
    </DocumentoImprimible>
  );
}

// ------------------------------------------------------- factura del hospital

export function FacturaImprimible({ factura, paciente, onCerrar }) {
  const pagado = factura.pagos.reduce((s, p) => s + Number(p.monto), 0);
  return (
    <DocumentoImprimible titulo="Factura" numero={`Factura #${factura.id} · ${fecha(factura.fechaEmision)}`} onCerrar={onCerrar}>
      <DatosHoja datos={[
        ['Paciente', nombreCompleto(paciente)],
        ['Documento', paciente.documento],
        ['Origen', `${factura.origen.tipo === 'consulta' ? 'Consulta' : 'Internamiento'} · ${factura.origen.descripcion ?? fecha(factura.origen.fecha)}`],
        ['Estado', etiqueta(factura.estado)],
      ]} />
      <table className="tabla-hoja">
        <thead><tr><th>Concepto</th><th className="num">Cantidad</th><th className="num">Subtotal</th></tr></thead>
        <tbody>
          {factura.detalle.map((d, n) => (
            <tr key={n}><td>{d.descripcion}</td><td className="num">{d.cantidad}</td><td className="num">{dinero(d.subtotal)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2}>Total</td><td className="num">{dinero(factura.total)}</td></tr></tfoot>
      </table>
      <h3>Pagos</h3>
      <TablaPagos pagos={factura.pagos} />
      <Totales total={factura.total} pagado={pagado} saldo={factura.estado === 'pendiente' ? factura.saldo : 0} />
    </DocumentoImprimible>
  );
}

// --------------------------------------------- consulta de la odontológica

export function ComprobanteDental({ consulta, datos, paciente, saldo, onCerrar }) {
  const pagado = (datos.pagos ?? []).reduce((s, p) => s + Number(p.monto ?? 0), 0);
  return (
    <DocumentoImprimible titulo="Comprobante de consulta" numero={fecha(consulta.fecha)} onCerrar={onCerrar}>
      <DatosHoja datos={[
        ['Paciente', nombreCompleto(paciente)],
        ['Odontólogo', consulta.medico?.nombre],
        ['Estado de pago', etiqueta(datos.estadoPago)],
      ]} />
      <table className="tabla-hoja">
        <thead><tr><th>Procedimiento</th><th>Pieza</th><th className="num">Precio</th></tr></thead>
        <tbody>
          {datos.procedimientos.map((p, n) => (
            <tr key={n}><td>{p.nombre}</td><td>{p.piezaDental ?? '—'}</td><td className="num">{dinero(p.precioAplicado)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2}>Total</td><td className="num">{dinero(datos.total)}</td></tr></tfoot>
      </table>
      <h3>Pagos</h3>
      <TablaPagos pagos={datos.pagos} />
      <Totales total={datos.total} pagado={pagado} saldo={saldo} />
    </DocumentoImprimible>
  );
}

// ------------------------------------------- informe del laboratorio

/** Solo los exámenes validados van en el informe; los demás se mencionan como pendientes. */
export function InformeResultados({ orden, datos, paciente, onCerrar }) {
  const validados = datos.examenes.filter((e) => e.estado === 'validado');
  const pendientes = datos.examenes.filter((e) => e.estado !== 'validado');
  return (
    <DocumentoImprimible titulo="Informe de resultados" numero={`${datos.numero} · ${fecha(orden.fecha)}`} onCerrar={onCerrar}
      firma={validados[0]?.validadoPor ? `Químico biólogo · ${validados[0].validadoPor.nombre}` : 'Químico biólogo'}>
      <DatosPaciente paciente={paciente} extra={[
        ['Médico referente', datos.medicoReferente ? `${datos.medicoReferente.nombre} (col. ${datos.medicoReferente.numeroColegiado})` : null],
      ]} />
      {validados.map((e) => (
        <section key={e.codigo}>
          <h3>{e.nombre}</h3>
          <table className="tabla-hoja">
            <thead><tr><th>Parámetro</th><th>Resultado</th><th>Referencia</th></tr></thead>
            <tbody>
              {e.parametros.map((p) => {
                const dir = direccion(p);
                const fuera = p.fueraDeRango && !dir;
                return (
                  <tr key={p.codigo}>
                    <td>{p.nombre}</td>
                    <td>
                      <span className={p.fueraDeRango ? 'marca-hoja' : undefined}>
                        {p.valor ?? '—'}{p.unidad && p.valor != null ? ` ${p.unidad}` : ''}
                        {dir === 'alto' && ' ↑ Alto'}{dir === 'bajo' && ' ↓ Bajo'}{fuera && ' * Fuera de lo normal'}
                      </span>
                      {p.observacion && <><br /><small>{p.observacion}</small></>}
                    </td>
                    <td>{referencia(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hoja-nota"><small>Validado por {e.validadoPor?.nombre} el {fechaHora(e.fechaValidacion)}</small></p>
        </section>
      ))}
      {pendientes.length > 0 && (
        <p className="hoja-nota">Pendientes de validar: {pendientes.map((e) => e.nombre).join(', ')}. Se entregarán en otro informe.</p>
      )}
    </DocumentoImprimible>
  );
}

// ------------------------------------------------------- reporte del admin

export function ReporteImprimible({ reporte, periodo, formatear, onCerrar }) {
  return (
    <DocumentoImprimible titulo="Reporte del periodo" numero={`${fecha(periodo.desde)} al ${fecha(periodo.hasta)}`} onCerrar={onCerrar}>
      <table className="tabla-hoja">
        <thead><tr><th>Indicador</th><th className="num">Valor</th><th>Nota</th></tr></thead>
        <tbody>
          {reporte.indicadores.map((i) => (
            <tr key={i.titulo}><td>{i.titulo}</td><td className="num">{formatear(i.valor, i.formato)}</td><td>{i.nota ?? ''}</td></tr>
          ))}
        </tbody>
      </table>
      {reporte.tablas.map((t) => (
        <section key={t.titulo}>
          <h3>{t.titulo}</h3>
          {t.filas.length === 0
            ? <p className="hoja-nota">Sin datos en este periodo.</p>
            : (
              <table className="tabla-hoja">
                <thead><tr>{t.columnas.map((c) => <th key={c.clave} className={c.formato ? 'num' : undefined}>{c.titulo}</th>)}</tr></thead>
                <tbody>
                  {t.filas.map((f, n) => (
                    <tr key={n}>{t.columnas.map((c) => <td key={c.clave} className={c.formato ? 'num' : undefined}>{formatear(f[c.clave], c.formato)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>
      ))}
    </DocumentoImprimible>
  );
}
