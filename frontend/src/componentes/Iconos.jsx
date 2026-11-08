// Iconos de trazo (24×24) dibujados a mano para no depender de una librería.

const Icono = ({ children, tam = 20, ...props }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const IconoCruz = (p) => (
  <Icono {...p}><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></Icono>
);
export const IconoBuscar = (p) => (
  <Icono {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icono>
);
export const IconoMas = (p) => (
  <Icono {...p}><path d="M12 5v14M5 12h14" /></Icono>
);
export const IconoSalir = (p) => (
  <Icono {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></Icono>
);
export const IconoAtras = (p) => (
  <Icono {...p}><path d="M15 18l-6-6 6-6" /></Icono>
);
export const IconoCerrar = (p) => (
  <Icono {...p}><path d="M6 6l12 12M18 6 6 18" /></Icono>
);
export const IconoAlerta = (p) => (
  <Icono {...p}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></Icono>
);

// Una por institución, para el inicio de sesión.
export const IconoHospital = (p) => (
  <Icono {...p}><path d="M4 21V7l8-4 8 4v14" /><path d="M10 21v-4h4v4M12 8v5M9.5 10.5h5" /></Icono>
);
export const IconoDiente = (p) => (
  <Icono {...p}>
    <path d="M7.5 3.5c-2.5 0-4 2-4 4.5 0 3 1.5 4 2 7 .4 2.6 1 5.5 2.5 5.5s1.6-3.5 2-5c.3-1 .7-1.5 2-1.5s1.7.5 2 1.5c.4 1.5.5 5 2 5s2.1-2.9 2.5-5.5c.5-3 2-4 2-7 0-2.5-1.5-4.5-4-4.5-1.7 0-2.6 1-4.5 1s-2.8-1-4.5-1z" />
  </Icono>
);
export const IconoMatraz = (p) => (
  <Icono {...p}><path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7.5 15h9" /></Icono>
);
export const IconoBebe = (p) => (
  <Icono {...p}><circle cx="12" cy="11" r="7" /><path d="M9.5 10h.01M14.5 10h.01M10 13.5a3 3 0 0 0 4 0M12 4c-1 1-1 2 0 2.5" /></Icono>
);

export const ICONO_INSTITUCION = {
  hospital: IconoHospital,
  odontologica: IconoDiente,
  laboratorio: IconoMatraz,
  pediatrico: IconoBebe,
};
