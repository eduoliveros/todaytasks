# 005. Detección automática de nueva versión y auto-sincronización en inactividad

* **Fecha:** 2026-09-01
* **Estado:** Aceptado

## Contexto
TodayTasks es una SPA basada en archivos estáticos servidos directamente al navegador (Vanilla JS con ES Modules) con persistencia en `localStorage` y sincronización en tiempo real con Firebase Firestore.

Cuando se despliega una nueva versión (actualizaciones de código JS, estilos CSS o estructura HTML):
1. Las pestañas que permanecen abiertas durante horas o días continúan ejecutando código antiguo en memoria.
2. Si el usuario no pulsa refrescar manualmente (`F5`), no recibe las nuevas funcionalidades ni correcciones.
3. Forzar una recarga automática e inesperada mientras el usuario está escribiendo o interactuando causaría una mala experiencia o posible pérdida de texto no guardado.
4. Las opciones basadas exclusivamente en WebSockets de Firestore o Service Workers presentaban desventajas:
   - **Firestore Realtime exclusivo:** Requiere que el usuario esté logueado (rompe el modo *Offline-First* local) y añade riesgo de desincronización entre el despliegue de archivos estáticos y la actualización del documento en Firestore.
   - **Service Workers:** Complejidad alta de gestión de ciclo de vida de caché con riesgo de servir módulos obsoletos.

## Decisión
Se adoptó una **arquitectura híbrida y desacoplada** implementada en el módulo [`js/version.js`](../../js/version.js):

1. **Fuente de Verdad Estática de Versión:**
   - Se mantiene el archivo ligero [`version.json`](../../version.json) en la raíz del servidor, servido con cabeceras `Cache-Control: no-cache, no-store, must-revalidate`.
   - Se mantiene la etiqueta `<span class="app-version">vX.XX</span>` en `index.html` como fallback y elemento visible.

2. **Detección Multi-Nivel y Reactiva:**
   - **Al iniciar:** Consulta inicial inmediata a `/version.json`.
   - **Al reenfocar ventana (`visibilitychange` / `focus`):** Si la pestaña vuelve a primer plano tras estar oculta, realiza un chequeo inmediato (con *cooldown* de 30s).
   - **Polling pasivo:** Consulta ligera de fondo cada 10 minutos si la pestaña se mantiene visible continuamente.
   - **Inter-comunicación de pestañas (`BroadcastChannel`):** Si una pestaña detecta nueva versión, avisa instantáneamente a todas las demás pestañas abiertas del mismo origen.

3. **Mecanismo de Auto-Recarga Segura (*Safe Idle Reload*):**
   - Se monitoriza la inactividad del usuario mediante eventos de interacción (`mousemove`, `keydown`, `touchstart`, `scroll`, `click`).
   - Si se detecta una nueva versión y la aplicación lleva **≥ 5 minutos inactiva** (o la pestaña estuvo oculta ≥ 5 minutos), se dispara la recarga automática.
   - **Condiciones estrictas de seguridad:**
     - `taskEdit === null && meetingEdit === null`.
     - Ningún `<input>`, `<textarea>`, `<select>` o elemento editable tiene el foco.
     - Ningún modal o diálogo está visible en pantalla.
     - El buscador de tareas no tiene texto escrito.
   - **Persistencia atómica previa:** Se invocan `saveState()` y `flushPendingCloudPush()` antes de ejecutar `window.location.reload()`, garantizando que la tarea activa, cronómetros y datos queden intactos.

4. **UI No Intrusiva para Usuarios Activos:**
   - Se renderiza un badge interactivo `#versionUpdateBadge` junto al número de versión en la barra superior (`✨ vX.XX lista [Actualizar]`).
   - Permite al usuario activo actualizar con 1 clic cuando lo desee o esperar a que la auto-recarga se ejecute al pausar la actividad.

## Consecuencias
* **Positivas:**
  - Los clientes siempre se mantienen al día con la última versión desplegada sin requerir refresh manual.
  - Cero riesgo de pérdida de datos o interrupción durante la edición activa.
  - Funciona de forma idéntica en modo local, offline y conectado a la nube con Google.
  - No genera coste de lecturas en la base de datos Firestore.
* **Negativas / Compensaciones:**
  - Requiere que los desarrolladores y agentes de IA mantengan sincronizados tanto `index.html` como `version.json` al incrementar la versión (documentado como regla obligatoria en `AGENTS.md`).
