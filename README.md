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

Si la base se creó antes de que existiera la tabla `antecedente`, se agrega con
`npm run db:mysql -- --solo 05_antecedentes.sql`: crea la tabla con su trigger y
agrega antecedentes de prueba si está vacía. No toca lo demás y se puede correr más
de una vez. Igual, `--solo 06_referencia_pago.sql` actualiza el trigger de pagos para
que también revise la referencia según el método, y `--solo 07_recepcionistas.sql` crea
la tabla `recepcionista`, liga cada cuenta de recepción que ya exista a su recepcionista
("Recepción" queda como "Recepción General", para corregir el nombre desde el sistema) y
agrega la regla de que toda cuenta de recepción sea de una recepcionista.

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

Si la base ya existe, volver a correr `npm run db:mongo:semilla` actualiza los
validadores (por ejemplo, el `telefono` de las recepcionistas en `usuarios`) y agrega a
los pacientes de prueba los antecedentes médicos que les falten
(arreglo `antecedentes` dentro del paciente). No borra ni cambia nada más.

**PostgreSQL en Supabase**
1. En el proyecto de Supabase: *SQL Editor* → *New query*. Pegar
   `backend/db/postgres/01_esquema.sql`, cambiar `CAMBIA_ESTA_CLAVE` por una contraseña
   (solo letras y números) y ejecutarlo. Si avisa que las tablas no tienen RLS, elegir
   *Run without RLS*: el propio script lo activa al final.
2. En otra consulta, ejecutar `backend/db/postgres/02_semilla.sql` (datos de prueba).
3. *Connect* → **Session pooler**: copiar la cadena, cambiar `postgres.<ref>` por
   `hospital_app.<ref>` y poner la contraseña del paso 1. Va en `POSTGRES_URL`.

Si la base se creó antes de que existiera la tabla `antecedente`, basta con pegar
`backend/db/postgres/03_antecedentes.sql` en el *SQL Editor*: crea la tabla con su RLS,
trigger y permisos, y agrega antecedentes de prueba si está vacía. No toca lo demás y
se puede correr más de una vez.

Del mismo modo, si la base no tiene la tabla `recepcionista`, pegar
`backend/db/postgres/04_recepcionistas.sql`. Crea la tabla, liga cada cuenta de recepción
que ya exista a su recepcionista (la cuenta "Recepción" queda como "Recepción General",
para corregir el nombre desde el sistema) y agrega la regla de que toda cuenta de
recepción sea de una recepcionista. Tampoco borra nada y se puede correr dos veces.

Las tablas viven en el esquema `hospital01`, que la API automática de Supabase no expone;
además tienen RLS activado. El backend entra como `hospital_app`, que solo puede leer,
insertar y actualizar en ese esquema (no puede borrar historiales).

**Firebase (Firestore)**
1. En la consola de Firebase: *Configuración del proyecto* → *Cuentas de servicio* →
   **Generar nueva clave privada**. Guardar el JSON en `backend/certs/` (no se sube al repo)
   y compartirlo por privado.
2. En `.env`, llenar `FIREBASE_PROJECT_ID` y `FIREBASE_CREDENTIALS` (ruta al JSON).
3. Ejecutar `npm run db:firebase:semilla`. No borra nada: solo agrega lo que falte y
   reutiliza lo que ya se creó a mano en la consola. A los pacientes de prueba que aún
   no tengan antecedentes médicos les agrega unos de ejemplo (arreglo `antecedentes`
   dentro del documento del paciente).

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
| Buscar pacientes y ver historial    | ✅     | ✅ *      | ✅    |
| Registrar paciente                  | ✅     | ✅        | ✅    |
| Actualizar contacto                 |        | ✅        | ✅    |
| Actualizar tipo de sangre y alergias | ✅    |           |       |
| Corregir datos personales del paciente (nombre, fecha de nacimiento, sexo, documento) | | | ✅ |
| Ver mi perfil y cambiar mi contraseña | ✅   | ✅        | ✅    |
| Consulta, diagnóstico y receta      | ✅     |           |       |
| Agregar antecedentes médicos (las cuatro instituciones) | ✅ |  |       |
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
| Registrar, editar, desactivar y reactivar médicos; restablecer su contraseña (en el laboratorio, médicos referentes) | | | ✅ |
| Crear la cuenta de un médico que no la tiene (no aplica al laboratorio: sus médicos referentes no inician sesión) | | | ✅ |
| Registrar, editar, desactivar y reactivar recepcionistas, cada una con su cuenta | | | ✅ |
| Mantener los catálogos (ver abajo) | | | ✅ |
| Ver reportes del periodo (ver abajo) | | | ✅ |

\* En las cuatro instituciones, la recepción recibe una **vista administrativa**
del historial (mínimo privilegio): ficha, contacto, alergias, citas y lo que se cobra
(facturas, internamientos con su habitación, procedimientos con su precio y pagos), sin
tipo de sangre, motivos, diagnósticos, recetas, notas, tratamientos ni antecedentes.
En el pediátrico ve los cobros, pero no las medidas de crecimiento ni las vacunas; en el
laboratorio ve qué exámenes tiene cada orden y en qué estado van, pero no los resultados
ni su evolución.
El recorte se hace en el backend (`dominio/privacidad.js`), no solo en la pantalla,
así que tampoco llega por la API. Médicos y admin ven el historial completo.

**Catálogos.** El admin mantiene las listas de las que escoge el sistema, con las tablas
y colecciones que ya existían (sin cambiar ninguna base). Qué catálogos hay depende de la
institución (`dominio/catalogos.js`) y la pantalla se arma con esa definición:

| Institución | Catálogos |
|---|---|
| Hospital | Habitaciones (en mantenimiento no se asignan al internar; una ocupada no se toca), medicamentos, especialidades (su propia tabla), departamentos |
| Odontológica | Procedimientos (con su costo), medicamentos, especialidades |
| Pediátrico | Servicios (con su precio), medicamentos, especialidades |
| Laboratorio | Tipos de examen con sus parámetros (unidad y rango de referencia, u opciones), medicamentos, especialidades de los médicos referentes |

Nada se borra: lo que tiene estado se desactiva y deja de ofrecerse. Cambiar un precio no
altera lo ya cobrado (cada cobro guarda su precio). En PostgreSQL y MySQL, donde recetas y
cobros muestran el nombre leyéndolo del catálogo, un medicamento ya recetado o un servicio
ya cobrado no cambia de nombre; en Firestore y MongoDB cada receta u orden guarda su
propia copia. Los medicamentos, especialidades y departamentos del hospital no se
desactivan porque su tabla no tiene estado.

**Especialidades.** Al registrar o editar un médico, la especialidad se elige de una lista
(con "Otra…" para escribir una nueva). Lo escrito se compara con la lista sin importar tildes
ni mayúsculas, así "Cardiologia" queda como "Cardiología" (`dominio/especialidades.js`). El
hospital tiene su tabla `especialidad`; en las demás la especialidad es un dato de cada
médico, así que el catálogo muestra las que están en uso y, al corregir un nombre, lo cambia
en todos los médicos que la tienen (y si coincide con otra, las une).

**Teléfonos.** Todos son de Guatemala: exactamente 8 dígitos. Se aceptan con guion o espacio
y se guardan como `5555-1234` (`dominio/telefono.js`).

**Reportes.** El admin ve los totales de un periodo (este mes, el anterior, los últimos 30
días, el año o las fechas que elija), nunca datos clínicos de un paciente. Cada institución
mide lo suyo y cada adaptador lo calcula con su motor (`dominio/reportes.js`):

| Institución | Indicadores y tablas | Cómo se calcula |
|---|---|---|
| Hospital | Consultas, citas, inasistencia, ingresos, saldo por cobrar, ocupación de habitaciones, internamientos; citas por médico e ingresos por método | `GROUP BY` y `FILTER` de PostgreSQL |
| Odontológica | Consultas, citas, inasistencia, ingresos, saldo por cobrar; citas por odontólogo, procedimientos realizados e ingresos por método | Consultas por rango en Firestore y sumas en el backend (Firestore no agrupa) |
| Pediátrico | Consultas, citas, inasistencia, ingresos, saldo por cobrar, vacunas aplicadas; citas por médico, servicios cobrados, ingresos por método y vacunas | `GROUP BY` de MySQL y la vista `v_cobro_resumen` |
| Laboratorio | Órdenes, exámenes, % validados, resultados fuera de rango, horas promedio hasta validar; órdenes por estado, exámenes y médicos referentes | Un pipeline de agregación con `$facet` en MongoDB |

La inasistencia es la parte de las citas que ya debían ocurrir (atendidas o "no asistió")
en las que el paciente no llegó.

Un médico nunca se borra: se desactiva (él y su usuario) y solo si no tiene citas
pendientes ni pacientes internados a su cargo. Una sesión abierta deja de servir en
cuanto su usuario se desactiva: en cada petición se revisa que siga activo (la
respuesta se recuerda 30 segundos).

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
| GET    | `/api/auth/perfil`                 | Mi perfil: nombre, correo, rol y, según el rol, especialidad, colegiado y teléfono |
| POST   | `/api/auth/password`               | Cambiar mi contraseña `{ actual, nueva }` (cualquier rol) |
| GET    | `/api/pacientes?q=texto`           | Buscar por nombre o documento (`&archivados=true`)   |
| POST   | `/api/pacientes`                   | Registrar paciente nuevo                             |
| GET    | `/api/pacientes/:id`               | Datos del paciente                                   |
| PATCH  | `/api/pacientes/:id/contacto`      | Actualizar teléfono, dirección o correo              |
| PATCH  | `/api/pacientes/:id/datos-clinicos` | Actualizar `{ tipoSangre?, alergias? }` (médico). La odontológica solo registra alergias |
| PATCH  | `/api/pacientes/:id/datos-personales` | Corregir `{ nombres?, apellidos?, fechaNacimiento?, sexo?, documento? }` (admin). Documento de otro paciente → 409 |
| POST   | `/api/pacientes/:id/baja`          | Archivar historial `{ motivo, detalle }`             |
| GET    | `/api/pacientes/:id/historial`     | Historial completo (consultas, diagnósticos, recetas, extras) |
| POST   | `/api/pacientes/:id/antecedentes`  | Antecedente médico `{ tipo, descripcion, anioInicio? }` (las cuatro instituciones). Tipos: patologico, quirurgico, familiar, habito, medicamento; en el pediátrico también perinatal |
| POST   | `/api/pacientes/:id/consultas`     | Registrar consulta + diagnósticos + receta (atómico) |
| POST   | `/api/consultas/:id/diagnosticos`  | Agregar diagnóstico                                  |
| POST   | `/api/consultas/:id/recetas`       | Recetar medicamento(s)                               |
| GET    | `/api/catalogos/medicos`           | Catálogo de médicos                                  |
| GET    | `/api/catalogos/especialidades`   | Especialidades que se ofrecen al registrar o editar un médico |
| GET    | `/api/personal/medicos`            | Médicos activos e inactivos, con colegiado y correo (admin) |
| POST   | `/api/personal/medicos`            | Alta de un médico con su usuario `{ nombres, apellidos, numeroColegiado, especialidad, telefono?, correo, password }` (admin; hospital, odontológica y pediátrico). El correo debe ser del dominio de la institución; médico y usuario se crean en una sola transacción |
| PATCH  | `/api/personal/medicos/:id`        | Editar `{ nombres?, apellidos?, numeroColegiado?, especialidad?, telefono? }` (admin). El correo no se edita: es la cuenta |
| POST   | `/api/personal/medicos/:id/cuenta` | Crear la cuenta `{ correo, password }` de un médico activo que está en el catálogo sin usuario (admin; hospital, odontológica y pediátrico) |
| POST   | `/api/personal/medicos/:id/password` | Nueva contraseña `{ password }` para un médico que olvidó la suya (admin) |
| GET    | `/api/admin/reportes?desde=&hasta=` | Reporte del periodo (admin). Por defecto, el mes en curso; hasta un año |
| GET    | `/api/admin/catalogos`             | Catálogos que mantiene el admin de la institución, con sus campos (admin) |
| GET    | `/api/admin/catalogos/:clave`      | Registros de un catálogo, activos e inactivos (admin) |
| POST   | `/api/admin/catalogos/:clave`      | Registro nuevo con los campos del catálogo (admin) |
| PATCH  | `/api/admin/catalogos/:clave/:id`  | Editar (admin). Los campos que solo se ponen al crear no cambian; un dato ya usado en recetas o cobros tampoco (PostgreSQL y MySQL) |
| POST   | `/api/admin/catalogos/:clave/:id/estado` | `{ activo }` (admin), en los catálogos con estado |
| GET    | `/api/personal/recepcionistas`     | Recepcionistas activas e inactivas, con su correo (admin; las cuatro instituciones) |
| POST   | `/api/personal/recepcionistas`     | Alta con su usuario `{ nombres, apellidos, telefono?, correo, password }` (admin). Correo del dominio de la institución |
| PATCH  | `/api/personal/recepcionistas/:id` | Editar `{ nombres?, apellidos?, telefono? }` (admin). El correo no se edita |
| POST   | `/api/personal/recepcionistas/:id/password` | Nueva contraseña `{ password }` (admin) |
| POST   | `/api/personal/recepcionistas/:id/estado` | `{ activo }` (admin). Desactiva también su usuario; sin requisitos previos |
| POST   | `/api/personal/medicos/:id/estado` | `{ activo }` (admin). Desactivar desactiva también su usuario y falla con 409 si tiene citas pendientes a futuro o pacientes internados a su cargo (la respuesta trae la lista). En el laboratorio aplica a los médicos referentes |
| GET    | `/api/catalogos/medicamentos`      | Catálogo de medicamentos                             |
| GET    | `/api/agenda?fecha=AAAA-MM-DD&medicoId=` | Citas de ese día (hoy por defecto): las del médico conectado, o las del `medicoId` para recepción y admin |
| GET    | `/api/pacientes/:id/citas`         | Citas pendientes del paciente, de hoy en adelante    |
| POST   | `/api/pacientes/:id/citas`         | Agendar `{ medicoId, fechaHora, duracionMin?, motivo }` |
| PATCH  | `/api/citas/:id`                   | Reprogramar `{ fechaHora, duracionMin? }`            |
| POST   | `/api/citas/:id/cancelacion`       | Cancelar la cita                                     |
| POST   | `/api/citas/:id/estado`            | `{ estado: 'confirmada' \| 'no_asistio' }` (la odontológica no confirma; "no asistió" solo pasada la hora) |
| GET    | `/api/odontologica/procedimientos` | Catálogo de procedimientos (solo odontológica)       |
| POST   | `/api/consultas/:id/pagos`         | Registrar pago `{ monto, metodoPago, referencia? }` (odontológica: efectivo, tarjeta, transferencia) |
| GET    | `/api/hospital/habitaciones`       | Habitaciones disponibles (hospital)                  |
| POST   | `/api/pacientes/:id/internamientos`| Internar `{ habitacionId, medicoId, motivoIngreso, diagnosticoIngreso? }` |
| POST   | `/api/internamientos/:id/cambio-medico` | Cambiar médico a cargo `{ medicoId, motivoCambio }` |
| POST   | `/api/internamientos/:id/tratamientos`  | Tratamiento durante el internamiento            |
| POST   | `/api/internamientos/:id/alta`     | Dar de alta `{ diagnosticoAlta }`: libera la habitación |
| POST   | `/api/pacientes/:id/facturas`      | Facturar `{ consultaId \| internamientoId, items: [{ descripcion, cantidad, precioUnitario }] }` |
| POST   | `/api/facturas/:id/pagos`          | Pago `{ monto, metodoPago, referencia? }` (efectivo, tarjeta, transferencia, seguro) |

En los pagos del hospital, la odontológica y el pediátrico, la referencia depende del método:
el efectivo no lleva; la tarjeta pide el **No. de autorización** del voucher
(6 letras o números, con al menos un número); la transferencia, el **No. de boleta
o transacción** (6 a 20 dígitos), y el seguro, el **No. de póliza** (5 a 20 letras,
números o guiones, con al menos un número). Se guarda en mayúsculas y sin espacios.
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
| POST   | `/api/cobros/:id/pagos`       | Abono `{ monto, metodoPago, referencia? }` (recepción/admin; efectivo, tarjeta, transferencia). No puede exceder el saldo y la referencia sigue la regla de arriba; el trigger `trg_pago_validar` revisa ambas cosas y, al completarse, `trg_pago_cerrar_cobro` marca el cobro como pagado |
| POST   | `/api/pediatrico/encargados/busqueda` | Buscar encargado `{ dpi }` para asociarle otro niño (hermanos). El DPI va en el cuerpo y no en la URL, para que no quede en los registros |

El historial del pediátrico incluye en `extras.cobros` cada cobro con su detalle, pagos y saldo.
