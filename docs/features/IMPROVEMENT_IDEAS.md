# 💡 Ideas de Nuevas Funcionalidades y Mejoras para TodayTasks

Catálogo ampliado de 26 propuestas de mejora y nuevas funcionalidades para **TodayTasks**, estructuradas a partir del análisis del motor de proyección temporal (`scheduler.js`), la arquitectura offline-first, los modos de concentración y las oportunidades de valor para el usuario.

---

## 🏆 Tier 1 — Alto Impacto y Prioridad Estratégica

### 1. Subtareas / Checklist dentro de una Tarea
* **Descripción:** Permitir que cada tarea contenga una lista de pasos o subtareas con casilla de verificación (*checklist*). El progreso visual de la tarjeta reflejaría cuántos sub-ítems se han completado (ej. `3/5 ✓`).
* **Valor para el usuario:** Las tareas grandes o compuestas se vuelven más manejables sin romper el modelo de planificación temporal ni saturar la lista principal.

---

### 2. Etiquetas / Tags con Filtro Rápido
* **Descripción:** Añadir etiquetas personalizadas con color libre (ej. `#frontend`, `#urgente`, `#cliente-X`, `#admin`) a las tareas y permitir filtrar la vista por una o varias etiquetas.
* **Valor para el usuario:** Categorización transversal sin depender únicamente del entorno (*Trabajo/Personal*) o del nivel de urgencia. Facilita análisis del tipo "¿cuánto tiempo dediqué a este cliente o proyecto esta semana?".

---

### 3. Exportación / Importación Manual de Datos (JSON)
* **Descripción:** Opciones explícitas en configuración para descargar una copia de seguridad completa del estado en formato `.json` y restaurarla cuando sea necesario con validación de esquema.
* **Valor para el usuario:** Soberanía total de los datos, copias de seguridad locales de emergencia y portabilidad instantánea entre navegadores o dispositivos sin requerir autenticación en la nube.

---

### 4. Notas y Descripción Enriquecida en Tareas (**Implementado**)
* **Descripción:** Campo de texto expandible (soporte para texto plano o Markdown ligero) en cada tarea para almacenar contexto, enlaces, checklists rápidos o notas de avance.
* **Valor para el usuario:** Evita la necesidad de recurrir a herramientas externas de notas durante la ejecución de la jornada.

---

### 5. Plantillas de Día (*Day Templates*)
* **Descripción:** Capacidad de guardar estructuras de tareas habituales como plantillas reutilizables (ej. "Lunes de Planificación", "Día de Guardias", "Cierre Contable") y aplicarlas con un clic para precargar las tareas del día.
* **Valor para el usuario:** Ahorro de tiempo diario y reducción de fricción en rutinas periódicas.

---

## 🥈 Tier 2 — Motor de Planificación Inteligente y Horizontes Temporales

### 6. Detector de "Día Imposible" y Alerta de Sobrecarga
* **Descripción:** Si la suma de tareas, reuniones y pausas proyecta un fin de jornada (`schedEnd`) que supera la hora límite laboral (`workEnd`), se activa una advertencia visual destacada (ej. `⚠️ +45 min sobre tu hora de salida`) junto con acciones sugeridas con 1 clic: *"Mover tareas sobrantes a mañana"* o *"Redistribuir tiempos"*.
* **Valor para el usuario:** Previene el agotamiento (*burnout*), combate el optimismo excesivo al planificar y protege los límites personales.

---

### 7. Factor de Desvío Personal (*Velocity / Drag Factor*)
* **Descripción:** Cálculo analítico a partir de los 40 días de histórico sobre el desvío promedio en las estimaciones (ej. el usuario suele tardar un $+18\%$ más de lo estimado). Incluye un modo opcional *"Planificación Realista"* que infla las estimaciones antes de calcular la proyección horaria.
* **Valor para el usuario:** Proyecciones del día mucho más certeras y ajustadas a la realidad del individuo.

---

### 8. Dependencias y Bloqueos entre Tareas
* **Descripción:** Posibilidad de vincular tareas indicando que la *Tarea B* no puede comenzar hasta que la *Tarea A* esté completada. El planificador no asigna hora de inicio a la Tarea B hasta que la Tarea A haya finalizado.
* **Valor para el usuario:** Soporte para pipelines y flujos de trabajo secuenciales sin alterar el orden manual constantemente.

---

### 9. Vista Semanal / Resumen de la Semana
* **Descripción:** Tablero de vista panorámica que presente los 5-7 días de la semana con sus tareas y reuniones en formato condensado, permitiendo balancear la carga de trabajo y arrastrar tareas entre días.
* **Valor para el usuario:** Facilita la planificación estratégica semanal frente al enfoque exclusivamente diario.

---

### 10. Objetivos Semanales / Metas de Tiempo
* **Descripción:** Definir metas de tiempo por categoría/etiqueta (ej. "Dedicar ≥8h a desarrollo core") y seguir el cumplimiento en una barra de progreso semanal alimentada por el histórico.
* **Valor para el usuario:** Conecta la ejecución táctica diaria con metas de rendimiento a medio plazo.

---

### 11. Manipulación Directa de Bloques en el Timeline Visual
* **Descripción:** Arrastre y redimensionamiento interactivo de bloques directamente sobre la barra visual del día (*board*), recalculando las duraciones estimadas y el orden temporal al soltar.
* **Valor para el usuario:** Experiencia de usuario más ágil, táctil y visual para ajustar la agenda.

---

### 12. Reglas de Recurrencia Mensuales y Avanzadas
* **Descripción:** Soporte para frecuencias mensuales (ej. "el día 1 de cada mes", "el último viernes del mes") o por intervalos personalizados (ej. "cada 2 semanas").
* **Valor para el usuario:** Cobertura de eventos y obligaciones no semanales (pagos, cierres mensuales, retrospectivas quincenales).

---

## 🎯 Tier 3 — Modo Foco, Concentración y Hábitos de Productividad

### 13. Mini-Widget Flotante con Document Picture-in-Picture (PiP)  (**Implementado**)
* **Descripción:** Utilizar la API nativa de navegadores `Document Picture-in-Picture` para abrir una mini-ventana flotante *"Always on Top"* mientras el usuario trabaja en otras aplicaciones (VS Code, terminal, hojas de cálculo). Muestra la tarea activa, cronómetro en vivo y botones de pausa/completar/interrupción.
* **Valor para el usuario:** Control absoluto del tiempo y estado de la tarea sin necesidad de cambiar constantemente de ventana o pestaña.

---

### 14. Modo Pomodoro Integrado
* **Descripción:** Opción en la ejecución de tareas para alternar ciclos Pomodoro (25 min de trabajo enfocado + 5 min de descanso) con alertas sonoras o notificaciones visuales, sincronizado con el cronómetro de la tarea.
* **Valor para el usuario:** Integra una técnica clásica de productividad dentro del flujo de concentración de la aplicación.

---

### 15. Cuenta Atrás y Alarma de *Timeboxing* Estricto
* **Descripción:** Modo alternativo de visualización del cronómetro con cuenta regresiva, advirtiendo suavemente cuando se consume el tiempo planificado.
* **Valor para el usuario:** Fomenta la disciplina en tareas donde el perfeccionismo tiende a provocar *time-creep*.

---

### 16. Generador de Ruido Blanco y Audio Ambiental (Web Audio API)
* **Descripción:** Generador sintético de sonidos relajantes (lluvia, cafetería, ruido marrón) implementado directamente mediante nodos nativos de `Web Audio API`, sin requerir descargas pesadas de audio ni conexión a internet.
* **Valor para el usuario:** Entorno de concentración inmediata en la vista de foco (`#/task/:id`) sin depender de reproductores externos.

---

### 17. Rutina Guiada de Cierre de Jornada (*Daily Shutdown Ritual*)
* **Descripción:** Modal interactivo de 1 minuto al llegar al fin de la jornada laboral (`workEnd`) para celebrar el tiempo efectivo completado, decidir el destino de tareas pendientes (auto-move, archivar o posponer) y fomentar la desconexión mental.
* **Valor para el usuario:** Higiene mental, reducción de fatiga cognitiva y separación nítida entre jornada laboral y vida personal.

---

### 18. Generador de "Daily Standup" al Portapapeles
* **Descripción:** Atajo (`Ctrl+Shift+C`) o botón rápido que genera y copia al portapapeles un resumen del día estructurado en Markdown limpio para enviar a canales de equipo (Slack, Teams, Discord) con lo completado, lo en progreso y las reuniones atendidas.
* **Valor para el usuario:** Ahorra tiempo en la redacción de informes diarios de sincronización de equipo.

---

### 19. División Rápida de Tarea en Curso (*Split Task*)
* **Descripción:** Botón *"Dividir"* durante la ejecución de una tarea: consolida el tiempo transcurrido hasta el momento como completado y crea automáticamente una segunda parte con el tiempo restante para continuar más adelante.
* **Valor para el usuario:** Facilita la adaptación a interrupciones mayores o replanificaciones a mitad de jornada sin cálculos manuales.

---

## 🔌 Tier 4 — Integraciones, Ergonomía y PWA

### 20. Suscripción e Importación de Calendarios Externos (`.ics` / Google Calendar)
* **Descripción:** Posibilidad de importar archivos `.ics` o vincular una URL de calendario iCal en modo solo-lectura para reflejar automáticamente las reuniones de Google Calendar / Outlook como bloqueos temporales en TodayTasks.
* **Valor para el usuario:** Evita la doble gestión de agenda y asegura que el planificador respete los eventos corporativos existentes.

---

### 21. PWA Completa (Instalable y Offline con Service Worker)
* **Descripción:** Incorporación de `manifest.json` y un Service Worker que gestione el almacenamiento en caché de todos los recursos (incluyendo dependencias de Firebase locales/fallback) para permitir la instalación como aplicación de escritorio o móvil con funcionamiento 100% desconectado.
* **Valor para el usuario:** Experiencia de aplicación nativa, inicio ultra-rápido y fiabilidad absoluta sin conexión.

---

### 22. Creación Rápida de Tareas vía Atajo (*Quick Add*)
* **Descripción:** Atajo global (`N`) que despliega una barra de entrada rápida para crear una tarea introduciendo título y duración con sintaxis natural (ej. "Revisar PRs 30m").
* **Valor para el usuario:** Rapidez máxima para usuarios que prefieren interacción exclusiva por teclado.

---

### 23. Estimación Asistida por Historial
* **Descripción:** Al redactar el título de una tarea, sugerir automáticamente la duración estimada basándose en tareas pasadas similares registradas en el histórico de duraciones reales (`actualDuration`).
* **Valor para el usuario:** Estimaciones cada vez más precisas gracias al aprendizaje a partir de datos reales del usuario.

---

### 24. Registro de Nivel de Energía y Estado de Ánimo
* **Descripción:** Mini-selector opcional al inicio/cierre de la jornada (ej. 😴 / 🙂 / 😊 / 🔥) para registrar la energía diaria y correlacionarla en el gráfico de histórico con el tiempo efectivo completado.
* **Valor para el usuario:** Autoconocimiento sobre biorritmos y factores que impulsan la productividad real.

---

### 25. Temas de Color Personalizables
* **Descripción:** Selección de paletas temáticas predefinidas (ej. "Océano", "Bosque", "Atardecer") o selector de acento de color primario en las variables CSS.
* **Valor para el usuario:** Mayor personalización visual y satisfacción estética.

---

### 26. Sonidos y Feedback Háptico Opcionales
* **Descripción:** Efectos de audio suaves al completar una tarea, finalizar una pausa o activar un temporizador.
* **Valor para el usuario:** Refuerzo positivo y señalización auditiva sin necesidad de mirar la pantalla.

---

## 📊 Matriz de Evaluación Completa (26 Propuestas)

| # | Propuesta | Área | Impacto | Esfuerzo | Complejidad Técnica |
|---|-----------|------|---------|----------|---------------------|
| 1 | Subtareas / Checklist | Tareas | ⭐⭐⭐⭐⭐ | Medio | Media |
| 2 | Etiquetas / Tags con Filtro | Tareas / Filtros | ⭐⭐⭐⭐ | Medio | Media |
| 3 | Exportación / Importación JSON | Datos / Seguridad | ⭐⭐⭐⭐ | Bajo | Baja |
| 4 | Notas y Descripción en Tareas | Tareas / UX | ⭐⭐⭐⭐ | Bajo | Baja |
| 5 | Plantillas de Día (*Day Templates*) | Planificación | ⭐⭐⭐⭐ | Medio | Media |
| 6 | Detector de "Día Imposible" / Sobrecarga | Planificador | ⭐⭐⭐⭐⭐ | Bajo | Baja |
| 7 | Factor de Desvío (*Velocity*) | Planificador | ⭐⭐⭐⭐ | Medio | Media |
| 8 | Dependencias entre Tareas | Planificador | ⭐⭐⭐⭐ | Medio | Media |
| 9 | Vista Semanal Panorámica | Vistas | ⭐⭐⭐⭐⭐ | Alto | Alta |
| 10 | Objetivos Semanales / Metas | Analítica | ⭐⭐⭐ | Medio | Media |
| 11 | Manipulación Directa en Timeline | Tablero / UX | ⭐⭐⭐ | Alto | Alta |
| 12 | Recurrencia Mensual Avanzada | Calendario | ⭐⭐⭐ | Medio | Media |
| 13 | Mini-Widget Picture-in-Picture (PiP) | Foco / Sistema | ⭐⭐⭐⭐⭐ | Medio | Media |
| 14 | Modo Pomodoro Integrado | Concentración | ⭐⭐⭐ | Medio | Media |
| 15 | Timeboxing Estricto / Cuenta Atrás | Concentración | ⭐⭐⭐ | Bajo | Baja |
| 16 | Ruido Blanco Sintético (Web Audio) | Foco | ⭐⭐⭐ | Bajo | Baja |
| 17 | Cierre de Jornada (*Shutdown Ritual*) | Hábitos / Salud | ⭐⭐⭐⭐ | Bajo | Baja |
| 18 | Generador de "Daily Standup" | Productividad | ⭐⭐⭐⭐ | Muy bajo | Muy baja |
| 19 | División de Tarea (*Split Task*) | Ejecución | ⭐⭐⭐⭐ | Bajo | Baja |
| 20 | Importación Calendarios (`.ics`) | Integraciones | ⭐⭐⭐⭐⭐ | Medio | Media |
| 21 | PWA Completa (Service Worker) | Plataforma | ⭐⭐⭐⭐ | Medio | Media |
| 22 | Atajo Quick Add (`N`) | Accesibilidad | ⭐⭐⭐ | Bajo | Baja |
| 23 | Estimación Asistida por Historial | Planificador | ⭐⭐⭐ | Medio | Media |
| 24 | Registro de Nivel de Energía | Analítica | ⭐⭐⭐ | Bajo | Baja |
| 25 | Temas de Color Personalizables | Personalización | ⭐⭐ | Bajo | Baja |
| 26 | Sonidos / Feedback Auditivo | Accesibilidad | ⭐⭐ | Bajo | Baja |

---

> [!TIP]
> **Plan de Acción Recomendado:**
> 1. **Quick Wins (Alto impacto / Muy bajo esfuerzo):**
>    * #18 *Generador de Daily Standup* (formateo y portapapeles).
>    * #6 *Detector de Día Imposible* (alerta en cabecera si `schedEnd > workEnd`).
>    * #3 *Exportación / Importación JSON*.
>    * #4 *Notas en Tareas*.
> 2. **Grandes Mejoras Funcionales:**
>    * #1 *Subtareas / Checklist*.
>    * #13 *Mini-Widget Picture-in-Picture (PiP)*.
>    * #21 *PWA con funcionamiento offline completo*.
>    * #20 *Importación de calendarios `.ics`*.
