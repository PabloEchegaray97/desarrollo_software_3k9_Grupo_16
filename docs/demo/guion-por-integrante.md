# Guion de Defensa — OdoSoft

> **Duración estimada: 10–12 minutos** | Cámara encendida en la presentación de cada integrante.
> Este guion sigue el orden exacto requerido por la consigna: (1) Producto y Discovery → (2) Repositorio → (3) Propose y Ajustar → (4) Apply/Verify con tests → (5) Archive y estado final → (6) Engram → (7) Conclusiones.
> Todos los datos mostrados provienen del seed ficticio (`npm run seed:demo`).

---

## PARTE 1 — Producto elegido y conclusiones del Discovery
> **Orador: Pablo** · ~90 segundos

| Paso | Pantalla / Archivo | Acción en pantalla | Texto hablado |
|---|---|---|---|
| **1.1** | `docs/discovery/informe-discovery.pdf` (abierto en PDF viewer) | Abrir el informe de Discovery y señalar la sección de conclusiones. | *"Hola, soy Pablo. El producto que elegimos es **OdoSoft**, un sistema de agenda odontológica. Durante la fase de Discovery identificamos que los consultorios pequeños y medianos pierden tiempo y cometen errores con agendas en papel o planillas: doble reserva, ausencia de control de disponibilidad y falta de trazabilidad de cancelaciones. La conclusión principal del Discovery fue que el problema central no es la digitalización en sí, sino la **regla de negocio de disponibilidad**: saber exactamente qué días y horarios están habilitados, con qué intervalo entre turnos y bajo qué excepciones."* |
| **1.2** | `docs/discovery/informe-discovery.pdf` — sección MVP | Señalar el MVP recomendado en el informe. | *"El MVP recomendado fue una agenda funcional con tres pilares: (1) Configuración de disponibilidad semanal y bloqueos por excepción, (2) alta de turnos con validación de conflictos y regla del odontólogo único, y (3) ciclo de vida completo del turno —confirmación, atención, ausencia y cancelación con motivo—. Todo sobre una base de datos real con trazabilidad transaccional."* |

---

## PARTE 2 — Recorrido por el repositorio
> **Orador: Pablo** · ~90 segundos

| Paso | Pantalla / Archivo | Acción en pantalla | Texto hablado |
|---|---|---|---|
| **2.1** | `knowledge-base/` (en explorador de archivos o VS Code) | Expandir la carpeta y hacer scroll mostrando los 10 archivos numerados. | *"El repositorio está organizado con una **Knowledge Base** de 10 documentos: visión y objetivos, descripción general, actores y roles, modelo de datos, reglas de negocio codificadas (`RN-*`), funcionalidades, flujos, arquitectura propuesta, decisiones y supuestos, y preguntas abiertas. Esta KB fue la fuente de verdad que todo el equipo consultó antes de proponer cada change."* |
| **2.2** | `CHANGES.md` (abierto en editor) | Hacer scroll por el archivo mostrando las 8 entradas con sus dependencias, fases y owners. | *"El roadmap está en `CHANGES.md`: 8 changes atómicos en 5 fases operativas, con árbol de dependencias, camino crítico y ownership explícito por integrante. Cada change tiene sus directorios propios, compartidos permitidos y los documentos de la KB que debe leer antes de proponer."* |
| **2.3** | `AGENTS.md` (abierto en editor) | Señalar las secciones de stack, reglas duras y flujo de trabajo. | *"Y en `AGENTS.md` están las instrucciones para el agente de IA: stack tecnológico acordado (NestJS + React + MariaDB real), las 11 reglas duras del proyecto —entre ellas TypeScript sin `any`, nunca sustituir MariaDB por SQLite en tests, nunca decidir disponibilidad en el frontend— y el flujo de trabajo SDD que todos seguimos."* |

---

## PARTE 3 — El change elegido: revisión real del Propose y correcciones con Ajustar
> **Cada integrante presenta su change** · ~15–20 segundos cada uno

| Orador | Change | Pantalla / Archivo | Acción en pantalla | Texto hablado |
|---|---|---|---|---|
| **Pablo** | C-01 | `openspec/changes/archive/2026-11-23-c-01-foundation-and-contracts/` | Abrir `proposal.md` y `design.md`. Señalar una sección corregida. | *"Soy Pablo. Propuse **C-01: Fundación y Contratos**. Al revisar el Propose vi que las migraciones no tenían `IF NOT EXISTS`, lo que hubiera roto el primer deploy. Con Ajustar agregué la cláusula y documenté la decisión en el design antes de pasar al Apply."* |
| **Paula** | C-02 | `openspec/changes/archive/2026-11-23-c-02-patients-and-catalogs/` | Abrir `proposal.md`. Señalar la corrección de baja lógica. | *"Soy Paula. En **C-02: Pacientes y Catálogos**, el Propose inicial no contemplaba que al desactivar una prestación debía verificarse si tenía turnos futuros programados. Con Ajustar agregamos esa validación en backend y la documentamos en `design.md`."* |
| **Milagros** | C-03 | `openspec/changes/archive/2026-11-23-c-03-availability-and-schedule-settings/` | Abrir `proposal.md`. Señalar el control de versión optimista. | *"Soy Milagros. En **C-03: Disponibilidad y Configuración**, el Propose original no incluía control de concurrencia al guardar el esquema semanal. Con Ajustar incorporamos el campo `version` y la comprobación optimista en backend para evitar que dos usuarios sobrescribieran la configuración al mismo tiempo."* |
| **Gonzalo** | C-04 | `openspec/changes/archive/2026-11-23-c-04-authentication-and-app-shell/` | Abrir `proposal.md`. Señalar la corrección del guard de sesión. | *"Soy Gonzalo. En **C-04: Autenticación y App Shell**, el Propose original no detallaba que `SessionGuard` debía leer el token desde el header `Authorization` y no desde la cookie, para ser compatible con el cliente React. Eso lo corregimos con Ajustar antes del Apply."* |

---

## PARTE 4 — Apply / Verify: tests pasando en pantalla
> **Cada integrante corre sus tests** · ~20–25 segundos cada uno

| Orador | Comando a mostrar en terminal | Resultado esperado en pantalla | Texto hablado |
|---|---|---|---|
| **Pablo** | `cd backend && npx jest --testPathPattern="integration" --forceExit --runInBand` | Suite `mvp-flow.integration-spec.ts` en verde. | *"El Apply de C-01 incluyó un test de integración extremo a extremo sobre MariaDB real. Acá lo vemos pasar: levanta la base, crea un paciente, una prestación, un sillón, genera disponibilidad y da de alta un turno. Todo en verde."* |
| **Paula** | `cd backend && npx jest --testPathPattern="patients|catalog" --forceExit` | Tests unitarios y de integración de `PatientsService` y `CatalogsService` en verde. | *"El Apply de C-02 y C-05 cubre validaciones de baja lógica de pacientes, prestaciones y el motor de creación de turnos con lock de agenda. Todos los tests pasan."* |
| **Milagros** | `cd backend && npx jest --testPathPattern="availability|lifecycle" --forceExit` | Tests de `AvailabilityService` y `AppointmentsLifecycleService` en verde. | *"C-03 y C-06 testean la evaluación de disponibilidad, las excepciones y la máquina de estados del ciclo de vida. Los vemos pasar ahora."* |
| **Gonzalo** | `cd frontend && npx tsc --noEmit && npx vitest run` | TypeScript sin errores y tests de componentes de shell y agenda en verde. | *"C-04 y C-07 tienen verificación de tipos estricta sin `any` y tests de componentes de autenticación y agenda. Todo en verde."* |

---

## PARTE 5 — Archive y estado final
> **Orador: Pablo** · ~60 segundos

| Paso | Pantalla / Archivo | Acción en pantalla | Texto hablado |
|---|---|---|---|
| **5.1** | `openspec/changes/archive/` (en explorador) | Expandir la carpeta y mostrar los 7 subdirectorios archivados (C-01 a C-07). | *"Una vez que Paula, Milagros y Gonzalo completaron sus changes con verificación aprobada, integré cada rama en `main` y ejecuté `openspec-sync-specs` y `openspec-archive-change`. Acá vemos los 7 changes archivados en `openspec/changes/archive/`: C-01 al C-07, cada uno con su `proposal.md`, `design.md`, specs sincronizados y fecha de cierre."* |
| **5.2** | `openspec/changes/c-08-integration-ui-polish/` | Mostrar la carpeta activa y luego abrir `CHANGES.md` señalando C-08 como en curso. | *"El único change que quedó activo es **C-08: Integration & UI Polish**, que es el mío y está en curso. En `CHANGES.md` figura como `in-progress`, con sus dependencias de C-07 ya cerradas."* |
| **5.3** | `CHANGES.md` | Hacer scroll hasta la tabla de estado mostrando `✅ done` en C-01..C-07 y `🔄 in-progress` en C-08. | *"Este es el estado final del proyecto: 7 de 8 changes archivados, camino crítico completado, integración técnica funcionando. Falta únicamente el pulido visual de C-08."* |

---

## PARTE 6 — Consulta a Engram
> **Orador: Pablo (o quien tenga Engram activo)** · ~30 segundos

| Paso | Pantalla / Herramienta | Acción en pantalla | Texto hablado |
|---|---|---|---|
| **6.1** | Terminal — Engram CLI o panel de Antigravity | Escribir una consulta como: `engram search "regla odontólogo único"` o abrir el panel de Engram en Antigravity y buscar `RN-DI-06`. | *"Engram es la memoria persistente del proyecto en Antigravity. Cuando el agente necesitó recordar la regla del odontólogo único (`RN-DI-06`) a lo largo de varios changes, la consultó desde Engram. Acá hacemos la consulta en vivo y vemos que devuelve el contexto exacto que el equipo guardó: descripción de la regla, impacto en C-05 y la decisión tomada."* |

> **Nota:** Si Engram no está disponible en este entorno, mostrar el archivo `.atl/skill-registry.md` y explicar que el proyecto documenta las decisiones persistentes en ese archivo y en la Knowledge Base como alternativa.

---

## PARTE 7 — Conclusiones
> **Todos los integrantes, ~10 segundos cada uno**

| Orador | Texto hablado |
|---|---|
| **Pablo** | *"OdoSoft cumplió el MVP planificado: stack fijado desde C-01, 7 changes cerrados con tests y un proceso SDD que nos forzó a pensar antes de codear. La regla que más valoro es no decidir disponibilidad en React: centralizar esa lógica en NestJS nos salvó de bugs complejos."* |
| **Gonzalo** | *"Lo más valioso de C-04 y C-07 fue aprender que el frontend no es solo pantallas: el diseño del shell, la sincronización de estado en URL y el principio de autoridad única en backend definen la calidad de la experiencia."* |
| **Paula** | *"C-05 me enseñó que el motor de creación de turnos es el corazón del sistema. Usar un lock de base de datos para serializar altas concurrentes en MariaDB real —no en memoria— hizo que las reglas de negocio fueran confiables desde el primer deploy."* |
| **Milagros** | *"C-03 y C-06 me mostraron que la disponibilidad y el ciclo de vida de un turno son problemas de estado: si los modelás mal al principio, todo lo demás falla. El control de versión optimista y la auditoría transaccional fueron decisiones clave."* |

---

> **Fin de la defensa. Tiempo estimado: 10–12 minutos.**
