# Verificación — seguimiento correctivo C-01

## Contexto

- Rama: `change/c-01-foundation-and-contracts`
- Commit base: `8a97930f49dc15d0968b937c5c224531216ef398`
- Motor de integración: MariaDB real `12.3.3-MariaDB`
- Datos: fixtures y cuenta exclusivamente ficticios; no se registraron credenciales ni payloads personales.
- UI: no aplica; el change no modifica pantallas y no se utilizó Playwright.

## Evidencia por bloque

### Contrato HTTP

- Comando: `npm test -- --runTestsByPath src/shared/http/api-exception.filter.spec.ts`
- Resultado: PASS, 1 suite, 5/5 pruebas.
- Cobertura funcional: código de dominio válido, detalles objeto, fallback ante código inválido, omisión de detalles no admitidos y error interno seguro.

### Runner de integración

- Comando: `node --test test/run-integration-tests.test.mjs`
- Resultado: PASS, 5/5 pruebas Node.
- Descubrimiento: 5 archivos `*.integration-spec.ts`, sin duplicados y en orden estable.
- Aislamiento: un proceso Jest por archivo, ejecución serial y propagación del primer código no cero.

### MariaDB real

- Comando: `npm run test:integration`
- Resultado global: PASS, 5/5 suites, 71/71 pruebas.
- Auth: 12/12.
- Availability: 21/21.
- Catálogos: 18/18.
- Pacientes: 18/18.
- Runtime/migraciones C-01: 2/2.
- Las suites C-02/C-03 usan una sesión ficticia válida sin desactivar el guard.
- Las comprobaciones C-01/C-02 verifican el esquema acumulado y no ejecutan `undoLastMigration()` sobre migraciones posteriores.

### Guard de scope

- Comando: `node --test scripts/change-scope/check.test.mjs`
- Resultado: PASS, 6/6 pruebas, incluida invocación real en subproceso.
- Rama válida C-01: código 0 y mensaje `Scope check passed`.
- Rama desconocida: código 1 y diagnóstico `Unknown or unauthorized change branch`.
- La entrada usa `path.resolve` + `pathToFileURL`; no construye manualmente URLs `file:///` dependientes de plataforma.

### Backend estático y unitario

- `npm run build`: PASS.
- `npm test`: PASS, 20/20 suites y 190/190 pruebas.
- `npm run lint`: PASS, sin errores ni advertencias después de corregir los promises de `node:test`.
- No se aceptaron fallos preexistentes ni regresiones en este bloque.

### OpenSpec y scope final

- `node scripts/change-scope/check.mjs --branch change/c-01-foundation-and-contracts --base main`: PASS.
- Auditoría adicional del working tree, incluidos archivos no committeados y nuevos: PASS, 19 paths dentro de la política C-01.
- `openspec validate c-01-foundation-and-contracts --strict`: PASS; `skip_specs` aceptado porque no cambian requisitos canónicos.
- `git diff --check`: PASS.

## Inventario del change

- `backend/package.json`
- `backend/src/shared/http/api-exception.filter.ts`
- `backend/src/shared/http/api-exception.filter.spec.ts`
- `backend/test/jest.integration.config.cjs`
- `backend/test/database.integration-spec.ts`
- `backend/test/run-integration-tests.mjs`
- `backend/test/run-integration-tests.test.mjs`
- `backend/src/modules/catalogs/testing/integration-harness.support-spec.ts`
- `backend/src/modules/catalogs/catalogs.integration-spec.ts`
- `backend/src/modules/patients/patients.integration-spec.ts`
- `backend/src/modules/availability/testing/api-harness.support-spec.ts`
- `backend/src/modules/availability/availability.integration-spec.ts`
- `scripts/change-scope/check.mjs`
- `scripts/change-scope/check.test.mjs`
- `openspec/changes/c-01-foundation-and-contracts/**`

## Comprobaciones no realizadas

- No se ejecutó GitHub Actions sobre Linux; la regresión quedó cubierta mediante APIs de rutas multiplataforma y una prueba que invoca el archivo como subproceso.
- No se hizo revisión visual: C-01 no modifica UI. Las revisiones manuales de C-02/C-04 siguen pendientes y no deben usar Playwright.
- No se hizo commit, push, pull request, merge, sync ni archive; requieren el flujo y autorización correspondientes.

## Reanudación exacta de C-02

Después de integrar el commit correctivo C-01 en `main`:

1. Registrar en `openspec/changes/c-02-patients-and-catalogs/verification.md` el hash de C-01 como respuesta aprobada a CR-01/CR-02/CR-C04-01.
2. Marcar 0.1/0.2 y 4.4 con la evidencia heredada: MariaDB `12.3.3`, `npm run test:integration`, 5/5 suites y 71/71 pruebas; Catálogos 18/18 y Pacientes 18/18.
3. Ejecutar manualmente 6.1 con backend/frontend/MariaDB: alta de prestación, sillón y paciente, advertencia de duplicado, `/pacientes`, `/prestaciones`, ambas secciones y modal abierto en 390×844 y 1440×900; registrar foco, overflow y resultado, sin Playwright.
4. Ejecutar `node scripts/change-scope/check.mjs --branch change/c-02-patients-and-catalogs --base main` según el estado final de la rama y `openspec validate c-02-patients-and-catalogs --strict`; registrar y marcar 6.2 solo si ambos pasan.

## Reanudación exacta de C-04

Después de integrar el commit correctivo C-01 en `main`:

1. Registrar en `openspec/changes/c-04-authentication-and-app-shell/verification.md` el hash de C-01 como respuesta aprobada a CR-C04-01/CR-C04-02.
2. Marcar 0.1/0.2 y 4.2 con la evidencia heredada: MariaDB `12.3.3`, `npm run test:integration`, Auth 12/12 y total 71/71.
3. Para 1.1, conservar la evidencia de migración aplicada pero ejecutar `down/up` de C-04 en una base aislada antes de marcarla; no usar `undoLastMigration()` sobre el esquema acumulado.
4. Para 3.4, ejecutar `npm run provision:admin` dos veces con la cuenta ficticia configurada y comprobar idempotencia sin imprimir valores; la suite Auth ya cubre el aprovisionamiento idempotente automáticamente.
5. Ejecutar manualmente 6.1: acceso inválido/válido, navegación protegida, recarga con sesión y logout; revisar `/acceso` y shell en 390×844 y 1440×900, foco y overflow, sin Playwright.

## Pendiente fuera del Apply

- Revisión humana del diff C-01.
- Commit, push y pull request solo con autorización explícita de Pablo.
- Integración en `main`; luego cierre verificable de C-02/C-04 y sync/archive secuencial por Pablo.
