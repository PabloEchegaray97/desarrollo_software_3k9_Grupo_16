# Coordinación C-07

Puntos que C-07 necesita acordar **sin editar** archivos ajenos. Ninguno bloquea el Apply: C-07 deja el punto de integración dentro de `features/agenda`.

## 1. Contrato de acciones de lifecycle (Milagros / C-06, ensamble Pablo / C-08)

C-07 no asume que el código de C-06 existe. Propone esta forma, que C-08 conecta:

```ts
// features/agenda/contracts.ts (C-07)
interface AgendaActionsContext {
  turno: AgendaTurno      // datos ya mostrados en el detalle
  onChanged: () => void   // la agenda vuelve a consultar con fecha y filtros vigentes
}
type AgendaActionsRenderer = (context: AgendaActionsContext) => ReactNode
```

- La página de agenda recibe `renderActions?: AgendaActionsRenderer` y dibuja su resultado en el detalle.
- C-06 exporta los componentes de acción (confirmar, atender, ausencia, cancelar, reprogramar) con una prop equivalente a `onChanged`.
- C-08 hace `renderActions={...}` en el ensamble final y puede unificar el enlace "Gestionar turno" (`/turnos/:id`).
- **Pregunta para Milagros:** ¿las acciones de C-06 necesitan más que `id`, `estado`, `inicio`, `finBloqueo` y `sillon.id` del turno? Si sí, se amplía `AgendaTurno` en un cambio acordado.

## 2. Badge de estado `ATENDIDO` (Pablo)

`design-system` revisión 1 define `programmed`, `confirmed`, `absent` y `cancelled`, pero no `ATENDIDO`. C-07 lo compone con tokens existentes en `features/agenda/agenda.css` (cuadrado con tilde, `--color-primary` sobre `--color-primary-soft`). **Pedido:** decidir si se incorpora al design system (revisión 2, que vuelve a `Approval: pending`) en C-08. C-07 no edita `design-system/**`.

## 3. Estado del árbol de trabajo (Pablo)

Al preparar la rama, `git status` mostraba 77 archivos modificados sin diferencias de contenido (el diff ignorando fin de línea quedó vacío), compatibles con una diferencia de saltos de línea. Incluyen `openspec/specs/**`, `openspec/changes/archive/**`, `scripts/change-scope/**` y `frontend/src/features/{auth,availability,appointments/create}/**`. C-07 **no los toca**. **Pedido:** confirmar que no son cambios reales y cómo normalizarlos, para que `check.mjs` no los marque en el PR.

## 4. Mejoras no bloqueantes para C-08

- Unificar los formateadores de fecha de `appointments/create/time.ts` y `agenda/time.ts` en `frontend/src/shared/`.
- Evaluar un índice por `starts_at` solo si la consulta por rango muestra costo.
- Actualizar `knowledge-base/10_preguntas_abiertas.md` con la resolución de P2-02 (31 días) cuando se integre.
