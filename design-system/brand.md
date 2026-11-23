# Marca y tono visual

## Nombre

- **Nombre de trabajo:** Turnos Odontología.
- **Estado:** `(TBD)` / provisional.
- **Uso:** nunca presentar este nombre como marca definitiva en entregables externos.
- **Fuente única:** `brand.js`.

## Promesa visual

La interfaz debe comunicar que la agenda es ordenada, previsible y fácil de operar. Cada decisión visual debe ayudar a responder rápidamente:

1. ¿Qué turno sigue?
2. ¿Qué estado tiene?
3. ¿Cuánto tiempo bloquea?
4. ¿Hay un conflicto o una excepción?
5. ¿Qué acción es segura ahora?

## Personalidad

| Atributo | Expresión visual | Evitar |
|---|---|---|
| Confiable | Contraste legible, bordes precisos, estados explícitos | Promesas grandilocuentes o decoración tecnológica |
| Serena | Superficies claras, azul profundo y espacios regulares | Saturación extendida o alertas permanentes |
| Clínica | Información estructurada y lenguaje concreto | Blanco hospitalario excesivo o iconografía médica literal |
| Cercana | Radios moderados y mensajes útiles | Personajes genéricos, emojis o tono infantil |
| Eficiente | Agenda compacta y acciones claras | Animaciones continuas o tarjetas innecesarias |

## Logo

- **Archivo estable:** `assets/logo.svg`.
- **Estado:** `(TBD)` / provisional.
- El placeholder combina una marca temporal abstracta de calendario y una etiqueta visible “PROVISIONAL”.
- No usar el placeholder fuera de previews internos o documentación de fundación.
- No deformar, recolorear ni agregar efectos al SVG.

## Color

- Base clara de neutros azulados.
- Azul `#0D3D9E` como primario de acción, navegación y jerarquía.
- Verde fluorescente `#73FFA0` como secundario para confirmaciones y énfasis breve, siempre con texto azul oscuro.
- El verde no debe ocupar grandes superficies ni competir con todas las acciones primarias.
- Rojo apagado reservado para errores/cancelaciones.
- Ámbar reservado para advertencias y ausencias.
- Los estados siempre incluyen etiqueta textual.

## Tipografía

- Interfaz: `Manrope` cuando esté disponible, seguida de `Segoe UI Variable`, `Segoe UI` y fallback sans-serif del sistema.
- Números de hora: pila monoespaciada del sistema.
- No cargar tipografías remotas en la fundación.
- No usar serif en la aplicación operativa.

## Imaginería

El MVP no necesita fotografías. Si se incorporan en una etapa posterior:

- deben mostrar contextos odontológicos reales y sobrios;
- no deben exponer pacientes identificables ni datos clínicos;
- deben evitar sonrisas publicitarias genéricas y bancos de imágenes evidentemente artificiales;
- requieren fuente y licencia documentadas.

## Voz de interfaz

- Frases breves, directas y en español.
- Explicar conflictos: “Este horario se superpone con el turno de las 10:30”.
- Evitar tecnicismos de implementación.
- Confirmar operaciones destructivas funcionales, como cancelar, indicando su consecuencia.
- No culpabilizar al usuario; ofrecer la siguiente acción posible.

