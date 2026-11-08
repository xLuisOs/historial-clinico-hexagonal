import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ICONO_INSTITUCION, IconoCruz } from '../componentes/Iconos.jsx';
import { Alerta, Campo } from '../componentes/ui.jsx';
import { useSesion } from '../sesion.jsx';

const MOTOR = { postgresql: 'PostgreSQL', firebase: 'Firebase', mongodb: 'MongoDB', mysql: 'MySQL' };

export function Login() {
  const { iniciar } = useSesion();
  const [instituciones, setInstituciones] = useState([]);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.instituciones().then(setInstituciones).catch(() => {});
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await iniciar(correo, password);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <div className="login-caja">
        <section className="login-intro vidrio">
          <span className="marca-icono" style={{ width: 48, height: 48, borderRadius: 16 }}><IconoCruz tam={24} /></span>
          <h1>Historial clínico compartido</h1>
          <p>
            Una sola plataforma para cuatro instituciones. Cada una guarda sus datos en su propio
            motor de base de datos; al iniciar sesión, tu correo decide a cuál te conectas.
          </p>
          <div className="instituciones">
            {instituciones.map((i) => {
              const Icono = ICONO_INSTITUCION[i.clave] ?? IconoCruz;
              return (
                <div className="institucion" key={i.clave}>
                  <span className="icono"><Icono tam={24} /></span>
                  <strong>{i.nombre}</strong>
                  <small>@{i.dominio} · {MOTOR[i.motor] ?? i.motor}</small>
                </div>
              );
            })}
          </div>
        </section>

        <form className="login-form vidrio" onSubmit={entrar}>
          <div>
            <h2>Iniciar sesión</h2>
            <p style={{ color: 'var(--tinta-suave)', marginTop: 6 }}>Usa el correo de tu institución.</p>
          </div>
          <Campo etiqueta="Correo" type="email" autoComplete="username" required
            value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@hospital.gt" />
          <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <Alerta>{error}</Alerta>
          <button className="boton boton-primario" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
