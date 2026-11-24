# appointment-booking-ui Specification

## Purpose

Permite al odontólogo dar de alta un turno desde la interfaz presentando con claridad las decisiones del backend sobre disponibilidad, excepciones y conflictos, sin tomarlas en el navegador.

## Requirements

### Requirement: Formulario de alta de turno
La interfaz SHALL ofrecer en `/turnos/nuevo` la selección de un paciente activo mediante búsqueda, una prestación activa, un sillón activo, fecha y hora locales, y sobrescrituras opcionales de duración e intervalo que muestran como referencia los valores predeterminados vigentes.

#### Scenario: Valores de referencia
- **GIVEN** una prestación de 30 minutos sin intervalo propio y el intervalo global en 10 minutos
- **WHEN** el odontólogo selecciona esa prestación
- **THEN** la ayuda de duración indica 30 minutos y la del intervalo indica que se usará el intervalo global de 10 minutos

#### Scenario: Solo referencias activas
- **WHEN** se cargan las opciones de paciente, prestación y sillón
- **THEN** la interfaz ofrece únicamente registros activos

#### Scenario: Campos obligatorios
- **WHEN** el odontólogo intenta confirmar sin paciente, prestación, sillón, fecha u hora
- **THEN** la interfaz marca los campos faltantes y no envía la solicitud

### Requirement: La interfaz no decide disponibilidad ni conflictos
La interfaz SHALL enviar la solicitud al backend y presentar su resultado; SHALL NOT calcular disponibilidad, conflictos ni tiempos efectivos por su cuenta.

#### Scenario: Resultado del backend
- **WHEN** el odontólogo confirma el formulario
- **THEN** la interfaz envía `POST /api/turnos` sin bloquear ningún horario localmente y muestra la respuesta recibida

### Requirement: Confirmación de excepción con motivo
Cuando el backend responde `APPOINTMENT_OUTSIDE_AVAILABILITY`, la interfaz SHALL explicar que el horario está fuera de la disponibilidad y ofrecer continuar como excepción en un modal que exige un motivo antes de reenviar con `fueraDisponibilidad: true`.

#### Scenario: Continuar como excepción
- **GIVEN** el backend respondió `APPOINTMENT_OUTSIDE_AVAILABILITY`
- **WHEN** el odontólogo escribe un motivo y confirma la excepción
- **THEN** la interfaz reenvía los mismos datos con `fueraDisponibilidad: true` y el motivo

#### Scenario: Motivo vacío
- **WHEN** el odontólogo intenta confirmar la excepción sin motivo
- **THEN** el modal muestra el error junto al campo y no envía la solicitud

#### Scenario: Cancelar la excepción
- **WHEN** el odontólogo cierra el modal sin confirmar
- **THEN** el formulario conserva los datos y no se crea ningún turno

### Requirement: Explicación de rechazos
La interfaz SHALL explicar en lenguaje claro los rechazos del backend sin perder los datos cargados: conflicto con otro turno del odontólogo, sillón ocupado, día bloqueado por una excepción de disponibilidad, referencia inactiva, inicio pasado y hora inválida.

#### Scenario: Conflicto en otro sillón
- **WHEN** el backend responde `APPOINTMENT_CONFLICT` con `alcance: "ODONTOLOGO"`
- **THEN** la interfaz indica que ya hay otro turno del odontólogo en ese horario, con la hora local del turno existente, y conserva el formulario

#### Scenario: Día bloqueado
- **WHEN** el backend responde `APPOINTMENT_BLOCKED_BY_EXCEPTION`
- **THEN** la interfaz indica el tipo de excepción y no ofrece continuar como excepción

### Requirement: Confirmación del turno creado
Tras un alta exitosa, la interfaz SHALL mostrar la fecha y las horas locales de inicio, fin de atención y fin de bloqueo, la duración e intervalo efectivos y si se registró como excepción, y SHALL permitir cargar otro turno.

#### Scenario: Turno creado
- **WHEN** el backend responde 201
- **THEN** la interfaz muestra el resumen con horas en `America/Argentina/Buenos_Aires` y una acción para crear otro turno

### Requirement: Estados y accesibilidad
La pantalla SHALL mostrar estados de carga y error al obtener opciones, asociar errores a sus campos, mantener el foco visible, funcionar en 390×844 y 1440×900 y respetar `prefers-reduced-motion`, siguiendo el design system revisión 1.

#### Scenario: Error al cargar opciones
- **WHEN** falla la carga de prestaciones o sillones
- **THEN** la interfaz muestra un estado de error con reintento en lugar del formulario incompleto
