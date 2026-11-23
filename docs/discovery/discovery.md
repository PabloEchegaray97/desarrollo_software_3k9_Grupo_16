# Discovery estructurado - sistema de turnos odontológicos

**Fecha:** 2026-11-22  
**Estado:** aprobado; verificación personal de cinco fuentes completada  
**Fuente rectora:** `consigna_global.pdf`

## 1. Problema que resuelve

Un odontólogo independiente necesita organizar pacientes, prestaciones, disponibilidad, sillones y turnos sin depender de planillas ni permitir superposiciones incompatibles con su capacidad real de atención.

## 2. Usuarios y roles

- **Odontólogo:** único usuario autenticado del MVP. Administra catálogos, disponibilidad y agenda.
- **Paciente:** entidad administrada; no inicia sesión ni reserva directamente en el MVP.
- **Recepcionista:** fuera del MVP.

## 3. Casos de uso

1. Registrar y actualizar pacientes.
2. Configurar prestaciones, duración e intervalo.
3. Configurar sillones, disponibilidad semanal y excepciones.
4. Crear un turno validando disponibilidad, sillón y ausencia de solapamientos.
5. Reprogramar o cancelar conservando historial y motivo.
6. Confirmar, atender o marcar ausencia.
7. Consultar la agenda por fecha y sillón.

## 4. Competidores y soluciones existentes

Se investigaron quince soluciones. Tras la verificación personal se priorizan DentalCore, Dentry, Denteo, ZYRA y DrApp para demostración. DentalCore y Dentry son las referencias principales de experiencia, acompañadas por Dentrix Ascend como referencia internacional. DentalSoft, AgendaDental y Open Dental se descartan para este proyecto por falta de confianza o adecuación observada durante la revisión. El detalle está en `informe-discovery.md` y `sources/`.

## 5. Funcionalidades necesarias

- Pacientes: nombre y teléfono obligatorios; DNI y email opcionales.
- DNI único cuando se informa; advertencia por coincidencia de nombre y teléfono.
- Prestaciones con duración predeterminada y sobrescritura por turno.
- Intervalo global con sobrescritura por prestación.
- Varios sillones, sin simultaneidad porque existe un solo odontólogo.
- Disponibilidad semanal y excepciones por fecha.
- Turnos con estados PROGRAMADO, CONFIRMADO, ATENDIDO, CANCELADO y AUSENTE.
- Excepciones fuera de disponibilidad con motivo y auditoría.
- Historial no destructivo de cancelaciones y reprogramaciones.

## 6. Funcionalidades opcionales

1. Recordatorios y confirmaciones por WhatsApp y correo electrónico.
2. Reserva online.
3. Historia clínica y odontograma.
4. Caja y Mercado Pago.
5. Facturación ARCA.
6. Obras sociales y prepagas.
7. Portal del paciente, métricas e informes.

## 7. Reglas de negocio

- Un turno bloquea al odontólogo y al sillón durante su duración efectiva más el intervalo efectivo.
- La duración efectiva usa la sobrescritura del turno o, en su ausencia, la duración de la prestación.
- El intervalo efectivo usa la sobrescritura de la prestación o, en su ausencia, el intervalo global.
- No se permiten turnos simultáneos aunque usen sillones diferentes.
- Un turno fuera de disponibilidad requiere motivo y auditoría.
- Los turnos cancelados no se eliminan y las reprogramaciones conservan fecha y hora anteriores.
- Compartir teléfono no impide registrar pacientes; solo genera advertencia.
- Todos los datos de demostración y prueba deben ser ficticios.

## 8. Integraciones

El MVP no usa integraciones externas reales. Se deben mantener límites claros para incorporar después WhatsApp, email, Mercado Pago, ARCA y obras sociales.

## 9. Restricciones

- Entrega: 2026-11-26.
- Stack acordado: NestJS, React y MariaDB.
- Equipo autorizado: Pablo, Paula, Milagros y Gonzalo.
- Pablo conduce la fundación, el primer change y el change final de integración/pulido.
- Los tres integrantes restantes necesitan cambios equitativos, independientes y con conjuntos de archivos separados.
- Un repositorio, historial trazable, tests reproducibles y ausencia de secretos o datos reales.

## 10. Riesgos

- Alcance excesivo para cuatro días.
- Cálculo incorrecto de solapamientos e intervalos.
- Tests temporales frágiles o insuficientes.
- Conflictos entre ramas por contratos compartidos.
- Información comercial no verificable o cambiante.
- Convertir el pulido final en reparación de funcionalidades incompletas.

## 11. Preguntas abiertas

- Valor inicial y unidad del intervalo global.
- Límites permitidos para duraciones e intervalos.
- Baja lógica de pacientes, prestaciones y sillones.
- Zona horaria y formato de fecha/hora.
- Estados que bloquean disponibilidad.
- Alcance de la autenticación del odontólogo.
- Nivel de detalle de auditoría visible en la interfaz.
