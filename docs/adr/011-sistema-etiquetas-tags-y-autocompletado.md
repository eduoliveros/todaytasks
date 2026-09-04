# 011. Sistema de Etiquetas (Tags) en Tareas y Autocompletado de Hashtags

* **Fecha:** 2026-09-05
* **Estado:** Aceptado

## Contexto
TodayTasks permitía categorizar tareas por entorno (*Trabajo* o *Personal*) y por niveles de urgencia (*Hoy*, *Días*, *Semana*, *Más adelante*). No obstante, los usuarios requerían un mecanismo de clasificación transversal más flexible y específico (por proyecto, cliente o tipología: ej. `#frontend`, `#cliente-acme`, `#bug`, `#casa`), sin sobrecargar la interfaz gráfica ni añadir fricción en la entrada rápida de tareas.

Se planteó la necesidad de integrar etiquetas en las tareas, resolver cómo renderizarlas visualmente en las tarjetas y proporcionar asistencia al escribir mediante un autocompletado en tiempo real sin distinción de mayúsculas/minúsculas (*case-insensitive*).

## Alternativas Consideradas
1. **Opción 1: Chips en línea de metadatos:**
   - Mostrar píldoras de color junto a la urgencia y el horario.
   - Descartada como primaria porque satura la fila de metadatos cuando una tarea acumula múltiples tags, notas y horarios mínimos.
2. **Opción 2: Fila dedicada de tags bajo el título:**
   - Una fila horizontal completa de chips entre el título y los metadatos.
   - Incrementa la altura vertical de las tarjetas en 18–20px, reduciendo la densidad visual diaria.
3. **Opción 3: Borde lateral de acento de color:**
   - Estilo Linear con borde de color y mini-insignias en la cabecera.
   - Descartada porque cuando una tarea tiene múltiples etiquetas, un único color en el borde no refleja la totalidad.
4. **Opción 4: Resaltado sutil de sintaxis en el título + Autocompletado [Seleccionada]:**
   - El `#tag` se escribe y se mantiene directamente en el título de la tarea, renderizándose con tipografía enriquecida, micro-fondo redondeado y color determinista propio (estilo Obsidian / GitHub Markdown).
   - Menú flotante de autocompletado al escribir `#` (ej. `#cas...`), que busca de forma insensible a mayúsculas/minúsculas entre todas las etiquetas existentes en el entorno.
   - Al hacer clic sobre cualquier hashtag en la lista, se filtra instantáneamente la vista por esa etiqueta.

## Decisión
Se implementó la **Opción 4** combinada con un motor de autocompletado y extracción automática:

1. **Modelo de Datos Ligero (`tags?: string[]`):**
   - Las tareas (`Task`) y reglas periódicas (`RecurringTaskRule`) almacenan un array de etiquetas normalizadas en minúsculas extraídas automáticamente mediante regex `/#([a-zA-Z0-9_\u00C0-\u017F-]+)/g`.
   - Cero dependencias foráneas o tablas de registro central complejas, asegurando compatibilidad offline-first y sincronización transparente en Firestore.
2. **Paleta Cromática Determinista (`getTagColorClass` en `js/utils.js`):**
   - Función hash basada en el nombre de la etiqueta que asigna uno de 9 colores armónicos y accesibles (`syntax-blue`, `syntax-emerald`, `syntax-amber`, etc.), garantizando que la misma etiqueta tenga el mismo color en todos los dispositivos y pantallas.
3. **Resaltado Seguro de Sintaxis (`formatTitleWithTags` en `js/utils.js`):**
   - Escapa estrictamente el HTML del título antes de transformar los hashtags en elementos interactivos `<span>`, protegiendo la aplicación contra vulnerabilidades XSS.
   - Añade el manejador `app.filterByTag` al hacer clic sobre el hashtag para activar el filtro de búsqueda inmediatamente.
4. **Módulo de Autocompletado (`js/app/tag-autocomplete.js`):**
   - Detecta la palabra bajo el cursor cuando empieza por `#`.
   - Filtra de manera insensible a mayúsculas y minúsculas (`tag.toLowerCase().startsWith(query.toLowerCase())`) entre todas las etiquetas del entorno activo.
   - Soporte total para teclado (<kbd>↓</kbd>, <kbd>↑</kbd>, <kbd>Enter</kbd>, <kbd>Tab</kbd>, <kbd>Esc</kbd>) y ratón. Al seleccionar una sugerencia, inserta el tag y un espacio para continuar escribiendo sin pausas.

## Consecuencias
* **Positivas:**
  - Fricción cero al escribir: los usuarios pueden categorizar tareas a la velocidad del teclado.
  - Reutilización de etiquetas existentes sin memorizarlas gracias al autocompletado.
  - La fila de metadatos y horarios queda totalmente despejada.
  - Compatibilidad total con el buscador y command palette (`matchesTaskSearch`).
* **Consideraciones:**
  - Los nombres de etiquetas no deben incluir espacios (se recomienda el uso de guiones como `#cliente-acme`).
