# Fase 3: Módulos Base, Fechas y Formateo — Hoja de Ruta de Subfases

Este documento define la descomposición operativa, alcance y orden de ejecución para la Fase 3 de internacionalización de TodayTasks. A medida que se implemente cada subfase, se incrementará el número de versión (`1.100.3.1`, `1.100.3.2`, etc.) para identificar con precisión el avance del proyecto.

---

## Índice de Subfases y Versiones

| Subfase | Nombre | Módulos afectados | Versión asociada | Estado |
|---|---|---|---|---|
| **3.1** | Fechas, Duraciones y Recurrencia | `js/utils.js`, `tests/utils.test.js` | **`v1.100.3.1`** | 🟢 Completada |
| **3.2** | Feedback Visual, Modales y Deshacer | `js/ui.js`, `js/undo.js`, `js/actions/*.js`, tests | **`v1.100.3.2`** | 🟢 Completada |
| **3.3** | Notificaciones y Sincronización Cloud | `js/notifications.js`, `js/cloud.js`, tests asociados | **`v1.100.3.3`** | 🟢 Completada |

---

## Detalle de Subfases

### Subfase 3.1: Fechas, Duraciones y Recurrencia (`js/utils.js`)
* **Objetivo:** Internacionalizar todas las funciones utilitarias puras que manipulan textos temporales, parsing de duraciones y descripciones de repetición.
* **Archivos implicados:**
  - `js/utils.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/utils.test.js` y `tests/i18n.test.js`
* **Funciones a adaptar:**
  1. `parseDuration(str)`: Soporte bilingüe de unidades horarias y minutarias (`horas?|hours?|hrs?|h`, `minutos?|minutes?|mins?|m`).
  2. `getDayAbbr(dateStr)` y `getDayName(idx)`: Abreviaturas y nombres de días localizados (`Lun..Dom` $\leftrightarrow$ `Mon..Sun`).
  3. `formatDateFriendly(dateStr)`: `"Hoy"`, `"Lunes, 3 ene"` $\leftrightarrow$ `"Today"`, `"Monday, Jan 3"`.
  4. `getNextWorkingDays(startDateStr, count)`: Etiquetas de `"Mañana"`, `"Pasado mañana"`, nombres de días y meses.
  5. `formatRecurrenceRule(rule)`: Textos de frecuencia (`"Diaria"`, `"Semanal"`), intervalos (`"Cada 2 semanas"`), días y vigencia (`"Desde..."`, `"Hasta..."`, `"Indefinida"`).
  6. `fmtRemaining(plannedEndMin, nowMin)`: `"quedan 15 min"` / `"excedida 10 min"` $\leftrightarrow$ `"15 min left"` / `"10 min overrun"`.
  7. `getUrgencyLabel(urgencyKey)`: Etiquetas bilingües de urgencia para UI (`Hoy, Días, Semana, Más adelante` $\leftrightarrow$ `Today, Days, Week, Later`).

---

### Subfase 3.2: Feedback Visual, Modales y Deshacer (`js/ui.js`, `js/undo.js` y acciones)
* **Objetivo:** Internacionalizar los toasts de confirmación, botón de acción por defecto y el histórico de pila de Deshacer / Rehacer.
* **Archivos implicados:**
  - `js/ui.js`
  - `js/undo.js`
  - `js/actions/tasks.js`, `js/actions/meetings.js`, `js/actions/execution.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/undo.test.js`, `tests/ui_helpers.test.js`, `tests/tasks.test.js`
* **Implementación completada:**
  1. `showToast` con botón localizado dinámicamente ("Deshacer" / "Undo") vía `t('action.undo')`.
  2. Mensajes de pila de Deshacer / Rehacer bilingües (`undo.noActions`, `undo.undoneAction`, `undo.redoneAction`, etc.).
  3. Formateador inteligente `formatActionDescription(desc)` en `js/undo.js` para traducir dinámicamente nombres de acciones (`actions.taskAdded`, `actions.taskDeleted`, etc.).
  4. Toasts de borrado y completado de tareas/reuniones localizados (`tasks.taskDeletedToast`, `meetings.meetingDeletedToast`, `task.completed`, etc.).
  5. Diálogos de confirmación para borrado de tareas y reuniones recurrentes localizados (`modal.deleteRecurringTaskTitle`, `modal.deleteRecurringMeetingTitle`, etc.).
  6. Etiquetas de intervalo de recurrencia dinámicas en formularios (`semana(s)` / `week(s)` y `día(s)` / `day(s)`).

---

### Subfase 3.3: Notificaciones y Sincronización Cloud (`js/notifications.js` y `js/cloud.js`)
* **Objetivo:** Internacionalizar los avisos push del navegador / sistema operativo y los estados de conexión/sincronización con Firebase.
* **Archivos implicados:**
  - `js/notifications.js`
  - `js/cloud.js`
  - `js/i18n/es.js` y `js/i18n/en.js`
  - `tests/notifications_subsystem.test.js`, `tests/cloud.test.js`
* **Implementación completada:**
  1. `notificationPermissionLabel()` y `#notifyBtn`: `"Avisos: activados"`, `"desactivados"`, `"bloqueados"` $\leftrightarrow$ `"Alerts: enabled"`, `"disabled"`, `"blocked"`.
  2. Notificaciones push y toasts de tareas en marcha y reuniones inminentes:
     - `notifications.taskTimeEndTitle` / `notifications.taskTimeEndBody`
     - `notifications.taskOverrunBody` / `notifications.taskRemainingBody`
     - `notifications.meeting2minTitle` / `notifications.meeting2minBody`
     - `notifications.meetingStartTitle` / `notifications.meetingStartBody`
     - `notifications.meetingAutoPausedTask`
  3. Mensajes de conexión y sincronización en `cloud.js`:
     - Estados de sync: `"⏳ Guardando en la nube…"`, `"☁ Sincronizado"`, `"⚠ Error al sincronizar"`, `"⏳ Cambios pendientes…"`, etc.
     - Toasts de subida protegida, datos cargados, mezcla remota y actualización desde otro dispositivo.
     - Botones de autenticación: `"Cerrar sesión"` / `"Sign out"`, `"☁ Iniciar sesión con Google"` / `"☁ Sign in with Google"`.
     - Copias de seguridad y restauración local.
  4. Tests unitarios con verificación bilingüe añadidos en `tests/notifications_subsystem.test.js` y `tests/cloud.test.js`.
