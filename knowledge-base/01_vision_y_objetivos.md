# Visión y Objetivos

## Propósito del sistema

Proveer a un odontólogo independiente una agenda digital confiable para gestionar pacientes, prestaciones, sillones, disponibilidad y turnos sin solapamientos incompatibles con su capacidad real de atención.

El producto reemplaza planillas y controles manuales por reglas temporales explícitas y verificables. Debe ser simple para una sola persona, conservar la historia de cambios y explicar las excepciones, sin intentar resolver en el MVP toda la operación clínica o administrativa de una clínica grande.

## Problema y oportunidad

El Discovery detectó que las soluciones del mercado suelen ofrecer agendas junto con muchos módulos clínicos, financieros y comerciales. Sin embargo, la prevención de solapamientos entre odontólogo, sillón, duración e intervalo no suele explicarse públicamente con precisión.

La oportunidad es construir un núcleo pequeño pero sólido:

- cálculo consistente de duración e intervalo;
- ausencia de turnos simultáneos para un único odontólogo;
- disponibilidad recurrente y excepciones fechadas;
- anulaciones y reprogramaciones no destructivas;
- excepciones manuales justificadas y auditables.

## Objetivos por actor

| Actor | Objetivo principal | Objetivos secundarios |
|---|---|---|
| Odontólogo | Administrar su agenda sin solapamientos | Mantener pacientes y prestaciones, configurar disponibilidad y sillones, registrar excepciones, consultar historial |
| Paciente | Recibir una atención organizada | Tener sus datos mínimos correctamente registrados y conservar trazabilidad de sus turnos |
| Equipo del proyecto | Entregar un MVP verificable y reproducible | Mantener alcance controlado, tests deterministas, cambios independientes y documentación trazable |

## Alcance del MVP 1.0

- Gestión de pacientes con nombre y teléfono obligatorios; DNI y email opcionales.
- Detección de DNI duplicado y advertencia por coincidencia de nombre y teléfono.
- Gestión de prestaciones con duración predeterminada.
- Sobrescritura de duración al crear un turno.
- Intervalo global obligatorio, sobrescribible por prestación.
- Gestión de varios sillones.
- Disponibilidad semanal recurrente.
- Excepciones de disponibilidad por fecha: feriados, vacaciones o bloqueos.
- Agenda y turnos en estados PROGRAMADO, CONFIRMADO, ATENDIDO, CANCELADO y AUSENTE.
- Prevención de solapamientos del odontólogo y del sillón.
- Reprogramación y cancelación con motivo e historial.
- Excepción manual fuera de disponibilidad con motivo y auditoría.
- Pruebas automatizadas para duración, intervalo, disponibilidad y solapamientos.

## Fuera de alcance del MVP

- Recepcionista u otros usuarios operativos.
- Múltiples odontólogos o profesionales.
- Reserva pública o portal del paciente.
- Recordatorios reales por WhatsApp o email.
- Historia clínica, odontograma, periodontograma o imágenes.
- Caja, cobros, señas o Mercado Pago.
- Facturación ARCA.
- Obras sociales, prepagas y liquidaciones.
- Campañas, métricas avanzadas o funciones de inteligencia artificial.
- Aplicación móvil nativa y operación offline.

Estas capacidades pueden incorporarse después; no deben aparecer encubiertamente en changes del MVP.

## Referencias de mercado adoptadas

- **DentalCore:** referencia principal de confianza, claridad e intuición visual.
- **Dentry:** referencia de comunicación de planes, trazabilidad y adecuación a consultorio individual.
- **Denteo, ZYRA y DrApp:** referencias funcionales argentinas para agenda, modularidad e integraciones futuras.
- **Dentrix Ascend:** referencia internacional de dashboards y estados, sin copiar integraciones propias de Estados Unidos.

DentalSoft, AgendaDental y Open Dental permanecen en el análisis histórico, pero fueron descartados como referencias prácticas después de la verificación humana.

## Métricas de éxito del MVP

| Métrica | Criterio de éxito |
|---|---|
| Integridad temporal | Ningún caso de solapamiento permitido fuera de las reglas aprobadas |
| Cobertura de reglas críticas | Tests automatizados para casos felices, errores y bordes temporales |
| Trazabilidad | Toda cancelación, reprogramación o excepción conserva motivo y datos anteriores |
| Usabilidad operativa | El odontólogo puede registrar un paciente y crear un turno sin depender de datos clínicos o financieros |
| Reproducibilidad | El repositorio puede instalarse y ejecutar sus tests siguiendo un README |
| Privacidad académica | Cero datos reales de pacientes en código, fixtures, capturas o documentación |

## Restricciones de entrega

- Fecha prevista: 2026-11-26.
- Equipo autorizado: Pablo, Paula, Milagros y Gonzalo.
- Pablo conduce la fundación, el primer change transversal y el cierre de integración/pulido.
- Paula, Milagros y Gonzalo deben recibir trabajo equitativo, independiente y con ownership de archivos claro.
- El roadmap posterior debe separar contratos compartidos de changes paralelos.

