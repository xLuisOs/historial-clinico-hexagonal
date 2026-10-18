# historial-clinico-hexagonal

Proyecto final de Bases de Datos II (URL): una sola aplicación de historiales clínicos
para cuatro instituciones, cada una con su propio motor de base de datos. Con
arquitectura hexagonal, la lógica de negocio no depende del motor.

| Institución              | Motor      | Hosting        | Responsable | Dominio de usuarios |
|--------------------------|------------|----------------|-------------|---------------------|
| Hospital General         | PostgreSQL | Supabase       | Fer         | `@hospital.gt`      |
| Clínica Odontológica     | Firebase   | Firestore      | Fer         | `@odonto.gt`        |
| Laboratorio Clínico      | MongoDB    | MongoDB Atlas  | Luis        | `@lab.gt`           |
| Centro Médico Pediátrico | MySQL      | Aiven          | Luis        | `@pediatrico.gt`    |

Al iniciar sesión, el dominio del correo decide la institución. Desde ese momento
todas las operaciones del usuario van al motor de esa institución.

## Estructura

```
backend/
├── db/mysql/                  Scripts SQL del pediátrico (esquema, triggers, usuarios, semilla)
├── scripts/                   Utilidades: aplicar esquema MySQL, probar conexiones
└── src/
    ├── dominio/               Modelo común (Paciente, Consulta) y sus validaciones
    ├── puertos/               Contrato que todo adaptador de base de datos debe cumplir
    ├── aplicacion/            Casos de uso (registrar consulta, agregar diagnóstico, recetar…)
    ├── adaptadores/
    │   ├── entrada/http/      API REST (Express) + sesión JWT
    │   └── salida/            Un adaptador por motor
    │       ├── mysql/pediatrico/        ✅ implementado
    │       ├── mongo/laboratorio/       ⏳ pendiente (Luis)
    │       ├── postgres/hospital/       ⏳ pendiente (Fer)
    │       └── firebase/odontologica/   ⏳ pendiente (Fer)
    ├── contenedor.js          Elige el adaptador según la institución del usuario
    └── servidor.js
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
npm run db:probar                             # verifica las conexiones
npm run dev                                   # API en http://localhost:4000/api
```

### Opción B: bases en la nube (compartidas entre las dos computadoras)

**MySQL en Aiven**
1. Crear la cuenta en aiven.io, luego *Create service* → **MySQL** → plan **Free**.
2. En la página del servicio, copiar *Host*, *Port* y la clave de `avnadmin`, y
   descargar el **CA certificate** en `backend/certs/aiven-ca.pem` (no se sube al repo).
3. En `.env`, llenar `MYSQL_ADMIN_URL`, `MYSQL_URL` y `MYSQL_SSL_CA` como indica
   `.env.example`. Usar contraseñas fuertes en `MYSQL_APP_PASSWORD` y `MYSQL_LECTURA_PASSWORD`.
4. Ejecutar `npm run db:mysql:semilla` **una sola vez** (lo hace una persona; la otra
   solo necesita el `.env`).

**MongoDB en Atlas**
1. Crear la cuenta en mongodb.com/atlas y un clúster **M0 (Free)**.
2. En *Database Access*, crear un usuario. En *Network Access*, agregar `0.0.0.0/0`
   (o la IP de cada compañero).
3. En *Connect* → *Drivers*, copiar la cadena `mongodb+srv://…` y ponerla en `MONGO_URL`.

### Recrear la base MySQL desde cero

```bash
npm run db:mysql:semilla -- --reiniciar       # ⚠ borra todos los datos del pediátrico
```

## Usuarios de prueba (pediátrico)

Contraseña de todos: `Pediatrico#2026`

| Correo                      | Rol       | Puede…                                       |
|-----------------------------|-----------|----------------------------------------------|
| `dra.morales@pediatrico.gt` | médico    | registrar consultas, diagnósticos y recetas  |
| `dr.castillo@pediatrico.gt` | médico    | ídem                                         |
| `recepcion@pediatrico.gt`   | recepción | registrar pacientes y actualizar contactos   |
| `admin@pediatrico.gt`       | admin     | dar de baja (archivar) historiales           |

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
