# 029. Secuencia Cronológica en "Viabilidad hoy" de Triaje (Opción D), Chip Interactivo `startAfter` y Conmutador de Reuniones

* **Fecha:** 2026-11-02
* **Estado:** Aceptado

## Contexto

En la vista de Triaje rápido (`#/triage`), existían dos problemas de claridad visual al combinar tareas flexibles (sin hora mínima) con tareas diferidas mediante `startAfter`:
1. **Invisibilidad de `startAfter` en las filas de Triaje:** A diferencia de la tarjeta principal en `js/views/tasks.js`, `renderTriageTaskRow` solo renderizaba el rango proyectado `HH:MM → HH:MM`, sin mostrar la píldora `⏰ HH:MM+`. Esto impedía distinguir qué tareas estaban ancladas a una hora mínima y cuáles simplemente ocupaban un hueco posterior.
2. **Saltos horarios en "⏱️ Viabilidad hoy":** Al ordenar las tareas dentro de *Viabilidad hoy* según `a.order - b.order` (orden de prioridad manual), el algoritmo de *gap-filling* (`scheduler.js`) adelantaba las tareas sin restricción a la mañana mientras mantenía las tareas con `startAfter` en la tarde, provocando que la lectura vertical saltara hacia atrás y adelante en el tiempo (`16:00 → 16:30`, seguido de `09:00 → 09:45`, seguido de `13:00 → 13:45`).

## Alternativas Consideradas

* **Opción A (2 tarjetas de grupo plegables con orden cronológico):** Mantener dos bloques separados (`✅ Caben hoy` y `⚠️ Desbordan`) ordenados con `sortTasksChronologically` y chip `⏰`.
* **Opción B (Carriles separados: Cola flexible vs Con hora definida):** Separar las tareas sin `startAfter` de las tareas con `startAfter` en subgrupos independientes.
* **Opción C (Franjas Mañana / Tarde / Overflow + Selector desacoplado Hora | Cola):** Dividir por tramos del día con un conmutador adicional de orden interno en la cabecera.
* **Opción D (Secuencia continua con barrera "Fin de Jornada" y reuniones conmutables - Elegida):** Mostrar el flujo cronológico completo del día en una sola tarjeta continua ordenada por hora proyectada (`sortTasksChronologically`), intercalando las reuniones fijas de 1 línea (con botón en cabecera para ocultarlas/mostrarlas) y separando las tareas que caben (`#triage-group-fits`) de las que exceden el horario (`#triage-group-overflow`) mediante una barrera visual `🏁 LÍMITE FIN DE JORNADA (HH:MM)` con botón rápido `☑️ Seleccionar desbordadas`.

## Decisión

Se implementó la **Opción D** junto con la píldora interactiva `startAfter` transversal en todo Triaje:

1. **Píldora Interactiva `⏰ HH:MM+ ▾` (`.triage-start-after-btn` en `js/views/triage/triage-render.js`):**
   - Visible en todos los modos de Triaje cuando `task.startAfter` está definido.
   - Al hacer clic invoca `app.openStartAfterPopover(task.id, event)` permitiendo editar o eliminar la restricción horaria en 1 clic.
   - Añade la clase `.has-start-after` a la fila y al chip de tiempo para diferenciarlos visualmente con acento ámbar.
2. **Ordenación Cronológica y Rango de Prioridad en `js/views/triage/triage-data.js`:**
   - En `sortMode === 'viability'`, tanto `fits` como `overflow` se ordenan mediante `sortTasksChronologically(tasks, schedule)`.
   - Cada tarea conserva su posición original en la cola de prioridad en `task.priorityRank`, mostrándose como un badge compacto `#1, #2...` (`.triage-priority-rank`).
3. **Flujo Continuo con Línea de Corte y Conmutador de Reuniones:**
   - Se intercalan las reuniones activas del día en filas compactas de 1 línea (`.triage-meeting-row`) indicando su rango y colchón post-reunión (`+buffer HH:MM`).
   - En la cabecera de Triaje aparece el botón `#triageToggleMeetingsBtn` (`📅 Ocultar reuniones` / `📅 Mostrar reuniones`, controlado por `app.toggleTriageMeetings()`), permitiendo ocultar o mostrar las reuniones instantáneamente.
   - Entre `#triage-group-fits` y `#triage-group-overflow` se renderiza `#triageWorkdayCutoffBanner` con el límite horario del día y el botón `#triageSelectOverflowBtn` (`app.selectTriageOverflowTasks()`) para seleccionar o deseleccionar todas las tareas desbordadas en 1 clic.

## Consecuencias

* **Positivas:**
  - Lectura cronológica 100 % continua y sin saltos hacia atrás en *Viabilidad hoy*.
  - Visibilidad inmediata de qué tareas tienen restricción `⏰ HH:MM+` y qué reuniones provocan cortes o desplazamientos.
  - Selección y reprogramación en 2 clics de todas las tareas que caen por debajo de la línea de fin de jornada.
* **Verificación:**
  - Pruebas unitarias en `tests/triage.test.js` y validación de paridad bilingüe en `tests/i18n_parity.test.js`.
