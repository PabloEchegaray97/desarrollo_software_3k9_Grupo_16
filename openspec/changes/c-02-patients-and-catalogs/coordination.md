# Pedidos de coordinación de C-02 para Pablo

Superficies fuera del ownership de C-02 (`scripts/change-scope/scope-map.json`). C-02 **no** las edita desde su rama; este documento describe el problema, la evidencia y una propuesta verificada. La decisión y la implementación corresponden a Pablo.

Estado: pendientes de envío/respuesta (tarea 0.1 de `tasks.md`).

---

## CR-01 — El filtro global no publica códigos ni detalles de dominio

**Archivo:** `backend/src/shared/http/api-exception.filter.ts` (+ su spec).

**Problema.** `ApiExceptionFilter.toBody` reemplaza cualquier código por `VALIDATION_ERROR` (400) o `HTTP_<status>` y solo conserva `details` cuando `message` es un array. En consecuencia:

- `PATIENT_DNI_CONFLICT`, `PATIENT_POSSIBLE_DUPLICATE`, `*_NOT_FOUND` y `*_NAME_CONFLICT` llegan como `HTTP_409`/`HTTP_404`; el frontend no puede distinguir un DNI repetido de un posible duplicado.
- `PATIENT_POSSIBLE_DUPLICATE` llega **sin `details.candidatos`**.
- La spec principal `application-runtime` exige "código estable" en el contrato de errores; hoy no se cumple para errores de negocio.

**Evidencia (MariaDB 10.11 real).** Sin CR-01, las suites de integración de C-02 dan 27/36; las 9 fallas son exclusivamente la aserción de `code` (`HTTP_409`/`HTTP_404` en lugar del código de dominio).

**Propuesta verificada.** Si la respuesta de la `HttpException` trae un `code` en mayúsculas con guiones bajos, publicarlo junto con `details` (objeto o array de strings); en cualquier otro caso mantener el comportamiento actual.

Con este parche aplicado en un worktree temporal (no en la rama de C-02): unitarias backend **121/121** (incluida la spec actual del filtro), integración C-02 **36/36**.

```diff
-type NestErrorResponse = { message?: string | string[]; error?: string };
+type NestErrorResponse = { message?: string | string[]; error?: string; code?: unknown; details?: unknown };
+
+const DOMAIN_CODE = /^[A-Z][A-Z0-9_]*$/;
+
+function isApiErrorDetails(value: unknown): value is ApiErrorDetails {
+  return Array.isArray(value) ? value.every((item) => typeof item === 'string') : typeof value === 'object' && value !== null;
+}
@@ toBody(...)
     const safeMessage =
       typeof normalized.message === 'string' ? normalized.message : exception.message;
 
+    // CR-01: una HttpException de dominio puede declarar su propio código estable y detalles.
+    if (typeof normalized.code === 'string' && DOMAIN_CODE.test(normalized.code)) {
+      return {
+        error: {
+          code: normalized.code,
+          message: safeMessage,
+          requestId,
+          ...(isApiErrorDetails(normalized.details) ? { details: normalized.details } : {}),
+        },
+      };
+    }
```

Sugerencia: agregar a la spec del filtro un caso con `new HttpException({ code: 'X_CONFLICT', message: '...', details: { a: 1 } }, 409)`.

Impacto en otros changes: ninguno negativo; C-03…C-07 también podrán publicar códigos de dominio con el mismo mecanismo.

---

## CR-02 — La integración no descubre suites por módulo y no admite más de una suite

**Archivos:** `backend/test/jest.integration.config.cjs` y, según la opción elegida, `backend/package.json` (script `test:integration`) o `backend/src/database/data-source.ts`.

**Problema 1 — descubrimiento.** `testMatch` solo incluye `test/**/*.integration-spec.ts`, fuera del ownership de cada change. Las suites de C-02 viven en `backend/src/modules/{catalogs,patients}/*.integration-spec.ts`. Propuesta: agregar `'<rootDir>/src/**/*.integration-spec.ts'`.

**Problema 2 — varias suites en un proceso (afecta también a C-01).** Con `--experimental-vm-modules`, TypeORM carga migraciones y entidades por glob mediante `import()` dinámico; ese import queda ligado al entorno de la primera suite. La segunda suite del mismo proceso falla con `Test environment has been torn down`. Comprobado:

| Ejecución (con CR-01 y testMatch ampliado) | Resultado |
|---|---|
| `npm run test:integration` actual (`--runInBand`) | solo pasa la primera suite (2/38) |
| `--maxWorkers=1` sin `--runInBand` | solo pasa la primera suite |
| `--maxWorkers=3` (paralelo) | interferencias: las suites comparten la base y C-01 revierte la última migración |
| **un proceso por archivo, en serie** | **todas pasan** (C-01 2/2, catálogos 18/18, pacientes 18/18) |

La suite de C-01 (`test/database.integration-spec.ts`) también falla si no es la primera, por lo que el problema aparece en cuanto exista cualquier segunda suite de cualquier change.

**Opciones para decidir:**

1. *Script en serie, un proceso por archivo* (cambio mínimo): `test:integration` lista los `*.integration-spec.ts` y ejecuta Jest una vez por archivo, propagando el código de salida.
2. *Entidades y migraciones explícitas* en `data-source.ts` (importaciones estáticas en lugar de globs): elimina la causa, pero cada change debería registrar sus clases en un archivo compartido.

**Nota adicional.** `test/database.integration-spec.ts` usa `undoLastMigration()` dando por hecho que la última es la de C-01; desde C-02 revierte la última migración existente. La aserción sigue pasando, pero conviene que verifique por nombre.

---

## Hallazgo — el guard de scope no se ejecuta en Linux

**Archivo:** `scripts/change-scope/check.mjs` (última línea).

En Linux, `process.argv[1]` es una ruta absoluta POSIX (`/home/...`); `new URL('file:///' + ruta)` produce `file:////home/...`, que no coincide con `import.meta.url`, y `main()` nunca corre. `node scripts/change-scope/check.mjs --branch inexistente --base main` termina con código 0 y sin salida. El workflow usa `ubuntu-latest`, así que **hoy todo PR pasa el check sin validar**. `validateChanges` funciona invocado directamente (0 violaciones para C-02; 6 con la política de C-03).

Propuesta: comparar `fileURLToPath(import.meta.url)` con `path.resolve(process.argv[1])`, o usar `pathToFileURL(process.argv[1]).href === import.meta.url`.

---

## Observaciones menores de C-01

- `tsc --noEmit -p backend/tsconfig.json` reporta 3 errores de tipos preexistentes en `health.service.spec.ts` y `request-id.middleware.spec.ts` (Jest no los detecta porque transpila sin chequear).
- Al arrancar, Nest advierte `LegacyRouteConverter` por `consumer.apply(...).forRoutes('*')`; la forma vigente es `'{*path}'`.
- La configuración de Vitest no habilita `globals`, por lo que Testing Library no limpia el DOM entre tests; C-02 llama a `cleanup()` en sus archivos.
- `DataSource` no fija `timezone`; los `DATETIME` se interpretan con la zona del proceso. Conviene fijar `timezone: 'Z'` antes de C-05 (instantes en UTC).
