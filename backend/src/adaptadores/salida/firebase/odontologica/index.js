// Adaptador Firebase (Firestore) de la Clínica Odontológica: implementa los
// puertos de puertos/repositorios.js sobre el modelo documental de modelo.js.

import { FieldValue } from 'firebase-admin/firestore';
import { timestampATexto } from '../conexion.js';
import { crearRepositorioAtenciones } from './atenciones.js';
import { COLECCIONES, nombreCompleto, ROLES } from './modelo.js';
import { crearRepositorioPacientes } from './pacientes.js';

const ordenarPorApellido = (a, b) => (a.get('apellidos') ?? '').localeCompare(b.get('apellidos') ?? '', 'es');

export function crearAdaptadorOdontologicaFirebase(db, zonaHoraria) {
  const col = (nombre) => db.collection(COLECCIONES[nombre]);

  return {
    usuarios: {
      async buscarPorCorreo(correo) {
        const snap = await col('usuarios').where('correo', '==', correo).limit(1).get();
        const u = snap.docs[0];
        return u && {
          id: u.id,
          correo: u.get('correo'),
          passwordHash: u.get('password_hash'),
          nombre: nombreCompleto(u.data()),
          // Los roles de la clínica se traducen a los comunes de casos-uso.js.
          rol: ROLES[u.get('rol')] ?? u.get('rol'),
          medicoId: u.get('odontologo_id') ?? null,
          activo: Boolean(u.get('activo')),
        };
      },
      async registrarAcceso(usuarioId) {
        await col('usuarios').doc(usuarioId).update({ ultimo_acceso: FieldValue.serverTimestamp() });
      },
    },

    // Puerto opcional: citas del odontólogo en un día. Solo se filtra por
    // odontólogo en Firestore (sin índice compuesto); el día se filtra aquí.
    agenda: {
      async citasDelMedico(odontologoId, fecha) {
        const snap = await col('citas').where('odontologo.id', '==', odontologoId).get();
        return snap.docs
          .map((c) => ({
            id: c.id,
            fechaHora: timestampATexto(c.get('fecha_hora'), zonaHoraria),
            duracionMin: c.get('duracion_min') ?? null,
            estado: c.get('estado'),
            motivo: c.get('motivo') ?? null,
            paciente: { id: c.get('paciente.id'), nombre: nombreCompleto(c.get('paciente')) },
          }))
          .filter((c) => c.fechaHora?.startsWith(fecha))
          .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
      },
    },

    pacientes: crearRepositorioPacientes(db, zonaHoraria),
    atenciones: crearRepositorioAtenciones(db, zonaHoraria),

    // Puerto propio de la clínica (fuera del contrato común).
    odontologica: {
      async listarProcedimientos() {
        const snap = await col('procedimientos').where('activo', '==', true).get();
        return snap.docs
          .map((d) => ({ id: d.id, nombre: d.get('nombre'), descripcion: d.get('descripcion') ?? null, costo: Number(d.get('costo') ?? 0) }))
          .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
      },
    },

    catalogos: {
      async listarMedicos() {
        const snap = await col('odontologos').where('activo', '==', true).get();
        return snap.docs.sort(ordenarPorApellido).map((d) => ({
          id: d.id,
          nombre: nombreCompleto(d.data()),
          especialidad: 'Odontología',
        }));
      },
      async listarMedicamentos() {
        const snap = await col('medicamentos').where('activo', '==', true).get();
        return snap.docs
          .map((d) => ({ id: d.id, nombre: d.get('nombre'), presentacion: d.get('presentacion') }))
          .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es') || (a.presentacion ?? '').localeCompare(b.presentacion ?? '', 'es'));
      },
    },
  };
}
