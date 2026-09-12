# 020. Resiliencia de Sincronización en la Nube ante el Ciclo de Vida Móvil

* **Fecha:** 2026-09-12
* **Estado:** Aceptado

## Contexto

En dispositivos móviles (smartphones y tablets corriendo navegadores como Chrome, Safari o navegadores webview PWA), el sistema operativo aplica políticas agresivas de gestión de energía y suspensión de procesos:

1. **Congelación del temporizador de Debounce (500 ms):**
   Al crear o editar una tarea, el sistema programa un envío diferido mediante `pushToCloudDebounced(500)`. Si el usuario bloquea el móvil o cambia de aplicación rápidamente tras crear la tarea, el temporizador de JavaScript se suspende indefinidamente antes de expirar, manteniendo los cambios en local sin enviarse a Firestore.
2. **Conexiones zombi (*Half-Open*) de Firestore en reposo:**
   Al suspender el proceso o recuperar el dispositivo tras un bloqueo de pantalla prolongado, la conexión WebSocket/Long-Polling con Firebase Firestore puede entrar en un estado zombi: la biblioteca de Firestore cree estar conectada pero no procesa escrituras salientes ni recibe snapshots entrantes hasta que se fuerza una reconexión de red o se reinicia la aplicación en frío.
3. **Ineficacia de `beforeunload` y `pagehide` en navegadores móviles:**
   A diferencia de los entornos de escritorio, los navegadores móviles raramente disparan `beforeunload` o `pagehide` cuando el usuario apaga la pantalla, pulsa el botón de inicio o cambia de app. La especificación oficial de ciclo de vida web (*Page Lifecycle API*) designa el evento `visibilitychange` (`document.visibilityState === 'hidden'`) como el único punto confiable para persistir datos antes de la suspensión del proceso.

## Alternativas Consideradas

* **Alternativa 1 (Eliminar el debounce y hacer escrituras síncronas inmediatas):**
  Descartado. Eliminar el debounce provocaría múltiples escrituras concurrentes a Firestore con cada pulsación de teclado en formularios o ajustes continuos de tiempo, saturando la cuota y aumentando la latencia de la aplicación.
* **Alternativa 2 (Sondeo periódico ciego / Heartbeat cada X segundos):**
  Descartado. El sondeo consume batería innecesariamente y además también se congela en segundo plano en sistemas operativos móviles.
* **Alternativa 3 (Adoptada - Gestión Reactiva del Ciclo de Vida y Resiliencia de Red):**
  - **Al ocultar/suspender (`visibilitychange: hidden`):** Se invoca de inmediato `flushPendingCloudPush()`. Si había un debounce en curso con cambios locales, se cancela el temporizador y se envía inmediatamente la carga útil a Firestore antes de que el sistema operativo congele la pestaña.
  - **Al volver a primer plano (`visibilitychange: visible` y `focus`):** Se invoca `resumeSync()`, la cual despierta la conexión invocando `fbDb.enableNetwork()` de Firestore, vacía cualquier cambio acumulado y reintenta la sincronización si el estado previo estaba en error.
  - **Al recuperar conectividad (`window.online`):** Reactiva la red de Firestore y reanuda la sincronización de datos pendientes.

## Decisión

### 1. Núcleo de Ciclo de Vida en `js/cloud.js`
* Se implementaron las funciones `handleVisibilityChange()`, `handleOnline()`, `handleWindowFocus()` y `resumeSync()`.
* `attachLifecycleListeners()` registra la escucha activa en `document` y `window`, invocándose automáticamente durante `initFirebase()`.
* `detachLifecycleListeners()` permite la desvinculación ordenada de listeners para pruebas unitarias y limpieza de memoria.
* `resumeSync()`:
  - Invoca `fbDb.enableNetwork()` de forma defensiva para asegurar que la conexión subyacente de Firestore se despierte tras períodos de inactividad.
  - Ejecuta `flushPendingCloudPush()` por si existían escrituras en cola.
  - Si el estado visual `#syncStatus` contenía la clase `error`, lo actualiza a `saving` con el texto de *"Conectando..."* para reanudar la sincronización visiblemente.
* Se exportaron `resumeSync`, `attachLifecycleListeners` y `detachLifecycleListeners` en la interfaz pública de `TodayTasksCloud`.

### 2. Exposición en `js/app.js`
* Se expusieron `app.resumeSync()` y `app.flushPendingCloudPush()` en la API pública de la aplicación (`window.app`).

## Consecuencias

* **Positivas:**
  - Se elimina el problema de tareas y ediciones creadas en el móvil que quedaban "atascadas" en local por bloqueo de pantalla o cambio de aplicación.
  - Se evita la necesidad de forzar el cierre o reinicio manual de la aplicación móvil para propagar datos.
  - Recuperación transparente de la conexión tras pérdida temporal de cobertura WiFi o móvil.
  - Mantiene intacta la optimización del debounce de 500 ms en uso normal de escritorio sin penalizar el rendimiento.
* **Negativas / Compensaciones:**
  - Requiere mantener listeners de ciclo de vida activos durante toda la sesión del usuario.
