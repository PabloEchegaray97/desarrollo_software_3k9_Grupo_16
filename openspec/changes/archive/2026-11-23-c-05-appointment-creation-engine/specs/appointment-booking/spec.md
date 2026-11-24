# Spec Delta

## Purpose

Reserva turnos del único odontólogo de forma consistente: calcula y conserva los tiempos efectivos, impide conflictos entre turnos bloqueantes aunque usen sillones distintos y admite atender fuera del horario solo con una excepción justificada y trazable.

## ADDED Requirements

### Requirement: Alta de turno con datos locales
El sistema SHALL crear un turno con `POST /api/turnos` a partir de `pacienteId`, `prestacionId`, `sillonId`, `fecha` local `YYYY-MM-DD` y `horaInicio` local `HH:mm` en `America/Argentina/Buenos_Aires`. El turno nuevo queda en estado `PROGRAMADO` y la operación requiere sesión vigente.

#### Scenario: Alta ordinaria
- **GIVEN** un paciente, una prestación de 30 minutos y un sillón activos, y el miércoles 2027-03-10 09:00–13:00 disponible
- **WHEN** el odontólogo crea un turno para 2027-03-10 a las 10:00
- **THEN** el backend responde 201 con `estado: "PROGRAMADO"`, `inicio: "2027-03-10T13:00:00.000Z"` y `fueraDisponibilidad: false`

#### Scenario: Sin sesión
- **WHEN** se envía `POST /api/turnos` sin cookie de sesión válida
- **THEN** el backend responde 401 y no crea ningún turno

#### Scenario: Datos con formato inválido
- **WHEN** falta una referencia, la fecha no es `YYYY-MM-DD`, la hora no es `HH:mm` o una referencia no es UUID
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

#### Scenario: Hora local inexistente
- **WHEN** la fecha y hora no corresponden a un instante válido en la zona del consultorio
- **THEN** el backend responde 400 con código `APPOINTMENT_INVALID_TIME`

### Requirement: Duración e intervalo efectivos persistidos
El sistema SHALL calcular la duración efectiva como la sobrescritura del turno o la duración de la prestación, y el intervalo efectivo como la sobrescritura del turno, el intervalo de la prestación o el intervalo global vigente, en ese orden. Ambos valores, `finAtencion` y `finBloqueo` SHALL persistirse en el turno.

#### Scenario: Valores de la prestación
- **GIVEN** una prestación de 30 minutos con intervalo propio de 5 minutos
- **WHEN** se crea un turno a las 10:00 locales sin sobrescrituras
- **THEN** el turno guarda `duracionMinutos: 30`, `intervaloPosteriorMinutos: 5`, `finAtencion` a las 10:30 y `finBloqueo` a las 10:35 locales

#### Scenario: Intervalo global cuando la prestación no define uno
- **GIVEN** una prestación sin intervalo propio y el intervalo global en 10 minutos
- **WHEN** se crea un turno sin sobrescribir el intervalo
- **THEN** el turno guarda `intervaloPosteriorMinutos: 10`

#### Scenario: Sobrescrituras del turno
- **WHEN** se crea un turno con `duracionMinutos: 50` e `intervaloPosteriorMinutos: 0`
- **THEN** el turno guarda esos valores y no los de la prestación ni el global

#### Scenario: Límites de sobrescritura
- **WHEN** se envía `duracionMinutos` igual a 0, 241 o no entero, o `intervaloPosteriorMinutos` igual a -1, 31 o no entero
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`; 1, 240, 0 y 30 se aceptan

#### Scenario: Cambios posteriores no reescriben el turno
- **GIVEN** un turno creado con la duración de su prestación
- **WHEN** luego se edita la duración de la prestación o el intervalo global
- **THEN** el turno conserva la duración y el intervalo efectivos guardados al crearlo

### Requirement: Período bloqueado semiabierto
El sistema SHALL considerar que un turno bloqueante ocupa `[inicio, finBloqueo)`. Dos turnos no entran en conflicto cuando uno comienza exactamente en el `finBloqueo` del otro.

#### Scenario: Turno contiguo permitido
- **GIVEN** un turno bloqueante de 10:00 con `finBloqueo` 10:40
- **WHEN** se crea otro turno, en cualquier sillón, que comienza a las 10:40
- **THEN** el alta se completa

#### Scenario: Comienzo dentro del intervalo posterior
- **GIVEN** un turno bloqueante de 10:00 con `finAtencion` 10:30 y `finBloqueo` 10:40
- **WHEN** se crea otro turno que comienza a las 10:35
- **THEN** el backend responde 409 con código `APPOINTMENT_CONFLICT`

#### Scenario: Nuevo turno cuyo bloqueo alcanza al siguiente
- **GIVEN** un turno bloqueante que comienza a las 11:00
- **WHEN** se crea un turno a las 10:30 cuyo `finBloqueo` es 11:05
- **THEN** el backend responde 409 con código `APPOINTMENT_CONFLICT`

### Requirement: Conflictos del odontólogo y del sillón
El sistema SHALL rechazar un turno cuyo período bloqueado interseque el de cualquier turno en estado `PROGRAMADO`, `CONFIRMADO`, `ATENDIDO` o `AUSENTE`, en cualquier sillón, porque hay un único odontólogo. La respuesta SHALL indicar `alcance: "SILLON"` si algún conflicto usa el mismo sillón y `alcance: "ODONTOLOGO"` en otro caso, sin incluir datos del paciente.

#### Scenario: Conflicto en otro sillón
- **GIVEN** un turno bloqueante 10:00–10:40 en el Sillón 1
- **WHEN** se crea un turno a las 10:15 en el Sillón 2
- **THEN** el backend responde 409 con código `APPOINTMENT_CONFLICT`, `details.alcance: "ODONTOLOGO"` y en `details.conflictos` el id, sillón, inicio y `finBloqueo` del turno existente

#### Scenario: Conflicto en el mismo sillón
- **GIVEN** un turno bloqueante 10:00–10:40 en el Sillón 1
- **WHEN** se crea un turno a las 10:15 en el Sillón 1
- **THEN** el backend responde 409 con código `APPOINTMENT_CONFLICT` y `details.alcance: "SILLON"`

#### Scenario: Turno cancelado no bloquea
- **GIVEN** un turno `CANCELADO` 10:00–10:40
- **WHEN** se crea un turno a las 10:00 en el mismo sillón
- **THEN** el alta se completa

#### Scenario: Estados terminales bloqueantes
- **GIVEN** un turno `ATENDIDO` o `AUSENTE` 10:00–10:40
- **WHEN** se crea un turno a las 10:15
- **THEN** el backend responde 409 con código `APPOINTMENT_CONFLICT`

### Requirement: Disponibilidad y excepción manual justificada
El sistema SHALL crear turnos ordinarios solo cuando la evaluación de disponibilidad sea `DISPONIBLE`. Cuando sea `FUERA_DE_DISPONIBILIDAD`, SHALL exigir `fueraDisponibilidad: true` y un `motivoExcepcion` no vacío. Cuando sea `EXCEPCION_BLOQUEANTE` (feriado, vacaciones o bloqueo), SHALL rechazar el alta incluso con override.

#### Scenario: Fuera de horario sin confirmación
- **GIVEN** el miércoles solo tiene el tramo 09:00–13:00
- **WHEN** se crea un turno a las 18:00 sin `fueraDisponibilidad`
- **THEN** el backend responde 409 con código `APPOINTMENT_OUTSIDE_AVAILABILITY` y `details.requiereOverrideManual: true`, y no crea el turno

#### Scenario: Fuera de horario con motivo
- **WHEN** se reenvía el mismo turno con `fueraDisponibilidad: true` y `motivoExcepcion: "Urgencia ficticia"`
- **THEN** el backend responde 201 con `fueraDisponibilidad: true` y el motivo guardado

#### Scenario: Override sin motivo
- **WHEN** se envía `fueraDisponibilidad: true` con `motivoExcepcion` ausente o vacío tras recortar espacios
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

#### Scenario: El override no exceptúa conflictos
- **GIVEN** un turno bloqueante a las 18:00 creado como excepción
- **WHEN** se crea otro turno a las 18:10 con `fueraDisponibilidad: true` y motivo
- **THEN** el backend responde 409 con código `APPOINTMENT_CONFLICT`

#### Scenario: Día bloqueado por una excepción de disponibilidad
- **GIVEN** una excepción `FERIADO` de día completo para la fecha elegida
- **WHEN** se crea un turno en esa fecha, con o sin `fueraDisponibilidad: true`
- **THEN** el backend responde 409 con código `APPOINTMENT_BLOCKED_BY_EXCEPTION`, `details.tipoExcepcion: "FERIADO"`, y no crea el turno

#### Scenario: Override innecesario
- **GIVEN** un horario `DISPONIBLE`
- **WHEN** se crea un turno con `fueraDisponibilidad: true` y motivo
- **THEN** el turno se crea como ordinario con `fueraDisponibilidad: false`, sin motivo de excepción

### Requirement: Referencias activas
El sistema SHALL rechazar el alta cuando el paciente, la prestación o el sillón no existan o estén inactivos, e indicar el campo afectado.

#### Scenario: Sillón inactivo
- **GIVEN** un sillón desactivado
- **WHEN** se crea un turno con ese sillón
- **THEN** el backend responde 422 con código `APPOINTMENT_REFERENCE_INVALID`, `details.campo: "sillonId"` y `details.motivo: "INACTIVO"`

#### Scenario: Paciente inexistente
- **WHEN** se crea un turno con un `pacienteId` que no existe
- **THEN** el backend responde 422 con código `APPOINTMENT_REFERENCE_INVALID`, `details.campo: "pacienteId"` y `details.motivo: "INEXISTENTE"`

### Requirement: Inicio no pasado
El sistema SHALL rechazar un turno cuyo inicio sea anterior al instante actual del servidor, obtenido de un reloj reemplazable en pruebas.

#### Scenario: Inicio pasado
- **GIVEN** el reloj del servidor en 2027-03-10T15:00:00Z
- **WHEN** se crea un turno con inicio 2027-03-10 11:00 locales (14:00Z)
- **THEN** el backend responde 422 con código `APPOINTMENT_IN_PAST`

### Requirement: Historial de creación
El sistema SHALL registrar, en la misma operación que crea el turno, un evento `CREADO` con el estado nuevo `PROGRAMADO` y, para turnos fuera de disponibilidad, un evento `EXCEPCION` con el motivo. Los eventos SHALL registrar su momento con el reloj del servidor.

#### Scenario: Turno ordinario
- **WHEN** se crea un turno ordinario
- **THEN** existe exactamente un evento `CREADO` asociado con `estadoNuevo: "PROGRAMADO"` e `inicioNuevo` igual al inicio del turno

#### Scenario: Turno fuera de disponibilidad
- **WHEN** se crea un turno con override justificado
- **THEN** existen un evento `CREADO` y un evento `EXCEPCION` con el motivo informado

### Requirement: Operación atómica y concurrencia
El sistema SHALL validar y guardar el turno y sus eventos en una única transacción serializada para la agenda. Dos altas concurrentes incompatibles SHALL NOT completarse ambas, y un fallo al guardar cualquier parte SHALL dejar la agenda sin cambios.

#### Scenario: Dos altas simultáneas en el mismo horario
- **WHEN** dos solicitudes concurrentes intentan crear turnos que entran en conflicto, en el mismo sillón o en sillones distintos
- **THEN** exactamente una responde 201 y la otra 409 con código `APPOINTMENT_CONFLICT`

#### Scenario: Fallo al registrar el historial
- **WHEN** falla la escritura del evento después de insertar el turno
- **THEN** la transacción se revierte y no queda ni el turno ni el evento

### Requirement: Instantes en UTC
El sistema SHALL guardar `inicio`, `finAtencion`, `finBloqueo` y los momentos de eventos como instantes UTC, independientemente de la zona horaria del proceso, y SHALL devolverlos en ISO 8601 con sufijo `Z`.

#### Scenario: Proceso en otra zona horaria
- **GIVEN** el backend ejecutándose con la zona del sistema `America/Argentina/Buenos_Aires`
- **WHEN** se crea un turno para las 10:00 locales
- **THEN** la columna de inicio en MariaDB contiene `13:00:00` del mismo día y la API devuelve `inicio` con `T13:00:00.000Z`
