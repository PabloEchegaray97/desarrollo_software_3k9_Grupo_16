# Contrato de componentes

Adaptación para este proyecto de la referencia ubicada en `revisar_ui/cambio-de-turno-ui-pack/`. Este documento define el comportamiento y la forma; no obliga a una biblioteca React concreta.

## Forma compartida

- Tarjetas, paneles y modales: `rounded-2xl` / `1rem`.
- Inputs, selects y áreas de texto: `rounded-lg` / `0.5rem`.
- Botones, chips, badges y buscadores compactos: `rounded-full`.
- Evitar una tarjeta dentro de otra tarjeta. Usar separadores, fondos suaves o secciones internas.

## Botón

El componente compartido admite variantes `primary`, `secondary`, `ghost` y `danger`, tamaños `sm`, `md` y `lg`, iconos laterales, estado `loading` e `iconOnly` con `aria-label` obligatorio.

- `primary`: fondo azul `#0D3D9E`, texto blanco.
- `secondary`: acción neutra con borde; el verde fluorescente no reemplaza todos los secundarios.
- `highlight`: uso excepcional para confirmaciones o llamadas de alta prioridad, fondo `#73FFA0` y texto `#0B1E4D`.
- La pulsación desplaza el botón `1px`; no se usan animaciones decorativas.

## Input

- Etiqueta visible arriba; ayuda y error debajo.
- Altura objetivo: `40px`.
- Radio moderado de `0.5rem`, borde `--color-border-strong` y fondo blanco.
- Foco visible mediante `--focus-ring`; el error combina borde, texto y mensaje.
- No usar inputs tipo píldora.

## Tarjeta o panel

- Fondo `--color-surface`, borde de `1px`, radio `--radius-lg` (`1rem`) y sombra sutil.
- El encabezado puede tener título, descripción y una acción breve.
- El contenido operativo debe crecer con el documento; evitar scroll interno salvo que el patrón lo necesite.

## Modal administrativo

- Composición React sugerida: `Dialog` + `AdminModalShell`; puede implementarse con la biblioteca accesible elegida por el equipo.
- Ancho compacto: `min(460px, calc(100vw - 32px))`.
- Alto máximo: `calc(100dvh - 32px)` y hasta `90vh` en escritorio.
- Estructura: `grid-template-rows: auto minmax(0, 1fr) auto`.
- Header con título, descripción opcional y cierre `X` accesible.
- Body con scroll propio y padding consistente.
- Footer solo cuando existan acciones reales; no agregar “Cerrar” si la `X` es suficiente.
- Contenedor `rounded-2xl`, sin tarjeta interna duplicada y sin animación del shell.
- En móvil, un flujo auxiliar puede convertirse en bottom sheet con `rounded-t-2xl`.

## Estados y listas

- Los estados nunca dependen solo del color: combinan texto, color y forma.
- Los estados vacíos son mínimos: un icono opcional, título, explicación breve y una sola acción útil.
- Las entidades seleccionadas se resumen en línea o mediante separadores, no con mini-tarjetas repetidas.
- Las listas seleccionables usan un contenedor suave y un indicador explícito de selección.

## Accesibilidad

- Contraste mínimo WCAG AA para texto normal.
- No usar texto blanco sobre `#73FFA0`; usar `#0B1E4D`.
- Foco visible en toda acción interactiva.
- Respetar `prefers-reduced-motion`.
