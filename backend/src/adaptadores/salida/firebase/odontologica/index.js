// Adaptador Firebase (Firestore) de la Clínica Odontológica: implementa los
// puertos de puertos/repositorios.js sobre el modelo documental de modelo.js.

import { listaDeEspecialidades } from '../../../../dominio/especialidades.js';
import { FieldValue } from 'firebase-admin/firestore';
import { timestampATexto } from '../conexion.js';
import { crearRepositorioAgenda } from './agenda.js';
import { crearRepositorioAntecedentes } from './antecedentes.js';
import { crearRepositorioAtenciones } from './atenciones.js';
import { crearCatalogosAdmin, especialidadDe } from './catalogos.js';
import { COLECCIONES, nombreCompleto, ROLES } from './modelo.js';
import { registrarPago } from './pagos.js';
import { crearRepositorioPacientes } from './pacientes.js';
import { crearRepositorioPersonal } from './personal.js';
import { crearRepositorioRecepcionistas } from './recepcionistas.js';
import { crearRepositorioReportes } from './reportes.js';

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
      async estaActivo(usuarioId) {
        const u = await col('usuarios').doc(usuarioId).get();
        return u.exists && u.get('activo') !== false;
      },
      // Perfil de quien inició sesión: su cuenta y, según el rol, sus datos de odontólogo o de recepción.
      async obtenerPerfil(usuarioId) {
        const u = await col('usuarios').doc(usuarioId).get();
        if (!u.exists) return null;
        const persona = u.get('odontologo_id')
          ? await col('odontologos').doc(u.get('odontologo_id')).get()
          : u.get('recepcionista_id') ? await col('recepcionistas').doc(u.get('recepcionista_id')).get() : null;
        const datos = persona?.exists ? persona.data() : {};
        return {
          id: u.id,
          nombre: nombreCompleto(u.data()),
          correo: u.get('correo'),
          rol: ROLES[u.get('rol')] ?? u.get('rol'),
          ultimoAcceso: timestampATexto(u.get('ultimo_acceso'), zonaHoraria),
          especialidad: u.get('odontologo_id') ? datos.especialidad ?? 'Odontología' : null,
          numeroColegiado: datos.numero_colegiado ?? null,
          telefono: datos.telefono ?? null,
        };
      },
      async cambiarPassword(usuarioId, passwordHash) {
        await col('usuarios').doc(usuarioId).update({ password_hash: passwordHash });
      },
    },

    // Puerto opcional (fuera del contrato común): citas.
    agenda: crearRepositorioAgenda(db, zonaHoraria),
    // Puerto opcional: antecedentes médicos.
    antecedentes: crearRepositorioAntecedentes(db, zonaHoraria),
    // Puerto opcional: odontólogos y recepcionistas (con su usuario), por el administrador.
    personal: { ...crearRepositorioPersonal(db, zonaHoraria), ...crearRepositorioRecepcionistas(db) },
    // Puerto opcional: catálogos que mantiene el admin.
    catalogosAdmin: crearCatalogosAdmin(db),
    // Puerto opcional: reportes del admin (totales del periodo).
    reportes: crearRepositorioReportes(db, zonaHoraria),

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
      registrarPago: (consultaId, pago, usuario) => registrarPago(db, consultaId, pago, usuario),
    },

    catalogos: {
      // → string[]: las especialidades en uso (los odontólogos sin una son de odontología general).
      async listarEspecialidades() {
        // El catálogo, más las que ya usa algún odontólogo (por si alguna base
        // es anterior al catálogo).
        const [catalogo, odon] = await Promise.all([col('especialidades').get(), col('odontologos').get()]);
        return listaDeEspecialidades([...catalogo.docs.map((d) => d.get('nombre')), ...odon.docs.map(especialidadDe)]);
      },
      async listarMedicos() {
        const snap = await col('odontologos').where('activo', '==', true).get();
        return snap.docs.sort(ordenarPorApellido).map((d) => ({
          id: d.id,
          nombre: nombreCompleto(d.data()),
          especialidad: d.get('especialidad') ?? 'Odontología',
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
