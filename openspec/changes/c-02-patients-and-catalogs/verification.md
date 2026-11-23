# Verification — C-02 patients-and-catalogs

Registro de evidencia por grupo de tareas. Datos usados: exclusivamente ficticios.

## Entorno

- Fecha: 2026-11-23.
- Node 22.23.5; dependencias instaladas con `npm ci` desde el lockfile de C-01, sin cambios en `package.json`.
- MariaDB **10.11.14** real (servidor local del entorno de desarrollo), bases `turnos_odontologia` y `turnos_odontologia_test` con `utf8mb4_unicode_ci`. Sin SQLite ni base en memoria.
- Línea base antes de C-02: `npm run build`, `npm test` (14/14) y `npm run test:integration` (2/2) en verde.

## Coordinación (grupo 0)

| Pedido | Estado |
|---|---|
| CR-01 — filtro global propaga `code`/`details` | Pendiente de enviar a Pablo. Confirmado en ejecución real: los errores de dominio salen como `HTTP_409`/`HTTP_404` con el mensaje correcto. |
| CR-02 — integración descubre `src/**/*.integration-spec.ts` | Pendiente de enviar a Pablo. |
| Hallazgo para Pablo — guard de scope inerte en Linux | `node scripts/change-scope/check.mjs --branch nonexistent-branch --base main` termina con código 0 y sin salida: la comparación de `import.meta.url` con `file:///` + ruta absoluta POSIX nunca coincide, así que `main()` no se ejecuta en `ubuntu-latest`. `validateChanges` funciona invocado directamente (0 violaciones para C-02; 6 con la política de C-03). |
| Observaciones menores de C-01 | `tsc --noEmit` reporta 3 errores de tipos preexistentes en `health.service.spec.ts` y `request-id.middleware.spec.ts`; al arrancar, Nest advierte `LegacyRouteConverter` por `forRoutes('*')`. No afectan a C-02. |

## Grupo 1 — Persistencia

- `npm run build` sin errores; `npm run lint` (oxlint type-aware) sin hallazgos.
- Migración contra MariaDB de pruebas: `up` ejecuta C01 y C02; tablas `patients`, `procedures`, `chairs` creadas con `utf8mb4_unicode_ci`; `down` deja 0 tablas de C-02.
- `npm run migration:run` (CLI del proyecto) aplica C01 y C02 sobre la base de desarrollo.
- Constraints verificados con SQL directo: `CHECK` rechaza duración 241; `UNIQUE(dni)` admite varios `NULL`; `UNIQUE(name)` rechaza `Sillón 1`/`SILLÓN 1` (`ER_DUP_ENTRY`).
- `createSchemaBuilder().log()` con las entidades compiladas: **0 diferencias** entre entidades y esquema migrado.
- Sin `any` ni términos vetados por `architecture-boundaries.spec.ts` en los archivos nuevos.

## Grupo 2 — Catálogos backend

- `npm test`: **59/59** (45 nuevos en `catalog-input.spec.ts`, `catalogs.services.spec.ts`, `catalogs.controllers.spec.ts`), incluidos límites 0/1/240/241 y -1/0/30/31, paginación 0/100/101, mapeo de `ER_DUP_ENTRY`, 404, `PUT` que deja `null` el intervalo omitido, puerto `CatalogReferences` con `EntityManager` del consumidor y ausencia de `DELETE`.
- Prueba de humo HTTP contra MariaDB real (`node dist/main.js` + `curl`):
  - alta normaliza `"  Control   ficticio "` → `"Control ficticio"`; sin intervalo devuelve `intervaloPosteriorMinutos: null`;
  - nombre repetido en otra capitalización → 409 (código `HTTP_409` hasta CR-01); duración 241 → 400 `VALIDATION_ERROR`;
  - desactivar → `activo: false`, deja de listarse por defecto y aparece con `incluirInactivos=true`; `page=2&pageSize=1` → `total: 2`;
  - `q=%` devuelve 0 resultados (comodín escapado); id inexistente → 404; `DELETE` → 404 de ruta.
- Defecto encontrado y corregido: `@UpdateDateColumn` escribía `updated_at` sin microsegundos (quedaba anterior a `createdAt`). Tras delegarlo a `ON UPDATE CURRENT_TIMESTAMP(6)`: `createdAt …11.145Z`, `updatedAt …11.469Z`.
- Logs del servidor: solo método, ruta (con ids) y estado; sin datos personales.

## Grupo 3 — Pacientes backend

- `npm test`: **121/121** (62 nuevos en `patient-input.spec.ts`, `patients.service.spec.ts`, `patients.controller.spec.ts`): normalización de nombre, teléfono, DNI y email; teléfono 6–20 dígitos y caracteres permitidos; DNI 7–8 dígitos; email inválido y vacío; lógica de posible duplicado (candidatos mínimos, confirmación, exclusión del propio registro, edición sin cambios de identidad); mapeo de `ER_DUP_ENTRY` a `PATIENT_DNI_CONFLICT` en alta y edición; 404; `PatientReferences`; ausencia de `DELETE`. `npm run lint` y `npm run build` limpios.
- Prueba de humo HTTP contra MariaDB real:
  - alta normaliza `"  Paciente   Ficticio  Uno "`, DNI `30.000.001` → `30000001` y email → minúsculas;
  - DNI repetido como `30 000 001` → 409; dos pacientes sin DNI → 201 ambos; teléfono compartido con otro nombre → 201 sin advertencia;
  - `paciente ficticio uno` + `1155550001` → 409 de posible duplicado; reenviado con `confirmarPosibleDuplicado: true` → 201; editar solo el email de un paciente que coincide con otro → 200 sin confirmación;
  - **5 altas simultáneas con el mismo DNI → exactamente una 201 y cuatro 409; 1 fila en la base**;
  - búsqueda: `ficticio uno` (nombre), `5555-0002` (teléfono), `30.000.001` (DNI), `Ficticio 1` (solo nombre), `50%` (0 resultados, comodín escapado);
  - desactivar oculta del listado por defecto; visible con `incluirInactivos=true` y por id; id inexistente → 404.
- Hallazgo que refuerza CR-01: la respuesta de posible duplicado llega **sin `details.candidatos`** porque el filtro global descarta `details` con forma de objeto. El servicio sí los produce (cubierto por test unitario).
- Mejora aplicada tras la prueba: la búsqueda por dígitos solo se activa si `q` contiene únicamente dígitos y signos de formato.
- Logs del servidor durante la prueba: 0 apariciones de nombres, teléfonos, DNI o emails ficticios.

## Pendiente

- Grupos 4 a 6 (`tasks.md`). Las suites `*.integration-spec.ts` de C-02 dependen de CR-02 para ejecutarse con `npm run test:integration`.
