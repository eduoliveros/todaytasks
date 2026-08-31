# 004. Prevención de resurrección de tareas eliminadas mediante Tombstones en la sincronización

* **Fecha:** 2026-08-31
* **Estado:** Aceptado

## Contexto
En un entorno multidispositivo con sincronización mediante Firestore (`tableroDia/{uid}`):
1. El Dispositivo A eliminaba una tarea o reunión (`hard delete` del array local).
2. El Dispositivo A subía el estado actualizado a Firestore (sin el elemento).
3. El Dispositivo B (que aún conservaba el elemento en su copia local de `localStorage`) recibía el snapshot de Firestore o iniciaba un merge al detectar cambios concurrentes.
4. La función `mergeStates()` iteraba sobre los elementos locales y, al comprobar que no existían en el estado remoto, asumía erróneamente que eran *"nuevos elementos creados offline en el Dispositivo B"*, volviendo a añadirlos (`mTasks.push(t)`).
5. El Dispositivo B subía el estado combinado con la tarea resucitada a Firestore, reapareciendo en el Dispositivo A.

## Decisión
Se implementó un patrón de **Tombstones (lápidas de borrado)** ligero y desacoplado del flujo de renderizado visual:

1. **Estructura de Datos:**
   - En cada `DayState`: array `_deletedIds: string[]` que almacena los identificadores de tareas, reuniones e interrupciones eliminadas deliberadamente en ese día.
   - En cada `EnvState`: array `_deletedRecurringIds: string[]` para registrar identificadores de reglas periódicas de tareas/reuniones eliminadas.
   - Estos arrays se inicializan y validan de forma transparente en `defaultDayState()`, `defaultEnvState()` y `wrapState()`.

2. **Acciones de Eliminación:**
   - `deleteTask()`, `deleteRecurringTaskInstance()`, `deleteRecurringTaskSeries()`
   - `deleteMeeting()`, `deleteMeetingInstance()`, `deleteMeetingSeries()`
   - `startNewDay()`
   Al eliminar un elemento, además de excluirlo de la colección activa, su ID se registra en el array `_deletedIds` del día (o `_deletedRecurringIds` del entorno).

3. **Resolución de Conflictos en `mergeStates()`:**
   - Se recolectan todos los tombstones locales y remotos (`allRemoteDeletedIds`, `allLocalDeletedIds`, `allRemoteDeletedRecurringIds`, `allLocalDeletedRecurringIds`).
   - Al combinar tareas, reuniones, interrupciones o reglas periódicas:
     - Ningún elemento remoto se incorpora si su ID está en los tombstones locales.
     - Ningún elemento local se incorpora si su ID está en los tombstones remotos.
   - Los conjuntos de `_deletedIds` y `_deletedRecurringIds` se unifican bidireccionalmente para propagar las lápidas a todos los dispositivos conectados.

4. **Ciclo de Vida y Limpieza (*Garbage Collection*):**
   - Los tombstones dentro de `DayState._deletedIds` se eliminan de forma natural y automática a través del mecanismo de poda (*pruning*) existente en `snapshotAndPrune()`, el cual descarta días con más de 10 días de antigüedad sin saturar el almacenamiento de `localStorage` ni los documentos de Firestore.

## Consecuencias
* **Positivas:**
  - Se elimina el 100% de las resurrecciones de tareas y reuniones borradas entre múltiples dispositivos.
  - Soporta creación de tareas offline y borrado offline simultáneo sin pérdida de datos ni falsos positivos.
  - No requiere alterar la lógica de renderizado ni los filtros de UI, ya que los elementos activos siguen siendo arrays limpios.
  - La limpieza periódica automática evita crecimiento indefinido del payload JSON.
* **Negativas / Compensaciones:**
  - Requiere asegurar que cualquier nueva acción de borrado registre explícitamente el ID en `_deletedIds`.
