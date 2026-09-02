# 007. Vista de Triaje Rápido de Tareas (`#/triage`) y Operaciones por Lote

* **Fecha:** 2026-09-02
* **Estado:** Aceptado

## Contexto
Cuando un usuario acumula un número elevado de tareas en la cola del día (por ejemplo, 25 o más), la vista habitual del tablero presenta sobrecarga cognitiva y fricción para reordenar, reprogramar o descartar elementos masivamente.
Las necesidades clave identificadas para abordar esta situación fueron:
1. Disponer de una vista dedicada y enfocada, accesible de forma inmediata con un atajo ágil (`X` o botón en la cabecera de Tareas).
2. Capacidad de visualizar y agrupar tareas por múltiples criterios operativos:
   - **Urgencia** (Hoy, Próximos días, Esta semana, Más adelante).
   - **Viabilidad** (Caben en la jornada de hoy vs. Desbordan / Overflow).
   - **Duración** (Quick Wins ≤ 15m, Medias 20-45m, Largas > 45m).
   - **Destacadas** (Top 5 favoritas vs. resto).
3. Ordenación consistente con la cola de ejecución: las tareas se listan en el mismo orden que en la pantalla principal (`a.order - b.order`), otorgando máxima prioridad a la ordenación manual establecida por el usuario e incorporando manijas de arrastre táctiles/visuales (`⠿`) para reordenar directamente con drag & drop.
4. Agilidad individual: en cada fila de tarea, permitir cambiar fecha rápidamente (botones para los 5 próximos días laborables), urgencia, destacar y borrar sin necesidad de abrir modales complejos ni marcar checkboxes.
5. Operaciones masivas (por lote): selección múltiple de tareas (individual o por grupo completo) y barra flotante de acciones para mover a cualquiera de los próximos 7 días laborables, cambiar urgencia, destacar o eliminar de una vez.
6. Respeto al horario laboral semanal (`weeklySchedule`): los botones de salto rápido a fechas deben omitir automáticamente los días libres (fines de semana o días configurados como libres).
7. Capacidad de colapso y despliegue de grupos para evitar la fatiga visual.

## Decisión
Se implementó una arquitectura modular desacoplada:

1. **Ruta SPA y Módulo de Vista (`js/views/triage.js`):**
   - Se registró la ruta hash `#/triage` en `TodayTasksRouter` (`js/router.js`).
   - Se añadió el atajo global de teclado `X` para alternar entre el tablero principal y la vista de triaje, y soporte para `Esc` para salir o cerrar popovers.
   - El contenedor `#view-triage` se presenta a pantalla completa sin elementos distractores (sin recuadros de ayuda invasivos).
   - Ordenación: Mantiene el orden manual de la pantalla principal (`a.order - b.order`, con estado `running` en primera posición), con manija de arrastre (`⠿`) en cada fila y soporte completo de drag & drop reactivo.

2. **Cálculo de Días Laborables Dinámicos (`getNextWorkingDays` en `js/utils.js`):**
   - Función pura que calcula los próximos $N$ días hábiles a partir de la fecha de referencia utilizando la configuración de `weeklySchedule` del entorno activo.
   - Excluye días marcados con `isFreeDay: true` (por ejemplo sábados y domingos por defecto en Trabajo, o configuraciones personalizadas).

3. **Operaciones Masivas y Mutaciones de Estado (`js/actions/calendar.js` y `js/actions/tasks.js`):**
   - `moveTaskToDate(taskId, targetDateStr)` y `moveTasksToDate(taskIds, targetDateStr)`: extraen tareas del día activo y las insertan en el día destino preservando el orden relativo y reseteando cronómetros.
   - `setTasksUrgency(taskIds, urgency)`: actualiza la urgencia de múltiples tareas y reordena la cola del día.
   - `setTasksFeatured(taskIds, featured)`: actualiza el estado de destacado respetando el límite máximo de 5 tareas destacadas concurrentes.
   - `deleteTasks(taskIds)`: elimina el lote de tareas y genera las lápidas `_deletedIds` necesarias para la sincronización con Firestore.
   - Todas las operaciones registran instantáneas transaccionales en `undoModule` para permitir deshacer con `Ctrl+Z`.

4. **Diseño de Interfaz Compacto y Eficiente (`css/triage.css`):**
   - Cada tarea se muestra en una única fila horizontal con truncado elíptico del título (`text-overflow: ellipsis; white-space: nowrap;`) y duración visible junto al nombre.
   - En la cabecera de cada grupo, el icono chevron desplegable `[ ▾ ]` se ubica a la izquierda del checkbox maestro para una navegación intuitiva.
   - Barra flotante inferior `#triageFloatingBar` fija con animación que aparece reactivamente solo cuando hay tareas seleccionadas.

## Consecuencias
* **Positivas:**
  - Despeja cuellos de botella cuando se acumulan decenas de tareas.
  - Interacción extremadamente rápida (1 clic para mover a mañana o cualquier día de la próxima semana).
  - Pleno soporte con el sistema de Undo/Redo y sincronización en la nube.
  - Diseño responsive adaptable a pantallas pequeñas.
* **Negativas / Compensaciones:**
  - Añade un nuevo módulo de vista y estilos específicos que deben mantenerse sincronizados con los temas claro y oscuro.
