# Agenda odontológica — fundación técnica

Base del MVP para un odontólogo independiente, con backend NestJS, frontend React/Vite y MariaDB. C-01 define runtime, contratos, pruebas y ownership; no implementa todavía CRUD, disponibilidad, login funcional ni turnos.

## Requisitos

- Node.js 24 y npm 11.
- MariaDB accesible localmente o por red.
- OpenSpec CLI para el flujo SDD.

## Configuración

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Completar `DATABASE_*`, `AUTH_SECRET` y, para integración, `TEST_DATABASE_*` con credenciales locales. Usar una base de pruebas separada y vacía. No guardar secretos ni datos reales de pacientes en el repositorio.

La aplicación interpreta calendario en `America/Argentina/Buenos_Aires`; los futuros instantes persistidos serán UTC.

## Backend

```powershell
cd backend
npm install
npm run build
npm run dev
```

La API usa el prefijo `/api`. `GET /api/health` devuelve estado estable de aplicación/base y responde 503 si MariaDB no está disponible.

Comandos de verificación:

```powershell
npm test
npm run test:e2e
npm run test:integration
npm run migration:run
npm run migration:revert
```

`migration:run` y `migration:revert` usan TypeORM con `synchronize: false`. La suite de integración falla explícitamente si falta MariaDB; nunca sustituye el motor.

`npm run provision:admin` es solo el punto de extensión de C-04. Valida `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD`, pero C-01 no crea usuarios ni implementa login. El contrato fija scrypt y una cookie de sesión de ocho horas, `HttpOnly`, `SameSite=Strict` y `Secure` en producción.

## Frontend

```powershell
cd frontend
npm install
npm run build
npm test
npm run dev
```

El frontend consume `design-system/tokens.css`, no almacena JWT y envía cookies con `credentials: include`. Configurar `VITE_API_BASE_URL` si la API no está en `http://localhost:3000/api`.

## Estructura

- `backend/src/modules/`: fronteras de dominio preparadas para C-02 a C-07.
- `backend/src/shared/`: contratos HTTP y transaccionales pequeños.
- `frontend/src/features/`: ownership aislado por feature.
- `frontend/src/app/`: composición y shell compartidos.
- `design-system/`: tokens y contratos visuales aprobados.
- `scripts/change-scope/`: guard local y pruebas de ownership.
- `openspec/changes/`: artefactos SDD por change.

## Trabajo en equipo

Leer [CONTRIBUTING.md](CONTRIBUTING.md) antes de comenzar. Allí están la identificación obligatoria, las ramas exactas, el ciclo OpenSpec, los comandos de verificación y la apertura del pull request. El workflow `.github/workflows/change-scope.yml` valida los paths del PR, pero no crea ni fusiona el PR.

## Límites de C-01

C-01 no contiene entidades de pacientes/turnos, reglas de disponibilidad, solapamientos, autenticación funcional ni agenda. Esas capacidades pertenecen a C-02–C-07; C-08 integra y pule la interfaz final.
