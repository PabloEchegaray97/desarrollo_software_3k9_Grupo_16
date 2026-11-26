# Verificación de C-08

## Tarea 1.1 — Sistema visual revisión 2

Fecha: 2026-11-24
Estado: completada; revisión visual manual pendiente en 1.2.

- `.active-orchestrator-state.json` parsea correctamente y registra `system-only`, revisión 2 y estado `pending`.
- `design-system/README.md` registra `Revision: 2` y `Approval: pending`.
- La marca visible se centraliza como `OdoSoft` en `brand.js`; no quedan referencias a la identidad provisional anterior dentro de `design-system/`.
- `tokens.css` define temas claro y oscuro mediante tokens semánticos compartidos; `components.html` los consume sin hojas, fuentes ni recursos remotos.
- `components.html` incluye sidebar redondeado, navegación activa, controles de tema, dashboard, métricas, acceso `Nuevo turno`, agenda lista/grilla, estados, inputs y modal responsive.
- La entrada local y sus referencias relativas (`tokens.css` y `brand.js`) existen y son autocontenidas. La revisión de render a 390×844 y 1440×900 corresponde a la tarea 1.2 y debe realizarla el usuario manualmente.
- `node --check design-system/brand.js`: aprobado.
- `openspec validate c-08-integration-ui-polish --strict`: aprobado.
- No se utilizó Playwright ni se generaron capturas automatizadas.

## Pendiente inmediato

La revisión 2 fue aprobada explícitamente por el usuario el 2026-11-24 después de la revisión manual solicitada de `design-system/components.html` en 390×844 y 1440×900, en tema claro y oscuro. `design-system/README.md` y `.active-orchestrator-state.json` registran la aprobación. No se usó Playwright ni se generaron capturas automatizadas.

## Tarea 1.3 — Phosphor Icons

Fecha: 2026-11-24
Estado: completada.

- Dependencia agregada: `@phosphor-icons/react@^2.1.10` en `frontend/package.json` y `frontend/package-lock.json`.
- Justificación: provee una iconografía React coherente con pesos `regular` y `fill`, requerida por el shell aprobado, evitando SVG copiados y mezclas de librerías.
- La búsqueda en manifiesto y lockfile no encontró otra librería de iconos.
- Primer `npm ci`: falló con `EPERM` porque un servidor Vite del mismo frontend mantenía bloqueado `lightningcss.win32-x64-msvc.node`.
- Resolución: se identificaron y detuvieron únicamente los procesos `npm run dev`/Vite de este frontend; luego `npm ci` instaló 117 paquetes y reportó 0 vulnerabilidades.
- `npm run build`: aprobado con TypeScript y Vite 8.3.8; 96 módulos transformados.
- `dist/` es un artefacto generado e ignorado; no se versiona.

## Tarea 2.1 — Carga de entorno antes de validar

Fecha: 2026-11-24
Estado: completada.

- `backend/src/config/load-environment.ts` resuelve `backend/.env` desde la ubicación del módulo, lo carga solamente en desarrollo y se ejecuta en `main.ts` antes de `validateEnvironment(process.env)`.
- Las variables ya presentes en el proceso conservan precedencia sobre el archivo.
- Solo `ENOENT` se tolera como archivo local opcional; cualquier otro error se propaga.
- `load-environment.spec.ts`: 5/5 pruebas aprobadas (archivo presente, `ENOENT`, error inesperado, precedencia y omisión fuera de desarrollo).
- `npm run lint` del backend: aprobado sin advertencias.
- `npm run build` del backend: aprobado.
- Hallazgo durante la prueba: Jest ESM no expone `jest` globalmente; el test importa `jest` desde `@jest/globals` sin modificar configuración ni producción.

## Tarea 2.2 — Seed ficticio reproducible

Fecha: 2026-11-24
Estado: completada.

- `npm run seed:demo` compila y ejecuta un seed opt-in sobre la base de desarrollo configurada; no se ejecuta durante el arranque normal.
- El seed usa una transacción y UUID reservados estables para hacer upsert únicamente de sus propios pacientes, prestaciones, sillones, disponibilidad, bloqueo, turnos y eventos.
- Los instantes del día se calculan con `America/Argentina/Buenos_Aires` y se entregan a MariaDB como UTC; no se persiste `-03:00` como zona.
- Dataset: cinco pacientes ficticios, dos prestaciones, dos sillones, disponibilidad semanal, bloqueo, intervalo de 10 minutos, una excepción manual y un turno por cada estado `PROGRAMADO`, `CONFIRMADO`, `ATENDIDO`, `AUSENTE` y `CANCELADO`.
- Prueba MariaDB real: `node --env-file=.env --experimental-vm-modules ./node_modules/jest/bin/jest.js --config test/jest.config.cjs --runInBand --runTestsByPath src/database/seed-demo.spec.ts`.
- Resultado: 1/1 prueba aprobada. Dos ejecuciones conservaron exactamente 5 turnos y 6 eventos, y un paciente ficticio ajeno al seed permaneció intacto.
- La prueba confirmó además la disponibilidad, el bloqueo, el intervalo, la excepción y los cinco estados.
- `npm run lint` y `npm run build` del backend: aprobados.
- La configuración estándar de integración descubre solo `*.integration-spec.ts`; se mantuvo el path `seed-demo.spec.ts` aprobado en el diseño y se ejecutó explícitamente con `.env` y MariaDB real.

## Tarea 2.3 — Documentación reproducible

Fecha: 2026-11-24
Estado: completada.

- `README.md` ya describe instalación desde lockfiles, dos bases MariaDB separadas, migraciones, aprovisionamiento, seed opt-in, arranque y matriz completa de verificación.
- `.env.example`, `backend/.env.example` y `frontend/.env.example` aclaran responsabilidades sin incluir valores sensibles.
- Git confirmó que `backend/.env` y `frontend/.env` permanecen ignorados.
- Comprobación local sin revelar valores: `DATABASE_*`, `TEST_DATABASE_*`, `AUTH_SECRET`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` están presentes.
- El usuario corrigió localmente las longitudes: `AUTH_SECRET` cumple el mínimo de 32 caracteres e `INITIAL_ADMIN_PASSWORD` el mínimo de 12; sus valores no fueron mostrados ni registrados.
- `npm ci` del backend: 600 paquetes auditados, 0 vulnerabilidades. Los avisos deprecados provienen transitivamente de `inflight` y `glob`; no se agregó una dependencia directa.
- `npm run migration:run`: aprobada; aplicó la migración C-05 pendiente sobre la base de desarrollo.
- `npm run provision:admin`: aprobada; creó la cuenta inicial configurada sin exponer credenciales.
- `npm run seed:demo`: aprobado; dejó 5 turnos ficticios para el 2026-11-24.
- Arranque documentado: Nest compiló sin errores y `GET /api/health` respondió `{"status":"ok","database":"up"}`; Vite 8.3.8 respondió HTTP 200 en `127.0.0.1:5173`. Ambos procesos temporales fueron detenidos.
- Backend: lint aprobado; 469 pruebas unitarias aprobadas y 1 prueba MariaDB específica omitida por la suite unitaria; E2E 1/1 aprobado; 8 archivos de integración MariaDB aprobados; build aprobado.
- Frontend: lint aprobado; 22 archivos y 132 pruebas aprobadas; build aprobado con 96 módulos transformados.
- Los `dist/` generados permanecen ignorados y no se versionan.

## Tarea 3.1 — Tema claro, oscuro y sistema

Fecha: 2026-11-24
Estado: completada.

- `theme.ts` define preferencias tipadas `light | dark | system`, valida almacenamiento, resuelve el esquema del sistema y tolera errores de `localStorage`.
- `main.tsx` aplica la preferencia antes de montar React y envuelve la aplicación con `ThemeProvider`, evitando mostrar primero el tema contrario.
- `ThemeProvider` persiste elecciones explícitas y escucha cambios de `prefers-color-scheme` solo en modo `system`.
- `theme.test.tsx`: 5/5 pruebas aprobadas para default, valor corrupto, cambio del sistema, recarga y persistencia desde React.
- `npm run lint` y `npm run build` del frontend: aprobados; 98 módulos transformados.

## Tarea 7.3 — Auditoría frontend transversal

Fecha: 2026-11-25
Estado: completada.

- Auditoría de `frontend/src/**/*.{css,ts,tsx}`: no se encontraron colores literales `#RRGGBB`, `rgb()`, `hsl()` ni tipos `any`; la coincidencia de `expect.any(String)` corresponde exclusivamente a una aserción de prueba.
- Auditoría de desbordamiento: las superficies usan contenedores flex/grid con `min-width: 0`, modales limitados por `100vw` y reglas responsive; no se detectó una corrección trazable pendiente para los viewports previstos.
- Auditoría de movimiento: las transiciones están contenidas en media queries `prefers-reduced-motion` o tienen una variante sin movimiento; no se encontró movimiento no reducido pendiente.
- `npm run lint`: aprobado.
- `npm test`: 25 archivos y 167 pruebas aprobadas.
- `npm run build`: aprobado; Vite transformó 4644 módulos y produjo el build sin modificar ni versionar `dist/`.

## Tarea 8.1 — Flujo de integración MVP

Fecha: 2026-11-25
Estado: completada.

- Se agregó `backend/test/integration/mvp-flow.integration-spec.ts` y su soporte ficticio sin crear persistencia adicional ni reemplazar MariaDB.
- El recorrido usa el login real, verifica pacientes y catálogos activos, reemplaza disponibilidad semanal, crea un turno, consulta agenda, reprograma, confirma, cancela y lee el historial.
- La limpieza de turnos/eventos ocurre antes de cada caso y el harness C-06 limpia sus fixtures al finalizar; los datos usados son exclusivamente ficticios.
- `npm run test:integration`: aprobado. Se descubrieron 9 archivos de integración y el nuevo recorrido C-08 pasó junto con las suites existentes.

## Tarea 8.2 — Guion de demostración

Fecha: 2026-11-25
Estado: completada.

- Se creó `docs/demo/README.md` con preparación, atribución de Pablo/Paula/Milagros/Gonzalo, recorrido esperado y separación entre evidencia automática y manual.
- `npm run seed:demo`: aprobado en la base de desarrollo; creó exactamente 5 turnos ficticios para el 2026-11-25 sin datos reales.

## Tarea 8.3 — Verificación integral

Fecha: 2026-11-25
Estado: completada.

- Backend lint: aprobado con `NODE_OPTIONS=--max-old-space-size=4096` al reintentar secuencialmente.
- Backend unitarias: 469 aprobadas, 1 omitida (1 suite omitida y 41 suites aprobadas).
- Backend E2E: 1/1 aprobada.
- Backend integración: 9 archivos descubiertos y aprobados, incluido `mvp-flow.integration-spec.ts`.
- Backend build: aprobado.
- Frontend lint: aprobado.
- Frontend unitarias: 25 archivos y 167 pruebas aprobadas al reintentar secuencialmente.
- Frontend build: aprobado; Vite transformó 4644 módulos.
- Los artefactos `dist/` permanecieron generados pero no versionados.

## Tarea 9.1 — Auditoría de diff y repositorio

Fecha: 2026-11-25
Estado: completada.

- `git diff --check`: aprobado sin errores.
- Los archivos de entorno versionables siguen siendo ejemplos vacíos o placeholders; no se encontraron valores reales de secretos en el diff auditado.
- Las coincidencias de la búsqueda de `any` son `expect.any(...)` en pruebas o lenguaje natural, no tipos TypeScript reales.
- No se encontraron directorios `dist/` ni `coverage/` versionados.
- El scope guard confirmó que los cambios pertenecen a los paths autorizados de C-08.
- No se encontró una integración fuera del MVP ni una dependencia directa adicional a las aprobadas.

## Tarea 9.3 — Scope y validación OpenSpec

Fecha: 2026-11-25
Estado: completada.

- `node scripts/change-scope/check.mjs --branch change/c-08-integration-ui-polish --base main`: aprobado.
- `openspec validate c-08-integration-ui-polish --strict`: aprobado.

## Tarea 9.2 — Revisión visual manual

Fecha: 2026-11-25
Estado: completada y aprobada por Pablo.

- Se revisaron los flujos principales sin Playwright: login, dashboard, sidebar expandido/contraído y drawer móvil, temas claro/oscuro, pacientes, catálogos, disponibilidad, alta modal, agenda lista/grilla y lifecycle.
- Se revisaron los viewports 390×844 y 1440×900.
- No se encontraron diferencias pendientes de foco, overflow, contraste, carga, vacío, error o movimiento que requirieran corrección.

## Reconciliación posterior al pulido final

Fecha: 2026-11-25
Estado: documentación reconciliada; cierre automático pendiente.

- Pablo confirmó que terminó el pulido visual de C-08. No se utilizó Playwright ni se generaron capturas automatizadas.
- Se actualizaron proposal, design, tasks y specs delta para reflejar el resultado final: navegación responsive, dashboard Hoy/Próximos, agenda Lista/Calendario, detalles contextuales, bottom sheets, confirmación previa del alta y actualización dinámica.
- `openspec validate c-08-integration-ui-polish --strict`: aprobado.
- Backend `agenda.controller.spec.ts` + `agenda.service.spec.ts`: 2 suites y 34 pruebas aprobadas.
- Backend build: aprobado.
- Frontend `dashboard.test.tsx`: 1 suite y 11 pruebas aprobadas.
- `git diff --check`: aprobado; solo informó la normalización LF/CRLF esperable del entorno Windows.
- Frontend TypeScript (`tsc -b`): aprobado después de retirar la declaración obsoleta `emptyDescription`.
- Frontend `agenda.test.tsx`: 18/18 pruebas aprobadas después de reconciliar formato horario, contratos Lista/Calendario, filtros y refresco por evento.
- Suite frontend completa: 26 archivos y 186/186 pruebas aprobadas después de reconciliar las expectativas con la interfaz final.
- Frontend TypeScript (`tsc -b`) y build de producción: aprobados; Vite informó únicamente la advertencia no bloqueante de chunk mayor a 500 kB.
- Backend agenda: 4 suites y 66/66 pruebas aprobadas; build NestJS aprobado.
- Tarea 10.3 completada: validaciones finales aprobadas antes de sync y archive.
