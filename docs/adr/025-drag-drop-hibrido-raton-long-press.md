# 025. Drag & Drop Híbrido por Pulsación Prolongada con Ratón (*Mouse Long-Press*) en Vistas Compactas

* **Fecha:** 2026-09-23
* **Estado:** Aceptado

## Contexto

En pantallas estrechas ($\le$ 640px) tanto el tablero principal (`views/tasks.js`) como la vista de triaje (`views/triage/`) adoptan una presentación ultra-compacta diseñada para dispositivos móviles. En este modo, la manija de arrastre `⠿` se oculta para maximizar la legibilidad y evitar toques accidentales.

Para dispositivos táctiles, el motor unificado `touch-drag.js` (ADR 022) resolvía la reordenación mediante pulsación prolongada (*long-press* de 420 ms en el cuerpo de la tarea). Sin embargo, al redimensionar o estrechar la ventana del navegador en un PC con ratón:
1. El arrastre HTML5 nativo no podía armarse porque la manija `⠿` estaba oculta (`display: none !important`).
2. El motor táctil escuchaba exclusivamente eventos `touchstart`, ignorando los eventos de ratón (`mousedown`, `mousemove`, `mouseup`).
3. Mantener pulsado el botón del ratón sobre la tarea no permitía reordenarla y al soltar se interpretaba como un clic normal, abriendo el *bottom sheet* de detalles de la tarea.

## Alternativas Consideradas

* **A. Mostrar la manija `⠿` en PC mediante `@media (pointer: fine)`:**
  Permite arrastre instantáneo nativo en PC, pero rompe el diseño ultra-compacto minimalista en anchos móviles y no cumple con la expectativa del usuario de poder mover la tarea manteniendo pulsado el ratón directamente sobre la tarjeta.
* **B. Drag & Drop HTML5 sin manija en toda la tarjeta:**
  Genera graves interferencias con la selección de texto, dobles clics y clics rápidos para abrir el panel de detalle.
* **C. Extender el motor compartido `touch-drag.js` con soporte para pulsación prolongada de ratón (*Mouse Long-Press*):**
  Añade listeners de ratón al motor unificado reutilizando la misma máquina de estados, con un retardo de activación más ágil (250 ms en ratón frente a 420 ms en táctil), listeners globales en `window` para no perder el seguimiento del cursor y supresión del clic posterior.

## Decisión (Opción C)

Se adoptó la **Opción C**:
1. Se extendió `js/app/touch-drag.js` con `handleMouseDown`, `handleMouseMove` y `handleMouseUp`.
2. Se introdujo `mouseHoldDelay = 250` ms para ratón, garantizando que un clic rápido (< 250 ms) siga abriendo el modal de detalle o seleccionando la tarea, mientras que una pulsación sostenida activa el modo de arrastre.
3. Durante el arrastre con ratón, se registran listeners temporales de `mousemove` y `mouseup` a nivel de `window` para que el usuario no pierda el foco si el puntero se mueve rápidamente fuera del elemento.
4. Se desconecta temporalmente el atributo nativo `draggable="false"` en la fila activa mientras dura el arrastre personalizado, previniendo colisiones con el subsistema de drag nativo del navegador.
5. Se mantiene la supresión del clic posterior mediante `wasRecentTouchDrag()`, impidiendo que el clic emitido por el navegador al soltar el ratón abra accidentalmente el *bottom sheet*.
6. Se integró `handleTaskMouseDown` en `views/tasks.js` y `handleTriageMouseDown` en `views/triage/triage-dragdrop.js`, exponiéndolos a través de `views.js` y `window.app`.
7. Se dotó a `checkIsDropTargetAllowed(targetId, optSourceId, optSelectedIds)` en `js/actions/dragdrop.js` de la capacidad de recibir `sourceId` explícito, conectándolo con `isDropTargetAllowed` en `tasks.js` y `triage-dragdrop.js`, asegurando total paridad visual mostrando las rayas rojas (`.drag-forbidden`) al pasar sobre posiciones imposibles (dependencias o `startAfter`).

## Consecuencias

* **Positivas:**
  - Paridad de experiencia de usuario: tanto con el dedo en un móvil real como manteniendo pulsado el ratón en una ventana estrecha de PC, las tareas se reordenan con fluidez.
  - Cero duplicación de lógica: se aprovecha el mismo motor `touch-drag.js`, las mismas clases CSS (`dragging`, `drag-over`, `drag-forbidden`) y la misma verificación de restricciones de dependencias y `startAfter`.
  - No altera el diseño ultra-compacto ni rompe las pruebas existentes de visualización móvil o E2E.
* **Verificación:**
  - Nueva suite `tests/mouse_drag_compact.test.js` con 11 pruebas unitarias y de integración.
  - Ejecución limpia de la suite completa de pruebas unitarias (`npm test`: 774 pruebas) y extremo a extremo (`npm run test:e2e`: 23 pruebas Playwright).
