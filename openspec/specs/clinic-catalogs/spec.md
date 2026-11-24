# clinic-catalogs Specification

## Purpose

Define los catálogos de prestaciones y sillones que los turnos utilizan para calcular el tiempo ocupado y asignar un recurso físico, preservando las referencias de turnos históricos.

## Requirements

### Requirement: Alta y edición de prestaciones
El sistema SHALL registrar y editar prestaciones con nombre obligatorio, duración predeterminada entera entre 1 y 240 minutos e intervalo posterior opcional entero entre 0 y 30 minutos. Una prestación nueva queda activa.

#### Scenario: Prestación con intervalo propio
- **WHEN** el odontólogo crea `nombre: "Control ficticio"`, `duracionPredeterminadaMinutos: 30`, `intervaloPosteriorMinutos: 5`
- **THEN** el backend responde 201 con la prestación activa y esos valores

#### Scenario: Prestación sin intervalo propio
- **WHEN** el odontólogo crea una prestación omitiendo `intervaloPosteriorMinutos` o enviándolo como `null`
- **THEN** la prestación se guarda con `intervaloPosteriorMinutos: null`, que indica que se aplicará el intervalo global

#### Scenario: Límites de duración
- **WHEN** el odontólogo envía `duracionPredeterminadaMinutos` igual a 0, 241 o un valor no entero
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`; 1 y 240 se aceptan

#### Scenario: Límites de intervalo
- **WHEN** el odontólogo envía `intervaloPosteriorMinutos` igual a -1, 31 o un valor no entero
- **THEN** el backend responde 400 con código `VALIDATION_ERROR`; 0 y 30 se aceptan

#### Scenario: Prestación inexistente
- **WHEN** el odontólogo consulta o edita un id de prestación inexistente
- **THEN** el backend responde 404 con código `PROCEDURE_NOT_FOUND`

### Requirement: Alta y edición de sillones
El sistema SHALL registrar y editar sillones con nombre obligatorio y admitir varios sillones. Un sillón nuevo queda activo.

#### Scenario: Registrar varios sillones
- **WHEN** el odontólogo crea "Sillón 1" y "Sillón 2"
- **THEN** ambos quedan disponibles como sillones activos

#### Scenario: Sillón inexistente
- **WHEN** el odontólogo consulta o edita un id de sillón inexistente
- **THEN** el backend responde 404 con código `CHAIR_NOT_FOUND`

### Requirement: Nombres únicos por catálogo
El sistema SHALL rechazar una prestación o un sillón cuyo nombre, sin espacios sobrantes y sin distinguir mayúsculas, ya exista en el mismo catálogo, activo o inactivo.

#### Scenario: Prestación repetida
- **GIVEN** existe la prestación "Control ficticio"
- **WHEN** el odontólogo crea otra llamada "  control FICTICIO "
- **THEN** el backend responde 409 con código `PROCEDURE_NAME_CONFLICT`

#### Scenario: Sillón repetido inactivo
- **GIVEN** existe el sillón inactivo "Sillón 2"
- **WHEN** el odontólogo crea otro "Sillón 2"
- **THEN** el backend responde 409 con código `CHAIR_NAME_CONFLICT` y el odontólogo puede reactivar el existente

#### Scenario: Mismo nombre en catálogos distintos
- **WHEN** existe una prestación y un sillón con el mismo nombre
- **THEN** ambos registros son válidos

### Requirement: Listado paginado de catálogos
El sistema SHALL listar prestaciones y sillones paginados con la forma `{ items, page, pageSize, total }`, filtrar por nombre parcial, ordenar por nombre y devolver solo activos salvo que se pida `incluirInactivos=true`.

#### Scenario: Catálogo para seleccionar en un turno
- **GIVEN** existen sillones activos e inactivos
- **WHEN** se consulta `GET /api/sillones` sin filtros
- **THEN** la respuesta contiene únicamente sillones activos ordenados por nombre

#### Scenario: Catálogo vacío
- **WHEN** no existen prestaciones
- **THEN** `GET /api/prestaciones` responde 200 con `items: []` y `total: 0`

### Requirement: Baja lógica reversible de catálogos
El sistema SHALL desactivar y reactivar prestaciones y sillones sin borrarlos físicamente y SHALL NOT exponer una operación de borrado. Un registro inactivo conserva id, nombre y valores, y no se ofrece para turnos nuevos.

#### Scenario: Desactivar prestación usada históricamente
- **WHEN** el odontólogo desactiva una prestación
- **THEN** deja de listarse por defecto y sigue disponible por id con `activo: false`

#### Scenario: Reactivar sillón
- **GIVEN** un sillón inactivo
- **WHEN** el odontólogo cambia su estado a `activo: true`
- **THEN** vuelve a listarse por defecto

### Requirement: Edición de catálogo sin efecto retroactivo
El sistema SHALL tratar la duración y el intervalo de una prestación como valores predeterminados para turnos futuros; editarlos MUST NOT modificar datos almacenados fuera del catálogo.

#### Scenario: Cambio de duración
- **GIVEN** una prestación con duración 30
- **WHEN** el odontólogo la edita a 45
- **THEN** solo cambia el registro de la prestación; ningún otro registro persistido se actualiza como consecuencia

### Requirement: Referencias de catálogo para otros módulos
El sistema SHALL ofrecer a otros módulos del backend una consulta de prestación y de sillón por id que indique existencia, estado activo y, para prestaciones, duración e intervalo posterior, sin exponerles su almacenamiento.

#### Scenario: Prestación para calcular un turno
- **WHEN** otro módulo consulta una prestación activa por id
- **THEN** obtiene `duracionPredeterminadaMinutos`, `intervaloPosteriorMinutos` (posiblemente `null`) y `activo: true`

#### Scenario: Sillón inactivo
- **WHEN** otro módulo consulta un sillón inactivo por id
- **THEN** obtiene el sillón con `activo: false` para decidir el rechazo

### Requirement: Pantalla de catálogo
La interfaz SHALL ofrecer en `/prestaciones` dos secciones, Prestaciones y Sillones, para listar, crear, editar, desactivar y reactivar registros, mostrar estados de carga, vacío y error, e indicar "usa intervalo global" cuando una prestación no tiene intervalo propio.

#### Scenario: Error de rango desde el backend
- **WHEN** el backend rechaza una duración fuera de rango
- **THEN** el formulario conserva los valores y muestra el error junto al campo de duración

#### Scenario: Cambiar de sección
- **WHEN** el odontólogo selecciona la sección Sillones
- **THEN** se muestra el listado de sillones sin abandonar `/prestaciones`
