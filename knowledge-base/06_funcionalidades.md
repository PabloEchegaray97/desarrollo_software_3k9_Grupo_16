# Funcionalidades

Las historias están organizadas por épica. Los criterios describen comportamiento esperado, pero cada change de OpenSpec deberá convertirlos en escenarios verificables más precisos.

## Épica 1: Pacientes

### US-001 — Registrar paciente

**Como** odontólogo  
**Quiero** registrar un paciente con datos mínimos  
**Para** asociarlo a turnos sin cargar información clínica innecesaria

**Criterios de aceptación:**

- [ ] Nombre y teléfono son obligatorios.
- [ ] DNI y email pueden omitirse.
- [ ] DNI repetido produce un error de negocio.
- [ ] Coincidencia de nombre y teléfono muestra una advertencia, no un bloqueo.
- [ ] Los datos de demostración son ficticios.

**Reglas relacionadas:** RN-PA-01 a RN-PA-07.

### US-002 — Consultar y actualizar paciente

**Como** odontólogo  
**Quiero** buscar y actualizar los datos administrativos de un paciente  
**Para** mantener la agenda correcta

**Criterios de aceptación:**

- [ ] Puede buscarse por nombre, teléfono o DNI informado.
- [ ] Actualizar DNI vuelve a comprobar unicidad.
- [ ] La política de baja queda condicionada a la pregunta abierta correspondiente.

**Reglas relacionadas:** RN-PA-03, RN-PA-04.

## Épica 2: Catálogos y configuración

### US-010 — Gestionar prestaciones

**Como** odontólogo  
**Quiero** definir prestaciones con duración e intervalo  
**Para** calcular automáticamente el tiempo ocupado

**Criterios de aceptación:**

- [ ] Toda prestación tiene nombre y duración predeterminada.
- [ ] El intervalo específico es opcional.
- [ ] Si no hay intervalo específico, se aplica el global.
- [ ] La duración no supera 240 minutos y el intervalo no supera 30 minutos.

**Reglas relacionadas:** RN-PR-01, RN-PR-03, RN-PR-04, RN-PR-06.

### US-011 — Gestionar sillones

**Como** odontólogo  
**Quiero** identificar los sillones disponibles  
**Para** asignar un recurso físico a cada turno

**Criterios de aceptación:**

- [ ] Se pueden registrar varios sillones.
- [ ] Todo turno selecciona uno.
- [ ] Dos sillones no permiten dos turnos simultáneos del odontólogo.

**Reglas relacionadas:** RN-SI-01 a RN-SI-04.

### US-012 — Configurar intervalo global

**Como** odontólogo  
**Quiero** definir un intervalo general entre turnos  
**Para** reservar tiempo operativo entre atenciones

**Criterios de aceptación:**

- [ ] Existe un valor global persistido.
- [ ] El valor inicial es 10 minutos.
- [ ] Las prestaciones pueden sobrescribirlo.
- [ ] El turno puede sobrescribir el intervalo al crearse.
- [ ] Cambiarlo no altera turnos históricos ya creados.

**Reglas relacionadas:** RN-PR-03, RN-PR-04, RN-PR-07.

## Épica 3: Disponibilidad

### US-020 — Definir disponibilidad semanal

**Como** odontólogo  
**Quiero** registrar mis horarios semanales  
**Para** limitar los turnos ordinarios a momentos atendibles

**Criterios de aceptación:**

- [ ] Puede haber más de un tramo por día.
- [ ] Inicio debe ser anterior a fin.
- [ ] No se aceptan tramos semanales solapados.

**Reglas relacionadas:** RN-DI-01.

### US-021 — Registrar excepción por fecha

**Como** odontólogo  
**Quiero** bloquear feriados, vacaciones o períodos particulares  
**Para** evitar turnos cuando no atiendo

**Criterios de aceptación:**

- [ ] La excepción tiene fecha, tipo y motivo.
- [ ] Puede cubrir el día completo o un tramo.
- [ ] La agenda identifica el conflicto con la excepción.

**Reglas relacionadas:** RN-DI-02, RN-DI-03.

## Épica 4: Turnos

### US-030 — Crear turno sin solapamientos

**Como** odontólogo  
**Quiero** crear un turno para un paciente, prestación y sillón  
**Para** reservar un horario válido

**Criterios de aceptación:**

- [ ] Calcula duración e intervalo efectivos.
- [ ] Permite sobrescribir duración e intervalo respetando los máximos de 240 y 30 minutos.
- [ ] Rechaza conflictos con cualquier turno bloqueante del odontólogo.
- [ ] Rechaza conflictos con el sillón seleccionado.
- [ ] Permite comenzar exactamente al finalizar el bloqueo anterior.
- [ ] Valida disponibilidad y excepciones fechadas.
- [ ] Persiste duración e intervalo efectivos.

**Reglas relacionadas:** RN-PR-05 a RN-PR-07, RN-SI-03, RN-SI-04, RN-DI-03, RN-TU-01 a RN-TU-05.

### US-031 — Crear turno fuera de disponibilidad

**Como** odontólogo  
**Quiero** autorizar excepcionalmente un turno fuera de mi horario  
**Para** atender una situación particular sin perder trazabilidad

**Criterios de aceptación:**

- [ ] Requiere confirmación explícita y motivo.
- [ ] No permite ignorar solapamientos.
- [ ] Registra la excepción en el historial.

**Reglas relacionadas:** RN-DI-04 a RN-DI-06, RN-AU-01.

### US-032 — Consultar agenda

**Como** odontólogo  
**Quiero** ver la agenda por fecha y sillón  
**Para** organizar la atención diaria

**Criterios de aceptación:**

- [ ] Muestra inicio, fin de atención, intervalo, paciente, prestación, sillón y estado.
- [ ] Distingue bloqueos y excepciones.
- [ ] No expone datos clínicos porque están fuera del MVP.

**Reglas relacionadas:** RN-TU-01, RN-DI-02.

## Épica 5: Ciclo de vida e historial

### US-040 — Reprogramar turno

**Como** odontólogo  
**Quiero** cambiar fecha, hora o sillón de un turno  
**Para** adaptarme sin perder el registro anterior

**Criterios de aceptación:**

- [ ] La nueva ubicación temporal se valida como una creación.
- [ ] Si falla la validación, el turno original queda intacto.
- [ ] El historial conserva fecha, hora y sillón anteriores.

**Reglas relacionadas:** RN-TU-10 a RN-TU-12, RN-AU-01 a RN-AU-03.

### US-041 — Cancelar turno

**Como** odontólogo  
**Quiero** cancelar un turno indicando un motivo  
**Para** liberar el horario sin borrar lo ocurrido

**Criterios de aceptación:**

- [ ] El turno cambia a CANCELADO y no se elimina.
- [ ] El motivo es obligatorio.
- [ ] Se registra un evento histórico.
- [ ] CANCELADO deja de bloquear y libera el horario.

**Reglas relacionadas:** RN-TU-07 a RN-TU-09, RN-AU-01.

### US-042 — Cambiar estado del turno

**Como** odontólogo  
**Quiero** confirmar, atender o marcar ausencia  
**Para** reflejar el resultado de la cita

**Criterios de aceptación:**

- [ ] Solo se aceptan estados y transiciones aprobados.
- [ ] Cada cambio registra estado anterior, nuevo y momento.
- [ ] PROGRAMADO puede pasar a CONFIRMADO, ATENDIDO, AUSENTE o CANCELADO.
- [ ] CONFIRMADO puede pasar a ATENDIDO, AUSENTE o CANCELADO.
- [ ] ATENDIDO, AUSENTE y CANCELADO son terminales.
- [ ] ATENDIDO y AUSENTE requieren que el horario ya haya comenzado.

**Reglas relacionadas:** RN-TU-06, RN-TU-07, RN-TU-13 a RN-TU-19, RN-AU-01.

### US-043 — Consultar historial

**Como** odontólogo  
**Quiero** ver los cambios relevantes de un turno  
**Para** entender cancelaciones, reprogramaciones y excepciones

**Criterios de aceptación:**

- [ ] El historial es cronológico.
- [ ] No puede editarse desde la interfaz ordinaria.
- [ ] Muestra motivos obligatorios y valores anteriores/nuevos autorizados.

**Reglas relacionadas:** RN-AU-01 a RN-AU-04.

## Épica 6: Capacidades posteriores

Estas historias no pertenecen al MVP y no deben planificarse antes de completar el núcleo:

- recordatorios y confirmaciones por WhatsApp/email;
- reserva pública;
- historia clínica y odontograma;
- caja, señas y Mercado Pago;
- ARCA;
- obras sociales;
- portal, métricas e IA.

## Épica 7: Acceso mínimo

### US-050 — Iniciar sesión

**Como** odontólogo  
**Quiero** ingresar con email y contraseña  
**Para** acceder a la información del consultorio

**Criterios de aceptación:**

- [ ] No existe registro público.
- [ ] Email y contraseña son obligatorios.
- [ ] La contraseña se valida contra un hash y nunca se devuelve ni registra.
- [ ] Un acceso inválido devuelve un mensaje genérico.
- [ ] El mecanismo de sesión/token y la creación de la primera cuenta se resuelven en el design técnico.

**Reglas relacionadas:** RN-AC-01 a RN-AC-05.

