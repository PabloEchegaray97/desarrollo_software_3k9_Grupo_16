# Tasks

## 0. Coordinación previa (fuera del ownership de C-05)

- [ ] 0.1 Enviar a Pablo CR-05-01 (`timezone: 'Z'` en `data-source.ts`) y la observación sobre `architecture-boundaries.spec.ts`, y registrar su respuesta en `verification.md`. No editar esos archivos desde esta rama.
- [ ] 0.2 Cuando CR-05-01 esté en `main`, actualizar la rama sin perder trabajo y verificar con `git log` que el cambio está presente antes de la tarea 3.6.

## 1. Persistencia y núcleo (`appointments/core`)

- [ ] 1.1 Agregar `2026112600000-C05-CreateAppointments.ts` con `appointments` y `appointment_events`, FKs `RESTRICT`, `CHECK` de rangos, estados, tipos, motivo condicional y orden de instantes, más los índices de conflicto; verificar con `npm run build` y `up`/`down` contra MariaDB real.
- [ ] 1.2 Crear `AppointmentEntity` y `AppointmentEventEntity` declarando los mismos índices y `CHECK` que la migración; verificar con el schema builder de TypeORM que no hay diferencias, y que `architecture-boundaries.spec.ts` y `npm run lint` pasan.
- [ ] 1.3 Implementar `domain/appointment-status.ts` y `domain/appointment-policy.ts` (tiempos efectivos, período bloqueado, conflicto semiabierto, clasificación `SILLON`/`ODONTOLOGO`); verificar con tests unitarios de precedencias, límites, contigüidad exacta, inicio dentro del intervalo posterior y estados bloqueantes frente a `CANCELADO`.
- [ ] 1.4 Implementar `TypeOrmTransactionBoundary` (lock `FOR UPDATE` sobre `configuracion_agenda`), `findBlockingConflicts(manager, period, excludeId?)` y el reloj inyectable; exportarlos desde `AppointmentCoreModule` y verificar con tests unitarios y `npm run build`.

## 2. Alta de turnos (`appointments/creation`)

- [ ] 2.1 Implementar `CreateAppointmentDto` (UUIDs, fecha `YYYY-MM-DD`, hora `HH:mm`, sobrescrituras `1..240` y `0..30`, motivo obligatorio y recortado de 1–500 si `fueraDisponibilidad`) y `appointment-errors.ts` con los códigos de la spec; verificar con tests unitarios de cada límite y del motivo condicional.
- [ ] 2.2 Implementar `CreateAppointmentService` con el orden de la decisión 3 del design (lock → referencias → tiempos → evaluación → pasado → conflictos → disponibilidad → turno + eventos); verificar con tests unitarios con dobles: orden de errores, override innecesario, referencias inexistentes e inactivas, reloj fijo y eventos `CREADO`/`EXCEPCION`.
- [ ] 2.3 Implementar `AppointmentsController` (`POST /turnos`) y componer `AppointmentCreationModule` con Core, Patients, Catalogs y Availability sin tocar `app.module.ts`; verificar con un test del controlador (201, 400) y con el arranque de `AppModule` en `npm run build`.

## 3. Verificación backend con MariaDB real

- [ ] 3.1 Crear fixtures ficticios y el harness de integración (migraciones, sesión con `authenticatedCookie`, disponibilidad semanal y excepciones vía la API de C-03, reloj fijo); verificar por revisión que no hay datos reales.
- [ ] 3.2 Escribir pruebas de integración de reglas: alta feliz con tiempos efectivos persistidos y evento `CREADO`, precedencia del intervalo global, contigüidad exacta, conflicto en otro sillón y en el mismo, `CANCELADO` no bloquea, `ATENDIDO`/`AUSENTE` bloquean y cambios posteriores de prestación o global no reescriben el turno.
- [ ] 3.3 Escribir pruebas de integración de disponibilidad: fuera de horario sin y con motivo (eventos `CREADO` + `EXCEPCION`), override sin motivo, override que no salva un conflicto, día con `FERIADO` rechazado aun con override, override innecesario, referencias inactivas, inicio pasado y hora inválida.
- [ ] 3.4 Escribir pruebas de concurrencia: dos y cinco altas simultáneas incompatibles, en el mismo sillón y en sillones distintos, con exactamente una 201 y las demás 409 `APPOINTMENT_CONFLICT`.
- [ ] 3.5 Escribir la prueba de atomicidad: con el escritor de eventos reemplazado por uno que falla, la solicitud no deja turno ni eventos.
- [ ] 3.6 Ejecutar `npm run test:integration` (runner de C-01) contra MariaDB real y registrar en `verification.md` versión, comando y resultado; con CR-05-01 integrado, ejecutar además la suite con `TZ=America/Argentina/Buenos_Aires` y verificar los valores UTC literales. Sin CR-05-01, registrar esa parte como bloqueada.

## 4. Frontend (`features/appointments/create`)

- [ ] 4.1 Implementar `api.ts`, `types.ts`, `time.ts` (formato local con `Intl`) y `errors.ts` (mapeo de códigos y `details` a mensajes y campos); verificar con tests unitarios de formato y de mapeo.
- [ ] 4.2 Implementar `AppointmentForm` y `PatientPicker` con opciones activas, valores de referencia de duración e intervalo, obligatorios locales y estados de carga/error con reintento; verificar con tests de componentes.
- [ ] 4.3 Implementar `ExceptionModal` (motivo obligatorio, reenvío con override, cancelar conservando datos) y los avisos de conflicto y día bloqueado; verificar con tests de componentes de cada flujo.
- [ ] 4.4 Implementar `AppointmentSummary` (horas locales, valores efectivos, excepción, "crear otro") y reemplazar el placeholder de `AppointmentCreationPage`; verificar con tests de componentes.
- [ ] 4.5 Ejecutar `npx tsc -b`, `npm test`, `npm run lint` y `npm run build` en `frontend/` sin errores ni `any`.

## 5. Verificación integral

- [ ] 5.1 Con backend y MariaDB de desarrollo en ejecución, recorrer manualmente el alta ordinaria, la excepción con motivo, un conflicto y un día bloqueado en `/turnos/nuevo`, y revisar formulario, modal, avisos y resumen en 390×844 y 1440×900 sin Playwright; registrar pantallas, viewports, foco, overflow y resultado en `verification.md`.
- [ ] 5.2 Ejecutar `node scripts/change-scope/check.mjs --branch change/c-05-appointment-creation-engine --base main` sin violaciones y `npx @fission-ai/openspec@2.1.1 validate c-05-appointment-creation-engine --strict` sin errores.

## Workflow follow-up

- Commit, push y PR `[C-05] appointment-creation-engine` solo por pedido explícito de Paula.
- Pablo revisa, integra en `main` y ejecuta `openspec-sync-specs` y `openspec-archive-change`; no se ejecutan desde esta rama.
- Marcar C-05 en `CHANGES.md` corresponde a la integración, no a esta rama.
