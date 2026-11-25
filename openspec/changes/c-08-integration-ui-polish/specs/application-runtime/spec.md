# Spec Delta

## MODIFIED Requirements

### Requirement: Configuración validada antes del arranque
En desarrollo, el backend SHALL cargar `backend/.env` antes de validar la configuración. En todos los entornos SHALL validar las variables obligatorias antes de aceptar solicitudes e informar qué clave falta sin revelar valores sensibles. Los valores ya presentes en el entorno SHALL conservar precedencia sobre el archivo local.

#### Scenario: Arranque con configuración válida
- **GIVEN** una configuración completa con zona `America/Argentina/Buenos_Aires` y credenciales de una instancia MariaDB disponible
- **WHEN** se inicia el backend con el comando documentado
- **THEN** la aplicación carga la configuración antes de validarla y queda disponible bajo `/api`

#### Scenario: Configuración desde archivo local
- **GIVEN** un `backend/.env` válido y variables equivalentes ausentes del proceso
- **WHEN** se ejecuta el comando de desarrollo
- **THEN** el backend inicia sin exigir un comando alternativo con `--env-file`

#### Scenario: Falta una variable obligatoria
- **GIVEN** una configuración sin una variable obligatoria de base de datos
- **WHEN** se intenta iniciar el backend
- **THEN** el proceso termina con un error que identifica la clave faltante y no imprime secretos

### Requirement: Comandos reproducibles y documentación de entorno
El repositorio SHALL documentar el orden reproducible para instalar, configurar MariaDB, ejecutar migraciones, aprovisionar la cuenta inicial, iniciar backend/frontend y correr lint, pruebas y builds. SHALL incluir ejemplos de entorno sin secretos y distinguir base de desarrollo de base de integración.

#### Scenario: Preparación desde un clon limpio
- **GIVEN** un clon limpio con Node 24, npm 11 y MariaDB disponibles
- **WHEN** una persona sigue el README y completa los archivos de entorno desde sus ejemplos
- **THEN** puede instalar dependencias, migrar la base, crear la cuenta inicial, ejecutar ambas aplicaciones y lanzar las suites documentadas

#### Scenario: Verificación completa documentada
- **WHEN** una persona sigue la sección de verificación
- **THEN** puede ejecutar lint, unitarias, API/E2E, integración MariaDB y builds de ambas aplicaciones sin comandos implícitos

#### Scenario: Protección de secretos locales
- **GIVEN** un archivo local con credenciales de desarrollo
- **WHEN** Git evalúa los archivos versionables
- **THEN** el archivo local permanece ignorado y solamente se permite versionar el ejemplo sin secretos

## ADDED Requirements

### Requirement: Datos ficticios reproducibles para demostración
El repositorio SHALL ofrecer un comando documentado e idempotente que prepare pacientes, prestaciones, sillones, disponibilidad y turnos ficticios suficientes para recorrer el MVP. SHALL NOT incluir datos reales, secretos ni información clínica, y SHALL identificar los registros de demostración para evitar duplicarlos.

#### Scenario: Primera preparación
- **GIVEN** una base de desarrollo migrada sin datos de demostración
- **WHEN** se ejecuta el comando de preparación
- **THEN** se crean registros ficticios que permiten mostrar dashboard, agenda, alta y ciclo de vida

#### Scenario: Ejecución repetida
- **GIVEN** que los registros de demostración ya existen
- **WHEN** se vuelve a ejecutar el comando
- **THEN** no se duplican pacientes, catálogos, disponibilidad ni turnos identificados por el seed

#### Scenario: Privacidad del dataset
- **WHEN** se revisan el código, la salida y la documentación del seed
- **THEN** solo aparecen identidades ficticias, sin teléfonos, correos, documentos o secretos pertenecientes a personas reales

### Requirement: Guion verificable de entrega
El repositorio SHALL documentar en `docs/demo/` un recorrido del trabajo de los cuatro integrantes: acceso, dashboard, pacientes y catálogos, disponibilidad, alta, agenda, reprogramación, cancelación o estado e historial. SHALL indicar preparación, resultado esperado y qué verificaciones son automáticas o manuales.

#### Scenario: Demostración completa
- **GIVEN** una instalación preparada con datos ficticios
- **WHEN** una persona sigue el guion en orden
- **THEN** puede recorrer el MVP sin inventar datos, rutas ni comandos fuera del repositorio

#### Scenario: Evidencia honesta
- **WHEN** una comprobación visual no fue automatizada
- **THEN** el guion la marca como manual y enumera pantalla y viewport, sin afirmar capturas o pruebas inexistentes
