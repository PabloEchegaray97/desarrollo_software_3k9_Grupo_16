# Spec Delta

## Purpose

Protege la información del consultorio mediante una única cuenta del odontólogo, creada por aprovisionamiento inicial y usada para iniciar una sesión de ocho horas transportada en una cookie segura.

## ADDED Requirements

### Requirement: Cuenta única aprovisionada sin registro público
El sistema SHALL crear la cuenta del odontólogo exclusivamente mediante el comando de aprovisionamiento inicial, que lee `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`, normaliza el email a minúsculas sin espacios, persiste solamente un hash `scrypt` con salt aleatoria y es idempotente por email. El sistema MUST NOT exponer un endpoint de registro.

#### Scenario: Primer aprovisionamiento
- **GIVEN** una base sin usuarios y las variables con `Odontologo.Ficticio@Example.test` y una contraseña de 12 o más caracteres
- **WHEN** se ejecuta `npm run provision:admin`
- **THEN** se crea un usuario con email `odontologo.ficticio@example.test`, rol `ODONTOLOGO` y un hash distinto de la contraseña, y la salida no contiene la contraseña ni el hash

#### Scenario: Aprovisionamiento repetido
- **GIVEN** que ya existe un usuario con ese email
- **WHEN** se ejecuta nuevamente el comando
- **THEN** no se crea otro usuario ni se modifica el hash existente y el proceso termina sin error

#### Scenario: Variables ausentes o contraseña corta
- **WHEN** falta alguna variable o la contraseña tiene menos de 12 caracteres
- **THEN** el comando termina con error que identifica la variable, sin imprimir valores, y no escribe en la base

#### Scenario: Registro público inexistente
- **WHEN** se envía `POST /api/auth/registro`
- **THEN** el backend responde 404 y no crea usuarios

### Requirement: Inicio de sesión con mensaje genérico
El sistema SHALL aceptar `POST /api/auth/login` con `email` y `contrasena` obligatorios, verificar la contraseña contra el hash con comparación timing-safe y, si es válida, emitir la cookie `session` con un JWT HS256 firmado con `AUTH_SECRET`, `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=28800` y `Secure` cuando `APP_ENV=production`. La respuesta MUST NOT incluir la contraseña, el hash ni el token en el cuerpo.

#### Scenario: Acceso válido
- **GIVEN** la cuenta aprovisionada
- **WHEN** se envía el email (con cualquier combinación de mayúsculas y espacios) y la contraseña correcta
- **THEN** responde 200 con `{ usuario: { id, email } }` y una cabecera `Set-Cookie` de `session` con los atributos indicados

#### Scenario: Acceso inválido indistinguible
- **WHEN** se envía un email no registrado o una contraseña incorrecta para el email registrado
- **THEN** ambas respuestas son 401 con el mismo cuerpo de error, el mismo mensaje genérico y sin cookie de sesión

#### Scenario: Datos faltantes
- **WHEN** falta el email, falta la contraseña o el email no tiene formato válido
- **THEN** responde 400 con código `VALIDATION_ERROR` sin revelar si existe una cuenta

#### Scenario: Credenciales fuera de los logs
- **WHEN** ocurre cualquier intento de acceso, válido o inválido
- **THEN** ningún log técnico contiene el email, la contraseña, el hash ni el token

### Requirement: Sesión vigente, expiración y cierre
El sistema SHALL informar la sesión actual en `GET /api/auth/sesion` y SHALL cerrar la sesión en `POST /api/auth/logout` eliminando la cookie. Un token vencido, alterado, firmado con otro secreto o con un algoritmo distinto de HS256 MUST considerarse ausente.

#### Scenario: Sesión vigente
- **GIVEN** una cookie de sesión válida
- **WHEN** se consulta `GET /api/auth/sesion`
- **THEN** responde 200 con `{ usuario: { id, email } }`

#### Scenario: Sin sesión o token inválido
- **WHEN** se consulta sin cookie, con un token vencido, con la firma alterada o con `alg` distinto de HS256
- **THEN** responde 401 con el contrato común de error

#### Scenario: Usuario eliminado
- **GIVEN** un token válido cuyo usuario ya no existe
- **WHEN** se consulta `GET /api/auth/sesion`
- **THEN** responde 401

#### Scenario: Cierre de sesión
- **WHEN** se envía `POST /api/auth/logout`, con o sin sesión
- **THEN** responde 204 y una cabecera `Set-Cookie` que vacía `session` con `Max-Age=0`

### Requirement: Protección de la API
El sistema SHALL exigir una sesión válida en todos los endpoints bajo `/api`, excepto `GET /api/health`, `POST /api/auth/login` y `POST /api/auth/logout`.

#### Scenario: Recurso protegido sin sesión
- **WHEN** se consulta `GET /api/pacientes` sin cookie de sesión
- **THEN** responde 401 con el contrato común de error y no ejecuta el controlador

#### Scenario: Recurso protegido con sesión
- **GIVEN** una cookie de sesión válida
- **WHEN** se consulta `GET /api/pacientes`
- **THEN** la solicitud llega al controlador correspondiente

#### Scenario: Healthcheck público
- **WHEN** se consulta `GET /api/health` sin sesión
- **THEN** responde según `application-runtime`, sin exigir autenticación
