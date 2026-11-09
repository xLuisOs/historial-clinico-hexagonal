import { ahoraEnGuatemala, ESTADOS_PENDIENTES } from '../../../../dominio/cita.js';
import { Conflicto, NoEncontrado } from '../../../../dominio/errores.js';
import { enTransaccion, timestampATexto } from '../conexion.js';
import { COLECCIONES, nombreCompleto } from './modelo.js';

// Odontólogos de la clínica, administrados por el admin (ver dominio/medico.js).
// Firestore no tiene UNIQUE ni JOIN: la revisión de colegiado y correo repetidos
// se hace con consultas DENTRO de la transacción, y el odontólogo y su usuario
// se escriben juntos al final. Si otra operación toca los mismos documentos a la
// vez (p. ej. agendar, que lee el documento del odontólogo en su transacción),
// Firestore reintenta y la segunda ve el cambio de la primera.

export function crearRepositorioPersonal(db, zonaHoraria) {
  const col = (nombre) => db.collection(COLECCIONES[nombre]);

  const aMedico = (odontologo, usuario) => ({
    id: odontologo.id,
    nombre: nombreCompleto(odontologo.data()),
    nombres: odontologo.get('nombres'),
    apellidos: odontologo.get('apellidos'),
    numeroColegiado: odontologo.get('numero_colegiado'),
    especialidad: odontologo.get('especialidad') ?? 'Odontología',
    telefono: odontologo.get('telefono') ?? null,
    correo: usuario?.get('correo') ?? null,
    activo: odontologo.get('activo') !== false,
  });

  // Usuario del odontólogo: dentro de una transacción se lee con t.get(); fuera, con .get().
  const usuarioDe = (odontologoId, t = null) => {
    const consulta = col('usuarios').where('odontologo_id', '==', odontologoId).limit(1);
    return t ? t.get(consulta) : consulta.get();
  };

  async function exigirOdontologo(t, id) {
    const snap = await t.get(col('odontologos').doc(id));
    if (!snap.exists) throw new NoEncontrado('Odontólogo no encontrado');
    return snap;
  }

  return {
    async listarPersonal() {
      const [odontologos, usuarios] = await Promise.all([
        col('odontologos').get(),
        col('usuarios').where('rol', '==', 'odontologo').get(),
      ]);
      const porOdontologo = new Map(usuarios.docs.map((u) => [u.get('odontologo_id'), u]));
      return odontologos.docs
        .map((d) => aMedico(d, porOdontologo.get(d.id)))
        .sort((a, b) => b.activo - a.activo || (a.apellidos ?? '').localeCompare(b.apellidos ?? '', 'es'));
    },

    registrarMedico(m) {
      return enTransaccion(db, async (t) => {
        const [colegiado, correo] = await Promise.all([
          t.get(col('odontologos').where('numero_colegiado', '==', m.numeroColegiado).limit(1)),
          t.get(col('usuarios').where('correo', '==', m.correo).limit(1)),
        ]);
        if (!colegiado.empty) throw new Conflicto('Ya hay un odontólogo con ese número de colegiado');
        if (!correo.empty) throw new Conflicto('Ya hay un usuario con ese correo');

        const odontologo = col('odontologos').doc();
        const datos = {
          nombres: m.nombres,
          apellidos: m.apellidos,
          numero_colegiado: m.numeroColegiado,
          especialidad: m.especialidad,
          telefono: m.telefono,
          activo: true,
        };
        t.set(odontologo, datos);
        t.set(col('usuarios').doc(), {
          correo: m.correo,
          password_hash: m.passwordHash,
          nombres: m.nombres,
          apellidos: m.apellidos,
          rol: 'odontologo',
          odontologo_id: odontologo.id,
          recepcionista_id: null,
          activo: true,
          ultimo_acceso: null,
        });
        return {
          id: odontologo.id, nombre: `${m.nombres} ${m.apellidos}`, nombres: m.nombres, apellidos: m.apellidos,
          numeroColegiado: m.numeroColegiado, especialidad: m.especialidad, telefono: m.telefono, correo: m.correo, activo: true,
        };
      });
    },

    async actualizarMedico(id, cambios) {
      await enTransaccion(db, async (t) => {
        const actual = await exigirOdontologo(t, id);
        const [colegiado, usuario] = await Promise.all([
          cambios.numeroColegiado ? t.get(col('odontologos').where('numero_colegiado', '==', cambios.numeroColegiado)) : null,
          usuarioDe(id, t),
        ]);
        if (colegiado?.docs.some((d) => d.id !== id)) throw new Conflicto('Ya hay un odontólogo con ese número de colegiado');

        const campos = { nombres: 'nombres', apellidos: 'apellidos', numeroColegiado: 'numero_colegiado', especialidad: 'especialidad', telefono: 'telefono' };
        const datos = Object.fromEntries(Object.entries(cambios).filter(([c]) => campos[c]).map(([c, v]) => [campos[c], v]));
        t.update(actual.ref, datos);
        // El usuario guarda una copia del nombre (es lo que se muestra al iniciar sesión).
        const nombre = { nombres: datos.nombres ?? actual.get('nombres'), apellidos: datos.apellidos ?? actual.get('apellidos') };
        if (!usuario.empty) t.update(usuario.docs[0].ref, nombre);
      });
      const [odontologo, usuario] = await Promise.all([col('odontologos').doc(id).get(), usuarioDe(id)]);
      return aMedico(odontologo, usuario.docs[0]);
    },

    async restablecerPassword(id, passwordHash) {
      const usuario = await usuarioDe(id);
      if (usuario.empty) throw new NoEncontrado('Ese odontólogo no tiene usuario');
      await usuario.docs[0].ref.update({ password_hash: passwordHash });
    },

    async cambiarEstadoMedico(id, activo) {
      await enTransaccion(db, async (t) => {
        const odontologo = await exigirOdontologo(t, id);
        const [citas, usuario] = await Promise.all([
          activo ? null : t.get(col('citas').where('odontologo.id', '==', id)),
          usuarioDe(id, t),
        ]);
        if (!activo) {
          const ahora = ahoraEnGuatemala();
          const pendientes = citas.docs
            .map((c) => ({ id: c.id, estado: c.get('estado'), fechaHora: timestampATexto(c.get('fecha_hora'), zonaHoraria), paciente: nombreCompleto(c.get('paciente')) }))
            .filter((c) => ESTADOS_PENDIENTES.includes(c.estado) && c.fechaHora >= ahora)
            .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
          if (pendientes.length > 0) {
            throw new Conflicto(
              `No se puede desactivar: tiene ${pendientes.length} ${pendientes.length === 1 ? 'cita pendiente' : 'citas pendientes'}. Reprográmalas o cancélalas primero.`,
              { citas: pendientes.map(({ estado, ...c }) => ({ ...c, fechaHora: c.fechaHora.slice(0, 16) })), internamientos: [] },
            );
          }
        }
        t.update(odontologo.ref, { activo });
        if (!usuario.empty) t.update(usuario.docs[0].ref, { activo });
      });
      const [odontologo, usuario] = await Promise.all([col('odontologos').doc(id).get(), usuarioDe(id)]);
      return aMedico(odontologo, usuario.docs[0]);
    },
  };
}
