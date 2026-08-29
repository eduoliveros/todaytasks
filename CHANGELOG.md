# Registro de Cambios (CHANGELOG)

Todos los cambios notables en **TodayTasks** se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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
