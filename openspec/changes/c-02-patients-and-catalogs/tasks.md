# Tasks

## 0. Coordinación previa (fuera del ownership de C-02)

- [ ] 0.1 Enviar a Pablo los pedidos CR-01 (filtro global propaga `code`/`details` de `HttpException`) y CR-02 (`jest.integration.config.cjs` descubre `src/**/*.integration-spec.ts`); registrar en `verification.md` la respuesta y, si se aprueban, el commit de `main` que los integra. No editar esos archivos desde esta rama.
- [ ] 0.2 Cuando CR-01/CR-02 estén en `main`, actualizar la rama desde `main` sin perder trabajo local y verificar con `git log` que ambos cambios están presentes antes de ejecutar los grupos 4.4 y 6.

## 1. Persistencia

- [ ] 1.1 Agregar `backend/src/database/migrations/<timestamp>-C02-CreatePatientsAndCatalogs.ts` con `patients`, `procedures` y `chairs`, `active` por defecto `TRUE`, `UNIQUE(dni)`, `UNIQUE(name)` en catálogos, índices de búsqueda y `CHECK` de rangos; verificar con `npm run build` y ejecutando `up`/`down` contra MariaDB real de pruebas.
- [ ] 1.2 Crear las entidades `patient.entity.ts`, `procedure.entity.ts` y `chair.entity.ts` con mapeo de columnas `snake_case` a propiedades tipadas, sin `synchronize`; verificar con `npm run build` y `npm run lint` que no hay `any` ni términos prohibidos por `architecture-boundaries.spec.ts`.

## 2. Catálogos backend (prestaciones y sillones)

- [ ] 2.1 Implementar normalización de nombres y DTO de prestación/sillón con `class-validator` (duración entera `1..240`, intervalo entero `0..30` o `null`, paginación `page>=1`, `pageSize 1..100`); verificar con tests unitarios de límites 0/1/240/241 y -1/0/30/31.
- [ ] 2.2 Implementar `ProceduresService`/`ChairsService` con alta, edición `PUT`, detalle, listado paginado ordenado por nombre con `q` e `incluirInactivos`, cambio de estado y traducción de `ER_DUP_ENTRY` a `*_NAME_CONFLICT`; verificar con tests unitarios usando repositorio simulado.
- [ ] 2.3 Implementar `ProceduresController` y `ChairsController` en `/prestaciones` y `/sillones` con `ParseUUIDPipe`, errores `*_NOT_FOUND` y sin `DELETE`; verificar con test unitario del controlador y `npm run build`.
- [ ] 2.4 Implementar y exportar `CatalogReferences` (`findProcedureById`, `findChairById`, con `EntityManager` opcional) desde `CatalogsModule`; verificar con test unitario que devuelve `activo`, duración e intervalo posiblemente `null`, y `null` para ids inexistentes.

## 3. Pacientes backend

- [ ] 3.1 Implementar normalización de pacientes (espacios, email vacío → `null` y minúsculas, `phone_digits`, DNI sin `.`/espacios/`-`) y DTO con teléfono de 6–20 dígitos y DNI de 7–8 dígitos; verificar con tests unitarios de cada regla y de los casos inválidos de la spec.
- [ ] 3.2 Implementar en `PatientsService` alta y edición con detección de posible duplicado (mismo nombre case-insensitive y `phone_digits`, excluyendo el propio registro, solo si cambian nombre/teléfono en edición) y `409 PATIENT_POSSIBLE_DUPLICATE` con candidatos `{ id, nombre, activo }` salvo `confirmarPosibleDuplicado: true`; verificar con tests unitarios de coincidencia, confirmación, teléfono compartido y edición sin cambios.
- [ ] 3.3 Implementar en `PatientsService` la traducción de `ER_DUP_ENTRY` a `PATIENT_DNI_CONFLICT`, búsqueda paginada por nombre/teléfono/DNI con escape de `%` y `_`, detalle y cambio de estado; verificar con tests unitarios de búsqueda, escape y mapeo de errores.
- [ ] 3.4 Implementar `PatientsController` en `/pacientes` (GET lista, GET `:id`, POST, PUT `:id`, PATCH `:id/estado`, sin `DELETE`) y exportar `PatientReferences.findById` desde `PatientsModule`; verificar con tests unitarios y `npm run build`.
- [ ] 3.5 Verificar que ningún log de los módulos incluye nombre, teléfono, DNI ni email revisando los `Logger` agregados y ejecutando `npm test` completo del backend sin fallos.

## 4. Verificación backend con MariaDB real

- [ ] 4.1 Crear fixtures ficticios compartidos por los tests de C-02 ("Paciente Ficticio N", `11 5555-00NN`, DNI `3000000N`, `@example.test`); verificar por revisión que no hay datos reales.
- [ ] 4.2 Escribir `catalogs.integration-spec.ts` con Supertest sobre `AppModule` y MariaDB real: límites de duración/intervalo, nombre repetido activo e inactivo, listado solo activos, desactivar/reactivar y catálogo vacío.
- [ ] 4.3 Escribir `patients.integration-spec.ts`: alta mínima, DNI repetido con formato distinto, varios DNI `NULL`, edición que repite DNI, dos altas concurrentes con el mismo DNI (exactamente una 201), advertencia y confirmación de duplicado, búsqueda por nombre/teléfono/DNI, paginación inválida, inactivos ocultos y `DELETE` inexistente.
- [ ] 4.4 Con CR-01 y CR-02 integrados, ejecutar `npm run test:integration` contra MariaDB real y registrar en `verification.md` versión de MariaDB, comando y resultado; si falta alguno, registrar la tarea como bloqueada sin usar otro motor.

## 5. Frontend

- [ ] 5.1 Crear `features/catalog/ui/AdminModal.tsx` con `<dialog>` nativo y `ui/fields.tsx` (label arriba, ayuda, error debajo) según `design-system/component-contract.md`; verificar con Vitest apertura, cierre con `X`/`Esc` y asociación accesible de errores.
- [ ] 5.2 Implementar `features/catalog/api.ts` y `types.ts` tipados sobre `apiRequest`, y `CatalogPage` con secciones Prestaciones/Sillones en `?seccion=`, listado, búsqueda, alta, edición, desactivar/reactivar, estados carga/vacío/error e indicación "usa intervalo global"; verificar con tests de componentes de cambio de sección, estado vacío y error de rango por campo.
- [ ] 5.3 Implementar `features/patients/api.ts`, `types.ts` y `PatientsPage` con búsqueda con debounce, paginación anterior/siguiente, alta/edición en modal, desactivar/reactivar y estados carga/vacío/error; verificar con tests de componentes del listado y del estado vacío.
- [ ] 5.4 Implementar `DuplicateWarning` y el mapeo de `PATIENT_DNI_CONFLICT`/`VALIDATION_ERROR` a campos; verificar con tests que continuar reenvía con `confirmarPosibleDuplicado: true`, cancelar conserva el formulario y el DNI repetido se muestra junto al campo.
- [ ] 5.5 Ejecutar `npm run build`, `npm test` y `npm run lint` en `frontend/` sin errores ni `any`.

## 6. Verificación integral

- [ ] 6.1 Con backend y MariaDB de desarrollo en ejecución, recorrer manualmente alta de prestación, sillón y paciente (incluida la advertencia de duplicado) desde la interfaz, y revisar `/pacientes` y `/prestaciones` (ambas secciones, modal abierto) en 390×844 y 1440×900 sin Playwright; registrar pantallas, viewports, foco, overflow y resultado en `verification.md`.
- [ ] 6.2 Ejecutar `node scripts/change-scope/check.mjs` contra `main` desde `change/c-02-patients-and-catalogs` y verificar que no hay paths fuera del ownership; ejecutar `npx @fission-ai/openspec@2.1.1 validate c-02-patients-and-catalogs --strict` sin errores.

## Workflow follow-up

- Commit, push y apertura del pull request `[C-02] patients-and-catalogs` solo por pedido explícito de Paula.
- Pablo revisa, integra en `main` y ejecuta `openspec-sync-specs` y `openspec-archive-change`; no se ejecutan desde esta rama.
- Marcar C-02 en `CHANGES.md` corresponde a la integración, no a esta rama.
