# Design

## Context

Motivación en `proposal.md`; comportamiento observable en `specs/appointment-lifecycle` y `specs/appointment-history`. Estado verificado en la rama `change/c-06-appointment-lifecycle-history` (HEAD `7b510b2`, C-05 archivado):

- **C-01/C-05 en `main`:**
  - `AppointmentCoreModule` exporta `APPOINTMENT_TRANSACTION_BOUNDARY`, `APPOINTMENT_CLOCK` y `AppointmentWriter`. La frontera toma `SELECT … FOR UPDATE` sobre la fila única de `configuracion_agenda` (`AGENDA_CONFIGURATION_LOCK`).
  - `AppointmentEntity` ya tiene `cancellation_reason`, y `AppointmentEventEntity` ya cubre `REPROGRAMADO`, `CANCELADO`, `CAMBIO_ESTADO`, `motivo`, estados anterior/nuevo, inicios anterior/nuevo y sillones anterior/nuevo. No hace falta alterar tablas.
  - `core/domain/appointment-status.ts` exporta los cinco estados, `BLOCKING_STATUSES` y los cinco tipos de evento.
  - `core/domain/appointment-policy.ts` exporta `blockedPeriod`, `periodsConflict` y `classifyConflicts` (esta última con `excludeId`).
  - `core/database/appointment-conflicts.ts` expone `findBlockingConflicts(manager, period, excludeId?)`.
  - El reloj inyectable `APPOINTMENT_CLOCK` permite fijar `now()` en pruebas.
  - `timezone: 'Z'` ya está en `backend/src/database/data-source.ts`: CR-05-01 cerrado.
  - `SessionGuard` global protege `/api/turnos/**` sin necesidad de anotaciones públicas.
- **Placeholders de C-01:** `backend/src/modules/appointments/lifecycle/appointment-lifecycle.module.ts`, `backend/src/modules/appointments/history/appointment-history.module.ts` y `frontend/src/features/appointments/lifecycle/index.tsx` existen vacíos; `appointments.module.ts` ya los importa y `routes.tsx` ya mapea `/turnos/:appointmentId` al placeholder de lifecycle. No se editan esos archivos de composición.
- **Restricciones:** ownership de C-06; TypeScript estricto sin `any`; MariaDB real en integración; `America/Argentina/Buenos_Aires` para interpretar y UTC para persistir; datos ficticios; sin Playwright; sin dependencias nuevas; design system revisión 1 en modo `system-only`.
- **Guard de arquitectura vigente:** `backend/src/shared/database/architecture-boundaries.spec.ts` rechaza `class Turno`, `solapamiento` y `overlap` en `src`. Se usan nombres en inglés y el vocabulario "conflicto".

## Goals / Non-Goals

**Goals:**

- Cubrir todas las aristas permitidas por la matriz de RN-TU-13/14 con una política pura y reutilizable.
- Garantizar que reprogramar, cancelar y cambiar estado sean transaccionales y serializados con el lock de agenda de C-05.
- Producir un historial cronológico, inmutable y con registro mínimo, sin exponer datos de pacientes.
- Dejar componentes de lifecycle aislados para que C-07 los consuma sin editarlos y C-08 los ensamble.

**Non-Goals:**

- Corregir estados terminales (RN-TU-19) ni crear operaciones administrativas.
- Modificar `core/`, `creation/`, `create/`, agenda, `app.module.ts`, `routes.tsx`, shared, specs principales ni el design system.
- Agregar migraciones (no son necesarias) ni nuevas dependencias.
- Calcular disponibilidad o conflictos en React.

## Decisions

### 1. Sin migración: reutilizar el esquema de C-05

La migración `2026112600000-C05-CreateAppointments.ts` ya crea `appointments.cancellation_reason` y `appointment_events` con todos los campos de `EventoTurno` (design de C-05, decisión 1). La reprogramación usa `appointment_events.reason` para su motivo; la cancelación escribe el motivo tanto en el evento como en `cancellation_reason`. Así se conserva la intuición de la KB sin alterar una migración integrada (regla dura: nunca modificar migraciones existentes).

**Alternativa descartada:** una columna `reschedule_reason` en `appointments`. Duplicaría información ya presente en el evento y exigiría una migración C06 sin beneficio consultable. Si Apply detectara una necesidad real, se agregaría un archivo **nuevo** `C06` y se pediría aprobación antes de incluirlo.

### 2. Política de transiciones pura en `lifecycle/domain`

`appointment-transitions.ts` contendrá, sin I/O ni reloj:

- `ALLOWED_TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>>` con la matriz exacta de `05_reglas_de_negocio.md` (PROGRAMADO → CONFIRMADO/ATENDIDO/AUSENTE/CANCELADO; CONFIRMADO → ATENDIDO/AUSENTE/CANCELADO; terminales → ninguno).
- `TERMINAL_STATUSES = ['ATENDIDO', 'AUSENTE', 'CANCELADO']` (RN-TU-15).
- `RESCHEDULABLE_STATUSES = ['PROGRAMADO', 'CONFIRMADO']` (RN-TU-17).
- `assertTransition(from, to)` y `assertReschedulable(from)` que devuelven un resultado discriminado o lanzan el error de dominio neutral.
- `isStatusObserved(now, startsAt) = now.getTime() >= startsAt.getTime()` (RN-TU-16), con `now` provisto por `APPOINTMENT_CLOCK`.

La tabla es la única autoridad de la matriz; el controlador no decide nada y el frontend solo deshabilita acciones en terminales para evitar solicitudes inútiles.

**Alternativa descartada:** una cadena `switch` dentro de cada servicio. Duplicaría la matriz en tres operaciones y facilitaría divergencias entre cancelar y cambiar estado.

### 3. Evento por operación

| Operación | Tipo de evento | `estadoAnterior` | `estadoNuevo` | Inicios | Sillones | `motivo` |
|---|---|---|---|---|---|---|
| Reprogramar `PROGRAMADO` | `REPROGRAMADO` | `PROGRAMADO` | `PROGRAMADO` | anterior/nuevo | anterior/nuevo | obligatorio |
| Reprogramar `CONFIRMADO` | `REPROGRAMADO` | `CONFIRMADO` | `PROGRAMADO` (RN-TU-18) | anterior/nuevo | anterior/nuevo | obligatorio |
| Reprogramar con excepción | `REPROGRAMADO` + `EXCEPCION` | según caso | según caso | anterior/nuevo en `REPROGRAMADO` | anterior/nuevo en `REPROGRAMADO` | de reprogramación y de excepción |
| Cancelar | `CANCELADO` | `PROGRAMADO`/`CONFIRMADO` | `CANCELADO` | `null` | `null` | obligatorio |
| Confirmar | `CAMBIO_ESTADO` | `PROGRAMADO` | `CONFIRMADO` | `null` | `null` | `null` |
| Atender | `CAMBIO_ESTADO` | `PROGRAMADO`/`CONFIRMADO` | `ATENDIDO` | `null` | `null` | `null` |
| Ausencia | `CAMBIO_ESTADO` | `PROGRAMADO`/`CONFIRMADO` | `AUSENTE` | `null` | `null` | `null` |

No se duplican `finAtencion` ni `finBloqueo` anteriores: se derivan del `inicioAnterior` más la duración y el intervalo efectivos, que no cambian (RN-AU-03, minimización).

### 4. Algoritmo de reprogramación

1. Validar DTO (UUIDs, `YYYY-MM-DD`, `HH:mm`, motivo, opcionales de excepción) antes de abrir la transacción.
2. `boundary.run(async (tx) => …)`; primero `tx.acquireLock(AGENDA_CONFIGURATION)` (`FOR UPDATE`).
3. Cargar el turno con `AppointmentWriter.findAppointment(tx.manager, id)` **después** del lock; 404 si no existe.
4. `assertReschedulable(turno.status)`; si es terminal, `APPOINTMENT_INVALID_TRANSITION` (409).
5. Convertir fecha/hora local a instantes con `AVAILABILITY_EVALUATION_PORT.evaluar(...)` de C-03, usando la duración y el intervalo **ya persistidos** en el turno; hora inexistente → `APPOINTMENT_INVALID_TIME` (400).
6. `blockedPeriod(inicio, { durationMinutes, postIntervalMinutes })` para recalcular fines.
7. `findBlockingConflicts(tx.manager, periodo, excludeId = id)` → `classifyConflicts(...)`; conflicto → `APPOINTMENT_CONFLICT` (409) con el mismo `details` de C-05, sin datos de paciente.
8. Disponibilidad: `EXCEPCION_BLOQUEANTE` → rechazo sin override; `FUERA_DE_DISPONIBILIDAD` sin confirmación → rechazo con `requiereOverrideManual`; con confirmación y motivo → excepción; `DISPONIBLE` con override → se guarda como ordinario (`fueraDisponibilidad: false`, `exceptionReason: null`). El evento `EXCEPCION` histórico nunca se borra.
9. Sillón nuevo: validar existencia/actividad con `CatalogReferences.findChairById(id, tx.manager)` (solo lectura).
10. Actualizar `startsAt`, `careEndsAt`, `blockEndsAt`, `chairId`, `status` (CONFIRMADO → PROGRAMADO), bandera y motivo de excepción; insertar evento(s) con `occurred_at = clock.now()` en la **misma** transacción.
11. Commit y respuesta con turno + historial.

**Alternativa descartada:** reutilizar ciegamente `CreateAppointmentService` con una sobrescritura. Su DTO exige paciente y prestación y no acepta `excludeId`, además de recalcular minutos efectivos desde la prestación actual, lo que reescribiría el valor histórico del turno (RN-PR-07).

### 5. Cancelación y cambios de estado

Mismo esqueleto transaccional: lock → cargar turno → validar arista → validar ventana temporal si corresponde → actualizar → insertar evento → commit. `CANCELADO` se atiende solo por `PATCH /cancelar`, que exige motivo; `PATCH /estado` admite exclusivamente `CONFIRMADO`, `ATENDIDO` y `AUSENTE`. Así no existe una ruta que permita cancelar sin motivo.

### 6. Atomicidad, rollback y concurrencia

Se reutiliza `APPOINTMENT_TRANSACTION_BOUNDARY` y su lock global de agenda (C-05 decisión 4). Cada operación serializa con las altas de C-05 y con las demás reprogramaciones: la lectura de conflictos ocurre después del lock, por lo que ve todo commit anterior. Cualquier excepción de dominio o de escritura provoca rollback de TypeORM: ni el turno queda modificado sin evento, ni el evento queda huérfano. El evento se inserta con FK `RESTRICT` al turno, lo que refuerza la invariante.

**Alternativa descartada:** `SERIALIZABLE` (deadlocks y reintentos) y locks por sillón (no cubren conflictos entre sillones del único odontólogo).

### 7. Contratos HTTP

Prefijo global `/api` y `SessionGuard` de C-04. Todas las mutaciones responden 200 con `{ turno, historial }`; instantes ISO 8601 UTC.

| Método y path | Cuerpo | Éxito |
|---|---|---|
| `PATCH /api/turnos/:id/reprogramar` | `{ fecha, horaInicio, sillonId?, motivo, fueraDisponibilidad?, motivoExcepcion? }` | 200 `{ turno, historial }` |
| `PATCH /api/turnos/:id/cancelar` | `{ motivo }` | 200 `{ turno, historial }` |
| `PATCH /api/turnos/:id/estado` | `{ estado: "CONFIRMADO" \| "ATENDIDO" \| "AUSENTE" }` | 200 `{ turno, historial }` |
| `GET /api/turnos/:id/historial` | — | 200 `{ turnoId, eventos: [...] }` |

`turno` reutiliza la forma de `AppointmentResponse` de C-05 y agrega `motivoCancelacion: string | null` y `updatedAt: string`. No se edita el DTO de C-05: se declara una respuesta nueva en `lifecycle`; es contrato nuevo para C-07/C-08 y cualquier cambio posterior necesita coordinación (regla dura 7).

| Código | HTTP | `details` |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `{ campo }` cuando aplica |
| `APPOINTMENT_INVALID_TIME` | 400 | — |
| `APPOINTMENT_NOT_FOUND` | 404 | — |
| `APPOINTMENT_INVALID_TRANSITION` | 409 | `{ estadoActual, operacion }` |
| `APPOINTMENT_CONFLICT` | 409 | `{ alcance, conflictos: [{ turnoId, sillonId, inicio, finBloqueo }] }` |
| `APPOINTMENT_OUTSIDE_AVAILABILITY` | 409 | `{ requiereOverrideManual: true, inicio, finAtencion }` |
| `APPOINTMENT_BLOCKED_BY_EXCEPTION` | 409 | `{ tipoExcepcion, motivoExcepcion }` |
| `APPOINTMENT_REFERENCE_INVALID` | 422 | `{ campo, motivo: 'INEXISTENTE' \| 'INACTIVO' }` |
| `APPOINTMENT_TOO_EARLY` | 422 | `{ inicio, ahora }` en UTC |

Los errores son `HttpException` con `{ code, message, details }`, que el filtro de C-01 publica. `401` lo emite el guard global. Ningún `details` incluye identidad de paciente, datos clínicos ni secretos; los logs se limitan a código, `turnoId` y momento.

### 8. Historial y campos visibles

`history/get-appointment-history.service.ts` proyecta `AppointmentEventEntity` al DTO de la decisión 7: `id`, `tipo`, `ocurridoEn`, `estadoAnterior`, `estadoNuevo`, `inicioAnterior`, `inicioNuevo`, `sillonAnteriorId`, `sillonNuevoId`, `motivo`. Orden `occurred_at ASC, id ASC`. Sin paginación: el número de eventos por turno está acotado por las operaciones admitidas y una paginación improvisada añadiría estado sin beneficio (P2-02 trata del rango de agenda, no del historial). El frontend convierte los IDs de sillón a etiqueta legible mediante import de solo lectura al catálogo, con fallback al ID corto si el sillón ya no se resuelve; el backend no incluye nombres ni datos de paciente.

### 9. Módulos backend

- `lifecycle/`: controlador, DTOs, política pura, errores, tres servicios (reprogramar, cancelar, cambiar estado), factory de eventos y módulo completado. Importa `AppointmentCoreModule` y `AvailabilityModule` y `CatalogsModule` por sus puertos de solo lectura; no modifica `appointments.module.ts`.
- `history/`: controlador, servicio de consulta, DTO de proyección, errores y módulo completado. Importa `AppointmentCoreModule`.
- Los tests de integración comparten un harness de API en `lifecycle/testing/`, con reloj fijo y limpieza de turnos/eventos en `afterAll` por la FK `RESTRICT` (misma precaución de C-05).

### 10. Frontend (`features/appointments/lifecycle/`)

Se reemplaza el placeholder de `/turnos/:appointmentId` por `AppointmentDetail`, que presenta estado, horarios locales, sillón, motivo de cancelación, acciones y `HistoryTimeline`. `StatusActions` deshabilita las opciones inválidas según la matriz (presentación, no autoridad), `RescheduleModal` exige motivo normalizado y confirma excepciones, `CancelModal` exige motivo, y `HistoryTimeline` muestra tipo + texto + forma para cada evento con horas en `America/Argentina/Buenos_Aires` mediante `Intl.DateTimeFormat`. Se reutilizan `AdminModal`, `Button` y estilos `adm-` de C-02 por import de solo lectura, y se agregan estilos locales con prefijo `lc-` usando únicamente tokens de `design-system/tokens.css` revisión 1. Sin Playwright: revisión manual en 390×844 y 1440×900, con foco visible, estados vacío/carga/error y `prefers-reduced-motion`.

### 11. Pruebas

- **Unitarias backend:** una prueba por arista permitida y por arista rechazada, terminalidad, `RESCHEDULABLE_STATUSES`, reloj fijo antes/en el inicio, normalización de motivos, DTOs, factory de eventos y controladores sin base.
- **Integración con MariaDB real** (runner de C-01, nunca SQLite ni memoria): alta → reprogramación → cancelación → consulta con orden verificado; cada arista; excepción en reprogramación; sillón inactivo; conflicto con y sin cambio de sillón; rollback con escritor de eventos que falla; dos reprogramaciones concurrentes incompatibles; horario liberado tras cancelar; API devuelta con `TZ=America/Argentina/Buenos_Aires` y valores UTC literales. Fixtures ficticios.
- **Frontend (Vitest + RTL):** modales con motivo vacío/largo, acciones deshabilitadas en terminales, timeline por tipo de evento, formato local y mapeo de errores sin datos personales.
- **Visual manual:** sin Playwright; registros en `verification.md` con pantallas, viewports y resultado.

## Aprobación requerida antes de Apply

Governance **CRÍTICO** (CHANGES.md, C-06). Las once decisiones siguientes son propuestas concretas; P1-02 y P1-04 no están resueltas en la KB y se marcan **Propuesta a confirmar**. Pablo/Milagros deben aprobarlas o corregirlas antes de iniciar Apply.

1. **P1-02 — Campos visibles en cada evento del historial (Propuesta a confirmar).** Por evento: `id`, `tipo`, `ocurridoEn`, `estadoAnterior`, `estadoNuevo`, `inicioAnterior`, `inicioNuevo`, `sillonAnteriorId`, `sillonNuevoId` y `motivo` solo en `CANCELADO`, `REPROGRAMADO` y `EXCEPCION`; los demás campos en `null`. Criterio: son exactamente los campos de `EventoTurno` (KB 04) necesarios para US-043 y RN-AU-03, y permiten reconstruir cada operación sin exponer identidad de paciente, datos clínicos ni otros turnos. El motivo se acota a 1–500 caracteres normalizados y nunca se registran payloads personales en logs (RN-AU-04, regla dura 5). Fuente: `knowledge-base/04_modelo_de_datos.md` §EventoTurno, `knowledge-base/05_reglas_de_negocio.md` §RN-AU, `knowledge-base/06_funcionalidades.md` §US-043, `knowledge-base/10_preguntas_abiertas.md` §P1-02.

2. **P1-04 — Motivo obligatorio al reprogramar (Propuesta a confirmar).** Sí, obligatorio en **toda** reprogramación, no solo en cancelación o excepción. Normalización: recorte de extremos y colapso de secuencias de espacios, tabulaciones y saltos en un único espacio. Longitud 1–500 caracteres tras normalizar. Error `VALIDATION_ERROR`, HTTP 400, `details.campo: "motivo"`, mensaje "El motivo de la reprogramación es obligatorio (1–500 caracteres)." Se guarda en `appointment_events.reason`. Criterio: RN-TU-10 exige conservar "el motivo cuando corresponda" y la KB no lo restringe a cancelación; alinear el rango con `motivoExcepcion` de C-05 evita una nueva regla de longitud. Fuente: KB 05 §RN-TU-10, KB 04 §EventoTurno, KB 10 §P1-04, spec `appointment-booking` §Override.

3. **Transiciones permitidas (KB 05 §Matriz de transiciones, RN-TU-13/14/17; KB 07 §Flujo 7).**

| Origen → destino | Regla |
|---|---|
| `PROGRAMADO` → `CONFIRMADO` | Permitida; evento `CAMBIO_ESTADO`; sin motivo |
| `PROGRAMADO` → `ATENDIDO` | Permitida solo si `now >= inicio`; `CAMBIO_ESTADO` |
| `PROGRAMADO` → `AUSENTE` | Permitida solo si `now >= inicio`; `CAMBIO_ESTADO` |
| `PROGRAMADO` → `CANCELADO` | Permitida solo por `/cancelar` con motivo; libera horario |
| `PROGRAMADO` → `PROGRAMADO` (reprogramar) | Permitida; evento `REPROGRAMADO`; motivo obligatorio |
| `CONFIRMADO` → `ATENDIDO` | Permitida solo si `now >= inicio`; `CAMBIO_ESTADO` |
| `CONFIRMADO` → `AUSENTE` | Permitida solo si `now >= inicio`; `CAMBIO_ESTADO` |
| `CONFIRMADO` → `CANCELADO` | Permitida por `/cancelar` con motivo |
| `CONFIRMADO` → `PROGRAMADO` (reprogramar) | Permitida; evento `REPROGRAMADO`, no `CAMBIO_ESTADO` |
| `ATENDIDO` / `AUSENTE` / `CANCELADO` → cualquier destino | Rechazada: `APPOINTMENT_INVALID_TRANSITION` (409) |
| `CONFIRMADO` → `CONFIRMADO` | Rechazada: `APPOINTMENT_INVALID_TRANSITION` (409) |
| Cualquier estado → `CANCELADO` por `/estado` | Rechazada: se usa `/cancelar` (motivo obligatorio) |

4. **Estados terminales (RN-TU-15/19; KB 07 §Flujo 7).** `ATENDIDO`, `AUSENTE` y `CANCELADO`. Ninguno admite nueva transición ni reprogramación; se responde 409 `APPOINTMENT_INVALID_TRANSITION`. Corregir un estado terminal queda para una operación administrativa futura y auditada, fuera del MVP. `CANCELADO` además deja de bloquear el intervalo (RN-TU-07).

5. **Restricción temporal para `ATENDIDO`/`AUSENTE` (RN-TU-16, RN-TI-01/02).** Ventana propuesta: `[inicio, sin cota superior en el MVP)`; se acepta cuando `clock.now() >= inicio`. La fecha local se interpreta con zona IANA `America/Argentina/Buenos_Aires` y el instante se compara y persiste en UTC; nunca se guarda `-03:00` como zona. La valida exclusivamente NestJS con `APPOINTMENT_CLOCK`; React solo deshabilita acciones y muestra resultados. Fuera de ventana: 422 `APPOINTMENT_TOO_EARLY` con `details` `{ inicio, ahora }` en UTC. **Propuesta a confirmar:** no fijar cota superior porque la KB no define una; si se prefiere un límite (p. ej., mismo día local), debe decidirse antes de Apply y cambiará el spec.

6. **Reprogramar un `CONFIRMADO` (RN-TU-18; KB 07 §Flujo 7).** Vuelve explícitamente a `PROGRAMADO`. Se emite **un único** evento `REPROGRAMADO` con `estadoAnterior: "CONFIRMADO"` y `estadoNuevo: "PROGRAMADO"`, más inicios y sillones anterior/nuevo y motivo. No se agrega un `CAMBIO_ESTADO`, para que el historial no duplique una sola acción del usuario.

7. **Preservación del horario y del estado anterior (RN-TU-10/11/12; KB 04 §Turno).** Se conservan `pacienteId`, `prestacionId`, `duracionMinutos` e `intervaloPosteriorMinutos` efectivos; se recalculan `finAtencion` y `finBloqueo` desde el nuevo `inicio`. El evento registra `estadoAnterior`/`estadoNuevo`, `inicioAnterior`/`inicioNuevo`, `sillonAnteriorId`/`sillonNuevoId` y `motivo`. No se duplican fines derivados ni se guardan nombres de sillón en la base. Si el nuevo horario está disponible, se reinician `fueraDisponibilidad` y `motivoExcepcion`; el evento `EXCEPCION` histórico permanece. La cancelación escribe el motivo en el evento y en `cancellation_reason` (columna ya creada por C-05).

8. **Operación atómica y rollback ante conflicto (RN-TU-05; C-05 decisión 4; RN-TU-11).** Una sola transacción con `acquireLock(AGENDA_CONFIGURATION)` (`FOR UPDATE` sobre `configuracion_agenda`) antes de leer el turno y los conflictos; `findBlockingConflicts(..., excludeId = id)`; actualización del turno e inserción del/los evento(s) en el mismo commit. Ante validación fallida, conflicto o error de escritura se lanza la excepción de dominio y TypeORM revierte **todo**: no se persiste un turno modificado sin evento ni un evento huérfano. Se reutiliza la frontera y el escritor de C-05; no se implementa una segunda estrategia de lock.

9. **Contratos HTTP y estructura cronológica del historial.** Los cuatro endpoints y la tabla de códigos de la decisión 7. Historial: `{ turnoId, eventos: [{ id, tipo, ocurridoEn, estadoAnterior, estadoNuevo, inicioAnterior, inicioNuevo, sillonAnteriorId, sillonNuevoId, motivo }] }`, ordenado por `ocurridoEn ASC, id ASC`, sin paginación en el MVP, incluido también en las respuestas de mutación. Errores `code`/`details` neutrales; sin nombres, documentos, correos, teléfonos ni datos clínicos.

10. **Archivos exactos que se crearán o modificarán (uno por uno; superficie detallada abajo).**Backend: 19 archivos en `lifecycle/` y 6 en `history/`; frontend: 14 archivos en `lifecycle/`; OpenSpec: los 4 artefactos de planificación y `verification.md`. **Migraciones: ninguna.** Todo está dentro del ownership de C-06; no se tocan `core/`, `creation/`, `create/`, agenda, `app.module.ts`, `routes.tsx`, shared, KB ni design system.

11. **Plan de pruebas.** Unitarias para cada arista y el reloj fijo; integración con **MariaDB real** (nunca SQLite ni base en memoria) cubriendo rollback, concurrencia, UTC con `TZ=America/Argentina/Buenos_Aires` y liberación del horario; frontend con Vitest/RTL; revisión visual manual sin Playwright en 390×844 y 1440×900 con datos ficticios, registrada en `verification.md`. Si alguna prueba queda bloqueada por una dependencia externa, se reporta como bloqueada, no se omite ni se debilita (regla dura de calidad).

## UI Mockups

- **Design system revision:** 1
- **Decision:** no (project policy)
- **Approval:** no aplica; `system-only` no abre compuerta por change
- **Preview:** manual
- **Visual verify:** pendiente; se registrará en `verification.md` con las pantallas y viewports revisados

## Risks / Trade-offs

- **[El lock global serializa altas y cambios de estado]** → un solo odontólogo y baja concurrencia; el lock se mantiene solo durante la transacción. Es la estrategia ya aprobada en C-01/C-05.
- **[Reutilizar `evaluar()` de C-03 fuera de la transacción]** → C-05 documenta que la disponibilidad se lee fuera del lock; el invariante crítico (ausencia de conflictos) sí está protegido. Se documenta para C-08 igual que en C-05.
- **[La respuesta de ciclo de vida agrega campos a la forma de C-05]** → contrato nuevo para C-07/C-08; se anuncia en la proposal y no se edita el DTO ajeno. Cualquier ajuste requiere coordinación (regla dura 7).
- **[Sin cota superior para ATENDIDO/AUSENTE]** → una atención podría registrarse días después; decisión P1 explícita pendiente de confirmación, no un descuido.
- **[Motivo obligatorio al reprogramar]** → puede resultar frictivo para cambios menores; es la propuesta para P1-04 y necesita visto bueno del Product Owner.
- **[Nombres de sillón resueltos en frontend]** → si un sillón se desactiva, se muestra el ID corto como fallback; no se modifica el catálogo de C-02.
- **[Guard de arquitectura]** → se evitan `class Turno`, `solapamiento` y `overlap` en todo `src`; se usa vocabulario "conflicto" y nombres en inglés.
- **[Fixtures y limpieza]** → la FK `RESTRICT` de eventos obliga a borrar turnos/eventos antes que pacientes/catálogos en `afterAll`; mismo patrón de C-05.

## Migration Plan

1. Sin migración de esquema: verificar que el `down` de C-05 sigue siendo suficiente.
2. Política pura y DTOs con pruebas unitarias.
3. Servicios transaccionales y controladores con pruebas unitarias y de integración MariaDB.
4. Módulos `lifecycle`/`history` completados sin editar `appointments.module.ts`.
5. Frontend aislado y revisión visual manual.
6. Verificación integral y `verification.md`.

 Rollback: revertir la rama antes de integrar. No hay datos de producción: solo fixtures ficticios.

## Planned File Surface

Puede reducirse durante Apply; ampliarla requiere aprobación de Pablo (regla dura 6 y CHANGES.md).

```text
openspec/changes/c-06-appointment-lifecycle-history/.openspec.yaml   (creado por la CLI)
openspec/changes/c-06-appointment-lifecycle-history/proposal.md
openspec/changes/c-06-appointment-lifecycle-history/design.md
openspec/changes/c-06-appointment-lifecycle-history/tasks.md
openspec/changes/c-06-appointment-lifecycle-history/verification.md
openspec/changes/c-06-appointment-lifecycle-history/specs/appointment-lifecycle/spec.md
openspec/changes/c-06-appointment-lifecycle-history/specs/appointment-history/spec.md

backend/src/modules/appointments/lifecycle/appointment-lifecycle.module.ts            (modificar placeholder)
backend/src/modules/appointments/lifecycle/appointments-lifecycle.controller.ts
backend/src/modules/appointments/lifecycle/lifecycle-errors.ts
backend/src/modules/appointments/lifecycle/domain/appointment-transitions.ts
backend/src/modules/appointments/lifecycle/dto/reschedule-appointment.dto.ts
backend/src/modules/appointments/lifecycle/dto/cancel-appointment.dto.ts
backend/src/modules/appointments/lifecycle/dto/change-appointment-status.dto.ts
backend/src/modules/appointments/lifecycle/dto/appointment-lifecycle-response.ts
backend/src/modules/appointments/lifecycle/lifecycle-event.factory.ts
backend/src/modules/appointments/lifecycle/reschedule-appointment.service.ts
backend/src/modules/appointments/lifecycle/cancel-appointment.service.ts
backend/src/modules/appointments/lifecycle/change-appointment-status.service.ts
backend/src/modules/appointments/lifecycle/testing/appointment-lifecycle-api.support-spec.ts
backend/src/modules/appointments/lifecycle/*.spec.ts
backend/src/modules/appointments/history/appointment-history.module.ts                (modificar placeholder)
backend/src/modules/appointments/history/appointments-history.controller.ts
backend/src/modules/appointments/history/history-errors.ts
backend/src/modules/appointments/history/get-appointment-history.service.ts
backend/src/modules/appointments/history/dto/appointment-history-response.ts
backend/src/modules/appointments/history/*.spec.ts

frontend/src/features/appointments/lifecycle/index.tsx                               (reemplazar placeholder)
frontend/src/features/appointments/lifecycle/api.ts
frontend/src/features/appointments/lifecycle/types.ts
frontend/src/features/appointments/lifecycle/errors.ts
frontend/src/features/appointments/lifecycle/time.ts
frontend/src/features/appointments/lifecycle/AppointmentDetail.tsx
frontend/src/features/appointments/lifecycle/StatusActions.tsx
frontend/src/features/appointments/lifecycle/RescheduleModal.tsx
frontend/src/features/appointments/lifecycle/CancelModal.tsx
frontend/src/features/appointments/lifecycle/HistoryTimeline.tsx
frontend/src/features/appointments/lifecycle/fields.tsx
frontend/src/features/appointments/lifecycle/lifecycle.css
frontend/src/features/appointments/lifecycle/*.test.ts
frontend/src/features/appointments/lifecycle/*.test.tsx
```

Fuera de la superficie: ningún archivo. No se prevé ninguna migración `C06`; si Apply la requiriera, sería un archivo nuevo sujeto a aprobación.

## Open Questions

- C-08 decidirá si promueve los componentes administrativos de modales a `frontend/src/shared/**`; no afecta estos specs ni esta división de tareas.
