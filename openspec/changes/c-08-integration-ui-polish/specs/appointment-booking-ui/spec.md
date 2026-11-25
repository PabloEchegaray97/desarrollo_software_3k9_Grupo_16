# Spec Delta

## MODIFIED Requirements

### Requirement: Formulario de alta de turno
La interfaz SHALL presentar el alta asociada a `/turnos/nuevo` como un modal sobre el contexto autenticado. SHALL ofrecer paciente activo mediante búsqueda, prestación activa, sillón activo, fecha y hora locales, y sobrescrituras opcionales de duración e intervalo que muestran los valores predeterminados vigentes.

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
El modal SHALL limitarse a crear turnos y mostrar su confirmación. Reprogramación, cancelación, cambio de estado e historial SHALL permanecer en `/turnos/:appointmentId`; el modal SHALL enlazar a esa página cuando ya exista un turno.

#### Scenario: Turno creado
- **WHEN** el alta finaliza correctamente
- **THEN** el modal muestra el resumen y ofrece cerrar, crear otro o abrir la gestión del turno creado

#### Scenario: Gestionar un turno existente
- **WHEN** el usuario elige gestionar el turno desde el resumen
- **THEN** el modal se cierra y la aplicación navega a `/turnos/<id>`
