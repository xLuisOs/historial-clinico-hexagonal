// Adaptador MongoDB del Laboratorio Clínico: implementa los puertos comunes
// de puertos/repositorios.js y el puerto propio `laboratorio`, sobre el
// modelo documental de db/mongo/esquemas.js.

import { aObjectId } from '../conexion.js';
import { crearRepositorioAntecedentes } from './antecedentes.js';
import { crearCatalogosAdmin } from './catalogos.js';
import { crearRepositorioMedicos, crearRepositorioPersonalReferentes } from './medicos.js';
import { nombreCompleto, ROLES } from './modelo.js';
import { crearRepositorioOrdenes } from './ordenes.js';
import { crearRepositorioPacientes } from './pacientes.js';
import { crearRepositorioRecepcionistas } from './recepcionistas.js';

export function crearAdaptadorLaboratorioMongo(cliente, nombreDb, zonaHoraria) {
  const db = cliente.db(nombreDb);
  const { atenciones, laboratorio } = crearRepositorioOrdenes(cliente, db, zonaHoraria);

  return {
    usuarios: {
      async buscarPorCorreo(correo) {
        const u = await db.collection('usuarios').findOne({ correo });
        return u && {
          id: u._id.toHexString(),
          correo: u.correo,
          passwordHash: u.password_hash,
          nombre: nombreCompleto(u),
          // Los roles del laboratorio se traducen a los comunes de casos-uso.js.
          rol: ROLES[u.rol],
          // El químico biólogo es el profesional que atiende: su id de usuario
          // es el que queda en la orden como "registrada por".
          medicoId: u.rol === 'quimico_biologo' ? u._id.toHexString() : null,
          activo: u.activo,
        };
      },
      async registrarAcceso(usuarioId) {
        await db.collection('usuarios').updateOne(
          { _id: aObjectId(usuarioId, 'Usuario') },
          { $set: { ultimo_acceso: new Date() } },
        );
      },
      async estaActivo(usuarioId) {
        const u = await db.collection('usuarios').findOne({ _id: aObjectId(usuarioId, 'Usuario') }, { projection: { activo: 1 } });
        return u?.activo === true;
      },
    },

    pacientes: crearRepositorioPacientes(cliente, db, zonaHoraria),
    atenciones,
    laboratorio: { ...laboratorio, ...crearRepositorioMedicos(db) },
    // Puerto opcional: antecedentes médicos, embebidos en el paciente.
    antecedentes: crearRepositorioAntecedentes(db, zonaHoraria),
    // Puerto opcional: el admin edita y desactiva médicos referentes y
    // administra a las recepcionistas (con su cuenta).
    personal: { ...crearRepositorioPersonalReferentes(db), ...crearRepositorioRecepcionistas(db) },
    // Puerto opcional: catálogos que mantiene el admin.
    catalogosAdmin: crearCatalogosAdmin(db),

    catalogos: {
      // En el laboratorio, "médicos" son los médicos referentes: quienes
      // ordenan los exámenes (pueden no pertenecer al laboratorio).
      async listarMedicos() {
        const docs = await db.collection('medicos_referentes')
          .find({ activo: true })
          .sort({ apellidos: 1, nombres: 1 })
          .collation({ locale: 'es' })
          .toArray();
        return docs.map((d) => ({
          id: d._id.toHexString(),
          nombre: nombreCompleto(d),
          especialidad: d.especialidad ?? null,
        }));
      },
      async listarMedicamentos() {
        const docs = await db.collection('medicamentos')
          .find({ activo: true })
          .sort({ nombre: 1, presentacion: 1 })
          .collation({ locale: 'es' })
          .toArray();
        return docs.map((d) => ({ id: d._id.toHexString(), nombre: d.nombre, presentacion: d.presentacion }));
      },
    },
  };
}
