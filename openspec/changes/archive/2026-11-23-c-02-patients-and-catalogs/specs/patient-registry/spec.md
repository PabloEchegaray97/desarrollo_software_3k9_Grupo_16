# Spec Delta

## Purpose

Mantiene el registro administrativo mínimo de pacientes que la agenda necesita para asignar turnos, sin datos clínicos, con identificación confiable y sin perder referencias históricas.

## ADDED Requirements

### Requirement: Alta de paciente con datos mínimos
El sistema SHALL registrar un paciente con nombre y teléfono obligatorios y DNI y email opcionales. Nombre y teléfono se almacenan sin espacios sobrantes; un paciente nuevo queda activo.

#### Scenario: Alta con datos obligatorios solamente
- **GIVEN** no existe otro paciente con el mismo nombre y teléfono
- **WHEN** el odontólogo envía `nombre: "Paciente Ficticio Uno"` y `telefono: "11 5555-0001"` sin DNI ni email
- **THEN** el backend responde 201 con el paciente creado, `dni: null`, `email: null` y `activo: true`

#### Scenario: Nombre con espacios sobrantes
- **WHEN** el odontólogo envía `nombre: "  Paciente   Ficticio  Dos "`
- **THEN** el paciente se guarda con `nombre: "Paciente Ficticio Dos"`

#### Scenario: Falta un dato obligatorio
- **WHEN** el odontólogo envía un alta sin nombre o sin teléfono, o con alguno vacío tras recortar espacios
- **THEN** el backend responde 400 con el contrato común de error y código `VALIDATION_ERROR`, y no crea ningún paciente

### Requirement: Validación de formato de datos de contacto
El sistema SHALL rechazar un email informado con formato inválido y un teléfono que no contenga entre 6 y 20 dígitos; el teléfono solo admite dígitos, espacios, `+`, `-` y paréntesis.

#### Scenario: Email inválido
- **WHEN** el odontólogo informa `email: "no-es-un-email"`
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

#### Scenario: Email vacío equivale a omitido
- **WHEN** el odontólogo envía `email: ""`
- **THEN** el paciente se guarda con `email: null`

#### Scenario: Teléfono con caracteres no permitidos
- **WHEN** el odontólogo informa `telefono: "llamar al consultorio"`
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

### Requirement: DNI normalizado y único cuando está informado
El sistema SHALL normalizar el DNI eliminando puntos, espacios y guiones, aceptar solamente 7 u 8 dígitos y rechazar un DNI ya asignado a otro paciente, activo o inactivo. Varios pacientes pueden no tener DNI.

#### Scenario: DNI repetido con otro formato
- **GIVEN** existe un paciente con DNI `30000001`
- **WHEN** el odontólogo da de alta otro paciente con `dni: "30.000.001"`
- **THEN** el backend responde 409 con código `PATIENT_DNI_CONFLICT` y no crea el paciente

#### Scenario: Varios pacientes sin DNI
- **GIVEN** existe un paciente sin DNI
- **WHEN** el odontólogo registra otro paciente sin DNI
- **THEN** el alta se completa

#### Scenario: Actualizar DNI vuelve a comprobar unicidad
- **GIVEN** existen el paciente A con DNI `30000001` y el paciente B sin DNI
- **WHEN** el odontólogo edita B con `dni: "30000001"`
- **THEN** el backend responde 409 con código `PATIENT_DNI_CONFLICT` y B conserva sus datos

#### Scenario: Altas concurrentes con el mismo DNI
- **WHEN** dos solicitudes simultáneas intentan registrar el mismo DNI
- **THEN** exactamente una se completa y la otra responde 409 con código `PATIENT_DNI_CONFLICT`

#### Scenario: DNI con formato inválido
- **WHEN** el odontólogo informa `dni: "12A45"`
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`

### Requirement: Advertencia de posible duplicado sin bloqueo
El sistema SHALL advertir, sin impedir el registro, cuando un alta o edición coincide en nombre (sin distinguir mayúsculas) y dígitos del teléfono con otro paciente. La advertencia se confirma reenviando la solicitud con `confirmarPosibleDuplicado: true`.

#### Scenario: Coincidencia sin confirmar
- **GIVEN** existe "Paciente Ficticio Uno" con teléfono `11 5555-0001`
- **WHEN** el odontólogo registra `nombre: "paciente ficticio uno"` y `telefono: "1155550001"` sin confirmación
- **THEN** el backend responde 409 con código `PATIENT_POSSIBLE_DUPLICATE`, `details.candidatos` contiene únicamente `id`, `nombre` y `activo` de cada coincidencia, y no crea el paciente

#### Scenario: Coincidencia confirmada
- **GIVEN** la misma coincidencia anterior
- **WHEN** el odontólogo reenvía el alta con `confirmarPosibleDuplicado: true`
- **THEN** el backend responde 201 y crea el paciente

#### Scenario: Teléfono compartido con nombre distinto
- **GIVEN** existe un paciente con teléfono `11 5555-0001`
- **WHEN** el odontólogo registra otro paciente con distinto nombre y el mismo teléfono
- **THEN** el alta se completa sin advertencia

#### Scenario: Edición que no cambia nombre ni teléfono
- **WHEN** el odontólogo edita solamente el email de un paciente que ya coincidía con otro
- **THEN** la edición se completa sin requerir confirmación

### Requirement: Búsqueda paginada de pacientes
El sistema SHALL listar pacientes paginados y filtrar por texto contra nombre, teléfono o DNI informado. Por defecto devuelve solo activos; un filtro explícito incluye inactivos. La respuesta tiene la forma `{ items, page, pageSize, total }`.

#### Scenario: Buscar por nombre parcial
- **GIVEN** existen "Paciente Ficticio Uno" y "Otra Persona Ficticia"
- **WHEN** el odontólogo consulta `GET /api/pacientes?q=ficticio uno`
- **THEN** la respuesta incluye solo "Paciente Ficticio Uno"

#### Scenario: Buscar por teléfono o DNI con formato libre
- **WHEN** el odontólogo consulta con `q` igual a `5555-0001` o a `30.000.001`
- **THEN** la respuesta incluye el paciente cuyo teléfono o DNI contiene esos dígitos

#### Scenario: Inactivos ocultos por defecto
- **GIVEN** existe un paciente inactivo
- **WHEN** el odontólogo lista sin `incluirInactivos=true`
- **THEN** el paciente inactivo no aparece; con `incluirInactivos=true` aparece con `activo: false`

#### Scenario: Límites de paginación
- **WHEN** el odontólogo solicita `pageSize=500` o `page=0`
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`; los valores por defecto son `page=1` y `pageSize=20`, con máximo 100

### Requirement: Consulta y edición de paciente por id
El sistema SHALL devolver y editar un paciente por id, aplicando en la edición las mismas validaciones y controles del alta, y responder 404 con código `PATIENT_NOT_FOUND` cuando el id no existe.

#### Scenario: Paciente inexistente
- **WHEN** el odontólogo consulta o edita un id inexistente
- **THEN** el backend responde 404 con código `PATIENT_NOT_FOUND`

#### Scenario: Paciente inactivo consultado por id
- **GIVEN** un paciente inactivo
- **WHEN** se consulta por su id
- **THEN** el backend lo devuelve con `activo: false`

### Requirement: Baja lógica reversible de pacientes
El sistema SHALL desactivar y reactivar pacientes sin borrarlos físicamente y SHALL NOT exponer una operación de borrado. Un paciente inactivo conserva datos, DNI e id, y no se ofrece para turnos nuevos.

#### Scenario: Desactivar paciente
- **WHEN** el odontólogo cambia el estado de un paciente a `activo: false`
- **THEN** el paciente deja de aparecer en listados por defecto y sigue disponible por id

#### Scenario: Reactivar paciente
- **GIVEN** un paciente inactivo
- **WHEN** el odontólogo cambia su estado a `activo: true`
- **THEN** vuelve a aparecer en listados por defecto con los mismos datos

#### Scenario: Borrado no disponible
- **WHEN** se envía `DELETE /api/pacientes/{id}`
- **THEN** el backend no elimina el registro y responde 404 por ruta inexistente

### Requirement: Referencia de paciente para otros módulos
El sistema SHALL ofrecer a otros módulos del backend una consulta de paciente por id que indique si existe y si está activo, sin exponerles su almacenamiento.

#### Scenario: Validar referencia para un turno nuevo
- **GIVEN** un paciente inactivo
- **WHEN** otro módulo consulta la referencia por su id
- **THEN** obtiene el paciente con `activo: false` para decidir el rechazo

### Requirement: Pantalla de gestión de pacientes
La interfaz SHALL permitir buscar, crear, editar, desactivar y reactivar pacientes en `/pacientes`, mostrando estados de carga, vacío y error, los errores de validación junto a cada campo y la advertencia de posible duplicado con la opción de continuar o cancelar.

#### Scenario: Confirmar posible duplicado desde la interfaz
- **GIVEN** el backend responde `PATIENT_POSSIBLE_DUPLICATE`
- **WHEN** el odontólogo elige continuar en la advertencia
- **THEN** la interfaz reenvía el mismo formulario con `confirmarPosibleDuplicado: true` y muestra el paciente creado

#### Scenario: DNI repetido en el formulario
- **WHEN** el backend responde `PATIENT_DNI_CONFLICT`
- **THEN** el formulario conserva los datos cargados y muestra el error junto al campo DNI

### Requirement: Datos ficticios en pruebas y ejemplos
Las pruebas, fixtures y ejemplos del registro de pacientes MUST usar exclusivamente nombres, teléfonos, DNI y emails ficticios, y los logs MUST NOT incluir datos personales de pacientes.

#### Scenario: Revisión de fixtures
- **WHEN** se revisan los fixtures del change
- **THEN** todos los nombres son evidentemente ficticios, los teléfonos usan el rango `5555`, los DNI son valores de prueba y los emails usan el dominio `example.test`
