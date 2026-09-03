# Arquitectura del Proyecto (TodayTasks)

Este documento describe la arquitectura técnica, la estructura modular, los patrones de diseño y el flujo de datos de **TodayTasks**. Su propósito es servir de referencia para desarrolladores y agentes de IA que contribuyan al repositorio.

---

## 1. Visión General y Paradigma

* **Tipo de Aplicación:** Single Page Application (SPA) para la gestión diaria de tareas, reuniones, interrupciones y planificación temporal.
* **Stack Tecnológico:**
  * **Lenguaje:** JavaScript Vanilla nativo con **ES Modules** (`type="module"`).
  * **Sin Bundlers:** No utiliza Webpack, Vite, Rollup ni Babel en tiempo de ejecución. Los archivos `.js` se sirven directamente al navegador.
  * **HTML / CSS:** HTML5 semántico y CSS modular con variables CSS para temas Claro / Oscuro.
  * **Persistencia:** Enfoque **Offline-First** basado en `localStorage`, con capa de sincronización en tiempo real opcional mediante **Firebase Cloud Firestore**.
  * **Testing:** **Vitest** (con `jsdom`) para pruebas unitarias y de integración; **Playwright** para pruebas End-to-End (E2E).

---

## 2. Mapa de Directorios y Organización

```
todaytasks/
├── docs/
│   ├── ARCHITECTURE.md          # Este documento de arquitectura
│   ├── DATA_SCHEMA.md           # Especificación formal del modelo de datos
│   ├── adr/                     # Registros de decisiones de arquitectura
│   └── features/                # Catálogo de funcionalidades y posibles mejoras
│       ├── FEATURES.md          # Catálogo de funcionalidades e funcionalidades actuales
│       └── IMPROVEMENT_IDEAS.md # Propuestas y backlog de mejoras
├── CHANGELOG.md                 # Historial de versiones y cambios
├── js/
│   ├── app.js                   # Orquestador principal, inicialización y ciclo de vida
│   ├── state.js                 # Modelo de datos, normalización y envoltura de estado (wrapState)
│   ├── actions.js               # Fachada coordinadora de mutaciones y lógica de negocio
│   ├── views.js                 # Fachada coordinadora de renderizado y manipulaciones del DOM
│   ├── cloud.js                 # Sincronización con Firebase Firestore, Auth y resolución de conflictos
│   ├── scheduler.js             # Algoritmo de planificación de horarios y pausas automáticas (auto-breaks)
│   ├── history.js               # Instantáneas de historial y limpieza de días pasados
│   ├── undo.js                  # Pila de Deshacer / Rehacer (Undo / Redo)
│   ├── router.js                # Enrutador basado en Hash (#main, #task/:id, #interruption)
│   ├── version.js               # Detección de versiones, inactividad y sincronización entre pestañas
│   ├── pip.js                   # Mini-Widget flotante Always-on-Top con Document Picture-in-Picture
│   ├── notifications.js         # Sub-sistema de notificaciones Web para tareas y reuniones
│   ├── ui.js                    # Utilidades de UI (toasts, modales, sanitización y micro-parser Markdown de notas)
│   ├── utils.js                 # Utilidades puras de tiempo, formateo, fechas y recurrencias
│   ├── config.js                # Configuración de Firebase y constantes globales
│   ├── actions/                 # Submódulos especializados de acciones
│   │   ├── tasks.js             # CRUD, estados, destacados y tiempos de tareas
│   │   ├── meetings.js          # CRUD y gestión de reuniones/bloqueos
│   │   ├── execution.js         # Temporizadores, ejecución de tareas e interrupciones
│   │   ├── dragdrop.js          # Reordenación de tareas y reuniones mediante arrastre
│   │   └── calendar.js          # Navegación entre fechas, semanas y vista calendario
│   ├── views/                   # Submódulos especializados de vista
│   │   ├── dashboard.js         # Reloj, barra de progreso, estadísticas de cabecera y switches
│   │   ├── tasks.js             # Renderizado de lista de tareas y estados visuales
│   │   ├── meetings.js          # Renderizado de reuniones
│   │   ├── board.js             # Tablero visual y resumen de planificación
│   │   ├── focus.js             # Vistas de concentración de tarea e interrupciones
│   │   └── triage.js            # Vista de triaje rápido, agrupación y operaciones masivas
│   └── app/                     # Submódulos auxiliares de app.js
│       ├── forms.js             # Gestión y enlace de formularios del DOM
│       ├── shortcuts.js         # Manejo de atajos de teclado
│       └── weekly-schedule.js   # Gestión del horario semanal recurrente
├── css/
│   ├── base.css                 # Reset básico, tipografía y variables CSS globales
│   ├── layout.css               # Estructura de rejilla, paneles y disposición general
│   ├── header.css               # Estilos de la barra de navegación superior y pestañas
│   ├── modals.css               # Diálogos, modales emergentes y formularios superpuestos
│   ├── theme-dark.css           # Variables y adaptaciones para el modo oscuro
│   ├── focus.css                # Estilos para vistas de concentración
│   ├── calendar.css             # Estilos de la vista calendario y selector de fechas
│   ├── history.css              # Estilos del panel de historial y resumen
│   ├── interruption.css         # Estilos visuales de interrupciones activas
│   ├── pip.css                  # Estilos ultracompactos para el mini-widget Picture-in-Picture
│   ├── triage.css               # Estilos de fila única y barra flotante de triaje rápido
│   └── styles.css               # Archivo agregador de estilos
├── tests/                       # Pruebas unitarias y de integración (Vitest + JSDOM)
├── e2e/                         # Pruebas End-to-End en navegador real (Playwright)
├── AGENTS.md                    # Reglas obligatorias para agentes de IA
├── index.html                   # Página principal y estructura estática del DOM
├── version.json                 # Metadatos de versión estática para auto-sincronización
├── server.js                    # Servidor local Node.js (puerto 8080 con cabeceras no-cache)
├── package.json                 # Dependencias de desarrollo y scripts de test
└── firestore.rules              # Reglas de seguridad para Firestore
```

---

## 3. Patrones de Diseño y Flujo de Datos

### 3.1. Inyección de Dependencias vía Contexto (`ctx`)
Para mantener el código desacoplado y 100% testeable, los módulos no dependen de variables globales. [app.js](../js/app.js) crea un objeto **`ctx`** que agrupa:
* Getters y setters de estado (`getState`, `setState`, `saveState`).
* Métodos de redibujado (`renderAll`, `smartRender`).
* Utilidades de enrutamiento y funciones compartidas.

Cada módulo funcional ([TodayTasksActions](../js/actions.js), [TodayTasksViews](../js/views.js), [TodayTasksCloud](../js/cloud.js), etc.) recibe este `ctx` en su función fábrica constructora.

### 3.2. Ciclo Unidireccional de Datos

```mermaid
graph TD
    User([Usuario / DOM]) -->|1. Evento / Atajo| Actions[actions.js / Submódulos]
    Actions -->|2. Mutación| State[state.js: wrapState]
    State -->|3. Persistencia| LocalStorage[(localStorage)]
    State -->|4. Sync Debounced| Cloud[cloud.js / Firestore]
    State -->|5. Redibujado| Views[views.js / Submódulos]
    Views -->|6. Actualiza| DOM([Interfaz de Usuario])
```

1. **Evento de Usuario:** El usuario interactúa con un elemento de la UI o usa un atajo de teclado.
2. **Acción (`actions.js`):** Valida la lógica de negocio, calcula horas o modifica colecciones.
3. **Estado (`state.js`):** El estado se actualiza a través de `wrapState()`.
4. **Persistencia Local (`saveState`):** Se escribe de forma síncrona e inmediata en `localStorage`.
5. **Sincronización en la Nube (`pushToCloudDebounced`):** Se acumulan los cambios durante 500 ms antes de enviar la carga útil a Firestore con el identificador de cliente `clientId`.
6. **Renderizado (`views.js`):** Se recalculan los horarios mediante `computeSchedule()` y se actualiza el DOM de forma reactiva.

---

## 4. Gestión del Estado (`state.js`)

> Para una especificación detallada campo a campo de todas las entidades, consulta [docs/DATA_SCHEMA.md](./DATA_SCHEMA.md).

### 4.1. Estructura Multientorno y Multidía
El estado raíz maneja dos entornos independientes (`work` y `personal`), y cada entorno organiza los datos por fechas (`YYYY-MM-DD`):

```javascript
{
  activeEnv: "work",              // 'work' | 'personal'
  selectedDate: "2026-08-30",
  environments: {
    work: {
      weeklySchedule: { ... },
      days: {
        "2026-08-30": {
          tasks: [ ... ],
          meetings: [ ... ],
          interruptions: [ ... ],
          planningMode: false
        }
      },
      recurringTasks: [ ... ],
      recurringMeetings: [ ... ],
      activeInterruption: null
    },
    personal: { ... }
  },
  autoBreakEnabled: true,
  autoBreakIntervalMin: 60,
  autoBreakDurationMin: 10,
  themeMode: "auto",
  nextId: 1
}
```

### 4.2. El Proxy Transparente de `wrapState`
Para simplificar el acceso y no obligar al código a navegar por `state.environments[activeEnv].days[selectedDate]...` constantemente, **`wrapState()`** añade getters y setters proxy en el objeto de estado:
* `state.tasks` → Accede automáticamente a las tareas del entorno y día seleccionados.
* `state.meetings` → Accede a las reuniones del entorno y día seleccionados.
* `state.activeInterruption` → Accede a la interrupción activa del entorno seleccionado.

> **Regla de Oro:** Siempre que se cargue, mute o combine un objeto de estado (por ejemplo, desde `localStorage` o Firebase), debe pasarse por `wrapState(rawState)`.

---

## 5. Sincronización en la Nube (`cloud.js`)

* **Identificador de Cliente (`clientId`):** Al arrancar, se genera un ID único por pestaña/sesión. Al guardar en Firestore, se adjunta `_lastUpdatedBy: clientId`. Cuando el listener en tiempo real (`onSnapshot`) recibe una actualización con su propio `clientId`, confirma `"☁ Sincronizado"` y omite re-renderizados innecesarios.
* **Debounce de Escritura:** `pushToCloudDebounced(500)` previene llamadas excesivas a Firestore durante ediciones rápidas.
* **Garantía al Salir (`flushPendingCloudPush`):** En los eventos `beforeunload` y `pagehide`, cualquier envío pendiente en el debounce se descarga y envía de inmediato.
* **Combinación de Datos (`mergeStates`):** Si entran cambios remotos desde otro dispositivo, `mergeStates` combina tareas, reuniones y horarios sin sobreescribir destructivamente el trabajo local.
* **Registro de Borrados y Tombstones (`_deletedIds` / `_deletedRecurringIds`):** Para evitar que tareas o reuniones eliminadas en un dispositivo resuciten al sincronizar con otro que aún las conserva en memoria local, las acciones de borrado registran los IDs eliminados en un array de lápidas (*tombstones*). Durante `mergeStates`, estos IDs son excluidos de la combinación y propagados entre dispositivos, asegurando que las eliminaciones prevalezcan de forma bidireccional sin contaminar la lista de tareas activas. Los tombstones diarios se limpian automáticamente mediante la poda (*pruning*) de días antiguos (> 10 días).

---

## 6. Algoritmo de Planificación (`scheduler.js`)

* **Bloqueos por Reuniones:** `computeMeetingClusters` agrupa reuniones solapadas o consecutivas y reserva automáticamente descansos post-reunión.
* **Pausas Automáticas (*Auto-breaks*):** Si está activado `autoBreakEnabled`, el algoritmo inserta bloques de descanso recomendados (por defecto 10 min por cada 60 min de trabajo) entre las tareas del día.
* **Restricción de Inicio Mínimo (`startAfter`):** Si una tarea tiene configurada una hora mínima de inicio (`startAfter`), el planificador aplica un algoritmo de *relleno inteligente de huecos (gap-filling)*: programa las tareas sin restricción en los espacios libres matutinos y programa la tarea diferida a partir de la hora requerida, evitando huecos muertos.
* **Proyección Temporal y Detección de Desbordamiento (`overflowIds`):** `computeSchedule` calcula la hora estimada de inicio (`schedStart`) y fin (`schedEnd`) para cada tarea según la hora actual (`nowMinutes`) o el inicio de jornada (`planningMode`). Las tareas cuya finalización proyectada excede la hora de fin de jornada (`workEnd`) se agregan a `overflowIds`, lo que permite destacarlas visualmente en la lista de tareas (`.task-overflow` y `.overflow-badge`) tanto en Modo Planificación ON como OFF.

---

## 7. Popovers Contextuales e Inspección Rápida

La interfaz utiliza menús flotantes contextuales ligeros (*popovers*) para configurar propiedades o consultar metadatos sin abrir modales pesados:
* **Popover de Ajuste de Tiempo (`#timePopover`):** Ajuste rápido de minutos consumidos en tareas.
* **Popover de Inicio Mínimo (`#startAfterPopover`):** Selector de hora `startAfter` con atajo directo desde la tarjeta.
* **Popover de Reglas Recurrentes (`#recurringInfoPopover`):** Desglose dinámico de la regla periódica asociada (`formatRecurrenceRule`), mostrando frecuencia, intervalo, días activos, vigencia y acceso a edición de serie tanto para tareas como para reuniones.
* **Dropdown de Urgencia (`#urgencyDropdownMenu`):** Selector estilo Linear para cambiar entre *Hoy*, *Días*, *Semana* y *Más adelante*.

---

## 8. Píldora Dual de Desviación del Plan (`computeDayDeviation` y `css/header.css`)

El panel *Resumen* de la cabecera incluye un indicador en formato **chip dual** (`⏱ Real / Plan [±Delta]`) que compara el tiempo real consumido frente a la duración planificada de las tareas de la jornada:

* **Modelo Matemático Híbrido Realista:**
  - Implementado en `computeDayDeviation(tasks, nowVal)` dentro de [`js/utils.js`](../js/utils.js).
  - Devuelve `{ deviationMin, realMin, plannedMin, evaluatedCount }`.
  - **Tareas completadas:** $\text{actualDuration} - \text{planned}$ (ahorro consolidado con signo negativo o sobrecoste con signo positivo).
  - **Tareas en curso (`running` o `paused`):** Solo si el tiempo consumido ya ha rebasado la estimación ($\text{elapsed} > \text{planned}$), se computa el sobrecoste acumulado en tiempo real. Si la tarea está dentro del margen previsto, computa $0$ para erradicar falsos adelantos al inicio de una tarea.
* **Presentación Visual (Chip Dual):**
  - Muestra explícitamente ambas magnitudes y una pastilla destacada con el delta neto (ej. `⏱ 1h 15m / 1h 00m [+15m]`).
  - **Semántica:** Rojo (`.stat-dev-over`) en retraso, verde (`.stat-dev-under`) en adelanto/ahorro y neutro (`.stat-dev-neutral`) en paridad.
  - **Visibilidad condicionada:** El chip solo se renderiza si `evaluatedCount > 0`, evitando ruido visual antes de iniciar o concluir trabajo.

---

## 9. Detección Automática de Versión y Sincronización en Inactividad (`version.js`)

TodayTasks implementa una arquitectura híbrida de detección de actualizaciones de código y recarga segura sin intervención manual:
* **Detección Reactiva y Periódica:**
  - Consulta pasiva y ligera al archivo `/version.json` (con fallback a `index.html` sin caché).
  - Verificación inmediata en eventos de ciclo de vida (`visibilitychange` / `focus`) cuando la pestaña recupera el foco.
  - Polling pasivo cada 10 minutos de fondo.
* **Coordinación Multi-Pestaña (`BroadcastChannel`):**
  - Utiliza `new BroadcastChannel('todaytasks_version_channel')` para notificar a todas las pestañas abiertas en el mismo navegador cuando se detecta una nueva versión.
* **Auto-Recarga Segura en Inactividad (*Safe Idle Reload*):**
  - Tras 5 minutos sin interacción del usuario (o tras permanecer oculta en segundo plano), la aplicación se recarga automáticamente.
  - **Condiciones de Seguridad:** Se valida que no existan formularios abiertos (`taskEdit === null && meetingEdit === null`), inputs con foco o modales visibles.
  - **Persistencia Previa:** Se invocan `saveState()` y `flushPendingCloudPush()` antes de recargar para asegurar que la tarea en marcha, tiempos y estado queden 100% preservados.
* **UI No Intrusiva:**
  - Si el usuario está activo, se muestra la insignia interactiva `#versionUpdateBadge` en la barra superior (`✨ v1.94 lista [Actualizar]`) permitiendo actualización manual inmediata.

## 10. Mini-Widget Flotante Always-on-Top (`pip.js` y `css/pip.css`)

TodayTasks integra la API nativa de navegadores **Document Picture-in-Picture** (`window.documentPictureInPicture`) para proyectar un visor flotante interactivo y persistente mientras el usuario trabaja en otras aplicaciones de escritorio:
* **Contexto Compartido:** La ventana PiP comparte el mismo hilo y contexto de memoria JavaScript que la ventana principal, permitiendo que los botones invoquen directamente los métodos de negocio (`actionsModule.pauseTask()`, `actionsModule.completeTask()`, `actionsModule.startInterruption()`, etc.) sin latencia ni serialización.
* **Sincronización Reactiva Bidireccional:**
  - `renderAll()` y `smartRender()` notifican a `pipModule.render()` en cada mutación de estado.
  - `applyTheme()` propaga el tema Claro/Oscuro (`data-theme="dark"`) a la ventana PiP de forma instantánea.
* **Doble Reloj en Cuenta Regresiva:**
  - Muestra la cuenta regresiva del tiempo restante de la tarea planificada y cambia automáticamente a sobretiempo (`+MM:SS`) con alerta visual en rojo/ámbar si se excede la duración estimada.
  - Si hay reuniones programadas, muestra una pastilla de cuenta regresiva en vivo (`en MM:SS`) y una muesca de corte (`▼`) en la barra de progreso.
* **Modo Interrupción:** Al iniciar una interrupción, el widget conmuta a un temporizador de interrupción activo con botones para finalizar o descartar.
* **Progressive Enhancement:** Detección de soporte mediante `'documentPictureInPicture' in window` y atajo de teclado accesible con la tecla <kbd>W</kbd>.

---

## 11. Vista de Triaje Rápido y Operaciones Masivas (`triage.js`, `triage.css`, `#/triage`)

Para resolver la sobrecarga cognitiva cuando se acumulan decenas de tareas pendientes, TodayTasks incorpora una vista dedicada y libre de distracciones:
* **Enrutamiento y Atajo:** Accesible en la ruta `#/triage` y conmutable mediante la tecla <kbd>X</kbd> o el botón `⚡ Triaje` en la cabecera de tareas. La tecla <kbd>Esc</kbd> permite regresar de inmediato al tablero.
* **Agrupaciones Dinámicas:**
  - **Urgencia (por defecto):** 🟠 Hoy, 🔵 Próximos días, 🟣 Esta semana, ⚪ Más adelante.
  - **Viabilidad hoy:** ✅ Caben en el horario de hoy vs ⚠️ Desbordan la jornada (*overflow* proyectado por `scheduler.js`).
  - **Duración:** ⚡ Quick Wins (≤ 15 min), ⏳ Medias (20-45 min), 🏋️ Largas (> 45 min).
  - **Destacadas:** ⭐ Top 5 destacadas vs 📋 Otras tareas en cola.
* **Ordenación y Reordenación por Arrastre:** Las tareas se muestran en el mismo orden que en la pantalla principal (`a.order - b.order`, con las tareas en curso al principio). La ordenación manual tiene prioridad máxima sobre cualquier criterio automático y cada fila cuenta con manija de arrastre táctil/visual (puntitos `⠿`) para reordenar la cola mediante drag & drop directamente en la vista de triaje.
* **Filas de Tarea en 1 Sola Línea:** Cada tarea muestra su manija de arrastre (`⠿`), checkbox, estrella interactiva, título truncado con elipsis (`...`), duración al lado, botón directo de urgencia con popover, 5 botones rápidos con los días hábiles calculados según `weeklySchedule`, botón de completado directo (`✓`) y botón de borrado directo (`🗑️`).
* **Operaciones Masivas y Barra Flotante (`#triageFloatingBar`):** Permite selección múltiple de tareas (individual o por grupo completo) y ofrece mover a cualquiera de los próximos 7 días laborables, cambiar urgencia en lote, destacar en lote, completar en lote (`✓ Completar`) o borrar en lote con confirmación y soporte transaccional de Undo (`Ctrl+Z`).

---

## 12. Prevalencia del Orden Manual sobre el Orden Automático (`manualOrder` y `sortTasksWithManualOrder`)

TodayTasks implementa un modelo híbrido donde las decisiones explícitas de reordenación del usuario prevalecen sobre el auto-sort automático por prioridad:
* **Tareas Ancladas (`manualOrder: number`) vs Flotantes (`manualOrder: null`):**
  - Cuando el usuario reordena una o más tareas manualmente (mediante drag & drop en el tablero o en triaje, o mediante los botones ▲ / ▼ de subir/bajar), todas las tareas activas de la cola quedan **ancladas** asignándoles su posición ordinal en `t.manualOrder`.
  - Las tareas nuevas, creadas por defecto o restauradas de completadas, nacen como **flotantes** (`manualOrder: null`).
* **Invariantes del Algoritmo de Merge (`sortTasksWithManualOrder`):**
  1. **La tarea en ejecución (`running`)** siempre tiene prioridad absoluta al inicio del día.
  2. **La primera tarea anclada (`anchored[0]`)** nunca puede ser superada por ninguna tarea flotante nueva o editada (salvo que el usuario elija explícitamente "Añadir al inicio" con `toTop: true`).
  3. **Preservación del ancla ante cambios de urgencia o destacado:** Modificar la urgencia o el estado destacado de una tarea anclada cambia su etiqueta e icono, pero no destruye su posición fija en la lista.
  4. **Intercalado inteligente de nuevas tareas:** Las tareas flotantes se insertan automáticamente antes de tareas ancladas de prioridad inferior (por ejemplo, antes de una tarea que el usuario mandó conscientemente al final del día como 'más adelante').
* **Acción para Restablecer Orden Automático (`applyAutoOrder`):**
  - Tanto en la vista de triaje rápido (`#triageAutoOrderBtn`) como en el panel de configuración (`#autoOrderBtn`), el usuario dispone de un botón `⚡ Orden automático` que limpia todas las anclas (`manualOrder = null`), reordena estrictamente por prioridad (urgencia → destacada) y registra un snapshot en el historial de deshacer (`Ctrl+Z`).

---

## 13. Directrices para Nuevos Desarrollos

1. **Separación Estricta de Responsabilidades:**
   * Las vistas (`views/`) **no** deben mutar el estado directamente; deben delegar en las acciones (`actions/`).
   * Las acciones (`actions/`) **no** deben manipular el DOM directamente; deben solicitar redibujados a través de `ctx.renderAll()` o `ctx.smartRender()`.
2. **Generación de IDs:**
   * Utilizar siempre `ctx.newId()`, que emplea `crypto.randomUUID()` con fallback seguro.
3. **Persistencia y Sanitización:**
   * Al pintar cadenas de texto procedentes del usuario en el HTML, usar siempre `escapeHtml()` o `escapeAttr()` de [ui.js](../js/ui.js).
4. **Metodología de Pruebas:**
   * Toda nueva funcionalidad debe acompañarse de sus pruebas unitarias en `tests/`.
   * En corrección de errores, implementar primero el test unitario que reproduzca el fallo (TDD) antes de aplicar la solución.
5. **Versionado:**
   * Al realizar cambios de versión importantes, actualizar de forma sincronizada tanto `index.html` como `version.json`.

