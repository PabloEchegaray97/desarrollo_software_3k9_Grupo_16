# Guion de demostración de C-08

Este recorrido usa únicamente datos ficticios y comandos versionados. No requiere datos reales de pacientes ni credenciales personales.

## Preparación

Desde la raíz del repositorio:

```powershell
cd backend
npm ci
npm run migration:run
npm run provision:admin
npm run seed:demo
npm run dev
```

En otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Abrir `http://127.0.0.1:5173`.

## Atribución del recorrido

- **Pablo — C-08:** integración final, login, dashboard, shell y recorrido completo.
- **Paula — C-02/C-05:** pacientes, prestaciones, sillones y alta de turnos.
- **Milagros — C-03/C-06:** disponibilidad, excepciones, reprogramación, cancelación y historial.
- **Gonzalo — C-04/C-07:** acceso, navegación responsive, agenda lista/grilla y tema.

## Recorrido

1. Acceder con la cuenta inicial configurada en el entorno local.
2. Confirmar que el dashboard muestra métricas derivadas de la agenda ficticia del día.
3. Abrir Pacientes y localizar identidades ficticias creadas por el seed.
4. Abrir Prestaciones y sillones y confirmar que los catálogos muestran registros ficticios.
5. Abrir Disponibilidad y revisar horarios, intervalos y excepciones ficticias.
6. Activar `+ Nuevo turno`, crear o revisar un turno ficticio y cerrar el resumen.
7. Abrir Agenda y alternar entre Lista y Grilla.
8. Abrir un turno y recorrer reprogramación, cambio de estado, cancelación e historial.
9. Cambiar el tema claro/oscuro y contraer/expandir el sidebar.
10. En viewport móvil, abrir el drawer y comprobar que se cierre al navegar o con `Esc`.

## Resultado esperado

- No aparecen datos reales ni información clínica.
- Login, dashboard y navegación funcionan con la sesión vigente.
- La agenda muestra los cinco estados ficticios sin calcular disponibilidad en el frontend.
- El alta conserva el contexto y el cierre devuelve el foco.
- Reprogramación, estado, cancelación e historial siguen en la página dedicada del turno.
- No hay desplazamiento horizontal en 390×844 ni 1440×900.

## Evidencia automática

- Backend: lint, unitarias, E2E, integración MariaDB y build.
- Frontend: lint, unitarias y build.
- Integración C-08: `backend/test/integration/mvp-flow.integration-spec.ts`.

## Evidencia manual

La revisión visual se marca como manual y debe registrarse en `verification.md` con:

- Pantallas recorridas.
- Temas claro y oscuro.
- Viewports 390×844 y 1440×900.
- Foco, overflow, contraste, carga, vacío, error y diferencias prioritarias.

No se usará Playwright ni se generarán capturas automáticas como reemplazo de esta revisión.
