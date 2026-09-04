# Fase 5: Triaje Rápido, Horario Semanal e Histórico — Hoja de Ruta de Subfases

Este documento define la descomposición operativa, alcance y orden de ejecución para la Fase 5 de internacionalización de TodayTasks. A medida que se implemente cada subfase, se incrementará el número de versión (`1.100.5.1`, `1.100.5.2`, etc.) para identificar con precisión el avance del proyecto.

---

## Índice de Subfases y Versiones

| Subfase | Nombre | Módulos afectados | Versión asociada | Estado |
|---|---|---|---|---|
| **5.1** | Triaje Rápido | `js/views/triage.js`, tests asociados | **`v1.100.5.1`** | 🟢 Completada |
| **5.2** | Horario Semanal Recurrente | `js/app/weekly-schedule.js`, tests asociados | **`v1.100.5.2`** | 🟢 Completada |
| **5.3** | Panel Histórico y Gráfica Evolutiva | `js/history.js`, tests asociados | **`v1.100.5.3`** | 🟢 Completada |

---

## Detalle de Subfases

### Subfase 5.1: Triaje Rápido (`js/views/triage.js`)
* **Objetivo:** Internacionalizar la vista completa de triaje rápido (`#/triage`), incluyendo cabeceras, botones de ordenación/agrupación, encabezados de grupo, filas de tareas, barra flotante de acciones masivas y modal/popovers de edición.
* **Archivos implicados:**
  - `js/views/triage.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/triage.test.js` y nuevos tests específicos de i18n
* **Versión resultante:** `v1.100.5.1`

### Subfase 5.2: Horario Semanal Recurrente (`js/app/weekly-schedule.js`)
* **Objetivo:** Traducir el modal de configuración de horario de trabajo por día de la semana (`#weeklyScheduleModal`), etiquetas de estado ("Día libre", "Configurado"), selectores de hora, botones de guardar/cerrar y toasts de confirmación.
* **Archivos implicados:**
  - `js/app/weekly-schedule.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/weekly_schedule_modal.test.js`
* **Versión resultante:** `v1.100.5.2`

### Subfase 5.3: Panel Histórico y Gráfica Evolutiva (`js/history.js`)
* **Objetivo:** Traducir la pantalla de histórico (`#/history`), selector de series temporales, leyendas y tooltips del gráfico SVG interactivo, métricas agregadas (promedios, desviaciones, totales) y tabla de los últimos 40 días.
* **Archivos implicados:**
  - `js/history.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/history.test.js`
* **Versión resultante:** `v1.100.5.3`

---

## Protocolo de Ejecución por Subfase
1. Actualizar versión a `v1.100.5.x` en `index.html`, `version.json` y registrar en `CHANGELOG.md`.
2. Actualizar estado en este documento.
3. Definir claves y textos en `js/i18n/es.js` y `js/i18n/en.js`.
4. Reemplazar cadenas hardcodeadas por llamadas a `t(...)` en el módulo.
5. Desarrollar pruebas unitarias bilingües (TDD) para validar ambos idiomas.
6. Ejecutar `npm test` para asegurar regresión cero (100% tests pasando).
