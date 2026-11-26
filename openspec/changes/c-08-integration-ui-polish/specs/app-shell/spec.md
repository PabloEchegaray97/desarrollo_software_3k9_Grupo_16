# Spec Delta

## MODIFIED Requirements

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
- **THEN** se navega a la ruta originalmente pedida, o a `/` si no había ninguna

#### Scenario: Envío en curso
- **WHEN** la solicitud de acceso está pendiente
- **THEN** el botón queda deshabilitado con indicación de carga y no se envían solicitudes duplicadas

#### Scenario: Usuario con sesión en la pantalla de acceso
- **GIVEN** una sesión vigente
- **WHEN** se abre `/acceso`
- **THEN** se redirige a `/`

### Requirement: Shell responsive con cierre de sesión
Con sesión vigente, el shell SHALL mostrar la marca OdoSoft y navegación hacia Inicio, Agenda, Pacientes, Prestaciones, Disponibilidad y Bloqueos. En escritorio SHALL usar un sidebar izquierdo fijo y contraíble con la acción global `Nuevo turno`, el control de tema y Cerrar sesión en su sector inferior. En móvil SHALL ofrecer navegación inferior para los destinos principales y acceso a los restantes controles sin ocultar contenido ni bloquear su desplazamiento.

#### Scenario: Escritorio
- **GIVEN** un viewport de 1440×900
- **WHEN** se muestra el shell
- **THEN** el sidebar presenta iconos y etiquetas, el destino activo se distingue y el contenido no queda oculto

#### Scenario: Contraer el sidebar
- **GIVEN** el sidebar expandido
- **WHEN** el usuario activa Contraer
- **THEN** permanece una barra de iconos con nombres accesibles, el contenido gana espacio y el control permite volver a expandirla

#### Scenario: Móvil
- **GIVEN** un viewport de 390×844
- **WHEN** se muestra el shell
- **THEN** los destinos principales permanecen accesibles desde la navegación inferior, los controles adicionales se abren desde un botón con nombre accesible y no se produce desplazamiento horizontal

#### Scenario: Cerrar sesión
- **WHEN** el usuario elige Cerrar sesión
- **THEN** el frontend llama a `POST /api/auth/logout`, descarta el estado de sesión y navega a `/acceso`

## ADDED Requirements

### Requirement: Preferencia de tema completa
El shell SHALL ofrecer controles para usar tema claro, oscuro o el tema del sistema. La preferencia explícita SHALL persistirse localmente, aplicarse antes de mostrar contenido protegido y mantener contraste, foco y estados legibles en ambos temas.

#### Scenario: Elegir tema oscuro
- **WHEN** el usuario elige Oscuro
- **THEN** la aplicación aplica los tokens oscuros de la revisión 2 y conserva la elección al recargar

#### Scenario: Seguir el sistema
- **WHEN** el usuario elige Sistema y cambia `prefers-color-scheme`
- **THEN** la aplicación actualiza el tema sin requerir una recarga

#### Scenario: Preferencia todavía desconocida
- **WHEN** la aplicación inicia antes de montar React
- **THEN** aplica el tema resuelto sin mostrar primero el tema contrario

### Requirement: Iconografía semántica Phosphor
La navegación y las acciones frecuentes SHALL usar iconos Phosphor con variante regular en estado normal y `fill` en el destino activo. Todo icono interactivo SHALL conservar etiqueta visible o nombre accesible, y ningún estado SHALL depender solo del icono o del color.

#### Scenario: Destino activo
- **WHEN** el usuario está en Agenda
- **THEN** Agenda muestra icono `fill`, texto o nombre accesible y contraste de selección

#### Scenario: Sidebar contraído
- **WHEN** las etiquetas visuales están ocultas por el modo contraído
- **THEN** cada control conserva un nombre accesible y una ayuda visible al apuntarlo o enfocarlo
