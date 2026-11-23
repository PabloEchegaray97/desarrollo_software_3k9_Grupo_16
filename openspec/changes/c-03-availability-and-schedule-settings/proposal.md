# Proposal

## Why

C-05 no puede crear turnos confiables sin una autoridad que defina cuándo atiende el odontólogo: hoy no existen la configuración global, los horarios semanales ni las excepciones fechadas que deben validar cada intervalo. C-01 dejó el módulo `availability` preparado y este change lo completa antes del motor de turnos, resolviendo además **P1-03** con una decisión documentada y verificable.

## What Changes

- Resolver **P1-03**: las excepciones de disponibilidad son **solo bloqueantes** (`FERIADO`, `VACACIONES`, `BLOQUEO`). Las habilitaciones extraordinarias **no** se modelan como un cuarto tipo de excepción: se atienden con el override manual a nivel de turno (`fueraDisponibilidad` + `motivoExcepcion`, US-031/RN-DI-04..06/DD-06), que es responsabilidad de C-05. C-03 publica la evaluación de disponibilidad para que C-05 decida cuándo ese override aplica; no modifica `Turno`.
- Agregar una migración nueva identificada `C03` con `ConfiguracionAgenda` (fila única, `intervaloGlobalMinutos` entero `0..30` con valor inicial `10`, `zonaHoraria` IANA `America/Argentina/Buenos_Aires`), `DisponibilidadSemanal` (varios tramos por día, `diaSemana` 1 = lunes … 7 = domingo) y `ExcepcionDisponibilidad` (fecha local, tipo, motivo obligatorio, rango opcional para excepción parcial).
- Exponer REST bajo `/api` para consultar y editar la configuración global, los tramos semanales y las excepciones fechadas; no se expone borrado físico de excepciones, sino desactivación/cancelación que preserve el registro.
- Rechazar con `400 VALIDATION_ERROR` tramos con inicio ≥ fin, tramos solapados del mismo día y valores globales fuera de `0..30`. Aceptar y normalizar tramos contiguos como tramos separados; el día de la semana y la fecha de excepción se interpretan siempre en el calendario local del consultorio.
- Publicar una evaluación pura de disponibilidad que indique si un intervalo está dentro de un tramo semanal, si choca con una excepción total o parcial y si queda «fuera de disponibilidad»; los solapamientos con turnos se resuelven en C-05, nunca en React.
- Convertir de forma determinista entre hora local y UTC usando la zona IANA configurada; persistir solo instantes UTC y nunca el offset `-03:00` aislado.
- Construir la feature React de horarios semanales y excepciones con feedback explícito de guardado, error y validación, reutilizando los tokens aprobados del design system revisión 1. La UI presenta el resultado de la API; no decide disponibilidad.
- Cubrir con Strict TDD los casos de múltiples tramos por día, contigüidad, solapamiento, excepción total/parcial y conversiones local/UTC deterministas, más pruebas de API contra MariaDB real con datos ficticios.
- Fuera de alcance: turnos, override manual en `Turno`, historial de turnos, autenticación, agenda de C-07, seeds de demostración y cambios en contratos compartidos sin coordinación con Pablo.

## Capabilities

### New Capabilities

- `schedule-availability`: configuración global del consultorio, horarios semanales recurrentes, excepciones bloqueantes por fecha y evaluación de intervalos en zona local con persistencia UTC.
- `availability-settings-ui`: edición de horarios y excepciones desde la interfaz, con estados y mensajes de validación, sin lógica de decisión de disponibilidad.

### Modified Capabilities

Ninguna. `application-runtime` ya fija errores tipados, MariaDB real en integración y puntos de composición; este change los consume sin cambiar sus requisitos.

## Impact

- **Código propio:** `backend/src/modules/availability/**`, `frontend/src/features/availability/**` y una migración nueva `*-C03-*.ts` en `backend/src/database/migrations/**`. Sin tocar otros paths de código.
- **API nueva:** recursos REST para `/api/disponibilidad/configuracion`, `/api/disponibilidad/semanales` y `/api/disponibilidad/excepciones`, más una consulta de evaluación de intervalo. Los nombres JSON pasan a ser contrato consumido por C-05 y C-07: cualquier cambio posterior exige coordinación.
- **Consumidor C-05:** importará el módulo `availability` y su puerto de evaluación; C-05 conserva la propiedad de `Turno`, `fueraDisponibilidad`, `motivoExcepcion` y del historial. C-03 no agrega un tipo `HABILITACION` para evitar dos mecanismos competidores y una FK cruzada.
- **Dependencias:** ninguna nueva; se usan las ya fijadas por C-01 y confirmadas en `package.json`/lockfile. TypeScript estricto, sin `any`.
- **Riesgo conocido:** los pedidos de coordinación CR-01/CR-02 de C-02 (filtro de errores y descubrimiento de suites de integración) siguen fuera de este ownership; si no están resueltos al llegar Apply, se reportan como bloqueo concreto en lugar de editar archivos compartidos.
- **Política visual:** sistema aprobado revisión 1, modo `system-only`; no se genera mockup por change y la verificación visual será manual, sin Playwright.
