# Registro de Cambios (CHANGELOG)

Todos los cambios notables en **TodayTasks** se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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
