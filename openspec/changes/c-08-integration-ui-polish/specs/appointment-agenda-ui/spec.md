# Spec Delta

## ADDED Requirements

### Requirement: Alternancia entre lista y grilla
La agenda SHALL permitir alternar entre una vista de lista y una grilla horaria del mismo día. La lista SHALL ser la vista inicial; una elección explícita SHALL persistirse localmente. Ambas vistas SHALL presentar la misma respuesta y el mismo orden del backend, sin inferir disponibilidad, huecos ni conflictos.

#### Scenario: Cambiar a grilla
- **GIVEN** una agenda mostrada como lista
- **WHEN** el odontólogo elige Grilla
- **THEN** los mismos turnos, intervalos y bloqueos se representan en una grilla horaria sin una nueva decisión temporal del cliente

#### Scenario: Conservar la preferencia
- **GIVEN** que el usuario eligió Grilla
- **WHEN** recarga la agenda o vuelve a abrirla
- **THEN** la grilla continúa seleccionada y la fecha y filtros siguen proviniendo de la URL

#### Scenario: Agenda vacía en grilla
- **WHEN** el backend devuelve un día sin turnos
- **THEN** la grilla conserva tramos y bloqueos informados y muestra el estado vacío sin inventar espacios disponibles

#### Scenario: Accesibilidad del selector
- **WHEN** el usuario recorre el control Lista/Grilla con teclado
- **THEN** puede cambiar la vista, identifica cuál está activa y conserva foco visible

## MODIFIED Requirements

### Requirement: Diseño responsive y accesible
La pantalla SHALL funcionar en 390×844 y en 1440×900 siguiendo el design system revisión 2 y el tema activo. En escritorio, lista o grilla y detalle SHALL aprovechar el área disponible junto al sidebar; en móvil, la vista SHALL ser de una columna y el detalle de ancho completo. SHALL mantener foco visible, etiquetas asociadas, contraste válido y `prefers-reduced-motion`.

#### Scenario: Escritorio
- **GIVEN** un viewport de 1440×900
- **WHEN** hay un turno elegido en lista o grilla
- **THEN** la agenda y el detalle se ven sin superponerse ni quedar ocultos por el sidebar expandido o contraído

#### Scenario: Móvil
- **GIVEN** un viewport de 390×844
- **WHEN** se muestra la agenda y se abre un detalle
- **THEN** no hay desplazamiento horizontal y el detalle ocupa el ancho completo con una acción "Cerrar" accesible

#### Scenario: Movimiento reducido
- **WHEN** el usuario tiene `prefers-reduced-motion: reduce`
- **THEN** las transiciones de la pantalla se reducen a efectos inmediatos

#### Scenario: Tema oscuro
- **WHEN** la agenda se muestra con tema oscuro
- **THEN** turnos, intervalos, bloqueos, estados y foco mantienen contraste y no dependen solo del color
