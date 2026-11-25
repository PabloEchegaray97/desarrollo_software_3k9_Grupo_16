# Spec Delta

## Purpose

Ofrece al odontólogo una portada operativa compacta con el estado de la jornada, accesos a las tareas frecuentes y una entrada inmediata al alta de turnos.

## ADDED Requirements

### Requirement: Dashboard autenticado como inicio
La aplicación SHALL mostrar en `/` un dashboard protegido como destino inicial de OdoSoft. SHALL incluir la fecha local de hoy en `America/Argentina/Buenos_Aires`, métricas de los turnos del día y accesos a Agenda, Pacientes, Prestaciones y sillones, y Disponibilidad.

#### Scenario: Inicio después del acceso
- **GIVEN** una sesión válida sin destino protegido previo
- **WHEN** finaliza el inicio de sesión
- **THEN** la aplicación navega a `/` y muestra el dashboard

#### Scenario: Acceso sin sesión
- **WHEN** se abre `/` sin una sesión vigente
- **THEN** la aplicación redirige a `/acceso` conservando `/` como destino posterior

### Requirement: Métricas derivadas de la agenda del día
El dashboard SHALL consultar la agenda de hoy y mostrar el total de turnos y el conteo por estado `PROGRAMADO`, `CONFIRMADO`, `ATENDIDO`, `AUSENTE` y `CANCELADO`. SHALL contar únicamente la respuesta del backend y SHALL NOT inferir disponibilidad, huecos ni conflictos.

#### Scenario: Jornada con turnos
- **GIVEN** una respuesta de agenda con turnos en distintos estados
- **WHEN** se muestra el dashboard
- **THEN** el total y cada conteo coinciden con los turnos recibidos

#### Scenario: Jornada vacía
- **WHEN** la agenda de hoy responde sin turnos
- **THEN** todas las métricas muestran cero y el dashboard conserva la acción para crear un turno

#### Scenario: Error al consultar métricas
- **WHEN** falla la consulta de la agenda de hoy
- **THEN** el dashboard muestra un estado de error con reintento sin ocultar los accesos principales

### Requirement: Acción global Nuevo turno
El dashboard SHALL mostrar `+ Nuevo turno` como acción primaria arriba a la derecha. La acción SHALL abrir el modal de alta definido por `appointment-booking-ui` y, al cerrarlo, SHALL devolver el foco al disparador.

#### Scenario: Abrir alta desde el dashboard
- **WHEN** el odontólogo activa `+ Nuevo turno`
- **THEN** se abre el modal de alta y el título del modal recibe el foco

#### Scenario: Cerrar sin crear
- **WHEN** el odontólogo cierra el modal sin guardar
- **THEN** el dashboard conserva sus datos y el foco vuelve a `+ Nuevo turno`

### Requirement: Presentación compacta y responsive
El dashboard SHALL usar el design system revisión 2, densidad compacta en escritorio y espaciado mayor en móvil. SHALL evitar subtítulos redundantes, funcionar en 1440×900 y 390×844, mantener foco visible y respetar tema y reducción de movimiento.

#### Scenario: Escritorio
- **GIVEN** un viewport de 1440×900
- **WHEN** se muestra el dashboard
- **THEN** métricas, accesos y acción primaria se distinguen sin desplazamiento horizontal

#### Scenario: Móvil
- **GIVEN** un viewport de 390×844
- **WHEN** se muestra el dashboard
- **THEN** las métricas se apilan, la acción primaria sigue visible y no hay desbordamiento horizontal
