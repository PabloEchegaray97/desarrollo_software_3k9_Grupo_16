# Design

## Context

Ver [proposal.md](proposal.md). C-02 a C-07 ya están integrados y archivados; C-08 trabaja sobre esas superficies fusionadas. El frontend usa React Router declarativo, tokens CSS compartidos y modales nativos por feature. La API de agenda ya devuelve lo necesario para las métricas del día y ambas representaciones de agenda. El backend valida `process.env` en `main.ts` antes de que `ConfigModule` pueda cargar `.env`, aunque migraciones y aprovisionamiento sí lo cargan explícitamente.

La política visual continúa en `system-only`: no se crea un mockup por pantalla. Las decisiones del usuario cambian nombre, navegación y tema, por lo que el design system debe pasar a revisión 2, quedar `pending` y recibir aprobación manual antes del Apply visual. No se usará Playwright.

## Goals / Non-Goals

**Goals:**

- Integrar el MVP bajo la identidad OdoSoft con tema claro/oscuro y una composición responsive única.
- Hacer del dashboard y la agenda los centros operativos sin introducir una API analítica.
- Reutilizar contratos y reglas ya aprobados; React solo representa decisiones del backend.
- Dejar instalación, datos ficticios, prueba integral y demo reproducibles.
- Mantener TypeScript estricto, foco visible, semántica accesible y ausencia de datos reales.

**Non-Goals:**

- Reescribir los dominios C-02 a C-07, cambiar endpoints REST o agregar migraciones destructivas.
- Incorporar múltiples profesionales, reserva pública, mensajería, pagos, historia clínica o integraciones externas.
- Crear un framework de componentes general, un segundo sistema visual o mockups por pantalla.
- Automatizar inspección visual o capturas con Playwright.

## Decisions

### 1. Revisión 2 del design system antes del Apply visual

Se actualizarán nombre, logo provisional, tokens oscuros, componentes de sidebar/dashboard/modal y contratos de iconografía. `design-system/README.md` pasará a `Revision: 2` y `Approval: pending`; `.active-orchestrator-state.json` reflejará la misma revisión/estado. Esta última ruta es una excepción compartida explícita requerida por la skill de design system y deberá quedar comprendida en la aprobación del plan.

La referencia se previsualizará manualmente abriendo `design-system/components.html` en 390×844 y 1440×900, en claro y oscuro. Después de la confirmación del usuario se registrará `Approval: approved`; hasta entonces no se implementará la UI de C-08.

Alternativa descartada: mantener revisión 1 y resolver tema/sidebar solo dentro de React. Crearía dos fuentes visuales y violaría la política aprobada.

### 2. Tema semántico con aplicación temprana

`tokens.css` conservará los nombres semánticos actuales y añadirá sus valores oscuros bajo `[data-theme='dark']`; `color-scheme` coincidirá con el tema resuelto. Un módulo tipado resolverá `light | dark | system`, persistirá la elección en `localStorage` y observará `prefers-color-scheme`. `main.tsx` aplicará el atributo antes de montar React para evitar mostrar contenido protegido con el tema contrario.

Alternativa descartada: duplicar hojas CSS por tema. Aumentaría divergencia y obligaría a cada feature a elegir una paleta.

### 3. Sidebar responsive y Phosphor Icons

El shell cambiará de header horizontal a layout con sidebar izquierdo redondeado. En escritorio guardará solo la preferencia visual de expandido/contraído; en móvil será un drawer modal que cierra por destino, botón o `Esc` y devuelve foco. Tema, cuenta y logout se ubican al pie.

Se agregará únicamente `@phosphor-icons/react`, previa modificación controlada de `frontend/package.json` y lockfile. Los iconos usarán peso `regular` normalmente y `fill` en destinos activos; texto, `aria-label` o tooltip accesible seguirán comunicando el significado.

Alternativa descartada: SVG copiados o una mezcla de librerías. Perdería consistencia y aumentaría mantenimiento.

### 4. Dashboard con alcance Hoy/Próximos

`practice-dashboard` consulta `GET /api/agenda` para Hoy y `GET /api/agenda/proximos?desde=YYYY-MM-DD` para Próximos turnos. El selector conserva ambos alcances dentro del dashboard; los próximos se ordenan y agrupan por fecha, se paginan y posicionan inicialmente la página que contiene el siguiente turno operativo. La acción `Nuevo turno` vive en el shell y abre la ruta modal. No se calculan disponibilidad, huecos ni conflictos en React.

Alternativa descartada: crear `/api/dashboard`. La agenda sigue siendo el contrato operativo y el endpoint de próximos permite filtros de estado y sillón sin duplicar un modelo analítico.

### 5. Alta en tres pasos como modal de ruta; ciclo de vida como página

`/turnos/nuevo` seguirá siendo una URL navegable, pero `AppRoutes` la presentará como modal. Las aperturas internas conservarán la ubicación de fondo en el estado de navegación; un acceso directo usará `/` como fondo estable. Un componente modal compartido manejará diálogo, foco inicial, encierro de foco, `Esc`, backdrop y retorno al disparador.

La lógica de carga y alta de C-05 permanece en el feature, presentada como: selección de prestación/sillón, selección o alta de paciente, fecha/horario y confirmación previa. Un paciente recién creado aparece inmediatamente entre los recientes. Tras persistir, el modal muestra `Detalle del turno` y únicamente permite cerrar; `/turnos/:appointmentId` continúa como página dedicada para reprogramar, cancelar, cambiar estado e inspeccionar historial.

Alternativa descartada: mover también el ciclo de vida a modales. Encadenaría diálogos complejos y haría más frágil la navegación y el foco.

### 6. Agenda Lista/Calendario con contratos temporales autoritativos

Calendario es el valor inicial. La preferencia interna `list | grid` se persiste localmente, pero la interfaz comunica `Lista` y `Calendario`. Lista consulta todos los turnos desde hoy; Calendario consulta el rango visible y permite elegir un día. En escritorio, la lista abre detalle lateral y el calendario abre detalle modal; en móvil, el día y las acciones usan bottom sheets coherentes. Ninguna representación busca huecos ni declara disponibilidad.

Alternativa descartada: calcular disponibilidad desde el calendario. Contradiría la autoridad del backend y duplicaría reglas temporales.

### 10. Invalidación local después de mutaciones

Las mutaciones de turnos publican un evento local tipado. Dashboard y Agenda se suscriben y vuelven a consultar sus contratos; de este modo un turno creado o modificado aparece sin `F5`, sin compartir cachés mutables ni trasladar reglas temporales al cliente.

Alternativa descartada: esperar navegación o recarga manual. Dejaría información obsoleta visible después de una operación exitosa.

### 7. Carga de entorno antes de validación

Se extraerá un helper pequeño y testeable que intente `process.loadEnvFile()` en desarrollo, ignore solo `ENOENT` y preserve variables ya definidas. `main.ts` lo ejecutará antes de `validateEnvironment`. Migraciones, aprovisionamiento y seed usarán el mismo contrato sin imprimir valores.

Alternativa descartada: documentar permanentemente `node --env-file=.env ...`. Funciona como workaround, pero no cumple el comando normal del README.

### 8. Seed idempotente y prueba integral

`seed:demo` usará el DataSource real y una transacción. Buscará o creará registros ficticios mediante claves naturales estables y no borrará datos ajenos. Preparará los cinco estados de turno, un intervalo, una excepción y bloqueos suficientes para dashboard, agenda y ciclo de vida. No incluirá información clínica ni secretos.

La prueba integral vivirá en `backend/test/integration/**`, ejecutará el recorrido API sobre `TEST_DATABASE_*` y limpiará solo sus fixtures. Frontend mantendrá pruebas de componentes para composición, tema, modal y agenda; la verificación visual será manual y se registrará en `verification.md`.

### 9. Superficie exacta prevista

**Planificación y estado visual**

- `openspec/changes/c-08-integration-ui-polish/**`
- `.active-orchestrator-state.json` — solo `visual_design.revision/status`, excepción a aprobar
- `design-system/README.md`
- `design-system/brand.md`
- `design-system/brand.js`
- `design-system/tokens.css`
- `design-system/component-contract.md`
- `design-system/components.html`
- `design-system/assets/logo.svg`

**Frontend compartido y dependencias**

- `frontend/package.json`, `frontend/package-lock.json`
- `frontend/src/main.tsx`, `frontend/src/styles/index.css`
- `frontend/src/app/routes.tsx`, `frontend/src/app/routes.test.tsx`
- `frontend/src/app/shell/AppShell.tsx`, `ShellNavigation.tsx`, `app-shell.css`, `AppShell.test.tsx`
- `frontend/src/app/theme/theme.ts`, `ThemeProvider.tsx`, `theme.test.tsx` (nuevos)
- `frontend/src/app/dashboard/index.tsx`, `dashboard.css`, `dashboard.test.tsx` (nuevos)
- `frontend/src/shared/components/AppModal.tsx`, `app-modal.css`, `AppModal.test.tsx` (nuevos)

**Features fusionadas, solo integración/pulido trazable**

- `frontend/src/features/auth/index.tsx`, `LoginForm.tsx`, `auth.css`, `auth.test.tsx`
- `frontend/src/features/agenda/index.tsx`, `AgendaToolbar.tsx`, `AgendaGrid.tsx` (nuevo), `agenda.css`, `agenda.test.tsx`
- `frontend/src/features/appointments/create/index.tsx`, `AppointmentSummary.tsx`, `create.css`, `appointment-create.test.tsx`
- `frontend/src/features/appointments/lifecycle/AppointmentDetail.tsx`, `CancelModal.tsx`, `RescheduleModal.tsx`, `lifecycle.css`, `lifecycle-ui.test.tsx`
- `frontend/src/features/patients/index.tsx`, `PatientForm.tsx`, `patients.test.tsx`
- `frontend/src/features/catalog/index.tsx`, `ProcedureForm.tsx`, `ui/AdminModal.tsx`, `ui/admin-ui.css`, `ui/ui.test.tsx`, `catalog.test.tsx`
- `frontend/src/features/availability/index.tsx`, `ui/styles.css`, `states.test.tsx`

**Backend, configuración y entrega**

- `backend/src/main.ts`
- `backend/src/config/load-environment.ts`, `load-environment.spec.ts` (nuevos)
- `backend/src/database/seed-demo.ts`, `seed-demo.spec.ts` (nuevos)
- `backend/test/integration/mvp-flow.integration-spec.ts`, `mvp-flow.support-spec.ts` (nuevos)
- `backend/package.json`
- `README.md`, `.env.example`, `backend/.env.example`, `frontend/.env.example`
- `docs/demo/README.md` (nuevo)
- `openspec/changes/c-08-integration-ui-polish/verification.md` (nuevo durante Apply)

Todo archivo adicional detendrá Apply para explicar motivo e impacto antes de ampliar esta lista.

## Risks / Trade-offs

- **[Tema oscuro incompleto en features antiguas]** → usar solo tokens semánticos, buscar colores literales y revisar cada pantalla en ambos temas.
- **[Sidebar, modal y grilla aumentan el alcance final]** → conservar contratos y datos existentes, implementar por lotes verificables y no rediseñar lógica de dominio.
- **[Grilla interpretada como disponibilidad]** → etiquetarla como vista de turnos/bloqueos y prohibir inferencias de huecos en specs y tests.
- **[Seed modifica una base de desarrollo]** → hacerlo opt-in, transaccional, idempotente y sin borrar registros ajenos.
- **[LocalStorage indisponible o corrupto]** → validar valores, usar defaults seguros y mantener la aplicación funcional sin persistencia.
- **[Dependencia de iconos amplía bundle]** → importar iconos individualmente y verificar build; no agregar una segunda librería.
- **[Revisión 2 sin captura automática]** → registrar pasos, viewports, temas y confirmación humana; no afirmar evidencia no ejecutada.

## Migration Plan

1. Revisar y aprobar proposal/specs/design/tasks.
2. Actualizar design system a revisión 2, previsualizar manualmente y obtener aprobación explícita.
3. Corregir carga de entorno y preparar seed/documentación sin cambiar contratos de negocio.
4. Incorporar tema, modal compartido, sidebar y dashboard.
5. Integrar modal de alta y vista grilla; pulir features enumeradas.
6. Ejecutar verificación automática completa con MariaDB real y el guard de scope.
7. Ejecutar el guion manual en 390×844 y 1440×900, claro y oscuro, y registrar resultados.

Rollback: los cambios son de aplicación y documentación; no hay migraciones nuevas. Revertir el commit de C-08 restaura el shell anterior sin transformar datos persistidos. El seed no se ejecuta automáticamente.
