# Design

## Context

Ver `proposal.md` § Why. Estado de partida verificado en `main` (7b510b2):

- C-05 dejó `AppointmentEntity` (UTC, tiempos efectivos copiados), `APPOINTMENT_STATUSES`, `isBlockingStatus`, el reloj `APPOINTMENT_CLOCK` y los índices `status+starts_at+block_ends_at` y `chair_id+starts_at`.
- C-03 expone `AvailabilityService.getSemanales()` y `listExcepciones()` (solo activas) y el helper `horaLocalAUtc(fecha, hora, zona)`.
- `AppointmentAgendaModule` existe vacío y ya está importado por `appointments.module.ts`; `/agenda` ya está ruteado hacia `features/agenda` (placeholder). No hace falta tocar archivos globales.
- `main.ts` usa `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`; `DataSource` ya fija `timezone: 'Z'` (CR-05-01 integrado).
- C-07 no tiene migraciones ni dependencias en su ownership.

## Goals / Non-Goals

**Goals:**
- Lectura de agenda completa y acotada, con contrato estable para C-08.
- Vista diaria utilizable en escritorio y móvil que solo presenta lo que decide el backend.

**Non-Goals:**
- Paginación temporal, vistas semanal/mensual en la interfaz, edición o cambio de estado (C-06), historial (C-06), cálculo de huecos libres, migraciones, dependencias nuevas.

## Decisiones

### Decisión 1 — P2-02: rango máximo de 31 días calendario inclusive

Una consulta abarca hasta 31 días; uno más se rechaza con `AGENDA_RANGE_TOO_LARGE` (400, `details.maximoDias` y `solicitadoDias`). No hay paginación temporal: el tope acota la respuesta.

- **Por qué 31:** cubre un mes calendario completo (vista mensual futura o C-08) con un único odontólogo. Estimación: unas 25 atenciones por día hábil → menos de 800 filas por consulta, razonable en una sola respuesta JSON.
- **Alternativas:** 7 días (cubre vista semanal, pero obliga a varias consultas para un mes); 62 días (sin necesidad hoy y duplica el peso del peor caso).
- **La interfaz de C-07 consulta un solo día.** El tope es del contrato HTTP, no de la pantalla.
- Se registra la resolución de P2-02 en `verification.md`; `knowledge-base/10_preguntas_abiertas.md` no se edita desde esta rama (lo actualiza Pablo al integrar).

### Decisión 2 — Contrato de consulta

`GET /api/agenda` (protegido por el `SessionGuard` global; ruta propia para no colisionar con `POST /api/turnos` de C-05 ni con `/turnos/:id` de C-06).

| Parámetro | Obligatorio | Regla |
|---|---|---|
| `desde` | sí | `YYYY-MM-DD` local, inclusiva |
| `hasta` | no | igual formato; por defecto `desde`; inclusiva |
| `sillonId` | no | UUID; inexistente → 422 `AGENDA_CHAIR_NOT_FOUND`; se acepta un sillón inactivo |
| `estado` | no | lista separada por comas de los cinco estados; sin parámetro = todos |

Respuesta 200:

```text
{
  zonaHoraria, desde, hasta, generadoEn,            // generadoEn = reloj del servidor, UTC
  turnos: [{
    id, estado, inicio, finAtencion, finBloqueo,     // ISO UTC con Z
    duracionMinutos, intervaloPosteriorMinutos,
    bloqueaHorario,                                  // lo decide el backend (RN-TU-07)
    fueraDisponibilidad, motivoExcepcion,
    paciente: { id, nombre }, prestacion: { id, nombre }, sillon: { id, nombre }
  }],
  dias: [{ fecha, tramos: [{ horaInicio, horaFin }],
           bloqueos: [{ id, tipo, motivo, horaInicio|null, horaFin|null }] }]
}
```

- **Ventana:** `starts_at` en `[00:00 local de desde, 00:00 local del día posterior a hasta)`, convertida a UTC con `horaLocalAUtc` y `America/Argentina/Buenos_Aires`. Se filtra por **inicio** del turno, no por intersección: la disponibilidad ordinaria no cruza medianoche y un turno pertenece al día en que empieza.
- **Errores:** `AGENDA_RANGE_INVALID` (400: `desde > hasta` o fecha inexistente), `AGENDA_RANGE_TOO_LARGE` (400), `AGENDA_CHAIR_NOT_FOUND` (422), `VALIDATION_ERROR` (400: formato, UUID, estado desconocido o vacío, parámetro no documentado, `desde` ausente), 401 sin sesión.
- **Por qué `dias` en la misma respuesta:** el Flujo 6 pide "turnos ordenados, disponibilidad y excepciones relevantes". El backend calcula el día de la semana y selecciona tramos y bloqueos; React solo los dibuja. Los tramos y bloqueos no dependen de los filtros (un solo odontólogo).
- **Alternativa descartada:** `GET /api/turnos?...` (reutiliza el prefijo de creación y se mezcla con la ruta de C-06) y un endpoint de detalle aparte (el detalle sale de los mismos datos; el historial es de C-06).

### Decisión 3 — Orden estable por inicio

`ORDER BY starts_at ASC, created_at ASC, id ASC`. Entre turnos bloqueantes no hay empates (RN-TU-03), pero los `CANCELADO` sí pueden coincidir; `created_at` y luego `id` fijan el orden. La interfaz no reordena.

### Decisión 4 — Atención, intervalo, bloqueo y excepción

| Concepto | Origen | Representación |
|---|---|---|
| Atención | `[inicio, finAtencion)` | Horario principal de la fila, con riel de color del estado |
| Intervalo | `[finAtencion, finBloqueo)` | Segmento secundario con borde punteado y texto "Intervalo 10 min"; ausente si es 0 |
| Bloqueo | excepción activa de C-03 (`FERIADO`, `VACACIONES`, `BLOQUEO`) | Banda propia del día, ícono de candado, tipo, motivo y "Todo el día" u horario; nunca mezclada con filas de turnos |
| Excepción | `fueraDisponibilidad` del turno | Marca "Fuera de disponibilidad" con ícono de bandera; motivo en el detalle |

Los nombres siguen el vocabulario de la KB: "bloqueo" es la excepción de disponibilidad del consultorio y "excepción" es el turno atendido fuera de horario (US-032: "Distingue bloqueos y excepciones").

### Decisión 5 — Agenda vacía

200 con `turnos: []` y `dias` completo, nunca 404. En la interfaz, dos mensajes distintos: "No hay turnos para esta fecha" (sin filtros) y "Ningún turno coincide con los filtros" (con "Limpiar filtros"). Los tramos y bloqueos del día se muestran igual, así un día vacío sigue informando su disponibilidad y sus bloqueos.

### Decisión 6 — Rechazo de rango inválido

La validación sintáctica (formato, UUID, estados, parámetros no documentados) la hace el DTO con `class-validator`; la semántica del rango (calendario real, orden, tope de 31) vive en una función pura `agenda-range` sin dependencias, probada de forma aislada. En la interfaz, un rango rechazado muestra un mensaje claro y ningún turno.

### Decisión 7 — Refresco explícito

Botón "Actualizar" que reconsulta con la fecha y filtros vigentes, y una línea "Actualizado a las HH:mm" con la hora de `generadoEn` en la zona del consultorio. Sin polling ni refresco automático. Durante el refresco la lista previa sigue visible (`aria-busy`); si falla, se conserva la lista, se muestra el error con la hora de los datos y un reintento. Si el detalle abierto ya no está en la respuesta, se cierra y se avisa. Cubre el caso "datos cambiados durante la consulta" del Flujo 6.

### Decisión 8 — Vista diaria responsive

- **1440×900:** dos columnas; lista a la izquierda y detalle fijo a la derecha. Filtros en una franja superior.
- **390×844:** una columna sin desplazamiento horizontal; el detalle ocupa el ancho completo sobre la lista, con "Cerrar" y foco movido a su título.
- Estado en la URL con `useSearchParams`: `fecha`, `sillon`, `estado`, `turno`. Una `fecha` inválida cae a hoy sin enviarse al backend. "Hoy" se calcula con `Intl` en `America/Argentina/Buenos_Aires` y es solo navegación de presentación.
- Animación mínima (presión de botones y transiciones breves), sin movimiento al cambiar de turno; `prefers-reduced-motion` ya está cubierto por `tokens.css`.

### Decisión 9 — Filtros y detalle

- **Filtros:** selector de sillón (todos + los de `GET /api/sillones?incluirInactivos=true`) y casillas de estado (todas marcadas = no se envía `estado`). Con ninguna marcada no se consulta y se avisa. Cada cambio reconsulta al backend; nada se filtra en el cliente. Si `GET /api/sillones` falla, solo ese control muestra error con reintento.
- **Detalle:** paciente (solo `nombre`), prestación, sillón, fecha, atención, intervalo, duración, estado, excepción con motivo, "Gestionar turno" y el hueco `renderActions`. Cierra con `Esc` y devuelve el foco a la fila.
- **Por defecto se listan todos los estados, incluido `CANCELADO`** (decisión a aprobar): el consultorio ve qué se canceló, marcado como no bloqueante y filtrable con un clic. La alternativa (ocultar cancelados por defecto) esconde información sin que el backend lo decida.

### Decisión 10 — Estados con texto, color y forma

| Estado | Texto | Color (tokens) | Forma |
|---|---|---|---|
| PROGRAMADO | Programado | `--color-info` sobre `--color-info-soft` | círculo hueco |
| CONFIRMADO | Confirmado | `--color-success` sobre `--color-success-soft` | círculo con tilde |
| ATENDIDO | Atendido | `--color-primary` sobre `--color-primary-soft` | cuadrado con tilde |
| AUSENTE | Ausente | `--color-warning` sobre `--color-warning-soft` | triángulo con signo de exclamación |
| CANCELADO | Cancelado | `--color-danger` sobre `--color-danger-soft` | cruz; horario tachado |

El design system revisión 1 define `programmed`, `confirmed`, `absent` y `cancelled`, pero **no `ATENDIDO`**. C-07 lo compone solo con tokens existentes dentro de `features/agenda/agenda.css` y lo informa en `coordination.md`; no edita `design-system/**`. Las formas son SVG con `aria-hidden` y el texto es siempre visible. Las marcas de bloqueo (candado) y excepción (bandera) usan formas distintas de las cinco anteriores.

### Decisión 11 — Sin información clínica ni de contacto

- El backend arma la consulta con **columnas explícitas** (`patients.id`, `patients.name`, `procedures.id`, `procedures.name`, `chairs.id`, `chairs.name`): no carga entidades completas y teléfono, DNI y email nunca salen de la base. El motivo de cancelación tampoco se selecciona.
- Los tipos del frontend no declaran campos de contacto y la interfaz solo renderiza campos conocidos; una prueba verifica que valores extra del payload no se muestran.
- El servicio no registra logs con contenido de respuesta ni nombres. `motivoExcepcion` es texto libre ya existente en C-05: se muestra solo en el detalle y no se registra.

### Decisión 12 — Integración con C-06 y C-08

C-07 no edita lifecycle ni history y no asume que el código de C-06 existe. Deja dentro de `features/agenda`:

- Prop opcional `renderActions?: (turno: AgendaTurno) => ReactNode` de `AppointmentAgendaPage`, que se dibuja en el detalle.
- Prop opcional `onChanged` expuesta al render de acciones para que C-06 avise que cambió algo; la agenda reconsulta.
- Enlace "Gestionar turno" hacia `/turnos/:id` (ruta ya registrada por C-01; hoy muestra un placeholder de C-06).

El contrato propuesto para C-06 y el ensamble de C-08 se detallan en `coordination.md`. Los estados que escribe C-06 se leen por la misma tabla, así que la agenda los refleja sin acoplamiento adicional.

### Decisión 13 — Consumo de C-03 y de core

`AgendaService` usa los métodos públicos exportados por `AvailabilityModule` (no lee sus tablas) y el helper `horaLocalAUtc` para no duplicar reglas de zona. De core importa `APPOINTMENT_STATUSES`, `isBlockingStatus` y `APPOINTMENT_CLOCK`. Alternativa descartada: consultar `disponibilidad_semanal` y `excepcion_disponibilidad` directamente (acopla C-07 a tablas de C-03).

### Decisión 14 — Compuerta visual

Design review gate: modo `system-only`, design system revisión 1 aprobada (2026-11-23). **Decision: no (project policy)** — no se generan mockups ni se abre una compuerta visual nueva. La revisión visual es manual en 390×844 y 1440×900, sin Playwright.

## Archivos previstos

Backend (`backend/src/modules/appointments/agenda/`):

| Archivo | Acción |
|---|---|
| `appointment-agenda.module.ts` | modificar (importa `DatabaseModule`, `AppointmentCoreModule`, `AvailabilityModule`; declara controlador y servicio) |
| `agenda.controller.ts` | crear |
| `agenda.service.ts` | crear |
| `agenda-errors.ts` | crear |
| `agenda-response.ts` | crear (tipos y mapeo de filas) |
| `domain/agenda-range.ts` | crear |
| `dto/agenda-query.dto.ts` | crear |
| `domain/agenda-range.spec.ts` | crear |
| `dto/agenda-query.dto.spec.ts` | crear |
| `agenda.service.spec.ts` | crear |
| `agenda.controller.spec.ts` | crear |
| `agenda.integration-spec.ts` | crear |
| `testing/agenda-api.support-spec.ts` | crear |

Frontend (`frontend/src/features/agenda/`):

| Archivo | Acción |
|---|---|
| `index.tsx` | modificar (reemplaza el placeholder; exporta `AppointmentAgendaPage`) |
| `api.ts`, `types.ts`, `contracts.ts`, `errors.ts` | crear |
| `agenda-params.ts`, `time.ts`, `status.ts`, `useAgenda.ts` | crear |
| `AgendaToolbar.tsx`, `AgendaFilters.tsx`, `DayOverview.tsx` | crear |
| `AppointmentRow.tsx`, `StatusBadge.tsx`, `AppointmentDetail.tsx` | crear |
| `agenda.css` | crear |
| `agenda.test.tsx`, `agenda-params.test.ts`, `time.test.ts`, `status.test.ts`, `errors.test.ts` | crear |

OpenSpec (`openspec/changes/c-07-agenda-experience/`): `proposal.md`, `design.md`, `tasks.md`, `coordination.md`, `specs/appointment-agenda/spec.md`, `specs/appointment-agenda-ui/spec.md` y, durante Apply, `verification.md`.

**Solo lectura (dependencias):** `appointments/core/**`, `appointments/creation/**`, `features/appointments/create/**`, `modules/availability/**`, `features/catalog/test-utils.ts` (helper de pruebas, como ya hace C-05), `shared/components/StatePanel.tsx` y `shared/api/client.ts`.

**Fuera de ownership, no se tocan:** `app.module.ts`, `frontend/src/app/**`, `frontend/src/shared/**`, `backend/src/shared/**`, lifecycle, history, migraciones, `package.json`, `design-system/**`, `knowledge-base/**`, `CHANGES.md`, `AGENTS.md`, `openspec/specs/**`.

## Plan de pruebas

**Backend unitarias (jest):**
- `agenda-range`: 31 vs 32 días, `hasta` por defecto, `desde > hasta`, fecha inexistente (30 de febrero), año bisiesto, cruce de mes y de año, día de la semana ISO.
- DTO: formato de fecha, UUID, lista de estados (válida, desconocida, vacía), parámetro no documentado.
- Servicio con dobles: orden y desempate, `bloqueaHorario`, ausencia de campos de contacto, armado de `dias` (tramos, bloqueo parcial y de día completo, día sin tramos), `generadoEn` con reloj fijo, sillón inexistente.
- Controlador: 200, 400, 422 y propagación de códigos.

**Backend integración con MariaDB real (`npm run test:integration`):** turnos creados con `POST /api/turnos` y estados fijados por SQL de prueba; orden con turnos creados al revés; filtros por sillón (incluido inactivo) y estado; borde 23:30/00:00 locales; agenda vacía; rango excesivo e inválido; 401 sin sesión; tramos y bloqueos creados vía API de C-03 y excepción cancelada omitida; ausencia de teléfono, DNI, email y motivo de cancelación; ejecución también con `TZ=America/Argentina/Buenos_Aires`. Limpieza de turnos y eventos en `afterAll` (la FK `RESTRICT` rompería la limpieza de C-02/C-03). Todo con datos ficticios.

**Frontend (vitest + Testing Library, sin Playwright):** orden tal cual llega; filtros que reconsultan sin filtrar en cliente; "sin ningún estado"; vacío vs sin coincidencias; carga, error y reintento; refresco, indicación de hora y falla conservando datos; detalle (abrir, `Esc`, foco, cierre si desaparece); cinco estados con texto y forma únicos; bloqueo, intervalo y excepción diferenciados; payload con campos extra no se muestra; `renderActions`, enlace y `onChanged`; parámetros de URL.

**Revisión visual manual (sin Playwright), 390×844 y 1440×900:** agenda con varios turnos y estados, día vacío, filtros sin coincidencias, carga, error, refresco fallido, detalle abierto, día con bloqueo y turno con excepción. Se revisan foco visible, desbordamiento horizontal, contraste, tachado de cancelados y `prefers-reduced-motion`. Se registra en `verification.md` qué pantallas y viewports se revisaron, con datos ficticios.

**Comprobaciones finales:** `npm run build`, `npm run lint`, `npm test` y `npm run test:integration` en backend; `npx tsc -b`, `npm test`, `npm run lint` y `npm run build` en frontend; `node scripts/change-scope/check.mjs --branch change/c-07-agenda-experience --base main`; `openspec validate c-07-agenda-experience --strict`.

## Risks / Trade-offs

- **Sin índice solo por `starts_at`** (los existentes empiezan por `status` o `chair_id`) → con un consultorio y rango ≤31 días el volumen es bajo; no hay migración en el ownership de C-07. Si la medición lo justifica, se propone a C-08.
- **Tres lecturas sin snapshot común** (turnos, tramos, excepciones) → `generadoEn` se toma al inicio y el refresco es explícito; un cambio entre lecturas se corrige al actualizar.
- **`ATENDIDO` sin badge en el design system** → se compone con tokens existentes en `agenda.css`; Pablo decide si lo incorpora al design system (revisión 2) en C-08.
- **Contrato de lifecycle aún inexistente** → `renderActions`/`onChanged` es una propuesta; si C-06 define otra forma, el ajuste queda dentro de `features/agenda` o en C-08.
- **"Gestionar turno" apunta hoy a un placeholder** → aceptado hasta C-08; el enlace usa la ruta ya registrada.
- **Formateadores de fecha duplicados** respecto de `appointments/create/time.ts`, porque no se puede editar `shared/` → se deja una copia mínima en `features/agenda/time.ts` y se anota para que C-08 la unifique.
- **Reloj del navegador para "hoy"** → es solo la fecha inicial de navegación; el backend decide todo lo demás y `generadoEn` viene del servidor.
- **Restricción de `architecture-boundaries.spec.ts`:** escanea todo `src/**/*.ts` que no termine en `.spec.ts` (incluye `*-spec.ts` como `.integration-spec.ts`) y prohíbe `class Turno`, "solapamiento" y "overlap" → el código usa los términos "conflicto" e "intersección".
- **Árbol de trabajo con archivos modificados ajenos** (saltos de línea en 77 archivos, ver `coordination.md`) → el verificador de scope podría marcarlos; no se tocan y se informa a Pablo antes del PR.
- **Texto libre en `motivoExcepcion`** podría contener datos personales escritos por el usuario → se limita al detalle, sin logs.
