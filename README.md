# OdoSoft

Agenda web para un odontólogo independiente. El MVP integra pacientes, prestaciones, sillones, disponibilidad, turnos sin solapamientos, autenticación e historial sobre NestJS, React y MariaDB real.

## Requisitos

- Node.js 24 y npm 11.
- MariaDB accesible localmente o por red.
- PowerShell para los comandos de esta guía.
- OpenSpec CLI solamente para continuar el flujo SDD del repositorio.

La aplicación interpreta el calendario con America/Argentina/Buenos_Aires y persiste los instantes como UTC.

## 1. Preparar los archivos locales

Desde la raíz:

    Copy-Item backend\.env.example backend\.env
    Copy-Item frontend\.env.example frontend\.env

Completar en backend/.env las credenciales de desarrollo DATABASE_*, las credenciales de integración TEST_DATABASE_*, un AUTH_SECRET de al menos 32 caracteres y las credenciales ficticias de la cuenta inicial. No reutilizar la base de desarrollo como base de integración.

Los archivos .env están ignorados por Git. Solo se versionan los ejemplos sin secretos.

## 2. Preparar MariaDB

Crear dos bases separadas y otorgar permisos a usuarios locales adecuados:

    CREATE DATABASE turnos_odontologia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE DATABASE turnos_odontologia_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

La creación de usuarios y contraseñas depende de la instalación local. No pegar credenciales reales en comandos versionados, capturas, issues o logs.

## 3. Instalar y preparar el backend

    Set-Location backend
    npm ci
    npm run migration:run
    npm run provision:admin
    npm run seed:demo

- migration:run aplica migraciones TypeORM con synchronize desactivado.
- provision:admin crea de forma idempotente la cuenta definida por INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD.
- seed:demo agrega datos exclusivamente ficticios mediante UUID reservados y no borra registros ajenos. Es opt-in y no se ejecuta al iniciar la API.

Para iniciar la API:

    npm run dev

La API queda en http://localhost:3000/api. GET /api/health informa el estado de aplicación y MariaDB.

## 4. Instalar e iniciar el frontend

En otra terminal, desde la raíz:

    Set-Location frontend
    npm ci
    npm run dev

Vite informa la URL local, normalmente http://localhost:5173. El frontend usa cookies de sesión con credentials: include; VITE_API_BASE_URL debe apuntar al prefijo /api del backend.

## Verificación

Backend, desde backend/:

    npm run lint
    npm test
    npm run test:e2e
    npm run test:integration
    npm run build

Frontend, desde frontend/:

    npm run lint
    npm test
    npm run build

Las pruebas de integración requieren TEST_DATABASE_*, usan MariaDB real y pueden migrar y limpiar únicamente fixtures ficticios de la base de integración. Nunca se sustituye MariaDB por SQLite o una base en memoria.

La revisión visual se realiza manualmente, sin Playwright, en 390×844 y 1440×900, con tema claro y oscuro. No se deben versionar dist/, coverage/ ni capturas generadas.

## Comandos útiles

Desde backend/:

    npm run migration:revert
    npm run seed:demo

El primero revierte la última migración de desarrollo. El segundo vuelve a preparar los datos ficticios sin duplicarlos.

## Estructura

- backend/src/modules/: dominios NestJS y reglas de negocio.
- backend/test/: pruebas E2E e integración con MariaDB.
- frontend/src/app/: composición, rutas, shell, tema y dashboard.
- frontend/src/features/: features por dominio.
- design-system/: sistema visual OdoSoft aprobado.
- knowledge-base/: fuente de verdad del producto.
- openspec/changes/: cambios SDD y su evidencia.
- docs/demo/: guion de entrega cuando C-08 lo complete.

## Trabajo en equipo

Leer [CONTRIBUTING.md](CONTRIBUTING.md) y [CHANGES.md](CHANGES.md) antes de editar. Pablo integra las ramas terminadas en main; los agentes no hacen commit, push o merge sin pedido explícito.

El workflow de scope valida paths de los pull requests, pero no reemplaza la revisión humana ni crea o fusiona PRs.
