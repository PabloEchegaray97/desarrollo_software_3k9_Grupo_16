# Tasks

## 0. Compuerta de governance (ANTES de Apply)

- [x] 0.1 Obtener aprobación explícita de Pablo/Milagros de las once decisiones de `design.md` § Aprobación requerida antes de Apply, en particular P1-02, P1-04, la ventana temporal y el contrato HTTP; verificar que la respuesta quede registrada en `verification.md` y NO iniciar las tareas 1–6 sin ese visto bueno (governance CRÍTICO de C-06).

## 1. Política pura y DTOs (`appointments/lifecycle`)

- [x] 1.1 Implementar `domain/appointment-transitions.ts` con la matriz exacta de RN-TU-13/14/17, `TERMINAL_STATUSES`, `RESCHEDULABLE_STATUSES` y la regla `now >= inicio`; verificar con tests unitarios una prueba por arista permitida, por arista rechazada y por estado terminal, sin I/O ni reloj directo.
- [x] 1.2 Implementar `dto/reschedule-appointment.dto.ts`, `dto/cancel-appointment.dto.ts` y `dto/change-appointment-status.dto.ts` con `class-validator`, incluyendo motivo normalizado de 1–500 caracteres, coordenadas locales `YYYY-MM-DD`/`HH:mm` y estados restringidos; verificar con tests unitarios de límites, motivo vacío y estado no reconocido, sin `any`.
- [x] 1.3 Implementar `lifecycle-errors.ts` con los códigos neutrales de `design.md` § Contratos HTTP y `dto/appointment-lifecycle-response.ts`; verificar con tests unitarios que `details` de conflicto y transición inválida no contienen datos de paciente.
- [x] 1.4 Implementar `lifecycle-event.factory.ts` que construya los eventos de la tabla de `design.md` § Evento por operación; verificar con tests unitarios que reprogramar un `CONFIRMADO` genera un solo `REPROGRAMADO` con `estadoNuevo: PROGRAMADO` y que `CAMBIO_ESTADO` deja `motivo: null`.

## 2. Operaciones atómicas (`appointments/lifecycle`)

- [x] 2.1 Implementar `reschedule-appointment.service.ts` siguiendo los once pasos de `design.md` § Algoritmo de reprogramación (lock → cargar turno → transición → evaluación C-03 → tiempos → conflictos con `excludeId` → disponibilidad → sillón → actualizar + eventos → commit); verificar con tests unitarios con dobles el orden de errores, el override innecesario y la conservación de minutos efectivos.
- [x] 2.2 Implementar `cancel-appointment.service.ts` y `change-appointment-status.service.ts` con el mismo esqueleto transaccional, motivo obligatorio solo en cancelación y reloj inyectable para `ATENDIDO`/`AUSENTE`; verificar con tests unitarios del motivo ausente, `APPOINTMENT_TOO_EARLY` antes del inicio y aceptación exactamente en el inicio.
- [x] 2.3 Implementar `appointments-lifecycle.controller.ts` con `PATCH /turnos/:id/reprogramar`, `PATCH /turnos/:id/cancelar` y `PATCH /turnos/:id/estado`, respondiendo 200 con `{ turno, historial }`; verificar con tests de controlador sin base los códigos 200, 400, 404 y 409, y completar `appointment-lifecycle.module.ts` importando los módulos de core, disponibilidad y catálogos sin tocar `appointments.module.ts`.

## 3. Historial (`appointments/history`)

- [x] 3.1 Implementar `dto/appointment-history-response.ts` y `get-appointment-history.service.ts` con la proyección exacta de P1-02 y orden `ocurridoEn ASC, id ASC`, sin paginación; verificar con tests unitarios que los campos no aplicables son `null`, que no aparecen datos de paciente y que el orden es determinista ante igualdad de instantes.
- [x] 3.2 Implementar `appointments-history.controller.ts` con `GET /turnos/:id/historial`, `history-errors.ts` y completar `appointment-history.module.ts`; verificar con tests de controlador sin base los códigos 200, 401 y 404, y con `npm run build` que `AppModule` arranca sin editar archivos de composición.

## 4. Verificación backend con MariaDB real

- [x] 4.1 Crear `testing/appointment-lifecycle-api.support-spec.ts` con Migrations, sesión `authenticatedCookie`, reloj fijo y fixtures ficticios, limpiando turnos/eventos en `afterAll` antes que pacientes/catálogos por la FK `RESTRICT`; verificar que no hay datos reales por revisión y que la suite de API arranca contra MariaDB real, sin SQLite ni base en memoria.
- [x] 4.2 Probar integración de cada arista permitida y rechazada, reprogramación con y sin cambio de sillón, `CONFIRMADO` → `PROGRAMADO`, excepción en la nueva ubicación, sillón inactivo, día bloqueado y horario liberado tras cancelar; verificar estados, eventos y `cancellation_reason` en MariaDB.
- [x] 4.3 Probar atomicidad y concurrencia: escritor de eventos que falla sin dejar turno modificado ni evento huérfano, y dos reprogramaciones incompatibles simultáneas con exactamente una 200 y otra 409 `APPOINTMENT_CONFLICT`; verificar con `npm run test:integration` y consultas SQL directas.
- [x] 4.4 Probar los instantes y el historial: orden cronológico idéntico entre la respuesta de mutación y el `GET`, UTC literal en columnas `DATETIME(6)` y ejecución con `TZ=America/Argentina/Buenos_Aires`; verificar registrando comando, versión de MariaDB y resultado en `verification.md`.

## 5. Frontend (`features/appointments/lifecycle`)

- [x] 5.1 Implementar `types.ts`, `api.ts`, `errors.ts` y `time.ts` con formato local `Intl` y mapeo neutral de códigos; verificar con tests unitarios de formato, zona `America/Argentina/Buenos_Aires` y mensajes sin datos personales.
- [x] 5.2 Implementar `AppointmentDetail.tsx`, `StatusActions.tsx`, `RescheduleModal.tsx`, `CancelModal.tsx`, `fields.tsx`, `HistoryTimeline.tsx` y `lifecycle.css` (prefijo `lc-`, solo tokens de revisión 1), reemplazando el placeholder en `index.tsx` sin editar rutas ni shared; verificar con tests de componentes el motivo vacío/largo, acciones deshabilitadas en terminales, timeline por tipo de evento y foco visible.
- [x] 5.3 Ejecutar `npx tsc -b`, `npm test`, `npm run lint` y `npm run build` en `frontend/` y los equivalentes en `backend/`; verificar que no hay errores ni `any` y que el guard `architecture-boundaries.spec.ts` sigue pasando.

## 6. Verificación integral

- [x] 6.1 Recorrer manualmente detalle, reprogramación, excepción, cancelación, cambio de estado e historial con datos ficticios en 390×844 y 1440×900, sin Playwright; verificar foco, overflow, estados vacío/carga/error y `prefers-reduced-motion`, registrando pantallas y viewports revisados en `verification.md`.
- [x] 6.2 Ejecutar `openspec validate c-06-appointment-lifecycle-history --strict` y el guard de scope `node scripts/change-scope/check.mjs --branch change/c-06-appointment-lifecycle-history --base main` sin violaciones; verificar que los artefactos de planificación y `verification.md` quedan dentro del directorio del change.

## Workflow follow-up

- Commit, push y PR `[C-06] appointment-lifecycle-history` solo por pedido explícito de Milagros; sin coautoría de agentes (regla dura 10).
- Pablo revisa, integra en `main` y ejecuta `openspec-sync-specs` y `openspec-archive-change`; no se ejecutan desde esta rama.
- Marcar C-06 en `CHANGES.md` corresponde a la integración, no a esta rama.
