# Spec Delta

## Purpose

Presenta al odontólogo su agenda diaria en `/agenda` de forma clara y responsive, con filtros, detalle del turno y refresco explícito, mostrando únicamente los resultados del backend y sin calcular disponibilidad ni conflictos en el navegador.

## ADDED Requirements

### Requirement: Vista diaria de la agenda
La interfaz SHALL mostrar en `/agenda` los turnos de una fecha local, por defecto la de hoy en `America/Argentina/Buenos_Aires`, con encabezado de la fecha, acciones para ir al día anterior, al siguiente y a hoy, y selección directa de fecha. La fecha y los filtros SHALL reflejarse en la URL para poder recargar o compartir la vista.

#### Scenario: Apertura sin parámetros
- **WHEN** el odontólogo abre `/agenda`
- **THEN** la interfaz consulta `GET /api/agenda` con `desde` igual a hoy en la zona del consultorio y muestra el encabezado con esa fecha

#### Scenario: Cambio de día
- **WHEN** el odontólogo elige "Día siguiente"
- **THEN** la interfaz consulta la fecha siguiente, actualiza la URL y muestra los turnos de ese día

#### Scenario: Recarga con fecha en la URL
- **WHEN** se abre `/agenda?fecha=2027-03-10`
- **THEN** la interfaz consulta y muestra el 10 de marzo de 2027

#### Scenario: Fecha inválida en la URL
- **WHEN** se abre `/agenda?fecha=no-es-fecha`
- **THEN** la interfaz muestra la fecha de hoy y no envía la fecha inválida al backend

### Requirement: La interfaz no calcula disponibilidad ni conflictos
La interfaz SHALL presentar los turnos en el orden recibido, enviar los filtros de sillón y estado al backend y mostrar los tramos y bloqueos que este informa. SHALL NOT reordenar, filtrar localmente, deducir huecos libres ni calcular conflictos o disponibilidad.

#### Scenario: Orden del backend
- **GIVEN** una respuesta con turnos en un orden dado
- **WHEN** la interfaz los muestra
- **THEN** aparecen exactamente en ese orden

#### Scenario: Filtro consultado al backend
- **WHEN** el odontólogo elige un sillón en el filtro
- **THEN** la interfaz envía una nueva consulta con `sillonId` y muestra solo lo que el backend devuelve, sin ocultar turnos localmente

### Requirement: Atención, intervalo, bloqueo y excepción diferenciados
La interfaz SHALL mostrar para cada turno su horario de atención y, aparte, su intervalo posterior cuando es mayor que cero; SHALL mostrar los bloqueos de disponibilidad del día como bandas separadas de los turnos, con su tipo, motivo y horario o "Todo el día"; y SHALL marcar los turnos fuera de disponibilidad como excepción.

#### Scenario: Turno con intervalo
- **GIVEN** un turno de 10:00 a 10:30 con 10 minutos de intervalo
- **WHEN** se muestra en la lista
- **THEN** la fila indica la atención "10:00–10:30" y el intervalo "10:30–10:40" como elementos distintos

#### Scenario: Turno sin intervalo
- **GIVEN** un turno con `intervaloPosteriorMinutos: 0`
- **WHEN** se muestra en la lista
- **THEN** la fila no muestra ningún elemento de intervalo

#### Scenario: Bloqueo de disponibilidad
- **GIVEN** un día con un bloqueo `FERIADO` de día completo
- **WHEN** se muestra el día
- **THEN** una banda distinta de los turnos indica el tipo "Feriado", el motivo y "Todo el día"

#### Scenario: Turno en excepción
- **GIVEN** un turno con `fueraDisponibilidad: true`
- **WHEN** se muestra en la lista
- **THEN** la fila lleva una marca "Fuera de disponibilidad" que no depende solo del color, y su motivo se ve en el detalle

### Requirement: Estados con texto, color y forma
La interfaz SHALL representar cada estado (`PROGRAMADO`, `CONFIRMADO`, `ATENDIDO`, `CANCELADO`, `AUSENTE`) con una etiqueta de texto, un color del design system y un ícono de forma propia, de modo que ninguno dependa solo del color. Los turnos `CANCELADO` SHALL distinguirse además como no bloqueantes.

#### Scenario: Cinco estados distinguibles
- **GIVEN** un turno en cada uno de los cinco estados
- **WHEN** se muestran en la lista
- **THEN** cada uno tiene su etiqueta de texto y una forma distinta de las otras cuatro

#### Scenario: Turno cancelado
- **GIVEN** un turno con `estado: "CANCELADO"` y `bloqueaHorario: false`
- **WHEN** se muestra en la lista
- **THEN** su etiqueta dice "Cancelado", su horario se muestra tachado y el lector de pantalla recibe el estado como texto

### Requirement: Filtros de sillón y estado
La interfaz SHALL ofrecer un selector de sillón con "Todos los sillones" y los sillones de `GET /api/sillones` (activos e inactivos), y un grupo de casillas por estado, todas marcadas por defecto. Si no queda ningún estado marcado, SHALL avisar que debe elegirse al menos uno y no consultar. Un botón "Limpiar filtros" SHALL restablecerlos.

#### Scenario: Filtrar por estados
- **WHEN** el odontólogo desmarca "Cancelado" y "Ausente"
- **THEN** la interfaz consulta con `estado=PROGRAMADO,CONFIRMADO,ATENDIDO` y actualiza la URL

#### Scenario: Ningún estado marcado
- **WHEN** el odontólogo desmarca todos los estados
- **THEN** la interfaz muestra "Elegí al menos un estado" junto al grupo y no envía la consulta

#### Scenario: Falla la carga de sillones
- **WHEN** falla `GET /api/sillones`
- **THEN** los demás filtros y la agenda siguen disponibles y el selector de sillón muestra un aviso con reintento

### Requirement: Detalle del turno
Al elegir un turno, la interfaz SHALL abrir su detalle con paciente, prestación, sillón, fecha, horario de atención, intervalo, duración, estado, si es excepción con su motivo, y una acción "Cerrar". El detalle SHALL mostrar solo `nombre` del paciente y cerrarse con `Esc`, devolviendo el foco al turno elegido, y SHALL reflejarse en la URL.

#### Scenario: Abrir y cerrar
- **WHEN** el odontólogo elige un turno y luego presiona `Esc`
- **THEN** el detalle se abre con los datos del turno, mueve el foco a su título, y al cerrarse devuelve el foco al turno

#### Scenario: Turno que ya no está en la respuesta
- **GIVEN** un detalle abierto cuyo turno desaparece tras actualizar la agenda
- **WHEN** termina la actualización
- **THEN** el detalle se cierra y la interfaz informa que el turno ya no está en la agenda

#### Scenario: Sin datos de contacto
- **GIVEN** una respuesta que incluyera campos adicionales como teléfono o DNI
- **WHEN** se muestran la lista y el detalle
- **THEN** ninguno de esos valores aparece en pantalla

### Requirement: Refresco explícito
La interfaz SHALL ofrecer una acción "Actualizar" que vuelve a consultar con la fecha y los filtros vigentes, y SHALL indicar la hora local en que el backend generó los datos mostrados. SHALL NOT refrescar sola ni inventar disponibilidad entre consultas. Si el refresco falla, SHALL conservar los datos previos y avisar el error.

#### Scenario: Actualizar
- **WHEN** el odontólogo elige "Actualizar"
- **THEN** la interfaz reenvía la consulta, mantiene la lista visible con indicación de actualización en curso y luego muestra "Actualizado a las HH:mm" con la hora de `generadoEn`

#### Scenario: Falla al actualizar
- **GIVEN** datos ya mostrados
- **WHEN** el refresco falla
- **THEN** la lista previa permanece visible con un aviso de error, la hora de los datos mostrados y una acción de reintento

### Requirement: Estados de carga, vacío y error
La interfaz SHALL mostrar un estado de carga al consultar por primera vez, un estado vacío cuando el backend devuelve `turnos: []` y un estado de error con reintento cuando la consulta falla. SHALL distinguir "No hay turnos para esta fecha" de "Ningún turno coincide con los filtros".

#### Scenario: Día sin turnos
- **WHEN** el backend responde `turnos: []` sin filtros activos
- **THEN** se muestra "No hay turnos para esta fecha" junto con los tramos y bloqueos del día

#### Scenario: Filtros sin coincidencias
- **WHEN** el backend responde `turnos: []` con algún filtro activo
- **THEN** se muestra "Ningún turno coincide con los filtros" con la acción "Limpiar filtros"

#### Scenario: Error de consulta
- **WHEN** `GET /api/agenda` falla
- **THEN** se muestra un estado de error con la acción "Reintentar" y los filtros siguen disponibles

#### Scenario: Rango rechazado por el backend
- **WHEN** el backend responde `AGENDA_RANGE_INVALID` o `AGENDA_RANGE_TOO_LARGE`
- **THEN** se muestra un mensaje claro sobre la fecha consultada y no se muestran turnos

### Requirement: Diseño responsive y accesible
La pantalla SHALL funcionar en 390×844 y en 1440×900 siguiendo el design system revisión 1: en escritorio, lista y detalle conviven en dos columnas; en móvil, una columna sin desplazamiento horizontal y el detalle a ancho completo. SHALL mantener el foco visible, asociar etiquetas a los controles y respetar `prefers-reduced-motion`.

#### Scenario: Escritorio
- **GIVEN** un viewport de 1440×900
- **WHEN** hay un turno elegido
- **THEN** la lista y el detalle se ven a la vez sin superponerse

#### Scenario: Móvil
- **GIVEN** un viewport de 390×844
- **WHEN** se muestra la agenda y se abre un detalle
- **THEN** no hay desplazamiento horizontal y el detalle ocupa el ancho completo con una acción "Cerrar" accesible

#### Scenario: Movimiento reducido
- **WHEN** el usuario tiene `prefers-reduced-motion: reduce`
- **THEN** las transiciones de la pantalla se reducen a efectos inmediatos

### Requirement: Puntos de integración para las acciones de C-06
La página de agenda SHALL aceptar una función opcional `renderActions` que recibe el turno mostrado y SHALL mostrar su resultado en el detalle, y SHALL enlazar el detalle con `/turnos/:id` ("Gestionar turno"). Cuando una acción externa informe un cambio mediante `onChanged`, la agenda SHALL volver a consultar. La agenda SHALL NOT importar ni editar componentes de lifecycle.

#### Scenario: Acciones inyectadas
- **GIVEN** una página de agenda con `renderActions` que devuelve un botón de prueba
- **WHEN** se abre el detalle de un turno
- **THEN** el botón aparece en el detalle y recibe los datos de ese turno

#### Scenario: Sin acciones inyectadas
- **WHEN** se abre el detalle sin `renderActions`
- **THEN** el detalle muestra el enlace "Gestionar turno" hacia `/turnos/<id>` y ninguna acción de cambio de estado

#### Scenario: Cambio externo
- **WHEN** una acción inyectada invoca `onChanged`
- **THEN** la agenda reenvía la consulta con la fecha y los filtros vigentes
