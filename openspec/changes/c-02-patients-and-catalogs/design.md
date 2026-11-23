# Design

## Context

C-01 dejó `PatientsModule` y `CatalogsModule` vacíos e importados por `AppModule`, rutas React `/pacientes` → `PatientsPage` y `/prestaciones` → `CatalogPage`, y un `DataSource` TypeORM para MariaDB con entidades descubiertas por el glob `**/*.entity.{js,ts}` y `synchronize: false`. No hay `TypeOrmModule`: los repositorios se obtienen del `DataSource` exportado por `DatabaseModule`, que se inicializa de forma perezosa con `DatabaseConnectionService.ensureInitialized()`.

Restricciones que condicionan el diseño (motivación en `proposal.md`, requisitos en `specs/patient-registry` y `specs/clinic-catalogs`):

- ownership de C-02 según `scripts/change-scope/scope-map.json`: solo los cuatro directorios de feature, migraciones nuevas `C02` y este directorio OpenSpec;
- `ApiExceptionFilter` actual no propaga códigos de dominio (CR-01) y las pruebas de integración solo se descubren en `backend/test/**` (CR-02);
- `architecture-boundaries.spec.ts` falla si cualquier fuente no-spec de `backend/src` contiene `class Turno`, `solapamiento` u `overlap`; el código de C-02 no usa esos términos;
- TypeScript estricto sin `any`, MariaDB real en integración, datos ficticios, sin Playwright y sin dependencias nuevas.

## Goals / Non-Goals

**Goals:**

- Entregar la persistencia, la API y las pantallas de las tres entidades con la política P1-01 resuelta.
- Dejar a C-05 un puerto de lectura estable para validar referencias y copiar duración/intervalo.
- Garantizar la unicidad de DNI y nombres de catálogo en la base, no solo en la aplicación.

**Non-Goals:**

- Resolver el intervalo efectivo ni leer `ConfiguracionAgenda` (C-03/C-05).
- Impedir la desactivación de registros con turnos futuros: todavía no existen turnos. Si C-05/C-06 necesitan esa regla, la proponen sobre este puerto.
- Crear seeds de demostración, un componente modal compartido en `frontend/src/shared/**` o rutas nuevas en `frontend/src/app/**`.
- Autorización de endpoints: C-04 incorporará el guard de sesión; C-02 no agrega lógica de autenticación propia.

## Decisions

### 1. P1-01: baja lógica con columna `activo`

Cada tabla tiene `activo BOOLEAN NOT NULL DEFAULT TRUE`. El cambio de estado se expone como `PATCH /api/<recurso>/:id/estado` con body `{ activo: boolean }` y es idempotente. No hay endpoint `DELETE` ni borrado físico.

**Alternativas:** `deletedAt` con soft-delete de TypeORM oculta automáticamente los registros en consultas, lo que complicaría que C-06/C-07 muestren el nombre de una prestación inactiva en un turno histórico; además reactivar es menos natural. El borrado físico condicionado obligaría a C-05 a manejar referencias colgantes.

### 2. Esquema y migración

Una migración `<timestamp>-C02-CreatePatientsAndCatalogs.ts`, con timestamp posterior a la migración C-01 y `down` que elimina las tres tablas. Ids `CHAR(36)` con UUID generado en el servicio mediante `crypto.randomUUID()` y `PrimaryColumn` (evita que TypeORM mapee `uuid` al tipo nativo de MariaDB ≥ 10.7 y diverja de la migración). `created_at`/`updated_at` `DATETIME(6)`; `updated_at` lo mantiene MariaDB con `ON UPDATE CURRENT_TIMESTAMP(6)` porque `@UpdateDateColumn` escribe `CURRENT_TIMESTAMP` sin microsegundos y dejaba `updatedAt` anterior a `createdAt`. Las entidades declaran los mismos índices y `CHECK` que la migración, de modo que el schema builder de TypeORM no detecta diferencias. Charset `utf8mb4` con collation case-insensitive.

| Tabla | Columnas relevantes | Índices |
|---|---|---|
| `patients` | `name VARCHAR(120)`, `phone VARCHAR(30)`, `phone_digits VARCHAR(20)`, `dni VARCHAR(8) NULL`, `email VARCHAR(254) NULL`, `active` | `UNIQUE(dni)`, `INDEX(name)`, `INDEX(phone_digits)`, `INDEX(name, phone_digits)` |
| `procedures` | `name VARCHAR(120)`, `default_duration_minutes SMALLINT`, `post_interval_minutes SMALLINT NULL`, `active` | `UNIQUE(name)`, `CHECK` de rangos |
| `chairs` | `name VARCHAR(60)`, `active` | `UNIQUE(name)` |

En MariaDB un índice `UNIQUE` admite múltiples `NULL`, por lo que cumple "DNI único cuando está informado" sin índices filtrados. La collation case-insensitive hace que `UNIQUE(name)` aplique la regla "sin distinguir mayúsculas". Los `CHECK` de rango (`1..240`, `0..30`) duplican la validación como defensa en profundidad.

**Alternativa:** una columna generada para normalizar nombres se descarta porque el valor ya se guarda recortado y la collation resuelve mayúsculas.

### 3. Normalización en el dominio, no en el controlador

Funciones puras por módulo (`normalizePatientInput`, `normalizeCatalogName`) recortan y colapsan espacios, convierten `""` opcional en `null`, pasan email a minúsculas, derivan `phone_digits` y normalizan el DNI quitando `.`, espacios y `-`. Los DTO con `class-validator` validan forma y rangos; las funciones normalizan; el servicio aplica reglas de unicidad/duplicado. Esto deja la lógica testeable sin Nest ni MariaDB.

DNI: tras normalizar debe tener 7 u 8 dígitos (DNI argentino). Documentos extranjeros quedan fuera del MVP; si aparecen, se amplía la validación en un change posterior sin migrar datos (la columna admite 8 caracteres y bastaría ampliarla).

### 4. Unicidad resistente a concurrencia

El servicio no confía en "consultar y luego insertar". Inserta/actualiza y traduce el error MariaDB `ER_DUP_ENTRY` (errno 1062) según el índice afectado a `PATIENT_DNI_CONFLICT`, `PROCEDURE_NAME_CONFLICT` o `CHAIR_NAME_CONFLICT`. Una consulta previa solo se usa para mensajes, nunca como garantía.

### 5. Posible duplicado como confirmación en dos pasos

Antes de insertar o de editar nombre/teléfono, el servicio busca otros pacientes con el mismo `name` (collation case-insensitive) y `phone_digits`. Si hay coincidencias y `confirmarPosibleDuplicado !== true`, lanza `409 PATIENT_POSSIBLE_DUPLICATE` con `details: { candidatos: [{ id, nombre, activo }] }`. Los candidatos no incluyen teléfono, DNI ni email para respetar "detalles sin payloads personales completos". El flag no se persiste.

Esta comprobación no necesita lock: dos altas concurrentes del mismo posible duplicado no violan ninguna regla porque el duplicado está permitido.

**Alternativa descartada:** responder 201 con `warnings` informa tarde, cuando el duplicado ya existe.

### 6. Errores de dominio y dependencia de CR-01

Cada módulo define clases `HttpException` cuyo body es `{ code, message, details? }`. Con CR-01 aplicado, el filtro global publica ese `code`. Hasta que CR-01 esté en `main`, las tareas que verifican códigos de dominio quedan bloqueadas; no se edita el filtro desde esta rama.

Códigos: `VALIDATION_ERROR` (400, ya provisto por el filtro), `PATIENT_NOT_FOUND`, `PROCEDURE_NOT_FOUND`, `CHAIR_NOT_FOUND` (404), `PATIENT_DNI_CONFLICT`, `PATIENT_POSSIBLE_DUPLICATE`, `PROCEDURE_NAME_CONFLICT`, `CHAIR_NAME_CONFLICT` (409). Los ids de ruta se validan con `ParseUUIDPipe`; un id mal formado responde 400.

### 7. Contrato HTTP

| Método y ruta | Uso |
|---|---|
| `GET /api/pacientes?q&incluirInactivos&page&pageSize` | búsqueda paginada |
| `GET /api/pacientes/:id` | detalle (incluye inactivos) |
| `POST /api/pacientes` | alta; acepta `confirmarPosibleDuplicado` |
| `PUT /api/pacientes/:id` | edición completa; acepta `confirmarPosibleDuplicado` |
| `PATCH /api/pacientes/:id/estado` | `{ activo }` |
| idem para `/api/prestaciones` y `/api/sillones` | sin `confirmarPosibleDuplicado`; `q` filtra por nombre |

`PUT` (reemplazo completo) en lugar de `PATCH` parcial porque los formularios siempre envían todos los campos y evita ambigüedad entre "omitido" y `null` en opcionales.

Respuesta de lista: `{ items, page, pageSize, total }`, `page` desde 1, `pageSize` por defecto 20 y máximo 100. El tipo `Paginated<T>` vive en cada módulo (duplicación mínima y deliberada) y se propone para promoción a `shared` en C-08. La búsqueda de pacientes compara `q` con `name LIKE %q%` y, solo si `q` está formado únicamente por dígitos y signos de formato (`5555-0001`, `30.000.001`), también con `phone_digits LIKE %digitos%` y `dni LIKE %digitos%`. Un texto mixto como `Ficticio 1` busca solo por nombre, para no devolver cualquier teléfono que contenga un 1. Los comodines `%` y `_` de `q` se escapan. Orden: nombre ascendente, luego id.

Campos JSON en español según la KB: `id`, `nombre`, `telefono`, `dni`, `email`, `activo`, `duracionPredeterminadaMinutos`, `intervaloPosteriorMinutos`, `createdAt`, `updatedAt`. Columnas en inglés `snake_case`, consistente con C-01; el mapeo está en las entidades.

### 8. Estructura de módulos y puerto para C-05

```text
backend/src/modules/patients/
  patients.module.ts            importa DatabaseModule; exporta PatientReferences
  patient.entity.ts
  patients.controller.ts
  patients.service.ts
  patient-references.ts         puerto de lectura por id
  patient-normalization.ts
  dto/*.ts
  patient-errors.ts
  *.spec.ts / *.integration-spec.ts
backend/src/modules/catalogs/
  catalogs.module.ts            exporta CatalogReferences
  procedure.entity.ts, chair.entity.ts
  catalogs.controllers.ts       ProceduresController y ChairsController
  procedures.service.ts, chairs.service.ts
  catalog-references.ts
  catalog-normalization.ts
  dto/*.ts, catalog-errors.ts, paginated.ts
  *.spec.ts / *.integration-spec.ts
```

`PatientReferences.findById(id)` devuelve `{ id, nombre, activo } | null`; `CatalogReferences.findProcedureById(id)` devuelve además `duracionPredeterminadaMinutos` e `intervaloPosteriorMinutos`; `findChairById(id)` devuelve `{ id, nombre, activo }`. Para que C-05 pueda leer dentro de su transacción, cada método acepta un `EntityManager` opcional.

**Alternativa:** que C-05 lea las tablas directamente acopla su código al esquema de C-02 y rompe el ownership.

### 9. Frontend por feature

```text
frontend/src/features/patients/
  index.tsx                     PatientsPage (export ya usado por routes.tsx)
  api.ts                        llamadas tipadas vía shared apiRequest
  types.ts
  PatientForm.tsx, PatientList.tsx, DuplicateWarning.tsx
  *.test.tsx
frontend/src/features/catalog/
  index.tsx                     CatalogPage con secciones Prestaciones | Sillones
  api.ts, types.ts
  ProcedureForm.tsx, ChairForm.tsx, CatalogList.tsx
  ui/AdminModal.tsx             <dialog> nativo según component-contract
  ui/fields.tsx                 label arriba, ayuda y error debajo
  *.test.tsx
```

- Sillones se gestionan dentro de `CatalogPage` mediante pestañas con estado en el query string (`?seccion=sillones`), sin tocar `frontend/src/app/routes.tsx`.
- El modal usa `<dialog>` nativo (foco atrapado y `Esc` nativos), ancho `min(460px, calc(100vw - 32px))`, `rounded-2xl`, estructura header/body/footer del contrato y sin animación del shell. Patients lo importa desde `features/catalog/ui`; ambos directorios son de C-02. C-08 puede promoverlo a `shared`.
- La validación en el cliente se limita a campos obligatorios y tipos numéricos para dar feedback inmediato; los rangos y unicidades se muestran a partir de la respuesta del backend, que es la autoridad.
- Los errores `ApiClientError` se mapean a campos por `code` (`PATIENT_DNI_CONFLICT` → DNI, `*_NAME_CONFLICT` → nombre) y por los mensajes de `details` de `VALIDATION_ERROR`; el resto va a un `StatePanel` de error.
- La búsqueda usa debounce de 300 ms y paginación simple "anterior/siguiente".
- Se corrige el texto placeholder de `CatalogPage` que atribuía el módulo a C-03.

### 10. Estrategia de pruebas

- **Unitarias backend (`*.spec.ts`, Jest):** normalización, validación de DTO en los límites (0/1/240/241, -1/0/30/31, DNI con formato), servicio con repositorio simulado para la lógica de posible duplicado y mapeo de `ER_DUP_ENTRY`.
- **Integración MariaDB (`*.integration-spec.ts` en cada módulo, requiere CR-02):** ejecutar migraciones sobre la base de pruebas, levantar `AppModule` con Supertest y cubrir DNI único con formatos distintos, varios `NULL`, dos altas concurrentes con el mismo DNI (`Promise.all`), advertencia y confirmación de duplicado, nombres únicos en catálogos, búsqueda/paginación, desactivar/reactivar y `down` de la migración. Cada suite limpia sus tablas.
- **Frontend (Vitest + RTL):** formulario de paciente con flujo de advertencia y reenvío, errores por campo, cambio de sección del catálogo, estados vacío/error y "usa intervalo global".
- **Visual manual:** `/pacientes` y `/prestaciones` (ambas secciones, modal abierto) en 390×844 y 1440×900, registrado en `verification.md`.
- Fixtures: "Paciente Ficticio N", teléfonos `11 5555-00NN`, DNI `3000000N`, emails `@example.test`.

## Planned File Surface

La lista puede reducirse durante Apply; ampliarla fuera del ownership requiere aprobación de Pablo.

```text
backend/src/database/migrations/<timestamp>-C02-CreatePatientsAndCatalogs.ts
backend/src/modules/patients/**
backend/src/modules/catalogs/**
frontend/src/features/patients/**
frontend/src/features/catalog/**
openspec/changes/c-02-patients-and-catalogs/**
```

Fuera de la superficie, pedidos a Pablo (proposal §Impact): `backend/src/shared/http/api-exception.filter.ts` + su spec (CR-01) y `backend/test/jest.integration.config.cjs` (CR-02).

## UI Mockups

- **Design system revision:** 1
- **Decision:** no (project policy `system-only`)
- **Preview:** manual
- **Visual verify:** pendiente; se registrará en `verification.md` con pantallas y viewports revisados

## Risks / Trade-offs

- **[CR-01/CR-02 no se aprueban a tiempo]** → la implementación de módulos, migración y frontend avanza; solo las tareas de verificación de códigos de dominio y de integración MariaDB quedan bloqueadas y se informan explícitamente en lugar de sustituirse por otro motor.
- **[La validación de DNI rechaza documentos extranjeros]** → decisión explícita del MVP; la ampliación no requiere migrar datos existentes.
- **[Nombres únicos de catálogo incluyen inactivos]** → evita duplicados confusos al reactivar; el mensaje de error sugiere reactivar el existente.
- **[`Paginated<T>` duplicado en dos módulos]** → forma idéntica documentada en la spec; C-08 la consolida.
- **[Modal propio de feature]** → respeta ownership; riesgo de divergencia visual mitigado siguiendo `design-system/component-contract.md` y revisión de C-08.
- **[Endpoints sin autenticación hasta C-04]** → aceptable en desarrollo con datos ficticios; C-04 aplica el guard globalmente.

## Migration Plan

1. Agregar la migración `C02` y ejecutarla/revertirla sobre la base de pruebas MariaDB.
2. Implementar backend de catálogos y pacientes con pruebas unitarias.
3. Implementar frontend de ambas features con pruebas de componentes.
4. Con CR-01 y CR-02 integrados en `main`, actualizar la rama desde `main` y ejecutar la integración MariaDB.
5. Verificación visual manual y registro en `verification.md`.

Rollback: revertir la rama antes de integrar; después de integrar, la migración `down` elimina las tres tablas (sin datos reales comprometidos).
