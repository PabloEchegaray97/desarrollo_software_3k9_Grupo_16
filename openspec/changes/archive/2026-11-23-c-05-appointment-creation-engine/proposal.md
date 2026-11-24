# Proposal

## Why

Con pacientes, catálogos (C-02), disponibilidad (C-03) y sesión (C-04) integrados, falta el núcleo del producto: reservar un turno sin que dos atenciones del único odontólogo se crucen. C-05 crea el modelo `Turno`, la política temporal y el alta atómica que después reutilizarán C-06 (ciclo de vida e historial) y C-07 (agenda).

## What Changes

- Crear el modelo persistente de turno y su historial inicial: tablas de turnos y eventos con duración e intervalo **efectivos** copiados al turno, estado inicial `PROGRAMADO` y eventos `CREADO` y, si corresponde, `EXCEPCION`.
- Implementar una política pura que calcule la duración efectiva (turno → prestación), el intervalo efectivo (turno → prestación → global), el período bloqueado semiabierto `[inicio, finBloqueo)` y los conflictos contra turnos bloqueantes (`PROGRAMADO`, `CONFIRMADO`, `ATENDIDO`, `AUSENTE`).
- Exponer `POST /api/turnos` (requiere sesión) para crear:
  - un turno **ordinario**, solo si está dentro de la disponibilidad que evalúa C-03;
  - un turno **fuera de disponibilidad** únicamente con confirmación explícita y motivo, y solo cuando C-03 informa `FUERA_DE_DISPONIBILIDAD`. Un día bloqueado por feriado, vacaciones o bloqueo **no** admite override.
- Rechazar con códigos de dominio estables:
  - conflictos con cualquier turno bloqueante del odontólogo, aunque esté en otro sillón, y conflictos del mismo sillón;
  - referencias inexistentes o inactivas;
  - inicios en el pasado.
- Ejecutar validación y escritura de turno + eventos en **una transacción** que toma el lock `pessimistic_write` sobre la fila única de `ConfiguracionAgenda` (estrategia acordada en C-01). C-05 implementa por primera vez la frontera `TransactionBoundary`.
- Construir en `/turnos/nuevo` la pantalla de alta, con estas funciones:
  - selección de paciente, prestación y sillón activos;
  - fecha y hora locales;
  - sobrescritura opcional de duración e intervalo;
  - modal de excepción justificada y explicación de conflictos.

  La interfaz no decide disponibilidad ni conflictos (regla dura 3).
- Fuera de alcance:
  - listar, consultar o editar turnos (C-07/C-06);
  - cancelar, reprogramar y cambiar estado (C-06);
  - mensajería y reserva pública;
  - turnos con inicio en el pasado.

## Capabilities

### New Capabilities

- `appointment-booking`: Alta de turnos con tiempos efectivos persistidos, bloqueo semiabierto, conflictos del odontólogo y del sillón, override de disponibilidad justificado, rechazo de referencias inválidas y del pasado, y atomicidad bajo concurrencia.
- `appointment-booking-ui`: Pantalla de alta de turno que presenta las decisiones del backend: selección de referencias, sobrescrituras, confirmación de excepción con motivo y explicación de conflictos.

### Modified Capabilities

Ninguna. C-05 consume sin modificar los contratos de `patient-registry`, `clinic-catalogs`, `schedule-availability` y `session-access`.

## Impact

- **Código propio:** `backend/src/modules/appointments/core/**`, `backend/src/modules/appointments/creation/**`, `frontend/src/features/appointments/create/**` y una migración nueva `*-C05-*.ts`.
- **Contratos consumidos, sin editarlos:**
  - `PatientReferences` y `CatalogReferences` (C-02);
  - `AVAILABILITY_EVALUATION_PORT` y la fila `ConfiguracionAgenda` (C-03);
  - `SessionGuard` global y `authenticatedCookie` en pruebas (C-04);
  - las APIs `/api/pacientes`, `/api/prestaciones`, `/api/sillones` y `/api/disponibilidad/configuracion` desde el frontend.
- **Contratos nuevos para C-06 y C-07:** entidades de turno y evento, estados bloqueantes, consulta de conflictos con exclusión de un turno (para reprogramar) e implementación transaccional con lock. Viven en `appointments/core` y cambiarlos después requiere coordinación.
- **Dependencias:** ninguna nueva.
- **Pedido de coordinación a Pablo (CR-05-01):** fijar `timezone: 'Z'` en las opciones de `DataSource` (`backend/src/database/data-source.ts`). Sin eso, mysql2 escribe y lee `DATETIME` en la hora local del proceso, y en una PC configurada en Argentina los instantes de turnos no quedarían en UTC (regla dura 4, RN-TI-02). El Apply avanza igual. La prueba que verifica UTC con `TZ=America/Argentina/Buenos_Aires` queda bloqueada hasta que esté en `main`.
- **Observación para Pablo:** `backend/src/shared/database/architecture-boundaries.spec.ts` prohíbe en todo `src` los términos `class Turno`, `solapamiento` y `overlap`, una restricción pensada para C-01. C-05 la respeta con nombres en inglés y el vocabulario "conflicto", pero el test queda obsoleto y conviene acotarlo a `shared/`.
