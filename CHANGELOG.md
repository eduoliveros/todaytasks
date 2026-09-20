# Registro de Cambios (CHANGELOG)

Todos los cambios notables en **TodayTasks** se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [1.116] - 2026-09-20

### Añadido
- **Restricciones de Ordenación en Drag & Drop (Dependencias y `startAfter`):**
  - **Invariante de Dependencias (`dependsOn`):** Una tarea dependiente no puede colocarse por delante de su tarea bloqueadora en la cola del día, ni una tarea bloqueadora por detrás de sus tareas dependientes.
  - **Invariante de Hora de Inicio (`startAfter`):** Una tarea con hora fijada no puede preceder a otra con hora programada posterior. Las tareas sin hora no sufren restricciones y pueden intercalarse libremente según la prioridad del usuario.
  - **Feedback Visual en Tiempo Real (`.drag-forbidden`):** Durante el arrastre de tareas (tanto en escritorio como en móvil por pulsación táctil prolongada), los destinos no permitidos se iluminan con la clase `.drag-forbidden` (borde discontinuo rojo/ámbar y cursor de prohibido) para comunicar la invalidez antes de soltar.
  - **Auto-corrección Inteligente al Soltar:** Si el usuario suelta en una posición no permitida, el sistema ubica automáticamente la tarea en la primera posición válida respetando la intención del usuario y muestra un aviso contextual (*toast*) explicativo.
  - **Coherencia Total:** Comportamiento idéntico en el tablero principal y en la vista de Triaje rápido (`#/triage`), tanto para arrastres individuales como para arrastre y desplazamiento en bloque de multiselección.
  - **Documentación y Pruebas:**
    - Nueva suite de pruebas unitarias: `tests/dragdrop_constraints.test.js`.
    - Registro de Decisión de Arquitectura: [ADR 023](docs/adr/023-restricciones-ordenacion-dragdrop-dependencias-startafter.md) y actualización de `docs/ARCHITECTURE.md`.

## [1.115] - 2026-09-20

### Añadido
- **Triaje Móvil Compacto y Unificación con Bottom Sheet (`triage.js`, `triage.css`, `task-detail-sheet.js`):**
  - **Filas de Triaje Compactas en Móvil ($\le$ 640px):** En pantallas pequeñas, se ocultan los botones redundantes del lado derecho (`.triage-quick-days-wrap`, `.triage-copy-btn`, `.triage-complete-btn`, `.triage-delete-btn`) y el rango horario en la fila, otorgando todo el ancho disponible al título con truncado elíptico limpio. En el botón de urgencia se mantiene únicamente el icono para minimizar espacio horizontal (~28px).
  - **Interacción Móvil en Triaje (Tap $\to$ Detalle y Acciones):** Al pulsar el cuerpo de una fila de triaje en móvil, ya no se marca/selecciona la tarea accidentalmente, sino que se despliega directamente el *Bottom Sheet* unificado (`#taskDetailSheet`) con toda la información, notas, dependencias y botones de acción.
  - **Selección Múltiple Móvil con Checkbox:** Para seleccionar/marcar tareas en lote en móvil, se utiliza el selector de casilla de verificación explícito (`.triage-task-cb`), preservando la barra flotante de acciones masivas sin interferir con la navegación táctil.
  - **Sección de Reordenación y Posición en Bottom Sheet:** Se integraron botones táctiles (`⤒ Inicio`, `▲ Subir`, `▼ Bajar`, `⤓ Fin`) para reordenar tareas en la cola sin requerir arrastre manual en pantallas táctiles reducidas, con aviso de seguridad cuando la tarea está en curso activo.
  - **Sección de Reprogramación Rápida a Días Laborables:** Se agregaron fichas (*chips*) con los próximos 5 días hábiles en el *Bottom Sheet* para trasladar tareas de fecha con un solo toque desde cualquier vista.
  - **Cero Regresiones en Escritorio:** La vista de triaje en ordenadores de escritorio (> 640px) preserva sus 5 botones rápidos de fecha, botones directos de acción y selección rápida de filas por clic simple y edición por doble clic.

## [1.114] - 2026-09-20

### Añadido
- **Vista Móvil Compacta y Bottom Sheet de Detalle de Tareas (`task-detail-sheet.js`, `layout.css`):**
  - **Tarjetas Compactas en Móvil ($\le$ 640px):** En pantallas estrechas, las tarjetas de tareas activas y completadas se sintetizan visualmente, mostrando de forma limpia el indicador lateral de estado y el título con truncado automático (`text-overflow: ellipsis`), eliminando la sobrecarga de pastillas y botones en la lista.
  - **Bottom Sheet de Detalle y Acciones (`#taskDetailSheet`):** Al tocar cualquier tarjeta en móvil, se despliega una hoja inferior táctil animada (`taskDetailSlideUp`) con:
    - Identificador visible (`[W-1]`), título íntegro y estrella de destacada.
    - Fila de pastillas completas: nivel de urgencia, estado (en curso, en pausa, pendiente, completada), repetición recurrente, inicio condicional `startAfter` y rango de horario en tiempo real.
    - Desglose de tiempo planificado vs. tiempo real consumido.
    - Bloque de notas con formato Markdown y enlaces web interactivos.
    - Indicador de dependencias bloqueadoras pendientes en tareas con bloqueos.
    - Botonera táctil con altura accesible ($\ge$ 44px) adaptada al estado: Iniciar, Pausar, Reanudar, Completar, Reabrir, Editar, Destacar, Copiar referencia y Eliminar.
  - **Accesibilidad y Atajos:** Soporte de cierre mediante pulsación en el fondo (*backdrop*), botón `✕` superior, selección de acción o tecla <kbd>Esc</kbd>.
  - **Cero Regresiones en Escritorio:** Las tarjetas de tareas en ordenadores de escritorio (> 640px) mantienen íntegro su diseño y controles directos.
  - **Pruebas y Documentación:**
    - Pruebas unitarias: `tests/task_detail_sheet.test.js` y `tests/mobile_compact_tasks.test.js`.
    - Pruebas E2E: `e2e/tasks.spec.js`.
    - Registro de Decisión de Arquitectura: [ADR 021](docs/adr/021-vista-movil-compacta-bottom-sheet.md) y actualización de `docs/ARCHITECTURE.md`.

## [1.113] - 2026-09-19

### Cambiado
- **Simplificación del rango horario de tareas en la ventana principal:**
  - Se eliminaron las etiquetas textuales redundantes ("EST. START" y "EST. END" / "Inicio prev." y "Fin prev.") en la lista de tareas activas (`#tasksList`) y en la lista de tareas pendientes de la agenda (`#pendingList`).
  - Ahora se muestra exclusivamente el formato conciso `HH:mm → HH:mm` para un diseño más limpio y legible.

## [1.112] - 2026-09-12

### Añadido
- **Resiliencia de Sincronización en la Nube ante el Ciclo de Vida Móvil (`cloud.js`):**
  - **Descarga Inmediata al Suspender (`visibilitychange: hidden`):** Al bloquear la pantalla o cambiar de aplicación en dispositivos móviles, cualquier escritura o cambio retenido en el temporizador de *debounce* (`pushDebounceTimer`) se descarga y envía de inmediato a Firestore (`flushPendingCloudPush`) antes de que el proceso sea congelado por el sistema operativo.
  - **Reanudación y Despertar de Conexión (`visibilitychange: visible` y `focus`):** Al volver a la aplicación o desbloquear el móvil, se ejecuta `resumeSync()` para invocar `fbDb.enableNetwork()` de Firestore de forma defensiva, evitando conexiones latentes o zombis (*half-open sockets*), descargando cualquier dato pendiente y recuperando el estado de conexión si estaba en error.
  - **Reconexión Automática ante Recuperación de Cobertura (`window.online`):** Reactiva inmediatamente la red de Firestore y sincroniza datos acumulados tras caídas temporales de WiFi o cobertura móvil.
  - **Exposición en API Pública (`window.app`):** Se exponen `app.resumeSync()` y `app.flushPendingCloudPush()` para permitir la reanudación y descarga manuales desde la consola o atajos de desarrollo.
- **Documentación y Pruebas:**
  - Nueva suite de pruebas unitarias: `tests/cloud_lifecycle.test.js` (5 tests).
  - Registro de Decisión de Arquitectura: [ADR 020](docs/adr/020-resiliencia-sincronizacion-ciclo-de-vida-movil.md).

## [1.111] - 2026-09-09

### Añadido
- **Reordenación y Movimiento en Bloque de Tareas Multiseleccionadas en Triaje (`#/triage`):**
  - **Drag & Drop Masivo (Escritorio y Táctil):** Al seleccionar múltiples tareas y arrastrar una de ellas, todo el grupo seleccionado se mueve junto en bloque respetando estrictamente su orden relativo original (`order`).
    - Si se suelta sobre una tarea no seleccionada: al arrastrar hacia abajo se ubica tras la tarea destino; al arrastrar hacia arriba se ubica en su posición desplazándola hacia abajo.
    - Si se suelta sobre una tarea que forma parte de la propia selección: todas las tareas seleccionadas se agrupan contiguamente alrededor de la tarea objetivo.
    - Si se arrastra una tarea no seleccionada: solo se mueve dicha tarea, sin afectar a la selección ni a las tareas seleccionadas.
    - Feedback visual reactivo: todas las tareas seleccionadas se marcan con `.dragging` durante el arrastre.
    - Persistencia: las tareas se mantienen seleccionadas tras reordenar para permitir encadenar operaciones sucesivas.
  - **Controles de Posición en la Barra Flotante Masiva (`#triageFloatingBar`):**
    - Grupo de botones de movimiento directo de posición: **⤒ Inicio**, **▲ Subir**, **▼ Bajar** y **⤓ Fin**.
    - Permiten desplazar todo el bloque seleccionado de forma accesible tanto con ratón como en pantallas táctiles.
  - **Bottom Sheet Móvil con Soporte Multiselección:**
    - Al abrir la hoja inferior de movimiento táctil sobre una tarea seleccionada, se indica el recuento de tareas (`+X seleccionadas`) y las acciones de dirección (Subir, Bajar, Al inicio, Al final) mueven el conjunto completo.
  - **Mover Fecha Masivo desde Botones Rápidos por Fila:**
    - Al pulsar uno de los 5 botones rápidos de día (`[HOY]`, `[MAÑ]`, etc.) en una tarea seleccionada, todas las tareas seleccionadas se mueven juntas a la fecha elegida.
- **Documentación y Pruebas:**
  - Nueva suite de pruebas unitarias: `tests/triage_multiselect_move.test.js` (12 tests).
  - Registro de Decisión de Arquitectura: [ADR 019](docs/adr/019-triaje-reordenacion-masiva-bloque-seleccionado.md).

## [1.110] - 2026-09-09

### Añadido
- **Búsqueda de Tareas en Vista de Triaje (`#/triage`):**
  - Barra de búsqueda (`#triageSearchBar`, `#triageSearchInput`, `#triageSearchClearBtn`) integrada en la cabecera de la vista de triaje.
  - Reutilización de `matchesTaskSearch` para filtrar tareas activas en los grupos por título, notas, etiquetas (`#tag`), personas/menciones (`@persona`), urgencia (`urg:hoy`, `urg:dias`, `today`, etc.) y estado destacado (`star`).
  - Renderizado reactivo de la sección `.triage-completed-list` con las tareas completadas que coinciden con la búsqueda y acción directa para reabrirlas (`app.uncompleteTask`).
  - Banner informativo (`.search-results-info`) con contadores de tareas activas y completadas coincidentes.
  - Botón de limpieza rápida (✕) y atajo con la tecla `Escape` para restablecer la vista.
  - Atajo de teclado `/` enfoca directamente el buscador de triaje cuando la vista activa es `triage`.
  - Integración de autocompletado en caliente de `#etiquetas` y `@menciones` en el input de búsqueda de triaje.
  - Actualización selectiva del DOM en `oninput` para evitar parpadeos y preservar el foco de escritura.
- **Autocompletado Ubicuo de Etiquetas (#) y Menciones (@) en Edición de Tareas:**
  - Elevación de la capa de visualización de los menús desplegables de autocompletado a `z-index: 200000` (en `js/app/tag-autocomplete.js` y `css/layout.css`), asegurando que siempre se muestren por encima de las capas de modales (`.modal-overlay` con `z-index: 100000`).
  - Autocompletado integrado en el modal de edición de tareas en triaje (`#triageEditTitleInput` y `#task-edit-notes-${id}`).
  - Autocompletado integrado en la edición en línea del tablero principal (`#task-edit-title-${id}` y `#task-edit-notes-${id}`).
  - Autocompletado integrado en el campo de notas al crear tareas (`#taskNotesInput`).
  - Enriquecimiento de `getEnvironmentTags` y `getEnvironmentMentions` para extraer etiquetas y menciones también desde el campo `notes` en tareas activas y días del historial.
- **Documentación y Pruebas:**
  - Nuevas suites de pruebas unitarias: `tests/triage_search.test.js` (12 tests) y `tests/task_edit_autocomplete.test.js` (4 tests).
  - Registro de Decisión de Arquitectura: [ADR 018](docs/adr/018-triaje-busqueda-y-autocompletado-edicion.md).

## [1.109] - 2026-09-09


### Añadido
- **Exportación CSV de Tareas Abiertas (panel Configuración `3`):**
  - Nuevo botón **"⬇ Exportar CSV"** en el panel de Configuración, inmediatamente antes de "↻ Nuevo día".
  - Genera y descarga un archivo `.csv` con todas las tareas abiertas (`pending`, `running`, `paused`) de todos los días retenidos en el entorno activo, más las reglas maestras de tareas recurrentes activas.
  - **Compatible con Microsoft Excel** sin asistente de importación: BOM UTF-8 (`\uFEFF`) nativo y separador `;`.
  - **17 columnas exportadas:** ID, Tipo, Título, Estado, Urgencia (con prefijo numérico ordenable `1-Hoy`/`1-Today`, `2-Días`/`2-Days`, etc.), Destacada, Duración estimada (min), Tiempo consumido (min), Tiempo restante (min), Dependencias, Entorno, Fecha, Recurrente, Patrón recurrencia, Etiquetas, Menciones, Notas.
  - **Localización dinámica (i18n):** cabeceras, estados, valores y nombre del archivo generados en el idioma activo (Español / English).
  - **Escape RFC 4180:** campos con `;`, `"` o saltos de línea correctamente entre comillas; las notas Markdown multilinea quedan en una sola celda.
  - **Mitigación de CSV Formula Injection:** campos que comienzan por `=`, `+`, `-` o `@` reciben un apóstrofe previo.
  - **Liberación de recursos:** `URL.revokeObjectURL()` invocado inmediatamente tras la descarga.
  - Módulo nuevo: `js/app/export-csv.js` con funciones `csvField`, `localizeUrgency` y `exportOpenTasksCSV`.
  - Claves i18n añadidas: `export.*` (32 claves) en `js/i18n/es.js` y `js/i18n/en.js`.
  - Suite de 30 tests unitarios en `tests/export_csv.test.js` (cobertura completa de todos los casos del plan).

## [1.108] - 2026-09-08

### Añadido
- **Aislamiento de Desviación Diaria y Métricas de Cabecera para Tareas Trasladadas (`initialElapsed`):**
  - **Línea Base del Día para Tareas Auto-Movidas:**
    * Inclusión de la propiedad `task.initialElapsed` en el modelo de datos (`DATA_SCHEMA.md` y `state.js`), asignada automáticamente al transferir tareas pendientes entre fechas mediante `rolloverPendingTasks`, `moveTaskToDate` o `moveTasksToDate`.
    * Las tareas que inician una nueva jornada con tiempo consumido previo arrancan con una línea base que aísla el cálculo de la jornada actual respecto al histórico acumulado.
  - **Desviación del Día Limpia en Cero (`computeDayDeviation`):**
    * Refactorización del modelo híbrido en `js/utils.js`: descuenta `initialElapsed` tanto del plan remanente del día (`plDay = Math.max(0, planned - initialElapsed)`) como del tiempo consumido hoy (`consumedDay = Math.max(0, consumed - initialElapsed)`).
    * Garantiza que al abrir una nueva jornada la desviación diaria empiece estrictamente en `0` (evaluadas: `0`), erradicando falsos indicadores de retraso en tareas sobrepasadas en días anteriores.
    * Si la tarea se ejecuta hoy, computa de forma precisa el sobrecoste o ahorro generado exclusivamente durante la jornada en curso.
    * Omisión de cierres administrativos (completar una tarea trasladada sin haber invertido tiempo en el día actual).
  - **Sincronización de Estadísticas en el Panel Resumen (`#headerStats`):**
    * **Tareas por hacer (`tasksTotal`):** Ajustado para reflejar lo que falta realmente por realizar ($\sum \max(0, \text{planned} - \text{getTaskElapsed}(t))$), en perfecta sincronía con el motor del timeline (`scheduler.js`) y proporcionando un cálculo exacto de *"Tiempo no asignado"*.
    * **Completado hoy (`completedTotal`):** Suma exclusivamente los minutos invertidos durante la jornada en curso en tareas completadas ($\sum \max(0, \text{actualDuration} - \text{initialElapsed})$).
  - **Pruebas y Documentación:**
    * Suites de pruebas unitarias y de integración en `tests/day_deviation.test.js`, `tests/dashboard_view.test.js`, `tests/rollover_tasks.test.js` y `tests/copy_task.test.js`.
    * Registro de Decisión de Arquitectura en `docs/adr/017-aislamiento-desviacion-y-metricas-diarias.md`.
    * Actualización de arquitectura en `docs/ARCHITECTURE.md` y esquema en `docs/DATA_SCHEMA.md`.

## [1.107] - 2026-09-06

### Añadido
- **Sistema de Dependencias Direccionales entre Tareas (`dependsOn`) con Paridad Total:**
  - **Paridad Funcional en Creación y Edición (Tablero Principal y Triaje):**
    * Inclusión de la sección *"Depende de"* en el formulario lateral principal bajo *⚙️ Opciones avanzadas* con indicador dinámico de candado 🔒 (`#formDependenciesBadge`) y lista de chips interactivos eliminables.
    * Integración plena en la vista de Triaje (`#/triage`) dentro del modal `#triageTaskEditModal`, con idéntica capacidad de añadir y remover dependencias tanto al crear nuevas tareas (`id: '__new__'`) como al editar tareas existentes.
    * Soporte de dependencias en la edición inline de tarjetas en el tablero (`renderTaskItemEdit`).
  - **Selector Modal Multidía y Detección de Ciclos (`#dependencySelectorModal`):**
    * Búsqueda en tiempo real entre todas las tareas del entorno (día actual, días pasados y futuros) mediante `searchAllTasks()`, indexando identificadores visibles (`W-1`, `P-1`), títulos y hashtags.
    * Prevención matemática de referencias circulares (ciclos A ➔ B ➔ A) mediante algoritmo DFS (`checkCircularDependency`), desactivando visualmente las tareas inválidas para evitar dependencias recursivas.
    * Exclusión de auto-dependencias e indicación visual de tareas ya añadidas.
  - **Planificación Temporal Inteligente (`scheduler.js`):**
    * El algoritmo de cálculo de horarios (`computeSchedule`) retiene las tareas dependientes hasta que concluyan sus predecesoras planificadas en el mismo día.
    * Si una tarea predecesora pertenece a otra fecha o su ejecución desborda el horario laboral, la tarea dependiente se marca y resalta como desbordada (`overflowIds`).
  - **Desbloqueo Suave (*Soft-Blocking*) y Navegación Rápida:**
    * Las tareas bloqueadas muestran la insignia semántica `.task-dep-badge.blocked` con el candado 🔒 y el recuento de bloqueadores activos, así como un icono de candado en el botón de reproducción.
    * Al pulsar en iniciar una tarea bloqueada, se abre `#blockedTaskConfirmModal` detallando las tareas bloqueantes con su `displayId`, título y fecha.
    * El modal ofrece el botón *"Ir a la tarea"* (`app.goToTask()`) para saltar de inmediato al día y tarjeta bloqueante con animación de enfoque suave, y el botón *"Iniciar de todos modos"* para forzar el inicio si el usuario lo requiere.
  - **Pruebas y Documentación:**
    * Suites de pruebas unitarias y de integración en `tests/task_dependencies.test.js`, `tests/scheduler_dependencies.test.js` y `tests/task_dependencies_ui.test.js` (25 tests nuevos, 100% pasando).
    * Registro de Decisión Arquitectónica en `docs/adr/016-dependencias-entre-tareas.md`.
    * Actualizaciones de esquema en `docs/DATA_SCHEMA.md` y arquitectura en `docs/ARCHITECTURE.md`.

## [1.106] - 2026-09-06

### Añadido
- **Configuración de Recurrencia en Triaje al Crear Tareas:**
  - **Paridad y Reutilización en Creación de Tareas:**
    * Inclusión de la opción de recurrencia mediante el checkbox *"Repetir tarea 🔁"* dentro del modal unificado de triaje (`#triageTaskEditModal`), disponible desde el botón de cabecera `＋ Nueva tarea`, el atajo de teclado <kbd>N</kbd> y el botón flotante (FAB) móvil.
    * Reutilización directa del sistema de estilos `.rec-pop-*` y `.recurring-form-options-panel` de `css/modals.css`, manteniendo total coherencia visual con el formulario y el popover de la página principal.
    * Despliegue de selectores de frecuencia (semanal / diaria), intervalo numérico con unidad adaptativa (*semana(s)* / *día(s)*), botones interactivos de selección de días de la semana (`L`, `M`, `X`, `J`, `V`, `S`, `D`) y fecha límite opcional con botón *"Sin límite"*.
    * Ocultación automática de la opción *"Auto-mover a hoy"* cuando la tarea se define como recurrente, alineado con las reglas periódicas del sistema.
  - **Integración con el Motor Central de Recurrencias y Undo:**
    * Paso dinámico de `recurringData` en `actionsModule.saveEditTask('__new__')` hacia `addTask()`.
    * Materialización automática de la primera ocurrencia en el día seleccionado y creación de la regla maestra en `state.recurringTasks`.
    * Soporte completo e inmediato para revertir la creación de la tarea recurrente mediante `triageUndo()` (<kbd>Ctrl+Z</kbd> o botón Deshacer de la cabecera).
  - **Pruebas y Documentación:**
    * Suite de pruebas unitarias en `tests/triage_recurring_task.test.js`.
    * Registro de Decisión Arquitectónica en `docs/adr/015-triaje-creacion-tareas-recurrentes.md`.
    * Actualización de arquitectura en `docs/ARCHITECTURE.md`.

## [1.105] - 2026-09-06

### Añadido
- **Sistema de Referencias a Personas (@Nombre), Color Único Teal y Autocompletado Integrado:**
  - **Sintaxis `@Nombre` en Tareas:**
    * Inclusión de menciones a personas directamente en los títulos de tareas y reglas periódicas (`@Carlos`, `@Maria`, `@ana.lopez`, `@juan-carlos`).
    * Extracción automática y normalizada en minúsculas en el modelo de datos (`task.mentions` y `rule.mentions`) mediante `extractMentions(text)` en `js/utils.js`.
    * Soporte para caracteres latinos (acentos, tildes, eñes), guiones, barras bajas y puntos.
    * Descarte estricto de direcciones de correo electrónico para prevenir falsos positivos (ej. `usuario@dominio.com` no se extrae ni resalta como mención).
  - **Paleta Cromática Semántica Única (Teal / Verde Azulado):**
    * Color único y homogéneo para todas las personas (`.task-mention-syntax`), diferenciándolas claramente de los hashtags `#tag` que alternan entre 9 colores rotativos.
    * Modo claro: texto `#0f766e`, fondo `rgba(20, 184, 166, 0.10)`, borde `rgba(20, 184, 166, 0.25)`.
    * Modo oscuro: texto `#5eead4`, fondo `rgba(45, 212, 191, 0.18)`, borde `rgba(45, 212, 191, 0.35)`.
    * Resaltado seguro de sintaxis en `formatTitleWithTags()` con protección XSS.
  - **Motor de Autocompletado Dual (`#` y `@`):**
    * Detección dinámica de disparador en `getWordAtCursor` (`#` para tags, `@` para personas).
    * Búsqueda insensible a mayúsculas y minúsculas entre todas las personas del entorno con `getEnvironmentMentions(state)`.
    * Preservación del formato canónico con mayúsculas más frecuente (ej. `@Carlos`) y ordenación por frecuencia de uso.
    * Inserción asistida de `@Nombre ` con navegación por teclado (<kbd>↓</kbd>, <kbd>↑</kbd>, <kbd>Enter</kbd>, <kbd>Tab</kbd>, <kbd>Esc</kbd>) y ratón.
  - **Filtrado Rápido e Indexación:**
    * Clic interactivo en cualquier `@Nombre` para filtrar al instante la vista diaria mediante `app.filterByMention()`.
    * Indexación completa en `getTaskSearchableText()` para búsqueda rápida tanto por `@persona` como por `persona` en el buscador local y global (<kbd>Ctrl+K</kbd>).
  - **Pruebas y Documentación:**
    * 25 pruebas unitarias exhaustivas en `tests/mention_autocomplete.test.js`.
    * Registro de Decisión Arquitectónica en `docs/adr/014-referencias-personas-menciones-autocompletado.md`.
    * Actualización del esquema de datos en `docs/DATA_SCHEMA.md` y arquitectura en `docs/ARCHITECTURE.md`.

## [1.104] - 2026-09-06

### Añadido
- **Identificadores Visibles de Tarea (`W-1`, `P-1`), Copiado Rápido y Búsqueda Multidía:**
  - **Identificadores Amigables por Entorno:** Asignación secuencial e inmutable de identificadores públicos legibles (`displayId`) para tareas:
    * `W-1`, `W-2`, `W-3`... para el entorno de Trabajo.
    * `P-1`, `P-2`, `P-3`... para el entorno Personal.
    * Los IDs técnicos internos persisten como UUIDs para estabilidad del sistema y sincronización offline-first.
    * Migración retroactiva automática en `wrapState()` para tareas preexistentes y continuidad del contador `env.nextTaskSeq`.
  - **Doble Modalidad de Copiado al Portapapeles (Tablero y Triaje):**
    * **Badge en Título (`.task-id-badge`):** Al hacer clic sobre el badge, copia **únicamente el ID** (`"W-1"` o `"P-1"`) con feedback in-situ `✓ ¡Copiado!` y toast de confirmación.
    * **Botón de Copia de Referencia (`.copy-ref-btn` / `.triage-copy-btn`):** Situado a la derecha en la tarjeta o fila de triaje, copia el **identificador seguido del título** (`"${task.displayId} ${task.title}"`, por ejemplo `"P-1 Pedir cita para médico"` o `"W-1 Revisar código"`).
    * Ambas acciones disponibles con idéntico comportamiento en el tablero principal (tareas activas y completadas) y en cada fila de la vista de Triaje (`#/triage`).
  - **Indexación y Búsqueda:**
    * Indexación de `task.displayId` en `getTaskSearchableText()` permitiendo búsquedas por `W-1`, `w-1`, `#1` o `1` tanto en el filtro local del día (`/`) como en el buscador global (<kbd>Ctrl+K</kbd>).
    * Visualización de la insignia `.task-id-badge` en los resultados de la paleta de comandos.
  - **Estilos y Accesibilidad:**
    * Tipografía monoespaciada suave, esquinas redondeadas y contraste accesible con soporte total para temas claro y oscuro (`css/layout.css`, `css/triage.css`, `css/theme-dark.css`).
    * Claves i18n en español e inglés (`tasks.copyIdTooltip`, `tasks.copiedIdToast`, `tasks.copyReferenceTooltip`, `tasks.copiedReferenceToast`).
  - **Pruebas y Documentación:**
    * Suite de pruebas unitarias dedicada en `tests/task_display_id.test.js`.
    * Registro de Decisión Arquitectónica en `docs/adr/013-identificadores-visibles-tareas-y-copiado.md`.
    * Actualización de especificación en `docs/DATA_SCHEMA.md` y `docs/ARCHITECTURE.md`.

## [1.103] - 2026-09-05

### Añadido
- **Triaje Móvil y Creación Ágil de Tareas (Móvil y PC):**
  - **Botones Undo/Redo en Triaje:** Controles táctiles permanentes `↶ Deshacer` y `↷ Rehacer` en la cabecera de Triaje (`#/triage`), con estado reactivo según disponibilidad en la pila histórica y diseño optimizado para pantallas táctiles móviles donde no existen atajos de teclado físicos.
  - **Reordenación y Movimiento por Pulsación Prolongada (Long-Press):**
    - Detección de toque prolongado (~450ms) en filas de tareas de triaje con feedback táctil háptico (`navigator.vibrate`) y elevación visual (`.long-press-active`).
    - Desplazamiento táctil directo (`touchmove`) para reordenar tareas arrastrándolas verticalmente con el dedo, o despliegue de hoja inferior (Bottom Sheet) con opciones directas de posición ("Subir en la cola", "Bajar en la cola", "Al principio", "Al final") y salto a los próximos 5 días hábiles.
    - Método puro `moveTaskDirectly(taskId, direction)` expuesto en `TodayTasksDragDrop` y `window.app` con generación de snapshots en `undoModule` para reversión inmediata.
  - **Creación Unificada de Nuevas Tareas en Triaje (PC y Móvil):**
    - Modal unificado (`#triageTaskEditModal` con `id: '__new__'`) que elimina la duplicidad de formularios, proporcionando paridad funcional total tanto en PC como en móvil: título con autocompletado de `#etiquetas`, duración, selector de urgencia, estrella de destacada, notas Markdown completas con barra de herramientas y previsualización, hora mínima `startAfter` y casilla de traslado automático.
    - Activación mediante el botón `＋ Nueva tarea` en la cabecera (PC), atajo de teclado global <kbd>N</kbd>, o el botón flotante (FAB `#triageFabAddTask`) en móviles.
    - Eliminación de la barra inline intermedia y del modal inferior simplificado anterior en favor de una experiencia 100% coherente.
  - **Internacionalización y Pruebas:**
    - Localización completa en Español e Inglés (`es` y `en`) con paridad 100%.
    - Suite de pruebas unitarias dedicada en `tests/triage_mobile_features.test.js`.
    - Registro de decisión arquitectónica en `docs/adr/012-triaje-movil-gestos-y-creacion-tareas.md`.

### Corregido
- **Selección y Actualización de Urgencia en el Popup de Triaje:**
  - **Actualización visual en el popup:** Corregido el conflicto de selectores en el DOM donde el botón pill del modal `#triageTaskEditModal` compartía ID con el formulario inline de la vista principal, provocando que `selectTaskUrgency` solo actualizara el elemento en segundo plano. Se amplió el selector en `js/app/urgency-dropdown.js` para actualizar de forma unificada todos los botones pill correspondientes (`#triageTaskEditModal .urgency-pill-btn`, `.triage-edit-modal-box .urgency-pill-btn`, `#edit-urgency-pill-${id}`).
  - **Sincronización y persistencia con `env.days`:** Modificadas las acciones `saveEditTask` y `setTaskUrgency` en `js/actions/tasks.js` para propagar y sincronizar inmediatamente cualquier cambio de urgencia y atributos editados hacia `env.days[d].tasks`, asegurando que al guardar la tarea en el popup de triaje se refleje y reagrupe de forma persistente.
  - Cobertura de pruebas unitarias de regresión en `tests/urgency_dropdown.test.js` y `tests/triage_mobile_features.test.js`.

## [1.102] - 2026-09-05

### Añadido
- **Sistema de Etiquetas (Tags) en Tareas y Autocompletado de Hashtags (Opción 4):**
  - Soporte nativo para hashtags en títulos de tareas (`#tag`, `#cliente-acme`, `#frontend`).
  - Resaltado sutil de sintaxis en los títulos de tareas en el tablero principal, búsqueda y triaje rápido mediante `formatTitleWithTags()` y clases deterministas de color (`getTagColorClass()`).
  - Menú flotante de autocompletado en tiempo real (`js/app/tag-autocomplete.js`) al escribir `#` (ej. `#cas...`), que busca de forma insensible a mayúsculas y minúsculas (*case-insensitive*) entre todas las etiquetas existentes en el entorno.
  - Integración del autocompletado de etiquetas en la búsqueda local (`#taskSearchInput`) y en el buscador global Command Palette modal (`#globalSearchInput`), con soporte para escanear ambos entornos (`work` y `personal`), navegación sin interferencias de teclado y filtrado instantáneo de resultados al autocompletar.
  - Navegación completa por teclado (<kbd>↓</kbd>, <kbd>↑</kbd>, <kbd>Enter</kbd>, <kbd>Tab</kbd>, <kbd>Esc</kbd>) y selección por ratón. Inserta la etiqueta con un espacio añadido para continuar escribiendo sin pausas.
  - Filtrado reactivo en un solo clic: pulsar cualquier hashtag en una tarea filtra la lista y el tablero cronológico por esa etiqueta, y un segundo clic restaura la vista.
  - Indexación de `task.tags` en el motor de búsqueda `getTaskSearchableText()` y compatibilidad con Command Palette (`Ctrl+K`).
  - Adaptación visual completa para temas claro y oscuro (`css/layout.css` y `css/theme-dark.css`).
  - Cobertura de pruebas unitarias en `tests/tag_autocomplete.test.js`, `tests/command_palette.test.js` y `tests/tasks.test.js`.

## [1.101] - 2026-09-04

### Añadido
- **Buscador Global de Tareas (Command Palette `Ctrl+K` / `Cmd+K`):**
  - Implementación del buscador global multidía mediante Command Palette modal (`#globalSearchModal`), accesible instantáneamente mediante el atajo de teclado global <kbd>Ctrl+K</kbd> / <kbd>Cmd+K</kbd> o desde el botón directo en la cabecera superior.
  - Motor de búsqueda multidía (`searchAllTasks` en `js/utils.js`) con soporte para consultar en todos los días del estado (`env.days`: últimos 10 días pasados, día actual y días futuros planificados) y plantillas maestras de tareas recurrentes (`env.recurringTasks`).
  - Agrupación temporal inteligente de resultados: 📌 Hoy (día activo), 🔮 Próximos días, 🕒 Días anteriores y 🔁 Plantillas recurrentes.
  - Navegación ágil por teclado (<kbd>↑</kbd> / <kbd>↓</kbd> para seleccionar elemento, <kbd>Enter</kbd> para activar/navegar, <kbd>Esc</kbd> para cerrar).
  - Filtros rápidos por chip: `Todo`, `Pendientes`, `Completadas`, `🔁 Recurrentes`, y switch de ámbito de entorno (`💼 Trabajo` / `🏠 Personal` / `🌐 Ambos entornos`).
  - Acciones rápidas en un clic: "Ir a tarea ↗" (cambia la fecha y resalta suavemente la tarjeta con pulso visual), "Mover a Hoy ⏩" (traslada la tarea a la jornada actual con persistencia), "Reabrir en Hoy ↺" y "Editar serie ✎".
  - Cobertura integral de pruebas unitarias (`tests/global_search.test.js` y `tests/command_palette.test.js`) y localización completa bilingüe (`es` / `en`).

## [1.100] - 2026-09-04

### Completado
- **Hito de Internacionalización (i18n) Completo:**
  - Soporte integral bilingüe Español (`es`) / Inglés (`en`) en toda la aplicación (HTML estático, vistas principales, triaje, foco, PiP, histórico, horario semanal, acciones, sincronización en la nube y notificaciones).
  - Selector de idioma en cabecera con persistencia local y remota.
  - Sincronización robusta de insignias y estados de autenticación (`#appModeLabel`, `#authArea`, `signOutBtn`, `signInBtn`).

## [1.100.5.3] - 2026-09-04

### Añadido
- **Internacionalización (i18n) — Subfase 5.3: Panel Histórico y Gráfica Evolutiva (`js/history.js`):**
  - Vista histórica (`#/history`): botón de regreso, título y selector de métricas localizados.
  - Series temporales y tooltips interactivos del gráfico evolutivo SVG adaptados al idioma.
  - Tarjetas de resumen de métricas (promedios, desviaciones, totales) y tabla de mediciones de los últimos 40 días bilingüe.

## [1.100.5.2] - 2026-09-04

### Añadido
- **Internacionalización (i18n) — Subfase 5.2: Horario Semanal Recurrente (`js/app/weekly-schedule.js`):**
  - Modal de configuración de horario semanal (`#weeklyScheduleModal`) completamente localizado.
  - Nombres de días, etiquetas de día libre, configurado y validaciones horarias.
  - Notificaciones toast de guardado y reseteo adaptadas al idioma activo.

## [1.100.5.1] - 2026-09-04

### Añadido
- **Internacionalización (i18n) — Subfase 5.1: Vista de Triaje Rápido (`js/views/triage.js`):**
  - Encabezados de grupos (Urgencia, Viabilidad, Duración, Destacadas).
  - Botones y opciones de ordenación, agrupación y colapso/expansión.
  - Barra flotante de selección y operaciones masivas.
  - Modales y popovers de edición rápida de tareas en la vista de triaje.

## [1.100.4.4] - 2026-09-04

### Añadido
- **Internacionalización (i18n) — Subfase 4.4: Modo Enfoque y Mini-Widget PiP (`js/views/focus.js` y `js/pip.js`):**
  - Vista completa de foco (`focus.js`) localizada: controles de reproducción, temporizadores, avisos de corte por reunión próxima, banner de interrupción activa y modal de selección.
  - Mini-widget PiP (`pip.js`) localizado: estados de tarea en curso o sin tarea, botón de pausa/reanudación/completar y avisos de reunión.

## [1.100.4.3] - 2026-09-04

### Añadido
- **Internacionalización (i18n) — Subfase 4.3: Listas de Tareas y Reuniones (`js/views/tasks.js` y `js/views/meetings.js`):**
  - Items de tareas y reuniones con tooltips, badges y menús de acción completamente localizados.
  - Formularios inline de edición de tareas y reuniones bilingües.
  - Estados de listas vacías o filtros sin resultados adaptados al idioma.

## [1.100.4.2] - 2026-09-04

### Añadido
- **Internacionalización (i18n) — Subfase 4.2: Tablero Diario (Timeline y Planificación) (`js/views/board.js`):**
  - Timeline de la jornada traducido dinámicamente: descansos automáticos, colchón de descanso, fin de jornada y horas extras / desbordamiento.
  - Mensajes de día libre y sin tareas en el panel de planificación.

## [1.100.4.1] - 2026-09-04

### Añadido
- **Internacionalización (i18n) — Subfase 4.1: Estadísticas y Dashboard de Cabecera (`js/views/dashboard.js`):**
  - Chips de estadísticas traducidos dinámicamente: Reuniones, Tareas por hacer, Completado hoy, Interrupciones, Día libre y Tiempo no asignado.
  - Tooltips estadísticos y de desviación del día adaptados al idioma activo.
  - Barra de progreso del día localizada.

## [1.100.3.3] - 2026-09-03

### Añadido
- **Internacionalización (i18n) — Subfase 3.3: Notificaciones y Sincronización Cloud (`js/notifications.js` y `js/cloud.js`):**
  - Internacionalizado el subsistema de notificaciones de escritorio y avisos en el navegador (`js/notifications.js`): estado del botón de avisos, notificaciones periódicas y de fin de tiempo de tareas, avisos de reuniones inminentes y auto-pausa de tareas.
  - Internacionalizado el módulo de sincronización en la nube Firebase (`js/cloud.js`): estados de sincronización, autenticación, copias de seguridad y avisos de conexión.

## [1.100.3.2] - 2026-09-03

### Añadido
- **Internacionalización (i18n) — Subfase 3.2: Feedback Visual, Modales y Deshacer (`js/ui.js` y `js/undo.js`):**
  - Internacionalizado el botón de acción por defecto del componente Toast (`showToast`: "Deshacer" / "Undo").
  - Internacionalizado el sistema de historial Deshacer / Rehacer (`js/undo.js`): mensajes de confirmación de deshecho ("Deshecho: {action}" / "Undone: {action}"), rehecho ("Rehecho: {action}" / "Redone: {action}") y avisos de pila vacía ("No hay acciones para deshacer." / "No actions to undo.").
  - Localizados los selectores de unidades de intervalo en formularios de tareas y reuniones.

## [1.100.3.1] - 2026-09-03

### Añadido
- **Internacionalización (i18n) — Subfase 3.1: Fechas, Duraciones y Recurrencia (`js/utils.js`):**
  - Desglose y publicación de la hoja de ruta de la Fase 3 en [`docs/I18N_PHASE_3.md`](./docs/I18N_PHASE_3.md).
  - Soporte bilingüe en `parseDuration()` para unidades de tiempo tanto en español (`horas`, `hrs`, `h`, `minutos`, `mins`, `m`) como en inglés (`hours`, `hour`, `hr`, `minutes`, `minute`).
  - Formateo de fechas, días abreviados (`getDayAbbr`) y descripciones de recurrencia (`formatRecurrenceRule`) adaptadas dinámicamente al idioma activo.
  - Indicador de tiempo restante y excedido en `fmtRemaining` adaptado a español e inglés.

## [1.100.2] - 2026-09-03

### Añadido
- **Sistema de Internacionalización Multilingüe (i18n) — Fases 1 y 2:**
  - **Motor central (`js/i18n.js`):** Soporte para traducción declarativa e imperativa (`t()`, `tPlural()`), interpolación de parámetros dinámicos, fallback automático al español y detección del idioma del navegador (`navigator.language`).
  - **Selector de Idioma en Configuración:** Nuevo control desplegable `#languageSelect` en la pestaña de configuración de la barra superior, con persistencia sincronizada en `localStorage` y Firebase Firestore a través de la nueva propiedad `language` en el modelo de estado (`docs/DATA_SCHEMA.md`).
  - **Diccionarios bilingües (`js/i18n/es.js` y `js/i18n/en.js`):** Soporte inicial completo en Español e Inglés, extensible a nuevos idiomas.
  - **Traducción del DOM Estático (`index.html`):** Etiquetado con atributos declarativos `data-i18n-*` de más de 85 elementos de interfaz (cabecera, pestañas, paneles de tiempo y configuración, formularios de tareas y reuniones, modales de atajos, horario semanal, copiar tareas y recurrencia).
  - **Documentación de Arquitectura:** Especificación técnica completa en [`docs/I18N_SPECIFICATION.md`](./docs/I18N_SPECIFICATION.md) y registro de decisiones en [`docs/adr/009-sistema-internacionalizacion-i18n.md`](./docs/adr/009-sistema-internacionalizacion-i18n.md).
  - **Pruebas Unitarias:** Nueva suite de pruebas [`tests/i18n.test.js`](./tests/i18n.test.js) garantizando 100% de cobertura sobre el motor de traducción.

## [1.99] - 2026-09-03

### Añadido
- **Píldora Dual de Desviación del Plan en la Cabecera (Real / Plan + Delta):**
  - Nuevo indicador integrado en la barra de estadísticas del panel *Resumen* (`#headerStats`) con formato dual `⏱ Real / Plan [±Delta]`.
  - Muestra explícitamente las dos magnitudes base y el balance neto (ej. `⏱ 1h 15m / 1h 00m [+15m]`), evitando confusiones sobre el origen de la desviación.
  - **Modelo Matemático Híbrido Realista:**
    - Tareas completadas: $\text{tiempo real} - \text{tiempo planificado}$ (ahorro o sobrecoste consolidado).
    - Tareas en curso (`running` o `paused`): solo computan si el tiempo consumido ya ha rebasado el tiempo planificado ($\text{elapsed} > \text{planned}$), sumando el exceso en tiempo real como sobrecoste. Si están dentro del margen, computan 0 para eliminar falsos ahorros prematuros.
  - Colores semánticos con micro-pastilla destacada (`.stat-dev-over` en rojo, `.stat-dev-under` en verde, `.stat-dev-neutral` en neutro) y soporte completo para modo oscuro.
  - El chip solo se hace visible cuando hay al menos una tarea evaluada (`evaluatedCount > 0`), manteniendo la cabecera limpia al inicio de la jornada.
  - Función pura `computeDayDeviation(tasks, nowVal)` en [`js/utils.js`](./js/utils.js) con suite de pruebas unitarias en [`tests/day_deviation.test.js`](./tests/day_deviation.test.js).

## [1.98] - 2026-09-03

### Añadido
- **Prevalencia del Orden Manual sobre el Orden Automático (`manualOrder` y `sortTasksWithManualOrder`):**
  - Implementación de un modelo híbrido de ordenación que garantiza que las decisiones explícitas del usuario durante el triaje o la reordenación manual prevalezcan sobre los criterios automáticos (urgencia o destacadas).
  - Al reordenar tareas mediante drag & drop en el tablero o en triaje, o mediante los botones de desplazamiento ▲ / ▼ (`moveTask`), todas las tareas activas quedan ancladas fijando `manualOrder = 1..N`.
  - **Inviolabilidad de la primera tarea:** Si el usuario coloca manualmente una tarea en primer lugar, ninguna nueva tarea ni edición de atributos (urgencia o estrella) puede desplazarla de su posición superior.
  - **Intercalado inteligente de nuevas tareas:** Las tareas añadidas posteriormente (o flotantes) se insertan automáticamente antes de tareas ancladas de menor prioridad (por ejemplo, intercalándose antes de una tarea que el usuario mandó conscientemente al final del día como 'más adelante').
  - **Preservación del ancla al cambiar urgencia:** Cambiar la urgencia de una tarea anclada actualiza su insignia visual pero preserva intacta su posición en la lista.
  - **Botón `⚡ Orden automático`:**
    - Nuevo botón en la cabecera de la vista de Triaje Rápido (`#triageAutoOrderBtn`).
    - Nuevo botón en el panel 3 de Configuración de la barra superior (`#autoOrderBtn`).
    - Permite resetear las anclas manuales (`manualOrder = null`), reordenar todas las tareas estrictamente por prioridad automática y cuenta con soporte para Deshacer (<kbd>Ctrl+Z</kbd>).
  - Registro de decisión arquitectónica [`docs/adr/008-sistema-orden-manual-prevalente.md`](./docs/adr/008-sistema-orden-manual-prevalente.md).

## [1.97] - 2026-09-02

### Añadido
- **Vista de Triaje Rápido de Tareas (`#/triage`):**
  - Nueva vista dedicada a pantalla completa en [`js/views/triage.js`](./js/views/triage.js) y [`css/triage.css`](./css/triage.css) para gestionar situaciones de sobrecarga con decenas de tareas acumuladas.
  - Atajo global de teclado <kbd>X</kbd> para alternar al instante entre el tablero principal y la vista de triaje, y tecla <kbd>Esc</kbd> para salir.
  - Botón directo `⚡ Triaje [X]` en la cabecera del panel de Tareas.
  - **Cuatro Modos de Agrupación:**
    - **Urgencia (por defecto):** 🟠 Hoy, 🔵 Próximos días, 🟣 Esta semana, ⚪ Más adelante.
    - **Viabilidad hoy:** ✅ Caben en el horario de hoy vs ⚠️ Desbordan la jornada (*overflow*).
    - **Duración:** ⚡ Quick Wins (≤ 15 min), ⏳ Medias (20 a 45 min), 🏋️ Largas (> 45 min).
    - **Destacadas:** ⭐ Tareas Destacadas (top 5) vs 📋 Otras tareas en cola.
  - **Ordenación Ascendente por Duración:** Dentro de cada grupo, las tareas se ordenan automáticamente de menor a mayor duración para facilitar la resolución rápida de *quick wins*.
  - **Filas de Tarea Compactas en 1 Sola Línea:**
    - Truncado elíptico del título (`...`) con tooltip completo y duración estimada pegada al nombre (`[15m]`).
    - Estrella directa para destacar o desmarcar sin tocar checkboxes.
    - Botón interactivo de urgencia con popover contextual para cambiar nivel con un clic.
    - 5 botones de salto rápido a los próximos días laborables (calculados dinámicamente con `getNextWorkingDays`, omitiendo fines de semana o días libres configurados en `weeklySchedule`).
    - Botón directo de eliminación 🗑️.
    - Clic en la fila (zona neutra) selecciona o deselecciona la tarea.
  - **Plegado y Desplegado de Grupos:**
    - Icono chevron desplegable `[ ▾ ]` a la izquierda del checkbox del grupo.
    - Botones globales para plegar o desplegar todos los grupos a la vez.
  - **Barra Flotante de Acciones Masivas (`#triageFloatingBar`):**
    - Aparece reactivamente en la parte inferior al seleccionar una o más tareas (o marcar el checkbox de grupo).
    - Mover tareas en lote a cualquiera de los próximos 7 días laborables calculados según horario semanal (o fecha personalizada).
    - Cambiar urgencia en lote (Hoy, Días, Semana, Más adelante).
    - Destacar o quitar destacado en lote respetando el límite máximo de 5 destacadas.
    - Borrar tareas en lote con confirmación y registro de lápidas `_deletedIds` para sincronización en la nube.
    - Soporte completo para Deshacer/Rehacer transaccional con <kbd>Ctrl+Z</kbd>.
  - Registro de decisión arquitectónica [`docs/adr/007-vista-triaje-rapido.md`](./docs/adr/007-vista-triaje-rapido.md).

## [1.96] - 2026-09-02

### Corregido
- **Arranque automático en el día de hoy y desacoplamiento de fecha en la nube:**
  - Al abrir o reiniciar la aplicación, la vista se posiciona automáticamente siempre en la fecha actual (`getTodayStr()`), evitando quedar anclada a días pasados de sesiones previas en `localStorage`.
  - Se excluye `selectedDate` de la persistencia en Firestore (`tableroDia`), tratándolo como estado de navegación local y efímero para evitar que la nube sobrescriba la vista con fechas anteriores.

## [1.95] - 2026-09-01

### Añadido
- **Mini-Widget Flotante con Document Picture-in-Picture (PiP):**
  - Nuevo submódulo `TodayTasksPiP` en [`js/pip.js`](./js/pip.js) y estilos en [`css/pip.css`](./css/pip.css).
  - Apertura de mini-ventana flotante Always-on-Top nativa mediante la API `window.documentPictureInPicture` para monitorizar tareas mientras se trabaja en otras aplicaciones de escritorio.
  - **Doble Reloj en Cuenta Regresiva Reactiva:**
    - Cronómetro en cuenta regresiva del tiempo restante de la tarea planificada (`MM:SS restante`).
    - Conmutación automática a sobretiempo (`+MM:SS tiempo extra`) con alerta visual en rojo/ámbar si se excede la duración estimada.
    - Pastilla de cuenta regresiva en vivo del tiempo restante hasta la próxima reunión (`en MM:SS`) con alerta pulsante cuando faltan < 5 minutos.
    - Marca de corte por reunión (`▼`) posicionada en la barra de progreso con tooltip informativo interactivo.
  - **Modos Dinámicos de Ejecución:**
    - Tarea en curso (pausar, completar, interrumpir).
    - Tarea en pausa (reanudar al instante).
    - Modo interrupción con cronómetro propio y botones de finalización o descarte.
    - Modo reposo que sugiere e inicia la siguiente tarea pendiente en cola.
  - **Integración y Accesibilidad:**
    - Botones de acceso rápido `🗖 Mini-Widget [W]` en la barra superior (pestaña Tiempo) y en la vista de foco de tarea (`#view-task`).
    - Atajo de teclado global accesible con la tecla <kbd>W</kbd>.
    - Sincronización instantánea de temas Claro y Oscuro (`data-theme="dark"`).
    - Botón `↗ App` para enfocar la pestaña principal de TodayTasks (`window.focus()`).
    - Registro de decisión arquitectónica [`docs/adr/006-document-picture-in-picture.md`](./docs/adr/006-document-picture-in-picture.md).

---

## [1.94] - 2026-09-01

### Añadido
- **Detección Automática de Nueva Versión y Auto-Sincronización en Inactividad:**
  - Nuevo módulo desacoplado `TodayTasksVersionSync` en [`js/version.js`](./js/version.js) con arquitectura híbrida.
  - Detección autónoma y no intrusiva mediante consulta periódica a [`version.json`](./version.json) y análisis ligero de [`index.html`](./index.html) con cabeceras `no-cache`.
  - Chequeo inmediato al reenfocar la ventana o pestaña tras periodos en segundo plano (`visibilitychange` / `focus`).
  - Polling pasivo cada 10 minutos de fondo sin saturación de red.
  - Coordinación multi-pestaña en tiempo real mediante API nativa `BroadcastChannel`.
  - Mecanismo de **Auto-Recarga Segura (*Safe Idle Reload*)**: si la aplicación lleva 5 minutos inactiva o la pestaña permaneció oculta en segundo plano, se aplica la actualización preservando el 100% del estado, cronómetros y tareas en marcha sin perder datos ni interrumpir al usuario.
  - Protección de seguridad: la recarga automática se pospone si hay tareas o reuniones en edición (`taskEdit !== null || meetingEdit !== null`), modales abiertos o campos de entrada activos.
  - Insignia interactiva `#versionUpdateBadge` en la barra superior con opción de actualización manual con 1 clic para usuarios activos.
  - Registro de decisión arquitectónica [`docs/adr/005-version-auto-sync-idle.md`](./docs/adr/005-version-auto-sync-idle.md).

---

## [1.93] - 2026-08-31

### Añadido
- **Identificación visual de tareas fuera de jornada laboral en la lista de tareas:**
  - Marcado visual destacado para las tareas que, según la proyección del planificador (`computeSchedule`), finalizan después de la hora de fin de jornada (`state.workEnd`).
  - Funciona de forma reactiva tanto en **Modo Planificación ON** (simulación del día completo desde el inicio de jornada) como en **Modo Planificación OFF** (proyección en tiempo real a partir de la hora actual y la tarea en marcha).
  - Estilo visual de alta visibilidad:
    - Borde lateral izquierdo acentuado en color rojo/coral (`3.5px solid #EF4444` en tema claro, `#F87171` en tema oscuro).
    - Fondo con sutil tinte rojizo (`rgba(254, 242, 242, 0.55)` en claro y `rgba(69, 26, 26, 0.28)` en oscuro) y marco perimetral suave.
    - Insignia de advertencia `⚠ Fuera de jornada` integrada en los metadatos de la tarjeta.
    - Coexistencia y compatibilidad armónica con tarjetas destacadas con estrella (`.featured-task`).
  - Detección coherente de desbordamiento también en tareas en ejecución (`running`) que superan el límite horario.

---

## [1.92] - 2026-08-31

### Corregido
- **Prevención de duplicación y resurrección de tareas/reuniones borradas en la sincronización:**
  - Implementación del patrón de **Tombstones (lápidas de borrado)** mediante `_deletedIds` en cada día y `_deletedRecurringIds` en cada entorno.
  - Al borrar una tarea, reunión o interrupción (o reiniciar el día con `startNewDay`), sus identificadores quedan registrados como lápidas.
  - La función de resolución de conflictos `mergeStates()` verifica bidireccionalmente los tombstones locales y remotos, asegurando que un dispositivo con datos antiguos nunca resucite elementos eliminados en otro dispositivo al aceptar un *merge*.
  - Las series recurrentes eliminadas quedan protegidas mediante `_deletedRecurringIds` para evitar su reaparición.
  - Limpieza y reciclaje automático de lápidas con el ciclo de vida habitual de poda (*pruning*) de días antiguos (> 10 días).
  - Registro de decisión arquitectónica [`docs/adr/004-sync-tombstones.md`](./docs/adr/004-sync-tombstones.md).

---

## [1.91] - 2026-08-31

### Añadido
- **Popover Interactivo de Información y Edición Directa de Recurrencia:**
  - Nuevo botón interactivo en la tarjeta de tareas y reuniones (`.recurring-tag-btn`) en sustitución del tag estático.
  - Formateo inteligente en lenguaje natural de reglas de recurrencia mediante `formatRecurrenceRule(rule)` (frecuencia, intervalos personalizados, días de la semana y periodo de vigencia).
  - Menú contextual flotante (*popover*) que permite consultar y **editar directamente los parámetros de recurrencia** (frecuencia, días de la semana e intervalo) sin tener que recrear la tarea o reunión.
  - Tooltips enriquecidos al pasar el cursor sobre la etiqueta `🔁 Recurrente`.
  - Cierre intuitivo mediante clic fuera o pulsación de la tecla `Escape`.
  - Registro de decisión arquitectónica `docs/adr/003-recurring-rules-popover.md`.

---

## [1.90] - 2026-08-31

### Añadido
- **Notas y Enlaces Enriquecidos con Markdown en Tareas:**
  - Micro-parser nativo de Markdown ligero con soporte para **negrita** (`**texto**` y `__texto__`), *cursiva* (`*texto*` y `_texto_`), enlaces nombrados (`[Título](https://...)`) y URLs directas (`https://...`).
  - Enlaces accionables que abren de forma segura en nueva pestaña (`target="_blank" rel="noopener noreferrer"` con icono indicador `↗`).
  - Sanitización estricta anti-XSS previa a la transformación de sintaxis.
  - Píldora interactiva `📝 Notas` en las tarjetas de tarea de la lista principal con panel desplegable animado.
  - Sección de notas en el formulario de creación (Opciones avanzadas) y en el formulario de edición rápida con barra de herramientas de formato (`[B]`, `[I]`, `[🔗 Link]`) y alternador de previsualización en vivo.
  - Panel de consulta de notas integrado en la vista de foco a pantalla completa (Focus View `#/task/:id`).
  - Indexación de notas en el buscador en tiempo real (`/`).
  - Soporte y propagación de notas en tareas recurrentes (`RecurringTaskRule`).
  - Registro de decisión arquitectónica `docs/adr/002-task-notes-markdown.md`.

---

## [1.89] - 2026-08-30

### Añadido
- **Opciones avanzadas en formulario de tareas:** Sección colapsable que agrupa de forma limpia y accesible desde móviles y escritorio:
  1. *Auto-mover si no se completa a hoy* (marcado por defecto).
  2. *Repetir tarea 🔁* (con panel desplegable de reglas y periodicidad).
  3. *Iniciar a partir de una hora* con selector mediante popover reducido y chip compacto `Sin hora / HH:MM+ ▾`.
- **Planificación de tareas a partir de una hora mínima (`startAfter`):** Posibilidad de fijar una hora a partir de la cual se debe realizar una tarea concreta.
- **Chip interactivo compacto (`16:00+`):** Píldora visual en la tarjeta de la tarea con notación ultra-compacta `⏰ HH:MM+ ▾`.
- **Popover rápido:** Menú contextual flotante que permite configurar o retirar la restricción horaria en un solo clic.
- **Relleno inteligente de huecos (*Gap-Filling Scheduling*):** El planificador acomoda las tareas de la mañana de forma óptima sin generar tiempos muertos innecesarios antes de la hora fijada.
- **Sincronización en tareas recurrentes:** Al cambiar la hora de inicio en cualquier instancia de una tarea recurrente, la nueva hora se propaga automáticamente a toda la serie (regla maestra y todas las ocurrencias del calendario).
- Campo de hora mínima en el modo de edición de tareas inline.
- Registro de decisión arquitectónica `docs/adr/001-task-start-after-scheduling.md`.

---

## [1.88] - 2026-08-30

### Añadido
- Documento de arquitectura técnica en `docs/ARCHITECTURE.md`.
- Directrices para agentes en `AGENTS.md` con soporte para ADRs y Changelog.
- Suite de pruebas automatizadas con Vitest y Playwright.

### Características Principales
- Tablero interactivo con gestión de tareas, reuniones e interrupciones.
- Entornos duales de trabajo (*Trabajo* y *Personal*).
- Modo de concentración (*Focus View*) y soporte de atajos de teclado rápidos.
- Sincronización en la nube con Firebase Firestore y persistencia local *Offline-First*.
- Pausas automáticas (*Auto-breaks*) y proyección de horario del día.
