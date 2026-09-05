# 013. Identificadores Visibles de Tarea (W-1, P-1), Copiado Rápido y Búsqueda

* **Fecha:** 2026-09-06
* **Estado:** Aceptado
* **Versión:** v1.104
* **Relacionado con:** Entidad Task, EnvState, Tablero Principal, Vista de Triaje, Buscador Local y Global (Ctrl+K)

---

## Contexto

Los usuarios necesitan referenciar tareas diarias en sistemas y herramientas externas (mensajes de Slack, commits de Git como `W-1: corrección auth`, tickets de Jira, notas en Notion u Obsidian) sin fricción.

Hasta la versión 1.103, TodayTasks utilizaba únicamente UUIDs generados internamente (`crypto.randomUUID()`). Si bien los UUIDs garantizan unicidad técnica sin colisiones, no son legibles ni memorables para los humanos, ni viables para ser tecleados o comunicados verbalmente.

Se requería un identificador visible que cumpliera con los siguientes requisitos:
1. Formato amigable y diferenciado por entorno (`W-1`, `W-2` para Trabajo y `P-1`, `P-2` para Personal).
2. Dos modalidades de copiado al portapapeles instantáneo:
   * Clic en el badge del ID: copia **exclusivamente el identificador** (`W-1`).
   * Clic en el botón de copia rápida a la derecha de la tarea: copia el **identificador con la descripción** (`W-1 <título>`, ej: `P-1 Pedir cita para médico`).
3. Disponibilidad tanto en la lista principal del tablero como en la vista de **Triaje** (`#/triage`).
4. Capacidad de búsqueda instantánea tanto en el filtro local del día (`/`) como en el buscador global multientorno (<kbd>Ctrl+K</kbd>).
5. Compatibilidad total hacia atrás con tareas preexistentes y estabilidad frente a sincronización offline-first.

---

## Opciones Evaluadas

1. **Sustituir el ID técnico UUID por un contador secuencial global:**
   * *Descartado:* Rompería la estabilidad de referencias internas y aumentaría el riesgo de colisiones concurrentes en sincronización multi-dispositivo offline con Firestore.
2. **Hash alfanumérico corto (ej. `tt-7k3b`):**
   * *Descartado:* Aunque descentralizado, es menos intuitivo y legible que la numeración secuencial familiar estilo Jira/Linear (`W-1`, `P-1`).
3. **Desacoplamiento: Mantener UUID técnico + Añadir `displayId` secuencial por entorno (Elegida):**
   * Se preserva `task.id` con UUID para la integridad de datos, relaciones de sync y tombstones.
   * Se introduce `displayId?: string` en `Task` y un contador persistente `nextTaskSeq: number` en `EnvState`.
   * Permite migración automática retrocompatible en `wrapState` para tareas existentes.

---

## Decisión

Se adopta la **Opción 3**:

1. **Modelo de Datos:**
   * En `EnvState`: se incorpora `nextTaskSeq: number` (iniciado en `1` de forma independiente para `work` y `personal`).
   * En `Task`: se añade `displayId?: string` (`"W-1"`, `"P-1"`, etc.).
   * En `wrapState`: si se cargan tareas sin `displayId`, se les asigna de forma retroactiva y se sincroniza el contador con el valor superior más alto.
2. **Generación e Inmutabilidad:**
   * La función pura `assignNextTaskDisplayId(env, envKey)` gestiona el avance del contador.
   * Se asigna al crear una tarea (`addTask`), materializar recurrentes (`materializeRecurringTasks`) o copiarla a otra fecha (`copyTaskToDate`).
   * Al mover tareas entre fechas (`moveTaskToDate` o `autoMoveToToday`), el `displayId` permanece inmutable.
3. **Interfaz de Usuario y Copiado:**
   * **Badge en título (`.task-id-badge`):** Diseñado con tipografía monoespaciada (`IBM Plex Mono`), esquinas redondeadas y contraste accesible en temas claro y oscuro. Al pulsar, copia solo el ID (`W-1`) y muestra `✓ ¡Copiado!` in-situ.
   * **Botón de copia rápida (`.copy-ref-btn` / `.triage-copy-btn`):** Situado a la derecha de la tarjeta/fila con icono SVG dual. Al pulsar, copia `"${task.displayId} ${task.title}"` con notificación toast.
   * Implementado con total paridad tanto en el tablero diario como en cada fila de triaje rápido.
4. **Búsqueda e Indexación:**
   * `getTaskSearchableText()` indexa automáticamente `task.displayId` en mayúsculas, minúsculas y número directo (`#1`, `1`).
   * La paleta de comandos global (`command-palette.js`, <kbd>Ctrl+K</kbd>) localiza tareas por su ID y renderiza el badge en los resultados.
5. **Resolución de Conflictos en Sincronización Offline (`mergeStates`):**
   * En caso de que un dispositivo cree una tarea offline (ej: `W-1`) y en la nube ya exista otra tarea creada concurrentemente con `W-1`:
   * El estado de la nube (`remoteEnv`) es canónico: las tareas remotas retienen su `displayId`.
   * La tarea creada offline conserva su UUID único (`task.id`), pero su `displayId` se reasigna dinámicamente al siguiente número disponible (`W-2`).
   * El contador `nextTaskSeq` del entorno fusionado se recalcula automáticamente superando el valor máximo detectado.

---

## Consecuencias

* **Positivas:**
  * Referenciación inmediata y profesional de tareas en commits de Git, PRs, Slack y notas personales.
  * Máxima ergonomía de copiado con un solo clic con feedback visual claro.
  * Compatibilidad 100% con datos preexistentes y cero dependencias externas.
  * Rendimiento óptimo en búsquedas locales y globales.
  * Sincronización robusta en la nube: resolución determinista de colisiones offline donde las tareas de la nube prevalecen y las tareas offline se reasignan sin perder información.
* **Compensaciones:**
  * Cada entorno mantiene su propia secuencia (`W-` y `P-`), lo cual aísla el contexto laboral del personal de forma deliberada y ordenada.
