# Verificación de C-01

## Automática

Ejecutado el 2026-11-23:

| Verificación | Resultado |
|---|---|
| Backend build | Aprobado |
| Backend unitarias | 6 suites, 14 tests aprobados |
| Backend API degradada | 1 suite, 1 test aprobado; `/api/health` devuelve 503 seguro sin DB |
| MariaDB real | 2 tests aprobados: migración/reversión y health HTTP 200 |
| Frontend build | Aprobado |
| Frontend unitarias | 3 archivos, 7 tests aprobados |
| Guard de scope | 5 tests aprobados; fixture permitido aprobado y fixture invasivo rechazado |
| Workflow YAML | Sintaxis parseada correctamente |
| `.env` / `.env.example` | secretos ignorados; ejemplos versionables |
| `provision:admin` | rechaza configuración faltante, acepta datos ficticios y no registra credenciales |
| Auditoría estática | sin `any`, sin fallback SQLite/memoria y sin `.env` versionado |

La matriz completa se repitió al cierre: backend build, 14 unitarias, API 503, 2 integraciones MariaDB, frontend build, 7 unitarias y 5 pruebas del guard; todas aprobaron.

La integración usó MariaDB 12.3 real en `127.0.0.1:3306`. La base de pruebas declarada en `TEST_DATABASE_NAME` fue creada sin tocar otras bases; la migración dejó la base nuevamente revertida. No se usó otro motor ni se registraron credenciales.

## Auditoría final de superficie

- 88 archivos modificados revisados: todos pertenecen a la superficie planificada o al ownership técnico explícito de C-01.
- No hay entidades, endpoints ni reglas funcionales de C-02–C-07; solamente módulos y pantallas placeholder de composición.
- No hay `dist/`, `coverage/`, `build/`, `*.tsbuildinfo` ni `.env` locales versionados.
- Se eliminaron archivos de ejemplo de Nest/Vite y se conservaron únicamente fuentes, configuración, pruebas y documentación necesarias.

## Visual manual — aprobada por el usuario

No se usó Playwright por decisión del proyecto. El usuario confirmó el 2026-11-23 que el frontend funciona después de la revisión manual solicitada.

| Pantalla | Viewport | Foco visible | Overflow | Resultado |
|---|---:|---|---|---|
| Shell / inicio | 390×844 | Sin incidencias informadas | Sin incidencias informadas | Aprobado por el usuario |
| Shell / inicio | 1440×900 | Sin incidencias informadas | Sin incidencias informadas | Aprobado por el usuario |

La comprobación fue manual y no constituye una captura automatizada. Los builds y tests verifican por separado la importación de tokens y los estados compartidos.
