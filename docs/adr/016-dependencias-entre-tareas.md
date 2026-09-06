# 016. Dependencias Direccionales entre Tareas (`dependsOn`), Detección de Ciclos y Desbloqueo Suave

* **Fecha:** 2026-09-06
* **Estado:** Aceptado

## Contexto
En la gestión diaria de flujos de trabajo en TodayTasks, es frecuente que ciertas tareas dependan críticamente de la finalización de otras (por ejemplo, *"Desplegar a producción"* depende de *"Pasar suite de pruebas"* y *"Aprobar PR"*). Estas tareas predecesoras pueden estar planificadas en el mismo día o haber sido programadas en días anteriores o futuros.

Hasta la versión 1.106, TodayTasks carecía de un mecanismo explícito para vincular tareas predecesoras. El usuario dependía únicamente de la ordenación manual o de notas de texto. Además, era fundamental que la solución cumpliera las siguientes condiciones clave:
1. **Búsqueda multidía:** Capacidad de seleccionar como predecesora cualquier tarea del entorno activo, aprovechando el buscador multidía y los identificadores públicos (`W-1`, `P-1`).
2. **Paridad total:** Funcionalidad disponible tanto en la ventana principal (formulario lateral con opciones avanzadas y edición inline en tarjeta) como en la vista de Triaje (`#/triage`) en el modal `#triageTaskEditModal` (para nuevas tareas y edición existente).
3. **Integridad del grafo:** Detección y prevención estricta de dependencias circulares (ciclos A ➔ B ➔ A).
4. **Respeto en el planificador:** El algoritmo de cálculo de horarios (`scheduler.js`) no debe colocar una tarea dependiente antes de que termine su predecesora en la misma jornada, y debe demorar o desbordar la tarea si el predecesor está incompleto.
5. **Ejecución no destructiva (Soft-Blocking):** El botón de inicio (Play) no debe ser un botón inerte. Si el usuario intenta arrancar una tarea bloqueada, la aplicación debe informar con claridad sobre las tareas bloqueantes pendientes y ofrecer dos caminos: navegar a la tarea bloqueante o forzar el inicio de todos modos.

## Decisión

Se diseñó e implementó un subsistema modular de dependencias direccionales:

### 1. Modelo de Datos (`Task.dependsOn`)
* En `state.js` y `DATA_SCHEMA.md`, cada tarea incluye `dependsOn?: string[]`, que almacena los `id` técnicos únicos de las tareas de las que depende directamente.
* La función `wrapState()` normaliza la propiedad como un array inmutable de strings y descarta auto-dependencias (`depId !== task.id`).
* Se almacena el `id` técnico (UUID) para garantizar la integridad referencial incluso si el título de la predecesora cambia o se traslada entre fechas.

### 2. Detección y Prevención de Ciclos (`checkCircularDependency`)
* En `js/utils.js`, se implementó `checkCircularDependency(sourceTaskId, targetTaskId, env)` mediante búsqueda en profundidad (DFS) con detección de visitados.
* Al seleccionar una dependencia en el selector modal (`#dependencySelectorModal`), la UI desactiva visualmente y bloquea el clic en cualquier tarea que cerraría un ciclo hacia la tarea en edición, impidiendo la creación de grafos no dirigidos o circulares.

### 3. Selector Modal Multidía (`#dependencySelectorModal`)
* Se creó el módulo `js/app/dependencies.js` que gestiona el selector modal integrado con `searchAllTasks()` de `js/utils.js`.
* Permite buscar en tiempo real por identificador visible (`W-1`), texto o tags, mostrando el estado actual de cada tarea (`pending`, `running`, `completed`) y la fecha donde está planificada.
* Muestra claramente las tareas ya añadidas y resalta el estado bloqueado/desbloqueado con chips semánticos.

### 4. Paridad de Interfaz (Tablero Principal y Triaje)
* **Formulario de creación principal (`index.html`):** Sección *"Depende de"* dentro de *⚙️ Opciones avanzadas* (`#taskAdvancedOptionsWrap`) con un indicador dinámico de candado 🔒 en `#formDependenciesBadge` cuando hay dependencias configuradas.
* **Modal unificado de triaje (`#triageTaskEditModal`):** Fila de dependencias (`.task-form-dependencies-row`) con botón `+ Añadir dependencia` y lista de chips interactivos tanto al crear una nueva tarea (`id: '__new__'`) como al editar una existente.
* **Edición inline en tarjeta (`renderTaskItemEdit`):** Misma fila de selección de dependencias accesible al editar directamente en el tablero.

### 5. Algoritmo de Planificación (`scheduler.js`)
* En `computeSchedule()`, las tareas pendientes cuyos predecesores directos sigan incompletos en el entorno no se colocan en el horario antes de que finalicen sus bloqueadores.
* Si el bloqueador está en el mismo día, la tarea dependiente se programa tras la hora proyectada de fin del bloqueador. Si el bloqueador está en otra fecha o no hay hueco suficiente, se marca como desbordada (`overflowIds`).

### 6. Desbloqueo Suave (*Soft-Blocking*) en la Ejecución
* Cuando una tarea tiene bloqueadores incompletos:
  - La tarjeta visual muestra la insignia `.task-dep-badge.blocked` con el candado 🔒 y el recuento de bloqueadores pendientes.
  - El botón de inicio muestra el icono 🔒.
* Al hacer clic en iniciar una tarea bloqueada, se abre el modal `#blockedTaskConfirmModal`:
  - Enumera las tareas bloqueantes con su `displayId`, título y fecha.
  - Ofrece el botón *"Ir a la tarea"* (`app.goToTask(blocker.id, blocker.dateStr)`), que traslada al usuario automáticamente al día y hace foco en la tarjeta con animación de pulso.
  - Ofrece el botón *"Iniciar de todos modos"*, invocando `actionsModule.startTask(taskId, { force: true })` para permitir flexibilidad humana ante imprevistos del mundo real.

## Consecuencias

* **Positivas:**
  - Coordinación estricta de flujos de trabajo secuenciales entre distintas fechas y entornos.
  - Experiencia de usuario coherente y sin fisuras: idéntica capacidad de gestión en el tablero diario y en la vista de triaje rápido.
  - Prevención matemática de bloqueos mutuos y recursiones infinitas mediante DFS.
  - El usuario siempre mantiene el control final: el sistema asiste y advierte, pero no imposibilita forzar el inicio si es necesario.
* **Compensaciones:**
  - Si una tarea predecesora es eliminada, su ID queda huérfano en `dependsOn`; las funciones utilitarias `isTaskBlocked` y `getTaskBlockingDetails` lo gestionan defensivamente considerando completadas o descartadas las referencias inexistentes.
