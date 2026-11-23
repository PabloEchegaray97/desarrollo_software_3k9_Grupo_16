# Sistema visual del proyecto

Mode: system-only  
Revision: 1  
Approval: approved (2026-11-23, by user)  
Created: 2026-11-22

## Propósito

Esta carpeta define la base visual compartida del sistema de turnos odontológicos. La política `system-only` exige reutilizar estos tokens y componentes, pero no requiere aprobar un mockup por cada change visual.

## Brief

- **Producto:** agenda web para un odontólogo independiente.
- **Audiencia:** una persona que necesita operar rápido durante la jornada del consultorio.
- **Tareas centrales:** consultar agenda, crear turnos, distinguir estados, gestionar pacientes y entender conflictos.
- **Plataformas:** escritorio como uso principal y móvil responsive para consultas rápidas.
- **Tono:** preciso, sereno, confiable y clínico sin resultar frío.
- **Densidad:** media; suficiente información diaria sin aspecto de tablero empresarial.
- **Movimiento:** mínimo y funcional; presión de botones y transiciones breves, con reducción de movimiento.

## Fuentes de producto y diseño

- `knowledge-base/01_vision_y_objetivos.md`
- `knowledge-base/03_actores_y_roles.md`
- `knowledge-base/06_funcionalidades.md`
- `knowledge-base/07_flujos_principales.md`
- `docs/discovery/informe-discovery.md`
- DentalCore y Dentry como referencias cualitativas de confianza, claridad y comunicación visual.
- `revisar_ui/cambio-de-turno-ui-pack/` como referencia estructural para contratos de componentes administrativos.
- CSS público de `https://dentalcore.app/`, consultado el 2026-11-23, como fuente de los tokens cromáticos de referencia `#0D3D9E`, `#73FFA0`, `#0B368C`, `#D1E2FF` y `#EAF1FC`, y de la familia tipográfica Manrope.

No se copiaron interfaces ni componentes propietarios. Las referencias orientan atributos, contratos y tokens aislados: claridad, confianza, jerarquía y sencillez.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `brand.md` | Tono, nombre provisional, logo e imágenes |
| `brand.js` | Única constante local para el nombre mostrado |
| `tokens.css` | Colores, tipografía, espaciado, radios, sombras, foco y movimiento |
| `component-contract.md` | Contratos adaptados para tarjetas, botones, inputs, modales y estados |
| `components.html` | Referencia responsive de componentes y estados |
| `assets/logo.svg` | Ruta estable del logo provisional |
| `previews/mobile.png` | Captura anterior; pendiente de regeneración manual con la paleta actual |
| `previews/desktop.png` | Captura anterior; pendiente de regeneración manual con la paleta actual |

## Decisiones abiertas

- **Nombre definitivo:** `(TBD)`. Se usa “Turnos Odontología” como nombre de trabajo.
- **Logo definitivo:** `(TBD)`. El SVG actual dice explícitamente “PROVISIONAL”.
- **Tipografía de marca:** `(TBD)`. La pila declara Manrope como primera opción por la referencia de DentalCore, pero conserva fallbacks locales y no descarga fuentes remotas.
- **Imaginería/fotografía:** `(TBD)`. El MVP no necesita fotografías para operar.

La revisión 1 puede aprobarse con estos elementos provisionales porque están aislados y son reemplazables.

## Reglas duras

- Usar azul `#0D3D9E` como color primario de navegación, acciones principales y foco de jerarquía.
- Usar verde `#73FFA0` como color secundario de confirmación o énfasis puntual; nunca como gran superficie ni con texto blanco.
- No usar púrpuras, gradientes decorativos ni glows. El verde fluorescente es la única excepción de alta saturación y debe ser deliberado.
- No usar negro puro; el texto principal es slate `#0F172A`.
- Tarjetas y modales usan radio `2xl` (`1rem`); no aumentar a `3xl`.
- Inputs y selects usan radio moderado de `0.5rem`; no deben verse como píldoras.
- Botones, chips y badges sí pueden usar radio completo tipo píldora.
- Formularios con etiqueta arriba, ayuda y error debajo.
- Estados de turno siempre combinan texto, color y forma; nunca dependen solo del color.
- Botones frecuentes usan animación mínima y feedback `:active`.
- No animar acciones de teclado ni movimientos repetitivos de agenda.
- Respetar `prefers-reduced-motion`.
- Incluir estados normal, hover/focus, loading, vacío, error y deshabilitado cuando correspondan.
- Usar datos ficticios en ejemplos y capturas.

## Reemplazos futuros

### Cambiar el nombre

Editar únicamente `PRODUCT_NAME` en `brand.js`. Los previews que usen `[data-brand-name]` se actualizan automáticamente.

### Cambiar el logo

Reemplazar `assets/logo.svg` conservando la ruta y un `viewBox` válido. Volver a renderizar ambos previews.

### Cambiar valores visuales

Modificar los tokens semánticos de `tokens.css`, incrementar `Revision`, cambiar `Approval` a `pending` y volver a generar las capturas.

## Cómo previsualizar

Abrir `components.html` en un navegador moderno. El archivo no requiere servidor, dependencias ni conexión a internet.

Preview: manual (2026-11-23). Por decisión del usuario no se usa Playwright. Las capturas existentes corresponden a la versión cromática anterior y no constituyen evidencia de aprobación de esta revisión.

