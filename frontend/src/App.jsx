import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Barra } from './componentes/Barra.jsx';
import { Agenda } from './paginas/Agenda.jsx';
import { Historial } from './paginas/Historial.jsx';
import { Login } from './paginas/Login.jsx';
import { Medicos } from './paginas/Medicos.jsx';
import { NuevaConsulta } from './paginas/NuevaConsulta.jsx';
import { NuevoPaciente } from './paginas/NuevoPaciente.jsx';
import { Pacientes } from './paginas/Pacientes.jsx';
import { Recepcionistas } from './paginas/Recepcionistas.jsx';
import { ProveedorSesion, useSesion } from './sesion.jsx';

const Manchas = () => (
  <div className="manchas" aria-hidden="true"><span /><span /><span /></div>
);

/** Todo lo de adentro requiere sesión; sin ella se va al inicio de sesión. */
function ConSesion() {
  const { usuario } = useSesion();
  if (!usuario) return <Navigate to="/login" replace />;
  return (
    <>
      <Barra />
      <main className="contenido">
        <Outlet />
      </main>
    </>
  );
}

function SoloSinSesion() {
  const { usuario } = useSesion();
  return usuario ? <Navigate to="/" replace /> : <Login />;
}

export function App() {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Manchas />
        <Routes>
          <Route path="/login" element={<SoloSinSesion />} />
          <Route element={<ConSesion />}>
            <Route index element={<Pacientes />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="medicos" element={<Medicos />} />
            <Route path="recepcionistas" element={<Recepcionistas />} />
            <Route path="pacientes/nuevo" element={<NuevoPaciente />} />
            <Route path="pacientes/:id" element={<Historial />} />
            <Route path="pacientes/:id/consulta" element={<NuevaConsulta />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  );
}
