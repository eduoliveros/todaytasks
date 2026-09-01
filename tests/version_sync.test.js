import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TodayTasksVersionSync } from '../js/version.js';

describe('TodayTasksVersionSync - Detección y Sincronización de Versión', () => {
  let mockCtx;
  let savedStateCalled = false;
  let flushedCloudCalled = false;
  let mockLocationReload;

  beforeEach(() => {
    savedStateCalled = false;
    flushedCloudCalled = false;

    document.body.innerHTML = `
      <header class="topbar">
        <div class="brand">
          <h1>Tablero del día <span class="app-version">v1.94</span></h1>
          <span class="db-status-badge" id="appModeLabel">💾 local</span>
          <div class="version-update-badge" id="versionUpdateBadge" style="display:none"></div>
        </div>
      </header>
      <input type="text" id="taskSearchInput" value="" />
    `;

    mockLocationReload = vi.fn();
    delete window.location;
    window.location = { reload: mockLocationReload };

    mockCtx = {
      getState: () => ({ activeEnv: 'work' }),
      saveState: () => { savedStateCalled = true; },
      getTaskEdit: () => null,
      getMeetingEdit: () => null,
      flushPendingCloudPush: () => { flushedCloudCalled = true; },
      showToast: vi.fn()
    };

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('obtiene la versión local correcta desde el DOM', () => {
    const versionSync = TodayTasksVersionSync(mockCtx, {
      checkIntervalMs: 0
    });

    expect(versionSync.getLocalVersion()).toBe('v1.94');
    versionSync.destroy();
  });

  it('no marca actualización si la versión remota es idéntica a la local', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: 'v1.94' })
    });

    const versionSync = TodayTasksVersionSync(mockCtx, {
      checkIntervalMs: 0,
      autoCheck: false
    });

    const result = await versionSync.checkRemoteVersion(true);
    expect(result.hasUpdate).toBe(false);
    expect(versionSync.getHasUpdate()).toBe(false);

    const badge = document.getElementById('versionUpdateBadge');
    expect(badge.style.display).toBe('none');

    versionSync.destroy();
  });

  it('detecta nueva versión remota desde version.json y actualiza la UI', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: 'v1.95' })
    });

    const versionSync = TodayTasksVersionSync(mockCtx, {
      checkIntervalMs: 0,
      autoCheck: false
    });

    const result = await versionSync.checkRemoteVersion(true);
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('v1.95');
    expect(versionSync.getHasUpdate()).toBe(true);
    expect(versionSync.getLatestVersion()).toBe('v1.95');

    const badge = document.getElementById('versionUpdateBadge');
    expect(badge.style.display).not.toBe('none');
    expect(badge.textContent).toContain('v1.95');

    versionSync.destroy();
  });

  it('usa fallback a index.html si version.json falla y detecta la nueva versión', async () => {
    global.fetch
      .mockRejectedValueOnce(new Error('Network error on version.json'))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body><h1>Tablero del día <span class="app-version">v1.95</span></h1></body></html>'
      });

    const versionSync = TodayTasksVersionSync(mockCtx, {
      checkIntervalMs: 0,
      autoCheck: false
    });

    const result = await versionSync.checkRemoteVersion(true);
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('v1.95');

    versionSync.destroy();
  });

  it('isSafeToReload previene la recarga si hay edición activa de tarea o reunión', () => {
    const versionSync = TodayTasksVersionSync(mockCtx, { checkIntervalMs: 0 });

    expect(versionSync.isSafeToReload()).toBe(true);

    // Con tarea en edición
    mockCtx.getTaskEdit = () => ({ id: 'task_1' });
    expect(versionSync.isSafeToReload()).toBe(false);
    mockCtx.getTaskEdit = () => null;

    // Con reunión en edición
    mockCtx.getMeetingEdit = () => ({ id: 'meeting_1' });
    expect(versionSync.isSafeToReload()).toBe(false);
    mockCtx.getMeetingEdit = () => null;

    versionSync.destroy();
  });

  it('isSafeToReload previene la recarga si un input de texto está enfocado o hay búsqueda activa', () => {
    const versionSync = TodayTasksVersionSync(mockCtx, { checkIntervalMs: 0 });

    const input = document.getElementById('taskSearchInput');
    input.value = 'revisar';
    expect(versionSync.isSafeToReload()).toBe(false);

    input.value = '';
    input.focus();
    expect(versionSync.isSafeToReload()).toBe(false);

    input.blur();
    expect(versionSync.isSafeToReload()).toBe(true);

    versionSync.destroy();
  });

  it('safeReload ejecuta saveState y flushPendingCloudPush antes de recargar', () => {
    vi.useFakeTimers();

    const versionSync = TodayTasksVersionSync(mockCtx, {
      checkIntervalMs: 0,
      autoReloadGraceMs: 50
    });

    versionSync.safeReload('test');

    expect(savedStateCalled).toBe(true);
    expect(flushedCloudCalled).toBe(true);

    vi.advanceTimersByTime(100);
    expect(mockLocationReload).toHaveBeenCalledTimes(1);

    versionSync.destroy();
    vi.useRealTimers();
  });

  it('el botón "Actualizar" en la UI invoca safeReload al hacer clic', async () => {
    vi.useFakeTimers();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: 'v1.95' })
    });

    const versionSync = TodayTasksVersionSync(mockCtx, {
      checkIntervalMs: 0,
      autoReloadGraceMs: 50,
      autoCheck: false
    });

    await versionSync.checkRemoteVersion(true);

    const btn = document.getElementById('btnApplyUpdateNow');
    expect(btn).toBeTruthy();

    btn.click();

    expect(savedStateCalled).toBe(true);
    expect(flushedCloudCalled).toBe(true);

    vi.advanceTimersByTime(100);
    expect(mockLocationReload).toHaveBeenCalledTimes(1);

    versionSync.destroy();
    vi.useRealTimers();
  });

  it('los eventos de usuario reinician el temporizador de inactividad', () => {
    const versionSync = TodayTasksVersionSync(mockCtx, {
      idleThresholdMs: 5000,
      checkIntervalMs: 0
    });

    const initialTime = versionSync.getLastActivityTime();
    expect(initialTime).toBeGreaterThan(0);

    // Simular evento de usuario
    window.dispatchEvent(new Event('mousemove'));
    versionSync.recordUserActivity();

    expect(versionSync.getIsIdle()).toBe(false);
    expect(versionSync.getLastActivityTime()).toBeGreaterThanOrEqual(initialTime);

    versionSync.destroy();
  });
});
