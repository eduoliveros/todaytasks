# 001. Planificación de tareas a partir de una hora determinada (`startAfter`)

* **Fecha:** 2026-08-30
* **Estado:** Aceptado

## Contexto
Los usuarios necesitan a menudo programar tareas que no pueden realizarse a primera hora de la mañana sino a partir de una hora concreta (por ejemplo, llamadas a clientes disponibles solo por la tarde, despliegues nocturnos o tareas dependientes de eventos previos).

Hasta ahora, TodayTasks ordenaba todas las tareas pendientes de forma puramente secuencial según su prioridad u orden ordinal (`order`), rellenando huecos continuos de trabajo sin soporte para restricciones temporales mínimas de inicio.

## Decisión
1. **Modelo de datos:**
   - Se añade la propiedad opcional `startAfter?: number | null` a la entidad `Task` (y opcionalmente `RecurringTaskRule`), representando el minuto del día (`0..1439`, por ejemplo `960` para las `16:00`).
   - Si es `null` o `undefined`, la tarea no tiene restricción de inicio.

2. **Algoritmo de planificación (`scheduler.js` - Relleno inteligente de huecos):**
   - El planificador evalúa en cada posición temporal (`cursor`) las tareas pendientes elegibles (`t.startAfter == null || t.startAfter <= cursor`).
   - Si la tarea con mayor prioridad tiene una hora mínima futura, el planificador no bloquea la mañana: adelanta las tareas sin restricción para ocupar el tiempo libre disponible, y planifica la tarea diferida una vez alcanzada su hora mínima (o al terminar la tarea que estuviera en curso en ese momento).
   - Si no hay tareas elegibles en el cursor actual, el planificador avanza el cursor a la menor hora `startAfter` de las tareas restantes.

3. **Interfaz de usuario (UX):**
   - **Chip compacto interactivo en la tarjeta:** Se muestra una píldora compacta `⏰ HH:MM+` (ej. `⏰ 16:00+ ▾`) en la tarjeta de la tarea.
   - **Popover rápido:** Al hacer clic en el chip o en el botón de reloj `⏰` de la tarjeta, se despliega un popover flotante ligero con selector `type="time"` y botones *"Quitar"* y *"Listo"*, permitiendo asignar o quitar la restricción en 1 clic sin entrar en edición completa.
   - **Edición completa:** El campo `A partir de: [HH:MM]` también está disponible en el formulario inline de edición de la tarea.

## Consecuencias
* **Positivas:**
  - Gran flexibilidad de planificación diaria sin generar huecos muertos innecesarios.
  - Notación ultracompacta (`16:00+`) que no satura la interfaz visual de las tarjetas.
  - Compatible con el sistema de deshacer/rehacer (*undo/redo*), persistencia en `localStorage` y sincronización en la nube.
* **Negativas / Compensaciones:**
  - Requiere que el planificador evalúe elegibilidad en lugar de consumir la cola en orden estrictamente estático, pero la complejidad algorítmica sigue siendo despreciable (\(O(N^2)\) sobre un conjunto pequeño de \(N < 50\) tareas diarias).
