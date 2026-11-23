# Tasks

## 1. Scaffolding reproducible

- [x] 1.1 Verificar versiones estables compatibles y justificar dependencias antes de crear `backend/` con NestJS, npm y TypeScript estricto; comprobar `npm install` y `npm run build` con su lockfile.
- [x] 1.2 Crear `frontend/` con React, Vite, npm y TypeScript estricto sin `any`; comprobar `npm install` y `npm run build` con su lockfile.
- [x] 1.3 Completar `.gitignore`, ejemplos de entorno sin secretos y scripts homogéneos de desarrollo/build/test; verificar con `git check-ignore` que `.env` queda excluido y `.env.example` versionable.

## 2. Runtime y persistencia del backend

- [x] 2.1 Implementar validación tipada de configuración para aplicación, zona, MariaDB, pruebas y secreto de auth; cubrir configuración válida, clave faltante y ausencia de valores sensibles con Jest.
- [x] 2.2 Configurar TypeORM para MariaDB con `synchronize: false`, DataSource de migraciones y convención `<timestamp>-CXX-*`; ejecutar una migración fundacional reversible contra MariaDB real y comprobar que no existe fallback de motor.
- [x] 2.3 Implementar `/api/health` con estado de aplicación/base y respuestas 200/503 seguras; verificar ambos escenarios mediante tests de API con Supertest y MariaDB real cuando corresponda.
- [x] 2.4 Implementar request ID, filtro global y contrato `{ error: { code, message, requestId, details? } }`; verificar errores de validación e internos sin stack, secretos ni payloads personales.
- [x] 2.5 Crear `AppModule` y módulos componibles vacíos para patients, catalogs, availability, auth y appointments con submódulos creation/lifecycle/history/agenda; comprobar mediante build/test que todos se importan sin implementar reglas funcionales.
- [x] 2.6 Definir la frontera transaccional y contratos tipados para el lock futuro de `ConfiguracionAgenda`; verificar con tests unitarios que C-01 no introduce entidades Turno ni lógica de solapamientos.

## 3. Runtime y composición del frontend

- [x] 3.1 Configurar Tailwind y el stylesheet raíz para consumir `design-system/tokens.css` sin duplicar hexadecimales; verificar con build y una inspección del CSS importado.
- [x] 3.2 Crear shell base, estilos compartidos y componentes mínimos de estados carga/vacío/error usando los radios y foco aprobados; verificar sus estados con Vitest y React Testing Library.
- [x] 3.3 Crear agregador de rutas y exports vacíos tipados para patients, catalog, availability, auth, appointment creation/lifecycle y agenda; verificar que agregar contenido a una feature no exige editar `main.tsx`.
- [x] 3.4 Crear cliente HTTP y tipos compartidos para el contrato de error/request ID sin almacenar JWT; verificar serialización de éxito/error y credenciales de cookie con tests unitarios.
- [x] 3.5 Revisar manualmente el shell en 390×844 y 1440×900 sin Playwright y registrar pantalla, viewport, foco, overflow y resultado en la documentación de C-01.

## 4. Contratos de autenticación y aprovisionamiento inicial

- [x] 4.1 Definir contratos y configuración para JWT de ocho horas en cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción, sin implementar login; verificar tipos y validaciones con tests unitarios.
- [x] 4.2 Preparar el comando idempotente `provision:admin` como punto de extensión documentado para C-04, con `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` y derivación `scrypt`; verificar que C-01 no crea usuarios ni registra credenciales.

## 5. Guard de ownership para pull requests

- [x] 5.1 Crear `scripts/change-scope/scope-map.json` con las ocho ramas exactas, paths propios, compartidos y protegidos derivados de `CHANGES.md`; verificar que cada C-XX tenga una única política.
- [x] 5.2 Implementar `scripts/change-scope/check.mjs` con Node estándar para evaluar `git diff --name-status`; verificar branches permitidos, desconocidos e invasión de otro dominio mediante tests automatizados.
- [x] 5.3 Implementar las reglas de migraciones add-only con ID de change y protección de specs/archive/estado/documentos globales; verificar casos positivos y negativos en `check.test.mjs`.
- [x] 5.4 Crear `.github/workflows/change-scope.yml` usando el mismo verificador y el diff contra la base del PR; validar sintaxis y ejecutar localmente el comando equivalente sobre fixtures de diff.
- [x] 5.5 Crear `CONTRIBUTING.md` en la raíz con identificación, actualización de `main`, creación/recuperación de rama, ciclo OpenSpec, verificación, commit/push humano, apertura del PR, interpretación del guard y entrega a Pablo; comprobar que los comandos y nombres coincidan con `CHANGES.md`.

## 6. Documentación e integración de la fundación

- [x] 6.1 Documentar en `README.md` instalación, variables, comandos, MariaDB de pruebas, estructura y límites de C-01, enlazando `CONTRIBUTING.md` como guía de branches y PR; verificar los comandos documentados desde las carpetas correspondientes.
- [x] 6.2 Ejecutar builds y suites de backend/frontend, integración MariaDB, tests del guard y revisión de archivos sensibles; registrar resultados diferenciando pruebas automáticas de la verificación visual manual.
- [x] 6.3 Comparar el diff final con `Planned File Surface`, confirmar que no hay lógica funcional C-02–C-07 ni artefactos generados versionados y actualizar solamente las casillas realmente verificadas.

## Workflow follow-up

- Solicitar revisión humana del resultado de Apply antes de autorizar cualquier commit o push.
- Después de integrar C-01 en `main`, Pablo sincroniza sus specs y archiva el change desde `main`.
- Crear C-02, C-03 y C-04 únicamente desde el `main` actualizado y con el guard de scope activo.
