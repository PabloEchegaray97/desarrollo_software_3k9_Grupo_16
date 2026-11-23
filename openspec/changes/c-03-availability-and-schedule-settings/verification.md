# Verificación local — C-03 (lotes API y UI)

Fecha: 2026-11-23. Rama: `change/c-03-availability-and-schedule-settings`.
Estado: lotes API (4.1–4.11) y UI (5.1–5.6, 6.1–6.2) implementados con **deuda documentada**
por CR-01, CR-02, el guard de arquitectura y la zona del `DataSource`. No se editaron
archivos compartidos. Las secciones 1–5 corresponden al lote API; las secciones 6–10
registran el lote UI y el cierre local.

## 1. Safety net (8 verificaciones)

| # | Comando | Inicial | Final |
|---|---|---|---|
| 1 | `backend: npm test` | 13/13 suites, 141/141 tests | 13/13 suites, 141/141 tests |
| 2 | `backend: npm run test:integration` | 1/1 suite, 2/2 tests (C-01) | 1/1 suite, 2/2 tests (C-01) |
| 3 | C03 explícito (ver §2) | 1/1 suite, 5/5 tests | 1/1 suite, **21/21** tests |
| 4 | `frontend: npm test` | 6/6 archivos, 33/33 tests | 6/6 archivos, 33/33 tests |
| 5 | `backend: npm run build` | `EXITCODE=0` | `EXITCODE=0` |
| 6 | `frontend: npm run build` | `EXITCODE=0` | `EXITCODE=0` |
| 7 | `backend: npm run lint` | `EXITCODE=0` | `EXITCODE=0` (sin warnings tras limpieza) |
| 8 | `frontend: npm run lint` | `EXITCODE=0` | `EXITCODE=0` |

Comando exacto de la verificación 3 (CR-02, sin tocar la config compartida):

```bash
cd backend
node --experimental-vm-modules ./node_modules/jest/bin/jest.js \
  --config test/jest.integration.config.cjs \
  --testMatch "<rootDir>/src/modules/availability/**/*.integration-spec.ts" \
  --runInBand
```

Resultado final: `PASS src/modules/availability/availability.integration-spec.ts`,
`Test Suites: 1 passed, 1 total`, `Tests: 21 passed, 21 total`, `EXITCODE=0`.

## 2. Evidencia Strict TDD por tarea

Todas las pruebas viven en `backend/src/modules/availability/availability.integration-spec.ts`
(una sola suite para evitar el fallo de múltiples suites con `--experimental-vm-modules`).
El harness propio es `backend/src/modules/availability/testing/api-harness.support-spec.ts`.

| Tarea | Capa | RED ejecutado | GREEN | TRIANGULATE (casos) | REFACTOR |
|---|---|---|---|---|---|
| 4.1 | API/MariaDB | 3 fallidos, 5 verdes (8 total): 404 en GET/PATCH | 8/8 | 3 casos: inicial 10 + PATCH 25; -1/31/10,5 sin cambio; zona horaria rechazada | 8/8 |
| 4.2 | DTO + servicio + controlador | (mismo RED que 4.1) | 8/8 | respuesta `toEqual` exacta: sin secretos ni offset | 8/8 |
| 4.3 | API/MariaDB | 3 fallidos, 8 omitidos (11 total): 404 en GET/PUT | 11/11 | 3 casos: dos tramos; incompatibles sin parciales; contiguos + invertidos + día 0/8 | 11/11 |
| 4.4 | Transacción + validación | (mismo RED que 4.3) | 11/11 | MariaDB: `COUNT(*)` del conjunto anterior = 1 tras rechazo | 11/11 |
| 4.5 | API/MariaDB | 3 fallidos, 11 omitidos (14 total): 404 en POST/GET | 14/14 | 3 casos: día completo + parcial con UTC; motivo/rango/tipo inválidos; 404 e IANA sin offset | 14/14 |
| 4.6 | Servicio + conversión UTC | (mismo RED que 4.5) | 14/14 | `11:00` local → `14:00Z`; `DATE_FORMAT` evita el desplazamiento del driver | 14/14 |
| 4.7 | API/MariaDB | 2 fallidos, 14 omitidos (16 total): 404 en PATCH | 16/16 | 2 casos: baja oculta de la lista activa; reactivación sin borrado + 404 | 16/16 |
| 4.8 | Baja lógica | (mismo RED que 4.7) | 16/16 | `COUNT(*)` = 1 tras reactivar; motivo/fecha originales intactos | 16/16 |
| 4.9 | API/MariaDB | 3 fallidos, 16 omitidos (19 total): 404 en POST | 19/19 | 3 casos: DISPONIBLE + FUERA; excepción total/parcial; DATOS_INVALIDOS + intervalo informativo | 19/19 |
| 4.10 | Evaluación + puerto | (mismo RED que 4.9) | 19/19 | claves exactas de la respuesta; `app.get(AVAILABILITY_EVALUATION_PORT)` tipado | 19/19 |
| 4.11 | Concurrencia MariaDB | 2 fallidos, 19 omitidos (21 total): ambas escrituras 200 | 21/21 | 2 casos: dos PUT concurrentes con la misma versión → `[200, 409]`; versión obsoleta 409 y vigente 200 | 21/21 |

No se marcaron tareas 5.x ni 6.x. `openspec instructions apply --change
c-03-availability-and-schedule-settings --json` reporta `total: 38, complete: 27,
remaining: 11`.

## 3. Deuda documentada (sin afirmar propagación)

| Escenario del spec | Código esperado | Código interno usado | Código observado en HTTP hoy |
|---|---|---|---|
| Tramos del mismo día con rangos incompatibles | `WEEKLY_SLOT_OVERLAP` | `RANGOS_INCOMPATIBLES` | `VALIDATION_ERROR`, 400 |
| Excepción inexistente (GET/PATCH) | `EXCEPTION_NOT_FOUND` | `EXCEPCION_NO_ENCONTRADA` | `HTTP_404`, 404 |
| Motivo vacío / rango invertido / `HABILITACION` / zona distinta | `VALIDATION_ERROR` | `VALIDATION_ERROR` | `VALIDATION_ERROR`, 400 |
| Escritura con versión obsoleta | (no especificado; mecanismo de 4.11) | `VERSION_CONFLICT` | `HTTP_409`, 409 |

**No se afirma que los códigos del spec ya se propaguen al cliente.** Los tests de API
afirman únicamente el estado HTTP y la forma del contrato común (`error.requestId` y
`error.message` como strings). El mapeo final queda pendiente de CR-01 en `main`.

### CR-01 — filtro global (fuera de ownership)

`backend/src/shared/http/api-exception.filter.ts` aplana cualquier código a
`VALIDATION_ERROR` (400) o `HTTP_<status>` (resto). No se editó. Los códigos internos
`RANGOS_INCOMPATIBLES` y `EXCEPCION_NO_ENCONTRADA` viven en
`backend/src/modules/availability/availability-errors.ts` y son estables para cuando
Pablo integre CR-01.

### Guard de arquitectura (fuera de ownership)

`backend/src/shared/database/architecture-boundaries.spec.ts` recorre los `.ts` que no
terminan en `.spec.ts` y falla con `overlap`/`solapamiento`. No se editó. Ningún archivo
de producción ni de soporte de C-03 contiene esas literales: se usan `RANGOS_INCOMPATIBLES`
y terminología neutra. La verificación 1 (`npm test`, 141/141) incluye este guard en verde.

### CR-02 — descubrimiento de suites (fuera de ownership)

`backend/test/jest.integration.config.cjs` solo descubre `test/**/*.integration-spec.ts`.
No se editó. La suite C03 se ejecuta con el `--testMatch` explícito de §1;
`npm run test:integration` sigue cubriendo únicamente C-01.

### Zona del DataSource (fuera de ownership)

`backend/src/database/data-source.ts` no fija `timezone: 'Z'` y no se editó. En producción,
mysql2 puede interpretar `DATETIME` con la zona del proceso. Este módulo mitiga el riesgo
**dentro de su ownership**:

- `fecha` se lee con `DATE_FORMAT(fecha, '%Y-%m-%d')` y los tiempos con `TIME_FORMAT`,
  evitando la conversión del driver a instantes locales;
- `inicioUtc`/`finUtc` se calculan con `horaLocalAUtc` + `America/Argentina/Buenos_Aires`
  desde la hora civil, y se persisten como `DATETIME` en UTC;
- la configuración publica solo la zona IANA, nunca `-03:00`.

En las pruebas se usa una fuente de datos propia con `timezone: 'Z'` y el proveedor
`DataSource` se sobrescribe solo dentro del `Test.createTestingModule` del harness; el
código de aplicación permanece intacto.

## 4. Verificación local vs. estado del roadmap

Todo lo aquí registrado es **verificación local en la rama del change**. `CHANGES.md`,
`AGENTS.md`, `openspec/specs/**`, `openspec/changes/archive/**`, `package.json`, lockfiles,
configs raíz y `backend/.env` no se editaron. El estado observado en `CHANGES.md` sigue
pendiente hasta que Pablo integre la rama y ejecute sync/archive en `main`; desde esta
rama no se ejecutaron `openspec validate`, `sync-specs` ni `archive`, y no se hicieron
commit, push ni merge.

## 5. Superficie tocada

Paths nuevos o modificados, todos dentro del ownership autorizado:

- `backend/src/modules/availability/**` (controlador, servicio, DTOs, errores, constantes,
  puerto, harness y suite de integración);
- `openspec/changes/c-03-availability-and-schedule-settings/tasks.md`,
  `coordination.md`, `verification.md`;
- la migración `2026112500000-C03-CreateAvailability.ts` ya existente **no fue modificada**
  en este lote.

`git status --porcelain=v1 -b` al cierre del lote API (histórico, antes del lote UI):

```text
## change/c-03-availability-and-schedule-settings
 M backend/src/modules/availability/availability.module.ts
?? backend/src/database/migrations/2026112500000-C03-CreateAvailability.ts
?? backend/src/modules/availability/availability-errors.ts
?? backend/src/modules/availability/availability.constants.ts
?? backend/src/modules/availability/availability.controller.ts
?? backend/src/modules/availability/availability.integration-spec.ts
?? backend/src/modules/availability/availability.port.ts
?? backend/src/modules/availability/availability.service.ts
?? backend/src/modules/availability/domain/
?? backend/src/modules/availability/dto/
?? backend/src/modules/availability/entities/
?? backend/src/modules/availability/testing/
?? openspec/changes/c-03-availability-and-schedule-settings/
```

El estado final del lote UI está en §10. En ese momento, `git diff --name-only` contenía
únicamente `backend/src/modules/availability/availability.module.ts`;
`git diff --cached --name-only` está vacío. No aparecen `api-exception.filter.ts`,
`architecture-boundaries.spec.ts`, `data-source.ts`, `app.module.ts`, migraciones C01/C02,
configs raíz, `package.json`, lockfiles, `CHANGES.md`, `AGENTS.md`, `openspec/specs/**`,
archive, otros changes ni `dist/`/`coverage/`. `backend/.env` es gitignored y no fue leído,
impreso ni modificado.

## 6. Safety net final — lote UI (tareas 5.1–5.6, 6.1, 6.2)

| # | Comando | Inicial | Final |
|---|---------|---------|-------|
| 1 | `backend: npm test` | 13/13 suites, 141/141 tests | 13/13 suites, 141/141 tests |
| 2 | `backend: npm run test:integration` | 1/1 suite, 2/2 tests (C-01) | 1/1 suite, 2/2 tests (C-01) |
| 3 | C03 explícito (comando de §1) | 1/1 suite, 21/21 tests | 1/1 suite, **21/21** tests |
| 4 | `frontend: npm test` | 6/6 archivos, 33/33 tests | **11/11 archivos, 53/53 tests** (20 nuevos de `availability`) |
| 5 | `backend: npm run build` | `EXITCODE=0` | `EXITCODE=0` |
| 6 | `frontend: npm run build` | `EXITCODE=0` | `EXITCODE=0` |
| 7 | `backend: npm run lint` | `EXITCODE=0` | `EXITCODE=0` |
| 8 | `frontend: npm run lint` | `EXITCODE=0` | `EXITCODE=0` |

Nota de ejecución: la primera pasada paralela de las verificaciones 2 y 3 compartió MariaDB
y la suite C03 registró 4 fallos / 17 verdes por contención de base. Al re-ejecutarla sola,
en serie, quedó `PASS ... 21 passed, 21 total, EXITCODE=0`. No se modificó código ni
configuración por ese evento; es una condición de ejecución del entorno local.

## 7. Evidencia Strict TDD — lote UI

Los tests viven en `frontend/src/features/availability/**`. La configuración compartida no
habilita `globals`, por eso cada suite llama `afterEach(() => cleanup())`.

| Tarea | Test file | Capa | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 5.1 | `weekly-schedule.test.tsx` | Componente (Vitest + RTL) | 8/8 verde | 3/3 fallidos (`Agregar primer tramo` y `09:00` ausentes) | 3/3 | +1 caso “quitar tramo” → 4/4 | `performSave` extraído → 4/4 |
| 5.2 | `weekly-schedule.test.tsx` | Cliente HTTP + estado | 8/8 verde | mismo RED de 5.1 | 3/3 | 4/4 | 4/4 |
| 5.3 | `exceptions.test.tsx` | Componente (Vitest + RTL) | 8/8 verde | 5/5 fallidos (lista vacía/`Feriado ficticio` ausente) | 5/5 | +1 caso “fallo de baja” → 6/6 | `FeedbackPanel` compartido → 6/6 |
| 5.4 | `exceptions.test.tsx` | Cliente HTTP + baja lógica | 8/8 verde | mismo RED de 5.3 | 5/5 | 6/6 | 6/6 |
| 5.5 | `states.test.tsx`, `ui/feedback.test.ts` | Estados + accesibilidad | 8/8 verde | 2/4 fallidos (`role=status` de carga y foco al reintentar) | 4/4 | +4 casos de mensajes por código → 8/8 | foco y `role=status` ajustados → 8/8 |
| 5.6 | `ui/tokens.test.ts` | CSS / tokens revisión 1 | 8/8 verde | 2/2 fallidos (`ENOENT` de `styles.css`) | 2/2 | +verificación de radios y tonos → 2/2 | sin `!important` → 2/2 |

La UI no calcula compatibilidad ni reacciona por códigos de dominio: `toFeedback` lee solo
el estado HTTP y `error.message`; los tests muestran el mismo mensaje para
`WEEKLY_SLOT_OVERLAP`, `VALIDATION_ERROR` y `HTTP_400`. Los errores de red usan un mensaje
fijo reintentable. La baja lógica envía `PATCH ... { "activo": false }`.

## 8. Cierre local 6.1 y 6.2

- `npx tsc -b` en `frontend/`: `TSC=0`.
- Búsqueda de `\bany\b` en `frontend/src/features/availability/**/*.{ts,tsx}`: sin coincidencias.
- Búsqueda de literales prohibidos (`solapamiento`, `overlap` en minúsculas) en la feature: sin coincidencias en producción; el único identificador de dominio aparece en un test (`WEEKLY_SLOT_OVERLAP`).
- Artefactos generados: `backend/dist/` y `frontend/dist/` figuran como ignorados (`!!`), no versionados; `coverage/` no aparece en `git status`.
- Control de scope existente: `scripts/change-scope/check.mjs` con policy C03 en `scripts/change-scope/scope-map.json`. No se modificó.
  - `node scripts/change-scope/check.mjs --branch change/c-03-availability-and-schedule-settings` → `Scope check passed ...`, `EXITCODE=0` (comparación `main...HEAD` sin commits propios: diff vacío).
  - Para cubrir los cambios sin commitear se generó un `--diff-file` temporal fuera del repo con `git diff --name-status main...HEAD` más `git status --porcelain=v1` (untracked → `A`). Resultado: `Scope check passed for change/c-03-availability-and-schedule-settings`, `EXITCODE=0`. Paths evaluados: solo `backend/src/modules/availability/**`, la migración `2026112500000-C03-CreateAvailability.ts` (`A`, con `C03` en el nombre), `frontend/src/features/availability/**` y el directorio propio del change.
- `openspec instructions apply --change c-03-availability-and-schedule-settings --json` previo al cierre: `total: 38, complete: 35, remaining: 3` (pendientes 5.7, 6.3, 6.4). Estado final: **38/38, remaining: 0** (§11).
- No se ejecutaron `sync-specs` ni `archive`; no se hicieron commit, push ni merge. La validación definitiva se ejecutó en esta rama y se registra en §11.

## 9. Revisión visual manual — completada por Milagros, 2026-11-23

La usuaria confirmó explícitamente la revisión: «¿Realizaste la revisión visual manual de
`/disponibilidad` en 390×844 y 1440×900 con el checklist anterior?» → «Sí, sin diferencias».
Sin Playwright (regla dura 9 del proyecto), la revisión fue **manual y humana**; este acta no
la simula ni la automate.

- **Pantallas revisadas:** horarios semanales y excepciones, ambas en `/disponibilidad`.
- **Viewports revisados:** `390x844` (móvil) y `1440x900` (escritorio).
- **Estados del checklist revisados:** normal; hover y `:focus-visible`; carga (`Cargando horarios…`, `Guardando horarios…`, `Cargando excepciones…`, `Guardando excepción…`); vacío (`Todavía no hay tramos definidos`, `No hay excepciones activas.`); error del backend; error de red con botón `Reintentar`; deshabilitado durante el guardado (botones y `fieldset`).
- **Accesibilidad incluida en la revisión:** foco visible al tabular y tras un error.
- **Consola y requests:** incluidos en la revisión de la usuaria. No se inventan conteos, capturas ni detalles que ella no aportó.
- **Tokens aplicados (revisión 1 aprobada):** `--color-surface`, `--color-surface-subtle`, `--color-surface-strong`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-primary-hover`, `--color-primary-pressed`, `--color-on-primary`, `--color-border`, `--color-border-strong`, `--color-danger`, `--color-danger-soft`, `--color-success`, `--color-success-soft`, `--focus-ring`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`, `--space-*`, `--font-sans`, `--font-size-*`, `--duration-fast`, `--ease-out`. El test `ui/tokens.test.ts` verifica que no hay colores hexadecimales, `rgb()` ni radios literales propios.
- **Comando del checklist para levantar el frontend:** `cd frontend && npm run dev` (abrir `http://localhost:5173/disponibilidad` o el puerto que indique Vite).
- **Resultado según la confirmación de Milagros:** **sin diferencias**.

Esta confirmación habilita el marcado de 5.7, 6.3 y 6.4. Todo lo registrado aquí es
**verificación local en la rama del change**; el estado observado en `CHANGES.md` permanece
pendiente hasta la integración de Pablo. Desde esta rama no se ejecutaron `sync-specs` ni
`archive`, y el agente no afirma haber abierto las pantallas por sí mismo.

## 10. Superficie final y estado de deudas

`git status --porcelain=v1 -b` final (exacto):

```text
## change/c-03-availability-and-schedule-settings
 M backend/src/modules/availability/availability.module.ts
 M frontend/src/features/availability/index.tsx
?? backend/src/database/migrations/2026112500000-C03-CreateAvailability.ts
?? backend/src/modules/availability/availability-errors.ts
?? backend/src/modules/availability/availability.constants.ts
?? backend/src/modules/availability/availability.controller.ts
?? backend/src/modules/availability/availability.integration-spec.ts
?? backend/src/modules/availability/availability.port.ts
?? backend/src/modules/availability/availability.service.ts
?? backend/src/modules/availability/domain/
?? backend/src/modules/availability/dto/
?? backend/src/modules/availability/entities/
?? backend/src/modules/availability/testing/
?? frontend/src/features/availability/api.ts
?? frontend/src/features/availability/exceptions.test.tsx
?? frontend/src/features/availability/node-test-shims.d.ts
?? frontend/src/features/availability/states.test.tsx
?? frontend/src/features/availability/test-utils.ts
?? frontend/src/features/availability/types.ts
?? frontend/src/features/availability/ui/
?? frontend/src/features/availability/weekly-schedule.test.tsx
?? openspec/changes/c-03-availability-and-schedule-settings/
```

`git diff --name-only`: `backend/src/modules/availability/availability.module.ts` y
`frontend/src/features/availability/index.tsx`. `git diff --cached --name-only`: vacío.
No aparecen `frontend/src/app/**`, configuraciones raíz, `backend/src/app.module.ts`, filtro
de errores, guard, `data-source.ts`, migraciones C01/C02, `package.json`, lockfiles,
`CHANGES.md`, `AGENTS.md`, `openspec/specs/**`, archive, otros changes, `dist/`, `coverage/`
ni `backend/.env` (gitignored, no leído, impreso ni modificado).

Deudas vigentes, **sin resolver aquí**: CR-01 (el filtro global no propaga los códigos del
spec; la UI usa estado HTTP y mensajes seguros), CR-02 (suite C03 con `--testMatch`
explícito), guard de arquitectura (sin literales prohibidas en producción) y
`data-source.ts` sin `timezone: 'Z'` (mitigado dentro del módulo). Todas siguen documentadas
en §3 y pendientes de Pablo en `main`.

## 11. Cierre definitivo (tareas 5.7, 6.3 y 6.4)

Repetición final de verificaciones, todas con `EXITCODE=0`:

| Verificación | Resultado |
|---|---|
| `backend: npm test` | 13/13 suites, 141/141 tests |
| `backend: npm run test:integration` (C-01) | 1/1 suite, 2/2 tests |
| C03 explícito `--testMatch ... --runInBand` (en serie) | 1/1 suite, 21/21 tests |
| `frontend: npm test` | 11/11 archivos, 53/53 tests |
| `backend: npm run build` / `frontend: npm run build` | `EXITCODE=0` / `EXITCODE=0` |
| `backend: npm run lint` / `frontend: npm run lint` | `EXITCODE=0` / `EXITCODE=0` |
| `node scripts/change-scope/check.mjs --branch change/c-03-availability-and-schedule-settings` | `Scope check passed`, `EXITCODE=0` |

Validación definitiva (el flag `--change` no existe en esta versión de la CLI):

```bash
openspec validate "c-03-availability-and-schedule-settings" --type change --strict --json
```

Resultado exacto del item validado:

```json
{
  "id": "c-03-availability-and-schedule-settings",
  "type": "change",
  "valid": true,
  "issues": [],
  "durationMs": 44
}
```

`summary.totals`: `items: 1`, `passed: 1`, `failed: 0`; `byType.change`: `items: 1`,
`passed: 1`, `failed: 0`; `version: "1.0"`, `root.source: "nearest"`.

`openspec status --change "c-03-availability-and-schedule-settings" --json`:
`isPlanningComplete: true`, `isComplete: true`; artefactos `proposal`, `specs`, `design` y
`tasks` en `status: "done"`; `applyRequires: ["tasks"]`.

`openspec instructions apply --change "c-03-availability-and-schedule-settings" --json`:
`total: 38`, `complete: 38`, `remaining: 0`.

Cierre: la revisión visual de la usuaria (§9) habilitó 5.7; `verification.md` quedó completo
para 6.3; la validación strict confirmó el change para 6.4. Todo lo anterior es verificación
local en la rama. `CHANGES.md` sigue pendiente hasta la integración de Pablo; las deudas
CR-01, CR-02, guard de arquitectura y `timezone` del `DataSource` permanecen sin resolver y
no se afirmó propagación de códigos de dominio al cliente. No se ejecutaron `sync-specs`,
`archive`, commit, push ni merge.
