# Tasks

## 0. Coordinación previa (fuera del ownership de C-04)

- [ ] 0.1 Enviar a Pablo CR-C04-01 (harness de integración de C-02 debe autenticarse con `session-test.support-spec.ts`) y CR-C04-02 (`jest.integration.config.cjs` descubre `src/**/*.integration-spec.ts`, equivalente a CR-02 de C-02); registrar respuesta en `verification.md`. No editar esos archivos desde esta rama.
- [ ] 0.2 Cuando CR-C04-02 esté en `main`, actualizar la rama desde `main` sin perder trabajo local antes de ejecutar los grupos 4 y 6.

## 1. Persistencia

- [ ] 1.1 Agregar `backend/src/database/migrations/2026112504000-C04-CreateUsers.ts` con la tabla `users`, `UQ_users_email`, `CHK_users_role` y `down`; verificar con `npm run build` y ejecutando `up`/`down` contra MariaDB real de pruebas.
- [x] 1.2 Crear `user.entity.ts` y `email-normalization.ts` (`trim` + minúsculas); verificar con test unitario de normalización y `npm run lint` sin `any`.

## 2. Núcleo criptográfico

- [x] 2.1 Implementar `scrypt-password-hasher.ts` con el formato `scrypt$N$r$p$salt$hash` y `timingSafeEqual`; verificar con tests: hash distinto de la contraseña, salts distintas, verify correcto/incorrecto y formato inválido → `false`.
- [x] 2.2 Implementar `session-token.service.ts` (HS256 con `node:crypto`, `Clock` inyectable, TTL de `SESSION_TTL_SECONDS`); verificar con tests de firma válida, firma alterada, otro secreto, `alg: none`/`HS512`, estructura inválida y expiración con reloj fijo.
- [x] 2.3 Implementar `session-cookie.ts` (lectura de la cabecera `Cookie` y opciones de escritura/borrado desde `SESSION_COOKIE_CONTRACT`); verificar con tests de parseo y de `secure` según `APP_ENV`.

## 3. API y guard

- [x] 3.1 Implementar `dto/login.dto.ts` y `auth.service.ts` (login con hash ficticio para email inexistente, `findSessionUser`, logs sin email); verificar con tests que ambos casos inválidos lanzan el mismo error y llaman a `verify`, y que ningún log contiene email ni contraseña ficticios.
- [x] 3.2 Implementar `auth.controller.ts` (`POST login`, `GET sesion`, `POST logout`) con `@Res({ passthrough: true })` y `public-route.decorator.ts`; verificar con test unitario de cuerpo de respuesta y atributos de cookie.
- [x] 3.3 Implementar `session.guard.ts` y registrarlo como `APP_GUARD` en `AuthModule` con allowlist de `GET /api/health`; verificar con tests de ruta pública, health, sin cookie, token inválido, usuario inexistente y `request.sessionUser` adjunto.
- [ ] 3.4 Implementar la persistencia en `provision-admin.ts` (idempotente por email, sin imprimir valores, error claro si falta la tabla); verificar con `npm run build` y ejecución manual contra MariaDB de desarrollo con datos ficticios.
- [x] 3.5 Crear `testing/session-test.support-spec.ts` (`createSessionCookie`, `insertTestUser`); verificar que el build lo excluye y que `npm test` del backend pasa completo.

## 4. Verificación backend con MariaDB real

- [x] 4.1 Escribir `auth.integration-spec.ts`: aprovisionamiento idempotente, login válido con email en mayúsculas, inválido indistinguible (mismo estado y cuerpo), datos faltantes, sesión, token vencido, logout, `GET /api/pacientes` 401/200 y `GET /api/health` sin cookie.
- [ ] 4.2 Ejecutar `npm run test:integration` contra MariaDB real y registrar versión, comando y resultado en `verification.md`; si CR-C04-02 o CR-C04-01 faltan, registrar la tarea como bloqueada sin usar otro motor.
- [x] 4.3 Ejecutar `npm run build`, `npm test`, `npm run test:e2e` y `npm run lint` en `backend/`; confirmar que el e2e de health sigue en 503 sin sesión.

## 5. Frontend

- [x] 5.1 Implementar `features/auth/api.ts`, `types.ts` y `session.tsx` (`SessionProvider`, `useSession`, revalidación en `visibilitychange`); verificar con tests de estados `loading`/`authenticated`/`anonymous`/`error`.
- [x] 5.2 Implementar `LoginForm.tsx` y `AuthPage` (validación por campo, mensaje genérico, contraseña vaciada tras 401, botón con carga, destino `state.from` validado, redirección si ya hay sesión); verificar con tests de cada escenario de la spec `app-shell`.
- [x] 5.3 Implementar `RequireSession.tsx`, `ShellNavigation.tsx`, `AppShell.tsx` y `app-shell.css` (layout sin navegación en `/acceso`, menú móvil con `aria-expanded` y `Esc`, grupo Configuración, email y Cerrar sesión); verificar con tests de redirección sin sesión, error con reintento, menú móvil y logout.
- [x] 5.4 Ejecutar `npm run build`, `npm test` y `npm run lint` en `frontend/` sin errores ni `any`.

## 6. Verificación integral

- [ ] 6.1 Con backend, MariaDB de desarrollo y cuenta ficticia aprovisionada, recorrer manualmente acceso inválido, acceso válido, navegación protegida, recarga con sesión y cierre de sesión; revisar `/acceso` y el shell en 390×844 y 1440×900 sin Playwright; registrar pantallas, viewports, foco, overflow y resultado en `verification.md`.
- [x] 6.2 Ejecutar `node scripts/change-scope/check.mjs --branch change/c-04-authentication-and-app-shell --base main` sin violaciones y `npx @fission-ai/openspec@2.1.1 validate c-04-authentication-and-app-shell --strict` sin errores.

## Workflow follow-up

- Commit, push y pull request `[C-04] authentication-and-app-shell` solo por pedido explícito de Gonzalo.
- Pablo revisa, integra en `main` y ejecuta `openspec-sync-specs` y `openspec-archive-change`; no se ejecutan desde esta rama.
- Marcar C-04 en `CHANGES.md` corresponde a la integración, no a esta rama.
