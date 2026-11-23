# Spec Delta

## Purpose

Establece el comportamiento operativo mínimo y verificable que permite ejecutar, configurar y extender la aplicación sin implementar todavía funcionalidades odontológicas.

## ADDED Requirements

### Requirement: Configuración validada antes del arranque
El backend SHALL validar todas las variables obligatorias antes de aceptar solicitudes y SHALL informar qué clave de configuración falta sin revelar valores sensibles.

#### Scenario: Arranque con configuración válida
- **GIVEN** una configuración completa con zona `America/Argentina/Buenos_Aires` y credenciales de una instancia MariaDB disponible
- **WHEN** se inicia el backend
- **THEN** la aplicación queda disponible bajo el prefijo `/api`

#### Scenario: Falta una variable obligatoria
- **GIVEN** una configuración sin una variable obligatoria de base de datos
- **WHEN** se intenta iniciar el backend
- **THEN** el proceso termina con un error que identifica la clave faltante y no imprime secretos

### Requirement: Healthcheck seguro de aplicación y base de datos
El backend SHALL exponer `GET /api/health` y SHALL distinguir disponibilidad completa de una falla de conexión a MariaDB sin divulgar host, usuario, contraseña ni detalles internos.

#### Scenario: Aplicación y base disponibles
- **GIVEN** el backend iniciado y MariaDB accesible
- **WHEN** se consulta `GET /api/health`
- **THEN** responde HTTP 200 con un estado operativo estable y sin datos sensibles

#### Scenario: Base de datos no disponible
- **GIVEN** el backend ejecutándose sin poder consultar MariaDB
- **WHEN** se consulta `GET /api/health`
- **THEN** responde HTTP 503 con un estado degradado y sin exponer la causa interna ni credenciales

### Requirement: Persistencia de integración sobre MariaDB real
Las pruebas que validan conexión, migraciones, constraints o transacciones MUST ejecutarse contra MariaDB y MUST NOT sustituirla por SQLite ni por una base en memoria.

#### Scenario: Prueba de integración con MariaDB
- **GIVEN** una instancia MariaDB de pruebas configurada mediante variables de entorno
- **WHEN** se ejecuta la suite de integración de persistencia
- **THEN** la suite comprueba conexión y migraciones usando el motor MariaDB real

#### Scenario: MariaDB de pruebas ausente
- **GIVEN** que no existe una instancia MariaDB de pruebas accesible
- **WHEN** se ejecuta la suite de integración
- **THEN** la ejecución falla de forma explícita en lugar de cambiar silenciosamente de motor

### Requirement: Contrato uniforme de errores HTTP
Los endpoints JSON SHALL representar errores mediante un contrato tipado con código estable, mensaje seguro, identificador de solicitud y detalles opcionales que no contengan secretos ni payloads personales completos.

#### Scenario: Entrada inválida
- **GIVEN** una solicitud que no satisface la validación de entrada
- **WHEN** el backend la rechaza
- **THEN** responde con el estado HTTP correspondiente y el contrato común de error

#### Scenario: Error técnico inesperado
- **GIVEN** una falla interna no controlada
- **WHEN** el backend construye la respuesta
- **THEN** devuelve un mensaje genérico y un identificador de solicitud sin incluir stack trace ni información sensible

### Requirement: Frontend ejecutable con sistema visual compartido
El frontend SHALL iniciar y compilar con TypeScript estricto, SHALL cargar los tokens aprobados de `design-system/` y SHALL ofrecer puntos de composición independientes para las features del roadmap.

#### Scenario: Arranque de desarrollo
- **GIVEN** las dependencias fijadas por el lockfile
- **WHEN** se ejecuta el comando documentado de desarrollo del frontend
- **THEN** se presenta el shell base sin errores de compilación

#### Scenario: Verificación del sistema visual
- **GIVEN** el shell base renderizado
- **WHEN** se inspeccionan sus estilos compartidos
- **THEN** los colores, radios, foco y movimiento provienen de los tokens aprobados y no de una paleta paralela

### Requirement: Comandos reproducibles y documentación de entorno
El repositorio SHALL documentar comandos reproducibles para instalar, desarrollar, compilar y probar backend y frontend, junto con ejemplos de entorno sin valores secretos.

#### Scenario: Preparación desde un clon limpio
- **GIVEN** un clon limpio con Node y MariaDB disponibles
- **WHEN** una persona sigue el README y completa los archivos de entorno desde sus ejemplos
- **THEN** puede instalar dependencias, ejecutar ambas aplicaciones y lanzar las suites documentadas

#### Scenario: Protección de secretos locales
- **GIVEN** un archivo local con credenciales de desarrollo
- **WHEN** Git evalúa los archivos versionables
- **THEN** el archivo local permanece ignorado y solamente se permite versionar el ejemplo sin secretos
