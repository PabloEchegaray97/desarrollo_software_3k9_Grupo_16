# Preguntas Abiertas

Este archivo distingue decisiones que bloquean changes próximos de información de mercado que simplemente no fue evidenciada. No completar una respuesta por deducción.

## Inconsistencias detectadas y resueltas

### IN-01 — Cantidad de integrantes

**La consigna general dice:** grupos de hasta tres integrantes.  
**El proyecto confirmó:** Pablo, Paula, Milagros y Gonzalo están autorizados.  
**Impacto:** participación, ramas y defensa.  
**Resolución:** se trabaja como equipo de cuatro y se exige aporte demostrable de cada integrante.

### IN-02 — Precio público de DentalSoft

**La investigación inicial encontró:** una referencia a un plan Pro desde ARS 60.000.  
**La verificación personal encontró:** no había planes visibles durante la navegación.  
**Impacto:** confiabilidad de la comparación, no del MVP.  
**Resolución:** se corrigió el informe y DentalSoft se descartó como referencia práctica; la matriz queda como registro histórico de la investigación.

### IN-03 — Operación por odontólogo/recepcionista

**Una decisión preliminar consideró:** carga por recepcionista u odontólogo.  
**La decisión final establece:** solo el odontólogo utiliza el MVP.  
**Impacto:** actores, permisos y autenticación.  
**Resolución:** recepcionista fuera del alcance.

## Preguntas abiertas priorizadas

| ID | Prioridad | Pregunta | Bloquea | Decisor |
|---|---|---|---|---|
| P1-01 | Media | ¿Pacientes, prestaciones y sillones usan baja lógica? ¿Qué impide desactivarlos? | CRUD e integridad histórica | Equipo técnico |
| P1-02 | Media | ¿Qué eventos y campos del historial serán visibles en la interfaz? | Pantalla de detalle y privacidad | Product Owner |
| P1-03 | Media | ¿Las excepciones de disponibilidad solo bloquean o también pueden habilitar horarios extraordinarios? | Modelo de disponibilidad | Product Owner |
| P1-04 | Media | ¿Se exige motivo para toda reprogramación o solo para cancelación/override? | Historial de reprogramación | Product Owner |
| P1-05 | Media | ¿Qué ORM, migrador y estrategia de concurrencia se usarán con MariaDB? | Fundación técnica y persistencia | Equipo técnico |
| P1-06 | Media | ¿Cómo se crea la primera cuenta del odontólogo y qué mecanismo de sesión/token se usa? | Bootstrap y seguridad de acceso | Equipo técnico |
| P2-01 | Baja | ¿Nombre definitivo, logo y tono visual del producto? | Diseño visual y presentación | Equipo |
| P2-02 | Baja | ¿Qué rango máximo puede consultar la agenda en una solicitud? | Rendimiento y UX | Equipo técnico |

## Decisiones P0 resueltas el 2026-11-22

- **P0-01:** intervalo global inicial de 10 minutos, sobrescribible por prestación y por turno.
- **P0-02:** duración máxima de 240 minutos e intervalo máximo de 30 minutos; duración positiva e intervalo no negativo.
- **P0-04:** zona IANA `America/Argentina/Buenos_Aires`, actualmente UTC−03:00; instantes persistidos en UTC.
- **P0-05:** acceso mínimo mediante email y contraseña, sin registro público. Bootstrap y sesión/token pasan a P1-06.
- **P0-03:** PROGRAMADO, CONFIRMADO, ATENDIDO y AUSENTE bloquean; CANCELADO libera. Se aprobó la matriz de transiciones y los estados terminales documentados en `05_reglas_de_negocio.md` y `07_flujos_principales.md`.

## Evidencia de mercado no confirmada que no bloquea el MVP

- No se verificó mediante demo cómo los competidores previenen solapamientos por odontólogo y sillón.
- ARCA no fue evidenciado en la página revisada de DentalSoft.
- Integraciones argentinas no fueron evidenciadas para varias soluciones internacionales.
- Parte de la información de MISE Turnos y ZYRA provino de páginas oficiales indexadas porque la apertura automatizada no devolvió contenido legible.
- La página de precios de Simples Dental no estuvo accesible durante la investigación.

Estos puntos deben conservar la etiqueta **No evidenciado** en el informe, pero no requieren copiar funcionalidad al MVP.

## Recomendación de resolución antes del primer change funcional

No quedan preguntas P0 abiertas. Las preguntas P1 que afecten un change deben resolverse en su proposal o design antes de Apply.

