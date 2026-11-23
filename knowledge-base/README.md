# Sistema de Turnos Odontológicos — Base de Conocimiento

Base de conocimiento del MVP para un odontólogo independiente, generada a partir de `consigna_global.pdf` y del Discovery verificado en `docs/discovery/`.

## Estado

- **Versión documental:** 1.0
- **Fecha:** 2026-11-22
- **Origen:** importación de fuentes existentes
- **Alcance:** definición del producto y arquitectura propuesta; todavía no existe implementación
- **Preguntas pendientes:** consultar [10_preguntas_abiertas.md](10_preguntas_abiertas.md) antes de especificar el primer change

## Índice de archivos

| Archivo | Contenido |
|---|---|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Problema, objetivos, alcance del MVP y métricas de éxito |
| [02_descripcion_general.md](02_descripcion_general.md) | Stack, arquitectura general, API e integraciones diferidas |
| [03_actores_y_roles.md](03_actores_y_roles.md) | Actores, permisos y límites de acceso del MVP |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | Dominios, entidades, relaciones, restricciones y datos iniciales |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | Reglas trazables de pacientes, agenda, disponibilidad y auditoría |
| [06_funcionalidades.md](06_funcionalidades.md) | Épicas, historias de usuario y criterios de aceptación |
| [07_flujos_principales.md](07_flujos_principales.md) | Flujos extremo a extremo y casos de error |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Patrones, estructura propuesta, seguridad, pruebas y configuración |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | Decisiones aprobadas, trade-offs y supuestos por validar |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | Preguntas priorizadas, inconsistencias resueltas y evidencia pendiente |

## Quick start para desarrolladores

1. Entender el propósito y el límite del MVP: [01](01_vision_y_objetivos.md).
2. Revisar actores y permisos: [03](03_actores_y_roles.md).
3. Entender entidades y relaciones: [04](04_modelo_de_datos.md).
4. Leer las reglas que funcionarán como contrato: [05](05_reglas_de_negocio.md).
5. Consultar historias y flujos: [06](06_funcionalidades.md) y [07](07_flujos_principales.md).
6. Revisar arquitectura y estrategia de pruebas: [08](08_arquitectura_propuesta.md).
7. Antes de crear un change, resolver o declarar las preguntas que lo afecten: [10](10_preguntas_abiertas.md).

## Resumen ejecutivo

El sistema organiza pacientes, prestaciones, sillones, disponibilidad y turnos de un único odontólogo. Su diferencial no es la cantidad de módulos, sino una agenda confiable: duración e intervalo configurables, ausencia de simultaneidad, excepciones justificadas e historial no destructivo.

El MVP es una aplicación web con backend NestJS, frontend React y base MariaDB. Reserva pública, historia clínica, pagos, ARCA, obras sociales y mensajería real quedan fuera del primer alcance, aunque se preservarán límites de integración para incorporarlos después.

## Fuentes rectoras

- `consigna_global.pdf`
- `docs/discovery/discovery.md`
- `docs/discovery/informe-discovery.md`
- `docs/discovery/matriz-evaluacion.csv`
- `docs/discovery/sources/`

Ante contradicciones, prevalecen las decisiones explícitamente verificadas en el Discovery. Ningún ejemplo, prueba o captura puede contener datos reales de pacientes.

