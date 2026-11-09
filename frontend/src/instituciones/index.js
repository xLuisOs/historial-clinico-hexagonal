// La interfaz es la misma para las cuatro instituciones; lo único que cambia es
// esta parte, que depende de la INSTITUCIÓN del usuario (nunca del motor).
// Una institución sin vista propia usa la genérica, que muestra los datos tal
// como llegan. Cada vista define:
//   * datosIniciales, preparar, CamposConsulta, DetalleConsulta: la consulta.
//   * Resumen (opcional): lo que va arriba, junto a las próximas citas.
//   * secciones: botones del menú del historial, después de "Consultas".
//     { id, titulo, Componente, visible?(ctx), insignia?(ctx), alerta? }
//     ctx = { extras, paciente, consultas, usuario, recargar, administrativa }
//   * textos (opcional): lo que en esa institución se llama distinto (en el
//     laboratorio, la consulta es una orden de examen).

import { DatosGenericos, ExtrasGenericos } from './comun.jsx';
import { hospital } from './hospital.jsx';
import { laboratorio } from './laboratorio.jsx';
import { odontologica } from './odontologica.jsx';
import { pediatrico } from './pediatrico.jsx';

const TEXTOS = {
  nuevaConsulta: 'Nueva consulta',
  tituloNueva: 'Nueva consulta',
  guardar: 'Registrar consulta',
  consultas: 'Consultas',
  motivo: 'Motivo de la consulta',
  diagnosticos: 'Diagnósticos',
  receta: 'Receta',
  recetaAyuda: 'Opcional. También se puede recetar después, desde el historial.',
  conReceta: 'Emitir receta',
  botonReceta: 'Receta',
  sinMotivo: 'Consulta',
  notaAdministrativa: 'Vista administrativa: diagnósticos, recetas, tratamientos y antecedentes solo los ve el personal médico.',
};

const generica = {
  datosIniciales: {},
  preparar: () => ({}),
  conObservaciones: true,
  CamposConsulta: () => null,
  DetalleConsulta: ({ datos }) => DatosGenericos({ datos }),
  secciones: [{ id: 'otros', titulo: 'Otros datos', Componente: ExtrasGenericos }],
};

const VISTAS = { hospital, laboratorio, odontologica, pediatrico };

export const vistaDe = (institucion) => {
  const vista = VISTAS[institucion] ?? generica;
  return { secciones: [], ...vista, textos: { ...TEXTOS, ...vista.textos } };
};
