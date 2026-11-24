# Verification — C-05 appointment-creation-engine

Evidencia por grupo de tareas. Datos usados: exclusivamente ficticios.

## Entorno

- Fecha: 2026-11-24. Rama `change/c-05-appointment-creation-engine` creada desde `main` `6c68eae` (C-02, C-03, C-04 integrados; correcciones post-integración de C-01 incluidas).
- Node 22.23.5; `npm ci` desde el lockfile de `main`, sin cambios en `package.json`.
- MariaDB **10.11.14** real; bases `turnos_odontologia` y `turnos_odontologia_test` (`utf8mb4_unicode_ci`). Proceso con `TZ=UTC`.
- Línea base de `main` antes de C-05: backend `npm test` **190/190**; `npm run test:integration` (runner de C-01) **71/71** — auth 12, availability 21, catalogs 18, patients 18, database 2.

## Coordinación (grupo 0)

| Pedido | Estado |
|---|---|
| CR-05-01 — `timezone: 'Z'` en `data-source.ts` | Pendiente de envío a Pablo. **Reproducido**: con `TZ=America/Argentina/Buenos_Aires` los instantes se guardan 3 h corridos (ver grupo 3). |
| Observación — `architecture-boundaries.spec.ts` prohíbe `class Turno`/`solapamiento`/`overlap` en todo `src` | Pendiente de envío. C-05 lo respeta (nombres en inglés, vocabulario "conflicto"); el test sigue pasando. |
| Observación nueva — deriva de entidades de C-03 | El schema builder de TypeORM detecta 4 diferencias **preexistentes** en entidades de C-03 frente a su migración: índices `UQ_configuracion_agenda_single` e `IDX_excepcion_disponibilidad_fecha_activo` no declarados, y `intervalo_global_minutos`/`zona_horaria` con definición distinta. No afecta a C-05; informar a Milagros/Pablo. |

## Grupo 1 — Persistencia y núcleo

- **1.1 Migración `2026112600000-C05-CreateAppointments.ts`** sobre la base de pruebas: `up` aplica C05; `down` deja 0 tablas de C-05; `up` de nuevo vuelve a C05 como última migración. Restricciones verificadas con SQL directo:
  - aceptado: turno válido y evento `CREADO`;
  - rechazado por `CHECK`: duración 241, intervalo 31, estado inexistente, `care_ends_at` anterior a `starts_at`, excepción sin motivo y tipo de evento inexistente;
  - rechazado por FK: paciente inexistente (`ER_NO_REFERENCED_ROW_2`) y borrado de un paciente con turno (`ER_ROW_IS_REFERENCED_2`, `RESTRICT`).
- **1.2 Entidades** `AppointmentEntity` y `AppointmentEventEntity`, con índices, `CHECK` y FKs declarados mediante `@ManyToOne` hacia las entidades de C-02 (solo lectura). `createSchemaBuilder().log()`: **0 diferencias para las tablas de C-05**; las 4 diferencias restantes son de C-03 (ver arriba).
- **1.3 Política pura** (`appointment-policy.spec.ts`, 24 casos): precedencia turno → prestación → global (incluido intervalo 0), límites 1/240 y 0/30, período bloqueado, coincidencia exacta con `finAtencionUtc` y `finBloqueoUtc` de `evaluarIntervalo` de C-03, conflicto semiabierto (8 bordes en ambos sentidos), estados bloqueantes frente a `CANCELADO`, alcance `SILLON`/`ODONTOLOGO`, orden de conflictos y `excludeId`.
- **1.4 Infraestructura** (`core-infrastructure.spec.ts`, 9 casos): `SELECT … FOR UPDATE` sobre la fila única con el intervalo global leído bajo lock, error explícito si falta la fila, transacción con el manager propio, snapshot del lock, propagación de errores para rollback, consulta de conflictos sin filtro de sillón y con `excludeId`, y relojes fijo y de sistema.
- **Lock contra MariaDB real** (script con las clases compiladas): T1 toma el lock a los 2 ms y lo retiene 700 ms; T2 lo pide a los 52 ms y **lo obtiene a los 704 ms**, al confirmar T1.
- **Conflictos contra MariaDB real** (`DATETIME(6)`): contiguo en `finBloqueo` → sin conflicto; inicio 1 ms antes de `finBloqueo` → conflicto; terminar justo en el inicio de otro → sin conflicto; sobre un turno `CANCELADO` → sin conflicto.
- Backend `npm run build` y `npm run lint` sin hallazgos; `npm test` **223/223** (33 nuevos), incluido `architecture-boundaries.spec.ts`.

## Grupo 2 — Alta de turnos

- **2.1** `create-appointment.dto.spec.ts`: obligatorios, UUID, formatos `YYYY-MM-DD` y `HH:mm` (rechaza `9:00`, `24:00`, `10:60`, `10:00:00`), duración 0/1/240/241/30,5/"30", intervalo -1/0/30/31/2,5, motivo obligatorio y recortado de 1–500 solo con `fueraDisponibilidad: true`, y campos no declarados (`estado`, `finBloqueo`).
- **2.2** `create-appointment.service.spec.ts` con dobles:
  - el lock se toma antes de leer referencias y conflictos, y las referencias se leen con el manager de la transacción (orden registrado `lock → patient(tx) → evaluate → conflicts → insert`);
  - el intervalo global se lee bajo lock y se aplica la precedencia turno → prestación → global;
  - un evento `CREADO` con el reloj del servidor;
  - seis casos de referencia inexistente o inactiva, hora inválida, pasado (con borde exacto aceptado), conflicto con `details` sin datos del paciente y `CANCELADO` no bloqueante;
  - fuera de horario sin y con motivo (`CREADO` + `EXCEPCION`), conflicto antes que disponibilidad, día bloqueado aun con override, override innecesario guardado como ordinario y propagación del fallo del historial.
- **2.3** `appointments.controller.spec.ts`: 201 con motivo recortado; cinco cuerpos inválidos → 400 `VALIDATION_ERROR`; código y `details` de dominio publicados por el filtro de C-01; sin `GET` ni `DELETE`. `AppointmentCreationModule` compone Core, Patients, Catalogs y Availability sin tocar `app.module.ts`.
- Backend `npm run build` y `npm run lint` sin hallazgos; `npm test` **282/282** (59 nuevos en el grupo 2).
- **Prueba de punta a punta** (`node dist/main.js`, base de desarrollo, cuenta ficticia aprovisionada con `provision:admin`, sesión por `POST /api/auth/login`):
  - sin sesión → 401;
  - 10:00 → 201 (`inicio` 13:00Z, `finBloqueo` 13:40Z, intervalo global 10); 10:40 contiguo en otro sillón → 201;
  - 10:15 en el sillón B → 409 `APPOINTMENT_CONFLICT` con alcance `SILLON` (choca con el turno de 10:40 de ese mismo sillón y con el de 10:00);
  - 18:00 sin override → 409 `APPOINTMENT_OUTSIDE_AVAILABILITY`; con motivo → 201 con eventos `CREADO` y `EXCEPCION`; 18:10 en otro sillón con override → 409 `APPOINTMENT_CONFLICT` con alcance `ODONTOLOGO`;
  - feriado con override → 409 `APPOINTMENT_BLOCKED_BY_EXCEPTION`; fecha 2025 → 422 `APPOINTMENT_IN_PAST`; 2027-02-30 → 400 `APPOINTMENT_INVALID_TIME`; override sin motivo → 400; sillón inactivo → 422 `APPOINTMENT_REFERENCE_INVALID`;
  - **5 altas simultáneas incompatibles → `201 409 409 409 409`**.
  - En la base quedan 4 turnos con su duración e intervalo efectivos, y solo el de excepción tiene `CREADO,EXCEPCION`. Los logs del servidor no tienen datos personales.
- Corrección durante la prueba: el mensaje de referencia inactiva decía "inactivo/a"; ahora usa el género de cada campo.
- **Regresión:** `npm run test:integration` con la migración C05 aplicada → **71/71** (sin cambios en otras suites).
- **Riesgo documentado** en el design: agotamiento del pool si hay más altas simultáneas que conexiones, porque `evaluar()` de C-03 usa una conexión aparte.

## Grupo 3 — Integración con MariaDB real

- **Harness** (`creation/testing/appointment-api.support-spec.ts`):
  - levanta `AppModule` con la conexión de producción, sin reemplazar el `DataSource`;
  - reemplaza solo el reloj (fijo en 2027-03-01T12:00Z) y el escritor de turnos (falla controlada del historial);
  - sesión ficticia con `authenticatedCookie` de C-04;
  - crea pacientes, prestaciones, sillones y la disponibilidad del miércoles 09:00–13:00 por las APIs de C-02 y C-03;
  - borra turnos y eventos antes y después de la suite. Los fixtures usan el prefijo "… ficticio/a C05".
- **Suite `appointments.integration-spec.ts`: 26/26**:
  - **Reglas:** sesión requerida; alta con tiempos efectivos y evento `CREADO` con el reloj del servidor; precedencia global (20) → prestación (5) → turno (0); cambios posteriores de la prestación y del global no reescriben el turno; contigüidad exacta en cualquier sillón; inicio dentro del intervalo posterior y bloqueo que alcanza al siguiente → 409; alcance `ODONTOLOGO`/`SILLON` con `details` sin datos del paciente; `ATENDIDO`, `AUSENTE` y `CONFIRMADO` bloquean; `CANCELADO` libera.
  - **Disponibilidad:** fuera de horario sin y con motivo (`CREADO` + `EXCEPCION`, motivo recortado); override sin motivo o vacío → 400; el override no exceptúa un conflicto; `FERIADO` rechazado aun con override; override innecesario → ordinario; referencia inexistente e inactiva con campo; inicio pasado con el reloj movido; fecha inexistente.
  - **Concurrencia:** dos altas en el mismo sillón, dos en sillones distintos, cinco en el mismo y cinco alternadas → **siempre exactamente una 201**, las demás 409 `APPOINTMENT_CONFLICT`, y 1 fila.
  - **Atomicidad:** con el escritor de eventos fallando después de insertar el turno → 500 `INTERNAL_ERROR`, 0 turnos y 0 eventos; la siguiente alta funciona.
  - **UTC:** con `TZ=UTC` el inicio se guarda como `2027-03-10 13:00:00` literal.
- **3.6 `npm run test:integration` (runner de C-01), todas las suites:** appointments 26, auth 12, availability 21, catalogs 18, patients 18, database 2 → **97/97**, código 0. La suite de C-05 corre primera y no deja turnos (0 remanentes).
- **3.6 con `TZ=America/Argentina/Buenos_Aires` — BLOQUEADA por CR-05-01:** fallan 2 de 26 por el mismo defecto: `starts_at` se guarda `10:00:00` en lugar de `13:00:00`, y `occurred_at` del evento `09:00` en lugar de `12:00`. Reproducción directa con mysql2: el mismo `Date` 13:00Z llega a MariaDB como `13:00:00` con `TZ=UTC` y como `10:00:00` con la zona de Argentina.
- **Hallazgos durante el grupo:**
  - el harness de C-03 reemplaza el `DataSource` de la app por uno con `timezone: 'Z'`, así que sus suites no ejercitan la configuración de producción y no detectan el defecto;
  - una primera versión de la prueba UTC cambiaba `process.env.TZ` dentro de Jest y daba un resultado falso; se reemplazó por la ejecución con `TZ` al arrancar.
- Backend `npm run lint` y `npm run build` sin hallazgos; `npm test` 282/282.

## Pendiente

- Tareas 0.1, 0.2, la parte TZ de 3.6, grupos 4 y 5.
