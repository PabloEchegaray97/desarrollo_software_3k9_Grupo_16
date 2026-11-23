# Design

## Context

C-01 dejó `AvailabilityModule` y `AvailabilityPage` como puntos de composición vacíos y fijó NestJS, React/TypeScript estricto, MariaDB real, contrato de errores y migraciones por glob. C-02 documentó pedidos de coordinación pendientes sobre el filtro de errores (CR-01) y el descubrimiento de suites de integración (CR-02); este change no los resuelve ni toca esos archivos. Ver `proposal.md` para la motivación y los specs delta para el comportamiento observable.

Fuentes de dominio aplicadas, en orden de precedencia: `docs/discovery/discovery.md` e `informe-discovery.md` (D.3, D.5 y decisiones aprobadas), `knowledge-base/04_modelo_de_datos.md`, `05_reglas_de_negocio.md`, `06_funcionalidades.md`, `08_arquitectura_propuesta.md`, `09_decisiones_y_supuestos.md` y `10_preguntas_abiertas.md`.

## Goals / Non-Goals

**Goals:**

- Ser la única autoridad de disponibilidad ordinaria y excepciones bloqueantes, con reglas puras y verificables.
- Publicar un puerto estable para que C-05 evalúe intervalos sin reimplementar reglas temporales.
- Persistir configuración, tramos y excepciones en MariaDB real con una migración nueva `C03`.
- Entregar una feature React que comunique resultados y errores con claridad, sin decidir disponibilidad.

**Non-Goals:**

- Crear, reprogramar ni cancelar turnos; eso es C-05/C-06.
- Persistir `fueraDisponibilidad`, `motivoExcepcion` ni eventos de historial de turnos.
- Agregar un tipo `HABILITACION` a `ExcepcionDisponibilidad`.
- Modificar el filtro global de errores, la configuración de Jest, specs principales, `CHANGES.md` ni migraciones ajenas.
- Generar mockups por change, instalar dependencias nuevas ni usar Playwright.

## Decisions

### D-1 — P1-03: excepciones solo bloqueantes; habilitación = override de turno

**Decisión.** `ExcepcionDisponibilidad` admite únicamente `FERIADO`, `VACACIONES` y `BLOQUEO`. No se crea una excepción de habilitación extraordinaria. La atención fuera del horario semanal se resuelve en C-05 mediante el override manual ya modelado en `Turno` (`fueraDisponibilidad` + `motivoExcepcion`, US-031). C-03 expone la evaluación que distingue `FUERA_DE_DISPONIBILIDAD` de `DISPONIBLE`; C-05 decide si el usuario confirmó el override y registra el motivo.

**Justificación con fuente.** `informe-discovery.md` D.3 y decisiones aprobadas dicen «excepción manual fuera de disponibilidad, siempre con motivo y auditoría» y «un turno fuera de disponibilidad solo puede guardarse como excepción manual con motivo». US-031 define ese caso como «autorizar excepcionalmente un turno fuera de mi horario» con confirmación explícita, motivo, sin ignorar solapamientos y con registro en historial. RN-DI-04/05/06 y DD-06 coinciden. El modelo de datos reservó «habilitaciones extraordinarias» como decisión pendiente, pero agregarlas como cuarto tipo obligaría a C-03 a conocer `Turno` y a duplicar el mecanismo de override con una FK cruzada, invadiendo ownership de C-05.

**Alternativa descartada.** Agregar `HABILITACION_EXTRAORDINARIA` a la excepción con rango habilitado. Rechazada porque duplica el registro del motivo en dos entidades, exige que C-05 referencie la excepción desde `Turno` y amplía el contrato compartido sin coordinación.

**Consecuencia de contrato.** El significado de `FUERA_DE_DISPONIBILIDAD` es «eligible para override manual de C-05», no «turno permitido». El nombre y los valores del resultado son contrato para C-05; cambiarlos requiere coordinación previa.

### D-2 — Las excepciones bloqueantes prevalecen sobre el override manual

**Decisión.** Un intervalo cubierto por una excepción activa responde `EXCEPCION_BLOQUEANTE` aunque esté fuera del horario semanal. El override manual de C-05 solo exceptúa la regla de horario semanal; para atender en feriado, vacaciones o bloqueo hay que cancelar la excepción (D-5), acción auditada y visible.

**Justificación.** US-021 pide excepciones «para evitar turnos cuando no atiendo»; US-031 habla de estar «fuera de mi horario», no de ignorar un cierre declarado. RN-DI-03 separa «contenido en un tramo disponible» de «no atravesar un bloqueo». RN-DI-06 prohibía usar la excepción manual para ignorar solapamientos; extenderla a feriados debilitaría esa separación.

**Alternativa descartada.** Permitir override también sobre `VACACIONES`/`FERIADO`. Rechazada porque convertiría una declaración explícita de no atención en una sugerencia y haría ambiguo el feedback de la agenda.

### D-3 — La contención usa duración de atención, no intervalo posterior

**Decisión.** La evaluación verifica que `[inicio, inicio + duracionMinutos)` quede dentro de la disponibilidad y fuera de excepciones. El `intervaloPosteriorMinutos` solo se usa para informar el instante `finBloqueoUtc` que consumirá C-05 y para cálculos de solapamiento de turnos, que no son de este change.

**Justificación.** RN-DI-03 exige contención «considerando su duración de atención»; RN-TU-01 define el bloqueo como duración + intervalo; SU-02 ubica el intervalo después del turno. Mezclar ambos haría que un turno de 30 minutos con intervalo 30 se rechazara cerca del cierre aunque la atención quepa.

**Alternativa descartada.** Exigir que duración + intervalo quepan en el tramo. Rechazada por contradecir RN-DI-03 y porque el intervalo es sobrescribible por prestación/turno en C-05.

### D-4 — Reemplazo atómico de tramos y solapamiento semiabierto

**Decisión.** `PUT /api/disponibilidad/semanales` reemplaza todo el conjunto en una transacción;cualquier solapamiento hace fallar toda la operación. Los intervalos son semiabiertos `[inicio, fin)`, por lo que 12:00–13:00 es contiguo —no solapado— con 10:00–12:00. El día se guarda como hora local (1 = lunes … 7 = domingo), sin fecha asociada.

**Justificación.** US-020 exige múltiples tramos por día, inicio < fin y sin solapados; RN-TU-02 ya adoptó intervalos semiabiertos. Un reemplazo atómico evita estados parciales y simplifica la validación cruzada.

**Alternativa descartada.** CRUD individual de tramos. Rechazada porque permite dejar la agenda inválida entre dos escrituras y multiplica los casos de concurrencia.

### D-5 — Cancelación lógica de excepciones

**Decisión.** Se agrega el atributo de modelo `activo` a `ExcepcionDisponibilidad` (no presente en la tabla conceptual de la KB). `PATCH /api/disponibilidad/excepciones/:id` permite desactivar/reactivar; nunca se borra físicamente. Los listados por defecto muestran solo activas y permiten `incluirInactivas=true`.

**Justificación.** El differential del producto pide excepciones justificadas y trazables; DD-07 fija historial no destructivo. Conservar la excepción permite explicar por qué un turno histórico fue override y hacer auditable su reactivación. Se registra aquí como adición de diseño para revisión, sin cambiar la documentación de producto.

**Alternativa descartada.** `DELETE` físico. Rechazada porque destruiría el motivo y rompería la trazabilidad exigida por RN-AU-01.

### D-6 — Zona IANA, conversión determinista y horarios inexistentes

**Decisión.** Las horas semanales y de excepción se guardan como hora local; los instantes calculados se guardan y devuelven en UTC. La conversión usa las reglas de `America/Argentina/Buenos_Aires` mediante `Intl.DateTimeFormat` de Node, sin dependencias nuevas: se obtiene el offset aplicable al instante candidato y se itera hasta converger. Una hora local inexistente o ambigua por cambio de regla se rechaza con `DATOS_INVALIDOS`. Ningún campo persistido guarda `-03:00` como zona.

**Justificación.** DD-12/RN-TI-01..03 exigen zona IANA y UTC; C-02 advirtió que `DataSource` no fija `timezone` (fuera de ownership). `package.json` no incluye `date-fns`, `luxon` ni `dayjs`, por lo que agregar una librería violaría la regla de dependencias sin beneficio.

**Alternativa descartada.** Guardar offsets fijos o usar la zona del proceso. Rechazada porque fallaría ante cualquier cambio de regla y hace los tests dependientes de la máquina.

### D-7 — Estructura y contrato expuesto

**Decisión.** Backend: entidades y migración `C03`, DTOs validados, repositorio, política pura de disponibilidad, caso de uso transaccional, controlador REST y un puerto exportado por `AvailabilityModule`. Endpoints: `GET/PATCH /api/disponibilidad/configuracion`, `GET/PUT /api/disponibilidad/semanales`, `GET/POST /api/disponibilidad/excepciones`, `PATCH /api/disponibilidad/excepciones/:id` y `POST /api/disponibilidad/evaluacion`. Frontend: `frontend/src/features/availability/**` con página, formularios, cliente HTTP y estados UI. Los mensajes de error usan el contrato de C-01; los códigos de dominio quedan sujetos a CR-01.

**Justificación.** Respeta los directorios propios y la migración compartida solo por adición (`scripts/change-scope/scope-map.json`). La política pura sigue `08_arquitectura_propuesta.md`: no persiste ni lee la hora del sistema.

**Alternativa descartada.** Exponer la lógica de disponibilidad como utilidad en React o compartir tipos editando `frontend/src/shared/**`. Rechazada por la regla dura de autoridad backend y por invadir ownership.

## UI Mockups

- Design system revision: 1
- Decision: no (project policy) — 2026-11-23
- Mockups: no aplica (system-only)
- Approval: no aplica (project policy)
- Preview: no aplica (sin mockup por change)
- Visual verify: pendiente de Apply; revisión manual requerida, sin Playwright

## Risks / Trade-offs

- **[CR-01/CR-02 pendientes]** Los códigos de dominio pueden no propagarse y las suites de integración pueden no descubrirse → la tarea 1.1 registra el pedido a Pablo; los tests afirman estado HTTP y mensaje seguro, y C-05 no decide por código de error. Si Apply llega sin resolución, se reporta bloqueo concreto sin editar archivos compartidos.
- **[Contrato C-05]** `FUERA_DE_DISPONIBILIDAD` puede malinterpretarse como autorización → documentar en `design.md` y en la respuesta JSON un campo `requiereOverrideManual: true`; revisar el consumo durante C-05.
- **[DST/IANA]** Una regla futura distinta de UTC−03:00 cambia conversiones → tests parametrizados por zona y horas inválidas; nunca hardcodear `-03:00`.
- **[Concurrencia]** Dos ediciones de horarios pueden competir → reemplazo atómico y, si C-01 no dejó versión optimista, verificar el conjunto vigente dentro de la transacción; no prometer bloqueo de turnos en este change.
- **[Datos sensibles]** Formularios y logs pueden exponer datos personales → fixtures ficticios y respuestas sin payloads completos; no se registran pacientes aquí.
- **[Verificación visual]** Sin Playwright → revisión manual declarando pantalla y viewport en `verification.md` durante Apply.

## Migration Plan

- **Deploy:** agregar una migración nueva `*-C03-*.ts` con las tres tablas, índices por día/fecha y restricciones; insertar la fila única de configuración con `intervaloGlobalMinutos = 10` y la zona IANA. La migración es solo aditiva y no modifica migraciones C01/C02.
- **Rollback:** revertir la migración C03 únicamente en entornos sin datos de disponibilidad en uso; en caso contrario, conservar tablas y desactivar los endpoints. No existen datos productores anteriores que requieran backfill.
- **Orden:** esta migración debe integrarse en `main` antes de C-05, que la consume para crear turnos.

## Follow-up de coordinación

- A Pablo: confirmar que CR-01 propaga `WEEKLY_SLOT_OVERLAP`/`EXCEPTION_NOT_FOUND` y que CR-02 descubre `*.integration-spec.ts` por módulo antes del Apply de C-03.
- A Paula (C-05): el puerto de evaluación devuelve `DISPONIBLE`, `FUERA_DE_DISPONIBILIDAD`, `EXCEPCION_BLOQUEANTE` o `DATOS_INVALIDOS`; solo `FUERA_DE_DISPONIBILIDAD` habilita el override manual con motivo. Los solapamientos con turnos siguen siendo responsabilidad de C-05.
