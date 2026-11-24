# app-shell Specification

## Purpose

Ofrece al odontólogo una pantalla de acceso y una estructura de navegación responsive que solo muestra la información del consultorio con una sesión vigente.

## Requirements

### Requirement: Pantalla de acceso
El frontend SHALL ofrecer en `/acceso` un formulario con email y contraseña obligatorios, etiquetas visibles, errores por campo y un mensaje genérico ante credenciales inválidas, sin enlaces de registro ni recuperación. La contraseña MUST NOT guardarse en `localStorage`, `sessionStorage` ni en la URL.

#### Scenario: Campos vacíos
- **WHEN** el usuario envía el formulario sin email o sin contraseña
- **THEN** se muestra el error junto al campo correspondiente y no se llama a la API

#### Scenario: Credenciales inválidas
- **WHEN** la API responde 401 al iniciar sesión
- **THEN** se muestra "Email o contraseña incorrectos", se conserva el email, se vacía la contraseña y el formulario sigue disponible

#### Scenario: Acceso correcto
- **GIVEN** que se llegó a `/acceso` desde una ruta protegida
- **WHEN** el inicio de sesión responde 200
- **THEN** se navega a la ruta originalmente pedida, o a `/agenda` si no había ninguna

#### Scenario: Envío en curso
- **WHEN** la solicitud de acceso está pendiente
- **THEN** el botón queda deshabilitado con indicación de carga y no se envían solicitudes duplicadas

#### Scenario: Usuario con sesión en la pantalla de acceso
- **GIVEN** una sesión vigente
- **WHEN** se abre `/acceso`
- **THEN** se redirige a `/agenda`

### Requirement: Navegación protegida
El shell SHALL consultar la sesión al iniciar la aplicación y SHALL mostrar las rutas del consultorio únicamente con una sesión vigente.

#### Scenario: Verificación inicial
- **WHEN** la consulta de sesión está pendiente
- **THEN** se muestra un estado de carga y no se renderiza contenido protegido

#### Scenario: Ruta protegida sin sesión
- **WHEN** se abre `/pacientes` y la API responde 401
- **THEN** se redirige a `/acceso` conservando `/pacientes` como destino posterior

#### Scenario: Falla técnica al verificar
- **WHEN** la consulta de sesión falla por un error distinto de 401
- **THEN** se muestra un estado de error con opción de reintentar, sin mostrar contenido protegido

### Requirement: Shell responsive con cierre de sesión
Con sesión vigente, el shell SHALL mostrar la marca, la navegación a Agenda, Pacientes y Configuración (Prestaciones y sillones, Disponibilidad), el email de la cuenta y la acción Cerrar sesión, usando los tokens del design system revisión 1.

#### Scenario: Escritorio
- **GIVEN** un viewport de 1440×900
- **WHEN** se muestra el shell
- **THEN** la navegación es visible sin desplegar menús y el enlace activo se distingue

#### Scenario: Móvil
- **GIVEN** un viewport de 390×844
- **WHEN** se muestra el shell
- **THEN** la navegación se abre desde un botón de menú accesible (`aria-expanded`), no produce desplazamiento horizontal y se cierra al elegir un destino o con `Esc`

#### Scenario: Cerrar sesión
- **WHEN** el usuario elige Cerrar sesión
- **THEN** el frontend llama a `POST /api/auth/logout`, descarta el estado de sesión y navega a `/acceso`
