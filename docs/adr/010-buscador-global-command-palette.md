# 010. Buscador Global de Tareas y Command Palette (Ctrl+K)

* **Fecha:** 2026-09-04
* **Estado:** Aceptado

## Contexto
En versiones anteriores a la v1.101, TodayTasks solo permitía buscar tareas correspondientes al día seleccionado actualmente (`state.selectedDate`). Cuando los usuarios necesitaban localizar una tarea programada para los próximos días, revisar una tarea completada ayer o días atrás, o consultar una regla de tarea recurrente, debían navegar manualmente por el selector de fechas día a día.

Se planteó la necesidad de implementar un buscador global de tareas que permitiera consultar, filtrar y gestionar tareas a través de múltiples fechas, manteniendo el rendimiento instantáneo y sin romper el flujo de trabajo diario ni el modelo de datos.

## Alternativas Consideradas
1. **Opción 1: Command Palette Modal (`Ctrl+K` / `Cmd+K`) [Seleccionada]:**
   - Modal flotante tipo Spotlight / Raycast accesible desde cualquier pantalla mediante un atajo universal o botón en la cabecera.
   - Resultados agrupados jerárquicamente por cercanía temporal (Hoy, Próximos días, Días anteriores, Recurrentes).
   - Acciones directas por fila ("Ir a fecha ↗", "Mover a Hoy ⏩", "Reabrir en Hoy ↺", "Editar serie ✎").
   - Navegación ágil con teclado (<kbd>↑</kbd> / <kbd>↓</kbd> / <kbd>Enter</kbd> / <kbd>Esc</kbd> / <kbd>Tab</kbd>).
2. **Opción 2: Vista Dedicada (`#/search`):**
   - Página completa en el router SPA similar a Triaje (`#/triage`) o Histórico (`#/history`) con filtros avanzados y selección masiva.
   - Descartada como interacción primaria porque obliga al usuario a abandonar su jornada de trabajo actual para consultas rápidas.
3. **Opción 3: Buscador Dual In-Place en la Barra Lateral:**
   - Conmutador de ámbito en `#taskSearchBar` entre "Este día" y "Global".
   - Descartada porque el espacio de la columna lateral resulta estrecho para desglosar tareas de múltiples fechas y acciones contextuales simultáneamente.

## Decisión
Se implementó la **Opción 1: Command Palette (`Ctrl+K`)** combinada con un motor de búsqueda multidía desacoplado:

1. **Motor de Búsqueda Puro (`searchAllTasks` en `js/utils.js`):**
   - Consulta el estado en memoria: los días retenidos en `env.days` (últimos 10 días pasados + día actual + todos los días futuros configurados) y las plantillas maestras en `env.recurringTasks`.
   - Reutiliza la función de tokenización no posicional `matchesTaskSearch` insensible a mayúsculas y acentos.
   - Añade indexación de fechas relativas ("ayer", "hoy", "mañana", días de la semana) y filtro de estado/recurrencia.
   - Soporte para acotar la búsqueda al entorno activo (`work` o `personal`) o buscar en ambos (`bothEnvs`).
2. **Componente Desacoplado (`js/app/command-palette.js`):**
   - Gestiona el ciclo de vida del modal (`openCommandPalette`, `closeCommandPalette`), navegación por teclado, chips de filtro rápido y selección.
   - Enlace directo con `actionsModule.selectDate()` y `actionsModule.moveTaskToDate()`.
   - Resaltado visual interactivo de la tarjeta destino mediante la animación `.task-focus-pulse`.
3. **Atajo Global e Integración en Cabecera:**
   - Captura prioritaria de <kbd>Ctrl+K</kbd> y <kbd>Cmd+K</kbd> en `js/app/shortcuts.js`.
   - Botón directo `🔍 Buscar [Ctrl+K]` en la barra superior de navegación.
   - Documentación del atajo en la ayuda modal (<kbd>?</kbd>).
4. **Internacionalización Integral:**
   - Claves añadidas con 100% de paridad en `js/i18n/es.js` y `js/i18n/en.js`.

## Consecuencias
* **Positivas:**
  - Localización inmediata de cualquier tarea en milisegundos sin cambiar de contexto ni interrumpir la tarea en curso.
  - Capacidad de trasladar tareas pasadas o futuras al día de hoy en un solo clic.
  - Cero dependencias externas y ejecución ultrarrápida (< 2 ms) en JavaScript Vanilla.
* **Negativas / Consideraciones:**
  - La búsqueda histórica está acotada a la retención de 10 días detallados configurada en `snapshotAndPrune()`. Las tareas completadas con más de 10 días de antigüedad no son recuperables a nivel individual ya que se consolidan en métricas agregadas en `env.history`.
