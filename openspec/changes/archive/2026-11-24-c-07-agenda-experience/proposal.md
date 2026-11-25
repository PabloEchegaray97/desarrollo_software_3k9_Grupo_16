# Proposal

## Why

C-05 permite crear turnos, pero el odontólogo todavía no puede **ver** su jornada: no existe lectura de agenda ni pantalla en `/agenda` (hoy es un placeholder). C-07 entrega la consulta por fecha o rango, sillón y estado, y una vista diaria responsive que presenta lo que decide el backend, sin calcular disponibilidad ni conflictos en el navegador (US-032, Flujo 6).

## What Changes

- **P2-02 (decisión a aprobar):** una consulta puede abarcar como máximo **31 días calendario inclusive**. Un rango mayor se rechaza con un código estable; no se introduce paginación temporal. Ver `design.md` § Decisión 1.
- Nuevo `GET /api/agenda` (requiere sesión) con `desde`, `hasta` opcional, `sillonId` opcional y `estado` opcional (lista). Responde turnos **ordenados de forma estable por inicio** y, por cada día del rango, los tramos de atención y los bloqueos de disponibilidad que informa C-03.
- Cada turno distingue **atención** (`inicio`–`finAtencion`), **intervalo posterior** (`finAtencion`–`finBloqueo`) y **excepción** (atendido fuera de disponibilidad, con su motivo). Los **bloqueos** de disponibilidad (feriado, vacaciones, bloqueo) viajan por día, separados de los turnos.
- Agenda vacía responde 200 con `turnos: []` y los días del rango. Rango inválido o excesivo y filtros mal formados se rechazan con 400/422 y códigos estables.
- Vista diaria en `/agenda`: navegación de fecha, filtros de sillón y estado que se consultan al backend, detalle del turno, **refresco explícito** y estados de carga, vacío, error y refresco fallido.
- Los estados del turno se representan siempre con **texto + color + forma**. No se expone ningún dato clínico ni de contacto del paciente: solo su nombre.
- Punto de integración para C-06 dentro de `features/agenda`: la página acepta un `renderActions` y enlaza a `/turnos/:id`. C-07 no edita nada de lifecycle ni de history; C-08 hace el ensamble.
- Fuera de alcance: paginación temporal, edición o cambio de estado de turnos (C-06), historial (C-06), vistas semanal/mensual en la interfaz, mensajería, calcular disponibilidad o conflictos en React, migraciones, dependencias nuevas.

## Capabilities

### New Capabilities

- `appointment-agenda`: Consulta de agenda por fecha o rango, sillón y estado con rango máximo, orden estable por inicio, diferenciación de atención, intervalo, bloqueo y excepción, respuesta para agenda vacía, rechazo de rangos y filtros inválidos, y exclusión de datos clínicos y de contacto.
- `appointment-agenda-ui`: Vista diaria responsive de la agenda con filtros, detalle del turno, refresco explícito, estados con texto, color y forma, y puntos de integración para las acciones de C-06.

### Modified Capabilities

Ninguna. C-07 consume sin modificar `appointment-booking`, `schedule-availability`, `session-access` y `app-shell`.

## Impact

- **Código propio (previsto):** `backend/src/modules/appointments/agenda/**`, `frontend/src/features/agenda/**` y `openspec/changes/c-07-agenda-experience/**`. La lista exacta de archivos está en `design.md` § Archivos.
- **Contratos consumidos, sin editarlos:** `AppointmentEntity` y `APPOINTMENT_STATUSES` de core (C-05); `AvailabilityService.getSemanales()` y `listExcepciones()` más el helper `horaLocalAUtc` (C-03); `SessionGuard` global (C-04); reloj `APPOINTMENT_CLOCK` (C-05); `GET /api/sillones` (C-02) desde el frontend.
- **Ya cableado por C-01/C-04/C-05, sin tocar:** el módulo `AppointmentAgendaModule` ya está importado en `appointments.module.ts` y `/agenda` ya está ruteado hacia `features/agenda` en `frontend/src/app/routes.tsx`. No se edita `app.module.ts` ni `frontend/src/app/**`.
- **Contrato nuevo para C-06/C-08:** `GET /api/agenda` y las props `renderActions`/`onChanged` de la página de agenda. Se propone en `coordination.md`; no se asume que el código de C-06 exista.
- **Dependencias:** ninguna nueva. **Migraciones:** ninguna (C-07 no tiene migraciones en su ownership).
- **Coordinación abierta (no bloquea el Apply):** badge de estado `ATENDIDO` ausente en `design-system` revisión 1; ver `coordination.md`.
