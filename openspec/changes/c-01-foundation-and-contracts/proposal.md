# Proposal

## Why

Después de integrar C-02, C-03 y C-04 se comprobaron tres desvíos de la fundación compartida que impiden cerrar el primer gate: los errores de dominio pierden su código y detalles, el comando de integración no descubre ni aísla todas las suites MariaDB y el guard de scope no ejecuta su entrada en Linux. Deben corregirse antes de validar y archivar C-02/C-04 o iniciar C-05.

## What Changes

- Preservar códigos de dominio válidos y detalles seguros emitidos por `HttpException`, manteniendo el contrato genérico para validaciones y errores técnicos.
- Hacer que `npm run test:integration` descubra las suites bajo `backend/test/**` y `backend/src/**`, y las ejecute en procesos Jest separados y secuenciales contra MariaDB real.
- Evitar que la suite histórica de C-01 revierta por posición una migración posterior perteneciente a otro change.
- Reemplazar la comprobación destructiva de migración de C-02 por una verificación acumulativa de su registro y sus tablas, preservando C-03/C-04.
- Adaptar los harnesses de integración de C-02 y C-03 para que sus solicitudes a endpoints protegidos usen una sesión ficticia válida provista por C-04, sin desactivar el guard.
- Corregir la detección del entrypoint de `scripts/change-scope/check.mjs` para que el mismo comando funcione en Windows y Linux, con pruebas de ejecución directa.
- Documentar la evidencia necesaria para que C-02 y C-04 puedan retomar sus verificaciones pendientes.

No hay cambios de UI, migraciones, dependencias, contratos REST públicos ni reglas de negocio.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. Este seguimiento corrige implementaciones que ya incumplen `application-runtime` y `delivery-scope-guard`; no modifica sus requisitos aprobados. Por eso el change declara `skip_specs: true`.

## Impact

- Backend compartido: `backend/src/shared/http/api-exception.filter.ts` y sus pruebas.
- Harness de integración: `backend/test/jest.integration.config.cjs`, `backend/test/database.integration-spec.ts`, `backend/package.json` y un runner local bajo `backend/test/`.
- Harnesses funcionales: soportes y suites de integración de `backend/src/modules/catalogs/**`, `backend/src/modules/patients/**` y `backend/src/modules/availability/**`, para adjuntar autenticación ficticia y eliminar supuestos destructivos sobre el orden global de migraciones.
- Guard de contribución: `scripts/change-scope/check.mjs` y sus pruebas.
- Consumidores desbloqueados: verificaciones MariaDB de C-02/C-03/C-04 y control de paths en pull requests.
- Dependencias externas: ninguna nueva.
