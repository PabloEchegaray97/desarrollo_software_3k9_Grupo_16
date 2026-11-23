# Verification — C-04 authentication-and-app-shell

Rama: `change/c-04-authentication-and-app-shell` (base `main` en `9ba7e34`). Fecha: 2026-11-23.

## Entorno de verificación automática

Las suites se ejecutaron en Linux (Node 22) sobre una copia del árbol con `npm ci` propio, para no alterar `node_modules` ni lockfiles del repositorio. Los lockfiles no se modificaron.

## Backend

| Comando | Resultado |
|---|---|
| `npm run build` | OK |
| `npm test` | 19 suites, 167 tests OK (8 suites de `auth`, 48 tests) |
| `npm run test:e2e` | 1 test OK — `/api/health` sigue respondiendo 503 sin sesión con la base caída |
| `npm run lint` (`oxlint --type-aware src/ test/`) | 0 warnings, 0 errores |
| `tsc --noEmit -p tsconfig.json` | sin errores en archivos de C-04 (los 3 errores existentes son de specs de C-01: `health.service.spec.ts`, `request-id.middleware.spec.ts`) |
| `dist/modules/auth/testing` | no existe: el soporte de pruebas queda fuera del build |

## Frontend

| Comando | Resultado |
|---|---|
| `npm run build` (`tsc -b && vite build`) | OK |
| `npm test` (`vitest run`) | 8 archivos, 52 tests OK (`auth.test.tsx` 13, `AppShell.test.tsx` 6) |
| `oxlint src` | 0 warnings, 0 errores |

## MariaDB real — pendiente

- `auth.integration-spec.ts` está escrito pero **no se ejecutó**: este entorno no tiene MariaDB ni `.env`, y `jest.integration.config.cjs` solo descubre `test/**` (CR-C04-02 / CR-02).
- Pendientes con MariaDB: tarea 1.1 (`up`/`down` de la migración C04), 3.4 (`npm run provision:admin` manual) y 4.2.
- No se usó otro motor como sustituto.

## Coordinación

- CR-C04-01 (harness de C-02 autenticado con `testing/session-test.support-spec.ts` → `authenticatedCookie(dataSource)`): pendiente de respuesta de Pablo.
- CR-C04-02 (descubrimiento de `src/**/*.integration-spec.ts`): pendiente; mismo pedido que CR-02 de C-02.

## Verificación visual manual — pendiente

Revisar sin Playwright `/acceso` (vacío, error genérico, envío en curso) y el shell (escritorio y menú móvil abierto, enlace activo, cerrar sesión) en 390×844 y 1440×900. Registrar aquí pantallas, viewports, foco, overflow y resultado.

## Scope y OpenSpec

- `openspec validate c-04-authentication-and-app-shell --strict`: válido.
- `node scripts/change-scope/check.mjs --branch change/c-04-authentication-and-app-shell --diff-file <cambios locales sin lockfiles>`: 0 violaciones (45 paths). Repetir sin `--diff-file` (`--base main`) después del commit.
- Archivos de otros owners modificados: ninguno. `package.json` y lockfiles sin cambios de contenido.
