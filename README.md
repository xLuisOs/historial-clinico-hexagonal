# historial-clinico-hexagonal

Proyecto final de Bases de Datos II (URL): una sola aplicación de historiales clínicos
para cuatro instituciones, cada una con su propio motor de base de datos. Con
arquitectura hexagonal, la lógica de negocio no depende del motor.

| Institución              | Motor      | Hosting        | Responsable | Dominio de usuarios |
|--------------------------|------------|----------------|-------------|---------------------|
| Hospital General         | PostgreSQL | Supabase       | Fer         | `@hospital.gt`      |
| Clínica Odontológica     | Firebase   | Firestore      | Fer         | `@odonto.gt`        |
| Laboratorio Clínico      | MongoDB    | MongoDB Atlas  | Luis        | `@lab.gt`           |
| Centro Médico Pediátrico | MySQL      | Azure Database for MySQL | Luis | `@pediatrico.gt` |

Al iniciar sesión, el dominio del correo decide la institución. Desde ese momento
todas las operaciones del usuario van al motor de esa institución.

## Estructura

```
backend/
├── db/mysql/                  Scripts SQL del pediátrico (esquema, triggers, usuarios, semilla)
├── db/postgres/               Scripts SQL del hospital (esquema + seguridad, semilla)
├── scripts/                   Utilidades: aplicar esquema MySQL, probar conexiones
└── src/
    ├── dominio/               Modelo común (Paciente, Consulta) y sus validaciones
    ├── puertos/               Contrato que todo adaptador de base de datos debe cumplir
    ├── aplicacion/            Casos de uso (registrar consulta, agregar diagnóstico, recetar…)
    ├── adaptadores/
    │   ├── entrada/http/      API REST (Express) + sesión JWT
    │   └── salida/            Un adaptador por motor
    │       ├── mysql/pediatrico/        ✅ implementado
    │       ├── mongo/laboratorio/       ✅ implementado
    │       ├── postgres/hospital/       ✅ implementado
    │       └── firebase/odontologica/   ✅ implementado
    ├── contenedor.js          Elige el adaptador según la institución del usuario
    └── servidor.js

frontend/                      Cliente web (React + Vite), igual para las cuatro instituciones
└── src/
    ├── api.js                 Llamadas a la API (el token va en cada petición)
    ├── sesion.jsx             Usuario conectado y qué puede hacer su rol
    ├── paginas/               Login, pacientes, nuevo paciente, historial, nueva consulta
    ├── componentes/           Barra de navegación, campos, diálogos, editores de diagnóstico/receta
    └── instituciones/         Lo único que cambia por institución: campos de la consulta y extras del historial
```

**Para agregar un motor:** implementa los métodos de `src/puertos/repositorios.js` en
`adaptadores/salida/<motor>/<institucion>/index.js`. `mysql/pediatrico/` sirve de
ejemplo completo. Al arrancar, el contenedor verifica que no falte ningún método.

## Puesta en marcha

Requisitos: Node 20 o superior. Docker Desktop solo si vas a usar las bases locales.

```bash
cd backend
npm install
cp .env.example .env        # y llenar los valores (pedírselos al compañero)
```

### Opción A: bases locales con Docker

```bash
docker compose up -d                          # desde la raíz del repo
cd backend
npm run db:mysql:semilla                      # crea la base pediatrico con datos de prueba
npm run db:mongo:semilla                      # crea las colecciones del laboratorio con datos de prueba
npm run db:probar                             # verifica las conexiones
npm run dev                                   # API en http://localhost:4000/api
```

### Opción B: bases en la nube (compartidas entre las dos computadoras)

**MySQL en Azure** (servidor flexible, con el beneficio Azure for Students)
1. Crear un *Azure Database for MySQL – Servidor flexible*: nivel **Ampliable B1ms**,
   20 GB, sin alta disponibilidad ni crecimiento automático (entra en las 750 h/mes
   gratuitas), MySQL 8.4, región permitida por la suscripción (usamos *West US 2*; *Mexico Central* la bloquea la directiva de Azure for Students).
2. En *Redes*: acceso público y regla de firewall `0.0.0.0 – 255.255.255.255`
   (la conexión exige TLS 1.2 y contraseña).
3. En *Parámetros del servidor*: `log_bin_trust_function_creators = ON`. Sin esto
   el administrador (que no tiene SUPER) no puede crear los triggers.
4. En `.env`, llenar `MYSQL_ADMIN_URL` (usuario administrador del servidor) y
   `MYSQL_URL` como indica `.env.example`. Usar contraseñas fuertes en
   `MYSQL_APP_PASSWORD` y `MYSQL_LECTURA_PASSWORD`.
5. Ejecutar `npm run db:mysql:semilla` **una sola vez** (lo hace una persona; la otra
   solo necesita el `.env`).

> Para ahorrar crédito, el servidor se puede **Detener** desde el portal cuando no se usa.

**MongoDB en Atlas**
1. Crear la cuenta en mongodb.com/atlas y un clúster **M0 (Free)**.
2. En *Network Access*, agregar `0.0.0.0/0` (o la IP de cada compañero).
3. En *Database Access* → *Custom Roles*, crear el rol **`lab_app`** con las acciones
   `find`, `insert` y `update` sobre la base `laboratorio`. Sin `remove` ni
   `dropCollection`: la aplicación no puede borrar historiales (mínimo privilegio,
   igual que `pedi_app` en MySQL).
4. Crear dos usuarios de base de datos:
   - `lab_app`, con el rol `lab_app`. Va en `MONGO_URL`.
   - Un usuario con rol *Atlas admin*, que solo se usa para crear las colecciones.
     Va en `MONGO_ADMIN_URL`.
5. En *Connect* → *Drivers*, copiar la cadena `mongodb+srv://…` para cada usuario.
6. Ejecutar `npm run db:mongo:semilla` **una sola vez**.

**PostgreSQL en Supabase**
1. En el proyecto de Supabase: *SQL Editor* → *New query*. Pegar
   `backend/db/postgres/01_esquema.sql`, cambiar `CAMBIA_ESTA_CLAVE` por una contraseña
   (solo letras y números) y ejecutarlo. Si avisa que las tablas no tienen RLS, elegir
   *Run without RLS*: el propio script lo activa al final.
2. En otra consulta, ejecutar `backend/db/postgres/02_semilla.sql` (datos de prueba).
3. *Connect* → **Session pooler**: copiar la cadena, cambiar `postgres.<ref>` por
   `hospital_app.<ref>` y poner la contraseña del paso 1. Va en `POSTGRES_URL`.

Las tablas viven en el esquema `hospital01`, que la API automática de Supabase no expone;
además tienen RLS activado. El backend entra como `hospital_app`, que solo puede leer,
insertar y actualizar en ese esquema (no puede borrar historiales).

**Firebase (Firestore)**
1. En la consola de Firebase: *Configuración del proyecto* → *Cuentas de servicio* →
   **Generar nueva clave privada**. Guardar el JSON en `backend/certs/` (no se sube al repo)
   y compartirlo por privado.
2. En `.env`, llenar `FIREBASE_PROJECT_ID` y `FIREBASE_CREDENTIALS` (ruta al JSON).
3. Ejecutar `npm run db:firebase:semilla`. No borra nada: solo agrega lo que falte y
   reutiliza lo que ya se creó a mano en la consola.

Las reglas de Firestore quedan en `allow read, write: if false`: nadie entra directo
desde un navegador; el backend entra con la clave de la cuenta de servicio, que no
pasa por las reglas.

### Frontend

Con el backend corriendo (`npm run dev` en `backend/`), en otra terminal:

```bash
cd frontend
npm install
npm run dev                                   # http://localhost:5173
```

Vite reenvía `/api` al backend en `http://localhost:4000`, así que no hace falta
configurar nada más. La interfaz es la misma para todos; según el rol del usuario se
ocultan los botones que no le corresponden (el backend igual lo verifica):

| Acción                              | Médico | Recepción | Admin |
|-------------------------------------|:------:|:---------:|:-----:|
| Buscar pacientes y ver historial    | ✅     | ✅        | ✅    |
| Registrar paciente                  | ✅     | ✅        | ✅    |
| Actualizar contacto                 |        | ✅        | ✅    |
| Consulta, diagnóstico y receta      | ✅     |           |       |
| Mis citas de hoy (agenda propia)    | ✅     |           |       |
| Agenda por médico                   |        | ✅        | ✅    |
| Ver médicos por especialidad        | ✅     | ✅        | ✅    |
| Agendar, reprogramar y cancelar citas |      | ✅        | ✅    |
| Confirmar cita / marcar "no asistió" |       | ✅        | ✅    |
| Internar, cambiar médico, dar de alta (hospital) | ✅ |      |       |
| Registrar pagos (odontológica)      |        | ✅        | ✅    |
| Facturar y cobrar (hospital)        |        | ✅        | ✅    |
| Anular facturas sin pagos (hospital) |       |           | ✅    |
| Archivar historial                  |        |           | ✅    |

### Recrear las bases desde cero

```bash
npm run db:mysql:semilla -- --reiniciar       # ⚠ borra todos los datos del pediátrico
npm run db:mongo:semilla -- --reiniciar       # ⚠ borra todas las colecciones del laboratorio
npm run db:firebase:semilla -- --reiniciar    # ⚠ borra todas las colecciones de la odontológica
```

Para el hospital, en el SQL Editor de Supabase (⚠ borra todos sus datos) y luego volver
a ejecutar los dos scripts:

```sql
DROP SCHEMA IF EXISTS hospital01 CASCADE;
DROP ROLE IF EXISTS hospital_app;
```

## Usuarios de prueba (pediátrico)

Contraseña de todos: `Pediatrico#2026`

| Correo                      | Rol       | Puede…                                       |
|-----------------------------|-----------|----------------------------------------------|
| `dra.morales@pediatrico.gt` | médico    | registrar consultas, diagnósticos y recetas  |
| `dr.castillo@pediatrico.gt` | médico    | ídem                                         |
| `recepcion@pediatrico.gt`   | recepción | registrar pacientes y actualizar contactos   |
| `admin@pediatrico.gt`       | admin     | dar de baja (archivar) historiales           |

## Usuarios de prueba (hospital)

Contraseña de todos: `Hospital#2026` (los crea `db/postgres/02_semilla.sql`)

| Correo                   | Rol       | Puede…                                       |
|--------------------------|-----------|----------------------------------------------|
| `dra.lopez@hospital.gt`  | médico    | registrar consultas, diagnósticos y recetas  |
| `dr.herrera@hospital.gt` | médico    | ídem                                         |
| `recepcion@hospital.gt`  | recepción | registrar pacientes y actualizar contactos   |
| `admin@hospital.gt`      | admin     | dar de baja (archivar) historiales           |

En la consulta, los tratamientos y si fue una emergencia van en `datosEspecificos`:

```json
"datosEspecificos": {
  "esEmergencia": true,
  "tratamientos": [{ "descripcion": "Reposo e hidratación", "fechaInicio": "2026-11-07", "indicaciones": "3 días" }]
}
```

`fechaInicio` es opcional (por defecto, hoy). El historial incluye además internamientos,
facturas con su saldo y próximas citas.

## Usuarios de prueba (odontológica)

Contraseña de todos: `Odonto#2026` (los crea `npm run db:firebase:semilla`)

| Correo                  | Rol           | Puede…                                       |
|-------------------------|---------------|----------------------------------------------|
| `dra.ramirez@odonto.gt` | odontóloga    | registrar consultas, diagnósticos y recetas  |
| `dr.estrada@odonto.gt`  | odontólogo    | ídem                                         |
| `recepcion@odonto.gt`   | recepcionista | registrar pacientes y actualizar contactos   |
| `admin@odonto.gt`       | administrador | dar de baja (archivar) historiales           |

En la consulta, los procedimientos van en `datosEspecificos`:

```json
"datosEspecificos": {
  "procedimientos": [{ "procedimientoId": "…", "piezaDental": 36, "observaciones": "Cara oclusal" }]
}
```

`piezaDental` usa notación FDI (11–48 permanentes, 51–85 temporales) y es opcional.
El precio no se envía: se copia del catálogo al guardar.

## Usuarios de prueba (laboratorio)

Contraseña de todos: `Laboratorio#2026` (los crea `npm run db:mongo:semilla`)

| Correo              | Rol             | Puede…                                                  |
|---------------------|-----------------|---------------------------------------------------------|
| `qb.lopez@lab.gt`   | químico biólogo | crear órdenes, registrar y validar resultados           |
| `qb.mendez@lab.gt`  | químico biólogo | ídem                                                    |
| `recepcion@lab.gt`  | recepción       | registrar pacientes y actualizar contactos              |
| `admin@lab.gt`      | admin           | dar de baja (archivar) historiales y anular órdenes     |

En el laboratorio, las reglas comunes se traducen así:

| Regla común           | En el laboratorio                                                        |
|-----------------------|--------------------------------------------------------------------------|
| Registrar consulta    | Crear una **orden de examen** (médico referente + exámenes)              |
| Agregar diagnóstico   | Diagnóstico **presuntivo** que acompaña la orden                         |
| Recetar medicamento   | **Medicación actual** del paciente (puede alterar los resultados)        |

Los datos propios van en `datosEspecificos`:

```json
"datosEspecificos": { "medicoReferenteId": "…", "examenes": ["<id tipo examen>", "…"] }
```

## API

Todas las rutas (salvo login) requieren `Authorization: Bearer <token>`.

| Método | Ruta                               | Descripción                                          |
|--------|------------------------------------|------------------------------------------------------|
| POST   | `/api/auth/login`                  | `{ correo, password }` → `{ token, usuario }`        |
| GET    | `/api/pacientes?q=texto`           | Buscar por nombre o documento (`&archivados=true`)   |
| POST   | `/api/pacientes`                   | Registrar paciente nuevo                             |
| GET    | `/api/pacientes/:id`               | Datos del paciente                                   |
| PATCH  | `/api/pacientes/:id/contacto`      | Actualizar teléfono, dirección o correo              |
| POST   | `/api/pacientes/:id/baja`          | Archivar historial `{ motivo, detalle }`             |
| GET    | `/api/pacientes/:id/historial`     | Historial completo (consultas, diagnósticos, recetas, extras) |
| POST   | `/api/pacientes/:id/consultas`     | Registrar consulta + diagnósticos + receta (atómico) |
| POST   | `/api/consultas/:id/diagnosticos`  | Agregar diagnóstico                                  |
| POST   | `/api/consultas/:id/recetas`       | Recetar medicamento(s)                               |
| GET    | `/api/catalogos/medicos`           | Catálogo de médicos                                  |
| GET    | `/api/catalogos/medicamentos`      | Catálogo de medicamentos                             |
| GET    | `/api/agenda?fecha=AAAA-MM-DD&medicoId=` | Citas de ese día (hoy por defecto): las del médico conectado, o las del `medicoId` para recepción y admin |
| GET    | `/api/pacientes/:id/citas`         | Citas pendientes del paciente, de hoy en adelante    |
| POST   | `/api/pacientes/:id/citas`         | Agendar `{ medicoId, fechaHora, duracionMin?, motivo }` |
| PATCH  | `/api/citas/:id`                   | Reprogramar `{ fechaHora, duracionMin? }`            |
| POST   | `/api/citas/:id/cancelacion`       | Cancelar la cita                                     |
| POST   | `/api/citas/:id/estado`            | `{ estado: 'confirmada' \| 'no_asistio' }` (la odontológica no confirma; "no asistió" solo pasada la hora) |
| GET    | `/api/odontologica/procedimientos` | Catálogo de procedimientos (solo odontológica)       |
| POST   | `/api/consultas/:id/pagos`         | Registrar pago `{ monto, metodoPago }` (odontológica) |
| GET    | `/api/hospital/habitaciones`       | Habitaciones disponibles (hospital)                  |
| POST   | `/api/pacientes/:id/internamientos`| Internar `{ habitacionId, medicoId, motivoIngreso, diagnosticoIngreso? }` |
| POST   | `/api/internamientos/:id/cambio-medico` | Cambiar médico a cargo `{ medicoId, motivoCambio }` |
| POST   | `/api/internamientos/:id/tratamientos`  | Tratamiento durante el internamiento            |
| POST   | `/api/internamientos/:id/alta`     | Dar de alta `{ diagnosticoAlta }`: libera la habitación |
| POST   | `/api/pacientes/:id/facturas`      | Facturar `{ consultaId \| internamientoId, items: [{ descripcion, cantidad, precioUnitario }] }` |
| POST   | `/api/facturas/:id/pagos`          | Pago `{ monto, metodoPago, referencia? }` (efectivo, tarjeta, transferencia, seguro) |
| POST   | `/api/facturas/:id/anulacion`      | Anular una factura sin pagos (admin)                 |

Exclusivas del laboratorio (`:id` es el de la orden):

| Método | Ruta                                                     | Descripción                                    |
|--------|----------------------------------------------------------|------------------------------------------------|
| GET    | `/api/laboratorio/tipos-examen`                          | Catálogo de exámenes con sus parámetros        |
| POST   | `/api/laboratorio/medicos-referentes`                    | Registrar médico referente `{ nombres, apellidos, numeroColegiado, especialidad?, telefono?, institucionProcedencia? }`. El colegiado es único |
| POST   | `/api/laboratorio/ordenes/:id/examenes`                  | Agregar exámenes `{ examenes: [idTipoExamen] }` a una orden pendiente o en proceso (sin repetir) |
| POST   | `/api/laboratorio/ordenes/:id/examenes/:codigo/resultados` | `{ resultados: [{ parametro, valor, observacion }] }` |
| POST   | `/api/laboratorio/ordenes/:id/examenes/:codigo/validacion` | Firma el examen; al validar el último, la orden se completa |
| PATCH  | `/api/laboratorio/ordenes/:id/estado`                    | `{ estado }`: `en_proceso` o `anulada`         |

Exclusivas del pediátrico:

| Método | Ruta                          | Descripción                                                        |
|--------|-------------------------------|--------------------------------------------------------------------|
| POST   | `/api/pacientes/:id/vacunas`  | Registrar dosis aplicada `{ vacunaId, numeroDosis, lote, fechaAplicacion?, consultaId? }` (médico). Las dosis van en orden y no se repiten. Devuelve el esquema actualizado |
| GET    | `/api/pediatrico/servicios`   | Catálogo de servicios facturables con su precio vigente            |
| POST   | `/api/consultas/:id/cobro`    | Generar el cobro de la consulta `{ items: [{ servicioId, cantidad }] }` (recepción/admin). El precio se copia del catálogo; un solo cobro por consulta, a nombre del encargado |
| POST   | `/api/cobros/:id/pagos`       | Abono `{ monto, metodoPago, referencia? }` (recepción/admin). No puede exceder el saldo; al completarse, el trigger marca el cobro como pagado |
| POST   | `/api/pediatrico/encargados/busqueda` | Buscar encargado `{ dpi }` para asociarle otro niño (hermanos). El DPI va en el cuerpo y no en la URL, para que no quede en los registros |

El historial del pediátrico incluye en `extras.cobros` cada cobro con su detalle, pagos y saldo.
