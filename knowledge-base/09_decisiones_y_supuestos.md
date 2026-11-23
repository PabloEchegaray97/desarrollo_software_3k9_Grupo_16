# Decisiones y Supuestos

## Decisiones documentadas

### DD-01 — Segmento objetivo

**Decisión:** el producto está dirigido a un odontólogo independiente.  
**Contexto:** el plazo y el riesgo de alcance exigen evitar una plataforma para clínicas completas.  
**Alternativas consideradas:** múltiples profesionales, clínica multisede, sistema multiespecialidad.  
**Justificación:** reduce roles y simultaneidad, y permite concentrarse en reglas verificables.  
**Trade-offs aceptados:** no hay recepcionista, profesionales adicionales ni sucursales.

### DD-02 — Alcance funcional del MVP

**Decisión:** incluir pacientes, prestaciones, sillones, disponibilidad y turnos sin solapamientos.  
**Contexto:** son las capacidades mínimas que demuestran el problema central.  
**Alternativas consideradas:** agregar historia clínica, pagos, ARCA, obras sociales o reserva pública.  
**Justificación:** esas capacidades amplían mucho el dominio y no son necesarias para validar la agenda.  
**Trade-offs aceptados:** el MVP no reemplaza un software odontológico integral.

### DD-03 — Un único usuario operativo

**Decisión:** solo usa el sistema el odontólogo.  
**Contexto:** inicialmente se consideró odontólogo/recepcionista, pero se eligió el MVP menor.  
**Justificación:** elimina RBAC complejo y coordinación entre usuarios.  
**Trade-offs aceptados:** la recepción debe incorporarse en una etapa posterior.

### DD-04 — Varios sillones sin simultaneidad

**Decisión:** modelar varios sillones, pero prohibir turnos simultáneos porque existe un solo odontólogo.  
**Contexto:** los sillones son recursos físicos relevantes, aunque no agregan capacidad profesional.  
**Trade-offs aceptados:** agregar otro odontólogo exigirá rediseñar la regla global de conflictos.

### DD-05 — Duración e intervalo efectivos

**Decisión:** la prestación define duración predeterminada; el turno puede sobrescribirla. El intervalo global comienza en 10 minutos y puede sobrescribirse por prestación o por turno. La duración máxima es 240 minutos y el intervalo máximo 30 minutos.  
**Justificación:** refleja la operación real sin obligar a crear prestaciones duplicadas.  
**Trade-offs aceptados:** se debe persistir el valor efectivo para conservar historia.

### DD-06 — Disponibilidad con excepciones

**Decisión:** usar horarios semanales recurrentes y excepciones por fecha. Permitir override manual fuera de disponibilidad con motivo.  
**Justificación:** cubre rutina, vacaciones, feriados y decisiones extraordinarias.  
**Trade-offs aceptados:** el modelo y la interfaz deben distinguir una excepción justificada de un error.

### DD-07 — Historial no destructivo

**Decisión:** cancelar conserva el turno y su motivo; reprogramar conserva valores anteriores.  
**Justificación:** proporciona trazabilidad y evita que la agenda oculte cambios.  
**Trade-offs aceptados:** mayor complejidad de datos y consultas.

### DD-08 — Integraciones diferidas

**Decisión:** no conectar proveedores reales en el MVP; preparar límites para mensajería, pagos y fiscalidad.  
**Justificación:** reduce riesgo y mantiene el dominio desacoplado.  
**Trade-offs aceptados:** no habrá recordatorios reales en la primera entrega.

### DD-09 — Stack tecnológico

**Decisión:** NestJS en backend, React en frontend y MariaDB como base de datos real.  
**Contexto:** elección explícita del equipo.  
**Trade-offs aceptados:** requiere infraestructura de base y coordinación de contratos TypeScript/SQL.

### DD-10 — Referencias competitivas

**Decisión:** priorizar DentalCore y Dentry como referencias, acompañadas por Denteo, ZYRA, DrApp y aspectos puntuales de Dentrix Ascend. Descartar DentalSoft, AgendaDental y Open Dental como referencias prácticas.  
**Justificación:** resultado de la verificación personal, no solo de la matriz cuantitativa.  
**Trade-offs aceptados:** una solución con buen puntaje histórico puede no ser adecuada como guía de experiencia.

### DD-11 — Organización del equipo

**Decisión:** Pablo conduce fundación, primer change transversal y cierre; Paula, Milagros y Gonzalo reciben changes independientes y equitativos.  
**Justificación:** participación demostrable con menor riesgo de conflictos.  
**Trade-offs aceptados:** los contratos compartidos deben estabilizarse antes del paralelismo.

### DD-12 — Zona horaria operativa

**Decisión:** usar `America/Argentina/Buenos_Aires` como zona horaria operativa y almacenar instantes normalizados en UTC.  
**Contexto:** el consultorio opera en Argentina, actualmente UTC−03:00.  
**Justificación:** una zona IANA expresa reglas temporales mejor que guardar solamente el offset `-03:00`.  
**Trade-offs aceptados:** frontend, backend y tests deben convertir fechas de forma explícita.

### DD-13 — Autenticación mínima

**Decisión:** el único odontólogo inicia sesión con email y contraseña; no existe registro público.  
**Contexto:** se requiere proteger datos personales sin introducir RBAC complejo.  
**Alternativas consideradas:** sistema sin login, acceso por nombre de usuario o proveedores externos.  
**Justificación:** email/contraseña es suficiente para el MVP y no depende de terceros.  
**Trade-offs aceptados:** todavía debe elegirse el mecanismo de sesión/token y el aprovisionamiento inicial.

### DD-14 — Estados bloqueantes y transiciones

**Decisión:** todos los estados salvo CANCELADO bloquean su intervalo histórico. PROGRAMADO puede avanzar a CONFIRMADO, ATENDIDO, AUSENTE o CANCELADO; CONFIRMADO puede avanzar a ATENDIDO, AUSENTE o CANCELADO. ATENDIDO, AUSENTE y CANCELADO son terminales.  
**Contexto:** el motor de conflictos necesita saber qué registros ocupan agenda y qué cambios son válidos.  
**Justificación:** el modelo es simple, permite atender sin confirmación previa y conserva que una ausencia consumió el horario.  
**Trade-offs aceptados:** corregir un estado terminal queda fuera del MVP; reprogramar un confirmado lo devuelve a PROGRAMADO.

## Supuestos inferidos

### SU-01 — Aplicación web de escritorio primero

**Supuesto:** el uso principal será desde navegador en una computadora del consultorio, aunque debe ser responsive.  
**Origen:** stack React/NestJS y ausencia de requerimiento móvil nativo.  
**Riesgo si es falso:** prioridades de navegación y diseño podrían cambiar.  
**Cómo validar:** definir política visual y tamaños objetivo antes del frontend.

### SU-02 — Intervalo aplicado después del turno

**Supuesto:** el intervalo efectivo extiende el bloqueo después de finalizar la atención, no antes.  
**Origen:** regla acordada “duración efectiva más intervalo efectivo”.  
**Riesgo si es falso:** cambia el algoritmo de disponibilidad.  
**Cómo validar:** confirmar el sentido posterior del intervalo en el spec del change de turnos.

### SU-03 — MariaDB es obligatoria también en pruebas de integración

**Supuesto:** las pruebas que dependan de restricciones SQL usarán MariaDB y no una base sustituta.  
**Origen:** stack obligatorio y necesidad de reproducir concurrencia/constraints.  
**Riesgo si es falso:** divergencias entre tests y ejecución real.  
**Cómo validar:** definir entorno de pruebas en el primer change técnico.

### SU-04 — El equipo puede usar cuatro integrantes

**Supuesto validado por el usuario:** la conformación Pablo, Paula, Milagros y Gonzalo está autorizada pese al texto general de la consigna.  
**Origen:** confirmación explícita durante Discovery.  
**Riesgo residual:** la autorización debe poder explicarse si el docente consulta la diferencia.  
**Cómo validar:** conservar la confirmación organizativa fuera de datos sensibles y reflejar aportes individuales en commits/reflexión.

### SU-05 — La KB no decide librerías técnicas secundarias

**Supuesto:** ORM, migraciones, testing, estilos y mecanismo de sesión/token se elegirán en la planificación o design del change base.  
**Origen:** las fuentes solo fijan NestJS, React y MariaDB.  
**Riesgo si es falso:** el roadmap podría depender de herramientas no acordadas.  
**Cómo validar:** resolver decisiones técnicas antes de generar tareas que las usen.

## Criterio de precedencia documental

1. Decisiones explícitas verificadas en `docs/discovery/discovery.md`.
2. Informe de Discovery corregido y su verificación humana.
3. Esta Knowledge Base.
4. Specs aprobados de OpenSpec para cada change.

Si un spec futuro necesita cambiar una decisión de producto, primero debe actualizarse la documentación correspondiente; Apply no puede improvisar el cambio.

