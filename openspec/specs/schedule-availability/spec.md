# schedule-availability Specification

## Purpose

Define la configuración temporal del consultorio y las reglas observables que determinan si un intervalo propuesto cae dentro de la disponibilidad ordinaria o de una excepción bloqueante, con interpretación en calendario local y persistencia UTC.

## Requirements

### Requirement: Configuración global única

El sistema SHALL mantener una única configuración de agenda con `intervaloGlobalMinutos` entero entre 0 y 30, valor inicial 10, y `zonaHoraria` fija `America/Argentina/Buenos_Aires`. Las consultas SHALL devolver la configuración vigente sin exponer secretos ni datos personales.

#### Scenario: Configuración inicial
- **WHEN** se consulta `GET /api/disponibilidad/configuracion` en una agenda sin configuración previa
- **THEN** el backend responde 200 con `intervaloGlobalMinutos: 10` y `zonaHoraria: "America/Argentina/Buenos_Aires"`

#### Scenario: Actualizar intervalo válido
- **WHEN** se envía `PATCH /api/disponibilidad/configuracion` con `intervaloGlobalMinutos: 25`
- **THEN** el backend responde 200 con el nuevo valor y sigue existiendo una sola configuración

#### Scenario: Intervalo fuera de rango
- **WHEN** se envía `intervaloGlobalMinutos` igual a -1, 31 o 10,5
- **THEN** el backend responde 400 con código `VALIDATION_ERROR` y la configuración permanece sin cambios

#### Scenario: Zona horaria no negociable
- **WHEN** se intenta cambiar `zonaHoraria` a un valor distinto de `America/Argentina/Buenos_Aires`
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

### Requirement: Tramos semanales recurrentes

El sistema SHALL permitir varios tramos por día, con `diaSemana` entero de 1 (lunes) a 7 (domingo) y horas locales `horaInicio` estrictamente menor que `horaFin`. SHALL rechazar tramos que se solapen dentro del mismo día y SHALL aceptar tramos contiguos como registros separados.

#### Scenario: Múltiples tramos en un día
- **WHEN** se guardan los tramos del lunes 09:00–13:00 y 16:00–20:00
- **THEN** ambos quedan vigentes y la consulta del lunes devuelve los dos

#### Scenario: Tramo invertido
- **WHEN** se envía un tramo con `horaInicio` igual o posterior a `horaFin`
- **THEN** el backend responde 400 con código `VALIDATION_ERROR` y no persiste ningún tramo del envío

#### Scenario: Tramos solapados
- **GIVEN** existe el tramo del martes 10:00–12:00
- **WHEN** se envía además el tramo del martes 11:30–13:00
- **THEN** el backend responde 400 con código `WEEKLY_SLOT_OVERLAP` y no persiste el cambio

#### Scenario: Tramos contiguos
- **GIVEN** existe el tramo del martes 10:00–12:00
- **WHEN** se envía el tramo del martes 12:00–13:00
- **THEN** ambos tramos se aceptan y la evaluación los trata como disponibilidad continua

#### Scenario: Día de semana inválido
- **WHEN** se envía `diaSemana` 0 u 8
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

### Requirement: Reemplazo atómico de la disponibilidad semanal

El sistema SHALL reemplazar el conjunto completo de tramos semanales en una sola operación, de modo que una validación fallida no deje una agenda parcialmente actualizada.

#### Scenario: Reemplazo correcto
- **WHEN** se envía `PUT /api/disponibilidad/semanales` con un conjunto válido de tramos
- **THEN** la consulta posterior devuelve exactamente ese conjunto y el anterior deja de estar vigente

#### Scenario: Reemplazo rechazado
- **GIVEN** existe un conjunto válido de tramos
- **WHEN** se envía un reemplazo con dos tramos solapados
- **THEN** el backend responde 400 y el conjunto anterior continúa vigente

### Requirement: Excepciones bloqueantes por fecha

El sistema SHALL registrar excepciones con `fecha` local, `tipo` de `FERIADO`, `VACACIONES` o `BLOQUEO`, `motivo` obligatorio no vacío y rango horario opcional. Sin rango, la excepción cubre el día completo; con rango, `horaInicio` SHALL ser menor que `horaFin`. No SHALL existir un tipo de habilitación extraordinaria en este recurso.

#### Scenario: Excepción de día completo
- **WHEN** se crea una excepción con fecha local 2026-12-25, tipo `FERIADO` y motivo "Feriado ficticio"
- **THEN** el backend responde 201 y la excepción cubre todo ese día local

#### Scenario: Excepción parcial
- **WHEN** se crea una excepción con tipo `BLOQUEO`, horaInicio 11:00 y horaFin 12:30
- **THEN** solo ese tramo del día queda bloqueado y el resto de la disponibilidad semanal permanece

#### Scenario: Motivo ausente
- **WHEN** se crea una excepción con `motivo` vacío o solo espacios
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

#### Scenario: Rango parcial invertido
- **WHEN** se crea una excepción con `horaInicio` 14:00 y `horaFin` 13:00
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

#### Scenario: Tipo de habilitación rechazado
- **WHEN** se envía `tipo: "HABILITACION"`
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`, conforme a la decisión P1-03

#### Scenario: Excepción inexistente
- **WHEN** se consulta o cancela un id de excepción inexistente
- **THEN** el backend responde 404 con código `EXCEPTION_NOT_FOUND`

### Requirement: Cancelación no destructiva de excepciones

El sistema SHALL conservar la excepción al cancelarla, marcándola como inactiva en lugar de eliminarla físicamente, y SHALL excluirla de la disponibilidad activa a partir de ese momento.

#### Scenario: Cancelar una excepción
- **WHEN** se cancela una excepción activa
- **THEN** la consulta de excepciones activas deja de mostrarla, pero sigue pudiendo consultarse por id como inactiva

#### Scenario: Reactivar una excepción
- **WHEN** se reactiva una excepción inactiva
- **THEN** vuelve a bloquear su fecha y su motivo original se mantiene sin cambios

### Requirement: Evaluación de un intervalo propuesto

El sistema SHALL evaluar un intervalo local propuesto y devolver un resultado explícito entre `DISPONIBLE`, `FUERA_DE_DISPONIBILIDAD`, `EXCEPCION_BLOQUEANTE` y `DATOS_INVALIDOS`, indicando la excepción aplicable cuando exista. La evaluación SHALL considerar la duración de atención para la contención, NO el intervalo posterior, y SHALL dejar los solapamientos con turnos a la capa que posee los turnos.

#### Scenario: Intervalo dentro de un tramo
- **GIVEN** el lunes 09:00–13:00 está definido como tramo semanal y no hay excepciones
- **WHEN** se evalúa un inicio local lunes 10:00 con duración 30 minutos
- **THEN** el resultado es `DISPONIBLE`

#### Scenario: Intervalo fuera del horario semanal
- **GIVEN** el lunes solo tiene el tramo 09:00–13:00
- **WHEN** se evalúa un inicio local lunes 18:00 con duración 30 minutos
- **THEN** el resultado es `FUERA_DE_DISPONIBILIDAD`, elegible para el override manual de C-05

#### Scenario: Excepción de día completo prevalece
- **GIVEN** el lunes 09:00–13:00 es un tramo válido y existe una excepción `VACACIONES` de día completo para ese lunes
- **WHEN** se evalúa un inicio local lunes 10:00
- **THEN** el resultado es `EXCEPCION_BLOQUEANTE` con el motivo de la excepción

#### Scenario: Excepción parcial no cubre todo el tramo
- **GIVEN** existe un tramo lunes 09:00–13:00 y una excepción `BLOQUEO` de 11:00 a 12:00
- **WHEN** se evalúan inicios locales lunes 10:00 y lunes 11:30
- **THEN** el primero es `DISPONIBLE` y el segundo es `EXCEPCION_BLOQUEANTE`

#### Scenario: Duración que cruza el fin del tramo
- **GIVEN** el tramo lunes 09:00–13:00
- **WHEN** se evalúa un inicio local lunes 12:45 con duración 30 minutos
- **THEN** el resultado es `FUERA_DE_DISPONIBILIDAD` porque la atención no queda contenida

#### Scenario: Intervalo posterior no altera la disponibilidad
- **GIVEN** el tramo lunes 09:00–13:00
- **WHEN** se evalúa el mismo inicio local con intervalo posterior 0 y con intervalo posterior 30
- **THEN** ambos resultados de disponibilidad son idénticos y solo cambian los instantes UTC informados

#### Scenario: Datos inválidos
- **WHEN** se evalúa una duración de 0 o una fecha local inexistente
- **THEN** el resultado es `DATOS_INVALIDOS`

### Requirement: Conversiones local/UTC deterministas

El sistema SHALL interpretar fechas y horas de tramos y excepciones en `America/Argentina/Buenos_Aires`, SHALL aplicar las reglas de esa zona IANA y SHALL devolver instantes en UTC sin persistir el offset `-03:00` como sustituto de la zona.

#### Scenario: Hora local a UTC
- **WHEN** se evalúa la hora local 2026-07-15 09:00 con la zona configurada
- **THEN** el instante devuelto es `2026-07-15T12:00:00.000Z`

#### Scenario: Misma hora local en otra fecha
- **WHEN** se evalúa la hora local 2027-01-15 09:00 con la zona configurada
- **THEN** el instante devuelto es `2027-01-15T12:00:00.000Z` salvo que la base de reglas IANA indique otra cosa

#### Scenario: Sin offset fijo persistido
- **WHEN** se consulta la configuración y una excepción cualquiera
- **THEN** ningún campo persistido contiene `-03:00` como valor de zona horaria

#### Scenario: Solapamiento con turnos fuera de este alcance
- **GIVEN** un intervalo `DISPONIBLE` según este recurso
- **WHEN** existe un turno bloqueante que ocupa ese intervalo
- **THEN** este recurso sigue respondiendo `DISPONIBLE`; la decisión de conflicto pertenece a la capa de turnos
