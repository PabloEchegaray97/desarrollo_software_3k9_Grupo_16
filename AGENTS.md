<!-- active-stack:agent-instruction -->
# Agenda odontológica — Instrucciones para Codex

> Instrucciones específicas de este repositorio, generadas desde `knowledge-base/`, `CHANGES.md` y `.atl/skill-registry.md`.

## Stack Tecnológico

| Capa | Tecnología acordada | Versión |
|---|---|---|
| Backend | NestJS sobre Node.js | A fijar en C-01 y conservar en lockfile |
| Frontend | React + TypeScript | A fijar en C-01 y conservar en lockfile |
| Base de datos | MariaDB real | A fijar y documentar en C-01 |
| Contrato HTTP | REST + JSON | `/api` o alternativa aprobada en C-01 |
| Pruebas | Herramientas compatibles con NestJS y React | A resolver en C-01 |

Detalle completo: [knowledge-base/02_descripcion_general.md](knowledge-base/02_descripcion_general.md).

## Base de Conocimiento

La fuente de verdad del dominio vive en [knowledge-base/](knowledge-base/README.md). Leer los documentos relacionados por `CHANGES.md` antes de proponer o implementar.

| Archivo | Cuándo leerlo |
|---|---|
| [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md) | Propósito, alcance, equipo y restricciones |
| [03_actores_y_roles.md](knowledge-base/03_actores_y_roles.md) | Autenticación, rol y permisos |
| [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) | Entidades, relaciones y restricciones temporales |
| [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md) | Reglas codificadas `RN-*` y matriz de estados |
| [06_funcionalidades.md](knowledge-base/06_funcionalidades.md) | Historias y criterios de aceptación |
| [07_flujos_principales.md](knowledge-base/07_flujos_principales.md) | Flujos extremo a extremo |
| [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md) | Capas, estructura, seguridad y pruebas |
| [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md) | Decisiones aprobadas y supuestos explícitos |
| [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md) | Decisiones P1/P2 que debe cerrar cada change |

No quedan preguntas P0 abiertas. Cada pregunta P1 que afecte un change debe resolverse en su proposal/design antes de Apply.

## Skills Disponibles

| Integrante / rol | Ownership principal | Skills que Codex carga según la tarea |
|---|---|---|
| Pablo — Fundación e integración | C-01 y C-08 | `active-delivery`, `active-orchestrator`, `openspec-propose`, `openspec-apply-change`, `openspec-sync-specs`, `openspec-archive-change`, `design-system`, `roadmap-generator`, `agent-instruction` |
| Paula — Dominio core | C-02 y C-05 | `active-delivery`, `openspec-explore`, `openspec-propose`, `openspec-update-change`, `openspec-apply-change` |
| Milagros — Disponibilidad e historial | C-03 y C-06 | `active-delivery`, `openspec-explore`, `openspec-propose`, `openspec-update-change`, `openspec-apply-change` |
| Gonzalo — Acceso y frontend | C-04 y C-07 | `active-delivery`, `openspec-propose`, `openspec-apply-change`, `design-system`, `design-taste-frontend-v1`, `emil-design-eng` |
| Documentación / research | Fundación o cambios documentales | `discovery-research`, `web-scraper`, `kb-creator`, `find-skills`, `skill-creator` |

Los compact rules y paths verificados viven en [.atl/skill-registry.md](.atl/skill-registry.md). No usar skills recomendadas pero no instaladas como si estuvieran disponibles.

## Roadmap de Changes

El plan canónico está en [CHANGES.md](CHANGES.md): 8 changes en 5 fases operativas.

- **Pablo:** C-01 `foundation-and-contracts` y C-08 `integration-ui-polish`.
- **Paula:** C-02 `patients-and-catalogs` y C-05 `appointment-creation-engine`.
- **Milagros:** C-03 `availability-and-schedule-settings` y C-06 `appointment-lifecycle-history`.
- **Gonzalo:** C-04 `authentication-and-app-shell` y C-07 `agenda-experience`.
- **Primer change:** C-01.
- **Primer fork:** C-02, C-03 y C-04, únicamente después de completar C-01.
- **Camino crítico:** C-01 → C-03 → C-05 → C-06/C-07 → C-08.

Antes de iniciar un item, leer sus dependencias, governance, scope y referencias “Leer antes”. No renumerar IDs existentes.

## Reglas Duras (específicas del proyecto)

> Las reglas globales de Codex ya cubren OpenSpec, governance, Engram y las compuertas del design system. Este archivo no las duplica.

1. NUNCA usar `any` → mantener TypeScript estricto y tipos explícitos en fronteras y dominio.
2. NUNCA sustituir MariaDB por SQLite o una base en memoria en pruebas de integración → usar MariaDB real para persistencia, constraints y concurrencia.
3. NUNCA decidir disponibilidad o solapamientos en React → NestJS es la autoridad y el frontend solo presenta resultados.
4. NUNCA persistir el offset `-03:00` como sustituto de zona → interpretar con `America/Argentina/Buenos_Aires` y guardar instantes en UTC.
5. NUNCA usar datos reales de pacientes, secretos o payloads personales en seeds, fixtures, capturas, ejemplos o logs → usar datos ficticios y logs minimizados.
6. NUNCA invadir el ownership de otro integrante → respetar las carpetas y changes asignados en `CHANGES.md`.
7. NUNCA cambiar un contrato compartido sin coordinación previa → documentar el impacto y acordarlo antes de editar consumidores.
8. NUNCA agregar una dependencia sin verificar `package.json` y justificar su necesidad → preferir el stack ya fijado y conservar lockfiles.
9. NUNCA usar Playwright en este proyecto → realizar verificación visual manual y declarar expresamente qué pantallas y viewports se revisaron.
10. NUNCA hacer commit, push, merge ni agregar coautoría de agentes sin pedido explícito del usuario.
11. NUNCA versionar `dist/`, `coverage/` u otros artefactos generados → ejecutar tests/builds relevantes y conservar únicamente fuentes y configuración necesarias.

## Flujo de Trabajo

```text
1. Confirmar en el primer mensaje: "Soy <integrante> y trabajaré C-XX <slug>".
2. Ejecutar el protocolo Git de CHANGES.md: inspeccionar el estado, actualizar main y cambiar a la rama exacta del change antes de editar archivos.
3. Leer AGENTS.md, CHANGES.md y la KB relevante.
4. Invocar active-delivery y acordar ODD o SDD para el change.
5. Para SDD, dejar que OpenSpec CLI determine root, estado, paths y artefactos.
6. Resolver decisiones P1 del item en proposal/design antes de Apply.
7. Implementar solo dentro del scope y ownership acordados.
8. Verificar en proporción al riesgo; distinguir build, tests, MariaDB real y revisión visual manual.
9. Registrar evidencia y marcar CHANGES.md solo cuando la verificación esté completa.
```

La identificación declarada no reemplaza la comprobación de Git. Si la rama activa no coincide con la asignada, si `main` no está actualizado o si existen cambios locales ajenos, detenerse y comunicarlo; no mover, sobrescribir ni mezclar trabajo de otra persona. Pablo es el único responsable de integrar los branches terminados en `main`. La autorización para cambiar de rama no autoriza a Codex a hacer `commit`, `push` o `merge`: esas acciones conservan la regla dura 10 y requieren un pedido explícito.

Antes de Apply, leer en la ficha del change de `CHANGES.md` sus **Directorios propios** y **Compartidos permitidos**, y enumerar en proposal/design los archivos previstos. Un archivo fuera de esa superficie requiere detenerse, informar el impacto y obtener aprobación de Pablo; no se amplía el ownership por conveniencia. Las migraciones son compartidas solo para agregar archivos nuevos identificados con el ID del change.

## Aislamiento de OpenSpec por Rama

La fundación del proyecto ya está terminada. Paula, Milagros y Gonzalo no deben ejecutar `openspec init`, `active-orchestrator`, `kb-creator`, `roadmap-generator`, `skill-registry`, `agent-instruction` ni ninguna otra fase de fundación en sus branches.

En cada rama de change, el responsable puede:

- ejecutar `active-delivery` y acordar SDD;
- ejecutar `openspec-propose` para el nombre exacto `c-XX-<slug>` asignado;
- ejecutar `openspec-apply-change` y la verificación correspondiente después de aprobar el plan;
- modificar únicamente `openspec/changes/c-XX-<slug>/**` y los paths autorizados en `CHANGES.md`.

Los integrantes no ejecutan `openspec-sync-specs` ni `openspec-archive-change` en sus branches. Después de revisar e integrar cada rama, Pablo ejecuta sync y archive secuencialmente sobre `main`; solamente esa etapa puede modificar `openspec/specs/**` y `openspec/changes/archive/**`.

C-01 debe incorporar un control automático de scope para pull requests. El control compara los archivos modificados con la rama base y falla si el branch toca paths fuera de su change, archivos globales protegidos o artefactos OpenSpec reservados. Que el control pase no reemplaza la revisión humana ni autoriza `commit`, `push` o `merge` al agente.

Ante contradicción de producto, aplicar la precedencia documental definida en [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md): Discovery verificado → informe corregido → KB → specs OpenSpec aprobados.
<!-- /active-stack:agent-instruction -->
