# availability-settings-ui Specification

## Purpose

Define la experiencia de edición de horarios semanales y excepciones para el odontólogo, incluyendo validación visible y estados de carga, vacío, error y deshabilitado, sin delegar decisiones de disponibilidad al navegador.

## Requirements

### Requirement: Edición de horarios semanales

La interfaz SHALL permitir definir varios tramos por día, agregar y quitar tramos antes de guardar y enviar el conjunto completo al backend. SHALL mostrar en pantalla el resultado del guardado o el error devuelto, sin calcular por su cuenta si los tramos son válidos.

#### Scenario: Agregar dos tramos al mismo día
- **WHEN** el odontólogo agrega 09:00–13:00 y 16:00–20:00 al lunes y guarda
- **THEN** la interfaz envía ambos tramos y muestra confirmación cuando el backend responde éxito

#### Scenario: Error de solapamiento devuelto
- **GIVEN** el backend rechazó un reemplazo con `WEEKLY_SLOT_OVERLAP`
- **WHEN** llega la respuesta a la interfaz
- **THEN** se muestra un mensaje que identifica el día y el conflicto, y el formulario conserva los valores introducidos

#### Scenario: Sin tramos definidos
- **WHEN** se abre la edición de horarios de una agenda sin tramos
- **THEN** se muestra un estado vacío explicativo y la opción de agregar el primer tramo

### Requirement: Edición de excepciones fechadas

La interfaz SHALL permitir registrar feriados, vacaciones y bloqueos con fecha local, tipo, motivo y cobertura de día completo o tramo parcial, y SHALL enviar la decisión al backend para su validación.

#### Scenario: Registrar feriado de día completo
- **WHEN** el odontólogo elige tipo `FERIADO`, una fecha y un motivo, sin rango horario
- **THEN** la interfaz envía la excepción como día completo y muestra confirmación tras el éxito del backend

#### Scenario: Registrar bloqueo parcial
- **WHEN** el odontólogo elige tipo `BLOQUEO`, un rango 11:00–12:30 y un motivo
- **THEN** la interfaz envía horas de inicio y fin y muestra el rango guardado

#### Scenario: Motivo obligatorio visible
- **WHEN** el odontólogo intenta guardar una excepción con el motivo vacío
- **THEN** la interfaz marca el campo como inválido y no envía la solicitud

#### Scenario: Cancelar sin borrar
- **WHEN** el odontólogo cancela una excepción activa
- **THEN** la interfaz envía la cancelación, la oculta de la lista activa y mantiene disponible su consulta como inactiva

### Requirement: La interfaz no decide disponibilidad

La interfaz SHALL presentar el resultado devuelto por la evaluación del backend y SHALL NOT contener reglas propias de solapamiento, excepciones o conversión de zona horaria para decidir si un turno es posible.

#### Scenario: Resultado fuera de horario
- **GIVEN** el backend devolvió `FUERA_DE_DISPONIBILIDAD`
- **WHEN** se muestra el resultado en la pantalla de horarios
- **THEN** el mensaje invita a revisar los tramos o a gestionar el override en el flujo de turnos, sin habilitar el intervalo desde la interfaz

#### Scenario: Resultado bloqueado por excepción
- **GIVEN** el backend devolvió `EXCEPCION_BLOQUEANTE` con un motivo
- **WHEN** se muestra el resultado
- **THEN** se visualiza el motivo de la excepción y no se ofrece una acción para ignorarla desde la pantalla de horarios

### Requirement: Estados y accesibilidad de la feature

La interfaz SHALL ofrecer estados normal, cargando, vacío, error y deshabilitado, con etiquetas visibles, mensajes comprensibles y foco accesible, usando los tokens aprobados del sistema visual revisión 1.

#### Scenario: Guardado en curso
- **WHEN** el backend todavía está procesando un guardado
- **THEN** las acciones de guardado aparecen deshabilitadas y se muestra un indicador de carga sin duplicar envíos

#### Scenario: Error de red
- **WHEN** falla la comunicación con el backend
- **THEN** se muestra un mensaje de error reintentable y los datos introducidos se conservan

#### Scenario: Uso de tokens compartidos
- **WHEN** se renderiza la pantalla de horarios
- **THEN** utiliza los colores, radios y tipografía del sistema visual aprobado sin definir valores propios contradictorios
