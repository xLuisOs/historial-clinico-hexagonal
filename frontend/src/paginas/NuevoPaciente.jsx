import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { IconoAtras } from '../componentes/Iconos.jsx';
import { Alerta, Campo, erroresDe, Selector } from '../componentes/ui.jsx';
import { etiqueta, parentescosPara, SEXO, TIPOS_SANGRE } from '../formato.js';
import { useSesion } from '../sesion.jsx';

// Si cada institución pide, permite o no registra un responsable del paciente.
const RESPONSABLE = { pediatrico: 'obligatorio', odontologica: 'no', hospital: 'opcional', laboratorio: 'opcional' };

const INICIAL = {
  nombres: '', apellidos: '', fechaNacimiento: '', sexo: '', documento: '',
  telefono: '', direccion: '', correo: '', tipoSangre: '', alergias: '',
};
const RESPONSABLE_INICIAL = { nombres: '', apellidos: '', parentesco: '', documento: '', telefono: '', direccion: '' };

const vacioANulo = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]));

export function NuevoPaciente() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const regla = RESPONSABLE[usuario.institucion] ?? 'opcional';
  const [datos, setDatos] = useState(INICIAL);
  const [conResponsable, setConResponsable] = useState(regla === 'obligatorio');
  const [responsable, setResponsable] = useState(RESPONSABLE_INICIAL);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = erroresDe(error);

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const cambiarResp = (campo) => (e) => setResponsable({ ...responsable, [campo]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const d = vacioANulo(datos);
    try {
      const paciente = await api.registrarPaciente({
        nombres: d.nombres,
        apellidos: d.apellidos,
        fechaNacimiento: d.fechaNacimiento,
        sexo: d.sexo,
        documento: d.documento,
        contacto: { telefono: d.telefono, direccion: d.direccion, correo: d.correo },
        datosClinicos: { tipoSangre: d.tipoSangre, alergias: d.alergias },
        responsable: conResponsable ? vacioANulo(responsable) : null,
      });
      navegar(`/pacientes/${paciente.id}`);
    } catch (err) {
      setError(err);
      setEnviando(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <Link to="/" className="volver"><IconoAtras tam={16} /> Pacientes</Link>
          <h1 style={{ marginTop: 8 }}>Nuevo paciente</h1>
          <p>Se crea su historial clínico en {usuario.institucionNombre}.</p>
        </div>
      </div>

      <form className="panel vidrio formulario" onSubmit={guardar} noValidate>
        <Alerta>{error?.message}</Alerta>

        <section className="seccion-form">
          <header><h2>Datos personales</h2></header>
          <div className="rejilla">
            <Campo etiqueta="Nombres *" value={datos.nombres} onChange={cambiar('nombres')} error={errores.nombres} />
            <Campo etiqueta="Apellidos *" value={datos.apellidos} onChange={cambiar('apellidos')} error={errores.apellidos} />
            <Campo etiqueta="Fecha de nacimiento *" type="date" value={datos.fechaNacimiento}
              onChange={cambiar('fechaNacimiento')} error={errores.fechaNacimiento} />
            <Selector etiqueta="Sexo *" value={datos.sexo} onChange={cambiar('sexo')} error={errores.sexo}
              opciones={Object.entries(SEXO).map(([valor, texto]) => ({ valor, texto }))} />
            <Campo etiqueta="Documento (CUI/DPI)" inputMode="numeric" maxLength={13} value={datos.documento}
              onChange={cambiar('documento')} error={errores.documento} placeholder="13 dígitos" />
          </div>
        </section>

        <section className="seccion-form">
          <header><h2>Contacto</h2></header>
          <div className="rejilla">
            <Campo etiqueta="Teléfono" type="tel" value={datos.telefono} onChange={cambiar('telefono')} error={errores['contacto.telefono']} />
            <Campo etiqueta="Dirección" value={datos.direccion} onChange={cambiar('direccion')} error={errores['contacto.direccion']} />
            <Campo etiqueta="Correo" type="email" value={datos.correo} onChange={cambiar('correo')} error={errores['contacto.correo']} />
          </div>
        </section>

        <section className="seccion-form">
          <header><h2>Datos clínicos</h2></header>
          <div className="rejilla">
            <Selector etiqueta="Tipo de sangre" value={datos.tipoSangre} onChange={cambiar('tipoSangre')}
              error={errores['datosClinicos.tipoSangre']} vacio="Sin registrar"
              opciones={TIPOS_SANGRE.map((t) => ({ valor: t, texto: t }))} />
            <Campo etiqueta="Alergias" value={datos.alergias} onChange={cambiar('alergias')}
              error={errores['datosClinicos.alergias']} placeholder="Ej. Penicilina" />
          </div>
        </section>

        {regla !== 'no' && (
          <section className="seccion-form">
            <header>
              <div>
                <h2>Responsable</h2>
                <p>{regla === 'obligatorio' ? 'Obligatorio: el paciente es menor de edad.' : 'Opcional: familiar o tutor a cargo.'}</p>
              </div>
              {regla === 'opcional' && (
                <label className="check">
                  <input type="checkbox" checked={conResponsable} onChange={(e) => setConResponsable(e.target.checked)} />
                  Registrar responsable
                </label>
              )}
            </header>
            {conResponsable && (
              <div className="rejilla">
                <Campo etiqueta="Nombres *" value={responsable.nombres} onChange={cambiarResp('nombres')} error={errores['responsable.nombres']} />
                <Campo etiqueta="Apellidos *" value={responsable.apellidos} onChange={cambiarResp('apellidos')} error={errores['responsable.apellidos']} />
                <Selector etiqueta="Parentesco *" value={responsable.parentesco} onChange={cambiarResp('parentesco')}
                  error={errores['responsable.parentesco']} opciones={parentescosPara(usuario.institucion).map((p) => ({ valor: p, texto: etiqueta(p) }))} />
                <Campo etiqueta="DPI *" inputMode="numeric" maxLength={13} value={responsable.documento}
                  onChange={cambiarResp('documento')} error={errores['responsable.documento']} />
                <Campo etiqueta="Teléfono *" type="tel" value={responsable.telefono} onChange={cambiarResp('telefono')} error={errores['responsable.telefono']} />
                <Campo etiqueta="Dirección" value={responsable.direccion} onChange={cambiarResp('direccion')} error={errores['responsable.direccion']} />
              </div>
            )}
          </section>
        )}

        <div className="acciones" style={{ justifyContent: 'flex-end' }}>
          <Link to="/" className="boton boton-secundario">Cancelar</Link>
          <button className="boton boton-primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar paciente'}</button>
        </div>
      </form>
    </>
  );
}
