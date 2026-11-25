# appointment-history Specification

## Purpose

Expone el historial inmutable de un turno en orden cronológico, con los campos autorizados necesarios para comprender cancelaciones, reprogramaciones, excepciones y cambios de estado sin revelar información ajena al turno.

## Requirements

### Requirement: Consulta cronológica del historial
El sistema SHALL exponer `GET /api/turnos/:id/historial`, protegido por sesión, que devuelva `{ "turnoId": "...", "eventos": [...] }`. Los eventos SHALL ordenarse por `ocurridoEn` ascendente y, ante igualdad, por `id` ascendente. El MVP SHALL NO paginar el historial porque un turno admite un número acotado de eventos; la paginación se evaluará en un change posterior.

#### Scenario: Historial ordenado
- **GIVEN** un turno con eventos `CREADO`, `REPROGRAMADO` y `CAMBIO_ESTADO`
- **WHEN** se consulta su historial
- **THEN** la respuesta 200 contiene los tres eventos en orden cronológico ascendente con `turnoId` igual al solicitado

#### Scenario: Turno sin eventos adicionales
- **GIVEN** un turno recién creado
- **WHEN** se consulta su historial
- **THEN** la respuesta contiene al menos el evento `CREADO` y una lista de eventos no nula

#### Scenario: Turno inexistente
- **WHEN** se consulta el historial de un `id` inexistente
- **THEN** el sistema responde 404 con código `APPOINTMENT_NOT_FOUND`

#### Scenario: Sin sesión
- **WHEN** se consulta el historial sin sesión vigente
- **THEN** el sistema responde 401 y no revela eventos

### Requirement: Campos visibles de cada evento
El sistema SHALL devolver para cada evento exactamente `id`, `tipo`, `ocurridoEn`, `estadoAnterior`, `estadoNuevo`, `inicioAnterior`, `inicioNuevo`, `sillonAnteriorId`, `sillonNuevoId` y `motivo`. Los campos no aplicables SHALL ser `null`. `motivo` SHALL informarse solo en eventos `CANCELADO`, `REPROGRAMADO` y `EXCEPCION`. Esta visibilidad corresponde a P1-02 y queda sujeta a aprobación explícita antes de Apply.

#### Scenario: Evento de reprogramación
- **GIVEN** un evento `REPROGRAMADO` de un turno que estaba `CONFIRMADO`
- **WHEN** se consulta el historial
- **THEN** el evento expone estados anterior y nuevo, inicios anterior y nuevo, sillones anterior y nuevo y el motivo normalizado

#### Scenario: Evento de cambio de estado
- **GIVEN** un evento `CAMBIO_ESTADO`
- **WHEN** se consulta el historial
- **THEN** el evento expone `estadoAnterior` y `estadoNuevo`, con `inicioAnterior`, `inicioNuevo`, sillones y `motivo` en `null`

#### Scenario: Evento de excepción
- **GIVEN** un turno creado o reprogramado fuera de disponibilidad con justificación
- **WHEN** se consulta el historial
- **THEN** el evento `EXCEPCION` expone el motivo informado y `ocurridoEn` como instante UTC

#### Scenario: Instantes en UTC
- **WHEN** se consulta un historial con eventos de distintos días locales
- **THEN** todos los campos de fecha-hora devueltos usan ISO 8601 con sufijo `Z`, sin offsets fijos

### Requirement: Privacidad y minimización del historial
El sistema SHALL NO incluir en el historial datos de pacientes, información clínica, credenciales ni detalles de otros turnos. Los motivos SHALL limitarse al texto normalizado de 1 a 500 caracteres propio del evento y los registros SHALL conservarse solo mientras exista el turno asociado.

#### Scenario: Sin datos de paciente
- **GIVEN** un turno con paciente y prestación ficticios
- **WHEN** se consulta su historial
- **THEN** la respuesta no contiene nombre, teléfono, documento, correo, prestación clínica ni identificadores de pacientes

#### Scenario: Solo motivos autorizados
- **GIVEN** eventos de creación y cambio de estado
- **WHEN** se consulta el historial
- **THEN** esos eventos devuelven `motivo: null` y solo los eventos autorizados muestran texto

### Requirement: Inmutabilidad del historial
El sistema SHALL NO exponer operaciones para editar o eliminar eventos, y SHALL rechazar cualquier modificación directa de eventos desde la interfaz ordinaria. Los eventos SHALL generarse únicamente como parte de las operaciones del ciclo de vida.

#### Scenario: Sin endpoints de edición
- **WHEN** un cliente intenta modificar o borrar un evento del historial
- **THEN** el sistema no ofrece esa operación y devuelve un error HTTP de método o ruta no soportada

#### Scenario: Evento huérfano imposible
- **WHEN** falla la escritura de un evento dentro de una operación de ciclo de vida
- **THEN** no queda ningún evento persistido sin su turno asociado

### Requirement: Historial en las respuestas de operación
El sistema SHALL incluir el historial completo y ordenado en la respuesta de cada operación de reprogramación, cancelación y cambio de estado, para que el cliente pueda refrescar la línea de tiempo sin una solicitud adicional.

#### Scenario: Respuesta tras cancelar
- **WHEN** se cancela un turno correctamente
- **THEN** la respuesta 200 incluye el turno `CANCELADO` y el historial con el nuevo evento `CANCELADO` al final

#### Scenario: Coherencia con la consulta
- **GIVEN** una operación completada
- **WHEN** se consulta luego el historial por HTTP
- **THEN** ambas representaciones contienen los mismos eventos en el mismo orden
