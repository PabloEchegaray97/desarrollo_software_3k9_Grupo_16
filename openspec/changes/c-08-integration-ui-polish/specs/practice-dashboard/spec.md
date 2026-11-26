# Spec Delta

## Purpose

Ofrece al odontólogo una portada operativa compacta con el estado de la jornada, los próximos turnos y acceso inmediato al detalle y las acciones frecuentes.

## ADDED Requirements

### Requirement: Dashboard autenticado como inicio
La aplicación SHALL mostrar en `/` un dashboard protegido como destino inicial de OdoSoft. SHALL incluir la fecha local de hoy en `America/Argentina/Buenos_Aires`, métricas operativas y un selector entre `Hoy` y `Próximos turnos`. Los accesos a Agenda, Pacientes, Prestaciones, Disponibilidad y Bloqueos SHALL permanecer en el shell.

#### Scenario: Inicio después del acceso
- **GIVEN** una sesión válida sin destino protegido previo
- **WHEN** finaliza el inicio de sesión
- **THEN** la aplicación navega a `/` y muestra el dashboard

#### Scenario: Acceso sin sesión
- **WHEN** se abre `/` sin una sesión vigente
- **THEN** la aplicación redirige a `/acceso` conservando `/` como destino posterior

### Requirement: Métricas derivadas del alcance seleccionado
El dashboard SHALL consultar la agenda de hoy para `Hoy` y los turnos desde hoy en adelante para `Próximos turnos`. SHALL mostrar el total, pendientes `PROGRAMADO` y confirmados `CONFIRMADO` del alcance seleccionado. SHALL contar únicamente la respuesta del backend y SHALL NOT inferir disponibilidad, huecos ni conflictos.

#### Scenario: Jornada con turnos
- **GIVEN** una respuesta de agenda con turnos en distintos estados y un alcance seleccionado
- **WHEN** se muestra el dashboard
- **THEN** el total, pendientes y confirmados coinciden con los turnos recibidos para ese alcance

#### Scenario: Jornada vacía
- **WHEN** la agenda de hoy responde sin turnos
- **THEN** todas las métricas muestran cero y el dashboard conserva la acción para crear un turno

#### Scenario: Error al consultar métricas
- **WHEN** falla la consulta de la agenda de hoy
- **THEN** el dashboard muestra un estado de error con reintento sin ocultar los accesos principales

### Requirement: Alcance Hoy y Próximos turnos
El selector SHALL mantener al usuario dentro del dashboard. `Hoy` SHALL mostrar únicamente la jornada actual. `Próximos turnos` SHALL mostrar todos los turnos futuros devueltos por el backend, agrupados por fecha y paginados, y SHALL posicionar inicialmente la página que contiene el siguiente turno operativo.

#### Scenario: Cambiar a Próximos turnos
- **WHEN** el odontólogo elige `Próximos turnos`
- **THEN** el dashboard no navega a Agenda y muestra los turnos desde hoy agrupados por fecha

#### Scenario: Muchos turnos antes del próximo
- **GIVEN** que el siguiente turno operativo no está en la primera página calculada
- **WHEN** se cargan los próximos turnos
- **THEN** el paginador abre la página que contiene ese turno y el ítem queda identificado como próximo

### Requirement: Acción global Nuevo turno
El shell SHALL mantener `Nuevo turno` visible como acción primaria junto a sus controles inferiores en escritorio y como acción flotante o accesible en móvil. La acción SHALL abrir el modal definido por `appointment-booking-ui` y, al cerrarlo, SHALL devolver el foco cuando el disparador siga presente.

#### Scenario: Abrir alta desde el dashboard
- **WHEN** el odontólogo activa `+ Nuevo turno`
- **THEN** se abre el modal de alta y el título del modal recibe el foco

#### Scenario: Cerrar sin crear
- **WHEN** el odontólogo cierra el modal sin guardar
- **THEN** el dashboard conserva sus datos y el foco vuelve a `+ Nuevo turno`

### Requirement: Listado, detalle y acciones contextuales
El dashboard SHALL mostrar los turnos como una lista paginada. En escritorio, elegir un ítem SHALL abrir su detalle lateral y ofrecer Cancelar, Reprogramar y Ver detalle al final del bloque. En móvil, tocar el ítem o su menú SHALL abrir un bottom sheet con las mismas acciones y SHALL retirar cualquier foco visual residual al cerrarlo.

#### Scenario: Detalle en escritorio
- **WHEN** el odontólogo elige un turno de la lista
- **THEN** el detalle lateral se abre sin abandonar `/` y las acciones quedan visibles al final del detalle

#### Scenario: Acciones en móvil
- **WHEN** el odontólogo toca un turno
- **THEN** se abre el bottom sheet de acciones y no se navega directamente al detalle

### Requirement: Actualización dinámica
El dashboard SHALL volver a consultar Hoy y Próximos cuando la aplicación notifique una creación o modificación exitosa de turno.

#### Scenario: Alta terminada
- **WHEN** se crea un turno desde el modal y se cierra su detalle
- **THEN** las métricas y el listado reflejan el nuevo turno sin recargar manualmente la página

### Requirement: Presentación compacta y responsive
El dashboard SHALL usar el design system revisión 2, densidad compacta en escritorio y espaciado mayor en móvil. SHALL evitar subtítulos redundantes, funcionar en 1440×900 y 390×844, mantener el footer de paginación accesible, permitir desplazamiento sobre la lista y respetar tema y reducción de movimiento.

#### Scenario: Escritorio
- **GIVEN** un viewport de 1440×900
- **WHEN** se muestra el dashboard
- **THEN** métricas, listado, detalle y paginación se distinguen sin desplazamiento horizontal

#### Scenario: Móvil
- **GIVEN** un viewport de 390×844
- **WHEN** se muestra el dashboard
- **THEN** métricas, listado, navegación y bottom sheets no se superponen, permiten desplazamiento y no generan desbordamiento horizontal
