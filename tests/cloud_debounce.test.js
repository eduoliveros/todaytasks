import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksCloud } from '../js/cloud.js';

describe('TodayTasksCloud - Debounce in pushToCloud and saveState', () => {
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
      settings: vi.fn()
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
      getState: () => ({ ...defaultState(), title: 'Test State' }),
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
      authCallback({ uid: 'user_123', email: 'test@example.com' });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces rapid calls to pushToCloudDebounced into a single Firestore set call', () => {
    expect(mockDocRef.set).not.toHaveBeenCalled();

    // Call 5 times rapidly
    cloud.pushToCloudDebounced();
    cloud.pushToCloudDebounced();
    cloud.pushToCloudDebounced();
    cloud.pushToCloudDebounced();
    cloud.pushToCloudDebounced();

    // Before timer expires, Firestore should not have been called
    expect(mockDocRef.set).not.toHaveBeenCalled();

    // Fast-forward 200ms
    vi.advanceTimersByTime(200);
    expect(mockDocRef.set).not.toHaveBeenCalled();

    // Another call resets the timer
    cloud.pushToCloudDebounced();
    vi.advanceTimersByTime(350);
    expect(mockDocRef.set).not.toHaveBeenCalled();

    // Now advance past the 500ms debounce
    vi.advanceTimersByTime(200);
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
  });

  it('flushPendingCloudPush immediately triggers any pending debounced push without waiting', () => {
    cloud.pushToCloudDebounced();
    expect(mockDocRef.set).not.toHaveBeenCalled();

    cloud.flushPendingCloudPush();
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);

    // After timer would have expired, no extra call happens
    vi.advanceTimersByTime(1000);
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
  });

  it('pushToCloud with immediate option flushes and executes immediately', () => {
    cloud.pushToCloud({ immediate: true });
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
  });

  it('updates sync status properly from pending to saving to synchronized', async () => {
    document.body.innerHTML = '<span id="syncStatus"></span>';
    const statusEl = document.getElementById('syncStatus');

    cloud.pushToCloudDebounced();
    expect(statusEl.textContent).toContain('Cambios pendientes');
    expect(statusEl.className).toContain('pending');

    // Fast forward to trigger pushToCloud
    vi.advanceTimersByTime(500);
    expect(statusEl.textContent).toContain('Guardando en la nube');
    expect(statusEl.className).toContain('saving');

    // Wait for promise resolution
    await Promise.resolve();
    expect(statusEl.textContent).toContain('Sincronizado');
  });
});
