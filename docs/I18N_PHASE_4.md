# Fase 4: Vistas Principales y Mini-Widget PiP — Hoja de Ruta de Subfases

Este documento define la descomposición operativa, alcance y orden de ejecución para la Fase 4 de internacionalización de TodayTasks. A medida que se implemente cada subfase, se incrementará el número de versión (`1.100.4.1`, `1.100.4.2`, etc.) para identificar con precisión el avance del proyecto.

---

## Índice de Subfases y Versiones

| Subfase | Nombre | Módulos afectados | Versión asociada | Estado |
|---|---|---|---|---|
| **4.1** | Estadísticas y Dashboard de Cabecera | `js/views/dashboard.js`, tests asociados | **`v1.100.4.1`** | 🟢 Completada |
| **4.2** | Tablero Diario (Timeline y Planificación) | `js/views/board.js`, tests asociados | **`v1.100.4.2`** | 🟢 Completada |
| **4.3** | Listas de Tareas y Reuniones (Items y Edición inline) | `js/views/tasks.js`, `js/views/meetings.js`, tests | **`v1.100.4.3`** | 🟢 Completada |
| **4.4** | Modo Enfoque y Mini-Widget PiP | `js/views/focus.js`, `js/pip.js`, tests | **`v1.100.4.4`** | 🟢 Completada |

---

## Detalle de Subfases

### Subfase 4.1: Estadísticas y Dashboard de Cabecera (`js/views/dashboard.js`)
* **Objetivo:** Internacionalizar los chips de resumen estadístico de la cabecera, tooltips de desviación del día, indicador de día libre o tiempo no asignado y la barra de progreso de tareas.
* **Archivos implicados:**
  - `js/views/dashboard.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/progress_bar.test.js` y nuevos tests
* **Elementos a adaptar:**
  1. Chips de estadísticas (`#headerStats`):
     - `dashboard.statsMeetings`: `"Reuniones"` / `"Meetings"`
     - `dashboard.statsTasks`: `"Tareas por hacer"` / `"Tasks to do"`
     - `dashboard.statsCompleted`: `"Completado hoy"` / `"Completed today"`
     - `dashboard.statsInterruptions`: `"Interrupciones"` / `"Interruptions"`
     - `dashboard.statsDeviationTooltip`: `"Desviación del día: {real} reales vs {planned} planificados ({count} {tasksLabel})"`
     - `dashboard.statsFreeDay`: `"Día libre"` / `"Day off"`
     - `dashboard.statsFreeDayTooltip`: `"Día libre sin horario de jornada fijo"` / `"Day off without fixed schedule"`
     - `dashboard.statsUnassignedTime`: `"Tiempo no asignado"` / `"Unassigned time"`
     - `dashboard.statsUnassignedTooltip`: `"Tiempo disponible en la jornada descontando reuniones y tareas por hacer ({start} - {end})"`
  2. Barra de progreso (`renderTaskProgressBar`):
     - Tooltips y textos de progreso si los hubiera.

---

### Subfase 4.2: Tablero Diario (Timeline y Planificación) (`js/views/board.js`)
* **Objetivo:** Internacionalizar el timeline visual de la jornada, descansos automáticos, colchones, fin de jornada y slots de planificación.
* **Archivos implicados:**
  - `js/views/board.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/planning_views.test.js`, `tests/auto_breaks.test.js`

---

### Subfase 4.3: Listas de Tareas y Reuniones (`js/views/tasks.js` y `js/views/meetings.js`)
* **Objetivo:** Internacionalizar los ítems renderizados, acciones inline (eliminar, editar, destacar, copiar), etiquetas de estado ("en curso", "en pausa", "pendiente") y formularios inline.
* **Archivos implicados:**
  - `js/views/tasks.js`
  - `js/views/meetings.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/tasks_view.test.js`, `tests/meetings.test.js`

---

### Subfase 4.4: Modo Enfoque y Mini-Widget PiP (`js/views/focus.js` y `js/pip.js`)
* **Objetivo:** Internacionalizar la pantalla completa de enfoque de tarea, temporizadores, avisos de corte por reunión, interrupción activa y visor PiP.
* **Archivos implicados:**
  - `js/views/focus.js`
  - `js/pip.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/focus_view.test.js`, `tests/pip.test.js`
