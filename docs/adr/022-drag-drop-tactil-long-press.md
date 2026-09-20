# 022. Drag & Drop Táctil por Long-Press (Motor Compartido)

* **Fecha:** 2026-09-20
* **Estado:** Aceptado

## Contexto

La vista de **Triaje** (`views/triage.js`) ya disponía de un *drag & drop* táctil completo mediante pulsación prolongada (*long-press*): temporizador de 420 ms (60 ms sobre la manija `⠿`), vibración háptica, detección del objetivo con `document.elementFromPoint`, clases visuales (`long-press-active`, `dragging`, `drag-over`) y supresión del *click* sintético posterior.

El **tablero principal** (`views/tasks.js`), en cambio, sólo tenía *drag & drop* HTML5 de escritorio (arrastre por la manija). En móvil las tarjetas compactas no permitían reordenar con el dedo.

Duplicar la lógica táctil de triaje en `tasks.js` habría violado la directriz de no repetir bloques de código y duplicado ~180 líneas de un state machine propenso a errores.

## Alternativas Consideradas

* **A. Replicar el motor en `tasks.js`:** bajo riesgo pero duplica el patrón y complica el mantenimiento futuro.
* **B. Extraer un motor compartido y conectar ambas vistas:** más esfuerzo inicial, pero un único punto de verdad.
* **C. Doble renderizado condicional:** descartado por el coste de mantenimiento (ya analizado en ADR 021).

## Decisión (Opción B)

* Se creó `js/app/touch-drag.js` con la factoría `createTouchDragEngine(options)` que encapsula el state machine, parametrizado por:
  - `rowSelector` / `handleSelector`, `shouldIgnoreStart`, `isDraggable`, `getSelectedIds`.
  - Callbacks `onDragStart`, `onDrop`, `onLongPressNotDraggable`.
  - Tiempos `holdDelay` (420 ms), `handleHoldDelay` (60 ms), `longPressNotDraggableDelay` (450 ms) y `vibrateMs`.
  - Helper exportado `wasRecentTouchDrag()` (flag a nivel de módulo) para que `task-detail-sheet.js` suprima el *tap* residual tras un arrastre.
* `views/triage.js` se refactorizó para consumir el motor (paridad total, validada por la suite existente).
* `views/tasks.js` instancia el motor con `.task-item` (tarea única, sin multiselección) y añade `ontouchstart/move/end/cancel` sólo a tarjetas arrastrables (pending/paused); `onDrop` delega en `reorderTaskByDrag`.
* En móvil (≤640px) la manija `⠿` se oculta en el tablero (coherencia con triaje y con otras apps); el arrastre se activa manteniendo pulsada la celda.

## Consecuencias

* **Positivas:**
  - Un solo motor táctil para tablero y triaje; cero duplicación.
  - Reutiliza el motor de reordenación existente `reorderTaskByDrag` (con anclaje de `manualOrder` y snapshots de undo).
  - Escritorio intacto: el drag HTML5 por manija sigue funcionando; el motor táctil es inerte sin eventos `touch`.
* **Verificación:**
  - `tests/touch_drag.test.js`, `tests/tasks_touch_drag.test.js` y la suite de triaje existente (`triage_mobile_features`, `triage_multiselect_move`, `triage_mobile_compact`).
  - E2E en `e2e/tasks.spec.js` (viewport 375×812).
