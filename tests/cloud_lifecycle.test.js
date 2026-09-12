import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksCloud } from '../js/cloud.js';

describe('TodayTasksCloud - Ciclo de Vida Móvil y Resiliencia de Red', () => {
  let cloud;
  let mockDocRef;
  let mockDb;
  let mockAuth;
  let authCallback;
  let ctx;

  beforeEach(() => {
    vi.useFakeTimers();

    mockDocRef = {
      set: vi.fn(() => Promise.resolve()),
      onSnapshot: vi.fn()
    };

    mockDb = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => mockDocRef)
      })),
      settings: vi.fn(),
      enableNetwork: vi.fn(() => Promise.resolve())
    };

    mockAuth = {
      setPersistence: vi.fn(() => Promise.resolve()),
      onAuthStateChanged: vi.fn(cb => { authCallback = cb; }),
      getRedirectResult: vi.fn(() => Promise.resolve(null)),
      signOut: vi.fn()
    };

    global.firebase = {
      initializeApp: vi.fn(),
      auth: Object.assign(() => mockAuth, {
        Auth: { Persistence: { LOCAL: 'local' } }
      }),
      firestore: () => mockDb
    };

    ctx = {
      getState: () => ({ ...defaultState(), title: 'Estado Ciclo Vida' }),
      setState: vi.fn(),
      setMeetingEdit: vi.fn(),
      setTaskEdit: vi.fn(),
      saveState: vi.fn(),
      STORAGE_KEY: 'test_key',
      syncFormInputsFromState: vi.fn(),
      renderAll: vi.fn()
    };

    cloud = TodayTasksCloud(ctx);
    cloud.initFirebase();
    if (authCallback) {
      authCallback({ uid: 'user_movil_123', email: 'movil@example.com' });
    }
  });

  afterEach(() => {
    if (cloud && cloud.detachLifecycleListeners) {
      cloud.detachLifecycleListeners();
    }
    vi.useRealTimers();
  });

  it('al cambiar a estado oculto (visibilitychange: hidden), descarga inmediatamente los cambios pendientes', () => {
    // Registramos listeners de ciclo de vida
    cloud.attachLifecycleListeners();

    // Encolamos un guardado con debounce
    cloud.pushToCloudDebounced();
    expect(mockDocRef.set).not.toHaveBeenCalled();

    // Simulamos que el móvil apaga la pantalla o cambia de app (visibilityState = 'hidden')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden'
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Debe haberse ejecutado inmediatamente sin esperar los 500ms
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
  });

  it('al reanudar la app (visibilitychange: visible), invoca enableNetwork y flushPendingCloudPush', () => {
    cloud.attachLifecycleListeners();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible'
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockDb.enableNetwork).toHaveBeenCalled();
  });

  it('al recuperar conexión de red (evento online), invoca enableNetwork y resumeSync', () => {
    cloud.attachLifecycleListeners();

    window.dispatchEvent(new Event('online'));

    expect(mockDb.enableNetwork).toHaveBeenCalled();
  });

  it('resumeSync refresca el estado visual si la sincronización estaba en error', () => {
    document.body.innerHTML = '<span id="syncStatus" class="sync-status error">Error de conexión</span>';
    const statusEl = document.getElementById('syncStatus');

    cloud.resumeSync();

    expect(statusEl.className).toContain('saving');
    expect(statusEl.textContent).toContain('Conectando');
  });

  it('detachLifecycleListeners desvincula los listeners para evitar fugas de memoria', () => {
    cloud.attachLifecycleListeners();
    cloud.detachLifecycleListeners();

    cloud.pushToCloudDebounced();
    expect(mockDocRef.set).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden'
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // No debe dispararse inmediatamente porque se desvincularon los listeners
    expect(mockDocRef.set).not.toHaveBeenCalled();

    // Se dispara normalmente al expirar el temporizador
    vi.advanceTimersByTime(500);
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
  });
});
