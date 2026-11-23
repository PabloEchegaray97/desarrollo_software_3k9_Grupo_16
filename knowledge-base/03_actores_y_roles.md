# Actores y Roles

## Actores del sistema

| Actor | Descripción | Cómo interactúa |
|---|---|---|
| Odontólogo | Único usuario operativo y único profesional del MVP | Inicia sesión con email y contraseña; administra catálogos, disponibilidad y turnos |
| Paciente | Persona cuyos datos mínimos y turnos son administrados | No inicia sesión, no reserva y no modifica información directamente |
| Sistema | Backend que aplica reglas y conserva trazabilidad | Valida disponibilidad, duración, intervalo, solapamientos, estados y motivos |
| Equipo de desarrollo | Pablo, Paula, Milagros y Gonzalo | Mantiene documentación, código, tests y trazabilidad del repositorio |

## Roles del MVP

Solo existe un rol funcional previsto: `ODONTOLOGO`. La autenticación mínima usa email y contraseña, sin registro público. El modo de provisionar la primera cuenta sigue abierto; el rol no justifica crear soporte para recepcionistas o múltiples profesionales.

## RBAC — matriz de permisos

| Rol | Recurso | Crear | Leer | Actualizar | Eliminar / cancelar |
|---|---|---:|---:|---:|---:|
| ODONTOLOGO | Pacientes | Sí | Sí | Sí | Baja lógica pendiente de decisión |
| ODONTOLOGO | Prestaciones | Sí | Sí | Sí | Baja lógica pendiente de decisión |
| ODONTOLOGO | Sillones | Sí | Sí | Sí | Baja lógica pendiente de decisión |
| ODONTOLOGO | Disponibilidad | Sí | Sí | Sí | Sí, con restricciones a definir |
| ODONTOLOGO | Turnos | Sí | Sí | Sí | No elimina; cancela con motivo |
| ODONTOLOGO | Historial | No | Sí | No | No |
| Paciente | Todos | No | No | No | No |

## Capacidades del odontólogo

- Gestionar pacientes.
- Gestionar prestaciones y sus duraciones/intervalos.
- Gestionar sillones.
- Definir disponibilidad semanal y excepciones.
- Consultar agenda por fecha y sillón.
- Crear turnos dentro de disponibilidad.
- Autorizar manualmente turnos fuera de disponibilidad indicando motivo.
- Confirmar, atender, cancelar, marcar ausencia o reprogramar turnos según transiciones válidas.
- Consultar el historial de un turno.

## Rutas públicas

No se definieron rutas funcionales públicas. La reserva pública y el portal del paciente están fuera del MVP.

Pueden existir endpoints técnicos como healthchecks, pero deben exponer solo estado operativo y nunca datos personales o detalles sensibles de infraestructura.

## Evolución posterior

Los siguientes actores requieren una decisión y un change futuro; no forman parte del modelo actual:

- recepcionista;
- segundo odontólogo o especialista;
- administrador de clínica;
- paciente autenticado;
- servicio externo de mensajería o pagos.

Agregar cualquiera de ellos obliga a revisar permisos, simultaneidad, agenda y propiedad de los datos.

