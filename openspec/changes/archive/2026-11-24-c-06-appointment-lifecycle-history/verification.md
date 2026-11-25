# Verification — c-06-appointment-lifecycle-history

## Gate CRÍTICO de governance (tarea 0.1)

- **Fecha:** 2026-11-23 (hora local `America/Argentina/Buenos_Aires`; 2026-11-24 UTC).
- **Estado:** aprobado antes de iniciar las tareas 1.x–6.x. Se cumple el gate CRÍTICO de la ficha C-06 de `CHANGES.md`.
- **Aprobación:** Milagros aprobó explícitamente las once decisiones de `design.md` § *Aprobación requerida antes de Apply* y confirmó el visto bueno previo de Pablo sobre `proposal.md`, los dos delta specs, `design.md` y `tasks.md`.
- **Verificación previa:** rama exacta `change/c-06-appointment-lifecycle-history`, HEAD `7b510b2`; `openspec status --change ... --json` = `state: ready`, planning completo; `openspec list --json` = root `nearest`.

| # | Decisión aprobada | Resultado |
|---|---|---|
| 1 | P1-02: campos visibles por evento (`id`, `tipo`, `ocurridoEn`, `estadoAnterior`, `estadoNuevo`, `inicioAnterior`, `inicioNuevo`, `sillonAnteriorId`, `sillonNuevoId`, `motivo` solo en `CANCELADO`/`REPROGRAMADO`/`EXCEPCION`) | Aprobada |
| 2 | P1-04: motivo obligatorio 1–500 normalizado al reprogramar; `VALIDATION_ERROR` 400 con `details.campo: "motivo"` | Aprobada |
| 3 | Matriz exacta de transiciones RN-TU-13/14/17, con `CANCELADO` solo por `/cancelar` | Aprobada |
| 4 | Estados terminales `ATENDIDO`/`AUSENTE`/`CANCELADO` sin salidas | Aprobada |
| 5 | Ventana temporal `[inicio, sin cota superior)` con `now >= inicio`, reloj inyectable y zona IANA | Aprobada |
| 6 | Reprogramar `CONFIRMADO` → `PROGRAMADO` con un único evento `REPROGRAMADO` | Aprobada |
| 7 | Preservación de valores efectivos y trazabilidad sin duplicar fines derivados | Aprobada |
| 8 | Atomicidad con `FOR UPDATE` sobre `configuracion_agenda`, rollback total y sin eventos huérfanos | Aprobada |
| 9 | Contratos HTTP neutrales y forma/historial ordenado sin paginación | Aprobada |
| 10 | Superficie exacta de archivos; sin migraciones ni cambios en `core/`, `creation/`, `create/`, agenda, `app.module.ts`, `routes.tsx`, shared, KB ni design system | Aprobada |
| 11 | Plan de pruebas: unitarias, integración con MariaDB real, frontend y revisión visual manual sin Playwright | Aprobada |

**Conclusión:** el gate CRÍTICO quedó cerrado; se autoriza el inicio de las tareas 1.x y siguientes dentro del ownership de C-06.

## Registro de ejecución — Batch A (tareas 0.1, 1.1–1.4)

### Safety net (ejecutado antes de escribir código)

| Comando | Resultado |
|---|---|
| `backend: npm test` | 26 suites, 284 tests passing |
| `backend: npm run test:integration` (MariaDB real `127.0.0.1:3307`) | 6 suites, 97 tests passing (26 + 12 + 21 + 18 + 18 + 2); sin SQLite ni base en memoria |
| `frontend: npm test` | 15 archivos, 91 tests passing |
| `frontend: npx tsc -b` | exit 0 |

No se detectaron fallos preexistentes en esas suites. No se modificaron archivos de código existentes: las cuatro tareas 1.x crearon archivos nuevos dentro de `backend/src/modules/appointments/lifecycle/**`.

### Strict TDD por tarea

| Tarea | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| 1.1 | 1 suite falló (`appointment-transitions.js` inexistente) | 1 test passing | 25 tests passing (7 aristas permitidas, rechazos, terminales, reloj 1 ms antes/en/después y offsets) | Sin cambios: política ya mínima y pura |
| 1.2 | 1 suite falló (`reschedule-appointment.dto.js` inexistente); RED sucesivo para `cancel-appointment.dto.js` y `change-appointment-status.dto.js` | 1, 12 y 13 tests passing por etapa | 20 tests passing (1/500/501 caracteres, vacío, fechas/horas, UUID, excepción, estados no reconocidos) | Sin cambios: normalizador compartido ya extraído |
| 1.3 | 1 suite falló (`lifecycle-errors.js` inexistente); RED sucesivo para `dto/appointment-lifecycle-response.js` | 1 y 13 tests passing | 14 tests passing (conflicto/transición sin datos de paciente, códigos y HTTP, orden del historial) | Sin cambios: composer ya mínimo |
| 1.4 | 1 suite falló (`lifecycle-event.factory.js` inexistente); RED sucesivo para los builders de cancelación/cambio de estado | 1 y 6 tests passing | 6 tests passing (CONFIRMADO→PROGRAMADO en un evento, PROGRAMADO, EXCEPCION, CANCELADO, CAMBIO_ESTADO sin motivo) | `withId` + `EMPTY_PERIOD`; 6 tests volvieron a pasar |

### Verificación posterior al batch

- `backend: npm test` → 30 suites, **349 tests passing** (284 baseline + 65 nuevos).
- `backend: npx oxlint --type-aware src/modules/appointments/lifecycle` → exit 0, sin hallazgos.
- Sin `any` en los archivos nuevos; sin I/O ni reloj directo en `domain/appointment-transitions.ts`.
- Sin migraciones nuevas: el esquema de C-05 cubre los campos necesarios.

## Registro de ejecución — Batch B (tareas 2.1, 2.2, 2.3)

### Safety net (ejecutado antes de escribir código)

| Comando | Resultado |
|---|---|
| `backend: npm test` | 30 suites, 349 tests passing |
| `backend: npm run test:integration` (MariaDB real `127.0.0.1:3307`) | 6 suites, 97 tests passing (26 + 12 + 21 + 18 + 18 + 2); sin SQLite ni base en memoria |
| `frontend: npm test` | 15 archivos, 91 tests passing |
| `backend: npx tsc -b --pretty false` | exit 1 únicamente por la deuda preexistente de cuatro archivos ajenos a C-06, detallada al final de este documento; sin errores nuevos |

Todas las suites ejecutables estaban verdes antes del primer cambio. El estado inicial del CLI era `{"total":19,"complete":5,"remaining":14}` sobre la rama `change/c-06-appointment-lifecycle-history` (HEAD `7b510b2`).

### Strict TDD por tarea

| Tarea | Test file / capa | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 2.1 | `backend/src/modules/appointments/lifecycle/reschedule-appointment.service.spec.ts` / servicio | 1 suite falló por módulo inexistente | 2 tests passing (reprogramación ordinaria y 404 sin eventos) | 15 tests passing: orden de los once pasos, override innecesario, `CONFIRMADO` → `PROGRAMADO` con un evento, `excludeId`, conflicto antes de disponibilidad, excepción, sillón inválido, DTO antes de transacción, fecha local inexistente, terminal y rollback | Extracción de `lifecycle-transaction.ts` y ejecución nuevamente de los 15 tests, todos passing |
| 2.2 | `backend/src/modules/appointments/lifecycle/cancel-appointment.service.spec.ts` y `change-appointment-status.service.spec.ts` / servicio | 1 suite falló por módulo inexistente en cada servicio | Primer caso de cancelación y primer caso de cambio de estado, passing | 11 tests passing (4 cancelación + 7 estado): motivo ausente/vacío antes de la transacción, `CANCELADO` rechazado por `/estado`, `ATENDIDO` 1 ms antes del inicio, aceptación exacta en el inicio, reloj inyectable para `AUSENTE`, transiciones inválidas y rollback | Sin cambios adicionales: el esqueleto transaccional compartido ya estaba extraído en 2.1; los 11 tests se mantuvieron en verde |
| 2.3 | `backend/src/modules/appointments/lifecycle/appointments-lifecycle.controller.spec.ts` / controlador + composición | 1 suite falló por módulo inexistente | 13 tests passing (códigos 200/400/404/409/422 y mapeo de errores) | 14 tests passing al agregar la prueba de composición de `AppointmentLifecycleModule` (core + disponibilidad + catálogos y registro de los tres servicios) | Sin cambios: la declaración de `AppointmentTransactions` ya vivía en `lifecycle-transaction.ts`; 14 tests en verde tras el ajuste |

Cada etapa se ejecutó con el comando correspondiente (`npm test -- <spec>` o `npm test -- --runInBand`) y ningún avance al GREEN se hizo sin un RED observado previamente.

### Verificación posterior al batch

| Comando | Resultado |
|---|---|
| `backend: npm test -- --runInBand` | 34 suites, **389 tests passing** (349 baseline + 40 nuevos: 15 + 11 + 14) |
| `backend: npx tsc -b --pretty false` | exit 1 solo con los cuatro errores preexistentes ya documentados; ninguno en `lifecycle/**` |
| `backend: npm run lint` (`oxlint --type-aware src/ test/`) | exit 0, sin errores ni advertencias; se corrigieron los avisos de uniones redundantes y spreads de instancias en los specs nuevos |
| `backend: npm run test:integration` | 6 suites, **97 tests passing** contra MariaDB real; la finalización del módulo no rompió el arranque de `AppModule` |
| `backend: npm run build` (`nest build`) | exit 0 |
| `frontend: npm test` | 15 archivos, 91 tests passing (intacto; Batch B no tocó frontend) |
| `root: node scripts/change-scope/check.mjs --branch change/c-06-appointment-lifecycle-history --base main` | Scope check passed |

No se agregó ninguna dependencia ni migración. No se usó `any` en los archivos nuevos. No se realizaron capturas ni revisión visual: Batch B no incluye cambios de UI; las tareas 5.x y 6.1 quedan para el lote frontend y su revisión manual sin Playwright.

### Decisiones y desviaciones del batch

- `APPOINTMENT_TOO_EARLY` no se implementó en reprogramación porque el algoritmo de once pasos de `design.md` § 4 no incluye la ventana temporal; se cubre en el cambio de estado (tarea 2.2) con `now >= inicio`.
- La proyección P1-02 del historial se concentró en `lifecycle-history.reader.ts` (`readLifecycleHistory(tx.manager, id)` + `toLifecycleHistory`) para que las respuestas de mutación y el futuro `GET /turnos/:id/historial` (tarea 3.1) usen exactamente la misma forma y orden.
- La interfaz `AppointmentTransactions` se movió a `lifecycle-transaction.ts` y se reexportó desde el servicio de reprogramación por compatibilidad; cancel/status no dependen del módulo de reprogramación.
- La validación DTO se ejecuta dentro de cada servicio antes de abrir la transacción mediante `validateLifecycleInput(...)`, con `plainToInstance` siempre aplicado para que `@Transform(normalizeReason)` se ejecute incluso si el llamador entrega una instancia.

### Issue preexistente (no corregido, deuda ajena; aplica también a Batch B)

`backend: npx tsc -b` falla con errores en archivos no tocados por C-06: `src/health/health.service.spec.ts` (2), `src/modules/availability/availability.integration-spec.ts`, `src/modules/availability/testing/api-harness.support-spec.ts` (opción `timezone` no reconocida en el tipado de TypeORM) y `src/shared/http/request-id.middleware.spec.ts`. Ninguno pertenece a `lifecycle/**`; se reporta para C-08/5.3 y no se modifica desde esta rama.

## Registro de ejecución — Batch C (tareas 3.1, 3.2)

### Safety net (ejecutado antes de modificar `history/appointment-history.module.ts`)

| Comando | Resultado |
|---|---|
| `backend: npm test -- --runInBand` | 34 suites, 389 tests passing (idéntico al cierre de Batch B) |
| `backend: npm run test:integration` (MariaDB real `127.0.0.1:3307`) | 6 suites, 97 tests passing (26 + 12 + 21 + 18 + 18 + 2); sin SQLite ni base en memoria |
| `backend: npm run build` | exit 0 |

Sin fallos preexistentes en las suites ejecutables. Estado inicial del CLI: `{"total":19,"complete":8,"remaining":11}`.

### Strict TDD por tarea

| Tarea | Test file / capa | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 3.1 | `backend/src/modules/appointments/history/get-appointment-history.service.spec.ts` / servicio + DTO | 1 suite falló por `get-appointment-history.service.js` inexistente | 1 test passing (P1-02 exacto, nulos y sin datos de paciente) | 6 tests passing: motivos solo en `REPROGRAMADO`/`CANCELADO`/`EXCEPCION`, UTC `Z`, desempate por `id`, 12 eventos sin `take`/`skip`, 404 neutral y propagación de errores no mapeados | Sin cambios: la proyección y el orden ya se reutilizan de `lifecycle-history.reader.ts`; 6 tests en verde tras cada etapa |
| 3.2 | `backend/src/modules/appointments/history/appointments-history.controller.spec.ts` / controlador + módulo | 1 suite falló por `appointments-history.controller.js` inexistente | 4 tests passing (200 con DTO exacto, 401 sin sesión, 404 neutral y metadata del módulo) | 5 tests passing al agregar la resolución DI real del módulo (core + writer y boundary simulados) y verificar las claves del DTO en la respuesta 200 | Ajustes de tests y producción: `APP_GUARD` importado de `@nestjs/core`, doble del servicio como objeto, `DataSource` simulado y `AppointmentWriter` importado como valor (necesario para `design:paramtypes`); tests, lint y build en verde |

Cada GREEN se ejecutó después de observar el RED correspondiente. No se agregaron tests triviales ni aserciones de solo tipo.

### Verificación posterior al batch

| Comando | Resultado |
|---|---|
| `backend: npm test -- --runInBand` | 36 suites, **400 tests passing** (389 baseline + 11 nuevos: 6 de 3.1 y 5 de 3.2) |
| `backend: npm run test:integration` | 6 suites, **97 tests passing** contra MariaDB real; `AppModule` arranca con el módulo de historial completado |
| `backend: npm run lint` | exit 0, sin hallazgos |
| `backend: npm run build` | exit 0, sin editar `app.module.ts` ni `appointments.module.ts` |
| Búsqueda de `any` en `history/**` | sin coincidencias |

Sin migraciones ni dependencias nuevas. Sin cambios de UI en este batch: no se requirió revisión visual ni Playwright. La deuda preexistente de `npx tsc -b` detallada arriba permanece sin modificar.

### Decisiones y desviaciones del batch

- `GetAppointmentHistoryService` reutiliza `readLifecycleHistory` y `loadAppointment` de `lifecycle/**` dentro de la misma frontera transaccional: no existe una segunda proyección P1-02 ni un segundo mapeo de 404.
- `dto/appointment-history-response.ts` reexporta el tipo `LifecycleEventResponse` para que el `GET` y las mutaciones no puedan divergir; `history-errors.ts` delega en `appointmentNotFound()` de `lifecycle-errors.ts`.
- La consulta se ejecuta dentro de `APPOINTMENT_TRANSACTION_BOUNDARY` sin tomar el lock de agenda: es una lectura, y el lock global queda reservado para escrituras (design § Atomicidad).
- El `401` se prueba con un guard simulado equivalente al `SessionGuard` global de C-04 (cookie requerida), sin base de datos y sin modificar módulos de auth.

## Registro de ejecución — Batch D (tareas 4.1, 4.2, 4.3 y 4.4)

### Safety net (ejecutado antes de escribir código)

| Comando | Resultado |
|---|---|
| `backend: npm test -- --runInBand` | 36 suites, 400 tests passing (idéntico al cierre de Batch C) |
| `backend: npm run test:integration` (MariaDB real, `127.0.0.1:3307`, base `turnos_odontologia_test`) | 6 suites, 97 tests passing (26 + 12 + 21 + 18 + 18 + 2); sin SQLite ni base en memoria |
| `backend: npm run lint` (`oxlint --type-aware src/ test/`) | exit 0, sin hallazgos |
| `backend: npm run build` (`nest build`) | exit 0 |

Estado inicial del CLI: `{"total":19,"complete":10,"remaining":9}` sobre `change/c-06-appointment-lifecycle-history` (HEAD `7b510b2`). No se modificó código de producción: solo se agregaron el harness y el spec de integración dentro de `lifecycle/**`.

### Versión de MariaDB y comandos de integración (sin secretos)

- **Motor detectado por la propia suite:** `13.0.2-MariaDB` (`SELECT VERSION()`), impreso como `[C-06] MariaDB real: 13.0.2-MariaDB`.
- **Conexión:** host `127.0.0.1`, puerto `3307`, base `turnos_odontologia_test`; las credenciales viven en `backend/.env` y no se registran aquí.
- Suite nueva (comando usado en cada ciclo TDD):
  `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest.integration.config.cjs --runInBand --runTestsByPath src/modules/appointments/lifecycle/appointments-lifecycle.integration-spec.ts`
  → 1 suite, **23 tests passing**.
- Suite completa con zona argentina:
  `cmd /c "set TZ=America/Argentina/Buenos_Aires&& npm run test:integration"`
  → 7 suites, **120 tests passing** (97 preexistentes + 23 nuevos). Confirma que la ejecución con `TZ=America/Argentina/Buenos_Aires` no altera los literales UTC.

### Strict TDD por tarea

| Tarea | Test file / capa | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| 4.1 | `lifecycle/appointments-lifecycle.integration-spec.ts` + `lifecycle/testing/appointment-lifecycle-api.support-spec.ts` / harness MariaDB | El spec no compilaba: `Could not locate module ./testing/appointment-lifecycle-api.support-spec.js` | 1 test passing: driver `mariadb`, versión real y fixtures `C06` leídos por SQL | 2 tests passing: intentar borrar un paciente referenciado falla con `ROW_IS_REFERENCED`, y el orden eventos → turnos → paciente sí funciona | Sin cambios de producción; el harness quedó con un único `cleanupLifecycleData` reutilizado en `beforeAll`/`afterAll` |
| 4.2 | `lifecycle/appointments-lifecycle.integration-spec.ts` / API + SQL | El spec no exportaba `storedAppointmentRow`; luego se corrigió una expectativa plana frente al contrato `{ turno, historial }` | 1 test passing: reprogramación sin cambio de sillón, minutos preservados y `REPROGRAMADO` consultado por SQL | 16 tests passing: con/sin sillón nuevo, `CONFIRMADO → PROGRAMADO`, excepción con/sin override y override innecesario, sillón inactivo/reactivo, feriado, cancelación con `cancellation_reason` y horario liberado, cinco aristas permitidas y todos los rechazos (terminales, doble confirmación, `TOO_EARLY`, `CANCELADO` por `/estado`) | Aserciones de eventos hechas insensibles al orden cuando `occurred_at` coincide (el desempate real por `id` se comprueba en 4.4) |
| 4.3 | `lifecycle/appointments-lifecycle.integration-spec.ts` / atomicidad + concurrencia | El spec no exportaba `countAppointmentEvents` | 1 test passing: writer que falla → 500, fila y eventos intactos y recuperación posterior | 3 tests passing: dos reprogramaciones incompatibles simultáneas, mismo sillón (`SILLON`) y sillones distintos (`ODONTOLOGO`), exactamente una 200 y una 409 con `details` neutrales | Sin cambios de producción; se reutilizaron los contadores globales del harness para detectar huérfanos |
| 4.4 | `lifecycle/appointments-lifecycle.integration-spec.ts` / instantes + historial | El spec no exportaba `storedEventIdsInOrder` | 1 test passing: historial de la mutación = `GET` = orden SQL, con reloj fijo incremental | 2 tests passing: columnas `DATETIME(6)` y literales UTC (`starts_at` `2027-03-10 13:00:00`/`15:00:00`, `occurred_at` `2027-03-01 12:00:00`/`12:05:00`) bajo `TZ=America/Argentina/Buenos_Aires` | Se corrigió el alias SQL `precision` (reservada) y se ordenó la consulta de `information_schema` para hacerla determinista |

### Evidencia concreta de base de datos

- **Atomicidad:** con `writer.failNextEvents = true`, la respuesta es `500 INTERNAL_ERROR`; `starts_at` sigue `2027-03-10 13:00:00`, el turno sigue `PROGRAMADO`, solo existe el evento `CREADO` (conteo global 1) y no hay turnos nuevos (conteo global 1). Tras recuperarse el writer, la misma reprogramación termina 200 con un único `REPROGRAMADO` y conteo global 2.
- **Concurrencia:** dos `PATCH /reprogramar` simultáneos sobre el mismo intervalo devuelven estados `[200, 409]`; el perdedor recibe `APPOINTMENT_CONFLICT` con `alcance: SILLON` u `ODONTOLOGO` según el caso, `conflictos` con `turnoId`/`sillonId`/`inicio`/`finBloqueo` y sin datos de paciente; la fila perdedora queda idéntica y no gana un evento `REPROGRAMADO`.
- **FK `RESTRICT`:** borrar directamente un paciente con turno/evento falla con `ROW_IS_REFERENCED`; el `afterAll` borra `appointment_events` → `appointments` → excepciones → pacientes/catálogos `C06`.
- **Zona horaria:** con `TZ=America/Argentina/Buenos_Aires` (Node informa el alias canónico `America/Buenos_Aires`), las columnas `DATETIME(6)` conservan el instante UTC literal y la API responde ISO con `Z`; no se persiste el offset `-03:00`.

### Decisiones y desviaciones del batch

- No se detectó ningún bug de producción en `lifecycle/**` ni en `history/**`: todas las correcciones fueron de expectativas o del SQL de verificación del propio test.
- No se agregaron migraciones ni dependencias. No se usó `any`, SQLite ni base en memoria. No se editaron `core/**`, `creation/**`, módulos de composición, artefactos OpenSpec de otros changes ni migraciones existentes.
- No hay cambios de UI en este batch: no se requirió revisión visual ni Playwright (política `system-only`).
- La deuda preexistente de `backend: npx tsc -b` (cuatro archivos ajenos a C-06, detallada en Batches B/C) permanece sin modificar.

## Registro de ejecución — Batch E (tareas 5.1, 5.2 y 5.3)

### Safety net (ejecutado antes de escribir código)

| Comando | Resultado |
|---|---|
| `frontend: npm test` | 15 archivos, 91 tests passing |
| `frontend: npx tsc -b --pretty false` | exit 0 |
| `backend: npm test -- --runInBand` | 36 suites, 400 tests passing |
| `backend: npm run test:integration` (`TZ=America/Argentina/Buenos_Aires`) | 7 suites, 120 tests passing contra MariaDB real `13.0.2-MariaDB` (`127.0.0.1:3307`); sin SQLite ni base en memoria |
| `backend: npm run lint` | exit 0, sin hallazgos |
| `backend: npm run build` | exit 0 |

Estado CLI inicial: `{"total":19,"complete":14,"remaining":5}`; rama `change/c-06-appointment-lifecycle-history`, HEAD `7b510b2`. No existían tests que cubrieran el placeholder de `features/appointments/lifecycle/index.tsx`, así que el safety net verde no contradice el RED deliberado del batch.

### Strict TDD por tarea

| Tarea | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| 5.1 | `./time` inexistente; después `./errors` inexistente; después `./api` inexistente | 1 test por módulo, passing | 2 tests de formato local (incluido el UTC `2027-03-11T02:30Z` → `23:30`), 4 tests de mapeo neutral (9 códigos, sin datos personales, fallback), 6 tests de cliente (3 PATCH + 2 GET y ningún endpoint de disponibilidad) | Tipado del test con `ApiClientError['details']`; 6 tests volvieron a pasar |
| 5.2 | `Failed to resolve import "./lifecycle.css?raw"` y placeholder de la página | 14 tests passing tras crear `lifecycle.css` y reemplazar `index.tsx` | 21 tests passing: 3 de `StatusActions`, 2 de `HistoryTimeline`, 2 de `CancelModal`, 3 de `RescheduleModal`, 3 de página y 2 de estilos, más 6 de core. Los fallos intermedios dirigieron tres correcciones: fecha larga duplicada (nuevo `formatLocalShortDate`, con su propio RED/GREEN y dos casos), `aria-label` en cada `listitem` y lectura del CSS desde disco porque `?raw` llega vacío en Vitest | Se eliminó la referencia a una clase `adm-` desde `lifecycle.css` (`> button` en su lugar) y se mantuvo el prefijo `lc-`; 21 tests en verde tras el cambio |
| 5.3 | No aplica: es verificación; la única corrección fue un error de tipado en un spec propio de `history/**` detectado por `tsc -b` | El spec corregido pasa sus 6 tests y `tsc -b` deja de reportar errores en paths de C-06 | La suite completa de backend vuelve a 400 tests y frontend a 112 | Sin cambios adicionales |

Cada avance se ejecutó con `npx vitest run ...` y ningún GREEN se declaró sin un RED observado. No se agregaron aserciones triviales: los tests cubren matriz de estados, motivos 1–500, excepción confirmada, conflicto neutral, orden del historial, carga/reintento, foco tras mutación y contrato de estilos.

### Verificación posterior al batch

| Comando | Resultado |
|---|---|
| `frontend: npx tsc -b --pretty false` | exit 0 |
| `frontend: npm test` | 17 archivos, **112 tests passing** (91 baseline + 21 nuevos) |
| `frontend: npm run lint` | exit 0, sin advertencias |
| `frontend: npm run build` | exit 0; salida generada solo en `dist/` (artefacto no versionado) |
| `backend: npm test -- --runInBand` | 36 suites, **400 tests passing**, incluido `src/shared/database/architecture-boundaries.spec.ts` |
| `backend: npm run test:integration` (`TZ=America/Argentina/Buenos_Aires`) | 7 suites, **120 tests passing**; versión informada por la propia suite: `13.0.2-MariaDB`; sin credenciales en la salida |
| `backend: npm run lint` | exit 0, sin hallazgos |
| `backend: npm run build` | exit 0 (`nest build`) |
| `backend: npx tsc -b --pretty false` | exit 1 **únicamente** por la deuda preexistente de cuatro archivos ajenos: `src/health/health.service.spec.ts` (2), `src/modules/availability/availability.integration-spec.ts`, `src/modules/availability/testing/api-harness.support-spec.ts` (opción `timezone` del tipado de TypeORM) y `src/shared/http/request-id.middleware.spec.ts`. Ningún error en `lifecycle/**` ni `history/**`. |
| Búsqueda de `any` en `frontend/src/features/appointments/lifecycle/**` y `backend/src/modules/appointments/{lifecycle,history}/**` | sin coincidencias |
| `root: node scripts/change-scope/check.mjs --branch change/c-06-appointment-lifecycle-history --base main` | Scope check passed |
| `root: npx openspec instructions apply --change c-06-appointment-lifecycle-history --json` | `{ total: 19, complete: 16, remaining: 3 }` antes de marcar 5.3; pendientes 6.1 y 6.2 |

Durante 5.3 se corrigió un error de tipado en `backend/src/modules/appointments/history/get-appointment-history.service.spec.ts` (el doble `jest.fn` no declaraba los dos argumentos con los que se invoca `manager.find`); era un fallo del propio cambio detectado recién al ejecutar `tsc -b`, no deuda ajena. No se modificaron los cuatro archivos de deuda externa.

### Verificación visual

- No se usó Playwright ni se automatizó captura alguna. La política `system-only` no abre compuerta de mockups por change.
- La revisión visual manual corresponde a la tarea **6.1** y queda pendiente: `/turnos/:appointmentId` en 390×844 y 1440×900, con detalle, reprogramación, excepción, cancelación, cambio de estado, historial, estados carga/vacío/error y `prefers-reduced-motion`. No se declara revisado ningún viewport sin abrirlo.
- En 5.2 solo se verificaron por tests el contrato del CSS (prefijo `lc-`, tokens de revisión 1, sin hex/rgba y movimiento dentro de `@media (prefers-reduced-motion: no-preference)`) y el foco del modal y del detalle.

## Registro de ejecución — Batch F (tarea 6.2)

- **Fecha:** 2026-11-24 (hora local `America/Argentina/Buenos_Aires`).
- **Rama / HEAD:** `change/c-06-appointment-lifecycle-history`, `7b510b2789f466c263b7e166cc9b72af9afcdabb`.
- **Estado CLI inicial:** `{"total":19,"complete":17,"remaining":2}` (pendientes 6.1 y 6.2).

### Comandos obligatorios (salida exacta)

| Comando | Salida | Exit |
|---|---|---|
| `npx openspec validate c-06-appointment-lifecycle-history --strict` | `Change 'c-06-appointment-lifecycle-history' is valid` | 0 |
| `node scripts/change-scope/check.mjs --branch change/c-06-appointment-lifecycle-history --base main` | `Scope check passed for change/c-06-appointment-lifecycle-history` | 0 |

Ninguno produjo violaciones, advertencias ni errores en stderr.

### Ubicación de artefactos de planificación

`npx openspec status --change c-06-appointment-lifecycle-history --json` reportó:

- `changeRoot`: `D:\Reina\desarrollo_software_3k9_Grupo_16\openspec\changes\c-06-appointment-lifecycle-history`.
- `artifactPaths.proposal.existingOutputPaths`: `...\c-06-appointment-lifecycle-history\proposal.md`.
- `artifactPaths.specs.existingOutputPaths`: `...\c-06-appointment-lifecycle-history\specs\appointment-history\spec.md` y `...\c-06-appointment-lifecycle-history\specs\appointment-lifecycle\spec.md`.
- `artifactPaths.design.existingOutputPaths`: `...\c-06-appointment-lifecycle-history\design.md`.
- `artifactPaths.tasks.existingOutputPaths`: `...\c-06-appointment-lifecycle-history\tasks.md`.
- `isPlanningComplete: true`; los cuatro artefactos (`proposal`, `specs`, `design`, `tasks`) en estado `done`.

`npx openspec instructions apply --change c-06-appointment-lifecycle-history --json` confirmó `contextFiles` con las mismas rutas, todas dentro del `changeDir`.

`git status --short --branch`: rama correcta; los artefactos de planificación y este `verification.md` aparecen únicamente bajo el directorio no versionado `?? openspec/changes/c-06-appointment-lifecycle-history/`. No hay artefactos de planificación de C-06 fuera de ese directorio. El resto de entradas son código de la implementación ya existente de C-06, anterior a esta tarea.

**Nota de invocación:** `npx openspec instructions apply --json` sin `--change` devolvió `change_error` (`Missing required option --change. Available changes:\n  c-06-appointment-lifecycle-history`, exit 1); se repitió con `--change c-06-appointment-lifecycle-history` y terminó exit 0. No afecta a los dos comandos obligatorios de la tarea.

### Estado y alcance de esta tarea

- Se marcó **solo 6.2** como `[x]` en `tasks.md`; el CLI pasó a `{"total":19,"complete":18,"remaining":1}`.
- **6.1 permanece `[ ]`**: la revisión visual manual (detalle, reprogramación, excepción, cancelación, cambio de estado, historial; 390×844 y 1440×900; foco, overflow, estados vacío/carga/error y `prefers-reduced-motion`) será ejecutada y confirmada por Milagros. No se realizó en este batch.
- No se usó Playwright; no se generaron mockups ni capturas; no se declaró ningún viewport como revisado.
- No se agregaron dependencias ni se modificó código. No hubo commit, push, PR, merge, `openspec sync` ni `archive`.

## Registro — Tarea 6.1 (revisión visual manual confirmada)

- **Fecha:** 2026-11-24 (hora local `America/Argentina/Buenos_Aires`).
- **Confirmación:** Milagros confirmó explícitamente la revisión visual manual de `/turnos/:appointmentId` con la respuesta literal «Revisada, sin diferencias», sobre la checklist presentada: detalle, reprogramación, excepción, cancelación, cambio de estado e historial, en los viewports **390×844** y **1440×900**, incluyendo foco, overflow, estados vacío/carga/error y `prefers-reduced-motion`.
- **Alcance de lo registrado:** se documenta la confirmación global de esa checklist. No se aportó un detalle pantalla por pantalla ni capturas; conforme a la regla dura 9 no se usó Playwright ni se generaron capturas automatizadas.
- **Resultado:** sin diferencias declaradas (blocker / major / minor: ninguna).
- Se marca **6.1** como `[x]` en `tasks.md`; el CLI pasa a `{"total":19,"complete":19,"remaining":0}`.
- Sin commit, push, PR, merge, `openspec sync` ni `archive`: Pablo integra y ejecuta sync/archive sobre `main` después del merge.

### Hallazgo de cierre: cambio local ajeno a C-06

- `git status --short --branch` mostró `M backend/src/main.ts` con la línea `process.loadEnvFile();`. El archivo **está fuera del ownership de C-06** y no fue creado por ningún batch del Apply.
- Milagros confirmó explícitamente que **es un cambio suyo**, agregado para poder arrancar el backend durante la revisión visual manual, y pidió **dejarlo**. Por lo tanto **no se revertió ni se modificó**.
- Este cambio **no forma parte del change C-06** y Pablo debe decidir su destino al integrar (posible deuda/shared distinta). No se amplió el scope ni se actualizó `design.md`.
- El guard `node scripts/change-scope/check.mjs --branch change/c-06-appointment-lifecycle-history --base main` pasó, pero compara contra HEAD: **no cubre cambios sin commitear en el working tree**. Riesgo documentado para C-08/integración: verificar `git status` además del guard automático.
