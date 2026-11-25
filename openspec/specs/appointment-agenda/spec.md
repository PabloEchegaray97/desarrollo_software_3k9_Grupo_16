# appointment-agenda Specification

## Purpose

Permite consultar la agenda del odontólogo por fecha o rango, sillón y estado, con orden estable por inicio y con atención, intervalo, bloqueo y excepción diferenciados, sin exponer datos clínicos ni de contacto del paciente.

## Requirements

### Requirement: Consulta de agenda por fecha o rango
El sistema SHALL ofrecer `GET /api/agenda` con `desde` (fecha local `YYYY-MM-DD` obligatoria) y `hasta` (opcional, por defecto igual a `desde`), ambas inclusivas y en `America/Argentina/Buenos_Aires`. Requiere sesión vigente. La respuesta incluye `zonaHoraria`, `desde`, `hasta`, `generadoEn` (instante UTC del reloj del servidor), `turnos` y `dias`.

#### Scenario: Una sola fecha
- **GIVEN** un turno el miércoles 2027-03-10 a las 10:00 locales
- **WHEN** se consulta `GET /api/agenda?desde=2027-03-10`
- **THEN** responde 200 con `desde` y `hasta` iguales a `2027-03-10`, el turno en `turnos` con `inicio: "2027-03-10T13:00:00.000Z"` y un único elemento en `dias`

#### Scenario: Rango de varios días
- **WHEN** se consulta `desde=2027-03-10&hasta=2027-03-12`
- **THEN** `turnos` contiene los turnos cuyo inicio local cae entre el 10 y el 12 inclusive y `dias` contiene exactamente tres elementos con las fechas 10, 11 y 12

#### Scenario: Sin sesión
- **WHEN** se consulta `GET /api/agenda?desde=2027-03-10` sin cookie de sesión válida
- **THEN** responde 401 con el contrato común de error y no consulta turnos

### Requirement: Rango máximo de 31 días
El sistema SHALL aceptar rangos de hasta 31 días calendario inclusive y SHALL rechazar los mayores con 400 y código `AGENDA_RANGE_TOO_LARGE`, incluyendo `details.maximoDias` y `details.solicitadoDias`. SHALL NOT ofrecer paginación temporal.

#### Scenario: Rango en el límite
- **WHEN** se consulta `desde=2027-03-01&hasta=2027-03-31` (31 días)
- **THEN** responde 200 y `dias` contiene 31 elementos

#### Scenario: Rango excesivo
- **WHEN** se consulta `desde=2027-03-01&hasta=2027-04-01` (32 días)
- **THEN** responde 400 con código `AGENDA_RANGE_TOO_LARGE`, `details.maximoDias: 31` y `details.solicitadoDias: 32`, y no devuelve turnos

#### Scenario: Cruce de mes y de año
- **WHEN** se consulta `desde=2026-12-20&hasta=2027-01-19` (31 días)
- **THEN** responde 200 y `dias` contiene 31 elementos en orden cronológico

### Requirement: Rechazo de rango inválido
El sistema SHALL rechazar con 400 y código `AGENDA_RANGE_INVALID` un `desde` posterior a `hasta` y las fechas que no existen en el calendario. Un valor que no cumple el formato `YYYY-MM-DD`, o la ausencia de `desde`, SHALL rechazarse con 400 y código `VALIDATION_ERROR`.

#### Scenario: Rango invertido
- **WHEN** se consulta `desde=2027-03-12&hasta=2027-03-10`
- **THEN** responde 400 con código `AGENDA_RANGE_INVALID`

#### Scenario: Fecha inexistente
- **WHEN** se consulta `desde=2027-02-30`
- **THEN** responde 400 con código `AGENDA_RANGE_INVALID`

#### Scenario: Formato inválido o ausente
- **WHEN** se consulta con `desde=10/03/2027`, con `hasta=mañana` o sin `desde`
- **THEN** responde 400 con código `VALIDATION_ERROR`

#### Scenario: Parámetro desconocido
- **WHEN** se consulta con un parámetro no documentado, por ejemplo `pagina=2`
- **THEN** responde 400 con código `VALIDATION_ERROR` y no consulta turnos

### Requirement: Filtro por sillón
El sistema SHALL filtrar los turnos por `sillonId` (UUID) cuando se informa, incluso si el sillón está inactivo, porque puede conservar turnos históricos. Un sillón inexistente SHALL rechazarse con 422 y código `AGENDA_CHAIR_NOT_FOUND`. Los tramos y bloqueos de `dias` no dependen del filtro.

#### Scenario: Un solo sillón
- **GIVEN** turnos del mismo día en el Sillón 1 y en el Sillón 2
- **WHEN** se consulta con `sillonId` del Sillón 2
- **THEN** `turnos` contiene solo los del Sillón 2

#### Scenario: Sillón inactivo con historial
- **GIVEN** un sillón desactivado que conserva un turno `ATENDIDO` del día consultado
- **WHEN** se consulta con su `sillonId`
- **THEN** responde 200 con ese turno

#### Scenario: Sillón inexistente o UUID inválido
- **WHEN** se consulta con un UUID que no corresponde a ningún sillón, o con `sillonId=abc`
- **THEN** el primer caso responde 422 con código `AGENDA_CHAIR_NOT_FOUND` y el segundo 400 con código `VALIDATION_ERROR`

### Requirement: Filtro por estado
El sistema SHALL filtrar por `estado` cuando se informa como lista separada por comas de `PROGRAMADO`, `CONFIRMADO`, `ATENDIDO`, `CANCELADO` o `AUSENTE`. Sin `estado`, SHALL devolver los turnos en cualquier estado. Un valor desconocido o una lista vacía SHALL rechazarse con 400 y código `VALIDATION_ERROR`.

#### Scenario: Varios estados
- **GIVEN** turnos del día en estados `PROGRAMADO`, `CONFIRMADO` y `CANCELADO`
- **WHEN** se consulta con `estado=PROGRAMADO,CONFIRMADO`
- **THEN** `turnos` contiene solo los `PROGRAMADO` y `CONFIRMADO`

#### Scenario: Sin filtro de estado
- **WHEN** se consulta sin `estado`
- **THEN** `turnos` incluye también los `CANCELADO`, con su estado visible

#### Scenario: Estado inválido
- **WHEN** se consulta con `estado=PENDIENTE` o con `estado=`
- **THEN** responde 400 con código `VALIDATION_ERROR`

### Requirement: Orden estable por inicio
El sistema SHALL ordenar `turnos` por `inicio` ascendente y, ante igual inicio, por fecha de creación y luego por `id`, de modo que consultas repetidas sin cambios devuelvan el mismo orden.

#### Scenario: Turnos creados en orden inverso
- **GIVEN** turnos creados a las 15:00, 09:00 y 11:00 del mismo día
- **WHEN** se consulta ese día
- **THEN** `turnos` se devuelve ordenado 09:00, 11:00, 15:00

#### Scenario: Igual inicio
- **GIVEN** dos turnos `CANCELADO` con el mismo inicio en sillones distintos
- **WHEN** se consulta dos veces seguidas
- **THEN** ambas respuestas devuelven los dos en el mismo orden, el creado primero antes

### Requirement: Atención, intervalo y excepción en cada turno
Cada turno SHALL informar `id`, `estado`, `inicio`, `finAtencion`, `finBloqueo`, `duracionMinutos`, `intervaloPosteriorMinutos`, `bloqueaHorario`, `fueraDisponibilidad` y `motivoExcepcion`, de modo que la atención sea `[inicio, finAtencion)`, el intervalo `[finAtencion, finBloqueo)` y la excepción un atributo explícito. `bloqueaHorario` SHALL ser verdadero solo para `PROGRAMADO`, `CONFIRMADO`, `ATENDIDO` y `AUSENTE`.

#### Scenario: Turno ordinario con intervalo
- **GIVEN** un turno de 30 minutos con intervalo de 10, creado dentro de la disponibilidad
- **WHEN** se consulta su día
- **THEN** informa `duracionMinutos: 30`, `intervaloPosteriorMinutos: 10`, `finBloqueo` diez minutos después de `finAtencion`, `fueraDisponibilidad: false` y `motivoExcepcion: null`

#### Scenario: Turno atendido como excepción
- **GIVEN** un turno creado fuera de disponibilidad con el motivo "Urgencia ficticia"
- **WHEN** se consulta su día
- **THEN** informa `fueraDisponibilidad: true` y `motivoExcepcion: "Urgencia ficticia"`

#### Scenario: Turno cancelado no bloquea
- **GIVEN** un turno `CANCELADO`
- **WHEN** se consulta su día
- **THEN** informa `bloqueaHorario: false`, y los turnos `PROGRAMADO`, `CONFIRMADO`, `ATENDIDO` y `AUSENTE` informan `bloqueaHorario: true`

### Requirement: Tramos y bloqueos de disponibilidad por día
El sistema SHALL incluir en `dias`, para cada fecha del rango en orden cronológico, los `tramos` semanales vigentes de ese día de la semana (`horaInicio`, `horaFin` locales) y los `bloqueos` activos de C-03 (`id`, `tipo`, `motivo`, `horaInicio`, `horaFin`, con ambas horas nulas si cubre el día completo). Los bloqueos cancelados SHALL omitirse. El contenido no depende de los filtros.

#### Scenario: Día con tramos y bloqueo parcial
- **GIVEN** el miércoles con los tramos 09:00–13:00 y 16:00–20:00 y un bloqueo `BLOQUEO` de 11:00 a 12:30
- **WHEN** se consulta el miércoles 2027-03-10
- **THEN** su elemento de `dias` lista ambos tramos ordenados y el bloqueo con `horaInicio: "11:00"` y `horaFin: "12:30"`

#### Scenario: Feriado de día completo
- **GIVEN** una excepción `FERIADO` activa de día completo para 2027-03-11
- **WHEN** se consulta ese día
- **THEN** su elemento de `dias` incluye el bloqueo con `horaInicio: null` y `horaFin: null`

#### Scenario: Día sin tramos
- **GIVEN** que el domingo no tiene tramos semanales
- **WHEN** se consulta un domingo
- **THEN** su elemento de `dias` tiene `tramos: []`

#### Scenario: Bloqueo cancelado
- **GIVEN** una excepción cancelada para la fecha consultada
- **WHEN** se consulta esa fecha
- **THEN** la excepción no aparece en `bloqueos`

### Requirement: Agenda vacía
El sistema SHALL responder 200 con `turnos: []` cuando ningún turno coincide con el rango y los filtros, manteniendo `dias` completo. SHALL NOT responder 404 por ausencia de turnos.

#### Scenario: Sin turnos en el rango
- **WHEN** se consulta una fecha sin turnos
- **THEN** responde 200 con `turnos: []` y un elemento en `dias`

#### Scenario: Filtros sin coincidencias
- **GIVEN** turnos del día solo en estado `PROGRAMADO`
- **WHEN** se consulta con `estado=ATENDIDO`
- **THEN** responde 200 con `turnos: []`

### Requirement: Ventana por día local e instantes UTC
El sistema SHALL incluir un turno cuando su `inicio` cae dentro de `[00:00 de desde, 00:00 del día posterior a hasta)` en `America/Argentina/Buenos_Aires`, y SHALL devolver todos los instantes en ISO 8601 UTC con sufijo `Z`.

#### Scenario: Borde del último día
- **GIVEN** un turno a las 23:30 locales del 2027-03-10 y otro a las 00:00 locales del 2027-03-11
- **WHEN** se consulta `desde=2027-03-10&hasta=2027-03-10`
- **THEN** `turnos` contiene solo el primero, con `inicio: "2027-03-11T02:30:00.000Z"`

#### Scenario: Proceso en otra zona horaria
- **GIVEN** el backend ejecutándose con la zona del sistema `America/Argentina/Buenos_Aires`
- **WHEN** se consulta un día con un turno a las 10:00 locales
- **THEN** el turno se informa con `inicio` terminado en `T13:00:00.000Z`

### Requirement: Sin datos clínicos ni de contacto
El sistema SHALL identificar paciente, prestación y sillón únicamente con `id` y `nombre`. SHALL NOT incluir en la respuesta teléfono, DNI, email, motivo de cancelación ni ningún dato clínico, y SHALL NOT registrar en logs el contenido de la respuesta ni los nombres de pacientes.

#### Scenario: Campos del paciente
- **GIVEN** un paciente ficticio con teléfono, DNI y email cargados
- **WHEN** se consulta el día de su turno
- **THEN** el objeto `paciente` contiene exactamente `id` y `nombre`, y ninguna parte de la respuesta contiene su teléfono, DNI o email

#### Scenario: Turno cancelado con motivo
- **GIVEN** un turno `CANCELADO` con motivo de cancelación registrado
- **WHEN** se consulta su día
- **THEN** la respuesta no incluye el motivo de cancelación
