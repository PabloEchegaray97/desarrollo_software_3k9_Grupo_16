# Design

## Context

C-01 dejó en `backend/src/modules/auth/` los contratos `SESSION_COOKIE_CONTRACT` (cookie `session`, 8 h, `HttpOnly`, `SameSite=Strict`, `Secure` en producción) y `PASSWORD_DERIVATION` (`scrypt`, salt 16 bytes, clave 64 bytes), un `AuthModule` vacío ya importado por `AppModule` y un `provision-admin.ts` que valida variables sin persistir. En el frontend, `App.tsx` envuelve `AppRoutes` con `AppShell`, y `/acceso` apunta a `features/auth`. `shared/api/client.ts` ya envía `credentials: 'include'` y el backend habilita CORS con credenciales para `FRONTEND_ORIGIN`.

C-04 no puede editar `app.module.ts`, `main.ts`, `App.tsx`, `routes.tsx`, `shared/**`, `health/**` ni los módulos de C-02; todo el comportamiento debe entrar por `AuthModule`, `app/shell/**`, `app/routes/auth.routes.tsx` y `features/auth/**`.

## Goals / Non-Goals

**Goals:** cuenta única aprovisionada, login/sesión/logout, guard global, pantalla de acceso, protección de navegación y shell responsive, con pruebas sobre MariaDB real y sin dependencias nuevas.

**Non-Goals:** registro, recuperación o cambio de contraseña, refresh o revocación de tokens, múltiples usuarios o roles, rate limiting, interceptor global de 401 (C-08), editar archivos de otros owners.

## Decisions

### 1. P1-06: aprovisionamiento por comando y JWT en cookie

Se implementa la decisión de C-01 sin cambios: `npm run provision:admin` crea la cuenta si el email normalizado no existe y no hace nada si existe (no rota la contraseña, para que repetirlo sea seguro). Corre con `APP_ENV=provision`, abre su propio `DataSource` con `createApplicationDataSource` y no ejecuta migraciones: exige que `migration:run` ya se haya ejecutado y falla con mensaje claro si la tabla `users` no existe. Solo imprime "cuenta creada" o "la cuenta ya existía".

**Alternativas:** crear la cuenta al arrancar (rechazada en C-01) o un endpoint de alta protegido por secreto (superficie innecesaria).

### 2. Esquema

Migración `backend/src/database/migrations/2026112504000-C04-CreateUsers.ts`:

```sql
CREATE TABLE users (
  id CHAR(36) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'ODONTOLOGO',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY UQ_users_email (email),
  CONSTRAINT CHK_users_role CHECK (role = 'ODONTOLOGO')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

`down` elimina la tabla. La entidad `user.entity.ts` vive en el módulo y la toma el glob `**/*.entity.{js,ts}` del DataSource. El email se normaliza en el dominio (`trim().toLowerCase()`) antes de consultar o insertar.

### 3. Contraseñas con `scrypt`

`ScryptPasswordHasher implements PasswordHasher` usa `crypto.scrypt` promisificado con los parámetros de `PASSWORD_DERIVATION` y guarda el formato autodescriptivo `scrypt$16384$8$1$<salt base64url>$<hash base64url>`. `verify` decodifica, recalcula y compara con `timingSafeEqual`; un formato inválido devuelve `false` sin lanzar.

Para que email inexistente y contraseña incorrecta cuesten lo mismo, `AuthService` verifica siempre contra un hash ficticio precalculado al iniciar el módulo cuando no encuentra el usuario.

### 4. JWT HS256 sin dependencia

`SessionTokenService` firma `{ sub, iat, exp }` con HMAC-SHA256 y `AUTH_SECRET` (`node:crypto`), header fijo `{ alg: 'HS256', typ: 'JWT' }`. `verify` rechaza: estructura distinta de tres segmentos, `alg` distinto de HS256, firma inválida (comparación timing-safe), `exp` vencido o ausente. El reloj se inyecta (`Clock`) para probar expiración con tiempo fijo.

**Alternativa:** `@nestjs/jwt`. Se descarta porque la regla 8 pide no agregar dependencias sin necesidad y el subconjunto requerido (HS256, `exp`) es pequeño y completamente testeable.

### 5. Contrato HTTP

| Método | Ruta | Cuerpo | Éxito | Error |
|---|---|---|---|---|
| POST | `/api/auth/login` | `{ email, contrasena }` | 200 `{ usuario: { id, email } }` + `Set-Cookie` | 400 `VALIDATION_ERROR`, 401 genérico |
| GET | `/api/auth/sesion` | — | 200 `{ usuario: { id, email } }` | 401 |
| POST | `/api/auth/logout` | — | 204 + cookie vacía `Max-Age=0` | — |

El DTO usa `class-validator` (`IsEmail`, `IsString`, `MinLength(1)`, `MaxLength(254/200)`). El 401 usa `UnauthorizedException('Email o contraseña incorrectos')` para login y `UnauthorizedException('Sesión requerida')` para el guard. Con el filtro actual el código resultante es `HTTP_401`; si CR-01 se integra, se podrá emitir `AUTH_INVALID_CREDENTIALS`/`AUTH_SESSION_REQUIRED` sin cambiar el cliente, que decide por estado HTTP.

La cookie se escribe con `response.cookie(SESSION_COOKIE_NAME, token, { httpOnly: true, sameSite: 'strict', secure: APP_ENV === 'production', path: '/', maxAge: SESSION_TTL_SECONDS * 1000 })` mediante `@Res({ passthrough: true })`. La lectura parsea la cabecera `Cookie` en `session-cookie.ts`, sin `cookie-parser`, porque `main.ts` no es de C-04.

### 6. Guard global desde `AuthModule`

`AuthModule` registra `{ provide: APP_GUARD, useClass: SessionGuard }`, que Nest aplica globalmente aunque el provider viva en un módulo de feature; así no se edita `app.module.ts`. El guard:

1. deja pasar handlers marcados con `@PublicRoute()` (login y logout, en el controlador propio);
2. deja pasar `GET` a la ruta `/api/health`, comparando `request.path`, porque `health.controller.ts` no es de C-04;
3. en otro caso, lee la cookie, verifica el token, comprueba que el usuario exista y adjunta `request.sessionUser = { id, email }`; si algo falla lanza 401.

Las solicitudes `OPTIONS` de CORS se resuelven antes de los guards y no se ven afectadas.

### 7. Logs sin credenciales

`AuthService` solo registra eventos `login_succeeded`/`login_failed` con `requestId` y sin email. `provision-admin` no imprime variables. Una prueba unitaria espía `Logger` y verifica que ningún argumento contiene el email ni la contraseña ficticios.

### 8. Soporte de pruebas para otros owners

`auth/testing/session-test-support.ts` exporta `createSessionCookie(secret, userId, now?)`, que reutiliza `SessionTokenService`. El guard también comprueba que el usuario exista, por lo que el helper acompaña `insertTestUser(dataSource)` con un usuario ficticio. Archivo excluido del build igual que los `*.support-spec.ts` de C-02 (se nombra `session-test.support-spec.ts`). Su uso en el harness de C-02 es CR-C04-01.

### 9. Frontend

```
frontend/src/features/auth/
  api.ts            login(), fetchSession(), logout() sobre apiRequest
  types.ts          SessionUser
  session.tsx       SessionProvider + useSession(): status 'loading' | 'authenticated' | 'anonymous' | 'error'
  LoginForm.tsx     formulario controlado, errores por campo, mensaje genérico
  index.tsx         AuthPage (usa LoginForm; si hay sesión, Navigate a /agenda)
  auth.test.tsx
frontend/src/app/shell/
  AppShell.tsx      SessionProvider + RequireSession + layout
  RequireSession.tsx
  ShellNavigation.tsx  navegación, menú móvil, cuenta y Cerrar sesión
  app-shell.css     estilos del shell con variables de design-system/tokens.css
  AppShell.test.tsx
frontend/src/app/routes/auth.routes.tsx  sin cambios de contrato (path '/acceso')
```

Como `App.tsx` envuelve todas las rutas con `AppShell`, el shell decide por `useLocation()`: en `/acceso` renderiza solo el contenido centrado (sin navegación); en cualquier otra ruta exige sesión. Sin sesión redirige con `<Navigate to="/acceso" replace state={{ from: location.pathname + location.search }} />`. `AuthPage` lee `state.from`, valida que empiece con `/` y no con `//`, y navega allí tras el login.

Navegación: Agenda (`/agenda`), Pacientes (`/pacientes`) y un grupo "Configuración" con Prestaciones y sillones (`/prestaciones`) y Disponibilidad (`/disponibilidad`). `/` sigue existiendo en `routes.tsx` y la marca enlaza allí. En < 768 px la navegación se pliega tras un botón con `aria-expanded`/`aria-controls`; `Esc` y la elección de un enlace la cierran. Estilos: azul `#0D3D9E` vía tokens, botones píldora, inputs `rounded-lg`, foco visible y `prefers-reduced-motion` respetado.

La sesión que vence durante el uso se detecta cuando el usuario navega (el shell vuelve a consultar en `visibilitychange`); un interceptor de 401 para todas las llamadas queda propuesto para C-08.

### 10. Pruebas

- **Unitarias backend:** hasher (hash ≠ contraseña, verify correcto/incorrecto/formato inválido, salts distintas), token (firma, alteración, `alg: none`, otro secreto, vencido con reloj fijo), cookie parser, `AuthService` (mismo error y llamada a `verify` en ambos casos inválidos), guard (público, health, sin cookie, token inválido, usuario inexistente), controlador (atributos de cookie, `Secure` según `APP_ENV`), logs sin credenciales.
- **Integración MariaDB real (`auth.integration-spec.ts`):** migración up/down, aprovisionamiento idempotente, login válido/inválido indistinguible, sesión, logout, `GET /api/pacientes` 401 sin cookie y 200 con cookie, `GET /api/health` sin cookie.
- **Frontend (Vitest + RTL):** validación de campos, mensaje genérico, redirección al destino, carga, redirección sin sesión, error con reintento, menú móvil, logout.
- **Manual:** `/acceso` y shell en 390×844 y 1440×900, sin Playwright.

## Planned File Surface

```
backend/src/database/migrations/2026112504000-C04-CreateUsers.ts
backend/src/modules/auth/auth.module.ts                    (modificado)
backend/src/modules/auth/provision-admin.ts                (modificado)
backend/src/modules/auth/user.entity.ts
backend/src/modules/auth/email-normalization.ts
backend/src/modules/auth/scrypt-password-hasher.ts
backend/src/modules/auth/session-token.service.ts
backend/src/modules/auth/session-cookie.ts
backend/src/modules/auth/session.guard.ts
backend/src/modules/auth/public-route.decorator.ts
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/dto/login.dto.ts
backend/src/modules/auth/testing/session-test.support-spec.ts
backend/src/modules/auth/*.spec.ts
backend/src/modules/auth/auth.integration-spec.ts
frontend/src/features/auth/{api.ts,types.ts,session.tsx,LoginForm.tsx,index.tsx,auth.test.tsx}
frontend/src/app/shell/{AppShell.tsx,RequireSession.tsx,ShellNavigation.tsx,app-shell.css,AppShell.test.tsx}
openspec/changes/c-04-authentication-and-app-shell/**
```

`frontend/src/app/routes/auth.routes.tsx` y los `package.json`/lockfiles no se modifican. `session.contract.ts` y `password-hasher.contract.ts` se conservan sin cambios.

## UI Mockups

- **Design system revision:** 1
- **Decision:** no (project policy `system-only`)
- **Preview:** manual
- **Visual verify:** pendiente; se registrará en `verification.md` con pantallas y viewports revisados

## Risks / Trade-offs

- **[El guard global rompe las pruebas de integración de C-02]** → helper exportado y CR-C04-01; Pablo decide si se adapta el harness antes o en el mismo merge.
- **[JWT propio puede tener errores criptográficos]** → alcance mínimo (HS256 fijo, sin aceptar `alg` del token), comparación timing-safe y pruebas negativas explícitas.
- **[No hay revocación antes de 8 h]** → aceptado en C-01; logout limpia la cookie del navegador.
- **[Sin rate limiting]** → riesgo aceptado para un MVP de un usuario en red local; queda registrado para C-08.
- **[`SameSite=Strict` con frontend y backend en orígenes distintos]** → en desarrollo `localhost:5173` y `localhost:3000` son el mismo sitio; un despliegue en dominios distintos requeriría revisar el contrato.
- **[Allowlist de `/api/health` por path]** → se cubre con prueba de integración; si cambia el prefijo global la prueba falla.

## Migration Plan

1. Agregar la migración C04 y ejecutar `npm run migration:run` en desarrollo.
2. Ejecutar `npm run provision:admin` con `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` ficticios.
3. Al integrar en `main`, el guard activa la protección; coordinar CR-C04-01 en el mismo ciclo.

Rollback: revertir la rama y ejecutar `migration:revert` sobre la base de desarrollo; no hay datos reales.
