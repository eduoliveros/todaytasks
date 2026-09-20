# 021. Vista Móvil Compacta y Bottom Sheet de Detalle de Tareas

* **Fecha:** 2026-09-20
* **Estado:** Aceptado

## Contexto

En dispositivos móviles (smartphones con ancho $\le$ 640px), la vista tradicional de tareas en el tablero principal sufría de saturación visual:
1. Cada tarjeta renderizaba en línea hasta 15 elementos interactivos (pastillas de urgencia, inicio condicional `startAfter`, dependencias, notas, badges de horas estimadas e invertidas, 6 botones de icono superiores y botones inferiores de Iniciar, Pausar, Completar y reordenación).
2. En pantallas estrechas (375px a 430px), el espacio horizontal comprimía el título de la tarea a menudo hasta hacerlo ilegible o provocar desbordamientos en múltiples líneas desalineadas.
3. El estándar de la industria en aplicaciones de tareas (Trello, Todoist, Things, TickTick) desacopla la lista del detalle: una vista de lista compacta y limpia optimizada para lectura rápida, y un panel o *bottom sheet* desplegable al tocar la tarjeta para consultar detalles e interactuar.

## Alternativas Consideradas

* **Alternativa 1 (Solo CSS - Modo compacto sin detalle):**
  Ocultar los elementos secundarios con media queries y usar la edición inline existente (`app.startEditTask()`) al pulsar la tarjeta.
  *Descartado:* El modo edición es para modificar datos, no para ver notas, consultar dependencias ni ejecutar acciones rápidas de ciclo de vida (Iniciar, Pausar, Completar).
* **Alternativa 2 (Doble renderizado en JS):**
  Crear dos funciones separadas `renderTaskItem()` y `renderTaskItemMobile()` que generen dos árboles HTML independientes según `window.matchMedia`.
  *Descartado:* Duplica la lógica de representación y eleva significativamente el costo de mantenimiento.
* **Alternativa 3 (Adoptada - Opción B: Vista Compacta CSS + Bottom Sheet Reutilizable):**
  - En pantallas $\le$ 640px, las tarjetas de tareas activas y completadas se sintetizan visualmente vía CSS (mostrando únicamente la barra de estado y el título truncado).
  - Al pulsar la tarjeta en móvil, se abre un *bottom sheet* modal (`#taskDetailSheet`) animado desde la parte inferior, que presenta toda la información detallada (urgencia, horas planificadas y consumidas, notas renderizadas con enlaces/Markdown, dependencias bloqueadoras) y una cuadrícula de botones de acción táctiles grandes ($\ge$ 44px).
  - En ordenadores de escritorio (> 640px), la aplicación permanece 100% idéntica, conservando los controles visibles en la tarjeta y el doble clic para edición.

## Decisión

### 1. Submódulo de Detalle en `js/app/task-detail-sheet.js`
* Se creó `TodayTasksTaskDetailSheet(ctx)` exponiendo:
  - `handleTaskClick(taskId, event)`: detecta si la pantalla es móvil y no se pulsó un botón interno, abriendo el sheet.
  - `openTaskDetailSheet(taskId)`: rellena de forma reactiva el título, pastillas, horarios, notas markdown, dependencias y botones pertinentes según el estado de la tarea (pendiente, en curso, pausada o completada).
  - `closeTaskDetailSheet()`: oculta el componente.
  - `handleAction(actionType)`: despacha hacia `app.startTask()`, `app.pauseTask()`, `app.resumeTask()`, `app.completeTask()`, `app.uncompleteTask()`, `app.startEditTask()`, etc.

### 2. Estructura y Estilos
* Se agregó el contenedor `#taskDetailSheet` en `index.html` con atributos de accesibilidad (`role="dialog"`, `aria-modal="true"`).
* Se añadieron en `css/layout.css` las clases `.task-detail-bottom-modal`, `.task-detail-bottom-card` con animación `taskDetailSlideUp` y botones adaptados al tacto (`.task-detail-btn`).
* Soporte para cerrar con tecla <kbd>Esc</kbd> integrado en `js/app/shortcuts.js`.

### 3. Extensión a Vista de Triaje (Fase 3 - v1.115)
* **Filas Compactas en Triaje (`css/triage.css`):** Ocultación en móvil ($\le$ 640px) de `.triage-quick-days-wrap`, `.triage-copy-btn`, `.triage-complete-btn`, `.triage-delete-btn` y rangos horarios, liberando todo el ancho horizontal para el título de la tarea y el icono de urgencia (~28px).
* **Interacción Táctil Desacoplada de Selección:** En móvil, pulsar una fila de triaje ya no conmuta la selección (evitando marcar tareas por error al tocarlas), sino que abre el *Bottom Sheet* `#taskDetailSheet`. Para selección masiva se utiliza el checkbox explícito `.triage-task-cb`.
* **Sección de Posición y Reprogramación:** El *Bottom Sheet* se extendió con controles táctiles de reordenación (`⤒`, `▲`, `▼`, `⤓`) y fichas de los próximos 5 días laborables (`getNextWorkingDays`) para mover de fecha con un toque.

### 4. Consecuencias
* **Positivas:**
  - Lectura clara y navegación fluida en dispositivos móviles, tanto en tablero principal como en triaje.
  - Interacción táctil accesible, ergonómica y unificada en un solo componente *Bottom Sheet*.
  - Desacoplamiento limpio entre visualización/acciones (tap en fila) y selección múltiple (checkbox).
  - Cero duplicación de código y comportamiento de escritorio 100% intacto.
* **Verificación:**
  - Pruebas unitarias en `tests/task_detail_sheet.test.js`, `tests/mobile_compact_tasks.test.js` y `tests/triage_mobile_compact.test.js`.
  - Pruebas E2E completas con Playwright en `e2e/tasks.spec.js` (incluyendo flujo de tablero y triaje en móvil).
