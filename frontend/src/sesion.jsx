import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, guardarSesion, leerSesion } from './api.js';

const ContextoSesion = createContext(null);

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(leerSesion);

  const iniciar = useCallback(async (correo, password) => {
    const nueva = await api.login(correo, password);
    guardarSesion(nueva);
    setSesion(nueva);
  }, []);

  const cerrar = useCallback(() => {
    guardarSesion(null);
    setSesion(null);
  }, []);

  // Si el backend responde 401 (token vencido), se vuelve al inicio de sesión.
  useEffect(() => {
    window.addEventListener('sesion-vencida', cerrar);
    return () => window.removeEventListener('sesion-vencida', cerrar);
  }, [cerrar]);

  return (
    <ContextoSesion.Provider value={{ usuario: sesion?.usuario ?? null, iniciar, cerrar }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export const useSesion = () => useContext(ContextoSesion);

/** Qué puede hacer cada rol. El backend lo vuelve a verificar; esto solo oculta botones. */
export const PERMISOS = {
  registrarPaciente: ['recepcion', 'medico', 'admin'],
  actualizarContacto: ['recepcion', 'admin'],
  darDeBaja: ['admin'],
  agendar: ['recepcion', 'admin'],
  atender: ['medico'],
  internar: ['medico'],
  cobrar: ['recepcion', 'admin'],
  facturar: ['recepcion', 'admin'],
  anularFactura: ['admin'],
};

export const puede = (usuario, accion) => PERMISOS[accion]?.includes(usuario?.rol) ?? false;

export const NOMBRE_ROL = { medico: 'Médico', recepcion: 'Recepción', admin: 'Administración' };
