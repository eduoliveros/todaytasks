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
* [010. Buscador Global de Tareas y Command Palette (`Ctrl+K`)](./010-buscador-global-command-palette.md)
* [011. Sistema de Etiquetas (Tags) en Tareas y Autocompletado de Hashtags](./011-sistema-etiquetas-tags-y-autocompletado.md)
* [012. Triaje en Móvil: Botones Undo/Redo, Movimiento por Pulsación Prolongada (Long-Press) y Creación de Tareas](./012-triaje-movil-gestos-y-creacion-tareas.md)
* [013. Identificadores Visibles de Tarea (W-1, P-1), Copiado Rápido y Búsqueda](./013-identificadores-visibles-tareas-y-copiado.md)
* [014. Sistema de Referencias a Personas (@Nombre), Color Único y Autocompletado](./014-referencias-personas-menciones-autocompletado.md)
* [015. Triaje: Creación de Tareas Recurrentes y Reutilización del Sistema de Recurrencia](./015-triaje-creacion-tareas-recurrentes.md)
* [016. Dependencias Direccionales entre Tareas (`dependsOn`), Detección de Ciclos y Desbloqueo Suave](./016-dependencias-entre-tareas.md)
* [017. Aislamiento de Desviación Diaria y Métricas de Cabecera para Tareas Trasladadas (`initialElapsed`)](./017-aislamiento-desviacion-y-metricas-diarias.md)
* [018. Búsqueda de Tareas en Triaje y Autocompletado de Etiquetas (#) y Menciones (@) en Edición](./018-triaje-busqueda-y-autocompletado-edicion.md)
* [019. Triaje: Reordenación Masiva y Movimiento en Bloque de Tareas Multiseleccionadas](./019-triaje-reordenacion-masiva-bloque-seleccionado.md)
* [020. Resiliencia de Sincronización en el Ciclo de Vida Móvil (Pestaña Oculta / Pantalla Bloqueada)](./020-resiliencia-sincronizacion-ciclo-de-vida-movil.md)
* [021. Vista Móvil Compacta y Bottom Sheet Modal de Acciones Rápidas para Tareas](./021-vista-movil-compacta-bottom-sheet.md)
* [022. Reordenación Táctil por Pulsación Prolongada (Long-Press) en Lista de Tareas](./022-drag-drop-tactil-long-press.md)
* [023. Restricciones de Ordenación en Drag & Drop (Dependencias y `startAfter`)](./023-restricciones-ordenacion-dragdrop-dependencias-startafter.md)
* [024. Modularización de la Vista de Triaje Rápido (`js/views/triage/`)](./024-modularizacion-vista-triaje.md)
* [025. Drag & Drop Híbrido por Pulsación Prolongada con Ratón (*Mouse Long-Press*) en Vistas Compactas](./025-drag-drop-hibrido-raton-long-press.md)

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
