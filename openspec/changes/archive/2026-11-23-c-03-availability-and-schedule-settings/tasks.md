# Tasks

Modo de Apply: **Strict TDD**. Cada comportamiento se introduce con un test fallido que cubre al menos un caso happy path y un edge case; después se escribe el mínimo código para hacerlo pasar y se vuelven a ejecutar los tests. No se marca una tarea como completada si el test no falló primero o si queda algún caso del comportamiento sin cubrir. No se usa `any` y no se versionan `dist/`, `coverage/` ni otros artefactos generados.

## 1. Arranque y coordinación

- [x] 1.1 Verificar con `openspec status --change c-03-availability-and-schedule-settings` que los artefactos de planning están completos y que la rama activa es `change/c-03-availability-and-schedule-settings` antes de crear cualquier archivo de código; verificar salida JSON sin errores
- [x] 1.2 Registrar en `coordination.md` dentro del directorio propio del change los pedidos CR-01 (códigos de dominio en el filtro) y CR-02 (descubrimiento de suites de integración) heredados de C-02, y verificar con `git status --short` que no se editó ningún archivo compartido

## 2. Persistencia y migración C03 (MariaDB real)

- [x] 2.1 Escribir primero un test de integración fallido contra MariaDB real que compruebe que la migración nueva `C03` crea `ConfiguracionAgenda`, `DisponibilidadSemanal` y `ExcepcionDisponibilidad`, con la fila única de configuración en 10 minutos y la zona IANA; verificar que el test falla por ausencia de migración antes de implementar
- [x] 2.2 Implementar la migración aditiva `*-C03-*.ts` y las entidades mínimas hasta que el test 2.1 pase; verificar con `npm run test:integration` que la suite C03 pasa y que no se modificaron migraciones C01/C02
- [x] 2.3 Escribir primero tests de integración fallidos para los edge cases de persistencia: no se puede insertar una segunda configuración y una excepción conserva `motivo`, `fecha` local y `activo` tras desactivarla; verificar fallo previo
- [x] 2.4 Agregar el mínimo constraint/ índice y el campo `activo` necesarios para que 2.3 pase, y verificar que los instantes persistidos son UTC y que ningún campo guarda `-03:00` como zona

## 3. Política pura de disponibilidad (unitarias, test-first)

- [x] 3.1 Escribir primero tests unitarios fallidos para múltiples tramos por día y contigüidad: caso happy con dos tramos lunes 09:00–13:00 y 16:00–20:00 ambos disponibles, y edge con 10:00–12:00 más 12:00–13:00 tratados como disponibilidad continua sin solapamiento; verificar que fallan antes de implementar
- [x] 3.2 Implementar el mínimo cálculo de tramos e intervalos semiabiertos `[inicio, fin)` hasta que 3.1 pase, y verificar que se ejecuta sin reloj del sistema ni acceso a base
- [x] 3.3 Escribir primero tests unitarios fallidos para rechazo de tramos invertidos y solapados: caso happy con tramo válido aceptado y edge con 11:30–13:00 solapando 10:00–12:00 rechazado, más inicio ≥ fin rechazado; verificar fallo previo
- [x] 3.4 Implementar la validación mínima de orden y solapamiento por mismo día hasta que 3.3 pase, y verificar que el resultado distingue `VALIDATION_ERROR` de solapamiento sin borrar el conjunto anterior
- [x] 3.5 Escribir primero tests unitarios fallidos para excepción total y parcial: caso happy con `VACACIONES` de día completo bloqueando 10:00 y edge con `BLOQUEO` 11:00–12:00 que deja disponible 10:00 y bloquea 11:30; incluir que la excepción prevalece sobre `FUERA_DE_DISPONIBILIDAD` y que el motivo se devuelve; verificar fallo previo
- [x] 3.6 Implementar la precedencia mínima de excepciones sobre tramos semanales hasta que 3.5 pase, y verificar que no aparece ningún tipo `HABILITACION` en la política
- [x] 3.7 Escribir primero tests unitarios fallidos de conversiones local/UTC deterministas: caso happy con 2026-07-15 09:00 local → `2026-07-15T12:00:00.000Z` y edge con 2027-01-15 09:00 local bajo las reglas IANA, más una hora local inexistente/ambigua que devuelve `DATOS_INVALIDOS`; verificar fallo previo
- [x] 3.8 Implementar la conversión mínima con `Intl.DateTimeFormat` y la zona IANA configurada hasta que 3.7 pase, y verificar que no se agregó dependencia ni se guardó un offset fijo
- [x] 3.9 Escribir primero tests unitarios fallidos para los límites de evaluación: caso happy con duración contenida en el tramo y edge con inicio 12:45 y duración 30 que excede el tramo, más el mismo inicio con intervalo posterior 0 y 30 produciendo igual resultado de disponibilidad; verificar fallo previo
- [x] 3.10 Implementar la evaluación mínima que usa solo duración para contención y expone `finBloqueoUtc` informativo hasta que 3.9 pase, y verificar que los solapamientos con turnos no se evalúan en este módulo

## 4. API REST y contrato para C-05

- [x] 4.1 Escribir primero un test de API fallido para `GET/PATCH /api/disponibilidad/configuracion`: caso happy con valor inicial 10 y actualización a 25, y edge con -1, 31 y no entero rechazados con 400 sin cambiar la configuración; verificar fallo previo
- [x] 4.2 Implementar el controlador, DTO y caso de uso mínimos de configuración hasta que 4.1 pase, y verificar que la respuesta no expone secretos ni un offset fijo
- [x] 4.3 Escribir primero un test de API fallido para `GET/PUT /api/disponibilidad/semanales`: caso happy con reemplazo válido de dos tramos y edge con reemplazo solapado que responde 400 y conserva el conjunto anterior; verificar fallo previo
- [x] 4.4 Implementar el reemplazo atómico mínimo hasta que 4.3 pase, y verificar contra MariaDB real que una validación fallida no deja tramos parciales
- [x] 4.5 Escribir primero tests de API fallidos para `GET/POST /api/disponibilidad/excepciones`: caso happy con feriado de día completo y bloqueo parcial, y edge con motivo vacío, rango invertido, `tipo: "HABILITACION"` e id inexistente devolviendo los códigos del spec; verificar fallo previo
- [x] 4.6 Implementar el alta y validación mínima de excepciones hasta que 4.5 pase, y verificar que la fecha se interpreta en calendario local del consultorio
- [x] 4.7 Escribir primero un test de API fallido para cancelación lógica: caso happy con desactivación que oculta la excepción de la lista activa, y edge con reactivación que conserva motivo y fecha originales y con consulta por id inexistente; verificar fallo previo
- [x] 4.8 Implementar `PATCH /api/disponibilidad/excepciones/:id` mínimo hasta que 4.7 pase, y verificar que no existe borrado físico
- [x] 4.9 Escribir primero un test de API fallido para `POST /api/disponibilidad/evaluacion`: caso happy con `DISPONIBLE` y edge con `FUERA_DE_DISPONIBILIDAD`, `EXCEPCION_BLOQUEANTE` y `DATOS_INVALIDOS`, comprobando el campo `requiereOverrideManual` y la ausencia de decisiones de solapamiento de turnos; verificar fallo previo
- [x] 4.10 Implementar el endpoint mínimo y exportar desde `AvailabilityModule` el puerto de evaluación para C-05 hasta que 4.9 pase, y verificar que el tipo de retorno es explícito y sin `any`
- [x] 4.11 Ejecutar la suite de integración C03 completa contra MariaDB real con dos escrituras concurrentes incompatibles de tramos y verificar que no ambas terminan con éxito; documentar el resultado

## 5. Feature React de horarios y excepciones

- [x] 5.1 Escribir primero un test de componente fallido para la edición de horarios semanales: caso happy con dos tramos enviados en un solo `PUT` y confirmación visible, y edge con `WEEKLY_SLOT_OVERLAP` devuelto mostrando día/conflicto y conservando los valores; verificar fallo previo
- [x] 5.2 Implementar el formulario, el cliente HTTP y el estado mínimos hasta que 5.1 pase, y verificar que no se calcula solapamiento en React
- [x] 5.3 Escribir primero un test de componente fallido para excepciones: caso happy con feriado de día completo y bloqueo parcial, y edge con motivo vacío que no envía la solicitud y con error del backend que conserva los datos; verificar fallo previo
- [x] 5.4 Implementar el formulario de excepciones mínimo hasta que 5.3 pase, y verificar que la cancelación envía la petición de baja lógica
- [x] 5.5 Escribir primero tests fallidos de estados y accesibilidad: caso happy con estado vacío y etiquetas visibles, y edge con guardado en curso deshabilitado, error de red reintentable y foco accesible; verificar fallo previo
- [x] 5.6 Implementar los estados mínimos con tokens del design system revisión 1 hasta que 5.5 pase, y verificar que no se definieron colores ni radios propios contradictorios
- [x] 5.7 Realizar revisión visual manual de la pantalla de horarios y de excepciones en 390x844 y 1440x900 sin Playwright, y verificar que se registraron en `verification.md` las pantallas y viewports revisados y los tokens aplicados

## 6. Verificación final y cierre local

- [x] 6.1 Ejecutar `npm test`, `npm run build` y `npm run lint` en `backend/` y en `frontend/`, y verificar que pasan sin errores de TypeScript, sin `any` añadido y sin artefactos generados versionados
- [x] 6.2 Ejecutar el control local de scope del change y verificar que el diff toca solo `backend/src/modules/availability/**`, `frontend/src/features/availability/**`, una migración nueva `C03` y el directorio propio del change
- [x] 6.3 Completar `verification.md` con evidencia de tests unitarios, integración MariaDB, API, componentes y revisión visual manual, separando explícitamente la verificación local del estado observado en `CHANGES.md`, que permanece pendiente hasta la integración de Pablo; verificar que no se editó `CHANGES.md` ni `openspec/specs/**`
- [x] 6.4 Verificar con `openspec validate --change c-03-availability-and-schedule-settings` que el change sigue siendo válido tras la implementación y que todas las tareas reflejan únicamente trabajo realmente completado

## Workflow follow-up

- Pablo integra la rama en `main` y ejecuta `openspec sync-specs` y `openspec archive` en su turno; este change no los ejecuta desde su branch.
- C-05 consume el puerto de evaluación y confirma que `FUERA_DE_DISPONIBILIDAD` es el único resultado que habilita override manual con motivo.
