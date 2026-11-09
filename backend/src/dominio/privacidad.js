// Qué parte del historial ve cada rol (mínimo privilegio).
//
// La recepción agenda, cobra, factura y actualiza contactos: para eso no
// necesita los datos clínicos. Recibe una vista administrativa del historial
// con la ficha, las alergias (dato de seguridad), las citas y lo que se cobra,
// sin diagnósticos, recetas, notas, tratamientos ni antecedentes.
//
// Se recorta aquí, en el backend, y no solo en la pantalla: aunque alguien
// llame directo a la API con un token de recepción, no obtiene esos datos.
// Depende de la institución (qué se cobra en cada una), nunca del motor.

const RECORTE_POR_INSTITUCION = {
  hospital: {
    // Si fue emergencia sirve para facturar; los tratamientos son clínicos.
    consulta: ({ esEmergencia = false } = {}) => ({ esEmergencia }),
    extras: ({ internamientos = [], facturas = [], proximasCitas = [] } = {}) => ({
      // Para facturar el encamamiento basta con habitación, fechas y médico responsable.
      internamientos: internamientos.map((i) => ({
        id: i.id,
        fechaIngreso: i.fechaIngreso,
        fechaAlta: i.fechaAlta,
        estado: i.estado,
        habitacion: i.habitacion,
        medicoResponsable: i.medicoResponsable,
        medicoResponsableId: i.medicoResponsableId,
      })),
      facturas,
      proximasCitas,
    }),
  },

  odontologica: {
    // Lo que se cobra: procedimientos con su precio, total y pagos.
    consulta: ({ procedimientos = [], total = 0, estadoPago = null, pagos = [] } = {}) => ({
      procedimientos: procedimientos.map((p) => ({
        procedimientoId: p.procedimientoId,
        nombre: p.nombre,
        piezaDental: p.piezaDental,
        precioAplicado: p.precioAplicado,
      })),
      total,
      estadoPago,
      pagos,
    }),
    // Sin el historial dental por pieza: es clínico.
    extras: ({ cuenta = null, proximasCitas = [] } = {}) => ({ cuenta, proximasCitas }),
  },
};

const conVistaAdministrativa = ({ rol, institucion }) => rol === 'recepcion' && Boolean(RECORTE_POR_INSTITUCION[institucion]);

/** Paciente sin datos clínicos para la recepción; solo conserva las alergias. */
export function pacienteParaRol(paciente, usuario) {
  if (!paciente || !conVistaAdministrativa(usuario)) return paciente;
  return { ...paciente, datosClinicos: { alergias: paciente.datosClinicos?.alergias ?? null } };
}

/** Devuelve el historial tal cual, o la vista administrativa si el rol es recepción. */
export function historialParaRol(historial, usuario) {
  if (!conVistaAdministrativa(usuario)) return historial;
  const recorte = RECORTE_POR_INSTITUCION[usuario.institucion];

  const { paciente, consultas = [], extras } = historial;
  return {
    vista: 'administrativa',
    paciente: pacienteParaRol(paciente, usuario),
    consultas: consultas.map((c) => ({
      id: c.id,
      citaId: c.citaId,
      fecha: c.fecha,
      medico: c.medico,
      motivo: null,
      observaciones: null,
      diagnosticos: [],
      receta: null,
      datosEspecificos: recorte.consulta(c.datosEspecificos),
    })),
    extras: recorte.extras(extras),
  };
}
