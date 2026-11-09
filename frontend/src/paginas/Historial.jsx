import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { IconoAlerta, IconoAtras, IconoMas } from '../componentes/Iconos.jsx';
import { Alerta, Cargando, iniciales } from '../componentes/ui.jsx';
import { edad, etiqueta, fecha, fechaHora, MOTIVOS_BAJA, nombreCompleto, SEXO } from '../formato.js';
import { vistaDe } from '../instituciones/index.js';
import { puede, useSesion } from '../sesion.jsx';
import { DialogoAntecedente, PanelAntecedentes } from './Antecedentes.jsx';
import { DialogoAgendar, DialogoCancelarCita, DialogoReprogramar, PanelCitas } from './Citas.jsx';
import { DialogoBaja, DialogoContacto, DialogoDiagnostico, DialogoReceta } from './Dialogos.jsx';

const Dato = ({ titulo, children }) => (
  <div className="dato"><small>{titulo}</small><span>{children || '—'}</span></div>
);

function Consulta({ consulta, vista, usuario, recargar, puedeAtender, onDiagnostico, onReceta }) {
  const { DetalleConsulta } = vista;
  return (
    <article className="consulta">
      <div className="consulta-cabecera">
        <div>
          <h3>{consulta.motivo || vista.textos.sinMotivo}</h3>
          <small>{fechaHora(consulta.fecha)} · {consulta.medico?.nombre}</small>
        </div>
        {puedeAtender && (
          <div className="acciones">
            <button type="button" className="boton boton-secundario boton-chico" onClick={onDiagnostico}>+ Diagnóstico</button>
            <button type="button" className="boton boton-secundario boton-chico" onClick={onReceta}>+ {vista.textos.botonReceta}</button>
          </div>
        )}
      </div>

      {consulta.observaciones && <p>{consulta.observaciones}</p>}

      <div className="bloque">
        <h4>Diagnósticos</h4>
        <ul className="items">
          {consulta.diagnosticos.map((d) => (
            <li key={d.id}>
              {d.codigoCie10 && <span className="codigo">{d.codigoCie10}</span>}
              <span>{d.descripcion}</span>
              {d.tipo === 'principal' && <span className="etiqueta">principal</span>}
            </li>
          ))}
        </ul>
      </div>

      <DetalleConsulta datos={consulta.datosEspecificos ?? {}} consulta={consulta} usuario={usuario} recargar={recargar} />

      {consulta.receta && (
        <div className="bloque">
          <h4>{vista.textos.receta} · {fecha(consulta.receta.fechaEmision)}</h4>
          <ul className="items">
            {consulta.receta.items.map((i) => (
              <li key={i.id}>
                <strong>{i.medicamento}</strong>
                <small>{i.dosis}, {i.frecuencia}, {i.duracionDias} {i.duracionDias === 1 ? 'día' : 'días'} · vía {i.via}</small>
                {i.indicaciones && <small>· {i.indicaciones}</small>}
              </li>
            ))}
          </ul>
          {consulta.receta.indicaciones && <small style={{ color: 'var(--tinta-suave)' }}>{consulta.receta.indicaciones}</small>}
        </div>
      )}
    </article>
  );
}

export function Historial() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const vista = vistaDe(usuario.institucion);
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState(null);
  const [dialogo, setDialogo] = useState(null); // { tipo, consulta?, cita? }
  const [versionCitas, setVersionCitas] = useState(0);

  const cargar = useCallback(() => {
    api.historial(id).then((h) => { setHistorial(h); setError(null); }).catch(setError);
  }, [id]);
  useEffect(cargar, [cargar]);

  if (!historial) {
    return error
      ? <><Link to="/" className="volver"><IconoAtras tam={16} /> Pacientes</Link><Alerta>{error.message}</Alerta></>
      : <Cargando />;
  }

  const { paciente, consultas, extras } = historial;
  const activo = paciente.estado.activo;
  const puedeAtender = activo && puede(usuario, 'atender');
  const alListo = () => { setDialogo(null); cargar(); setVersionCitas((v) => v + 1); };
  const conAgenda = usuario.institucion !== 'laboratorio'; // el laboratorio trabaja con órdenes
  const puedeAgendar = activo && conAgenda && puede(usuario, 'agendar');
  const { Extras } = vista;

  return (
    <>
      <div className="encabezado">
        <Link to="/" className="volver"><IconoAtras tam={16} /> Pacientes</Link>
      </div>

      <section className="panel vidrio ficha">
        <span className="avatar">{iniciales(paciente)}</span>
        <div>
          <div className="titulo-panel">
            <div className="ficha-titulo">
              <h1>{nombreCompleto(paciente)}</h1>
              {activo
                ? <span className="etiqueta etiqueta-exito">Activo</span>
                : <span className="etiqueta etiqueta-gris">Archivado</span>}
            </div>
            <div className="acciones">
              {puedeAtender && (
                <Link to={`/pacientes/${id}/consulta`} className="boton boton-primario"><IconoMas tam={18} /> {vista.textos.nuevaConsulta}</Link>
              )}
              {puedeAgendar && (
                <button type="button" className="boton boton-primario" onClick={() => setDialogo({ tipo: 'agendar' })}><IconoMas tam={18} /> Agendar cita</button>
              )}
              {activo && puede(usuario, 'actualizarContacto') && (
                <button type="button" className="boton boton-secundario" onClick={() => setDialogo({ tipo: 'contacto' })}>Actualizar contacto</button>
              )}
              {activo && puede(usuario, 'darDeBaja') && (
                <button type="button" className="boton boton-secundario" onClick={() => setDialogo({ tipo: 'baja' })}>Archivar</button>
              )}
            </div>
          </div>

          {!activo && (
            <div style={{ marginTop: 14 }}>
              <Alerta tipo="aviso">
                Archivado el {fecha(paciente.estado.fechaBaja)} por {(MOTIVOS_BAJA[paciente.estado.motivoBaja] ?? paciente.estado.motivoBaja)?.toLowerCase()}
                {paciente.estado.detalleBaja ? `: ${paciente.estado.detalleBaja}` : '.'}
              </Alerta>
            </div>
          )}

          <div className="datos">
            <Dato titulo="Edad">{edad(paciente.fechaNacimiento)} ({fecha(paciente.fechaNacimiento)})</Dato>
            <Dato titulo="Sexo">{SEXO[paciente.sexo]}</Dato>
            <Dato titulo="Documento">{paciente.documento}</Dato>
            <Dato titulo="Tipo de sangre">{paciente.datosClinicos?.tipoSangre}</Dato>
            <Dato titulo="Teléfono">{paciente.contacto?.telefono}</Dato>
            <Dato titulo="Dirección">{paciente.contacto?.direccion}</Dato>
            {paciente.contacto?.correo && <Dato titulo="Correo">{paciente.contacto.correo}</Dato>}
            {paciente.responsable && (
              <Dato titulo={`Responsable (${etiqueta(paciente.responsable.parentesco)})`}>
                {nombreCompleto(paciente.responsable)} · {paciente.responsable.telefono}
              </Dato>
            )}
            <Dato titulo="Registrado">{fecha(paciente.estado.fechaRegistro)}</Dato>
          </div>

          {paciente.datosClinicos?.alergias && (
            <div className="alergias">
              <span className="etiqueta etiqueta-peligro"><IconoAlerta tam={14} /> Alergias</span>
              <strong>{paciente.datosClinicos.alergias}</strong>
            </div>
          )}
        </div>
      </section>

      {Array.isArray(historial.antecedentes) && (
        <PanelAntecedentes antecedentes={historial.antecedentes} puedeAgregar={puedeAtender}
          onAgregar={() => setDialogo({ tipo: 'antecedente' })} />
      )}

      <div className="columnas">
        <section className="panel vidrio">
          <div className="titulo-panel">
            <h2>{vista.textos.consultas}</h2>
            <small style={{ color: 'var(--tinta-suave)' }}>{consultas.length} {consultas.length === 1 ? 'registro' : 'registros'}</small>
          </div>
          {consultas.length === 0
            ? <p className="vacio">Todavía no hay consultas registradas.</p>
            : (
              <div className="linea-tiempo">
                {consultas.map((c) => (
                  <Consulta key={c.id} consulta={c} vista={vista} usuario={usuario} recargar={cargar} puedeAtender={puedeAtender}
                    onDiagnostico={() => setDialogo({ tipo: 'diagnostico', consulta: c })}
                    onReceta={() => setDialogo({ tipo: 'receta', consulta: c })} />
                ))}
              </div>
            )}
        </section>

        <div className="pila">
          {conAgenda && (
            <PanelCitas pacienteId={id} puedeAgendar={puedeAgendar} version={versionCitas}
              onReprogramar={(cita) => setDialogo({ tipo: 'reprogramar', cita })}
              onCancelar={(cita) => setDialogo({ tipo: 'cancelarCita', cita })} />
          )}
          <Extras extras={extras ?? {}} paciente={paciente} consultas={consultas} usuario={usuario} recargar={cargar} />
        </div>
      </div>

      {dialogo?.tipo === 'antecedente' && <DialogoAntecedente pacienteId={id} onCerrar={() => setDialogo(null)} onListo={alListo} />}
      {dialogo?.tipo === 'contacto' && <DialogoContacto paciente={paciente} onCerrar={() => setDialogo(null)} onListo={alListo} />}
      {dialogo?.tipo === 'baja' && <DialogoBaja paciente={paciente} onCerrar={() => setDialogo(null)} onListo={alListo} />}
      {dialogo?.tipo === 'diagnostico' && <DialogoDiagnostico consulta={dialogo.consulta} onCerrar={() => setDialogo(null)} onListo={alListo} />}
      {dialogo?.tipo === 'agendar' && <DialogoAgendar paciente={paciente} institucion={usuario.institucion} onCerrar={() => setDialogo(null)} onListo={alListo} />}
      {dialogo?.tipo === 'reprogramar' && <DialogoReprogramar cita={dialogo.cita} institucion={usuario.institucion} onCerrar={() => setDialogo(null)} onListo={alListo} />}
      {dialogo?.tipo === 'cancelarCita' && <DialogoCancelarCita cita={dialogo.cita} onCerrar={() => setDialogo(null)} onListo={alListo} />}
      {dialogo?.tipo === 'receta' && <DialogoReceta consulta={dialogo.consulta} onCerrar={() => setDialogo(null)} onListo={alListo} />}
    </>
  );
}
