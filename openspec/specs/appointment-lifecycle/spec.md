# appointment-lifecycle Specification

## Purpose

Gestiona el ciclo de vida de un turno ya creado: reprogramarlo, cancelarlo y registrar confirmación, atención o ausencia con transiciones válidas, conservando los valores anteriores y ejecutando cada cambio de forma atómica.

## Requirements

### Requirement: Reprogramar un turno
El sistema SHALL permitir cambiar la fecha, la hora y, opcionalmente, el sillón de un turno en `PROGRAMADO` o `CONFIRMADO` mediante `PATCH /api/turnos/:id/reprogramar`, conservando paciente, prestación, duración efectiva e intervalo efectivo. La operación SHALL registrar un evento `REPROGRAMADO` con inicio y sillón anteriores y nuevos.

#### Scenario: Reprogramación válida
- **GIVEN** un turno `PROGRAMADO` con inicio anterior ficticio y un horario disponible distinto
- **WHEN** el odontólogo envía la nueva fecha, hora y motivo
- **THEN** el sistema responde 200 con el turno actualizado, conserva duración e intervalo efectivos y registra un evento `REPROGRAMADO`

#### Scenario: Turno inexistente
- **WHEN** se reprograma un `id` que no existe
- **THEN** el sistema responde 404 con código `APPOINTMENT_NOT_FOUND` y no registra ningún evento

#### Scenario: Sin sesión
- **WHEN** se envía la solicitud sin sesión vigente
- **THEN** el sistema responde 401 y no modifica el turno

### Requirement: Motivo obligatorio al reprogramar
El sistema SHALL exigir un `motivo` no vacío en toda reprogramación. El valor SHALL normalizarse recortando los extremos y colapsando las secuencias de espacios en blanco, y SHALL tener entre 1 y 500 caracteres tras la normalización. Esta decisión corresponde a P1-04 y queda sujeta a aprobación explícita antes de Apply.

#### Scenario: Motivo ausente
- **WHEN** se reprograma sin `motivo` o con un valor que solo contiene espacios
- **THEN** el sistema responde 400 con código `VALIDATION_ERROR` y `details.campo: "motivo"`, sin modificar el turno

#### Scenario: Motivo demasiado largo
- **WHEN** el `motivo` supera 500 caracteres después de normalizarlo
- **THEN** el sistema responde 400 con código `VALIDATION_ERROR` y `details.campo: "motivo"`

#### Scenario: Motivo normalizado
- **WHEN** se envía un motivo con espacios al inicio, al final y repetidos en el medio
- **THEN** el sistema persiste el texto recortado con una sola separación entre palabras en el evento `REPROGRAMADO`

### Requirement: Revalidación de la nueva ubicación temporal
El sistema SHALL validar la reprogramación con las mismas reglas de creación: hora válida en `America/Argentina/Buenos_Aires`, sillón existente y activo, disponibilidad semanal y excepciones, y ausencia de solapamientos con otros turnos bloqueantes. El turno que se reprograma SHALL excluirse de la búsqueda de conflictos.

#### Scenario: Conflicto con otro turno
- **GIVEN** otro turno bloqueante que ocupa el nuevo horario
- **WHEN** se solicita la reprogramación
- **THEN** el sistema responde 409 con código `APPOINTMENT_CONFLICT` y `details.alcance` sin datos del paciente, y conserva el turno original

#### Scenario: Sillón inactivo
- **WHEN** la reprogramación elige un sillón inactivo
- **THEN** el sistema responde 422 con código `APPOINTMENT_REFERENCE_INVALID` y `details.campo: "sillonId"`

#### Scenario: Fuera de disponibilidad
- **WHEN** el nuevo horario queda fuera de la disponibilidad semanal sin confirmación de excepción
- **THEN** el sistema responde 409 con código `APPOINTMENT_OUTSIDE_AVAILABILITY` y `details.requiereOverrideManual: true`

#### Scenario: Día bloqueado por excepción
- **WHEN** el nuevo horario cae en una fecha bloqueada por feriado, vacaciones o bloqueo
- **THEN** el sistema responde 409 con código `APPOINTMENT_BLOCKED_BY_EXCEPTION`, incluso si se envía una excepción manual

#### Scenario: Excepción manual con motivo
- **WHEN** el nuevo horario está fuera de disponibilidad y se envían confirmación y motivo de excepción sin solapamientos
- **THEN** el sistema aplica la reprogramación, guarda `fueraDisponibilidad: true` y registra un evento `EXCEPCION` adicional en la misma operación

#### Scenario: Excepción innecesaria
- **WHEN** el nuevo horario está disponible y se envía confirmación de excepción
- **THEN** el sistema guarda el turno como ordinario con `fueraDisponibilidad: false` y sin motivo de excepción

### Requirement: Reprogramar un turno confirmado
El sistema SHALL devolver a `PROGRAMADO` todo turno `CONFIRMADO` que se reprograme, porque el nuevo horario todavía no fue confirmado. SHALL registrarse un único evento `REPROGRAMADO` con `estadoAnterior: "CONFIRMADO"` y `estadoNuevo: "PROGRAMADO"`, sin un evento `CAMBIO_ESTADO` adicional.

#### Scenario: Confirmado reprogramado
- **GIVEN** un turno `CONFIRMADO`
- **WHEN** se reprograma correctamente
- **THEN** el turno queda `PROGRAMADO` y su historial incorpora exactamente un evento `REPROGRAMADO` con ambos estados

#### Scenario: Reprogramado sin confirmación previa
- **GIVEN** un turno `PROGRAMADO`
- **WHEN** se reprograma correctamente
- **THEN** el turno sigue `PROGRAMADO` y el evento registra el mismo estado anterior y nuevo

### Requirement: Matriz de transiciones de estado
El sistema SHALL aceptar únicamente las transiciones `PROGRAMADO` → `CONFIRMADO`, `PROGRAMADO` → `ATENDIDO`, `PROGRAMADO` → `AUSENTE`, `PROGRAMADO` → `CANCELADO`, `CONFIRMADO` → `ATENDIDO`, `CONFIRMADO` → `AUSENTE` y `CONFIRMADO` → `CANCELADO`. `CANCELADO` SHALL solicitarse únicamente mediante la operación de cancelación con motivo. Toda otra combinación SHALL rechazarse con `APPOINTMENT_INVALID_TRANSITION` (409).

#### Scenario: Confirmación permitida
- **GIVEN** un turno `PROGRAMADO`
- **WHEN** se solicita el estado `CONFIRMADO`
- **THEN** el sistema responde 200, actualiza el estado y registra un evento `CAMBIO_ESTADO` con estados anterior y nuevo

#### Scenario: Confirmación repetida
- **GIVEN** un turno `CONFIRMADO`
- **WHEN** se solicita nuevamente el estado `CONFIRMADO`
- **THEN** el sistema responde 409 con código `APPOINTMENT_INVALID_TRANSITION` y no registra eventos

#### Scenario: Salto no permitido
- **GIVEN** un turno `PROGRAMADO`
- **WHEN** se solicita directamente el estado `AUSENTE` antes del inicio
- **THEN** el sistema responde 422 con código `APPOINTMENT_TOO_EARLY` y no cambia el estado

#### Scenario: Estado no reconocido
- **WHEN** el cuerpo de la solicitud contiene un estado fuera de los cinco estados definidos
- **THEN** el sistema responde 400 con código `VALIDATION_ERROR`

### Requirement: Estados terminales
El sistema SHALL tratar `ATENDIDO`, `AUSENTE` y `CANCELADO` como estados terminales en el MVP: no aceptar nuevas transiciones ni reprogramaciones desde ellos. Su corrección SHALL reservarse para una operación administrativa futura y auditada, fuera de este cambio.

#### Scenario: Atendido terminal
- **GIVEN** un turno `ATENDIDO`
- **WHEN** se intenta confirmarlo, cancelarlo o reprogramarlo
- **THEN** el sistema responde 409 con código `APPOINTMENT_INVALID_TRANSITION` y el turno permanece `ATENDIDO`

#### Scenario: Cancelado terminal
- **GIVEN** un turno `CANCELADO`
- **WHEN** se intenta cambiar su estado
- **THEN** el sistema responde 409 con código `APPOINTMENT_INVALID_TRANSITION` y no se crea ningún evento

### Requirement: Cancelación con motivo
El sistema SHALL permitir cancelar un turno `PROGRAMADO` o `CONFIRMADO` mediante `PATCH /api/turnos/:id/cancelar` con un `motivo` de 1 a 500 caracteres normalizados. SHALL cambiar el estado a `CANCELADO` sin eliminar el registro, SHALL persistir el motivo en el turno y SHALL liberar el horario porque `CANCELADO` deja de bloquear.

#### Scenario: Cancelación válida
- **GIVEN** un turno `CONFIRMADO`
- **WHEN** se cancela con un motivo ficticio no vacío
- **THEN** el sistema responde 200, el estado pasa a `CANCELADO`, `motivoCancelacion` conserva el texto y se registra un evento `CANCELADO`

#### Scenario: Cancelación sin motivo
- **WHEN** se cancela sin `motivo`
- **THEN** el sistema responde 400 con código `VALIDATION_ERROR` y `details.campo: "motivo"`, sin modificar el turno

#### Scenario: Horario liberado
- **GIVEN** un turno recién cancelado
- **WHEN** se crea otro turno en el mismo intervalo
- **THEN** el alta se completa porque el turno cancelado ya no bloquea

### Requirement: Ventana temporal para atención y ausencia
El sistema SHALL permitir registrar `ATENDIDO` o `AUSENTE` únicamente cuando el instante actual del servidor sea igual o posterior al `inicio` del turno. El `inicio` SHALL interpretarse en `America/Argentina/Buenos_Aires` y persistirse como instante UTC; la comparación SHALL ejecutarse en NestJS con un reloj inyectable, nunca en el navegador. El MVP SHALL NO establecer una cota superior: esa ausencia de límite es una Propuesta a confirmar.

#### Scenario: Antes del inicio
- **GIVEN** el reloj del servidor anterior al inicio del turno
- **WHEN** se solicita `ATENDIDO` o `AUSENTE`
- **THEN** el sistema responde 422 con código `APPOINTMENT_TOO_EARLY` y `details` con instantes UTC neutrales

#### Scenario: En el inicio
- **GIVEN** el reloj del servidor exactamente en el inicio del turno
- **WHEN** se solicita `ATENDIDO`
- **THEN** el sistema acepta la transición y registra el evento con `ocurridoEn` en UTC

#### Scenario: Zona del proceso
- **GIVEN** el proceso ejecutándose con zona del sistema distinta de la del consultorio
- **WHEN** se registra una ausencia para un turno cuya hora local ya comenzó
- **THEN** la decisión usa el instante UTC del inicio y no la zona local del proceso

### Requirement: Preservación de valores y trazabilidad
El sistema SHALL conservar en el turno los valores efectivos copiados al crear —duración, intervalo, paciente y prestación— al reprogramar o cambiar de estado. Cada evento SHALL registrar momento, tipo, valores anteriores y nuevos autorizados, sin duplicar fines derivados del inicio y los minutos efectivos.

#### Scenario: Reprogramación conserva valores efectivos
- **GIVEN** un turno con duración e intervalo efectivos propios
- **WHEN** se reprograma a otra hora y sillón
- **THEN** el turno conserva esos minutos y recalcula fin de atención y fin de bloqueo desde el nuevo inicio

#### Scenario: Evento con valores anteriores
- **GIVEN** un turno con sillón e inicio anteriores
- **WHEN** se reprograma
- **THEN** el evento contiene `inicioAnterior`, `inicioNuevo`, `sillonAnteriorId`, `sillonNuevoId`, estados anterior y nuevo y el motivo

#### Scenario: Cambio de estado sin motivo
- **WHEN** se confirma un turno
- **THEN** el evento `CAMBIO_ESTADO` registra estados anterior y nuevo con `motivo: null`

### Requirement: Operación atómica y sin eventos huérfanos
El sistema SHALL aplicar cada operación de ciclo de vida —actualización del turno y escritura de sus eventos— en una única transacción serializada para la agenda. Ante un error de validación, conflicto o escritura del historial, SHALL revertir todos los cambios y SHALL NO persistir eventos sin turno asociado ni turnos modificados sin su evento.

#### Scenario: Falla al escribir el evento
- **GIVEN** una falla simulada en la escritura del evento de cancelación
- **WHEN** se cancela el turno
- **THEN** la transacción se revierte, el turno sigue en su estado anterior y no queda ningún evento nuevo

#### Scenario: Conflicto detectado durante la reprogramación
- **GIVEN** otro turno bloqueante detectado antes del commit
- **WHEN** se reprograma
- **THEN** no se modifica el inicio, no se escribe el evento y se devuelve `APPOINTMENT_CONFLICT`

#### Scenario: Reprogramaciones concurrentes
- **WHEN** dos solicitudes incompatibles intentan reprogramar turnos distintos hacia el mismo horario
- **THEN** exactamente una responde 200 y la otra 409 con código `APPOINTMENT_CONFLICT`

### Requirement: Contrato HTTP neutral y sesión
El sistema SHALL exponer las operaciones bajo `/api/turnos` con respuestas 200 que incluyan el turno actualizado y su historial ordenado, y SHALL protegerlas con la sesión vigente. Los errores SHALL publicar `code` y `details` estables, sin nombres, teléfonos, documentos, correos ni datos clínicos de pacientes.

#### Scenario: Respuesta de operación
- **WHEN** una operación de ciclo de vida se completa
- **THEN** la respuesta 200 contiene el turno con instantes ISO UTC y el historial cronológico del turno

#### Scenario: Error sin datos personales
- **WHEN** una operación falla por conflicto o transición inválida
- **THEN** el cuerpo del error contiene solo códigos y detalles operativos, sin datos identificatorios de pacientes
