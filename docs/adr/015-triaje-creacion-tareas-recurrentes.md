# 015. Triaje: Creación de Tareas Recurrentes y Reutilización del Sistema de Recurrencia

* **Fecha:** 2026-09-06
* **Estado:** Aceptado

## Contexto
En TodayTasks, la vista de Triaje Rápido (`#/triage`) unificó en la versión 1.102 la creación de tareas en móvil y escritorio reutilizando `#triageTaskEditModal` en modo creación (`id: '__new__'`).

Sin embargo, al añadir una nueva tarea desde Triaje no era posible configurar su patrón de recurrencia periódica (frecuencia, intervalo, días de la semana y fecha fin). Si un usuario deseaba crear una tarea que se repitiera (por ejemplo, un standup semanal o una revisión técnica diaria), se veía obligado a abandonar la vista de Triaje, regresar al tablero principal y utilizar el formulario lateral.

Por otro lado, en la página principal existían dos interfaces para definir o inspeccionar recurrencias:
1. El panel de opciones de recurrencia dentro del formulario lateral de tareas (`#recurringTaskFormOptions`).
2. El popover flotante interactivo (`#recurringInfoPopover` en `js/app/popovers.js`).

## Decisión
Se analizó la posibilidad de reutilizar el código del popup o panel de la página principal:

1. **Reutilización de Estilos CSS e Internacionalización (i18n):**
   - Se reutilizan íntegramente las clases semánticas `.rec-form-grid`, `.rec-form-field`, `.rec-pop-days-row`, `.rec-pop-day-btn`, `.rec-pop-link-btn`, `.rec-pop-select`, `.rec-pop-input-number` y `.rec-pop-input-date` definidas en `css/modals.css`.
   - Se aprovechan todas las cadenas de traducción ya disponibles en `js/i18n/es.js` y `en.js` (`recurrence.*` y `tasks.recurringLabel`).

2. **Integración en el Modal de Triaje (`#triageTaskEditModal`) vs Sub-Popover:**
   - Se descartó invocar el popover flotante `#recurringInfoPopover` encima del modal abierto en triaje. Un popover con overlay flotante superpuesto sobre un modal centrado a pantalla completa (`z-index: 100000`) genera graves inconvenientes de usabilidad en dispositivos táctiles móviles (recortes por *viewport*, colisiones de overlays, atrapamiento de eventos de teclado y pérdida de contexto).
   - En su lugar, se adoptó la **integración expandible dentro del modal**: un checkbox accesible *"Repetir tarea 🔁"* (`#triageEditIsRecurringCb`) que despliega el panel de opciones de recurrencia idéntico al del formulario principal.
   - Si la tarea es marcada como recurrente, la opción *"Auto-mover si no se completa a hoy"* se oculta automáticamente para evitar contradicciones lógicas, pues las tareas periódicas se materializan mediante su regla maestra.

3. **Conexión con el Motor Central de Tareas y Undo:**
   - En `actionsModule.saveEditTask('__new__')` (`js/actions/tasks.js`), cuando `taskEdit.isRecurring` está activo, se construye la estructura `recurringData = { isRecurring: true, freq, interval, daysOfWeek, endDate, urgency, featured, startAfter, notes }`.
   - Se invoca `actionsModule.addTask(..., recurringData)`, lo que genera de forma centralizada la regla en `state.recurringTasks`, ejecuta `materializeRecurringTasks()` y crea una instantánea en `undoModule`.
   - Cualquier creación recurrente en Triaje puede revertirse inmediatamente con el botón *Deshacer* (`↶ Deshacer` o <kbd>Ctrl+Z</kbd>).

## Consecuencias
* **Positivas:**
  - Paridad funcional completa entre el tablero principal y la vista de Triaje al crear tareas.
  - Cero duplicación de estilos CSS y consistencia visual en selectores de frecuencia, días de semana (`L`, `M`, `X`, `J`, `V`, `S`, `D`) y fechas límite.
  - Experiencia optimizada tanto para ordenadores como para pantallas táctiles móviles.
  - Capacidad de deshacer inmediatamente la regla periódica creada sin efectos secundarios.
* **Compensaciones:**
  - Requiere mantener sincronizados los helpers de conmutación de días (`toggleTriageRecurrenceDay`) con el estado en borrador de `taskEdit`.
