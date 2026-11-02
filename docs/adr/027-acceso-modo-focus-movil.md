# 027. Acceso al Modo Enfoque (Focus) en Dispositivos Móviles

* **Fecha:** 2026-11-02
* **Estado:** Aceptado

## Contexto

En TodayTasks, el **Modo Enfoque** (`#/task/:id`, servido por `#view-task` y `TodayTasksFocusView` en `js/views/focus.js`) ofrece una interfaz de pantalla completa con un temporizador circular SVG, cálculo de tiempo consumido vs planificado, badges de reuniones próximas y panel de notas Markdown.

En la vista de escritorio (> 640px), al iniciar una tarea (`running`), se muestra de inmediato el botón `[Focus]` en la barra de acciones de la tarjeta (`.focus-link`) y se habilita el atajo de teclado global <kbd>F</kbd>.

Sin embargo, en dispositivos móviles ($\le$ 640px):
1. La vista compacta de tareas en `css/layout.css` oculta por diseño `.task-actions` (`display: none !important`) en tarjetas normales para mantener la lista ligera y minimalista.
2. Al tocar una tarjeta se abre el *Task Detail Bottom Sheet* (`js/app/task-detail-sheet.js`), pero en las acciones de este modal solo existían los botones `Pausar` y `Completar`, sin ninguna opción para acceder a la vista de Focus.
3. Al no disponer de teclado físico en smartphones para pulsar la tecla <kbd>F</kbd>, los usuarios en móvil no tenían ninguna vía para acceder al Modo Enfoque.

## Alternativas Consideradas

* **1. Botón de Enfoque únicamente en el Bottom Sheet:**
  Añadir el botón dentro del *Task Detail Bottom Sheet*. Es muy limpio y coherente con el paradigma móvil existente, pero requiere siempre 2 toques (tocar la tarjeta y luego tocar el botón dentro del modal).
* **2. Botón directo de Focus en la tarjeta de tarea activa:**
  Mostrar un botón compacto `🎯 Foco` en la fila superior de la tarjeta compacta cuando la tarea pasa a estado `running`. Permite acceso inmediato en 1 solo toque, aunque no cubre el caso en el que el usuario ya está explorando el detalle en el Bottom Sheet.
* **3. Barra flotante inferior (Mini-Player):**
  Un widget sticky al estilo de un reproductor musical. Es persistente con scroll, pero ocupa espacio fijo vertical permanente en pantallas pequeñas.
* **4. Solución Combo Recomendada (1 + 2):**
  Integrar tanto el botón directo en la tarjeta activa (`.task-compact-focus-btn`) para acceso rápido en 1 toque desde el tablero, como el botón destacado de ancho completo (`.task-detail-btn-focus`) dentro del Bottom Sheet para tareas en ejecución o pausadas.

## Decisión (Combo 1 + 2)

Se implementó la **Opción 4 (Combo 1 + 2)**:
1. **Acceso directo en 1 toque desde el tablero móvil:**
   - En `js/views/tasks.js`, cuando la tarea tiene estado `running`, se inyecta el botón `<a href="#/task/:id" class="task-compact-focus-btn" onclick="event.stopPropagation()">🎯 Foco</a>`.
   - En `css/layout.css`, `.task-compact-focus-btn` permanece oculto en escritorio (`display: none !important`), y en pantallas $\le$ 640px se muestra con `display: inline-flex !important`, estilo primario contrastado y área táctil cómoda.
   - La llamada a `event.stopPropagation()` previene que se abra el Bottom Sheet al tocar el botón directo.
2. **Acceso secundario desde el Task Detail Bottom Sheet:**
   - En `js/app/task-detail-sheet.js`, cuando la tarea está en estado `running` o `paused`, se añade en las acciones el botón `<button type="button" class="btn task-detail-btn task-detail-btn-focus" onclick="app.taskDetailSheetAction('focus')">🎯 Modo Enfoque</button>`.
   - Se añadió el manejador `case 'focus'` en `handleAction()` que cierra el sheet y actualiza `window.location.hash = '#/task/' + id`.
   - En `css/layout.css`, `.task-detail-btn-focus` ocupa `grid-column: span 2` encabezando las acciones de control.
3. **Optimización responsiva de la vista de Focus:**
   - En `css/focus.css`, se ajustó el padding superior de `#view-task` a `20px 16px 40px` en pantallas $\le$ 640px para eliminar desaprovechamiento de espacio vertical.
4. **Internacionalización:**
   - Nuevas claves `tasks.btnFocusMobile` y `tasks.btnFocusSheet` en `js/i18n/es.js` y `js/i18n/en.js`.

## Consecuencias

* **Positivas:**
  - El usuario móvil puede acceder al Modo Enfoque en 1 toque directo desde el tablero o en 2 toques desde el modal de detalle.
  - Se permite el acceso tanto con tarea activa (`running`) como pausada (`paused`).
  - Cero alteraciones o regresiones en la vista de escritorio.
* **Verificación:**
  - Nuevas pruebas unitarias dedicadas en `tests/mobile_focus.test.js`.
  - 100% de paridad i18n (`tests/i18n_parity.test.js`).
  - Suite completa de 795 tests unitarios en verde.
