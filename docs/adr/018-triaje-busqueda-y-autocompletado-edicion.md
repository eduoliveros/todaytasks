# 018. Búsqueda de Tareas en Triaje y Autocompletado de Etiquetas (#) y Menciones (@) en Edición

* **Fecha:** 2026-09-09
* **Estado:** Aceptado

## Contexto

1. **Búsqueda en Vista de Triaje:**
   A medida que el volumen de tareas en el backlog o en los distintos horizontes temporales de triaje (Hoy, Próximos 5 días, Sin asignar, etc.) crece, los usuarios requerían una forma rápida de filtrar y localizar tareas en `#/triage`, idéntica a la experiencia de búsqueda del tablero principal. La búsqueda debía permitir filtrar tareas activas por título, notas, etiquetas (`#etiqueta`), menciones (`@persona`), urgencia (`urg:hoy`, `urg:dias`, etc.) y estado destacado (`star`), además de visualizar tareas completadas coincidentes con la posibilidad de reabrirlas (`app.uncompleteTask`).
2. **Autocompletado de Etiquetas y Menciones en Edición:**
   El autocompletado de etiquetas (`#`) y menciones (`@`) funcionaba principalmente en la barra de búsqueda y en el input de creación de tareas. Sin embargo, al editar tareas —tanto en el modal de edición de triaje como en la edición en línea del tablero principal y en el campo de notas de nuevas tareas— el autocompletado no estaba disponible o el menú desplegable quedaba oculto detrás de la capa del modal (`z-index: 100000`).
3. **Reutilización de Código:**
   Se debía evitar duplicar la lógica de filtrado de búsqueda y el motor de autocompletado ya existentes en `js/utils.js` y `js/app/tag-autocomplete.js`.

## Alternativas Consideradas

* **Alternativa 1 (Re-renderizar toda la vista de triaje al escribir):** Re-invocar `renderTriageView()` completo con cada pulsación en el input de búsqueda. Se descartó porque provocaba la pérdida inmediata del foco en el input `#triageSearchInput` y destruía el dropdown del menú de autocompletado.
* **Alternativa 2 (Motor de búsqueda separado para triaje):** Implementar una lógica de búsqueda específica para triaje. Se descartó en favor de la máxima reutilización de `matchesTaskSearch` de `js/utils.js`, garantizando paridad exacta con la búsqueda del tablero principal.
* **Alternativa 3 (Adoptada):**
  - Reutilizar `matchesTaskSearch` en la vista de triaje con soporte para filtrado en caliente de tareas activas por grupo y renderizado de sección de completadas coincidentes.
  - Actualización selectiva del DOM en `oninput` (`.triage-groups-container`, subtítulo, contadores y botones de acción) para preservar intacto el foco del input y la interacción con el autocompletado.
  - Elevar el `z-index` de los dropdowns de autocompletado a `200000` (superior al `z-index: 100000` de los modales).
  - Enriquecer la extracción de etiquetas y menciones escaneando también el campo `notes` en `getEnvironmentTags` y `getEnvironmentMentions`.
  - Conectar el autocompletado de forma ubicua en el modal de triaje, edición inline y campo de notas.

## Decisión

### 1. Búsqueda en Triaje (`js/views/triage.js` y `css/triage.css`)
* Se integró una barra de búsqueda (`#triageSearchBar`, `#triageSearchInput`, `#triageSearchClearBtn`) en la cabecera de la vista de triaje.
* Se reutilizó la función `matchesTaskSearch(task, query)` de `js/utils.js`.
* Cuando existe una consulta activa:
  - Los grupos de tareas activas muestran únicamente las tareas coincidentes.
  - Se añade un banner informativo con el número de tareas activas y completadas encontradas.
  - Se añade la sección `.triage-completed-list` con las tareas completadas que coinciden con la búsqueda, permitiendo reabrirlas con un clic mediante `app.uncompleteTask(id)`.
* Se incorporó soporte para limpiar la búsqueda con el botón (✕) y con la tecla `Escape`.
* Se integró el atajo de teclado `/` en `js/app/shortcuts.js` para enfocar de inmediato el buscador de triaje cuando la vista activa es `'triage'`.
* El input de búsqueda de triaje cuenta con autocompletado reactivo de `#etiquetas` y `@menciones`.

### 2. Autocompletado Ubicuo en Edición de Tareas
* **Elevación de Capas (`z-index: 200000`):** En `js/app/tag-autocomplete.js` y `css/layout.css`, se fijó el `z-index` del menú desplegable a `200000`, garantizando que se muestre por encima de modales (`.modal-overlay` con `z-index: 100000`).
* **Extracción Completa:** `getEnvironmentTags` y `getEnvironmentMentions` ahora inspeccionan tanto `t.title` como `t.notes` tanto en tareas activas como en el histórico de días del entorno.
* **Conexión en Formularios:**
  - Creación de tareas: `#taskTitle` y `#taskNotesInput`.
  - Edición en línea en tablero principal (`js/views/tasks.js`): `#task-edit-title-${id}` y `#task-edit-notes-${id}`.
  - Modal de edición en triaje (`js/views/triage.js`): `#triageEditTitleInput` y `#task-edit-notes-${id}`.

### 3. Métodos Públicos y Coordinación
* En `js/views/triage.js` y `js/views.js`: Se exportan `setTriageSearchQuery`, `getTriageSearchQuery` y `clearTriageSearch`.
* En `js/app.js`: Se exponen en la interfaz global `app` (`app.setTriageSearch`, `app.getTriageSearchQuery`, `app.clearTriageSearch`). Al pulsar en etiquetas o menciones en triaje, se actualiza el buscador de triaje en lugar de navegar al tablero principal si la vista actual es `'triage'`.

## Consecuencias

* **Positivas:**
  - Experiencia de búsqueda fluida, uniforme y predecible entre el tablero principal y la vista de triaje.
  - Máxima reutilización de componentes (`matchesTaskSearch`, `attachTagAutocomplete`, `app.uncompleteTask`).
  - Autocompletado accesible en cualquier campo de texto donde se redacten o editen tareas y notas.
  - Sin pérdida de foco ni parpadeo visual durante la escritura gracias a la renderización selectiva en triaje.
* **Negativas / Compensaciones:**
  - Requiere mantener sincronizados los selectores de los campos editables dinámicos al renderizar filas o abrir modales.
