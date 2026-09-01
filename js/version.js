/* version.js — Detección automática de nuevas versiones y auto-sincronización en inactividad (Híbrido) */

export function TodayTasksVersionSync(ctx, options = {}) {
  const config = {
    idleThresholdMs: options.idleThresholdMs ?? 5 * 60 * 1000,      // 5 minutos sin interacción
    hiddenThresholdMs: options.hiddenThresholdMs ?? 5 * 60 * 1000,  // 5 minutos oculta en segundo plano
    checkIntervalMs: options.checkIntervalMs ?? 10 * 60 * 1000,     // Chequeo pasivo cada 10 minutos
    cooldownMs: options.cooldownMs ?? 30 * 1000,                    // 30s cooldown entre chequeos al enfocar
    versionEndpoint: options.versionEndpoint ?? '/version.json',
    channelName: options.channelName ?? 'todaytasks_version_channel',
    autoReloadGraceMs: options.autoReloadGraceMs ?? 300,
    autoCheck: options.autoCheck ?? true,
    ...options
  };

  let localVersion = getLocalVersion();
  let latestVersion = localVersion;
  let hasUpdate = false;
  let isIdle = false;
  let isReloading = false;
  let lastActivityTime = Date.now();
  let lastCheckTime = 0;
  let hiddenAt = null;

  let checkTimer = null;
  let idleTimer = null;
  let broadcastChannel = null;
  let activityListeners = [];

  function getLocalVersion() {
    if (typeof document !== 'undefined') {
      const el = document.querySelector('.app-version');
      if (el && el.textContent) {
        return el.textContent.trim();
      }
    }
    return options.initialVersion || 'v1.94';
  }

  function setLocalVersion(v) {
    localVersion = v;
  }

  function getLatestVersion() {
    return latestVersion;
  }

  function getHasUpdate() {
    return hasUpdate;
  }

  function getIsIdle() {
    return isIdle;
  }

  function getLastActivityTime() {
    return lastActivityTime;
  }

  /* ---------------- Multi-Tab BroadcastChannel ---------------- */
  function initBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      broadcastChannel = new BroadcastChannel(config.channelName);
      broadcastChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'VERSION_UPDATE_AVAILABLE' && data.version) {
          if (data.version !== localVersion) {
            markUpdateAvailable(data.version);
          }
        }
      };
    } catch (e) {
      console.warn('No se pudo inicializar BroadcastChannel para version sync:', e);
    }
  }

  function broadcastUpdateAvailable(version) {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'VERSION_UPDATE_AVAILABLE',
          version,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('Error emitiendo mensaje por BroadcastChannel:', e);
      }
    }
  }

  /* ---------------- Detección de versión remota ---------------- */
  async function checkRemoteVersion(force = false) {
    const now = Date.now();
    if (!force && (now - lastCheckTime < config.cooldownMs)) {
      return { hasUpdate, latestVersion };
    }
    lastCheckTime = now;

    try {
      let remoteVer = null;

      // 1. Intentar leer version.json con no-store
      try {
        const res = await fetch(`${config.versionEndpoint}?_t=${now}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.version) {
            remoteVer = String(data.version).trim();
          }
        }
      } catch (errJson) {
        // Fallback a index.html
      }

      // 2. Si falló version.json, intentar leer el HTML
      if (!remoteVer) {
        try {
          const htmlRes = await fetch(`/index.html?_t=${now}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
          });
          if (htmlRes.ok) {
            const htmlText = await htmlRes.text();
            const match = htmlText.match(/class=["']app-version["'][^>]*>([^<]+)<\/span>/i);
            if (match && match[1]) {
              remoteVer = match[1].trim();
            }
          }
        } catch (errHtml) {
          // No se pudo consultar
        }
      }

      if (remoteVer && remoteVer !== localVersion) {
        markUpdateAvailable(remoteVer);
        broadcastUpdateAvailable(remoteVer);
      }

      return { hasUpdate, latestVersion, remoteVer };
    } catch (err) {
      console.warn('Error comprobando versión remota:', err);
      return { hasUpdate, latestVersion, error: err };
    }
  }

  function markUpdateAvailable(remoteVer) {
    latestVersion = remoteVer;
    hasUpdate = true;
    renderUpdateUI();

    // Si ya estamos inactivos y las condiciones son seguras, planificar recarga
    if (isIdle && isSafeToReload()) {
      safeReload('idle_on_detection');
    }
  }

  /* ---------------- Verificación de Seguridad para Recargar ---------------- */
  function isSafeToReload() {
    if (isReloading) return false;

    // 1. Verificar si hay edición de tarea o reunión activa
    const taskEdit = typeof ctx.getTaskEdit === 'function' ? ctx.getTaskEdit() : null;
    const meetingEdit = typeof ctx.getMeetingEdit === 'function' ? ctx.getMeetingEdit() : null;
    if (taskEdit !== null || meetingEdit !== null) {
      return false;
    }

    if (typeof document === 'undefined') return true;

    // 2. Verificar si el foco activo está en un campo editable
    const activeEl = document.activeElement;
    if (activeEl) {
      const tag = activeEl.tagName ? activeEl.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeEl.isContentEditable) {
        return false;
      }
    }

    // 3. Verificar si hay modales visibles abiertos
    const openModals = document.querySelectorAll('.modal-overlay[style*="display: block"], .modal-overlay[style*="display: flex"], dialog[open]');
    if (openModals && openModals.length > 0) {
      return false;
    }

    // 4. Si el buscador de tareas tiene texto escrito
    const searchInput = document.getElementById('taskSearchInput');
    if (searchInput && searchInput.value && searchInput.value.trim().length > 0) {
      return false;
    }

    return true;
  }

  /* ---------------- Recarga Segura ---------------- */
  function safeReload(reason = 'manual') {
    if (isReloading) return;
    isReloading = true;

    try {
      if (typeof ctx.saveState === 'function') {
        ctx.saveState();
      }
      if (typeof ctx.flushPendingCloudPush === 'function') {
        ctx.flushPendingCloudPush();
      }
    } catch (e) {
      console.warn('Error guardando estado antes de recargar por actualización:', e);
    }

    console.log(`[TodayTasks] Aplicando nueva versión (${latestVersion}) de forma segura. Motivo: ${reason}`);

    if (typeof window !== 'undefined' && window.location) {
      setTimeout(() => {
        window.location.reload();
      }, config.autoReloadGraceMs);
    }
  }

  /* ---------------- Seguimiento de Actividad e Inactividad ---------------- */
  function recordUserActivity() {
    lastActivityTime = Date.now();
    if (isIdle) {
      isIdle = false;
    }
  }

  function setupActivityListeners() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let throttleTimeout = null;
    const handleActivity = () => {
      if (!throttleTimeout) {
        recordUserActivity();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 1000);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => {
      window.addEventListener(evt, handleActivity, { passive: true });
      activityListeners.push({ evt, fn: handleActivity });
    });

    // Inactividad periódica
    idleTimer = setInterval(() => {
      const idleTime = Date.now() - lastActivityTime;
      if (idleTime >= config.idleThresholdMs) {
        isIdle = true;
        if (hasUpdate && isSafeToReload()) {
          safeReload('idle_timeout');
        }
      }
    }, 15000);
  }

  /* ---------------- Ciclo de Vida y Visibilidad de Pestaña ---------------- */
  function setupVisibilityListeners() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else {
        const wasHiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = null;

        // Si estuvo oculta más del umbral y ya teníamos actualización disponible
        if (hasUpdate && wasHiddenFor >= config.hiddenThresholdMs && isSafeToReload()) {
          safeReload('hidden_duration_expired');
          return;
        }

        // Comprobar si hubo cambios de versión mientras estaba en segundo plano
        checkRemoteVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    activityListeners.push({ target: document, evt: 'visibilitychange', fn: handleVisibilityChange });

    const handleFocus = () => {
      checkRemoteVersion();
    };
    window.addEventListener('focus', handleFocus);
    activityListeners.push({ target: window, evt: 'focus', fn: handleFocus });
  }

  /* ---------------- UI de Notificación de Actualización ---------------- */
  function renderUpdateUI() {
    if (typeof document === 'undefined') return;

    let badge = document.getElementById('versionUpdateBadge');
    if (!hasUpdate) {
      if (badge) badge.style.display = 'none';
      return;
    }

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'versionUpdateBadge';
      badge.className = 'version-update-badge';
      
      const brandEl = document.querySelector('.brand');
      if (brandEl) {
        const appModeEl = document.getElementById('appModeLabel');
        if (appModeEl && appModeEl.nextSibling) {
          brandEl.insertBefore(badge, appModeEl.nextSibling);
        } else {
          brandEl.appendChild(badge);
        }
      }
    }

    badge.style.display = 'inline-flex';
    badge.title = `Nueva versión ${latestVersion} disponible. Se actualizará automáticamente en 5 min de inactividad o haz clic para actualizar ahora.`;
    badge.innerHTML = `
      <span class="version-update-dot"></span>
      <span class="version-update-text">✨ ${latestVersion} lista</span>
      <button type="button" class="version-update-btn" id="btnApplyUpdateNow" title="Actualizar aplicación ahora">Actualizar</button>
    `;

    const btn = document.getElementById('btnApplyUpdateNow');
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeReload('manual_user_click');
      };
    }
  }

  /* ---------------- Inicialización ---------------- */
  function init() {
    initBroadcastChannel();
    setupActivityListeners();
    setupVisibilityListeners();

    // Comprobación inicial inmediata
    if (config.autoCheck) {
      checkRemoteVersion(true);
    }

    // Comprobación pasiva de fondo cada 10 minutos
    if (config.checkIntervalMs > 0) {
      checkTimer = setInterval(() => {
        checkRemoteVersion();
      }, config.checkIntervalMs);
    }
  }

  function destroy() {
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
    if (idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
    if (broadcastChannel) {
      try { broadcastChannel.close(); } catch (e) {}
      broadcastChannel = null;
    }
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      activityListeners.forEach(({ target, evt, fn }) => {
        const t = target || window;
        t.removeEventListener(evt, fn);
      });
    }
    activityListeners = [];
  }

  init();

  return {
    getLocalVersion,
    setLocalVersion,
    getLatestVersion,
    getHasUpdate,
    getIsIdle,
    getLastActivityTime,
    checkRemoteVersion,
    isSafeToReload,
    safeReload,
    renderUpdateUI,
    recordUserActivity,
    destroy
  };
}

export default TodayTasksVersionSync;
