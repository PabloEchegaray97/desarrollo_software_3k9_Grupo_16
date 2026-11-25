# Contrato de componentes — revisión 2

Adaptación para OdoSoft de la referencia ubicada en `revisar_ui/cambio-de-turno-ui-pack/`. Define comportamiento y forma; la implementación React usa Phosphor Icons y no queda atada a otra biblioteca visual.

## Forma compartida

- Tarjetas, paneles, sidebar y modales: `rounded-2xl` / `1rem`.
- Inputs, selects y áreas de texto: `rounded-lg` / `0.5rem`.
- Botones, chips, badges y controles segmentados: píldora cuando su contenido lo permita.
- Evitar tarjetas anidadas. Preferir separadores, fondos suaves o secciones.
- Densidad compacta en escritorio; aumentar targets y separación en móvil.

## Shell y sidebar

- Escritorio: sidebar izquierdo fijo de `--sidebar-expanded`, contraíble a `--sidebar-collapsed`.
- El contenedor usa fondo `--color-sidebar`, texto `--color-on-sidebar`, radio `--radius-lg` y separación del borde de la ventana.
- El destino activo combina fondo/contraste, texto y Phosphor `fill`.
- Contraído: ocultar etiquetas visualmente, pero conservar `aria-label` y tooltip visible en hover/focus.
- Móvil: drawer modal con botón `aria-expanded`, cierre por destino, botón o `Esc`, y retorno de foco.
- Tema, cuenta y Cerrar sesión permanecen en la zona inferior.

## Dashboard

- Encabezado compacto con fecha/título y `+ Nuevo turno` arriba a la derecha.
- Métricas en tarjetas breves: valor, etiqueta e icono; no agregar descripción si valor+etiqueta ya son suficientes.
- Accesos rápidos como enlaces, no como tarjetas decorativas sin acción.
- En móvil las métricas se apilan o pasan a dos columnas sin overflow.

## Iconografía

- Familia única: Phosphor Icons.
- Peso `regular` en estado normal; `fill` en destino activo o selección sostenida.
- Tamaño habitual: 18–20 px; 22–24 px en acciones principales.
- Un icono nunca reemplaza el texto de un estado ni el nombre accesible de un control.

## Botón

Variantes `primary`, `secondary`, `ghost`, `highlight` y `danger`; tamaños `sm`, `md`, `lg`; estado `loading`; `iconOnly` exige `aria-label`.

- `primary`: `--color-primary` y `--color-on-primary`.
- `secondary`: superficie y borde semánticos.
- `highlight`: `--color-secondary` con `--color-on-secondary`, uso puntual.
- `danger`: solo para acciones destructivas funcionales.
- Feedback `:active` de 1 px; sin animación decorativa.

## Input

- Etiqueta visible arriba; ayuda solo si aporta un límite o consecuencia; error debajo.
- Altura objetivo mínima: 40 px en escritorio y 44 px en móvil.
- Radio `--radius-sm`, borde `--color-border-strong`, fondo `--color-surface`.
- Foco mediante `--focus-ring`; error mediante borde, texto y mensaje.
- No usar inputs tipo píldora.

## Tarjeta o panel

- Fondo `--color-surface`, borde de 1 px, radio `--radius-lg` y sombra semántica.
- Encabezado con título y una acción breve; descripción solo cuando cambia la comprensión.
- Evitar scroll interno salvo agenda, modal o patrón que lo requiera.

## Modal administrativo

- Componente compartido: `AppModal`; las features aportan contenido y acciones.
- Ancho compacto: `min(46rem, calc(100vw - 32px))`; formularios breves pueden usar 460 px.
- Alto máximo: `calc(100dvh - 32px)`.
- Estructura: header, body desplazable y footer solo con acciones reales.
- Título obligatorio; descripción opcional y no redundante.
- Fondo inerte, foco inicial/encerrado, `Esc` cuando no exista confirmación crítica y retorno al disparador.
- Contenedor `--radius-lg`; en móvil ocupa el ancho disponible sin convertirse automáticamente en bottom sheet.

## Agenda lista/grilla

- Lista y grilla reciben la misma respuesta del backend.
- El selector es un control segmentado accesible con estado activo.
- La grilla representa turnos, intervalos y bloqueos; no colorea huecos como “disponibles”.
- Selección, detalle, filtros y refresco son compartidos.
- Todo estado mantiene texto, color y forma en ambos temas.

## Estados

- Estados vacíos: icono opcional, título, explicación solo si ayuda a recuperar y una acción útil.
- Loading: skeleton o texto estable sin movimiento indispensable.
- Error: mensaje seguro, referencia cuando exista y acción de reintento.
- Deshabilitado: menor énfasis, pero contraste legible y razón disponible si no es evidente.
- Turnos: texto + color + icono/forma; cancelado además se percibe como no bloqueante.

## Tema y accesibilidad

- Componentes consumen tokens semánticos; no deciden colores por tema.
- Contraste objetivo WCAG AA para texto normal.
- Nunca texto blanco sobre `#73FFA0`.
- Foco visible en toda acción.
- Respetar `prefers-reduced-motion`.
- Verificar manualmente 390×844 y 1440×900 en claro y oscuro.
