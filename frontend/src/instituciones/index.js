// La interfaz es la misma para las cuatro instituciones; lo único que cambia es
// esta parte, que depende de la INSTITUCIÓN del usuario (nunca del motor).
// Una institución sin vista propia (p. ej. el laboratorio, mientras se integra)
// usa la genérica, que muestra los datos tal como llegan.

import { DatosGenericos, ExtrasGenericos } from './comun.jsx';
import { hospital } from './hospital.jsx';
import { odontologica } from './odontologica.jsx';
import { pediatrico } from './pediatrico.jsx';

const generica = {
  datosIniciales: {},
  preparar: () => ({}),
  conObservaciones: true,
  CamposConsulta: () => null,
  DetalleConsulta: ({ datos }) => DatosGenericos({ datos }),
  Extras: ExtrasGenericos,
};

const VISTAS = { hospital, odontologica, pediatrico };

export const vistaDe = (institucion) => VISTAS[institucion] ?? generica;
