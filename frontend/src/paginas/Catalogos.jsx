// Catálogos que mantiene el admin (habitaciones, procedimientos, servicios,
// medicamentos, tipos de examen...). La pantalla se arma con la definición que
// manda el backend (dominio/catalogos.js): qué catálogos tiene la institución,
// sus campos y si se pueden desactivar. Así es igual en las cuatro.

import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconoBuscar, IconoMas } from '../componentes/Iconos.jsx';
import { Alerta, Campo, Cargando, Dialogo, erroresDe, Selector } from '../componentes/ui.jsx';
import { dinero, etiqueta } from '../formato.js';
import { useSesion } from '../sesion.jsx';

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texto de un valor para la lista. `referencias`: catálogo → Map(id → nombre). */
function mostrar(campo, valor, referencias) {
  if (valor == null || valor === '') return null;
  if (campo.tipo === 'dinero') return dinero(valor);
  if (campo.tipo === 'opcion') return etiqueta(valor);
  if (campo.tipo === 'referencia') return referencias[campo.catalogo]?.get(valor) ?? null;
  return String(valor);
}

/** Valor del formulario → valor para la API (vacío = null). */
function aApi(campo, texto) {
  const limpio = String(texto ?? '').trim();
  if (limpio === '') return null;
  return campo.tipo === 'dinero' ? Number(limpio) : limpio;
}

/** Alta o edición de un registro, con los campos del catálogo. */
function DialogoRegistro({ catalogo, registro, referencias, onCerrar, onListo }) {
  const nuevo = !registro;
  const [datos, setDatos] = useState(() => Object.fromEntries(catalogo.campos.map((c) => [c.clave, registro?.[c.clave] ?? ''])));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);
  // Si ya se usó en recetas o cobros, el dato histórico no se cambia (el backend lo revisa igual).
  const bloqueado = (c) => !nuevo && (c.soloAlCrear || (c.historico && registro.nota));

  async function enviar(e) {
    e.preventDefault();
    const valores = Object.fromEntries(catalogo.campos
      .filter((c) => !bloqueado(c))
      .map((c) => [c.clave, aApi(c, datos[c.clave])])
      .filter(([clave, v]) => nuevo || v !== (registro[clave] ?? null)));
    if (!nuevo && Object.keys(valores).length === 0) return onCerrar();
    setEnviando(true);
    setError(null);
    try {
      onListo(nuevo ? await api.crearRegistroCatalogo(catalogo.clave, valores) : await api.actualizarRegistroCatalogo(catalogo.clave, registro.id, valores));
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={nuevo ? `Nuevo: ${catalogo.singular}` : `Editar ${catalogo.singular}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Alerta>{error?.message}</Alerta>
        <div className="rejilla">
          {catalogo.campos.map((c) => {
            const comun = {
              etiqueta: `${c.etiqueta}${c.requerido ? ' *' : ''}`,
              value: datos[c.clave] ?? '',
              onChange: (e) => setDatos({ ...datos, [c.clave]: e.target.value }),
              error: errores[c.clave],
              disabled: bloqueado(c),
            };
            if (c.tipo === 'opcion') {
              return <Selector key={c.clave} {...comun} vacio={c.requerido ? 'Selecciona…' : 'Sin asignar'}
                opciones={c.opciones.map((o) => ({ valor: o, texto: etiqueta(o) }))} />;
            }
            if (c.tipo === 'referencia') {
              return <Selector key={c.clave} {...comun} vacio="Sin asignar"
                opciones={[...(referencias[c.catalogo] ?? new Map())].map(([valor, texto]) => ({ valor, texto }))} />;
            }
            return <Campo key={c.clave} {...comun} maxLength={c.max} {...(c.tipo === 'dinero' && { type: 'number', min: '0', step: '0.01' })} />;
          })}
        </div>
        {!nuevo && catalogo.campos.some(bloqueado) && (
          <small style={{ color: 'var(--tinta-suave)' }}>
            {catalogo.campos.filter(bloqueado).map((c, i) => (i === 0 ? c.etiqueta : c.etiqueta.toLowerCase())).join(' y ')} no se {catalogo.campos.filter(bloqueado).length === 1 ? 'cambia' : 'cambian'}
            {registro.nota && catalogo.campos.some((c) => c.historico && bloqueado(c)) ? ' porque ya se usó: así no se altera lo registrado.' : ' después de registrarlo.'}
          </small>
        )}
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : nuevo ? 'Registrar' : 'Guardar cambios'}</button>
        </footer>
      </form>
    </Dialogo>
  );
}

function DialogoEstado({ catalogo, registro, titulo, onCerrar, onListo }) {
  const desactivar = registro.activo;
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function confirmar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      onListo(await api.cambiarEstadoRegistroCatalogo(catalogo.clave, registro.id, { activo: !desactivar }));
    } catch (err) {
      setError(err);
      setEnviando(false);
    }
  }
  return (
    <Dialogo titulo={`${desactivar ? catalogo.estado.desactivar : catalogo.estado.activar}: ${titulo}`} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={confirmar}>
        <p style={{ margin: 0 }}>
          {desactivar
            ? 'Deja de ofrecerse para lo nuevo. Lo que ya se registró con él se conserva igual.'
            : 'Vuelve a ofrecerse para lo nuevo.'}
        </p>
        <Alerta>{error?.message}</Alerta>
        <footer>
          <button type="button" className="boton boton-secundario" onClick={onCerrar}>Volver</button>
          <button className={`boton ${desactivar ? 'boton-peligro' : 'boton-primario'}`} disabled={enviando}>
            {enviando ? 'Guardando…' : desactivar ? catalogo.estado.desactivar : catalogo.estado.activar}
          </button>
        </footer>
      </form>
    </Dialogo>
  );
}

export function Catalogos() {
  const { usuario } = useSesion();
  const [catalogos, setCatalogos] = useState(null);
  const [actual, setActual] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [referencias, setReferencias] = useState({});
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState('');
  const [dialogo, setDialogo] = useState(null); // { tipo, registro? }
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    api.catalogosAdmin()
      .then((lista) => { setCatalogos(lista); setActual((a) => a ?? lista[0]?.clave ?? null); })
      .catch((e) => setError(e.message));
  }, []);

  const catalogo = catalogos?.find((c) => c.clave === actual);

  const cargar = useCallback(() => {
    if (!catalogo) return;
    setRegistros(null);
    api.registrosCatalogo(catalogo.clave).then(setRegistros).catch((e) => setError(e.message));
    // Los campos que apuntan a otro catálogo (p. ej. el departamento de una habitación).
    for (const otro of new Set(catalogo.campos.filter((c) => c.tipo === 'referencia').map((c) => c.catalogo))) {
      api.registrosCatalogo(otro)
        .then((lista) => setReferencias((r) => ({ ...r, [otro]: new Map(lista.map((x) => [x.id, x.nombre])) })))
        .catch(() => {});
    }
  }, [catalogo]);
  useEffect(cargar, [cargar]);

  const elegir = (clave) => { setActual(clave); setTexto(''); setAviso(null); setError(null); };
  const terminar = (mensaje) => { setDialogo(null); setAviso(mensaje); cargar(); };

  const principal = catalogo?.campos[0];
  const tituloDe = (r) => (catalogo.clave === 'habitaciones' ? `Habitación ${r.numero}` : r[principal.clave]);
  const visibles = (registros ?? []).filter((r) => !texto || catalogo.campos.some((c) => sinTildes(mostrar(c, r[c.clave], referencias)).includes(sinTildes(texto))));

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Catálogos</h1>
          <p>Las listas que se usan al atender, recetar y cobrar en {usuario.institucionNombre}.</p>
        </div>
        {catalogo && !catalogo.sinAlta && (
          <button type="button" className="boton boton-primario" onClick={() => setDialogo({ tipo: 'registro' })}>
            <IconoMas tam={18} /> Nuevo: {catalogo.singular}
          </button>
        )}
      </div>

      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      {!catalogos && !error && <Cargando />}
      {catalogos && !catalogo && <Alerta>{error ?? 'Esta institución no tiene catálogos que administrar.'}</Alerta>}

      {catalogo && (
        <div className="historial-cuerpo">
          <nav className="panel vidrio menu-secciones" aria-label="Catálogos">
            {catalogos.map((c) => (
              <button key={c.clave} type="button" aria-current={c.clave === actual} onClick={() => elegir(c.clave)}>{c.titulo}</button>
            ))}
          </nav>

          <section className="panel vidrio" style={{ display: 'grid', gap: 18 }}>
            <div className="titulo-panel">
              <h2>{catalogo.titulo}</h2>
              {registros && <small style={{ color: 'var(--tinta-suave)' }}>{registros.length} {registros.length === 1 ? 'registro' : 'registros'}</small>}
            </div>
            <div className="buscador">
              <div className="entrada">
                <IconoBuscar tam={18} />
                <input type="search" placeholder="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label={`Buscar en ${catalogo.titulo}`} />
              </div>
            </div>
            <Alerta>{error}</Alerta>
            {!registros && !error && <Cargando />}
            {registros && visibles.length === 0 && <p className="vacio">{registros.length === 0 ? 'Todavía no hay registros.' : 'Nada coincide con la búsqueda.'}</p>}
            <div className="lista-pacientes">
              {visibles.map((r) => (
                <div key={r.id} className={`tarjeta-paciente fila-catalogo${r.activo === false ? ' inactivo' : ''}`}>
                  <span>
                    <strong>{tituloDe(r)}</strong>
                    <br />
                    <small>
                      {catalogo.campos.slice(1).map((c) => mostrar(c, r[c.clave], referencias)).filter(Boolean).join(' · ')}
                    </small>
                  </span>
                  <span className="acciones">
                    {r.nota && <span className="etiqueta etiqueta-gris">{r.nota}</span>}
                    {catalogo.estado && r.activo === false && <span className="etiqueta etiqueta-gris">{catalogo.estado.inactivo}</span>}
                    <button type="button" className="boton boton-secundario boton-chico" onClick={() => setDialogo({ tipo: 'registro', registro: r })}>Editar</button>
                    {catalogo.estado && !r.estadoFijo && (
                      <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setDialogo({ tipo: 'estado', registro: r })}>
                        {r.activo ? catalogo.estado.desactivar : catalogo.estado.activar}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {dialogo?.tipo === 'registro' && (
        <DialogoRegistro catalogo={catalogo} registro={dialogo.registro} referencias={referencias} onCerrar={() => setDialogo(null)}
          onListo={(r) => terminar(dialogo.registro ? `Se guardaron los cambios de ${tituloDe(r)}.` : `Se registró ${tituloDe(r)}.`)} />
      )}
      {dialogo?.tipo === 'estado' && (
        <DialogoEstado catalogo={catalogo} registro={dialogo.registro} titulo={tituloDe(dialogo.registro)} onCerrar={() => setDialogo(null)}
          onListo={(r) => terminar(`${tituloDe(r)}: ${(r.activo ? catalogo.estado.activo : catalogo.estado.inactivo).toLowerCase()}.`)} />
      )}
    </>
  );
}
