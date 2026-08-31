# 003. Popover interactivo de información y gestión de reglas de recurrencia

* **Fecha:** 2026-08-31
* **Estado:** Aceptado

## Contexto
En TodayTasks, las tareas y reuniones periódicas se materializan en cada día a partir de reglas maestras (`RecurringTaskRule` y `RecurringMeetingRule`) que definen su frecuencia (`daily`, `weekly`), intervalos, días activos de la semana y periodo de vigencia.

Sin embargo, en la interfaz visual solo se mostraba una etiqueta estática `🔁 Recurrente` con un tooltip genérico. Los usuarios no tenían forma de consultar qué días de la semana se repetía una tarea, con qué periodicidad o hasta cuándo estaba vigente sin tener que navegar por distintos días del calendario.

## Decisión
1. **Helper de formato descriptivo (`utils.js`):**
   - Se implementa `formatRecurrenceRule(rule)` para transformar cualquier regla maestra en representaciones legibles en lenguaje natural:
     - Frecuencias e intervalos: *"Diaria"*, *"Cada 3 días"*, *"Semanal"*, *"Cada 2 semanas"*.
     - Días activos: *"Lunes, Miércoles, Viernes"* y notación compacta *"Lun, Mié, Vie"* o *"L, X, V"*.
     - Vigencia: *"Desde YYYY-MM-DD · Hasta YYYY-MM-DD"* o *"Indefinida"*.

2. **Botón interactivo en las tarjetas de tareas y reuniones (`views/tasks.js` y `views/meetings.js`):**
   - Se sustituye el tag estático `<span>` por un botón accesible `<button type="button" class="tag recurring-tag-btn">` con:
     - Tooltip dinámico (`title`) que resume la regla al pasar el cursor (ej. *"Tarea recurrente: Semanal (L, X, V) (Desde 2026-08-01 · Indefinida) · Clic para detalles"*).
     - Evento de clic `app.openRecurringInfoPopover(entityId, event, type)`.

3. **Popover contextual flotante con edición directa (`index.html`, `css/modals.css`, `app.js`):**
   - Al pulsar el badge, se abre un popover flotante (`#recurringInfoPopover`) que muestra:
     - Título de la regla y tipo (Tarea / Reunión recurrente).
     - Desglose estructurado de frecuencia/intervalo, días de la semana y periodo de vigencia.
     - Indicador de estado de la ocurrencia actual (si está sincronizada con la serie o si es una ocurrencia modificada hoy).
     - Botón de acción **"✎ Editar recurrencia"** que despliega el formulario interactivo para modificar frecuencia (`daily` / `weekly`), intervalo, días activos `[L] [M] [X] [J] [V] [S] [D]` y fecha límite directamente desde el popover.
   - Posicionamiento flotante inteligente con límites de pantalla (*viewport clamping*).
   - Soporte para cierre con clic en overlay, botón de cierre `✕` o tecla `Escape`.

## Consecuencias
* **Positivas:**
  - Información transparente e inmediata sobre cualquier tarea o reunión periódica sin saturar visualmente la tarjeta de tarea.
  - Experiencia coherente y unificada tanto para tareas como para reuniones recurrentes.
  - Acceso directo para editar la regla de la serie sin necesidad de abrir menús secundarios.
  - Compatible con temas claro y oscuro.
* **Negativas / Compensaciones:**
  - Requiere mantener sincronizada la referencia a `ruleId` cuando se materializan o editan las tareas y reuniones.
