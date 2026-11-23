# Skill Registry

**Uso del delegador únicamente.** Quien coordine trabajo resuelve estas reglas compactas y las incorpora al contexto de ejecución. No se deben releer todas las skills para cada tarea.

## User Skills

| Trigger | Skill | Path |
|---|---|---|
| Elegir ODD/SDD al iniciar o retomar una unidad de trabajo | `active-delivery` | `C:/Users/pcbre/.agents/skills/active-delivery/SKILL.md` |
| Iniciar o reanudar la fundación de un proyecto | `active-orchestrator` | `C:/Users/pcbre/.agents/skills/active-orchestrator/SKILL.md` |
| Consultar, publicar o reconciliar el roadmap con ClickUp | `active-roadmap` | `C:/Users/pcbre/.agents/skills/active-roadmap/SKILL.md` |
| Generar o actualizar AGENTS.md / CLAUDE.md | `agent-instruction` | `C:/Users/pcbre/.agents/skills/agent-instruction/SKILL.md` |
| Definir o auditar la identidad visual compartida | `design-system` | `C:/Users/pcbre/.agents/skills/design-system/SKILL.md` |
| Compatibilidad exacta con el taste skill v1 | `design-taste-frontend-v1` | `C:/Users/pcbre/.agents/skills/design-taste-frontend-v1/SKILL.md` |
| Investigar producto y competidores antes de la KB | `discovery-research` | `C:/Users/pcbre/.agents/skills/discovery-research/SKILL.md` |
| Pulir componentes, interacción y animación | `emil-design-eng` | `C:/Users/pcbre/.agents/skills/emil-design-eng/SKILL.md` |
| Buscar skills instalables para una capacidad | `find-skills` | `C:/Users/pcbre/.agents/skills/find-skill/SKILL.md` |
| Crear una Knowledge Base canónica | `kb-creator` | `C:/Users/pcbre/.agents/skills/kb-creator/SKILL.md` |
| Implementar tareas de un change OpenSpec | `openspec-apply-change` | `C:/Users/pcbre/.agents/skills/openspec-apply-change/SKILL.md` |
| Cerrar y archivar un change OpenSpec | `openspec-archive-change` | `C:/Users/pcbre/.agents/skills/openspec-archive-change/SKILL.md` |
| Explorar requisitos sin implementar | `openspec-explore` | `C:/Users/pcbre/.agents/skills/openspec-explore/SKILL.md` |
| Proponer un change OpenSpec completo | `openspec-propose` | `C:/Users/pcbre/.agents/skills/openspec-propose/SKILL.md` |
| Sincronizar delta specs con specs principales | `openspec-sync-specs` | `C:/Users/pcbre/.agents/skills/openspec-sync-specs/SKILL.md` |
| Revisar artefactos de planificación existentes | `openspec-update-change` | `C:/Users/pcbre/.agents/skills/openspec-update-change/SKILL.md` |
| Generar o actualizar CHANGES.md | `roadmap-generator` | `C:/Users/pcbre/.agents/skills/roadmap-generator/SKILL.md` |
| Crear, mejorar o evaluar una skill | `skill-creator` | `C:/Users/pcbre/.agents/skills/skill-creator/SKILL.md` |
| Analizar una URL puntual de competidor | `web-scraper` | `C:/Users/pcbre/.agents/skills/web-scraper/SKILL.md` |

## Compact Rules

### active-delivery
- Leer instrucciones, roadmap y handoff antes de recomendar ODD o SDD.
- Confirmar el modo antes de escribir, salvo que el usuario ya lo haya elegido explícitamente para el mismo scope.
- Usar SDD para contratos públicos, migraciones, ownership cruzado o coordinación sustancial; ODD para trabajo acotado y reversible.
- Verificar `openspec list --json` antes de cualquier escritura SDD; nunca crear `openspec/` manualmente.
- Preservar cambios del usuario y separar verificación local del estado observado del roadmap.
- Promover ODD a SDD solo con confirmación y un handoff durable.

### active-orchestrator
- Inspeccionar y mostrar el plan completo antes de crear estado, artefactos, instalaciones o conexiones.
- Requerir KB, roadmap e instrucciones; conservar fases opcionales como skipped/deferred cuando corresponda.
- Reanudar desde `.active-orchestrator-state.json`; no repetir fases validadas ni inventar su estado.
- Persistir `in_progress` antes del dispatch y `done` solo tras validar outputs.
- Hacer backup y preservar campos ajenos al actualizar el estado versión 5.
- Pausar en decisiones específicas de fase, instalaciones y escrituras externas no aprobadas.

### active-roadmap
- `CHANGES.md` conserva scope/dependencias; ClickUp conserva responsables y estado operativo.
- Con modo local, no realizar escrituras remotas ni crear configuración ClickUp.
- Validar lista y permisos mediante lectura antes de previsualizar cualquier publicación.
- Toda creación/actualización remota necesita preview y confirmación explícita de filas y contenido.
- Nunca repetir una escritura con resultado incierto; recuperar por identidad exacta.
- No guardar credenciales, tokens ni callbacks OAuth en el proyecto.

### agent-instruction
- Requiere KB; puede generar sin CHANGES, pero debe advertir que falta roadmap.
- En `generate`, crear solo destinos faltantes; en `update`, mostrar diff y esperar aprobación.
- Administrar únicamente el bloque `active-stack:agent-instruction` en archivos existentes.
- Leer stack, KB, roadmap, registry y global; no duplicar reglas globales ya instaladas.
- Derivar reglas duras del stack real y detenerse para que el usuario las confirme.
- Verificar enlaces locales y sincronizar solo metadata `state.agents` después de validar archivos.

### design-system
- Respetar el modo visual ya registrado; no volver a preguntar salvo revisión explícita.
- Crear una base portátil en `design-system/` sin depender de cuentas, fuentes remotas o servicios pagos.
- Mantener nombre, logo y valores visuales reemplazables en rutas/tokens estables.
- Un cambio compartido incrementa revisión, vuelve a `Approval: pending` y requiere nueva revisión.
- No marcar aprobado sin confirmación explícita; declarar preview manual si no se renderiza automáticamente.
- Preservar estado y outputs previos; nunca sobrescribir una identidad existente sin pedido.

### design-taste-frontend-v1
- Verificar `package.json` antes de importar dependencias; no asumir librerías instaladas.
- Respetar stack y design system del proyecto por encima de los defaults de la skill.
- Usar Grid para layouts; `100dvh` en móvil y fallback de una columna bajo 768px.
- Formularios: label arriba, ayuda opcional y error debajo; incluir loading/empty/error/disabled.
- Animar solo `transform` y `opacity`; no mezclar motores de animación en el mismo árbol.
- Evitar emojis, negro puro, glows, cards innecesarias y estética genérica; verificar accesibilidad.

### discovery-research
- Investigar o preguntar; nunca completar el checklist con suposiciones no verificadas.
- Invocar `web-scraper` por URL y reutilizar resultados sin repreguntar lo ya evidenciado.
- Cubrir problema, usuarios, casos, competidores, features, reglas, integraciones, restricciones, riesgos y dudas.
- Presentar un resumen final y esperar confirmación explícita antes de escribir.
- Escribir solo el slice de discovery que la fase posee y conservar el resto del estado.
- Si falta scraping, continuar con Q&A y declarar la limitación.

### emil-design-eng
- En reviews de UI usar siempre tabla Markdown `Before | After | Why`.
- Decidir primero si una interacción debe animarse; acciones frecuentes o de teclado no se animan.
- Usar `transform` y `opacity`; preferir CSS/WAAPI para animaciones predeterminadas bajo carga.
- Dar feedback táctil inmediato y evitar `transition: all`.
- Popovers nacen del trigger; modales permanecen centrados.
- Respetar reduced motion, foco, interrupción de gestos y rendimiento móvil.

### find-skills
- Revisar primero skills.sh y luego buscar por términos específicos.
- No recomendar solo por coincidencia: verificar instalaciones, reputación, estrellas y auditorías.
- Preferir fuentes oficiales y adopción superior a 1K; tratar menos de 100 instalaciones con cautela.
- Presentar nombre, función, fuente, instalaciones, comando y enlace.
- No instalar nada sin que el usuario elija explícitamente la skill exacta.
- Si no hay opción confiable, decirlo y continuar con capacidades generales.

### kb-creator
- Mantener los 10 archivos canónicos más README en `knowledge-base/`; fuentes permanecen en `docs/`.
- En importación, generar silenciosamente desde fuentes confirmadas y registrar dudas sin inventar.
- En entrevista, hacer rondas estratégicas y esperar validación antes de generar.
- No sobrescribir una KB parcial; completar únicamente archivos pendientes acordados.
- Los extras complementan y nunca reemplazan los 10 canónicos.
- En ejecución orquestada, actualizar solo `state.kb` después de verificar resultados.

### openspec-apply-change
- Confirmar root con `openspec list --json`; nunca crear OpenSpec por efecto lateral.
- Seleccionar change sin ambigüedad, anunciarlo y leer status/instructions JSON.
- Tratar `contextFiles`, contexto y guidance como entradas; no omitir estados blocked/all_done.
- Implementar tareas en orden, verificar y marcar solo trabajo realmente completado.
- Respetar stores seleccionados y mantener `--store` en todos los comandos compatibles.
- No archivar ni inventar artefactos desde Apply.

### openspec-archive-change
- Confirmar root y change; leer status y evaluación de sync antes de archivar.
- Mostrar artefactos/tareas incompletos como advertencias y confirmar antes de continuar.
- Si hay delta specs, sincronizar y validar specs principales antes de mover el change.
- Preservar `.openspec.yaml` y usar las rutas devueltas por la CLI.
- Nunca archivar mientras una sincronización está en vuelo o falló.
- Informar destino, schema, sync y advertencias concretas.

### openspec-explore
- Explore es pensamiento y diagnóstico, nunca implementación de código.
- Lecturas son libres; antes de escribir artefactos, describir archivos/scope y obtener confirmación.
- Un pedido explícito de capturar como change autoriza solo esos artefactos.
- Confirmar root antes de cualquier escritura y no crear `openspec/` manualmente.
- Visualizar relaciones cuando ayuden, pero no inventar requisitos.
- Si el usuario pide implementar, salir de Explore y proponer el flujo de entrega adecuado.

### openspec-propose
- Confirmar root y nombre de change antes de escribir; reutilizar changes existentes cuando coinciden.
- Obtener status e instrucciones de cada artefacto desde la CLI; no asumir paths ni schemas.
- Generar propuesta, specs, design y tasks coherentes hasta completar planificación.
- Respetar contexto/rules sin copiarlos literalmente a los artefactos.
- Validar el change antes de entregarlo y reportar outputs concretos.
- No implementar código durante Propose.

### openspec-sync-specs
- Seleccionar change/root y detectar delta specs desde status/instructions, no mediante paths supuestos.
- Aplicar ADDED/MODIFIED/REMOVED sin perder contenido no afectado de specs principales.
- No eliminar la última requirement salvo retiro declarado y path seguro dentro del specs root.
- Mantener stores y paths resueltos por CLI.
- Ejecutar `openspec validate --specs`; un fallo deja sync incompleto y bloquea archive.
- Reportar cada capability sincronizada, retirada, omitida o fallida.

### openspec-update-change
- Solo modifica planificación; nunca código de implementación.
- Seleccionar el change y usar `artifactPaths.existingOutputPaths`; nunca escribir a un glob.
- Leer todos los artefactos existentes y reconciliar contradicciones en cualquier dirección.
- Mostrar cada revisión y esperar confirmación archivo por archivo.
- No avanzar el frontier creando artefactos ready/blocked; derivarlos al flujo correspondiente.
- Si cambia la intención, crear un change distinto en lugar de reescribir el existente.

### roadmap-generator
- Requiere los 10 canónicos y crea un único `CHANGES.md` si aún no existe.
- Cada change lleva Estado, Scope, Dependencias, Governance y 3–5 referencias “Leer antes”.
- Mantener IDs estables y scopes operacionales verificables de 4–6 horas.
- Modelar gates, camino crítico, asignación y ownership sin solapamiento.
- Infra solo primero si falta; modelos antes que referencias y backend antes que frontend acoplado.
- En modo orquestado, actualizar solo el slice `state.roadmap` después de validar el archivo.

### skill-creator
- Capturar intención, triggers, formato de salida, dependencias y criterios antes de escribir.
- Mantener `SKILL.md` conciso; mover referencias y scripts grandes a recursos vinculados.
- Descripción debe expresar qué hace y cuándo se activa; evitar triggers vagos.
- Para outputs verificables, proponer tests/evals y comparar resultados antes de iterar.
- Reutilizar recursos existentes y validar scripts realmente ejecutándolos.
- Empaquetar o instalar solo cuando el usuario lo solicite.

### web-scraper
- Procesar URLs puntuales, nunca crawling masivo ni evasión de anti-bot.
- Extraer siempre los 8 campos del esquema fijo y marcar `(no publicado)` cuando falte evidencia.
- No inventar pricing, features, usuarios ni posicionamiento.
- Si hay bloqueo/SPA vacía, registrar la limitación y continuar con la siguiente URL.
- Normalizar a `discovery/sources/<slug>.md` usando el template de la skill.
- Reportar cantidad de fuentes resueltas y fallidas.

## Project Conventions

| File | Path | Notes |
|---|---|---|
| `AGENTS.md` | `AGENTS.md` | Instrucciones canónicas del proyecto para Codex; stack, KB, ownership, skills, roadmap y reglas duras confirmadas |

Leer `AGENTS.md` antes de iniciar cualquier change. No existe ni se requiere `CLAUDE.md` para este proyecto.
