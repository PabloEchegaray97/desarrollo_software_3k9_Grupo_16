# Spec Delta

## ADDED Requirements

### Requirement: Alternancia entre Lista y Calendario
La agenda SHALL permitir alternar entre Lista y Calendario. Calendario SHALL ser la vista inicial y SHALL consultar el rango mensual visible y permitir elegir un día; Lista SHALL consultar los turnos desde hoy en adelante. Una elección explícita SHALL persistirse localmente. Ambas vistas SHALL respetar el orden y los estados informados por el backend, sin inferir disponibilidad, huecos ni conflictos.

#### Scenario: Cambiar a Calendario
- **GIVEN** una agenda mostrada como lista
- **WHEN** el odontólogo elige Calendario
- **THEN** se muestra el mes visible y, al elegir una fecha, sus turnos, intervalos y bloqueos se obtienen del backend sin una nueva decisión temporal del cliente

#### Scenario: Conservar la preferencia
- **GIVEN** que el usuario eligió Calendario
- **WHEN** recarga la agenda o vuelve a abrirla
- **THEN** Calendario continúa seleccionado y la fecha y filtros siguen proviniendo de la URL

#### Scenario: Agenda vacía
- **WHEN** el backend devuelve un día sin turnos
- **THEN** se muestra el estado vacío centrado con la acción para crear un turno, sin inventar espacios disponibles

#### Scenario: Accesibilidad del selector
- **WHEN** el usuario recorre el control Lista/Calendario con teclado
- **THEN** puede cambiar la vista, identifica cuál está activa y conserva foco visible

### Requirement: Detalle y acciones según el contexto
En escritorio, Lista SHALL abrir el detalle del turno en un panel lateral y Calendario SHALL abrirlo en un modal. En móvil, elegir un día SHALL abrir su listado en un bottom sheet y elegir un turno SHALL abrir un bottom sheet de acciones. Cerrar cualquiera de estas superficies SHALL retirar la selección visual residual.

#### Scenario: Selección en Lista de escritorio
- **WHEN** el odontólogo elige un turno en Lista
- **THEN** el detalle lateral muestra sus datos y acciones sin abandonar la agenda

#### Scenario: Selección en Calendario de escritorio
- **WHEN** el odontólogo elige un turno del día en Calendario
- **THEN** el detalle se abre como modal y sus acciones permanecen alineadas al margen inferior

#### Scenario: Selección móvil
- **WHEN** el odontólogo toca un turno desde la lista o desde el detalle de un día
- **THEN** se abre el bottom sheet de acciones y no se navega directamente a la página del turno

### Requirement: Actualización después de una mutación
Agenda SHALL volver a consultar los datos relevantes cuando la aplicación notifique la creación o modificación exitosa de un turno.

#### Scenario: Turno recién creado
- **WHEN** finaliza correctamente el alta de un turno y se cierra su detalle
- **THEN** el turno aparece en Lista o Calendario según corresponda sin recargar manualmente la página

## MODIFIED Requirements

### Requirement: Diseño responsive y accesible
La pantalla SHALL funcionar en 390×844 y en 1440×900 siguiendo el design system revisión 2 y el tema activo. En escritorio, Lista o Calendario y detalle SHALL aprovechar el área disponible junto al sidebar; en móvil, calendario, listado del día y acciones SHALL alternarse mediante superficies de ancho completo. SHALL mantener foco visible, etiquetas asociadas, contraste válido y `prefers-reduced-motion`.

#### Scenario: Escritorio
- **GIVEN** un viewport de 1440×900
- **WHEN** hay un turno elegido en Lista o Calendario
- **THEN** la agenda y el detalle se ven sin superponerse ni quedar ocultos por el sidebar expandido o contraído

#### Scenario: Móvil
- **GIVEN** un viewport de 390×844
- **WHEN** se muestra la agenda y se abre el listado de un día o las acciones de un turno
- **THEN** no hay desplazamiento horizontal, el bottom sheet permite recorrer su contenido y puede cerrarse mediante un control accesible

#### Scenario: Movimiento reducido
- **WHEN** el usuario tiene `prefers-reduced-motion: reduce`
- **THEN** las transiciones de la pantalla se reducen a efectos inmediatos

#### Scenario: Tema oscuro
- **WHEN** la agenda se muestra con tema oscuro
- **THEN** turnos, intervalos, bloqueos, estados y foco mantienen contraste y no dependen solo del color
