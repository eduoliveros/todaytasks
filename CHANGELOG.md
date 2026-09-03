# Registro de Cambios (CHANGELOG)

Todos los cambios notables en **TodayTasks** se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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
