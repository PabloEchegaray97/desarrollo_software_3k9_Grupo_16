# Tasks

## 0. Coordinación previa (fuera del ownership de C-07)

- [x] 0.1 Enviar a Milagros y Pablo el contrato propuesto de `coordination.md` (`renderActions`/`onChanged`, enlace a `/turnos/:id`, badge `ATENDIDO` y estado del árbol de trabajo) y registrar sus respuestas en `verification.md`; verificar que ningún archivo fuera de ownership fue editado con `git status`.

## 1. Rango y contrato de consulta (`appointments/agenda`)

- [x] 1.1 Implementar `domain/agenda-range.ts` (calendario real, `desde > hasta`, tope de 31 días, lista de fechas, día de la semana ISO, suma de días sobre fechas locales) y `domain/agenda-range.spec.ts`; verificar con `npm test` que cubre 31 vs 32 días, bisiesto, 30 de febrero y cruce de mes y de año.
- [x] 1.2 Implementar `agenda-errors.ts` (`AGENDA_RANGE_INVALID`, `AGENDA_RANGE_TOO_LARGE` con `maximoDias`/`solicitadoDias`, `AGENDA_CHAIR_NOT_FOUND`) y `dto/agenda-query.dto.ts` con su `agenda-query.dto.spec.ts`; verificar con `npm test` formato de fecha, UUID, estados válidos, desconocidos y vacíos, y parámetro no documentado.

## 2. Servicio, controlador y módulo

- [x] 2.1 Implementar `agenda-response.ts` y `agenda.service.ts`: ventana UTC con `horaLocalAUtc`, consulta con columnas explícitas (solo `id` y `nombre` de paciente, prestación y sillón), filtros de sillón y estado, orden `starts_at, created_at, id`, `bloqueaHorario` con `isBlockingStatus`, `dias` con tramos y bloqueos activos de `AvailabilityService`, `generadoEn` con `APPOINTMENT_CLOCK`; verificar con `agenda.service.spec.ts` (orden y desempate, sin campos de contacto, día sin tramos, bloqueo parcial y completo, sillón inexistente, reloj fijo).
- [x] 2.2 Implementar `agenda.controller.ts` (`GET /agenda`) y componer `AppointmentAgendaModule` con `DatabaseModule`, `AppointmentCoreModule` y `AvailabilityModule` sin tocar `app.module.ts`; verificar con `agenda.controller.spec.ts` (200, 400, 422) y que `npm run build`, `npm run lint` y `architecture-boundaries.spec.ts` pasan.

## 3. Verificación backend con MariaDB real

- [x] 3.1 Crear `testing/agenda-api.support-spec.ts` (migraciones, sesión con `authenticatedCookie`, reloj fijo, fixtures ficticios de paciente, prestaciones, sillones, tramos y excepciones vía API de C-03) con limpieza de turnos y eventos en `afterAll`; verificar por revisión que no hay datos reales ni secretos y que `npm run test:integration` completo sigue verde.
- [x] 3.2 Escribir en `agenda.integration-spec.ts` las pruebas de lectura: orden con turnos creados al revés, filtros por sillón (incluido inactivo) y por estado, `CANCELADO` incluido sin filtro, borde 23:30/00:00 locales, agenda vacía con `dias`, rango de 31 y 32 días, rango invertido y fecha inexistente; verificar con `npm run test:integration`.
- [x] 3.3 Escribir las pruebas de diferenciación y privacidad: intervalo y excepción en el turno, `bloqueaHorario` por estado, tramos y bloqueos parcial, de día completo y cancelado omitido, ausencia exacta de teléfono, DNI, email y motivo de cancelación, 401 sin sesión y parámetro no documentado; verificar con `npm run test:integration`.
- [x] 3.4 Ejecutar `npm run test:integration` también con `TZ=America/Argentina/Buenos_Aires` y verificar los instantes UTC literales (`T13:00:00.000Z` para 10:00 locales); registrar versión de MariaDB, comando y resultado en `verification.md`.

## 4. Frontend: base de la vista (`features/agenda`)

- [x] 4.1 Implementar `types.ts`, `api.ts` (`GET /agenda` y `GET /sillones`), `time.ts` (formato local con `Intl`, hoy y suma de días en `America/Argentina/Buenos_Aires`) y `time.test.ts`; verificar con `npm test` el formato de horas, el cruce de mes y que "hoy" respeta la zona.
- [x] 4.2 Implementar `status.ts` (texto, token de color y forma por estado) y `StatusBadge.tsx` con `status.test.ts`; verificar con `npm test` que los cinco estados tienen etiqueta y forma únicas y que el cancelado marca no bloqueante.
- [x] 4.3 Implementar `agenda-params.ts` (lectura y escritura de `fecha`, `sillon`, `estado`, `turno`; fecha inválida cae a hoy) y `errors.ts` (mensajes de `AGENDA_RANGE_INVALID`, `AGENDA_RANGE_TOO_LARGE` y errores genéricos) con sus pruebas; verificar con `npm test`.
- [x] 4.4 Implementar `useAgenda.ts` (carga, refresco con datos previos visibles, error, cancelación de solicitudes obsoletas) y `contracts.ts` (`renderActions`, `onChanged`); verificar con pruebas del hook dentro de `agenda.test.tsx`.

## 5. Frontend: pantalla y estados

- [x] 5.1 Implementar `AgendaToolbar.tsx` (día anterior, siguiente, hoy, selección de fecha, "Actualizar" y hora de `generadoEn`) y `AgendaFilters.tsx` (sillón, estados, "Limpiar filtros", aviso sin estados, error del selector con reintento); verificar con pruebas de componentes que cada cambio reconsulta al backend y no filtra en el cliente.
- [x] 5.2 Implementar `DayOverview.tsx` (tramos y bandas de bloqueo) y `AppointmentRow.tsx` (atención, intervalo, excepción, estado y sillón); verificar con pruebas que intervalo, bloqueo y excepción se distinguen y que el orden es el recibido.
- [x] 5.3 Implementar `AppointmentDetail.tsx` (datos del turno, `Esc`, foco, "Gestionar turno", `renderActions`, cierre si el turno desaparece) y reemplazar el placeholder de `index.tsx`; verificar con pruebas de foco, cierre, valores extra del payload no mostrados y reconsulta tras `onChanged`.
- [x] 5.4 Implementar los estados de carga, vacío (con y sin filtros), error con reintento, rango rechazado y refresco fallido con datos previos, y `agenda.css` con los tokens del design system (responsive 390×844 y 1440×900, `prefers-reduced-motion`); verificar con pruebas de cada estado y con `npx tsc -b`, `npm test`, `npm run lint` y `npm run build` sin errores ni `any`.

## 6. Verificación integral

- [x] 6.1 Con backend y MariaDB de desarrollo en ejecución y datos ficticios, recorrer manualmente `/agenda` en 390×844 y 1440×900 sin Playwright (agenda con turnos en los cinco estados, día vacío, filtros sin coincidencias, carga, error, refresco fallido, detalle, día con bloqueo, turno con excepción) y registrar pantallas, viewports, foco, desbordamiento, contraste y resultado en `verification.md`.
- [x] 6.2 Registrar en `verification.md` la resolución de P2-02 y las aprobaciones recibidas, ejecutar `node scripts/change-scope/check.mjs --branch change/c-07-agenda-experience --base main` sin violaciones y `openspec validate c-07-agenda-experience --strict` sin errores.

## Workflow follow-up

- No ejecutar `openspec sync` ni `openspec archive` desde esta rama: Pablo los ejecuta después del merge.
- Commit, push y PR `[C-07] agenda-experience` solo por pedido explícito de Gonzalo.
- Marcar C-07 en `CHANGES.md` y cerrar P2-02 en `knowledge-base/10_preguntas_abiertas.md` corresponde a la integración, no a esta rama.
