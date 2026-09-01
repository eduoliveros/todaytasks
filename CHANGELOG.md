# Registro de Cambios (CHANGELOG)

Todos los cambios notables en **TodayTasks** se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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
