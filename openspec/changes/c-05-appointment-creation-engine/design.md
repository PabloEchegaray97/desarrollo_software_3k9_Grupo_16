# Design

## Context

Motivación en `proposal.md` y requisitos en `specs/appointment-booking` y `specs/appointment-booking-ui`. Estado de `main` (`6c68eae`) relevante para el diseño:

- **C-01:**
  - `TransactionBoundary` y `AGENDA_CONFIGURATION_LOCK` existen solo como **interfaces**, sin implementación.
  - El `ApiExceptionFilter` corregido publica `code` y `details` de dominio.
  - El runner de integración ejecuta un proceso Jest por suite.
- **C-02:** `PatientReferences.findById(id, manager?)` y `CatalogReferences.findProcedureById/findChairById(id, manager?)` devuelven `activo`, duración e intervalo (`null` = global).
- **C-03:**
  - `AVAILABILITY_EVALUATION_PORT.evaluar({ fecha, horaInicio, duracionMinutos, intervaloPosteriorMinutos })` devuelve uno de los estados `DISPONIBLE`, `FUERA_DE_DISPONIBILIDAD` (con `requiereOverrideManual: true`), `EXCEPCION_BLOQUEANTE` o `DATOS_INVALIDOS`.
  - Los instantes `inicioUtc`, `finAtencionUtc` y `finBloqueoUtc` vienen en todos los estados salvo `DATOS_INVALIDOS`.
  - La fila única `configuracion_agenda` (id `CONFIGURACION_UNICA_ID`) se inserta en la migración C03 y contiene `intervalo_global_minutos`.
- **C-04:** `SessionGuard` como `APP_GUARD` protege toda ruta no marcada `@Public()`. Las pruebas obtienen la cookie con `authenticatedCookie(dataSource)`.
- **Frontend:** `/turnos/nuevo` ya está ruteado a `AppointmentCreationPage`, con un placeholder de C-01.

Restricciones que condicionan el diseño:
- el ownership de C-05;
- TypeScript estricto sin `any`;
- MariaDB real;
- instantes UTC con zona IANA;
- datos ficticios;
- sin Playwright;
- sin dependencias nuevas;
- `architecture-boundaries.spec.ts` rechaza `class Turno`, `solapamiento` y `overlap` en todo `src`.

## Goals / Non-Goals

**Goals:**

- Garantizar la ausencia de conflictos entre turnos bloqueantes bajo concurrencia real de MariaDB.
- Separar una política temporal pura, testeable sin base de datos, del caso de uso transaccional.
- Dejar en `appointments/core` un núcleo reutilizable por C-06 (reprogramación, cambios de estado e historial) y C-07 (consultas de agenda).

**Non-Goals:**

- Endpoints de consulta, edición o listado de turnos; la respuesta 201 es la única lectura de C-05.
- Serializar las ediciones de disponibilidad de C-03 con las altas de turnos (ver Riesgos).
- Reservas recurrentes, listas de espera o múltiples odontólogos.

## Decisions

### 1. Modelo y migración `C05`

Migración `2026112600000-C05-CreateAppointments.ts`, posterior a C04 (`2026112504000`), con `down` que elimina ambas tablas.

**`appointments`**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `CHAR(36)` | UUID generado en el servicio |
| `patient_id`, `procedure_id`, `chair_id` | `CHAR(36)` | FK a `patients`, `procedures`, `chairs` con `ON DELETE RESTRICT` (C-02 no borra físicamente) |
| `starts_at`, `care_ends_at`, `block_ends_at` | `DATETIME(6)` | instantes UTC |
| `duration_minutes` | `SMALLINT` | `CHECK 1..240` |
| `post_interval_minutes` | `SMALLINT` | `CHECK 0..30` |
| `status` | `VARCHAR(16)` | `CHECK IN (...)` de los cinco estados |
| `outside_availability` | `BOOLEAN` | |
| `exception_reason` | `VARCHAR(500) NULL` | `CHECK`: obligatorio si `outside_availability` |
| `cancellation_reason` | `VARCHAR(500) NULL` | definido por la KB, lo escribe C-06 |
| `created_at`, `updated_at` | `DATETIME(6)` | `updated_at` con `ON UPDATE CURRENT_TIMESTAMP(6)`, como en C-02 |

Restricciones adicionales:
- `CHECK (starts_at < care_ends_at AND care_ends_at <= block_ends_at)`.
- Índice `(status, starts_at, block_ends_at)` para la consulta de conflictos.
- Índices `(chair_id, starts_at)` y `(patient_id, starts_at)`, pensados para C-07.

**`appointment_events`**

| Columna | Tipo |
|---|---|
| `id` | `CHAR(36)` |
| `appointment_id` | FK `RESTRICT` |
| `type` | `CHECK IN ('CREADO','REPROGRAMADO','CANCELADO','CAMBIO_ESTADO','EXCEPCION')` |
| `occurred_at` | `DATETIME(6)` |
| `previous_status`, `new_status` | nullable |
| `previous_starts_at`, `new_starts_at` | nullable |
| `previous_chair_id`, `new_chair_id` | nullable |
| `reason` | `VARCHAR(500) NULL` |

Índice `(appointment_id, occurred_at)`.

El modelo de eventos sigue completo la KB (`EventoTurno`) para que C-06 no necesite alterar la tabla. Las entidades se llaman `AppointmentEntity` y `AppointmentEventEntity`, en inglés como en C-02, y el código habla de "conflicto". Así se respeta el guard de arquitectura de C-01 sin editarlo.

**Alternativas:** el tipo nativo `ENUM` de MariaDB obliga a alterar la tabla para agregar valores; `VARCHAR` + `CHECK` admite cambios por migración aditiva. Persistir solo `inicio` y derivar los fines haría la consulta de conflictos no indexable; los fines se guardan porque la KB los define como derivados persistidos y la política los calcula en un solo lugar.

### 2. Política temporal pura (`core/domain/appointment-policy.ts`)

Funciones sin I/O ni reloj:

- `resolveEffectiveTimes({ overrideDuration, overrideInterval, procedureDuration, procedureInterval, globalInterval })` devuelve `{ durationMinutes, postIntervalMinutes }` con la precedencia de RN-PR-05/06.
- `blockedPeriod(startsAt, effective)` devuelve `{ startsAt, careEndsAt, blockEndsAt }` como `Date`.
- `periodsConflict(a, b) = a.startsAt < b.blockEndsAt && b.startsAt < a.blockEndsAt`, sobre el intervalo semiabierto.
- `classifyConflicts(candidate, chairId, existing[])` devuelve `{ scope: 'SILLON' | 'ODONTOLOGO', conflicts } | null` y filtra por `BLOCKING_STATUSES`.

`BLOCKING_STATUSES = ['PROGRAMADO','CONFIRMADO','ATENDIDO','AUSENTE']` se exporta para C-06 y C-07.

**Alcance del conflicto:** con un único odontólogo, todo conflicto de sillón también es conflicto del odontólogo (RN-TU-04 ⊂ RN-TU-03). Por eso se usa un único código, `APPOINTMENT_CONFLICT`, con `alcance: "SILLON"` si algún turno en conflicto usa el mismo sillón, y `"ODONTOLOGO"` si solo hay conflictos en otros sillones. Es más preciso para la UI que dos códigos que se pisan.

Los instantes UTC de la solicitud los provee `evaluar()` de C-03, que ya resuelve la zona IANA. Con eso C-05 no duplica la conversión. La política recalcula `careEndsAt` y `blockEndsAt` desde `inicioUtc` y los minutos efectivos, y una prueba unitaria compara el resultado con los instantes de C-03.

### 3. Caso de uso transaccional (`creation/create-appointment.service.ts`)

Orden dentro de una sola transacción:

1. La validación de forma con DTO (`class-validator`) ocurre antes de abrir la transacción.
2. `boundary.run(async (tx) => { … })`:
   1. `tx.acquireLock('AGENDA_CONFIGURATION')`: `SELECT … FROM configuracion_agenda WHERE id = :id FOR UPDATE`. Devuelve el `intervalo_global_minutos` leído bajo el lock.
   2. Referencias vía `PatientReferences` y `CatalogReferences` con `tx.manager`. Una referencia ausente o inactiva produce `APPOINTMENT_REFERENCE_INVALID` (422), con `campo` y `motivo`.
   3. Tiempos efectivos con la política.
   4. `evaluar()` de C-03 con la duración y el intervalo efectivos. `DATOS_INVALIDOS` produce `APPOINTMENT_INVALID_TIME` (400).
   5. Inicio contra el reloj: si `inicioUtc < clock.now()`, `APPOINTMENT_IN_PAST` (422).
   6. Conflictos: `SELECT` de turnos bloqueantes con `starts_at < :blockEndsAt AND block_ends_at > :startsAt` usando `tx.manager`. Si hay alguno, `APPOINTMENT_CONFLICT` (409).
   7. Disponibilidad:
      - `EXCEPCION_BLOQUEANTE` → `APPOINTMENT_BLOCKED_BY_EXCEPTION` (409), sin override posible;
      - `FUERA_DE_DISPONIBILIDAD` sin `fueraDisponibilidad: true` → `APPOINTMENT_OUTSIDE_AVAILABILITY` (409, `requiereOverrideManual: true`);
      - `DISPONIBLE` con override → se guarda como ordinario.
   8. Inserta el turno, el evento `CREADO` y, si corresponde, `EXCEPCION`, con `occurred_at = clock.now()`.
3. Commit; la respuesta 201 se arma con lo insertado.

Los conflictos se evalúan **antes** que la disponibilidad: si hay conflicto, ofrecer un override sería inútil, porque el override no lo exceptúa (RN-DI-06). Así el usuario no escribe un motivo para después recibir un rechazo.

**Alternativa:** validar fuera de la transacción y luego insertar tiene condición de carrera (ver decisión 4).

### 4. Concurrencia: lock de la fila de configuración

Es la estrategia de C-01 §5. Toda alta toma `pessimistic_write` sobre la fila única antes de leer conflictos, así las escrituras que compiten por la agenda se serializan en MariaDB (InnoDB, `REPEATABLE READ`). Como la fila siempre existe, porque C-03 la inserta en su migración, el lock nunca queda vacío. La lectura de conflictos ocurre después de obtener el lock, por lo que ve todo turno confirmado por la transacción anterior. Esto evita filas fantasma sin depender de un índice de rangos que MariaDB no tiene.

El mismo lock serializa también los futuros cambios de C-06 (reprogramar), que lo reutilizarán desde `core`.

**Alternativas descartadas:**
- **`SERIALIZABLE`:** convierte todo en locks compartidos y genera deadlocks y reintentos.
- **Lock por sillón:** no cubre el conflicto entre sillones del odontólogo.
- **`GET_LOCK()` de MariaDB:** queda fuera de la transacción y depende de la conexión.

### 5. `TransactionBoundary` implementada en `core`

`core/database/typeorm-transaction-boundary.ts` implementa la interfaz compartida de C-01 sin modificarla:
- `run(work)` usa `dataSource.transaction()`.
- `acquireLock('AGENDA_CONFIGURATION')` ejecuta el `SELECT … FOR UPDATE` sobre `configuracion_agenda` con la constante `CONFIGURACION_UNICA_ID` de C-03. La tabla y su fila son el recurso de lock acordado en C-01 §5.

Se registra como provider de `AppointmentCoreModule` y se exporta, junto con el token `APPOINTMENT_TRANSACTION_BOUNDARY`, para C-06.

### 6. Reloj inyectable

El token `APPOINTMENT_CLOCK` expone `{ now(): Date }`, con `SystemClock` por defecto. Las pruebas unitarias e integradas lo reemplazan por un reloj fijo, así nada depende de "ahora" (estrategia de pruebas de la KB).

### 7. Contrato HTTP

`POST /api/turnos`, protegido por el `SessionGuard` global:

```json
{
  "pacienteId": "uuid", "prestacionId": "uuid", "sillonId": "uuid",
  "fecha": "2027-03-10", "horaInicio": "10:00",
  "duracionMinutos": 45, "intervaloPosteriorMinutos": 5,
  "fueraDisponibilidad": true, "motivoExcepcion": "Urgencia ficticia"
}
```

Las sobrescrituras, `fueraDisponibilidad` y `motivoExcepcion` son opcionales. El motivo es obligatorio, de 1 a 500 caracteres recortados, solo si `fueraDisponibilidad` es `true`.

Respuesta 201: `{ id, pacienteId, prestacionId, sillonId, estado, inicio, finAtencion, finBloqueo, duracionMinutos, intervaloPosteriorMinutos, fueraDisponibilidad, motivoExcepcion, createdAt }`, con instantes ISO UTC.

| Código | HTTP | `details` |
|---|---|---|
| `VALIDATION_ERROR` | 400 | mensajes de campo (filtro existente) |
| `APPOINTMENT_INVALID_TIME` | 400 | — |
| `APPOINTMENT_REFERENCE_INVALID` | 422 | `{ campo, motivo: 'INEXISTENTE' \| 'INACTIVO' }` |
| `APPOINTMENT_IN_PAST` | 422 | — |
| `APPOINTMENT_CONFLICT` | 409 | `{ alcance, conflictos: [{ turnoId, sillonId, inicio, finBloqueo }] }`, sin datos del paciente |
| `APPOINTMENT_BLOCKED_BY_EXCEPTION` | 409 | `{ tipoExcepcion, motivoExcepcion }` |
| `APPOINTMENT_OUTSIDE_AVAILABILITY` | 409 | `{ requiereOverrideManual: true, inicio, finAtencion }` |

Los nombres JSON van en español, como en C-02 y C-03. Los errores son `HttpException` con `{ code, message, details }`, que el filtro corregido de C-01 publica.

### 8. Instantes UTC y CR-05-01

Las entidades usan `Date` en columnas `DATETIME(6)`. Correcto en UTC depende de que la conexión mysql2 use `timezone: 'Z'`, y hoy `data-source.ts` no lo fija (C-01). Se pide a Pablo como **CR-05-01**: una línea en `applicationDataSourceOptions` y `testDataSourceOptions`, más su prueba.

Hasta que esté integrado, las suites corren en el contenedor con `TZ=UTC` y son correctas. La prueba de la spec "Proceso en otra zona horaria" ejecuta la suite con `TZ=America/Argentina/Buenos_Aires` y verifica el valor literal con `DATE_FORMAT`; queda bloqueada sin CR-05-01, igual que CR-01 en C-02.

**Alternativa descartada:** un transformer propio en las entidades de C-05 escondería el problema para los demás changes y agregaría conversión manual de fechas.

### 9. Módulos backend

```text
backend/src/modules/appointments/core/
  appointment-core.module.ts        importa DatabaseModule; exporta boundary, clock, repositorio de conflictos
  entities/appointment.entity.ts, entities/appointment-event.entity.ts
  domain/appointment-status.ts      estados, BLOCKING_STATUSES, tipos de evento
  domain/appointment-policy.ts      política pura (decisión 2)
  database/typeorm-transaction-boundary.ts
  database/appointment-conflicts.ts findBlockingConflicts(manager, period, excludeId?)
  clock.ts
  *.spec.ts
backend/src/modules/appointments/creation/
  appointment-creation.module.ts    importa Core, PatientsModule, CatalogsModule, AvailabilityModule
  appointments.controller.ts        POST /turnos
  create-appointment.service.ts
  dto/create-appointment.dto.ts
  appointment-errors.ts
  *.spec.ts, appointments.integration-spec.ts
  testing/*.support-spec.ts
```

`AppointmentsModule` ya importa `AppointmentCreationModule`, así que no se toca `app.module.ts`. La composición con C-02, C-03 y C-04 ocurre dentro de `appointment-creation.module.ts`.

### 10. Frontend (`features/appointments/create/`)

- `index.tsx` (`AppointmentCreationPage`), `api.ts`, `types.ts`, `AppointmentForm.tsx`, `PatientPicker.tsx`, `ExceptionModal.tsx`, `AppointmentSummary.tsx`, `errors.ts`, `time.ts` y `*.test.tsx`.
- **Opciones:**
  - prestaciones y sillones activos vía `proceduresApi` y `chairsApi`;
  - pacientes por búsqueda con `patientsApi.list({ q })`;
  - intervalo global vía `GET /api/disponibilidad/configuracion`.

  Todo se consume por import de solo lectura desde `features/catalog`, `features/patients` y `apiRequest`; esas carpetas no se modifican.
- **UI reutilizada:** `AdminModal`, `Button`, `TextField` y los estilos `adm-` de `features/catalog/ui` (C-02), también por import. Los campos `select`, `textarea`, `date` y `time` que faltan se crean localmente en `create/`.
- **Flujo:**
  - `APPOINTMENT_OUTSIDE_AVAILABILITY` abre `ExceptionModal`, con motivo obligatorio, y reenvía con override;
  - `APPOINTMENT_CONFLICT` y `APPOINTMENT_BLOCKED_BY_EXCEPTION` se explican en un aviso sobre el formulario, con la hora local del conflicto;
  - `APPOINTMENT_REFERENCE_INVALID` marca el campo indicado.
- **Formato de horas:** con `Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })`. El cliente solo presenta instantes; no calcula disponibilidad ni conflictos (regla dura 3).

### 11. Estrategia de pruebas

- **Unitarias backend:**
  - política: precedencias, límites, contigüidad exacta, inicio dentro del intervalo posterior, estados bloqueantes vs `CANCELADO`, alcance `SILLON`/`ODONTOLOGO`, y coherencia con los instantes de C-03;
  - DTO: motivo condicional;
  - servicio con dobles: orden de errores, override innecesario, referencias, pasado con reloj fijo y eventos;
  - controlador sin base.
- **Integración MariaDB** (runner de C-01, sesión con `authenticatedCookie`, disponibilidad cargada por la API de C-03):
  - alta feliz con tiempos efectivos y evento `CREADO`;
  - contigüidad y conflictos entre sillones y en el mismo sillón;
  - `CANCELADO`, `ATENDIDO` y `AUSENTE` insertados por SQL de prueba;
  - override con motivo (eventos `CREADO` + `EXCEPCION`), override que no salva un conflicto y día bloqueado;
  - referencias inactivas e inicio pasado;
  - **dos y cinco altas concurrentes incompatibles**, en el mismo sillón y en sillones distintos → exactamente una 201;
  - rollback cuando falla el evento, reemplazando el escritor de eventos por uno que lanza;
  - UTC con `TZ=America/Argentina/Buenos_Aires`, que depende de CR-05-01.
- **Frontend (Vitest + RTL):** valores de referencia, obligatorios, override con motivo, cancelar el modal, explicación de conflicto y de día bloqueado, resumen con horas locales y estado de error de carga.
- **Visual manual:** `/turnos/nuevo` con formulario, modal de excepción, aviso de conflicto y resumen, en 390×844 y 1440×900, sin Playwright. Se registra en `verification.md`.
- **Fixtures:** "Paciente Ficticio N", prestaciones y sillones genéricos, motivos "… ficticio/a" y fechas fijas en 2027.

## Planned File Surface

Puede reducirse durante el Apply; ampliarla requiere aprobación de Pablo.

```text
backend/src/database/migrations/2026112600000-C05-CreateAppointments.ts
backend/src/modules/appointments/core/**
backend/src/modules/appointments/creation/**
frontend/src/features/appointments/create/**
openspec/changes/c-05-appointment-creation-engine/**
```

Fuera de la superficie (pedido a Pablo): `backend/src/database/data-source.ts` (CR-05-01) y, opcionalmente, acotar `backend/src/shared/database/architecture-boundaries.spec.ts`.

## UI Mockups

- **Design system revision:** 1
- **Decision:** no (project policy `system-only`)
- **Preview:** manual
- **Visual verify:** pendiente; se registrará en `verification.md` con las pantallas y viewports revisados

## Risks / Trade-offs

- **[El lock global serializa todas las altas]** → un odontólogo y bajo volumen; el lock dura solo la transacción de validación y escritura.
- **[`evaluar()` de C-03 lee fuera de la transacción]** → una edición concurrente de la disponibilidad podría evaluarse con la versión anterior. El invariante crítico, la ausencia de conflictos, sí está protegido por el lock. Serializar también la disponibilidad requiere que C-03 tome el mismo lock o acepte un `EntityManager`; se documenta para C-08.
- **[CR-05-01 no se integra]** → en el contenedor (`TZ=UTC`) todo es correcto. En una PC con zona Argentina, los instantes se guardarían en hora local, aunque se leerían de forma consistente. La prueba con `TZ` lo detecta y queda bloqueada en lugar de ocultarse.
- **[El núcleo en `core` se vuelve contrato de C-06/C-07]** → interfaz mínima (entidades, estados, política, conflictos, boundary, reloj), documentada y con pruebas.
- **[Import de UI de C-02 desde otra feature]** → solo lectura; si C-08 la promueve a `shared`, cambia el import y no el comportamiento.
- **[Reloj del servidor desfasado]** → afecta solo la regla de inicio no pasado; se usa el reloj del backend, nunca el del navegador.

## Migration Plan

1. Migración C05 con `up` y `down`, probada en MariaDB de pruebas.
2. Núcleo `core` (política, entidades, boundary, conflictos, reloj) con pruebas unitarias.
3. Caso de uso y controlador de `creation` con pruebas unitarias, de integración y de concurrencia.
4. Frontend de alta con pruebas de componentes.
5. Con CR-05-01 en `main`, actualizar la rama y ejecutar la prueba de UTC con `TZ` local.
6. Verificación visual manual y registro.

Rollback: revertir la rama antes de integrar. Después de integrar, el `down` de C05 elimina las tablas de turnos y eventos (solo datos ficticios).
