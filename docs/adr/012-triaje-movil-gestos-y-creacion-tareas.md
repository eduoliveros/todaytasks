# 012. Triaje en Móvil: Botones Undo/Redo, Movimiento por Pulsación Prolongada (Long-Press) y Creación de Tareas

* **Fecha:** 2026-09-05
* **Estado:** Aceptado

## Contexto
La vista de Triaje Rápido (`#/triage`) resultaba idónea en ordenadores de sobremesa para procesar listas densas de tareas, pero presentaba varias limitaciones clave en dispositivos móviles y en flujos rápidos de triaje:
1. **Falta de atajos de teclado en móviles para deshacer/rehacer:** En PC, el usuario confía en `Ctrl+Z` y `Ctrl+Y`. En pantallas táctiles no hay teclado físico ni botones permanentes en triaje, lo que provocaba que una acción errónea (borrar o mover) no se pudiera deshacer con facilidad.
2. **Incompatibilidad táctil de Drag & Drop:** La API HTML5 nativa de drag & drop (`draggable="true"`) no funciona en pantallas táctiles móviles, impidiendo que el usuario reordenara la cola del día con el dedo.
3. **Imposibilidad de añadir nuevas tareas desde el triaje:** Si durante la clasificación el usuario recordaba o identificaba una tarea pendiente, debía salir a la pantalla principal, escribirla en el panel lateral y regresar al triaje.

## Decisión
Se implementaron tres mecanismos coordinados de interacción:

1. **Botones Undo/Redo Integrados en la Cabecera de Triaje:**
   - Botones reactivos `↶ Deshacer` y `↷ Rehacer` en la cabecera `.triage-header`.
   - Consulta dinámica de `canUndo()` y `canRedo()` para deshabilitar los botones cuando no hay acciones en la pila histórica.
   - En pantallas pequeñas (`@media (max-width: 768px)`), se optimiza el espacio ocultando etiquetas de texto y mostrando iconos de alta accesibilidad táctil junto al botón "Volver".

2. **Detección de Long-Press / Toque en Manija y Reordenación Táctil Móvil:**
   - Se reutiliza de forma directa el motor central `reorderTaskByDrag(fromId, toId)` de `TodayTasksDragDrop` (expuesto en `actionsModule` y `window.app`).
   - Diferenciación táctil inteligente:
     - Toque sobre la manija de arrastre `⠿` (`.triage-drag-handle`): inicia el modo arrastre de forma casi instantánea (~60ms) permitiendo arrastrar de inmediato sin esperas.
     - Toque sobre el cuerpo de la fila: requiere pulsación prolongada (~420ms) sin desplazamiento (>10px) para permitir el scroll vertical natural de la pantalla.
   - Si el usuario arrastra el dedo verticalmente, se calcula en tiempo real el elemento de destino (`document.elementFromPoint`), se cancela el scroll nativo/pull-to-refresh (`touch-action: pan-y` / `none` dinámico) y se resalta la fila de destino con `.drag-over`.
   - **Gestión de la primera tarea en ejecución (`running`):**
     - Si la primera tarea está en ejecución, al soltar cualquier tarea pendiente sobre ella, se posiciona automáticamente al inicio de la cola de tareas pendientes (`toIdx = 0`).
     - Si se pulsa de forma prolongada sobre la tarea en ejecución, el Bottom Sheet `#triageMobileMoveSheet` muestra un aviso informativo y un botón para pausar la tarea en 1 toque antes de reordenarla.
   - Si el usuario mantiene pulsado sin arrastrar sobre otra fila, se despliega la hoja inferior (Bottom Sheet `#triageMobileMoveSheet`) accesible con el pulgar para:
     - Subir (`moveTaskDirectly(id, 'up')`)
     - Bajar (`moveTaskDirectly(id, 'down')`)
     - Enviar al principio o al final de la cola del día.
     - Mover rápidamente a los 5 próximos días hábiles.
   - Supresión de clics sintéticos posteriores (`touchDragJustEnded` y `preventDefault`) para evitar que la fila se seleccione o se abra el editor por error tras soltar el arrastre o cerrar el bottom sheet.
   - Cualquier reordenación emite una instantánea en `undoModule` para permitir su reversión inmediata con los botones de Deshacer/Rehacer.

3. **Creación Unificada de Tareas en Móvil y Escritorio (PC):**
   - Para evitar inconsistencias de interfaz y formularios redundantes con menos opciones, se unificó la creación y edición reutilizando `#triageTaskEditModal` en modo creación (`taskEdit.id === '__new__'`).
   - Esto brinda paridad funcional completa al añadir tareas en triaje: título con autocompletado de `#etiquetas`, duración planificada, selector visual de urgencia, conmutador de destacada ⭐, editor de notas Markdown con barra de herramientas, hora mínima `startAfter` y opción de auto-traslado a hoy.
   - En PC se activa mediante el botón de cabecera `＋ Nueva tarea` o el atajo de teclado <kbd>N</kbd>; en móvil mediante el botón flotante (FAB `#triageFabAddTask`). Se eliminaron la barra inline intermedia y el modal inferior simplificado anterior.
   - Todas las tareas creadas se integran directamente en la cola del día activo con snapshot automático en `undoModule` para permitir deshacer de inmediato.

## Consecuencias
* **Positivas:**
  - Experiencia táctil de primer nivel en smartphones y tablets.
  - Mayor seguridad operativa al poder revertir cualquier acción masiva o individual desde móvil.
  - Flujo de triaje sin interrupciones: creación, priorización, reordenación y reprogramación en un solo lugar.
* **Negativas / Compensaciones:**
  - Requiere gestionar estados táctiles y temporizadores de toque para evitar falsos positivos durante el scroll vertical ordinario.
