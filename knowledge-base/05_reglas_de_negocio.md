# Reglas de Negocio

Cada regla tiene un código estable para vincularla desde historias, specs y tests.

## Dominio: pacientes (RN-PA)

- **RN-PA-01:** nombre y teléfono son obligatorios para registrar un paciente.
- **RN-PA-02:** DNI y email son opcionales.
- **RN-PA-03:** cuando se informa un DNI, no puede existir otro paciente con el mismo valor normalizado.
- **RN-PA-04:** una coincidencia de nombre y teléfono genera una advertencia de posible duplicado, pero no bloquea automáticamente el alta.
- **RN-PA-05:** compartir teléfono entre pacientes está permitido.
- **RN-PA-06:** un email informado debe tener formato válido.
- **RN-PA-07:** ningún fixture, captura, seed o ejemplo puede utilizar datos reales de pacientes.

## Dominio: prestaciones e intervalos (RN-PR)

- **RN-PR-01:** toda prestación debe tener una duración predeterminada entre 1 y 240 minutos.
- **RN-PR-02:** la duración puede sobrescribirse al crear un turno.
- **RN-PR-03:** debe existir un intervalo global obligatorio entre turnos, inicialmente de 10 minutos y siempre entre 0 y 30 minutos.
- **RN-PR-04:** una prestación puede sobrescribir el intervalo global y un turno puede sobrescribir ambos valores al crearse.
- **RN-PR-05:** la duración efectiva de un turno es su sobrescritura o, si no existe, la duración predeterminada de la prestación.
- **RN-PR-06:** el intervalo efectivo se obtiene por precedencia: sobrescritura del turno, intervalo de la prestación o intervalo global.
- **RN-PR-07:** duración e intervalo efectivos deben persistirse en el turno para preservar su comportamiento histórico.
- **RN-PR-08:** toda sobrescritura debe respetar duración máxima de 240 minutos e intervalo máximo de 30 minutos.

## Dominio: sillones (RN-SI)

- **RN-SI-01:** el sistema admite varios sillones.
- **RN-SI-02:** todo turno debe estar asignado a un sillón.
- **RN-SI-03:** un sillón no puede participar en dos turnos bloqueantes solapados.
- **RN-SI-04:** usar sillones distintos no habilita simultaneidad porque existe un único odontólogo.

## Dominio: disponibilidad (RN-DI)

- **RN-DI-01:** la disponibilidad ordinaria se define mediante horarios semanales recurrentes.
- **RN-DI-02:** feriados, vacaciones y bloqueos se registran como excepciones por fecha.
- **RN-DI-03:** un turno debe quedar contenido en un tramo disponible y no atravesar un bloqueo, considerando su duración de atención.
- **RN-DI-04:** se puede crear un turno fuera de disponibilidad únicamente mediante una excepción manual explícita.
- **RN-DI-05:** la excepción manual requiere un motivo no vacío y debe quedar registrada en el historial.
- **RN-DI-06:** una excepción manual a disponibilidad no permite ignorar un solapamiento; solo exceptúa la regla de horario disponible.

## Dominio: turnos y solapamientos (RN-TU)

- **RN-TU-01:** el período bloqueado de un turno comienza en `inicio` y termina en `inicio + duración efectiva + intervalo efectivo`.
- **RN-TU-02:** se modelan intervalos semiabiertos `[inicio, finBloqueo)`: un turno puede comenzar exactamente cuando finaliza el bloqueo del anterior.
- **RN-TU-03:** no puede existir solapamiento entre turnos bloqueantes del odontólogo, aunque tengan sillones distintos.
- **RN-TU-04:** no puede existir solapamiento entre turnos bloqueantes del mismo sillón.
- **RN-TU-05:** la comprobación de disponibilidad y el guardado deben ejecutarse como una operación consistente para evitar altas concurrentes incompatibles.
- **RN-TU-06:** los estados válidos son PROGRAMADO, CONFIRMADO, ATENDIDO, CANCELADO y AUSENTE.
- **RN-TU-07:** PROGRAMADO, CONFIRMADO, ATENDIDO y AUSENTE bloquean su intervalo histórico; CANCELADO no bloquea y libera el horario.
- **RN-TU-08:** un turno cancelado no se elimina físicamente.
- **RN-TU-09:** cancelar requiere motivo y registra el estado anterior.
- **RN-TU-10:** reprogramar conserva al menos fecha, hora y sillón anteriores, además del motivo cuando corresponda.
- **RN-TU-11:** una reprogramación debe validar nuevamente disponibilidad, sillón y solapamientos antes de aplicarse.
- **RN-TU-12:** cambiar duración, prestación o sillón debe volver a validar el intervalo temporal completo.
- **RN-TU-13:** PROGRAMADO puede pasar a CONFIRMADO, ATENDIDO, AUSENTE o CANCELADO.
- **RN-TU-14:** CONFIRMADO puede pasar a ATENDIDO, AUSENTE o CANCELADO.
- **RN-TU-15:** ATENDIDO, AUSENTE y CANCELADO son estados terminales en el MVP.
- **RN-TU-16:** ATENDIDO y AUSENTE solo pueden registrarse cuando comenzó el horario del turno.
- **RN-TU-17:** solo PROGRAMADO y CONFIRMADO pueden reprogramarse.
- **RN-TU-18:** reprogramar un turno CONFIRMADO lo devuelve a PROGRAMADO porque el nuevo horario aún no fue confirmado.
- **RN-TU-19:** corregir un estado terminal requiere una operación administrativa futura y auditada; no forma parte del MVP.

### Matriz de transiciones

| Estado actual | Destinos permitidos | ¿Bloquea horario? |
|---|---|---:|
| PROGRAMADO | CONFIRMADO, ATENDIDO, AUSENTE, CANCELADO | Sí |
| CONFIRMADO | ATENDIDO, AUSENTE, CANCELADO | Sí |
| ATENDIDO | Ninguno | Sí |
| AUSENTE | Ninguno | Sí |
| CANCELADO | Ninguno | No |

## Dominio: historial y auditoría (RN-AU)

- **RN-AU-01:** creación, reprogramación, cancelación, cambio de estado y excepción fuera de disponibilidad generan eventos de historial.
- **RN-AU-02:** un evento histórico no se edita ni se elimina desde la interfaz ordinaria.
- **RN-AU-03:** todo evento registra momento, tipo y valores relevantes anteriores/nuevos.
- **RN-AU-04:** la visibilidad exacta del historial en la interfaz está pendiente, pero el backend debe conservar la información necesaria.

## Dominio: integraciones (RN-IN)

- **RN-IN-01:** el MVP no envía mensajes reales ni procesa pagos o facturación.
- **RN-IN-02:** los límites para mensajería futura no deben acoplar las reglas de Turnos a un proveedor específico.
- **RN-IN-03:** WhatsApp/email es la primera prioridad posterior al MVP.
- **RN-IN-04:** reserva pública, historia clínica, Mercado Pago, ARCA y obras sociales requieren changes separados.

## Dominio: autenticación (RN-AC)

- **RN-AC-01:** el odontólogo accede mediante email y contraseña.
- **RN-AC-02:** no existe registro público de usuarios en el MVP.
- **RN-AC-03:** el email de acceso es obligatorio y único.
- **RN-AC-04:** la contraseña nunca se almacena en texto plano; solo se persiste un hash producido por un algoritmo adecuado para contraseñas.
- **RN-AC-05:** mensajes de error de acceso no deben revelar si un email está registrado.

## Dominio: tiempo (RN-TI)

- **RN-TI-01:** la zona horaria operativa es `America/Argentina/Buenos_Aires`, equivalente actualmente a UTC−03:00.
- **RN-TI-02:** los instantes se almacenan normalizados en UTC y se presentan en la zona horaria operativa.
- **RN-TI-03:** fechas recurrentes y excepciones se interpretan en el calendario local del consultorio.

## Excepciones globales

- Ninguna excepción permite ocultar o borrar el historial.
- Ninguna regla puede requerir datos reales para pruebas o demostraciones.
- Las operaciones que afecten la agenda deben usar la zona horaria IANA acordada y no un offset fijo aislado.

