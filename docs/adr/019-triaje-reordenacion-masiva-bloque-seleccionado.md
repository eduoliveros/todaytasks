# 019. Reordenación y Movimiento en Bloque de Tareas Multiseleccionadas en Triaje

* **Fecha:** 2026-09-09
* **Estado:** Aceptado

## Contexto

En la vista de Triaje Rápido (`#/triage`), los usuarios pueden seleccionar múltiples tareas mediante los checkboxes correspondientes para realizar operaciones en lote (trasladar a fechas laborables, cambiar urgencia, destacar ⭐, completar o eliminar).

Sin embargo, existía una limitación importante en la gestión del orden de ejecución:
1. Al arrastrar una tarea mediante Drag & Drop (con ratón en escritorio o pulsación larga en móvil), únicamente se desplazaba la tarea individual arrastrada, ignorando si formaba parte de una selección múltiple.
2. Si el usuario deseaba mover un conjunto de tareas hacia otra posición de la cola, debía moverlas una a una repetitivamente.
3. No existían controles dedicados de desplazamiento de posición (subir, bajar, al inicio, al final) en la barra flotante de acciones masivas (`#triageFloatingBar`), estando disponibles únicamente de forma individual en el Bottom Sheet móvil.
4. Al pulsar un botón rápido de fecha (`[HOY]`, `[MAÑ]`, etc.) en una fila seleccionada, solo se trasladaba esa tarea individual en vez de todo el grupo seleccionado.

## Alternativas Consideradas

* **Alternativa 1 (Reordenar y deseleccionar automáticamente):** Trasladar el bloque de tareas seleccionadas y limpiar la selección inmediatamente. Se descartó porque el usuario suele requerir aplicar acciones adicionales tras reordenar (como ajustar urgencia, destacar o verificar horas).
* **Alternativa 2 (Operar solo con arrastre y no en móvil/botones):** Limitar el movimiento en bloque al Drag & Drop con ratón. Se descartó en favor de paridad completa en dispositivos táctiles (gesto touch de pulsación prolongada, Bottom Sheet móvil) y controles en la barra flotante masiva.
* **Alternativa 3 (Adoptada):**
  - **Reordenación por Arrastre (PC y Touch):** Si la tarea arrastrada pertenece a la selección, se extraen todas las tareas seleccionadas conservando estrictamente su orden relativo original (`order`).
    - *Soltar sobre tarea no seleccionada:* Si se arrastra hacia abajo (`fromIdx < toIdx`), el bloque se inserta a continuación del objetivo. Si se arrastra hacia arriba (`fromIdx > toIdx`), se inserta en la posición del objetivo antes de él.
    - *Soltar sobre una tarea de la misma selección:* Todas las tareas seleccionadas se compactan y agrupan contiguamente en torno a la tarea objetivo seleccionada.
    - *Arrastrar tarea no seleccionada:* Mueve únicamente dicha tarea sin afectar a las tareas seleccionadas ni a su selección.
    - *Feedback visual:* Todas las tareas seleccionadas adquieren la clase `.dragging` durante el arrastre.
    - *Persistencia:* La selección se mantiene activa tras la reordenación.
  - **Controles en Barra Flotante Masiva (`#triageFloatingBar`):** Botones `⤒` (Inicio), `▲` (Subir), `▼` (Bajar) y `⤓` (Fin) para desplazar el bloque seleccionado.
  - **Bottom Sheet Móvil:** Al accionar dirección sobre una tarea seleccionada, se desplaza todo el bloque seleccionado de forma coordinada.
  - **Botones Rápidos de Fecha:** Al pulsar un botón de fecha en una tarea seleccionada, se trasladan todas las tareas seleccionadas a dicha fecha.

## Decisión

### 1. Núcleo de Reordenación (`js/actions/dragdrop.js`)
* Se amplió `reorderTaskByDrag(fromId, toId, selectedIds = null)` para detectar si `fromId` forma parte de `selectedIds`.
* Se implementó `moveTasksGroupDirectly(selectedIds, direction)` para mover el bloque completo manteniendo el orden relativo hacia `'top'`, `'bottom'`, `'up'` y `'down'`.
* `moveTaskDirectly(taskId, direction, selectedIds = null)` delega automáticamente en `moveTasksGroupDirectly` si `taskId` está seleccionado y hay múltiples tareas seleccionadas.
* Ambas operaciones anclan `manualOrder = i + 1` en todas las tareas de la cola y registran un único snapshot transaccional en el módulo de Undo/Redo (`'Reordenar tareas'`).

### 2. Coordinación en la Vista de Triaje (`js/views/triage.js`)
* `triageTaskDragStart` y `triageTaskDrop` transmiten `selectedTaskIds` a `TodayTasksDragDrop`.
* `handleTriageTouchStart` y `handleTriageTouchEnd` trasladan el soporte multiselección a dispositivos móviles y pantallas táctiles.
* `moveTriageTaskToDate` comprueba si la tarea clicada forma parte de `selectedTaskIds` e invoca `actions.moveTasksToDate` con todas las seleccionadas.
* Se incorporó el grupo `.triage-batch-move-group` con botones `⤒`, `▲`, `▼`, `⤓` en la barra flotante de acciones por lote `#triageFloatingBar`.

## Consecuencias

* **Positivas:**
  - Planificación y priorización significativamente más rápida en backlogs con muchas tareas.
  - Comportamiento consistente y predecible tanto con ratón como en táctil y botones accesibles.
  - Soporte transaccional completo para Deshacer (`Ctrl+Z`) y Rehacer (`Ctrl+Y`).
  - Mantenimiento de la selección tras el movimiento para encadenar acciones de forma natural.
* **Negativas / Compensaciones:**
  - Requiere asegurar que las llamadas externas a `reorderTaskByDrag` sigan funcionando transparentemente cuando no se provee `selectedIds`.
