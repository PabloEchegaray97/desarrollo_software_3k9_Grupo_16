# Tasks

## 1. Contrato de errores compartido

- [x] 1.1 Ampliar `api-exception.filter.spec.ts` con casos de código de dominio y detalles objeto válidos, código inválido y detalles no admitidos; verificar que las pruebas nuevas fallen contra la implementación actual sin exponer secretos ni datos personales.
- [x] 1.2 Implementar en `api-exception.filter.ts` la validación cerrada de `code` y `details`, conservando el fallback existente; verificar con la spec dirigida y con `npm test -- --runTestsByPath src/shared/http/api-exception.filter.spec.ts`.

## 2. Harness MariaDB aislado

- [x] 2.1 Crear `backend/test/run-integration-tests.mjs` con descubrimiento determinista en `test/` y `src/`, un proceso Jest por archivo y propagación de fallos; agregar pruebas Node del descubrimiento, orden, ausencia de suites y argumentos del subproceso, y verificarlas con `node --test test/run-integration-tests.test.mjs`.
- [x] 2.2 Ampliar `jest.integration.config.cjs` para reconocer suites modulares y reemplazar `test:integration` en `backend/package.json` por el runner sin agregar dependencias; verificar que el runner liste/invoque todos los archivos `*.integration-spec.ts` existentes exactamente una vez.
- [x] 2.3 Ajustar `database.integration-spec.ts` para ejecutar migraciones pendientes y verificar el artefacto de C-01 sin `undoLastMigration()` global; verificar por prueba dirigida que no se revierte la migración más reciente de otro change.
- [x] 2.4 Adaptar los contextos y helpers HTTP de las suites C-02/C-03 para crear una sesión mediante `authenticatedCookie(dataSource)` y adjuntarla a las requests protegidas, sin desactivar el guard; verificar Availability, Catálogos y Pacientes por separado contra MariaDB real.
- [x] 2.5 Reemplazar en Patients el `undoLastMigration()` global por una comprobación no destructiva del registro de C-02, sus tres tablas y la permanencia de C-04; verificar la suite Patients completa contra MariaDB real.
- [x] 2.6 Ejecutar `npm run test:integration` contra la MariaDB real configurada; registrar en `verification.md` versión del servidor, suites descubiertas, comando, totales y resultado, sin sustituir el motor ni incluir credenciales.

## 3. Guard de scope multiplataforma

- [x] 3.1 Agregar a `check.test.mjs` una prueba de subproceso que invoque realmente `check.mjs` y compruebe el fallo diagnosticable de un branch desconocido; verificar que reproduce la regresión antes del parche.
- [x] 3.2 Cambiar la detección de entrypoint a `path.resolve` + `pathToFileURL` y verificar con `node --test scripts/change-scope/check.test.mjs` y una invocación directa válida e inválida desde la raíz.

## 4. Verificación del seguimiento correctivo

- [x] 4.1 Ejecutar build, unitarias y lint relevantes del backend; registrar comandos y resultados en `verification.md`, diferenciando cualquier fallo preexistente de una regresión del change.
- [x] 4.2 Ejecutar `node scripts/change-scope/check.mjs --branch change/c-01-foundation-and-contracts --base main` y `openspec validate c-01-post-integration-corrections --strict`; registrar resultados y confirmar que el diff permanece dentro de los paths previstos.
- [x] 4.3 Completar `verification.md` con el commit base `8a97930`, archivos modificados, evidencia automática, comprobaciones no realizadas y las instrucciones exactas para que C-02/C-04 retomen sus tareas bloqueadas.

## Workflow follow-up

- Commit, push y pull request del seguimiento C-01 requieren autorización explícita de Pablo.
- Después de integrar esta rama en `main`, C-02 y C-04 deben incorporar el commit, completar sus verificaciones MariaDB/manuales y actualizar sus propios artefactos OpenSpec.
- Pablo sincroniza y archiva C-01, C-02 y C-04 secuencialmente en `main` solo cuando cada change esté completamente verificado.
