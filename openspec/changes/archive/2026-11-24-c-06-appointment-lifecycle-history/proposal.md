# Proposal

## Why

C-05 reserva turnos sin solapamientos y registra el evento inicial, pero el turno queda `PROGRAMADO` sin salida operativa: no se puede reprogramar, cancelar ni registrar confirmación, atención o ausencia, y no existe lectura del historial (US-040 a US-043; RN-TU-13 a RN-TU-19; RN-AU-01 a RN-AU-04). C-06 cierra el ciclo de vida que C-07 consumirá en agenda y C-08 integrará; su governance es **CRÍTICO** y requiere aprobación explícita antes de Apply (CHANGES.md, ficha C-06).

## What Changes

- Completar el uso de `EventoTurno` con `REPROGRAMADO`, `CANCELADO` y `CAMBIO_ESTADO`, además de los eventos `CREADO`/`EXCEPCION` que ya emite C-05. Los eventos son inmutables desde la interfaz ordinaria (RN-AU-01/02).
- Exponer operaciones sobre un turno existente, protegidas por sesión: reprogramar, cancelar con motivo, confirmar, atender y marcar ausencia, y consultar su historial cronológico (Flujos 4, 5 y 7).
- Aplicar la matriz de transiciones, la terminalidad de `ATENDIDO`/`AUSENTE`/`CANCELADO`, la ventana temporal para `ATENDIDO`/`AUSENTE` y el retorno a `PROGRAMADO` al reprogramar un `CONFIRMADO` (RN-TU-13 a RN-TU-19).
- Revalidar una reprogramación con las mismas reglas de creación de C-05 —disponibilidad, referencia de sillón y conflictos del odontólogo/sillón— excluyendo el propio turno de la búsqueda de conflictos (RN-TU-10 a RN-TU-12, Flujo 4).
- Ejecutar cada operación como una única transacción con el lock de agenda de C-01/C-05: ante cualquier fallo se revierte el cambio del turno **y** el evento, sin dejar eventos huérfanos (RN-TU-05, decisión 4 de C-05).
- Construir en `features/appointments/lifecycle/` el detalle del turno, modales de reprogramación/cancelación, acciones de estado y el timeline del historial. El frontend solo presenta decisiones de NestJS (regla dura 3).
- Resolver P1-02 y P1-04 con propuestas concretas sujetas a aprobación (sección al final y `design.md`).
- Fuera de alcance: corregir estados terminales (RN-TU-19), lectura de agenda por rango (C-07), mensajería, historia clínica, pagos y borrado o edición de eventos.

## Capabilities

### New Capabilities

- `appointment-lifecycle`: operaciones atómicas sobre un turno existente —reprogramación, cancelación y cambio de estado— con matriz de transiciones, terminalidad, restricción temporal, preservación de valores anteriores y contratos HTTP.
- `appointment-history`: consulta cronológica e inmutable del historial de un turno, con campos visibles y reglas de privacidad/	log minimizado.

### Modified Capabilities

Ninguna. `appointment-booking` y `appointment-booking-ui` se consumen sin modificar sus requisitos: C-05 ya creó `appointments`, `appointment_events`, `cancellation_reason`, la política de conflictos, el lock de agenda y el reloj inyectable.

## Impact

- **Código propio:** `backend/src/modules/appointments/lifecycle/**` y `backend/src/modules/appointments/history/**` (los módulos placeholder de C-01 se completan sin tocar `appointments.module.ts`), y `frontend/src/features/appointments/lifecycle/**` (reemplaza el placeholder de la ruta `/turnos/:appointmentId`).
- **Migración:** no se prevé ninguna. El modelo de eventos de C-05 ya contiene `REPROGRAMADO`, `CANCELADO`, `CAMBIO_ESTADO`, `motivo`, estados anterior/nuevo, inicio anterior/nuevo y sillón anterior/nuevo (design C-05, decisión 1). Si Apply detectara una necesidad imprevista, se agregaría **solo** un archivo nuevo `C06` en `backend/src/database/migrations/**`, previa aprobación.
- **Contratos consumidos sin editar:** `AppointmentCoreModule` (entidades, `findBlockingConflicts(manager, period, excludeId?)`, `APPOINTMENT_TRANSACTION_BOUNDARY`, `AppointmentWriter`, `APPOINTMENT_CLOCK`), `AVAILABILITY_EVALUATION_PORT` de C-03, `SessionGuard` de C-04 y lectura de catálogos de C-02.
- **Contratos nuevos para C-07/C-08:** respuestas de las operaciones y del historial. No se edita el DTO de C-05; se define una respuesta de ciclo de vida que reutiliza su forma y agrega `motivoCancelacion`. Cualquier cambio posterior requiere coordinación (regla dura 7).
- **Dependencias:** ninguna nueva (regla dura 8). CR-05-01 ya está integrado: `data-source.ts` fija `timezone: 'Z'`.
- **Governance:** CRÍTICO. Sin aprobación explícita de Pablo/Milagros de esta proposal, specs, design y tasks no se ejecuta Apply.

## Aprobación requerida antes de Apply

Cada punto incluye una propuesta concreta; el detalle y las alternativas están en `design.md`. La KB no resuelve P1-02 ni P1-04: ambas se marcan como **Propuesta a confirmar**.

1. **P1-02 — Campos visibles del historial (Propuesta a confirmar):** por evento, `id`, `tipo`, `ocurridoEn`, `estadoAnterior`, `estadoNuevo`, `inicioAnterior`, `inicioNuevo`, `sillonAnteriorId`, `sillonNuevoId` y `motivo` solo en `CANCELADO`, `REPROGRAMADO` y `EXCEPCION`. Nunca datos de paciente, clínicos ni de otros turnos (RN-AU-03/04).
2. **P1-04 — Motivo al reprogramar (Propuesta a confirmar):** obligatorio en toda reprogramación; normalizado con recorte y colapso de espacios; 1–500 caracteres; error `VALIDATION_ERROR` (400) con `details.campo: "motivo"`.
3. **Transiciones permitidas:** `PROGRAMADO` → `CONFIRMADO`/`ATENDIDO`/`AUSENTE`/`CANCELADO`; `CONFIRMADO` → `ATENDIDO`/`AUSENTE`/`CANCELADO`; reprogramación solo desde `PROGRAMADO` o `CONFIRMADO` (RN-TU-13/14/17). Toda otra arista se rechaza con `APPOINTMENT_INVALID_TRANSITION` (409).
4. **Estados terminales:** `ATENDIDO`, `AUSENTE` y `CANCELADO`; no admiten nueva transición ni reprogramación; corregirlos es una operación administrativa futura fuera del MVP (RN-TU-15/19).
5. **Restricción temporal:** `ATENDIDO`/`AUSENTE` solo si `clock.now() >= inicio` en UTC, con la fecha interpretada en `America/Argentina/Buenos_Aires`; la valida NestJS con el reloj inyectable, nunca React (RN-TU-16, RN-TI-01/02). Sin cota superior en el MVP (Propuesta a confirmar).
6. **Reprogramar un `CONFIRMADO`:** lo devuelve a `PROGRAMADO` con un único evento `REPROGRAMADO` (`estadoAnterior: CONFIRMADO`, `estadoNuevo: PROGRAMADO`); no se emite un `CAMBIO_ESTADO` adicional (RN-TU-18, Flujo 7).
7. **Preservación:** se conservan paciente, prestación, duración e intervalo efectivos; se registran estado, inicio y sillón anteriores y nuevos. No se duplican fines derivados. El motivo de cancelación se guarda también en `cancellation_reason` (columna de C-05).
8. **Atomicidad y rollback:** una transacción con `FOR UPDATE` sobre `configuracion_agenda`, lectura del turno bajo el lock, validación, actualización y evento(s) en el mismo commit; cualquier error revierte todo y no queda evento huérfano (C-05 decisión 4).
9. **Contratos HTTP y forma del historial:** `PATCH /api/turnos/:id/reprogramar`, `PATCH /api/turnos/:id/cancelar`, `PATCH /api/turnos/:id/estado` y `GET /api/turnos/:id/historial`; errores neutrales con `code`/`details`; historial `{ turnoId, eventos: [...] }` ordenado por `ocurridoEn ASC, id ASC`, sin paginación en el MVP.
10. **Archivos previstos:** lista exacta en `design.md` § Planned File Surface; todo dentro del ownership de C-06. Ningún archivo de `core/`, `creation/`, `create/`, agenda, `app.module.ts`, shared, KB ni design system.
11. **Pruebas:** unitarias de cada arista y del reloj fijo; integración con **MariaDB real** (nunca SQLite ni memoria) incluyendo rollback, concurrencia y UTC con `TZ=America/Argentina/Buenos_Aires`; frontend con Vitest/RTL; revisión visual manual sin Playwright en 390×844 y 1440×900.
