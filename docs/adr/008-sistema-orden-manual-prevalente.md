# 008. Prevalencia del Orden Manual sobre el Orden Automático (`manualOrder` y `sortTasksWithManualOrder`)

* **Fecha:** 2026-09-03
* **Estado:** Aceptado

## Contexto
En TodayTasks, las tareas se ordenaban tradicionalmente mediante una función de comparación automática `sortTasksByPriority()` que evaluaba estrictamente:
`status === 'running' > urgency ('today' > 'days' > 'week' > 'later') > featured (true > false) > order`.

Cada vez que el usuario añadía una tarea, cambiaba una urgencia o destacaba una tarea, el sistema ejecutaba este reordenamiento global y reescribía `task.order = 1, 2, 3...`.

Esto generaba fricción significativa:
1. Durante el triaje o la planificación diaria, el usuario reordena manualmente sus tareas según preferencias subjetivas, contexto o conveniencia que no siempre coinciden con la urgencia formal o la estrella.
2. Si el usuario colocaba manualmente una tarea en primer lugar (por ejemplo, una tarea de urgencia media porque quería empezar por ella), la creación posterior de una tarea urgente o la edición de otra tarea provocaba que la tarea colocada deliberadamente primera fuera desplazada hacia abajo.
3. Si el usuario colocaba manualmente una tarea de baja prioridad al final de la cola del día, la creación de nuevas tareas normales o urgentes debía intercalarse coherentemente antes de esa tarea final, sin mandarlas al fondo ni alterar el orden manual previo.

## Decisión
Se implementó un modelo híbrido de ordenación basado en anclaje manual (`manualOrder`) y un algoritmo de intercalado inteligente (`sortTasksWithManualOrder`):

1. **Campo `manualOrder` en la entidad Tarea:**
   - Se añadió la propiedad opcional `manualOrder?: number | null` en el modelo `Task` (`docs/DATA_SCHEMA.md`).
   - Las tareas con `manualOrder != null` se consideran **ancladas** en una posición fija elegida por el usuario.
   - Las tareas con `manualOrder == null` se consideran **flotantes** y se ordenan automáticamente según su prioridad.

2. **Anclaje Integral en Acciones Manuales (Opción A):**
   - Cuando el usuario reordena mediante drag & drop en el tablero o en triaje (`reorderTaskByDrag`), o mediante los botones de desplazamiento ▲ / ▼ (`moveTask`), **todas** las tareas activas de la cola quedan ancladas fijando `t.manualOrder = i + 1`.

3. **Invariantes del Algoritmo `sortTasksWithManualOrder`:**
   - **Tarea en ejecución:** La tarea con `status === 'running'` se ubica incondicionalmente en la primera posición (`order: 1`).
   - **Inviolabilidad de la primera ancla:** La primera tarea anclada (`anchored[0]`) jamás puede ser sobrepasada por una tarea flotante nueva o editada (a menos que el usuario use explícitamente "Añadir al inicio" con `toTop: true`).
   - **Preservación del ancla en mutaciones de atributos:** Cambiar la urgencia (`setTaskUrgency`) o el estado destacado (`setTaskFeatured`) de una tarea anclada no borra su ancla ni altera su posición en la lista.
   - **Intercalado por prioridad:** Las tareas flotantes se intercalan automáticamente antes de las ancladas siguientes (`anchored[1..n-1]`) únicamente si tienen una prioridad de urgencia o destacado estrictamente superior.

4. **Botón para Restablecer al Orden Automático (`applyAutoOrder`):**
   - Se incorporó el botón `⚡ Orden automático` tanto en la cabecera de la vista de triaje rápido (`#triageAutoOrderBtn`) como en el panel de configuración de la barra superior (`#autoOrderBtn`).
   - Esta acción elimina las anclas (`manualOrder = null`), ejecuta la ordenación pura por prioridad (`sortTasksByPriority`) y registra un snapshot en el módulo de Undo/Redo (`Ctrl+Z`).

## Consecuencias
* **Positivas:**
  - El usuario tiene control total sobre el orden de ejecución diario sin temor a que nuevas tareas o cambios de etiqueta arruinen su planificación.
  - Comportamiento intuitivo y predecible: la primera tarea manual permanece primera y las nuevas tareas se ubican en el punto óptimo de la cola según su urgencia.
  - Transición fluida entre orden manual y automático gracias al botón de restablecimiento con soporte para Deshacer.
* **Negativas / Compensaciones:**
  - Introduce una propiedad adicional en el modelo de tareas que debe ser considerada en la migración de datos y la sincronización entre dispositivos.
