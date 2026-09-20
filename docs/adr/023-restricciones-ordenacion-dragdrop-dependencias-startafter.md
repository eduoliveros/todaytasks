# 023. Restricciones de Ordenación en Drag & Drop (Dependencias y `startAfter`)

* **Fecha:** 2026-09-20
* **Estado:** Aceptado

## Contexto

En versiones anteriores, el mecanismo de *drag & drop* (D&D) y las acciones directas de movimiento (`moveTaskDirectly`, `moveTasksGroupDirectly`) permitían colocar cualquier tarea en cualquier posición ordinal dentro de la lista de tareas del día, sin ninguna validación.

Esto provocaba dos inconsistencias lógicas en el flujo de trabajo:
1. **Inconsistencia de Dependencias (`dependsOn`):** Una tarea que depende de otra (`A` depende de `B`) podía arrastrarse antes que `B`, a pesar de que nunca podría ejecutarse antes de que `B` se complete.
2. **Inconsistencia de Hora de Inicio (`startAfter`):** Una tarea con hora programada posterior (ej. 16:00) podía colocarse antes que una tarea con hora programada anterior (ej. 09:00). Al mismo tiempo, el usuario necesita libertad para intercalar tareas sin hora en cualquier momento de la jornada según su importancia/prioridad.

## Alternativas Consideradas

* **Restricción 1 (Dependencias):**
  - *Alternativa A (Reversión a origen):* Si se suelta en una posición no válida, cancelar el arrastre devolviendo la tarea a su posición previa. (Descartada: frustrante si el usuario deseaba moverla al tope de lo permitido).
  - *Alternativa B (Feedback visual + Ajuste a primera posición válida):* Durante el arrastre, marcar las posiciones no válidas con `.drag-forbidden` y cursor `not-allowed`. Al soltar, auto-ajustar a la primera posición válida (inmediatamente tras su dependencia) y notificar con un toast informativo. (Seleccionada).

* **Restricción 2 (`startAfter`):**
  - *Alternativa A (Ordenar estrictamente todo por hora o no validar):* Descartada porque forzar a las tareas sin hora a ir antes o después de las tareas con hora destruye la prioridad de las tareas sin hora.
  - *Alternativa B (Restricción relativa exclusiva entre tareas con `startAfter`):* Validar el orden temporal únicamente entre tareas que ambas tengan definida una hora de inicio. Las tareas sin hora tienen libertad total para intercalarse. (Seleccionada).

## Decisión

1. **Lógica Centralizada en [`js/actions/dragdrop.js`](../../js/actions/dragdrop.js):**
   - Se implementó `getTaskOrderingBounds(movingTasks, remainingQueue)`, que calcula de manera pura los límites ordinales permitidos (`minAllowedIdx`, `maxAllowedIdx`) y la causa del ajuste (`dependency` o `startAfter`).
   - Se aplicó este cálculo a `reorderTaskByDrag`, `moveTaskDirectly` y `moveTasksGroupDirectly`.
   - Cuando se fuerza un ajuste de posición al soltar, se dispara `showToast` con el motivo del ajuste.
2. **Feedback Visual en Tiempo Real:**
   - Durante `taskDragOver`, si el objetivo actual viola los límites, se añade la clase CSS `.drag-forbidden` (borde punteado rojo/ámbar y cursor no permitido) y se establece `e.dataTransfer.dropEffect = "none"`.
   - Soporte homólogo en el motor táctil [`js/app/touch-drag.js`](../../js/app/touch-drag.js) para dispositivos móviles mediante el callback `isDropTargetAllowed`.
3. **Estilos y Paridad:**
   - Clases `.task-item.drag-forbidden` en `layout.css` y `.triage-task-row.drag-forbidden` en `triage.css`.
   - Nuevas cadenas de traducción en `es.js` y `en.js` para los avisos contextuales.

## Consecuencias

* **Positivas:**
  - Se eliminan las contradicciones entre el orden manual de la lista y la proyección horaria del planificador (`scheduler.js`).
  - Coherencia idéntica en el tablero principal y en la vista de Triaje rápido.
  - Se preserva la flexibilidad de priorizar tareas sin hora en cualquier tramo del día.
* **Verificación:**
  - Suite de pruebas unitarias en `tests/dragdrop_constraints.test.js`.
  - Validación de paridad i18n en `tests/i18n_parity.test.js`.
