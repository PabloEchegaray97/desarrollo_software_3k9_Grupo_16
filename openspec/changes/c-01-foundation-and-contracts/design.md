# Design

## Context

El repositorio contiene Discovery, KB, roadmap, OpenSpec y un design system aprobado, pero todavía no contiene aplicaciones ejecutables. C-01 debe crear una base común antes de habilitar C-02, C-03 y C-04; ver `proposal.md` para la motivación y las dos specs de este change para los contratos verificables.

Las restricciones determinantes son: TypeScript estricto sin `any`, MariaDB real, reglas temporales en NestJS, instantes UTC con zona `America/Argentina/Buenos_Aires`, ausencia de datos reales o secretos, npm con lockfiles, revisión visual manual sin Playwright y ownership estricto por change.

## Goals / Non-Goals

**Goals:**

- Crear dos aplicaciones independientes y reproducibles bajo `backend/` y `frontend/`.
- Congelar las fronteras globales antes del primer fork para que las features se conecten sin editar entrypoints compartidos.
- Resolver P1-05 y P1-06 con decisiones implementables por C-04 y C-05.
- Hacer comprobable el ownership de branches mediante el mismo verificador local y de pull requests.
- Dejar contratos y pruebas fundacionales suficientemente pequeños para completarse antes de abrir trabajo paralelo.

**Non-Goals:**

- Implementar pacientes, prestaciones, sillones, disponibilidad, autenticación funcional, turnos, lifecycle, historial o agenda.
- Crear registro público, refresh tokens, recuperación de contraseña o múltiples roles.
- Implementar todavía la política temporal o las transacciones de alta de turnos; C-01 define su frontera y C-05 las implementa.
- Agregar Docker como requisito obligatorio, servicios externos, telemetría remota ni pruebas visuales automatizadas.
- Cambiar el design system aprobado o crear mockups por pantalla.

## Decisions

### 1. Dos proyectos npm separados

Se crearán `backend/` con NestJS y `frontend/` con React + Vite, cada uno con su `package.json` y `package-lock.json`. Ambos usarán TypeScript estricto y scripts homogéneos: `dev`, `build`, `test` y variantes de integración cuando correspondan.

**Alternativas consideradas:** un workspace raíz reduciría comandos, pero convertiría su manifest y lockfile en otra superficie compartida durante los branches paralelos. Dos proyectos mantienen ownership y fallas aisladas.

Las versiones estables compatibles se verificarán durante Apply y quedarán fijadas por manifests y lockfiles; no se usarán rangos flotantes fuera de lo que npm registre de forma reproducible.

### 2. Composición preparada antes del fork

NestJS tendrá `AppModule` y módulos vacíos importables para `patients`, `catalogs`, `availability`, `auth` y `appointments`. `appointments` compondrá submódulos separados para `creation`, `lifecycle`, `history` y `agenda`. Los owners posteriores completarán solamente su subárbol; no necesitarán editar `app.module.ts`.

React tendrá un agregador de rutas que consume exports de rutas por feature. C-01 crea exports vacíos tipados para patients, catalog, availability, auth, appointment creation/lifecycle y agenda. C-04 será dueño del shell y de `auth.routes.tsx`; los demás owners completarán sus archivos de feature.

**Alternativa considerada:** permitir que cada branch agregue imports a entrypoints globales es más simple al inicio, pero produce conflictos deterministas al fusionar trabajo paralelo.

### 3. Contratos cercanos a cada dominio

Los DTO y tipos específicos vivirán dentro de su módulo/feature. `backend/src/shared/**` y `frontend/src/shared/**` contendrán únicamente contratos transversales pequeños: error HTTP, request ID, paginación y clientes base. OpenSpec conserva el contrato conductual entre ambos lados; no se introduce un tercer paquete de tipos compartidos en C-01.

**Alternativa considerada:** un paquete TypeScript común elimina duplicación, pero agrega publicación/build y acopla los lockfiles antes de saber qué tipos merecen compartirse.

### 4. TypeORM y migraciones explícitas sobre MariaDB

El backend usará TypeORM con el driver MariaDB compatible y `synchronize: false` en todos los entornos. Las pruebas de persistencia recibirán variables `TEST_DATABASE_*` y fallarán si MariaDB no está disponible; no existe fallback a SQLite o memoria.

Cada change agrega migraciones nuevas con `<timestamp>-CXX-<descripcion>.ts`. Una migración integrada nunca se reescribe. C-01 configura el DataSource y verifica ejecutar/revertir una migración fundacional sin datos personales.

**Alternativas consideradas:** Prisma ofrece un flujo tipado atractivo, pero TypeORM se integra directamente con módulos y transacciones NestJS y permite expresar el bloqueo pesimista que necesita C-05. `synchronize: true` se descarta porque no produce historial reproducible.

### 5. Concurrencia de turnos mediante lock del singleton de agenda

C-03 creará una única fila `ConfiguracionAgenda`. C-05 abrirá una transacción TypeORM, bloqueará esa fila con `pessimistic_write`, consultará conflictos y persistirá turno+evento antes de confirmar. En un consultorio de un solo odontólogo, este lock serializa todas las escrituras que pueden competir por la agenda y evita phantoms sin depender de constraints de intervalos inexistentes en MariaDB.

C-01 prepara una abstracción de unidad transaccional, pero no crea `Turno` ni la política temporal. C-05 debe demostrar con dos solicitudes concurrentes que solamente una operación incompatible finaliza con éxito.

**Alternativas consideradas:** una comprobación previa sin lock tiene condición de carrera; aislamiento serializable global aumenta reintentos y sigue requiriendo una frontera clara; locks por sillón son insuficientes porque el odontólogo único bloquea simultaneidad entre sillones.

### 6. Autenticación mínima mediante JWT en cookie

C-04 implementará un JWT de sesión de ocho horas en cookie `HttpOnly`, `SameSite=Strict`, `Secure` en producción y nunca accesible desde `localStorage`. No habrá refresh token en el MVP. El secreto se valida desde `AUTH_SECRET`; logout invalida la cookie del cliente. Las contraseñas se derivarán con `crypto.scrypt`, salt aleatoria y comparación timing-safe, evitando una dependencia nativa adicional.

La primera cuenta se aprovisiona únicamente mediante `npm run provision:admin`, que lee `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`, es idempotente por email, nunca se ejecuta automáticamente al arrancar y nunca registra la contraseña. “Aprovisionamiento inicial” se usa en la documentación para evitar confundir este proceso con la librería visual Bootstrap.

**Alternativas consideradas:** sesiones de servidor requieren almacenamiento adicional; tokens en `localStorage` amplían el impacto de XSS; registro público y aprovisionamiento automático contradicen el alcance y aumentan riesgo.

### 7. Frontera HTTP y observabilidad mínima

El backend usará `/api` y un error JSON estable con forma `{ error: { code, message, requestId, details? } }`. Un middleware generará o propagará un request ID seguro. Los logs técnicos incluirán ese ID y metadatos mínimos, nunca cuerpos completos ni datos personales.

`GET /api/health` devolverá únicamente estados estables de aplicación/base y usará 503 cuando MariaDB no responda. No mostrará hosts, excepciones ni credenciales.

### 8. Tailwind consume tokens, no valores paralelos

Tailwind se usará para composición y utilidades. Un stylesheet de entrada del frontend importará la fuente canónica `design-system/tokens.css`, con acceso de Vite limitado a esa carpeta. Componentes compartidos referenciarán variables semánticas; no duplicarán hexadecimales ni el nombre provisional del producto.

La base visual conserva revisión 1: azul `#0D3D9E`, verde `#73FFA0`, tarjetas/modales `1rem`, inputs `0.5rem` y botones píldora.

### 9. Pruebas proporcionales y sin Playwright

NestJS usará Jest y Supertest para unitarias/API; React usará Vitest, jsdom y React Testing Library. La integración de persistencia usa MariaDB real configurada externamente. Las suites usan datos ficticios y tiempos fijos.

La verificación visual del shell será manual en 390×844 y 1440×900, documentando pantalla, viewport y resultado. No se instalará ni ejecutará Playwright.

### 10. Guard de scope sin dependencias de aplicación

`scripts/change-scope/check.mjs` será Node estándar sin paquetes adicionales. Una matriz versionada asociará cada branch exacto con globs permitidos y reglas especiales de migraciones. El script leerá `git diff --name-status <base>...HEAD`, acumulará todas las violaciones y devolverá código no cero.

`.github/workflows/change-scope.yml` hará checkout con historial suficiente y ejecutará el mismo script usando la base y head del pull request. C-01 y C-08 tendrán políticas amplias acordes a su integración; C-02 a C-07 no podrán tocar specs principales, archive, estado de fundación ni documentos globales.

**Alternativa considerada:** depender solamente de revisión humana no previene errores antes del merge; una action duplicada en shell divergiría del chequeo local.

### 11. Flujo de contribución y pull requests

`CONTRIBUTING.md` será la guía operativa para cualquier integrante sin contexto previo. Incluirá dos recorridos:

1. **Comenzar un change:** identificarse, ejecutar `git status`, actualizar `main` con fast-forward, crear o recuperar la rama exacta, confirmar el branch, leer ownership y usar `active-delivery` → proposal aprobado → apply → verify.
2. **Entregar un change:** revisar el diff, ejecutar verificaciones, hacer commit/push solo por decisión humana, abrir en GitHub un pull request con base `main` y compare `change/c-XX-<slug>`, usar título `[C-XX] <slug>`, completar resumen/evidencia y esperar los checks.

El documento explicará la alternativa por interfaz web de GitHub como camino principal y podrá mostrar `gh pr create` solo como opción para quien ya tenga GitHub CLI autenticado. También aclarará que los contributors no ejecutan `openspec-sync-specs`, `openspec-archive-change` ni merge; Pablo revisa el diff, los checks y la evidencia antes de integrar.

El guard se dispara sobre el evento `pull_request`, calcula el diff entre base y head y publica éxito o error. No crea el PR, no lo aprueba y no lo fusiona.

## Planned File Surface

La lista podrá reducirse durante Apply, pero no ampliarse fuera del ownership de C-01 sin nueva aprobación:

```text
README.md
CONTRIBUTING.md
.env.example
.gitignore
.github/workflows/change-scope.yml
scripts/change-scope/{check.mjs,scope-map.json,check.test.mjs}

backend/{package.json,package-lock.json,tsconfig*.json,nest-cli.json,.env.example}
backend/src/{main.ts,app.module.ts}
backend/src/config/**
backend/src/database/**
backend/src/health/**
backend/src/shared/**
backend/src/modules/{patients,catalogs,availability,auth}/**
backend/src/modules/appointments/{creation,lifecycle,history,agenda}/**
backend/test/**

frontend/{package.json,package-lock.json,tsconfig*.json,vite.config.ts,.env.example,index.html}
frontend/src/{main.tsx,styles/**}
frontend/src/app/**
frontend/src/shared/**
frontend/src/features/{patients,catalog,availability,auth,appointments,agenda}/**
```

## UI Mockups

- **Design system revision:** 1
- **Decision:** no (project policy)
- **Policy:** `system-only`
- **Preview:** manual; C-01 verificará solamente el shell base en los dos viewports acordados
- **Visual verify:** manual (2026-11-23, aprobada por el usuario en 390×844 y 1440×900; evidencia en `verification.md`)

## Risks / Trade-offs

- **[Los módulos placeholder se vuelven código muerto]** → C-01 los limita a exports/composición mínima y cada change los completa; C-08 elimina únicamente placeholders residuales.
- **[El lock global reduce concurrencia]** → el MVP tiene un odontólogo y prioriza corrección; el lock dura solo la transacción de validación/escritura.
- **[JWT no puede revocarse antes de expirar]** → TTL corto de ocho horas y logout por cookie son suficientes para el MVP de un usuario; revocación/refresh queda fuera de alcance.
- **[Dependencia de MariaDB dificulta tests locales]** → ejemplos de entorno y fallos explícitos; nunca se oculta el problema usando otro motor.
- **[Globs demasiado amplios permiten invasión]** → casos negativos automatizados para cada branch y protección explícita de archivos globales.
- **[Importar CSS fuera de `frontend/` puede requerir configuración Vite]** → allowlist mínima de la carpeta `design-system/` y build de producción como criterio obligatorio.

## Migration Plan

1. Crear manifests y configuraciones sin desplazar documentación existente.
2. Generar aplicaciones base, composición por features y contratos transversales.
3. Configurar MariaDB/TypeORM y ejecutar migración fundacional contra una base de pruebas vacía.
4. Configurar frontend, tokens, pruebas y build.
5. Implementar y probar el guard de scope local; luego habilitar su workflow de pull requests.
6. Crear `CONTRIBUTING.md`, enlazarlo desde `README.md` y verificar sus comandos de inicio/entrega desde un estado limpio.
7. Ejecutar la verificación integral y dejar el change listo para revisión humana.

Si Apply falla antes de integrar C-01, se revierte únicamente esta rama. La migración fundacional debe incluir `down`; no se tocarán datos reales ni entornos productivos.
