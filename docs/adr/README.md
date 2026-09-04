# Registros de Decisiones de Arquitectura (ADR)

Este directorio contiene los registros de decisiones técnicas y estructurales tomadas en **TodayTasks**.

## ¿Qué es un ADR?
Un **Architecture Decision Record (ADR)** es un documento breve que captura una decisión arquitectónica importante junto con su contexto y consecuencias.

## Índice de ADRs
* [001. Planificación de tareas a partir de una hora determinada (`startAfter`)](./001-task-start-after-scheduling.md)
* [002. Soporte de Markdown ligero en notas de tareas](./002-task-notes-markdown.md)
* [003. Menú contextual / Popover para reglas de recurrencia](./003-recurring-rules-popover.md)
* [004. Prevención de resurrección de tareas eliminadas mediante Tombstones en la sincronización](./004-sync-tombstones.md)
* [005. Detección automática de nueva versión y auto-sincronización en inactividad](./005-version-auto-sync-idle.md)
* [006. Modo Document Picture-in-Picture (PiP) para Widget Flotante](./006-document-picture-in-picture.md)
* [007. Vista de Triaje Rápido de Tareas (`#/triage`) y Operaciones por Lote](./007-vista-triaje-rapido.md)
* [008. Prevalencia del Orden Manual sobre el Orden Automático (`manualOrder` y `sortTasksWithManualOrder`)](./008-sistema-orden-manual-prevalente.md)
* [009. Arquitectura de Internacionalización (i18n) Multilingüe y Rollout Progresivo](./009-sistema-internacionalizacion-i18n.md)

## Plantilla sugerida para nuevos ADRs (`docs/adr/NNN-titulo.md`)

```markdown
# [Número]. [Título de la decisión]

* **Fecha:** YYYY-MM-DD
* **Estado:** Propuesto / Aceptado / Reemplazado

## Contexto
¿Cuál es el problema o la necesidad técnica que motivó esta decisión?

## Decisión
¿Qué solución o patrón se adoptó y por qué?

## Consecuencias
* **Positivas:** Qué ventajas aporta.
* **Negativas / Compensaciones:** Qué limitaciones o restricciones introduce.
```
