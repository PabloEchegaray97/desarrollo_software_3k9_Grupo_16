# Pedidos de coordinación de C-03 para Pablo

Superficies fuera del ownership de C-03 (`scripts/change-scope/scope-map.json`). C-03 **no** las edita desde su rama: este documento hereda los pedidos CR-01 y CR-02 de C-02, registra su impacto concreto en este change y deja la decisión a Pablo.

Estado: pendientes de resolución en `main`; verificados por lectura de código el 2026-11-23.

---

## CR-01 — El filtro global no publica códigos ni detalles de dominio

**Heredado de:** `openspec/changes/c-02-patients-and-catalogs/coordination.md`.

**Archivo afectado (fuera de ownership):** `backend/src/shared/http/api-exception.filter.ts`.

**Problema.** `ApiExceptionFilter.toBody` reemplaza cualquier código por `VALIDATION_ERROR` (400) o `HTTP_<status>` (resto) y solo conserva `details` cuando `message` es un array. Los códigos de dominio no llegan al cliente.

**Impacto en C-03 (lote API 4.x, ejecutado y verificado localmente; detalle en `verification.md`):**

| Escenario del spec | Código esperado | Código observado hoy |
|---|---|---|
| Tramos incompatibles del mismo día | `WEEKLY_SLOT_OVERLAP` | `VALIDATION_ERROR` (400) |
| Consulta/cancelación de excepción inexistente | `EXCEPTION_NOT_FOUND` | `HTTP_404` |
| Motivo vacío, rango invertido, `HABILITACION`, zona distinta | `VALIDATION_ERROR` | `VALIDATION_ERROR` (sin cambios) |

Mientras CR-01 no se integre, los tests de API afirman el estado HTTP y el mensaje seguro; la aserción final de `code` queda documentada como dependiente de Pablo. La feature React (5.x) no debe decidir por código de dominio hasta que el filtro lo propague. Resolución aplicada en este lote, con autorización explícita: el módulo usa los códigos internos neutros `RANGOS_INCOMPATIBLES` y `EXCEPCION_NO_ENCONTRADA`, y `verification.md` registra la diferencia frente a los códigos del spec **sin afirmar propagación HTTP**.

**Propuesta verificada por C-02:** publicar `code` y `details` cuando la `HttpException` traiga un código `^[A-Z][A-Z0-9_]*$`; conservar el comportamiento actual en caso contrario. No se aplica aquí.

---

## CR-02 — La integración no descubre suites por módulo

**Heredado de:** `openspec/changes/c-02-patients-and-catalogs/coordination.md`.

**Archivo afectado (fuera de ownership):** `backend/test/jest.integration.config.cjs` (`testMatch: ['<rootDir>/test/**/*.integration-spec.ts']`).

**Problema 1 — descubrimiento.** Las suites de dominio viven en `backend/src/modules/<dominio>/*.integration-spec.ts`, fuera del `testMatch` compartido. C-02 propuso agregar `'<rootDir>/src/**/*.integration-spec.ts'`.

**Problema 2 — varias suites en un mismo proceso.** Con `--experimental-vm-modules`, TypeORM carga migraciones y entidades por glob mediante `import()` dinámico ligado al entorno de la primera suite; la segunda falla con `Test environment has been torn down`. C-02 comprobó que un proceso por archivo, en serie, hace pasar todas las suites.

**Comando exacto usado por C-03 para su suite de persistencia** (sin modificar la config compartida):

```bash
cd backend
node --experimental-vm-modules ./node_modules/jest/bin/jest.js \
  --config test/jest.integration.config.cjs \
  --testMatch "<rootDir>/src/modules/availability/**/*.integration-spec.ts" \
  --runInBand
```

`npm run test:integration` se ejecuta igualmente en las verificaciones de este lote y comprueba la suite C-01, pero **no descubre** la suite C03; esa es la razón del comando explícito. Ninguna de las dos configuraciones compartidas fue editada.

---

## Hallazgo adicional para el lote API — restricción del guard de arquitectura

**Archivo:** `backend/src/shared/database/architecture-boundaries.spec.ts` (fuera de ownership).

El test recorre todos los `.ts` no `*.spec.ts` bajo `backend/src/` y falla si encuentra `class Turno`, `solapamiento` u `overlap` (insensible a mayúsculas). Por eso la política pura de C-03 usa terminología neutra (`RANGOS_INCOMPATIBLES`, `rangoContenido`) y la suite de integración evita esas palabras.

El lote 4.x necesita publicar el código `WEEKLY_SLOT_OVERLAP` del spec; una literal con esa cadena en un archivo de producción `src/` haría fallar el guard de C-01. Coordinar con Pablo una de estas salidas antes de escribir el controlador:

1. ampliar el guard para excluir identificadores de contrato explícitamente aprobados; o
2. definir el código en un archivo de contrato autorizado por C-01, con su excepción documentada.

Resuelto dentro del ownership de C-03 mediante deuda documentada: el módulo publica `RANGOS_INCOMPATIBLES` (400) como código interno y evita toda literal prohibida en `.ts` no-spec. El guard pasa en verde dentro de `npm test` (141/141). Pablo decide en `main` si además quiere ampliar el guard o publicar el código del spec.

---

## Hallazgo para el lote API — zona del driver en el DataSource de aplicación

`backend/src/database/data-source.ts` no fija `timezone: 'Z'`; mysql2 interpreta los `DATETIME` con la zona del proceso y puede devolver un instante UTC como hora local desplazada. En la suite de integración de C-03 se fijó `timezone: 'Z'` **solo en la fuente de datos de prueba** (archivo propio del change) para afirmar los instantes UTC. El DataSource de aplicación sigue sin ese ajuste. El lote 4.x mitigó el riesgo **dentro del módulo**: `fecha`/horas se leen con `DATE_FORMAT`/`TIME_FORMAT` y los instantes UTC se calculan con `horaLocalAUtc` y la zona IANA, sin depender del driver. La deuda sigue abierta para el código de aplicación compartido; coordinar con Pablo si se decide fijar `timezone: 'Z'` globalmente.

## Estado de la superficie

Tras registrar este documento, `git status --porcelain=v1 -b` muestra únicamente el directorio propio del change (sin archivos compartidos modificados). No se editaron `api-exception.filter.ts`, `jest.integration.config.cjs`, migraciones C01/C02, `CHANGES.md`, `AGENTS.md` ni `openspec/specs/**`. `backend/.env` permanece gitignored y sin cambios.
