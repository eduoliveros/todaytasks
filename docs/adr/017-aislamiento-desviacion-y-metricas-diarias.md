# 017. Aislamiento de Desviación Diaria y Métricas de Cabecera para Tareas Trasladadas (`initialElapsed`)

* **Fecha:** 2026-09-08
* **Estado:** Aceptado

## Contexto
En TodayTasks, las tareas que no se completan en la jornada y tienen activada la opción de auto-mover (`autoMoveToToday`) se trasladan automáticamente a la fecha actual mediante `rolloverPendingTasks` (o manualmente mediante `moveTaskToDate`). Al transferirse, se conservaba el tiempo acumulado en `elapsedBefore` para preservar el histórico de esfuerzo invertido.

Sin embargo, esto provocaba una anomalía en las métricas de la nueva jornada:
1. **Falsa desviación inicial:** Si una tarea planificada en 30 min ya había consumido 45 min en jornadas previas (`elapsedBefore > planned`), el modelo híbrido de `computeDayDeviation` sumaba de inmediato esos 15 min como sobrecoste en tiempo real en `#headerStats` (`⏱ 45m / 30m [+15m]`). El usuario comenzaba una nueva jornada laboral con un indicador de retraso en rojo sin haber iniciado ninguna tarea en el día.
2. **Desincronización en "Tareas por hacer":** El chip `#headerStats` sumaba la estimación nominal `t.planned` de todas las tareas activas, ignorando el tiempo ya trabajado. Si a una tarea de 60 min le quedaban solo 20 min por realizar hoy, el resumen sumaba 60 min, desvirtuando el cálculo del "Tiempo no asignado" libre del día.
3. **Métrica de "Completado hoy":** Si una tarea con tiempo previo se completaba durante la jornada, se sumaba la duración total histórica en vez del esfuerzo efectivamente dedicado en el día actual.

## Alternativas Consideradas

* **Alternativa 1 (Re-estimación o reset del plan):** Resetear `elapsedBefore = 0` al mover la tarea y reajustar `planned` a los minutos restantes. Se descartó porque destruye la visibilidad del tiempo total invertido a lo largo del ciclo de vida de la tarea en la tarjeta del tablero.
* **Alternativa 2 (Exclusión pasiva de tareas pausadas):** Ocultar tareas pausadas en `computeDayDeviation` si no tenían actividad hoy. Se descartó porque en cuanto el usuario reanudaba o completaba la tarea hoy, se volvían a evaluar de golpe los minutos de días anteriores.
* **Alternativa 3 (Modelo multi-sesión con diccionario por fechas):** Crear `dailyElapsed: { [fecha]: minutos }`. Se descartó por sobredimensionar la complejidad del esquema plano actual (`DATA_SCHEMA.md`), obligando a migraciones de datos complejas en local y Firebase.
* **Alternativa 4 (Adoptada - Línea Base del Día `initialElapsed`):** Registrar la marca de agua del tiempo consumido al llegar al día (`initialElapsed = savedElapsed`) y aislar matemáticamente las métricas de la jornada actual respecto a dicha línea base.

## Decisión

Se implementó el modelo de **Línea Base del Día** mediante la propiedad `initialElapsed`:

### 1. Modelo de Datos (`Task.initialElapsed`)
* En `DATA_SCHEMA.md` y `js/state.js`, se incluye `initialElapsed?: number` (por defecto `0`).
* En `rolloverPendingTasks`, `moveTaskToDate` y `moveTasksToDate` en `js/actions/calendar.js`, al transferir una tarea al nuevo día se fija:
  $$\text{initialElapsed} = \text{savedElapsed}$$
* Las tareas creadas directamente en la jornada tienen `initialElapsed = 0`.

### 2. Aislamiento de la Desviación del Día (`computeDayDeviation`)
En `js/utils.js`:
* Se obtiene la línea base de la tarea: $\text{base} = \text{initialElapsed} \parallel 0$.
* **Planificación del día:** $\text{plDay} = \max(0, \text{planned} - \text{base})$.
* **Tiempo consumido en el día:** $\text{consumedDay} = \max(0, \text{consumedTotal} - \text{base})$.
* **Tareas en curso (`running` / `paused`):** Solo se evalúa sobrecoste si $\text{consumedDay} > \text{plDay}$. Al comenzar el día, $\text{consumedDay} = 0$, por lo que $0 > \text{plDay}$ es falso $\implies$ la desviación arranca estrictamente en 0 y con 0 tareas evaluadas.
* **Tareas completadas:** Desviación atribuible a la jornada = $\text{actDay} - \text{plDay}$ (siempre que $\text{actDay} > 0$ o $\text{plDay} > 0$, evitando ruido si se cierra administrativamente con 0 minutos hoy).

### 3. Ajuste de Estadísticas en el Panel Resumen (`#headerStats`)
En `js/views/dashboard.js`:
* **Tareas por hacer (`tasksTotal`):** Suma exactamente lo que falta realmente por realizar:
  $$\text{tasksTotal} = \sum_{t \in \text{activas}} \max(0, \text{planned}_t - \text{getTaskElapsed}(t))$$
  Alineado de forma idéntica con el motor del timeline en `scheduler.js`.
* **Completado hoy (`completedTotal`):** Suma exclusivamente los minutos invertidos durante la jornada en tareas completadas:
  $$\text{completedTotal} = \sum_{t \in \text{completadas}} \max(0, \text{actualDuration}_t - \text{initialElapsed}_t)$$

## Consecuencias

* **Positivas:**
  * Al iniciar cualquier nueva jornada, la desviación diaria arranca limpiamente en cero sin falsos sobrecostes heredados.
  * Se preserva íntegro el histórico total: la tarjeta del tablero, popovers y modales siguen mostrando el tiempo global invertido en la tarea.
  * El cálculo de "Tiempo no asignado" es exacto, ya que "Tareas por hacer" descuenta el trabajo que ya se completó en jornadas previas.
  * Total retrocompatibilidad: las tareas sin `initialElapsed` operan con base cero como hasta ahora.
