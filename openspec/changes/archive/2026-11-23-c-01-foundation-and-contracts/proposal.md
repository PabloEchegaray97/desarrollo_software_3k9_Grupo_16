# Proposal

## Why

El proyecto necesita una base ejecutable y contratos estables antes de abrir los tres branches funcionales paralelos. C-01 reduce conflictos de integración al fijar runtime, persistencia, pruebas, composición por feature y límites de escritura verificables desde el primer pull request.

## What Changes

- Crear `backend/` con NestJS y TypeScript estricto, configuración validada, prefijo `/api`, contrato JSON de errores, healthcheck seguro y conexión comprobable a MariaDB real.
- Crear `frontend/` con React, Vite y TypeScript estricto, integrando Tailwind con los tokens aprobados de `design-system/` y dejando puntos de composición separados por feature.
- Usar npm y lockfiles reproducibles para backend y frontend; verificar compatibilidad antes de fijar versiones y justificar toda dependencia.
- Adoptar TypeORM con migraciones explícitas para MariaDB y establecer una frontera transaccional que C-05 utilizará para serializar la validación y escritura de turnos.
- Definir el contrato de autenticación que implementará C-04: JWT en cookie `HttpOnly`, sin registro público, y aprovisionamiento inicial idempotente de la primera cuenta mediante un comando controlado y variables de entorno.
- Preparar contratos tipados por dominio para pacientes, catálogos, disponibilidad, autenticación, creación de turnos, lifecycle, historial y agenda, sin implementar todavía sus reglas funcionales.
- Incorporar Jest para NestJS y Vitest + React Testing Library para React; las pruebas de integración usarán una instancia MariaDB real y la revisión visual será manual, sin Playwright.
- Crear un guard de pull requests que relacione `change/c-XX-<slug>` con paths autorizados y rechace cambios fuera del ownership, artefactos OpenSpec reservados y archivos globales protegidos.
- Documentar instalación, configuración, desarrollo y pruebas en `README.md`, y el flujo completo de branches, OpenSpec y pull requests en un `CONTRIBUTING.md` accesible desde la raíz.
- No implementar en C-01 los CRUD, la disponibilidad, el login funcional, el motor temporal, el lifecycle ni la agenda; pertenecen a C-02 a C-07.

## Capabilities

### New Capabilities

- `application-runtime`: Arranque reproducible de backend y frontend, validación de configuración, conectividad MariaDB, healthcheck y fronteras HTTP compartidas.
- `delivery-scope-guard`: Validación automática del ownership de archivos según la rama de cada change y protección de superficies reservadas para integración.

### Modified Capabilities

Ninguna; todavía no existen specs principales.

## Impact

- Nuevos proyectos en `backend/` y `frontend/`, manifests npm, lockfiles, ejemplos de entorno y documentación raíz.
- Nuevas configuraciones de NestJS, React/Vite, Tailwind, TypeORM, Jest, Vitest y React Testing Library.
- Nuevos contratos y puntos de composición bajo `backend/src/shared/`, `backend/src/modules/`, `frontend/src/shared/`, `frontend/src/app/` y `frontend/src/features/`.
- Nuevo control de scope bajo `.github/workflows/change-scope.yml` y `scripts/change-scope/**`, acompañado por `CONTRIBUTING.md` para explicar cómo iniciar, publicar y entregar cada change.
- Define decisiones técnicas que condicionan C-02 a C-08, pero no cambia todavía comportamiento funcional de pacientes o turnos.
