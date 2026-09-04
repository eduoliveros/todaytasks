# Funcionalidades Actuales de TodayTasks

Este documento detalla el catálogo completo de funcionalidades operativas en **TodayTasks** (versión actual `v1.90`).

---

## 1. Entornos Duales e Independientes (Trabajo y Personal)

TodayTasks permite separar completamente los ámbitos de la vida diaria:
* **Entorno Trabajo (💼) y Personal (🏠):** Aislamiento total de tareas, reuniones, interrupciones, horarios semanales e histórico de métricas.
* **Alternancia Rápida:** Cambio de entorno instantáneo desde la cabecera o mediante atajo de teclado (`E` cambia entre Trabajo y Personal).
* **Horarios Semanales:** Capacidad de configurar los horarios semanales de ambos entornos..

---

## 2. Motor de Planificación Dinámica e Inteligente (`scheduler.js`)

El corazón de TodayTasks es su algoritmo de proyección temporal continua:
* **Proyección en Tiempo Real:** Calcula dinámicamente la hora exacta de inicio (`schedStart`) y finalización (`schedEnd`) de cada tarea a partir de la hora actual (`nowMinutes`) o del inicio de la jornada si está en modo planificación.
* **Segmentación por Reuniones:** Si una tarea coincide con una reunión fija, el planificador la divide en segmentos temporales, reanudándola automáticamente al finalizar el bloqueo.
* **Restricción de Hora Mínima de Inicio (`startAfter` / `16:00+`):** Posibilidad de fijar que una tarea no comience antes de una hora determinada.
* **Relleno Inteligente de Huecos (*Gap-Filling*):** Si una tarea tiene restricción de hora mínima (ej. `16:00`), el planificador busca tareas pendientes sin restricciones para ocupar productivamente los tramos matutinos sin dejar huecos muertos.
* **Pausas Automáticas (*Auto-breaks*):**
  * Inserta descansos recomendados calculados tras bloques de trabajo continuo (por defecto 10 min por cada 60 min trabajados).
  * Añade pausas de recuperación tras reuniones prolongadas.
* **Modo Planificación:** Permite simular y planificar la jornada completa como si comenzara al inicio del horario laboral (`workStart`), ideal para preparar el día antes de empezar a trabajar.

---

## 3. Gestión y Ciclo de Vida de Tareas

* **Estados de Tarea:**
  * `pending`: Tarea en espera en la cola.
  * `running`: Tarea con cronómetro activo en ejecución.
  * `paused`: Tarea pausada que acumula tiempo transcurrido.
  * `completed`: Tarea finalizada con registro de tiempo real invertido.
* **Clasificación por Urgencia (Estilo Linear):**
  * `today` (Hoy): Cola de ejecución inmediata.
  * `days` (Próximos días).
  * `week` (Esta semana).
  * `later` (Más adelante).
  * Menú contextual de selección rápida para mover tareas entre horizontes temporales.
* **Tareas Destacadas (⭐ Top 5):**
  * Límite de hasta 5 tareas prioritarias destacadas por día.
  * Modal inteligente de intercambio si se intenta destacar una sexta tarea.
* **Auto-traslado de Pendientes (*Auto-move to Today*):** Las tareas no completadas con esta opción activa se mueven automáticamente al día actual en el cambio de fecha.
* **Notas Enriquecidas con Markdown Ligero:**
  * Soporte para adjuntar notas y enlaces a cada tarea (`notes`).
  * Micro-parser nativo con soporte para **negrita** (`**texto**`), *cursiva* (`*texto*`), enlaces nombrados (`[Título](https://...)`) y detección automática de URLs (`https://...`).
  * Enlaces accionables que abren de forma segura en nueva pestaña (`target="_blank" rel="noopener noreferrer"` con glifo visual `↗`).
  * Píldora interactiva `📝 Notas` en la tarjeta de la lista que despliega un panel colapsable.
  * Barra de herramientas rápida en la edición (`[B]`, `[I]`, `[🔗 Link]`) y previsualización en vivo.
  * Panel de consulta de notas integrado en la vista de foco (Focus View).
* **Opciones Avanzadas Colapsables:** Formulario de creación con panel desplegable para notas/enlaces, hora mínima (`startAfter`), recurrencia y auto-move.
* **Ajuste Rápido de Hora Mínima:** Píldora interactiva en la tarjeta de la tarea (`16:00+ ▾`) y popover flotante para modificarla o eliminarla con 1 clic.
* **Reordenación por Arrastre (Drag & Drop):** Manija táctil y visual para reorganizar el orden de ejecución de la cola.
* **Búsqueda y Filtrado en Tiempo Real:** Barra de búsqueda accesible con `/` para filtrar tareas tanto por título como por el contenido de sus notas.

---

## 4. Ejecución y Control Temporal en Vivo

* **Cronómetro de Alta Precisión:** Medición de tiempo transcurrido combinando minutos enteros y marcas de tiempo Epoch ms (`runningStartEpoch`) para evitar desviaciones si la pestaña pasa a segundo plano.
* **Detección Visual de Exceso de Tiempo (*Overrun*):** Alerta visual e indicador destacado cuando el tiempo real consumido supera el tiempo estimado planificado.
* **Ajuste Rápido de Tiempo Transcurrido:** Popover emergente para modificar los minutos consumidos por la tarea.
* **Transiciones de Estado con un Clic:** Botones directos para Iniciar, Pausar, Reanudar y Completar desde la lista de tareas o desde la vista de foco.

---

## 5. Vistas de Concentración (*Focus View*) e Interrupciones

* **Vista de Foco de Tarea (`#/task/:id`):**
  * Pantalla completa libre de distracciones dedicada a una tarea individual.
  * Anillo de progreso circular interactivo (SVG) que refleja el porcentaje consumido vs. estimado.
  * El anillo muestra si una reunión va a interrumpir la tarea actual, además de indicar el nombre de la reunión y la hora a la que interrumpirá.
  * Botones para iniciar, pausar, reanudar y completar la tarea.
* **Gestor de Interrupciones (`#/interruption`):**
  * Modal/vista a pantalla completa para registrar eventos imprevistos (llamadas, consultas urgentes, bloqueos).
  * Pausa automáticamente la tarea en ejecución cuando se empieza una reunión. (es responsabilidad del usuario reiniciar la tarea).
  * Cronómetro de interrupción en vivo y registro de duración total en el histórico del día.

---

## 6. Gestión de Reuniones y Bloqueos de Agenda

* **Bloqueos Fijos:** Registro de reuniones con hora de inicio y fin que actúan como restricciones duras en el timeline.
* **Reglas de Recurrencia:** Soporte para reuniones que se repiten diariamente o en días específicos de la semana, con gestión de excepciones puntuales por fecha.

---

## 7. Tareas Recurrentes

* **Generación Automática:** Plantillas de tareas periódicas (diarias o en días seleccionados de la semana).
* **Sincronización de Serie:** Propagación de modificaciones (título, duración estimada, hora mínima) a todas las instancias futuras de la regla.
* **Gestión de Excepciones:** Modificar o eliminar una tarea puntual sin romper la serie periódica.

---

## 8. Horario Semanal y Calendario

* **Configuración Semanal:** Definición de horas de inicio y fin (`workStart` / `workEnd`) para cada día de la semana (Lunes a Domingo) o días no laborables.
* **Navegador de Fechas:** Selector de días, navegación día a día y salto rápido a "Hoy" (también pulsando la letra 'D').

---

## 9. Analítica e Histórico de Rendimiento (40 Días)

* **Gráfico Evolutivo SVG Interactivo (`#/history`):**
  * Representación visual de los últimos 40 días.
  * Desglose por barras y líneas: Tiempo efectivo trabajado, tiempo en reuniones, tareas completadas, tiempo consumido en tareas no terminadas e interrupciones.
* **Poda Automática de Datos (*Snapshot & Prune*):** Retención detallada completa de los últimos 10 días y compresión a resúmenes métricos agregados hasta 40 días para optimizar almacenamiento y rendimiento.

---

## 10. Experiencia de Usuario, Accesibilidad y Atajos

* **Control Total por Teclado:**
  * `1` / `2` / `3`: Para cambiar entre los paneles: Resumen, Tiempo y Configuración.
  * `E`: Cambio de entorno: Trabajo / Personal. 
  * `D`: Se mueve a la fecha de hoy.
  * `P`: Alternar Modo Planificación.
  * `T`: Abrir formulario de nueva tarea.
  * `R` / `M`: Abrir formulario de nueva reunión.
  * `I`: Iniciar registro de interrupción imprevista.
  * `/`: Buscador de tareas.
  * `H`: Histórico y métricas.
  * `F`: Vista de concentración de la tarea en ejecución.
  * `Ctrl+Z` / `Ctrl+Y`: Deshacer / Rehacer.
  * `?`: Mostrar modal con todos los atajos.
* **Deshacer / Rehacer (*Undo / Redo*):** Historial con pila de hasta 25 instantáneas reversibles.
* **Notificaciones de Escritorio:** Avisos configurables para descansos, inicio de reuniones y tareas programadas.
* **Temas Visuales:** Soporte para modo Claro (`light`), Oscuro (`dark`) y Automático según preferencias del sistema operativo (`auto`).

---

## 11. Sincronización y Persistencia Offline-First

* **Almacenamiento Local Primario:** Operación 100% funcional sin conexión a internet mediante `localStorage`.
* **Sincronización en la Nube (Firebase Cloud Firestore):**
  * Autenticación con Google (OAuth).
  * Sincronización bidireccional en segundo plano con *debounce* (500 ms).
  * Resolución inteligente de conflictos (`mergeStates`) basada en timestamps y prevención de ecos mediante `clientId`.
  * Vaciado y guardado seguro en eventos `beforeunload` y `pagehide`.

---

## 12. Mini-Widget Flotante con Document Picture-in-Picture (PiP)

* **Ventana Always-on-Top Nativa:** Abre una mini-ventana flotante sobre cualquier aplicación de escritorio (VS Code, terminal, hojas de cálculo) mediante la API nativa `documentPictureInPicture`.
* **Doble Reloj y Cuenta Regresiva Reactiva:**
  * Cuenta regresiva del tiempo restante de la tarea activa (`MM:SS restante`) y conmutación automática a sobretiempo (`+MM:SS tiempo extra`) en rojo/ámbar si se excede la duración estimada.
  * Pastilla de cuenta regresiva en vivo del tiempo restante hasta la próxima reunión (`en MM:SS`) con alerta de pulso cuando faltan < 5 minutos.
  * Muesca de corte por reunión (`▼`) posicionada en la barra de progreso con tooltip interactivo.
* **Modos Dinámicos de Ejecución:**
  * Tarea en curso (pausar, completar, interrumpir).
  * Tarea en pausa (reanudar al instante).
  * Modo interrupción con cronómetro propio y botones de finalización o descarte.
  * Modo reposo que sugiere e inicia la siguiente tarea pendiente en cola.
* **Control por Teclado:** Atajo directo accesible pulsando la tecla <kbd>W</kbd>.

