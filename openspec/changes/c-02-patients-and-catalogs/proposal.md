# Proposal

## Why

La agenda necesita pacientes, prestaciones y sillones confiables antes de que C-05 pueda crear turnos: cada turno referencia las tres entidades y copia la duración/intervalo de la prestación. C-01 dejó los módulos `patients` y `catalogs` vacíos; C-02 los completa ahora para que C-05 parta de catálogos estables y de una política de baja que preserve la integridad histórica (P1-01).

## What Changes

- Resolver **P1-01**: pacientes, prestaciones y sillones usan **baja lógica mediante `activo`**, con desactivación y reactivación explícitas y sin borrado físico. Los registros inactivos siguen resolviéndose por id para conservar referencias históricas, se excluyen de los listados por defecto y quedan marcados para que C-05 no los utilice en turnos nuevos.
- Agregar una migración `C02` con las tablas de pacientes, prestaciones y sillones, sus índices de búsqueda y la unicidad de DNI aplicada solo a valores informados.
- Exponer `/api/pacientes`, `/api/prestaciones` y `/api/sillones` con alta, consulta por id, listado/búsqueda paginada, edición y cambio de estado activo; no se expone `DELETE`.
- Validar nombre/teléfono obligatorios, DNI y email opcionales, DNI normalizado único, duración `1..240` e intervalo posterior opcional `0..30` (`null` delega en el intervalo global que administra C-03).
- Implementar la advertencia de posible duplicado (nombre + teléfono) como confirmación en dos pasos: el backend responde `409 PATIENT_POSSIBLE_DUPLICATE` con candidatos mínimos y acepta el alta o edición cuando el cliente reenvía `confirmarPosibleDuplicado: true`. Nunca bloquea definitivamente.
- Publicar códigos de error de dominio estables (`PATIENT_DNI_CONFLICT`, `PATIENT_POSSIBLE_DUPLICATE`, `*_NOT_FOUND`, `*_NAME_CONFLICT`) dentro del contrato común de errores de C-01.
- Exportar desde cada módulo NestJS un puerto de lectura por id con estado `activo` para que C-05 valide referencias sin acceder a tablas ajenas.
- Construir en React las pantallas de pacientes (`/pacientes`) y catálogo (`/prestaciones`, con secciones Prestaciones y Sillones) para listar, buscar, crear, editar, desactivar y reactivar, aplicando el design system revisión 1 (tarjetas y modales `rounded-2xl`, inputs `rounded-lg`, estados de carga/vacío/error).
- Incorporar pruebas unitarias, de API contra MariaDB real y de componentes, con fixtures exclusivamente ficticios.
- Fuera de alcance: intervalo global y `ConfiguracionAgenda` (C-03), creación de turnos y cálculo de intervalo efectivo (C-05), seeds de demostración (C-08), historia clínica e integraciones.

## Capabilities

### New Capabilities

- `patient-registry`: Registro administrativo de pacientes: datos mínimos, DNI único condicionado, advertencia de posible duplicado, búsqueda paginada y baja lógica reversible.
- `clinic-catalogs`: Catálogos de prestaciones (duración e intervalo posterior opcional) y sillones, con nombres únicos, baja lógica reversible y referencias preservables para turnos.

### Modified Capabilities

Ninguna. `application-runtime` ya exige códigos de error estables; la corrección necesaria en el filtro global es implementación compartida y se gestiona como pedido de coordinación (ver Impact), no como cambio de requisitos.

## Impact

- **Código propio:** `backend/src/modules/patients/**`, `backend/src/modules/catalogs/**`, `frontend/src/features/patients/**`, `frontend/src/features/catalog/**` y una migración nueva `*-C02-*.ts`.
- **API nueva:** tres recursos REST bajo `/api`, con forma de paginación `{ items, page, pageSize, total }` definida localmente en cada módulo (C-01 no dejó un contrato compartido de paginación; queda propuesta para promoción en C-08).
- **Consumidores futuros:** C-05 importará `PatientsModule`/`CatalogsModule` y usará sus puertos de lectura; C-07 mostrará nombres de pacientes, prestaciones y sillones, incluidos inactivos en turnos históricos.
- **Dependencias:** ninguna nueva; se usan `typeorm`, `class-validator`, `class-transformer`, `react-router-dom` y `<dialog>` nativo ya disponibles.
- **Pedidos de coordinación a Pablo (bloquean las tareas afectadas de Apply, no la propuesta):**
  1. **CR-01 — códigos de dominio en el filtro global.** `backend/src/shared/http/api-exception.filter.ts` hoy reemplaza todo código por `HTTP_<status>` o `VALIDATION_ERROR` y descarta `details` que no sean arrays. Se pide que propague `code` y `details` cuando una `HttpException` los provea, conservando el fallback actual. Sin esto `application-runtime` no cumple "código estable" para errores de negocio. Además, el filtro descarta `details` con forma de objeto, por lo que `PATIENT_POSSIBLE_DUPLICATE` llega sin `details.candidatos` y el frontend no puede mostrar las coincidencias (verificado contra MariaDB real).
  2. **CR-02 — descubrimiento de pruebas de integración por módulo.** `backend/test/jest.integration.config.cjs` solo busca `test/**/*.integration-spec.ts`, fuera del ownership de C-02. Se pide agregar `<rootDir>/src/**/*.integration-spec.ts` para que las pruebas MariaDB de cada change vivan en su módulo.
- **Riesgo de contrato:** los nombres JSON (`nombre`, `telefono`, `dni`, `email`, `duracionPredeterminadaMinutos`, `intervaloPosteriorMinutos`, `activo`) pasan a ser contrato consumido por C-05 y C-07; cualquier cambio posterior requiere coordinación.
