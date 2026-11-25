# Sistema visual de OdoSoft

Mode: system-only
Revision: 2
Approval: approved (2026-11-24, by user)
Created: 2026-11-22
Revised: 2026-11-24

## Propósito

Esta carpeta define la base visual portátil de OdoSoft, la agenda web de un odontólogo independiente. La política `system-only` exige reutilizar estos tokens y contratos, pero no requiere un mockup por cada pantalla.

La revisión 2 incorpora las decisiones de C-08: nombre definitivo OdoSoft, tema claro/oscuro, sidebar contraíble, dashboard compacto, alta de turno en modal e iconografía Phosphor.

## Brief

- **Producto:** OdoSoft, gestión de agenda para un odontólogo independiente.
- **Audiencia:** una persona que necesita operar rápido durante la jornada.
- **Tareas centrales:** revisar el día, crear turnos, distinguir estados, gestionar pacientes y resolver excepciones.
- **Plataformas:** escritorio como uso principal y móvil responsive para consulta/operación.
- **Tono:** preciso, sereno, confiable y clínico sin resultar frío.
- **Densidad:** compacta en escritorio y más espaciosa en móvil.
- **Movimiento:** mínimo y funcional, siempre reducible.
- **Contenido:** títulos y etiquetas directos; no agregar subtítulos si el contexto ya explica la acción.

## Fuentes

- `knowledge-base/01_vision_y_objetivos.md`
- `knowledge-base/03_actores_y_roles.md`
- `knowledge-base/06_funcionalidades.md`
- `knowledge-base/07_flujos_principales.md`
- `docs/discovery/informe-discovery.md`
- DentalCore y Dentry como referencias cualitativas de confianza y claridad.
- `revisar_ui/cambio-de-turno-ui-pack/` como referencia estructural administrativa.
- CSS público de DentalCore consultado el 2026-11-23 para los tokens aislados `#0D3D9E`, `#73FFA0`, `#0B368C`, `#D1E2FF`, `#EAF1FC` y la pila Manrope.
- Decisiones explícitas de Pablo para C-08 del 2026-11-24.

No se copiaron interfaces ni componentes propietarios.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `brand.md` | Nombre, tono, logo e imágenes |
| `brand.js` | Única constante local para el nombre mostrado en previews |
| `tokens.css` | Tema claro/oscuro, tipografía, espaciado, radios, sombras, foco y movimiento |
| `component-contract.md` | Contratos de shell, iconos, dashboard, tarjetas, botones, inputs, modales y estados |
| `components.html` | Referencia responsive y alternable entre claro/oscuro |
| `assets/logo.svg` | Ruta estable del wordmark provisional de OdoSoft |

## Decisiones resueltas

- **Nombre definitivo:** OdoSoft.
- **Navegación:** sidebar izquierdo redondeado, fijo/contraíble en escritorio y drawer en móvil.
- **Tema:** claro, oscuro y sistema.
- **Iconos de aplicación:** Phosphor, peso regular por defecto y `fill` para destinos activos.
- **Inicio:** dashboard con métricas y `+ Nuevo turno`.
- **Agenda:** alternancia lista/grilla.
- **Alta de turno:** modal; ciclo de vida posterior en página dedicada.

## Decisiones todavía provisionales

- **Logo:** el SVG actual es un wordmark provisional en una ruta estable.
- **Tipografía de marca:** Manrope es la primera opción, con fallbacks locales y sin descarga remota.
- **Imaginería:** el MVP no utiliza fotografías.

## Reglas duras

- Azul de marca `#0D3D9E` para navegación y jerarquía; verde `#73FFA0` solo para confirmación o énfasis puntual, siempre con texto oscuro.
- No usar púrpuras, gradientes decorativos ni glows.
- No usar negro puro; cada tema usa neutros azulados.
- Tarjetas, sidebar y modales: radio `2xl` / `1rem`. Inputs/selects: `0.5rem`. Botones/chips/badges: píldora cuando corresponda.
- Estados siempre combinan texto, color y forma.
- Iconos interactivos siempre conservan etiqueta visible, `aria-label` o ayuda accesible.
- Formularios usan etiqueta arriba; ayuda solo si aporta información no evidente y error debajo.
- No animar acciones de teclado ni movimientos repetitivos de agenda; respetar `prefers-reduced-motion`.
- Incluir normal, hover/focus, loading, vacío, error y deshabilitado cuando correspondan.
- Usar únicamente datos ficticios en ejemplos, pruebas y revisiones.

## Reemplazos futuros

- **Nombre:** editar `PRODUCT_NAME` en `brand.js` y la constante equivalente de la aplicación si existiera.
- **Logo:** reemplazar `assets/logo.svg` conservando ruta y `viewBox`, luego revisar claro/oscuro.
- **Tokens:** modificar variables semánticas, incrementar `Revision`, volver `Approval` a `pending` y repetir la revisión manual.

## Cómo previsualizar la revisión 2

1. Abrir `design-system/components.html` en un navegador moderno; no requiere servidor ni internet.
2. Revisar los botones **Claro** y **Oscuro**.
3. Comprobar manualmente a 390×844 y 1440×900:
   - sidebar/dashboard;
   - tarjetas de métricas y agenda;
   - botones, inputs, badges y estados;
   - modal;
   - foco, contraste y ausencia de overflow.
4. Informar diferencias o confirmar ambos temas y tamaños.

Preview: manual (2026-11-24; confirmado por el usuario en 390×844 y 1440×900, en claro y oscuro). No se usó Playwright ni se declara ninguna captura automatizada.

