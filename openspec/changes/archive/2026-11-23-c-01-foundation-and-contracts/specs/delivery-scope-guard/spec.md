# Spec Delta

## Purpose

Impide que los branches de changes paralelos modifiquen superficies ajenas o compartidas, haciendo verificable el ownership definido por el roadmap antes de integrar un pull request.

## ADDED Requirements

### Requirement: Resolución estricta de branch a change
El verificador SHALL reconocer los nombres `change/c-XX-<slug>` definidos en `CHANGES.md` y SHALL rechazar todo branch de change que no tenga una asignación exacta en su matriz versionada.

#### Scenario: Branch conocido
- **GIVEN** un pull request desde `change/c-03-availability-and-schedule-settings`
- **WHEN** se ejecuta el control de scope
- **THEN** el verificador aplica exclusivamente la política correspondiente a C-03

#### Scenario: Branch de change desconocido
- **GIVEN** un pull request desde un branch `change/c-99-no-registrado`
- **WHEN** se ejecuta el control de scope
- **THEN** la verificación falla antes de aceptar cualquier path

### Requirement: Validación de paths contra ownership
El control SHALL comparar el diff del pull request con la rama base y SHALL fallar si un archivo modificado queda fuera de los directorios propios o compartidos permitidos para ese change.

#### Scenario: Modificaciones permitidas
- **GIVEN** un branch C-03 que modifica solamente su change OpenSpec, `backend/src/modules/availability/**` y `frontend/src/features/availability/**`
- **WHEN** se valida el diff
- **THEN** el control finaliza correctamente

#### Scenario: Invasión de otro dominio
- **GIVEN** un branch C-03 que modifica `backend/src/modules/patients/**`
- **WHEN** se valida el diff
- **THEN** el control falla e identifica el archivo fuera de scope

### Requirement: Protección de artefactos de integración
Los branches C-02 a C-07 MUST NOT modificar specs principales, archivos archivados, estado de fundación ni documentación global reservada; sync y archive pertenecen al flujo de Pablo sobre `main`.

#### Scenario: Intento de sincronizar specs desde un branch funcional
- **GIVEN** un branch C-04 que modifica `openspec/specs/**`
- **WHEN** se valida el diff
- **THEN** el control falla e informa que la sincronización está reservada para integración

#### Scenario: Intento de modificar la fundación
- **GIVEN** un branch C-02 que modifica `.active-orchestrator-state.json`, `AGENTS.md` o `CHANGES.md`
- **WHEN** se valida el diff
- **THEN** el control falla e identifica cada archivo global protegido

### Requirement: Migraciones paralelas solo por adición identificada
Un change funcional SHALL poder agregar migraciones nuevas con su ID en el nombre, pero MUST NOT modificar ni eliminar migraciones existentes.

#### Scenario: Migración nueva válida
- **GIVEN** C-02 agrega una migración cuyo nombre contiene `C02`
- **WHEN** se valida el estado y path del archivo
- **THEN** el control acepta la adición

#### Scenario: Migración de otro change o modificación histórica
- **GIVEN** C-03 agrega una migración sin `C03` en el nombre o modifica una migración existente
- **WHEN** se valida el diff
- **THEN** el control falla y explica la convención incumplida

### Requirement: Diagnóstico reproducible local y en pull request
La misma lógica de validación SHALL ejecutarse mediante un comando local y mediante GitHub Actions, y SHALL devolver códigos de salida y mensajes equivalentes para el mismo diff.

#### Scenario: Falla diagnosticable
- **GIVEN** un diff con varios archivos fuera de scope
- **WHEN** se ejecuta el verificador local o en un pull request
- **THEN** ambos terminan con código distinto de cero y enumeran todos los archivos rechazados

#### Scenario: Validación sin servicios pagos
- **GIVEN** un clon con Git y el runtime documentado
- **WHEN** se ejecuta el control local
- **THEN** la validación funciona sin credenciales ni servicios externos pagos

### Requirement: Flujo de contribución documentado desde la raíz
El repositorio SHALL incluir `CONTRIBUTING.md` con instrucciones suficientes para iniciar un change, ejecutar su ciclo OpenSpec, publicar la rama y abrir un pull request hacia `main`, distinguiendo validación automática, revisión humana y merge.

#### Scenario: Inicio de un change sin contexto previo
- **GIVEN** una persona con acceso al repositorio y un C-XX asignado
- **WHEN** sigue `CONTRIBUTING.md` desde un clon limpio
- **THEN** puede identificarse, actualizar `main`, crear o recuperar la rama exacta y comprobar que trabaja en el branch correcto antes de editar

#### Scenario: Entrega de un change mediante pull request
- **GIVEN** un change implementado y verificado en su rama
- **WHEN** la persona sigue la sección de entrega de `CONTRIBUTING.md`
- **THEN** puede publicar la rama, abrir un PR con `main` como base, interpretar el guard y entregarlo a Pablo sin ejecutar sync, archive ni merge

#### Scenario: Responsabilidad limitada del guard
- **GIVEN** un pull request abierto
- **WHEN** el control de scope finaliza correctamente
- **THEN** el resultado solo habilita la revisión humana y no crea, aprueba ni fusiona automáticamente el PR
