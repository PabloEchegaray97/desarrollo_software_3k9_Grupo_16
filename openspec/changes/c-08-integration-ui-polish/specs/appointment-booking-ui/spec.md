# Spec Delta

## MODIFIED Requirements

### Requirement: Formulario de alta de turno
La interfaz SHALL presentar el alta asociada a `/turnos/nuevo` como un modal de tres pasos sobre el contexto autenticado. SHALL permitir elegir prestación y sillón activos, buscar o crear un paciente activo, elegir fecha y hora locales y revisar una confirmación antes de persistir. Las sobrescrituras opcionales de duración e intervalo SHALL mostrar los valores predeterminados vigentes.

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

#### Scenario: Paciente recién creado
- **WHEN** el odontólogo crea un paciente desde el alta
- **THEN** el paciente aparece inmediatamente entre los recientes, queda disponible para seleccionarlo y no requiere recargar el modal

#### Scenario: Confirmación previa
- **GIVEN** paciente, prestación, sillón, fecha y horario válidos
- **WHEN** el odontólogo intenta agendar
- **THEN** el modal muestra paciente, prestación, sillón, horario y duración y no persiste hasta que se confirma el resumen

#### Scenario: Apertura desde una acción global
- **GIVEN** una pantalla autenticada con la acción `+ Nuevo turno`
- **WHEN** el odontólogo activa la acción
- **THEN** la URL refleja `/turnos/nuevo`, el modal se abre, el fondo deja de ser interactivo y el título recibe el foco

#### Scenario: Acceso directo a la ruta
- **WHEN** se abre directamente `/turnos/nuevo` con una sesión válida
- **THEN** el shell muestra el modal sobre un contexto estable sin exigir una ruta de origen previa

#### Scenario: Cerrar el modal
- **WHEN** el odontólogo cierra el alta sin guardar
- **THEN** vuelve al contexto de origen o a `/` si no existía, y el foco retorna al disparador cuando sigue presente

### Requirement: Estados y accesibilidad
El modal SHALL mostrar estados de carga y error al obtener opciones, asociar errores a sus campos, atrapar el foco mientras está abierto, cerrarse con `Esc` cuando no haya confirmación crítica pendiente y funcionar en 390×844 y 1440×900 con el design system revisión 2. SHALL respetar el tema y `prefers-reduced-motion` y evitar textos descriptivos redundantes.

#### Scenario: Error al cargar opciones
- **WHEN** falla la carga de prestaciones o sillones
- **THEN** la interfaz muestra un estado de error con reintento en lugar del formulario incompleto

#### Scenario: Navegación por teclado
- **WHEN** el usuario recorre el modal con teclado
- **THEN** el foco permanece dentro del modal, cada campo conserva etiqueta y la acción principal tiene un nombre accesible

#### Scenario: Móvil
- **GIVEN** un viewport de 390×844
- **WHEN** se abre el alta
- **THEN** el modal usa el ancho disponible, permite recorrer todos los campos y no genera desplazamiento horizontal

## ADDED Requirements

### Requirement: Separación entre alta y gestión del turno
El modal SHALL limitarse a crear turnos y mostrar su confirmación. Reprogramación, cancelación, cambio de estado e historial SHALL permanecer en `/turnos/:appointmentId`. Después de persistir, el encabezado SHALL indicar `Detalle del turno` y la única acción final SHALL ser `Cerrar`.

#### Scenario: Turno creado
- **WHEN** el alta finaliza correctamente
- **THEN** el modal muestra el detalle de paciente, prestación, sillón, fecha, horario, duración e intervalo y ofrece únicamente cerrar

#### Scenario: Cerrar el detalle creado
- **WHEN** el usuario elige Cerrar
- **THEN** el modal se cierra, vuelve al contexto de origen y las vistas suscriptas actualizan sus turnos sin exigir `F5`
