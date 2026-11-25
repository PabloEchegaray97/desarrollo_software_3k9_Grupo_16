# Proposal

## Why

Las capacidades del MVP ya están integradas, pero la aplicación todavía conserva una portada provisional, navegación horizontal y experiencias visuales separadas por feature. C-08 debe convertir ese conjunto funcional en **OdoSoft**, un producto coherente, reproducible y demostrable de extremo a extremo antes de la entrega.

## What Changes

- Adoptar el nombre **OdoSoft** y preparar la revisión 2 del design system, manteniendo la paleta azul/verde, radios acordados y datos ficticios, pero incorporando tema claro/oscuro completo. La revisión visual compartida quedará pendiente de aprobación manual antes de Apply.
- Sustituir la navegación superior por un sidebar izquierdo redondeado, fijo y contraíble en escritorio, convertido en drawer accesible en móvil; incluir navegación, control de tema, cuenta y cierre de sesión.
- Incorporar `@phosphor-icons/react`: variante regular por defecto y `fill` para destino/estado activo, sin usar iconos como único medio de comunicar significado.
- Convertir `/` en un dashboard compacto con métricas operativas del día, accesos a las áreas principales y la acción prominente `+ Nuevo turno` arriba a la derecha.
- Permitir alternar la agenda entre lista y grilla usando la misma respuesta autoritativa del backend, sin calcular disponibilidad, huecos ni conflictos en React.
- Abrir el alta de turno en un modal accesible desde las acciones globales, conservando reprogramación, cancelación, cambios de estado e historial en la página dedicada `/turnos/:appointmentId`.
- Mantener pacientes, prestaciones y sillones como listados con altas/ediciones en modales; reducir textos auxiliares redundantes cuando etiqueta, título y contexto ya sean suficientes.
- Corregir y documentar el arranque reproducible con `.env`, completar ejemplos sin secretos, seeds/datos de demostración ficticios, guion de demo y evidencia automática/manual del recorrido completo.
- Ejecutar y reconciliar suites unitarias, API/E2E, integración con MariaDB real, lint y builds; revisar manualmente 390×844 y 1440×900 sin Playwright.
- No agregar reserva pública, WhatsApp/email, historia clínica, cobros, ARCA, obras sociales ni otras integraciones posteriores al MVP.

## Capabilities

### New Capabilities

- `practice-dashboard`: portada autenticada con métricas del día, accesos operativos y acción global para crear un turno.

### Modified Capabilities

- `app-shell`: identidad OdoSoft, sidebar/drawer contraíble, navegación con iconos, preferencia de tema y acceso persistente al cierre de sesión.
- `appointment-agenda-ui`: vista alternable entre lista y grilla, integrada con el shell y el acceso global al alta.
- `appointment-booking-ui`: alta de turno presentada como modal accesible, sin trasladar al modal las operaciones posteriores del ciclo de vida.
- `application-runtime`: arranque backend con `.env`, documentación y datos ficticios reproducibles, más verificación integral de entrega.

## Impact

- **Frontend:** `frontend/src/app/**`, `frontend/src/main.tsx`, `frontend/src/shared/**` y correcciones trazables en features ya fusionadas; se agrega una dependencia explícita de iconos Phosphor.
- **Backend:** composición y soporte de integración/seeds en los paths permitidos por C-08; no cambia la autoridad temporal ni los contratos de disponibilidad y solapamientos.
- **Diseño:** `design-system/**` pasa de revisión 1 a revisión 2 y requiere aprobación manual antes de implementar la UI; `system-only` continúa vigente y no exige mockups por pantalla.
- **Operación y entrega:** `README.md`, `.env.example`, ejemplos por aplicación, `backend/test/integration/**` y `docs/demo/**`.
- **Compatibilidad:** no se prevén cambios incompatibles en los endpoints REST existentes ni migraciones destructivas; cualquier necesidad detectada fuera de esta superficie detendrá Apply para revisión.
