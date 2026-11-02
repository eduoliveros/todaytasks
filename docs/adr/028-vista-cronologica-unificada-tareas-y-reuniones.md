# 028. Vista Cronológica Unificada de Tareas y Reuniones (Opción D)

* **Fecha:** 2026-11-02
* **Estado:** Aceptado

## Contexto

En TodayTasks, la lista principal de tareas (`#tasksList`, renderizada por `TodayTasksTasksView` en `js/views/tasks.js`) ofrece dos modos de ordenación:
1. **Modo Prioridad (`taskSortMode: "priority"`):** Ordena las tareas según su orden manual/prioridad (`order`), permitiendo reorganizarlas mediante Drag & Drop.
2. **Modo Cronológico (`taskSortMode: "chronological"`):** Ordena las tareas según el inicio del primer segmento proyectado por el planificador (`computeSchedule`).

Sin embargo, existía una limitación importante:
- En la vista cronológica, **las reuniones no aparecían en la lista de tareas**; se encontraban aisladas en un panel inferior independiente (`#meetingsList`).
- Como consecuencia, el usuario no podía ver de forma continua e intuitiva cuándo entraba una reunión mientras revisaba o ejecutaba sus tareas.
- En casos donde una reunión fragmentaba una tarea larga en múltiples partes (ej. una tarea de 90 min de 10:45 a 12:55 interrumpida por una reunión de 11:30 a 12:00), la lista de tareas solo mostraba una única tarjeta con un aviso textual (`Dividida por reuniones: ...`), sin reflejar la secuencia temporal real proyectada en el tablero del calendario (`views/board.js`).

## Alternativas Consideradas

* **Opción A: Tarjetas Gemelas (Multi-Card):**
  Desdoblar físicamente la tarea dividida en múltiples tarjetas estándar intercalando la reunión en medio.
* **Opción B: Tarjeta Madre con Interrupción Embebida:**
  Mantener una única tarjeta en el feed que aloje visualmente un acordeón o sub-bloque con la reunión en su interior.
* **Opción C: Tarjeta Principal + Píldora de Reanudación (*Resume Stub*):**
  Mostrar la tarjeta completa en el tramo inicial y una píldora compacta de reanudación en tramos posteriores.
* **Opción D: Timeline / Agenda Integrada (Elegida):**
  Unificar tareas, reuniones, buffers de descanso y descansos automáticos en un feed temporal continuo con estética de agenda y riel vertical de nodos (`.chrono-timeline-feed`), donde cada tramo de una tarea dividida y cada reunión se sitúan en su posición cronológica exacta con paridad 1:1 respecto al tablero del calendario.

## Decisión

Se seleccionó e implementó la **Opción D (Timeline / Agenda Integrada)**:

1. **Motor Canónico de Proyección Temporal (`buildChronologicalFeed` en `js/scheduler.js`):**
   - Centraliza la proyección de tareas (desdobladas por segmentos calculados `segmentsByTask`), reuniones (`state.meetings`), buffers post-reunión (`computeMeetingClusters`) y pausas (`breaks`).
   - Aplica el criterio de ordenación idéntico al del tablero del calendar: `a.start - b.start || a.end - b.end`.
   - Garantiza que la lista cronológica y el tablero del calendar compartan siempre la misma fuente de verdad matemática.

2. **Renderizado en `js/views/tasks.js`:**
   - Si `state.taskSortMode === 'chronological'`, `#tasksList` renderiza un contenedor `.chrono-timeline-feed` con nodos temporales `.chrono-timeline-node` clasificados por tipo (`node-task`, `node-meeting`, `node-buffer`, `node-break`).
   - **Manejo de Tareas Divididas:**
     - Cada tramo se renderiza como una tarjeta `.task-item` en su franja horaria correspondiente con la insignia `🧩 Parte X/Y` (`.task-part-badge`).
     - El primer tramo muestra un aviso `⚠️ Se pausa a las HH:MM por reunión` y los siguientes `↳ Continuación del tramo anterior`.
     - Se añadió un atributo `data-task-split-id` y un listener delegado de hover (`split-partner-hover`) que ilumina todas las partes de la tarea simultáneamente al pasar el ratón.
   - **Reuniones en el Feed:**
     - Cada reunión se muestra con borde índigo `.chrono-meeting-item`, icono de calendario, insignia `🟣 Reunión`, cálculo de duración y botones rápidos de edición (`app.startEditMeeting`) y eliminación (`app.deleteMeeting`).
   - El panel inferior de reuniones (`#meetingsList`) se mantiene intacto según lo requerido para conservar el formulario de alta y la gestión independiente sin forzar cambios drásticos de estructura.

3. **Estilos y Temas:**
   - Riel vertical con línea continua y bullets coloreados según el estado (verde para en curso, índigo para reuniones, azul para pendientes, ámbar para descansos).
   - Adaptación completa en `css/layout.css` y `css/theme-dark.css`.

4. **Internacionalización y Pruebas:**
   - Nuevas claves i18n agregadas en `js/i18n/es.js` y `js/i18n/en.js`.
   - Suite de pruebas unitarias en `tests/chronological_feed.test.js` verificando el motor de proyección y el renderizado DOM.

## Consecuencias

* **Positivas:**
  - Máxima claridad para anticipar reuniones próximas sin necesidad de consultar el panel inferior ni el canvas lateral.
  - Las tareas largas divididas reflejan exactamente cuándo se detienen y cuándo se retoman.
  - Consistencia total entre la lista cronológica y el tablero del calendar.
  - El modo "Prioridad" con Drag & Drop se preserva al 100% sin regresiones.
