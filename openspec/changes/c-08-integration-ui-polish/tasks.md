# Tasks

## 1. Sistema visual revisión 2 y dependencia aprobada

- [x] 1.1 Actualizar `.active-orchestrator-state.json` y los archivos enumerados de `design-system/**` con OdoSoft, tokens claros/oscuros, sidebar, dashboard, modal e iconografía; verificar JSON válido, `Revision: 2`, `Approval: pending`, ausencia de colores paralelos y apertura local de `components.html`.
- [x] 1.2 Revisar manualmente `design-system/components.html` en 390×844 y 1440×900, en claro y oscuro, sin Playwright; registrar pantallas/temas y obtener aprobación explícita del usuario antes de iniciar las tareas 3.x–7.x, dejando `Approval: approved` en README y estado.
- [x] 1.3 Agregar únicamente `@phosphor-icons/react` a `frontend/package.json` y lockfile, justificarla en `verification.md` y verificar instalación reproducible más `npm run build` sin una segunda librería de iconos.

## 2. Runtime, entorno y datos ficticios

- [x] 2.1 Crear `load-environment.ts`, integrarlo antes de `validateEnvironment` en `main.ts` y cubrir archivo presente, `ENOENT`, error inesperado y precedencia del proceso; verificar con sus tests, `npm run lint` y `npm run build` del backend.
- [x] 2.2 Implementar `seed:demo` transaccional e idempotente con registros exclusivamente ficticios para los cinco estados, intervalo, excepción y bloqueo; verificar con pruebas sobre MariaDB real que una segunda ejecución no duplica ni borra datos ajenos.
- [x] 2.3 Actualizar README y ejemplos de entorno con instalación, migración, aprovisionamiento, seed, desarrollo y verificación completos; ejecutar los comandos documentados desde `backend/` y `frontend/` y registrar cualquier requisito manual sin exponer secretos.

## 3. Infraestructura visual compartida y shell

- [x] 3.1 Implementar resolución tipada `light | dark | system`, aplicación temprana, persistencia segura y reacción a `prefers-color-scheme`; verificar defaults, valor corrupto, cambio del sistema y recarga mediante `theme.test.tsx`.
- [x] 3.2 Crear `AppModal` compartido con foco inicial/encerrado, `Esc`, backdrop, bloqueo del fondo y retorno al disparador; verificar cada interacción con `AppModal.test.tsx` en ambos temas.
- [x] 3.3 Reemplazar la barra superior por el sidebar OdoSoft expandible/contraíble y drawer móvil, con navegación, controles de tema, cuenta y logout; verificar iconos regular/`fill`, teclado, foco, cierre y sesión mediante `AppShell.test.tsx` y `auth.test.tsx`.
- [x] 3.4 Actualizar estilos globales y acceso para revisión 2, eliminando la identidad provisional y textos redundantes sin quitar instrucciones o errores necesarios; verificar búsqueda de marca anterior, contraste por tokens y `npm run lint` del frontend.

## 4. Dashboard operativo

- [x] 4.1 Crear `practice-dashboard` en `/` con alcances Hoy/Próximos, métricas derivadas de la agenda, agrupación por fecha y paginación sin cálculos temporales; verificar jornada con datos, vacía y error/reintento en `dashboard.test.tsx`.
- [x] 4.2 Integrar detalle lateral, bottom sheet móvil y acción global `Nuevo turno` desde el shell, conservando sesión y foco; verificar navegación y apertura/cierre del modal en `dashboard.test.tsx` y `routes.test.tsx`.
- [x] 4.3 Aplicar densidad compacta de escritorio y espaciado móvil con estados claro/oscuro; verificar por tests las clases/semántica y reservar la comprobación visual integral para 9.2.

## 5. Alta de turno como modal de ruta

- [x] 5.1 Adaptar `/turnos/nuevo` a modal con ubicación de fondo y fallback `/` para acceso directo, manteniendo intacta la lógica de C-05; verificar URL, foco, `Esc`, cierre y restauración del contexto en `routes.test.tsx` y `appointment-create.test.tsx`.
- [x] 5.2 Adaptar carga, formulario, excepción y resumen al modal de tres pasos; agregar confirmación previa, alta inmediata de paciente y detalle final con única acción Cerrar, verificando éxito, rechazo, excepción y reintento en `appointment-create.test.tsx`.
- [x] 5.3 Confirmar que reprogramación, cancelación, estado e historial siguen únicamente en la página dedicada y que no se alteraron contratos HTTP; verificar `lifecycle-ui.test.tsx` y los tests existentes del feature.

## 6. Agenda alternable

- [x] 6.1 Implementar selector accesible Lista/Calendario con calendario inicial y preferencia local validada; verificar teclado, persistencia y fallback ante valor corrupto en `agenda.test.tsx`.
- [x] 6.2 Integrar calendario mensual y lista futura con respuestas autoritativas del backend, sin inferir huecos ni disponibilidad; verificar orden, selección, estados, excepción y día vacío en `agenda.test.tsx`.
- [x] 6.3 Integrar detalle lateral/modal, filtros, refresco automático y bottom sheets móviles con ambas vistas en claro/oscuro y responsive; verificar tests, lint y build del frontend.

## 7. Pulido coherente de features fusionadas

- [x] 7.1 Ajustar Pacientes y Catálogos a los tokens revisión 2, manteniendo listados y formularios modales y quitando solo subtítulos redundantes; verificar CRUD, duplicados, validaciones, foco y errores con sus suites actuales.
- [x] 7.2 Ajustar Disponibilidad y Lifecycle al shell/tema nuevos sin mover reglas temporales a React ni eliminar explicaciones necesarias; verificar excepciones, horarios, transiciones, modales e historial con sus suites actuales.
- [x] 7.3 Auditar todas las superficies frontend enumeradas contra colores literales, `any`, desbordamiento y movimiento no reducido; corregir solo hallazgos trazables y verificar `npm run lint`, `npm test` y `npm run build`.

## 8. Integración y documentación de entrega

- [x] 8.1 Crear el flujo de integración API en `backend/test/integration/**` con MariaDB real, sesión y fixtures ficticios: login → paciente/catálogos → disponibilidad → alta → agenda → reprogramación/cancelación/estado → historial; verificar aislamiento, limpieza y resultado con `npm run test:integration`.
- [x] 8.2 Crear `docs/demo/README.md` con preparación y recorrido atribuible a Pablo, Paula, Milagros y Gonzalo, resultados esperados y distinción entre evidencia automática/manual; ejecutar el guion contra el seed sin usar datos reales.
- [x] 8.3 Ejecutar backend `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:integration`, `npm run build` y frontend `npm run lint`, `npm test`, `npm run build`; registrar versiones, comandos y resultados en `verification.md` sin versionar artefactos generados.

## 9. Cierre verificable de C-08

- [x] 9.1 Auditar diff y repositorio por secretos, datos reales, integraciones fuera del MVP, dependencias no justificadas, `any`, `dist/`, `coverage/` y paths no previstos; verificar `git diff --check` y documentar cualquier excepción aprobada.
- [x] 9.2 Recorrer manualmente login, dashboard, navegación responsive, temas, pacientes, catálogos, disponibilidad, alta modal, agenda Lista/Calendario, bottom sheets y lifecycle en 390×844 y 1440×900 sin Playwright; registrar foco, overflow, contraste, carga/vacío/error y diferencias por prioridad.
- [x] 9.3 Ejecutar `node scripts/change-scope/check.mjs --branch change/c-08-integration-ui-polish --base main` y `openspec validate c-08-integration-ui-polish --strict`; verificar cero violaciones y que todos los artefactos/evidencias pertenecen al change.

## 10. Reconciliación del pulido final

- [x] 10.1 Reconciliar proposal, design, specs y tareas con el resultado final posterior a la primera verificación: Hoy/Próximos, Lista/Calendario, superficies responsive, confirmación previa y actualización dinámica.
- [x] 10.2 Incorporar al contrato de agenda futura filtros opcionales por sillón y estado, conservando por defecto únicamente `PROGRAMADO` y `CONFIRMADO` y sin mover reglas temporales a React.
- [x] 10.3 Repetir validación OpenSpec, tests/builds relevantes y `git diff --check`; anexar el resultado final a `verification.md` antes de commit, merge, sync y archive.

## Workflow follow-up

- Pablo revisa e integra el branch terminado en `main`; commit, push, PR y merge requieren pedido explícito.
- Después del merge, Pablo sincroniza las specs delta y archiva C-08 secuencialmente sobre `main`.
- Un defecto descubierto después del archivo se clasifica como ODD si es pequeño o como un change SDD de seguimiento con nombre único si cambia comportamiento o contratos; C-08 no se renumera.
