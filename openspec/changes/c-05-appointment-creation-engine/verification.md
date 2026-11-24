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
| CR-05-01 — `timezone: 'Z'` en `data-source.ts` | Pendiente de envío a Pablo. |
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

## Pendiente

- Grupos 0, 2, 3, 4 y 5 (`tasks.md`).
