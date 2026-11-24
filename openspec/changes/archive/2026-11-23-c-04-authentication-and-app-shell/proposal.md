# Proposal

## Why

Toda la información del consultorio (pacientes, catálogos y, luego, turnos) queda expuesta en la API sin control de acceso. C-01 fijó el contrato de sesión (JWT de 8 h en cookie `HttpOnly`/`SameSite=Strict`, contraseñas con `scrypt`) y dejó vacíos `AuthModule`, `AuthPage` y el shell; C-04 los completa ahora para que C-05 a C-07 partan de una API protegida y de una navegación estable.

## What Changes

- Resolver **P1-06**: la primera y única cuenta se crea con `npm run provision:admin` (idempotente por email, nunca automática ni con registro público) y la sesión es el JWT en cookie definido en C-01, sin refresh token.
- Agregar una migración `C04` con la tabla `users`: email normalizado único, hash de contraseña y rol fijo `ODONTOLOGO`.
- Implementar en `backend/src/modules/auth/**`:
  - derivación y verificación `scrypt` con salt aleatoria y comparación timing-safe;
  - firma/verificación JWT HS256 con `node:crypto` y `AUTH_SECRET` (sin dependencias nuevas);
  - `POST /api/auth/login`, `GET /api/auth/sesion` y `POST /api/auth/logout`;
  - un guard global que exige sesión válida en toda la API, salvo `GET /api/health` y los endpoints públicos de acceso;
  - persistencia real en `provision-admin.ts`.
- Responder 401 con un mensaje genérico idéntico para email inexistente y contraseña incorrecta, con costo de verificación equivalente; nunca devolver ni registrar email, contraseña ni hash.
- Frontend:
  - pantalla `/acceso` con email y contraseña, errores por campo y mensaje genérico;
  - el shell verifica la sesión, redirige a `/acceso` cuando no existe y vuelve a la ruta pedida después de ingresar;
  - shell responsive con navegación a Agenda, Pacientes y Configuración (Prestaciones y sillones, Disponibilidad), identificación de la cuenta y botón Cerrar sesión.
- Pruebas unitarias, de API contra MariaDB real y de componentes, con credenciales ficticias.
- **BREAKING (interno):** al activarse el guard global, toda llamada a `/api/**` sin sesión responde 401. Afecta las pruebas de integración de C-02 (ver Impact).
- Fuera de alcance: registro público, recuperación o cambio de contraseña, refresh/revocación de tokens, varios usuarios o roles, limitación de intentos, interceptor global de 401 en `frontend/src/shared/**`.

## Capabilities

### New Capabilities

- `session-access`: Cuenta única del odontólogo, aprovisionamiento inicial, inicio/consulta/cierre de sesión con cookie y protección de la API.
- `app-shell`: Pantalla de acceso, protección de navegación y estructura responsive de navegación principal del frontend.

### Modified Capabilities

Ninguna. `application-runtime` no cambia: el healthcheck sigue público y el contrato de errores se reutiliza.

## Impact

- **Código propio:** `backend/src/modules/auth/**`, `frontend/src/features/auth/**`, `frontend/src/app/shell/**`, `frontend/src/app/routes/auth.routes.tsx`, migración nueva `*-C04-*.ts` y este directorio OpenSpec.
- **Dependencias:** ninguna nueva. Se usan `node:crypto`, `typeorm`, `class-validator` y `react-router-dom` ya instalados.
- **API nueva:** `/api/auth/login`, `/api/auth/sesion`, `/api/auth/logout`. El resto de `/api/**` pasa a requerir sesión.
- **Consumidores:** C-05, C-06 y C-07 heredan la protección sin código adicional. El frontend ya envía `credentials: 'include'` desde `shared/api/client.ts`.
- **Pedidos de coordinación a Pablo (bloquean tareas puntuales del Apply, no la propuesta):**
  1. **CR-C04-01 — pruebas de integración de C-02.** `catalogs/testing/integration-harness.support-spec.ts` (ownership C-02) hace solicitudes sin sesión; con el guard reciben 401. C-04 exporta `auth/testing/session-test-support.ts` para emitir una cookie de sesión ficticia; se pide que Paula o Pablo (C-08) la usen en el harness. No se edita el harness desde esta rama.
  2. **CR-C04-02 — descubrimiento de integración por módulo.** Igual que CR-02 de C-02: `backend/test/jest.integration.config.cjs` solo busca `test/**`; `auth.integration-spec.ts` vive en el módulo. Si CR-02 ya se integró, este pedido queda cubierto.
  3. **CR-01 de C-02 (pendiente en `main`)** sigue vigente: sin él el 401 de acceso llega con código `HTTP_401`. C-04 lo acepta como contrato del MVP (mensaje genérico) y no depende de un código propio.
  4. **Sugerencia para C-08:** interceptor de 401 en `frontend/src/shared/api/client.ts` para redirigir a `/acceso` cuando la sesión vence durante el uso.
- **Riesgo de contrato:** las rutas `/api/auth/*`, el nombre de cookie `session` y la forma `{ usuario: { id, email } }` pasan a ser contrato consumido por el shell y por C-08.
