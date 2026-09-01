# 006. Mini-Widget Flotante con Document Picture-in-Picture (PiP)

* **Fecha:** 2026-09-01
* **Estado:** Aceptado

## Contexto
TodayTasks es una aplicación web centrada en la productividad diaria, la gestión del tiempo y la concentración en tareas sin interrupciones innecesarias.

Los usuarios suelen trabajar de forma simultánea en múltiples aplicaciones de escritorio (VS Code, terminales, hojas de cálculo, navegadores de consulta o herramientas de diseño). En este escenario:
1. Tener que cambiar constantemente de ventana o pestaña para comprobar el tiempo restante de la tarea o pausarla interrumpe el estado de flujo (*flow state*).
2. Las notificaciones tradicionales del sistema operativo solo alertan en momentos puntuales y no ofrecen interactividad continua ni un cronómetro en vivo persistente.
3. El Picture-in-Picture clásico basado en el elemento HTML `<video>` solo permite reproducir flujos de vídeo/canvas sin interactividad real ni controles DOM arbitrarios.
4. Las soluciones tradicionales como ventanas emergentes (`window.open`) no son *Always-on-Top* (quedan sepultadas detrás de otras aplicaciones en cuanto pierden el foco).

## Decisión
Se adoptó la API nativa de la plataforma web **Document Picture-in-Picture** (`window.documentPictureInPicture`), implementada en el módulo [`js/pip.js`](../../js/pip.js) y estilizada con [`css/pip.css`](../../css/pip.css):

1. **Ventana Always-on-Top Nativa:**
   - La API permite abrir una ventana flotante Always-on-Top con un documento DOM HTML completo e interactivo (`pipWindow.document`).
   - Comparte el mismo contexto de ejecución y memoria JS de la aplicación principal, permitiendo ejecutar acciones directas (`actionsModule.pauseTask()`, `actionsModule.completeTask()`, `actionsModule.startInterruption()`, etc.) sin serialización de mensajes ni retardos.

2. **Doble Temporizador Sincronizado en Cuenta Regresiva:**
   - **Tiempo restante de tarea:** Muestra la cuenta regresiva en vivo del tiempo planificado restante (`MM:SS restante tarea`) y conmuta automáticamente a sobretiempo (`+MM:SS tiempo extra`) con alerta visual en rojo/ámbar si se excede la duración estimada.
   - **Tiempo restante a próxima reunión:** Si hay una reunión programada, muestra una pastilla de cuenta regresiva de alto contraste (`en MM:SS`) que pulsa en alerta cuando faltan menos de 5 minutos, junto a una muesca de corte visual (`▼`) posicionada con precisión en la barra de progreso.

3. **Modos Dinámicos:**
   - **Tarea en Marcha:** Controles directos para pausar, completar e interrumpir.
   - **Tarea en Pausa:** Indicador violeta de pausa y botón para reanudar de inmediato.
   - **Modo Interrupción:** Cronómetro de interrupción con botones de finalización y descarte.
   - **Modo Reposo:** Sugiere e inicia la siguiente tarea pendiente en cola.

4. **Progressive Enhancement y Sincronización de Temas:**
   - Detección de soporte mediante `'documentPictureInPicture' in window`.
   - Propagación reactiva del tema Claro / Oscuro (`data-theme="dark"`).
   - Atajo de teclado <kbd>W</kbd> y botones de acceso en cabecera y vista de foco.

## Consecuencias
* **Positivas:**
  - Control absoluto del tiempo y estado de la tarea desde cualquier aplicación sin perder el foco ni cambiar de ventana.
  - Cero dependencias externas o necesidad de extensiones del navegador.
  - Sincronización bidireccional instantánea con el tablero principal.
* **Compensaciones:**
  - La API Document Picture-in-Picture está disponible en navegadores basados en Chromium (Chrome, Edge, Brave, Opera 111+). En navegadores sin soporte nativo, se aplica degradación elegante ocultando el botón o mostrando un aviso explicativo.
