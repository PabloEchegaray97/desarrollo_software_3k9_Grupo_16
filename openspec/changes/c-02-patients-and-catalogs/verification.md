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
| CR-01 — filtro global propaga `code`/`details` | Pendiente de enviar a Pablo; propuesta verificada en `coordination.md`. Confirmado en ejecución real: los errores de dominio salen como `HTTP_409`/`HTTP_404` con el mensaje correcto. |
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

## Grupo 5 — Frontend

- `npm test` (Vitest + RTL): **33/33** (26 nuevos en `ui/ui.test.tsx`, `catalog.test.tsx`, `patients.test.tsx`; los 7 de C-01 siguen pasando, incluido `routes.test.tsx` que renderiza `/pacientes` sin `fetch` simulado).
  - Modal: título y descripción accesibles, cierre con `X` y con Esc (evento `cancel`, con `preventDefault`), sin contenido al estar cerrado.
  - Campos: `aria-invalid` y `aria-describedby` asocian error y ayuda.
  - Catálogo: "usa intervalo global" vs. "intervalo posterior N min", badge Inactivo, cambio a Sillones con `?seccion=sillones` sin salir de `/prestaciones`, sección inicial desde la URL, estado vacío, error con Reintentar, error de rango del backend junto al campo conservando valores, validación local de presencia/tipo sin llamar al backend, conflicto de nombre junto al campo, desactivar y recargar.
  - Pacientes: listado con teléfono/DNI/email, estado vacío, búsqueda con debounce (una sola solicitud), DNI/email vacíos → `null`, **advertencia de posible duplicado con candidatos y reenvío con `confirmarPosibleDuplicado: true`**, "Volver a revisar" conserva el formulario sin guardar, advertencia sin candidatos (comportamiento actual previo a CR-01), DNI repetido junto al campo, obligatorios locales, edición con `PUT`.
- `npx tsc -b`, `npm run lint` (oxlint) y `npm run build` sin errores. Sin `any`. `frontend/dist` está ignorado por git.
- Hallazgo corregido durante los tests: el estado vacío mostraba un segundo botón "Nuevo …" igual al de la barra.
- Dependencia de CR-01 en la interfaz: hasta que el filtro propague `code`, el backend real responde `HTTP_409` y la interfaz muestra el mensaje genérico arriba del formulario en lugar de la advertencia de duplicado o el error junto al DNI/nombre. Los tests cubren el contrato acordado.
- **Revisión visual manual: pendiente (tarea 6.1).** Este entorno no tiene navegador permitido para el proyecto (sin Playwright por regla 9); debe hacerse en una máquina del equipo.

## Grupo 4 — Integración con MariaDB real

- Fixtures ficticios: `patients/testing/fictional-patients.support-spec.ts` ("Paciente Ficticio N", `11 5555-00NN`, DNI `3000000N`, `@example.test`). Soporte compartido: `catalogs/testing/integration-harness.support-spec.ts` (migra la base de pruebas, levanta `AppModule` como `main.ts`, limpia tablas). El sufijo `.support-spec.ts` los excluye del build y de ambas suites.
- Suites: `catalogs.integration-spec.ts` (18 casos) y `patients.integration-spec.ts` (18 casos), ejecutadas cada una con `--testMatch` explícito porque la configuración compartida no las descubre (CR-02).
- **Rama actual, sin CR-01: 27/36.** Las 9 fallas son exclusivamente la aserción final de `code` (`HTTP_409`/`HTTP_404` en lugar del código de dominio); todo lo anterior en esos casos sí se verificó (estado HTTP, filas, concurrencia).
- **Con el parche propuesto de CR-01 aplicado en un worktree temporal (fuera de esta rama): 36/36**, y unitarias backend 121/121.
- Cubre: límites de duración/intervalo por API y `CHECK` de la base; nombre de catálogo repetido (también contra inactivo) y reactivación; mismo nombre en catálogos distintos; orden, paginación e inactivos; búsqueda con comodines escapados; catálogo vacío; edición sin efecto sobre otras filas; alta mínima y normalización; cinco casos inválidos sin crear filas; varios DNI `NULL`; DNI repetido con otro formato y al editar; **5 altas concurrentes con el mismo DNI → `[201, 409, 409, 409, 409]` y 1 fila**; posible duplicado y confirmación; teléfono compartido; edición sin cambio de identidad; búsqueda por nombre/teléfono/DNI; paginación inválida; DNI de inactivo reservado; sin `DELETE`; 404; `down` y `up` de la migración C02.
- Hallazgo para CR-02: la configuración de integración no admite más de una suite por proceso (`Test environment has been torn down`), lo que también afecta a la suite de C-01. Detalle y opciones en `coordination.md`.
- Tarea 4.4 sigue abierta: requiere CR-01 y CR-02 integrados en `main` para correr `npm run test:integration` tal como está definido.

## Pendiente

- Tareas 0.1, 0.2, 4.4, 6.1 y 6.2. (`tasks.md`). Las suites `*.integration-spec.ts` de C-02 dependen de CR-02 para ejecutarse con `npm run test:integration`.
