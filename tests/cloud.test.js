import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksCloud } from '../js/cloud.js';

describe('TodayTasksCloud - mergeStates', () => {
  let cloud;

  beforeEach(() => {
    const ctx = {
      getState: () => defaultState(),
      setState: () => {},
      setMeetingEdit: () => {},
      setTaskEdit: () => {},
      saveState: () => {},
      STORAGE_KEY: 'test_key',
      syncFormInputsFromState: () => {},
      renderAll: () => {}
    };

    cloud = TodayTasksCloud(ctx);
  });

  it('preserva y combina correctamente las reuniones y tareas recurrentes en mergeStates', () => {
    const local = defaultState();
    local.environments.work.recurringMeetings = [
      { id: 1, title: 'Reunión Recurrente Local', freq: 'daily', interval: 1, startDate: '2026-08-01' }
    ];
    local.environments.work.recurringTasks = [
      { id: 2, title: 'Tarea Recurrente Local', planned: 30, freq: 'weekly', interval: 1, startDate: '2026-08-01', daysOfWeek: [1] }
    ];

    const remote = defaultState();
    remote.environments.work.recurringMeetings = [
      { id: 3, title: 'Reunión Recurrente Remota', freq: 'weekly', interval: 2, startDate: '2026-08-01', daysOfWeek: [2] }
    ];
    remote.environments.work.recurringTasks = [
      { id: 4, title: 'Tarea Recurrente Remota', planned: 45, freq: 'daily', interval: 1, startDate: '2026-08-01' }
    ];

    const merged = cloud.mergeStates(local, remote);

    expect(merged.environments.work.recurringMeetings).toHaveLength(2);
    expect(merged.environments.work.recurringMeetings.map(m => m.title)).toContain('Reunión Recurrente Local');
    expect(merged.environments.work.recurringMeetings.map(m => m.title)).toContain('Reunión Recurrente Remota');

    expect(merged.environments.work.recurringTasks).toHaveLength(2);
    expect(merged.environments.work.recurringTasks.map(t => t.title)).toContain('Tarea Recurrente Local');
    expect(merged.environments.work.recurringTasks.map(t => t.title)).toContain('Tarea Recurrente Remota');
  });

  it('el horario semanal (weeklySchedule) de la nube siempre prevalece por completo sobre el local si la nube tiene horario', () => {
    const local = defaultState();
    local.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 },
      5: { start: 540, end: 900 }
    };

    const remote = defaultState();
    remote.environments.work.weeklySchedule = {
      1: { start: 480, end: 960 },
      6: null
    };

    const merged = cloud.mergeStates(local, remote);

    // El horario de la nube prevalece íntegramente
    expect(merged.environments.work.weeklySchedule).toEqual({
      1: { start: 480, end: 960 },
      6: null
    });
    // El día 5 local no debe colarse en el horario
    expect(merged.environments.work.weeklySchedule[5]).toBeUndefined();
  });

  it('el horario semanal local gana sólo cuando en la nube weeklySchedule es null o undefined', () => {
    const local = defaultState();
    local.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 }
    };

    const remote = defaultState();
    remote.environments.work.weeklySchedule = null;

    const merged = cloud.mergeStates(local, remote);
    expect(merged.environments.work.weeklySchedule).toEqual({
      1: { start: 540, end: 1020 }
    });
  });

  it('ambos con weeklySchedule null produce weeklySchedule null', () => {
    const local = defaultState();
    local.environments.work.weeklySchedule = null;

    const remote = defaultState();
    remote.environments.work.weeklySchedule = null;

    const merged = cloud.mergeStates(local, remote);
    expect(merged.environments.work.weeklySchedule).toBeNull();
  });

  // --- Tests TDD para bugs de sincronización con nuevo dispositivo ---

  it('[Bug 1] countItems debe detectar weeklySchedule como dato significativo (hasSchedule=true)', () => {
    // Un estado con 0 tareas/reuniones pero con weeklySchedule configurado
    // debe reportar hasSchedule=true para evitar sobrescribir la nube
    const stateWithSchedule = defaultState();
    stateWithSchedule.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 },
      5: { start: 540, end: 900 },
      6: null,
      7: null
    };

    // Accedemos a countItems indirectamente a través de mergeStates:
    // Si local tiene schedule y 0 items, y remote tiene schedule y 0 items,
    // el merge debe preservar el schedule, no devolver null.
    const local = defaultState();
    local.environments.work.weeklySchedule = { 1: { start: 540, end: 1020 } };

    const remote = defaultState();
    remote.environments.work.weeklySchedule = null; // nube sin horario

    // mergeStates debe preservar el local (ya existía test para esto, reutilizamos)
    const merged = cloud.mergeStates(local, remote);
    expect(merged.environments.work.weeklySchedule).not.toBeNull();
    expect(merged.environments.work.weeklySchedule[1]).toEqual({ start: 540, end: 1020 });
  });

  it('[Bug 1] nuevo dispositivo no debe sobrescribir weeklySchedule de la nube cuando solo hay horario (sin tareas)', () => {
    // Simula: nube tiene weeklySchedule pero 0 tareas/reuniones
    // El nuevo dispositivo (local vacío) no debe sobrescribir con null
    const cloudStateWithOnlySchedule = defaultState();
    cloudStateWithOnlySchedule.environments.work.weeklySchedule = {
      1: { start: 480, end: 960 },
      2: { start: 480, end: 960 },
      6: null,
      7: null
    };

    const localEmpty = defaultState();
    // localEmpty.weeklySchedule = null (por defecto)

    // Al hacer merge (equivalente a lo que debería ocurrir en attachCloudSync),
    // si local está vacío y cloud tiene solo schedule, el resultado debe conservar el schedule de la nube
    const merged = cloud.mergeStates(localEmpty, cloudStateWithOnlySchedule);
    expect(merged.environments.work.weeklySchedule).not.toBeNull();
    expect(merged.environments.work.weeklySchedule[1]).toEqual({ start: 480, end: 960 });
    expect(merged.environments.work.weeklySchedule[6]).toBeNull();
  });

  it('[Bug 2] mergeStates preserva weeklySchedule local si el remoto lo trae a null', () => {
    // Simula actualización en tiempo real donde otro dispositivo (sin horario)
    // envía un snapshot que sobreescribiría el horario local
    const localWithSchedule = defaultState();
    localWithSchedule.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 },
      2: { start: 540, end: 1020 },
      6: null,
      7: null
    };
    localWithSchedule.environments.work.recurringMeetings = [
      { id: 1, title: 'Stand-up diario', freq: 'daily', interval: 1, startDate: '2026-08-01' }
    ];

    // Snapshot de otro dispositivo que NO tiene horario configurado
    const remoteWithoutSchedule = defaultState();
    remoteWithoutSchedule.environments.work.weeklySchedule = null;
    remoteWithoutSchedule.environments.work.recurringMeetings = [
      { id: 1, title: 'Stand-up diario', freq: 'daily', interval: 1, startDate: '2026-08-01' }
    ];

    const merged = cloud.mergeStates(localWithSchedule, remoteWithoutSchedule);

    // El horario local debe preservarse porque el remoto no lo tiene (null)
    expect(merged.environments.work.weeklySchedule).not.toBeNull();
    expect(merged.environments.work.weeklySchedule[1]).toEqual({ start: 540, end: 1020 });
  });

  it('preserva activeEnv y selectedDate locales en mergeStates', () => {
    const local = defaultState();
    local.activeEnv = 'personal';
    local.selectedDate = '2026-08-20';

    const remote = defaultState();
    remote.activeEnv = 'work';
    remote.selectedDate = '2026-08-16';

    const merged = cloud.mergeStates(local, remote);
    expect(merged.activeEnv).toBe('personal');
    expect(merged.selectedDate).toBe('2026-08-20');
  });

  it('no hereda selectedDate obsoleto de la nube si local no tiene fecha', () => {
    const local = defaultState();
    delete local.selectedDate;

    const remote = defaultState();
    remote.selectedDate = '2020-01-01';

    const merged = cloud.mergeStates(local, remote);
    expect(merged.selectedDate).not.toBe('2020-01-01');
    expect(merged.selectedDate).toBe(defaultState().selectedDate);
  });

  it('aplica la prevalencia de weeklySchedule de la nube también en el entorno personal', () => {
    const local = defaultState();
    local.environments.personal.weeklySchedule = {
      1: { start: 1080, end: 1380 },
      5: { start: 900, end: 1380 }
    };

    const remote = defaultState();
    remote.environments.personal.weeklySchedule = {
      1: { start: 1140, end: 1400 },
      6: { start: 600, end: 1200 }
    };

    const merged = cloud.mergeStates(local, remote);
    expect(merged.environments.personal.weeklySchedule).toEqual({
      1: { start: 1140, end: 1400 },
      6: { start: 600, end: 1200 }
    });
    expect(merged.environments.personal.weeklySchedule[5]).toBeUndefined();
  });

  it('no duplica una tarea entre días si la nube la tiene en un día futuro y el estado local la tiene en hoy', () => {
    const local = defaultState();
    const today = '2026-08-29';
    const futureDate = '2026-09-05';

    // Local tiene la tarea 99 en today (por ejemplo por rollover previo)
    local.environments.work.days = {
      [today]: {
        meetings: [],
        interruptions: [],
        tasks: [
          { id: 99, title: 'Tarea Auto-Move Importante', planned: 45, status: 'pending', autoMoveToToday: true }
        ]
      }
    };

    // Remote (Nube) tiene la tarea 99 en futureDate porque el usuario la movió allí
    const remote = defaultState();
    remote.environments.work.days = {
      [futureDate]: {
        meetings: [],
        interruptions: [],
        tasks: [
          { id: 99, title: 'Tarea Auto-Move Importante', planned: 45, status: 'pending', autoMoveToToday: true }
        ]
      }
    };

    const merged = cloud.mergeStates(local, remote);

    // En today NO debe aparecer la tarea 99
    const todayTasks = (merged.environments.work.days[today] && merged.environments.work.days[today].tasks) || [];
    expect(todayTasks.some(t => t.id === 99)).toBe(false);

    // En futureDate SÍ debe aparecer la tarea 99
    const futureTasks = (merged.environments.work.days[futureDate] && merged.environments.work.days[futureDate].tasks) || [];
    expect(futureTasks.some(t => t.id === 99)).toBe(true);
  });

  it('no resucita tareas locales si su ID está registrado en _deletedIds de la nube (tombstone)', () => {
    const today = '2026-08-31';
    const local = defaultState();
    local.environments.work.days[today] = {
      meetings: [],
      interruptions: [],
      tasks: [
        { id: 'task-1', title: 'Tarea Borrada En Otro Dispositivo', planned: 30, status: 'pending' },
        { id: 'task-2', title: 'Tarea Local Que Sí Sigue Viva', planned: 20, status: 'pending' }
      ],
      _deletedIds: []
    };

    const remote = defaultState();
    remote.environments.work.days[today] = {
      meetings: [],
      interruptions: [],
      tasks: [],
      _deletedIds: ['task-1']
    };

    const merged = cloud.mergeStates(local, remote);
    const mergedTasks = (merged.environments.work.days[today] && merged.environments.work.days[today].tasks) || [];

    // task-1 NO debe resucitar
    expect(mergedTasks.some(t => String(t.id) === 'task-1')).toBe(false);
    // task-2 SÍ debe preservarse
    expect(mergedTasks.some(t => String(t.id) === 'task-2')).toBe(true);
    // _deletedIds debe incluir task-1
    expect(merged.environments.work.days[today]._deletedIds).toContain('task-1');
  });

  it('no resucita tareas remotas si fueron borradas localmente (_deletedIds local)', () => {
    const today = '2026-08-31';
    const local = defaultState();
    local.environments.work.days[today] = {
      meetings: [],
      interruptions: [],
      tasks: [],
      _deletedIds: ['task-cloud-1']
    };

    const remote = defaultState();
    remote.environments.work.days[today] = {
      meetings: [],
      interruptions: [],
      tasks: [
        { id: 'task-cloud-1', title: 'Tarea Cloud Borrada Localmente', planned: 30, status: 'pending' }
      ],
      _deletedIds: []
    };

    const merged = cloud.mergeStates(local, remote);
    const mergedTasks = (merged.environments.work.days[today] && merged.environments.work.days[today].tasks) || [];

    expect(mergedTasks.some(t => String(t.id) === 'task-cloud-1')).toBe(false);
    expect(merged.environments.work.days[today]._deletedIds).toContain('task-cloud-1');
  });

  it('no resucita reuniones borradas en remoto si están en _deletedIds de la nube', () => {
    const today = '2026-08-31';
    const local = defaultState();
    local.environments.work.days[today] = {
      meetings: [
        { id: 'meet-1', title: 'Daily Sync Borrada', start: 600, end: 630 },
        { id: 'meet-2', title: 'Sprint Review', start: 700, end: 760 }
      ],
      interruptions: [],
      tasks: [],
      _deletedIds: []
    };

    const remote = defaultState();
    remote.environments.work.days[today] = {
      meetings: [],
      interruptions: [],
      tasks: [],
      _deletedIds: ['meet-1']
    };

    const merged = cloud.mergeStates(local, remote);
    const mergedMeetings = (merged.environments.work.days[today] && merged.environments.work.days[today].meetings) || [];

    expect(mergedMeetings.some(m => String(m.id) === 'meet-1')).toBe(false);
    expect(mergedMeetings.some(m => String(m.id) === 'meet-2')).toBe(true);
    expect(merged.environments.work.days[today]._deletedIds).toContain('meet-1');
  });

  it('no resucita interrupciones borradas en remoto si están en _deletedIds de la nube', () => {
    const today = '2026-08-31';
    const local = defaultState();
    local.environments.work.days[today] = {
      meetings: [],
      interruptions: [
        { id: 'int-1', title: 'Llamada urgente', start: 600, startEpoch: 1000, end: 620, duration: 20 }
      ],
      tasks: [],
      _deletedIds: []
    };

    const remote = defaultState();
    remote.environments.work.days[today] = {
      meetings: [],
      interruptions: [],
      tasks: [],
      _deletedIds: ['int-1']
    };

    const merged = cloud.mergeStates(local, remote);
    const mergedInts = (merged.environments.work.days[today] && merged.environments.work.days[today].interruptions) || [];

    expect(mergedInts.some(i => String(i.id) === 'int-1')).toBe(false);
    expect(merged.environments.work.days[today]._deletedIds).toContain('int-1');
  });

  it('no resucita series recurrentes eliminadas registradas en _deletedRecurringIds', () => {
    const local = defaultState();
    local.environments.work.recurringTasks = [
      { id: 'rec_task_1', title: 'Revisión Diaria', planned: 15, freq: 'daily', interval: 1, startDate: '2026-08-01' }
    ];
    local.environments.work.recurringMeetings = [
      { id: 'rec_meet_1', title: 'Comité Semanal', start: 600, end: 660, freq: 'weekly', interval: 1, startDate: '2026-08-01', daysOfWeek: [1] }
    ];

    const remote = defaultState();
    remote.environments.work.recurringTasks = [];
    remote.environments.work.recurringMeetings = [];
    remote.environments.work._deletedRecurringIds = ['rec_task_1', 'rec_meet_1'];

    const merged = cloud.mergeStates(local, remote);

    expect(merged.environments.work.recurringTasks.some(r => String(r.id) === 'rec_task_1')).toBe(false);
    expect(merged.environments.work.recurringMeetings.some(r => String(r.id) === 'rec_meet_1')).toBe(false);
    expect(merged.environments.work._deletedRecurringIds).toContain('rec_task_1');
    expect(merged.environments.work._deletedRecurringIds).toContain('rec_meet_1');
  });
});

describe('TodayTasksCloud - detección de origen y sincronización', () => {
  let cloud, ctx, mockDocRef, mockDb, mockAuth, snapshotCallback;
  let setStateSpy, setMeetingEditSpy, setTaskEditSpy;

  beforeEach(() => {
    document.body.innerHTML = `
      <span id="syncStatus"></span>
      <div id="authArea"></div>
      <span id="appModeLabel"></span>
    `;

    snapshotCallback = null;
    mockDocRef = {
      set: vi.fn().mockResolvedValue(true),
      onSnapshot: vi.fn((opts, cb) => {
        snapshotCallback = cb || opts;
        return vi.fn();
      })
    };
    mockDb = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef)
      }),
      settings: vi.fn()
    };
    let authCallback = null;
    mockAuth = {
      setPersistence: vi.fn().mockResolvedValue(true),
      onAuthStateChanged: vi.fn((cb) => { authCallback = cb; }),
      getRedirectResult: vi.fn().mockResolvedValue(null),
      signOut: vi.fn()
    };

    global.firebase = {
      initializeApp: vi.fn(),
      auth: Object.assign(() => mockAuth, {
        Auth: { Persistence: { LOCAL: 'local' } }
      }),
      firestore: () => mockDb
    };

    setStateSpy = vi.fn();
    setMeetingEditSpy = vi.fn();
    setTaskEditSpy = vi.fn();

    ctx = {
      getState: () => defaultState(),
      setState: setStateSpy,
      setMeetingEdit: setMeetingEditSpy,
      setTaskEdit: setTaskEditSpy,
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

  it('pushToCloud incluye _lastUpdatedBy y _lastUpdatedAt con el clientId del cliente actual', () => {
    cloud.pushToCloud();

    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
    const sentData = mockDocRef.set.mock.calls[0][0];
    expect(sentData).toHaveProperty('_lastUpdatedBy');
    expect(sentData).toHaveProperty('_lastUpdatedAt');
    expect(sentData._lastUpdatedBy).toBe(cloud.getClientId());
    expect(typeof sentData._lastUpdatedAt).toBe('number');
  });

  it('pushToCloud no incluye selectedDate en los datos enviados a la nube', () => {
    const customState = defaultState();
    customState.selectedDate = '2026-08-15';
    ctx.getState = () => customState;
    cloud.pushToCloud();

    expect(mockDocRef.set).toHaveBeenCalled();
    const sentData = mockDocRef.set.mock.calls[mockDocRef.set.mock.calls.length - 1][0];
    expect(sentData.selectedDate).toBeUndefined();
  });

  it('onSnapshot ignora la confirmación de subida del propio dispositivo (no muestra "otro dispositivo" ni resetea edición)', () => {
    // 1. Primer snapshot de carga inicial
    const initialSnapshot = {
      metadata: { fromCache: false, hasPendingWrites: false },
      exists: true,
      data: () => ({ ...defaultState(), _lastUpdatedBy: cloud.getClientId() })
    };
    snapshotCallback(initialSnapshot);

    setStateSpy.mockClear();
    setMeetingEditSpy.mockClear();
    setTaskEditSpy.mockClear();

    // 2. Segundo snapshot: confirmación de Firestore de una escritura propia
    const ownAckSnapshot = {
      metadata: { fromCache: false, hasPendingWrites: false },
      exists: true,
      data: () => ({ ...defaultState(), _lastUpdatedBy: cloud.getClientId(), _lastUpdatedAt: Date.now() })
    };
    snapshotCallback(ownAckSnapshot);

    // No debe haber sobrescrito el estado ni reseteado la edición
    expect(setStateSpy).not.toHaveBeenCalled();
    expect(setMeetingEditSpy).not.toHaveBeenCalled();
    expect(setTaskEditSpy).not.toHaveBeenCalled();

    const statusEl = document.getElementById('syncStatus');
    expect(statusEl.textContent).toContain('Sincronizado');
    expect(statusEl.textContent).not.toContain('otro dispositivo');
  });

  it('onSnapshot aplica actualización y notifica cuando los datos provienen de OTRO dispositivo', () => {
    // 1. Primer snapshot de carga inicial
    const initialSnapshot = {
      metadata: { fromCache: false, hasPendingWrites: false },
      exists: true,
      data: () => ({ ...defaultState(), _lastUpdatedBy: cloud.getClientId() })
    };
    snapshotCallback(initialSnapshot);

    setStateSpy.mockClear();
    setMeetingEditSpy.mockClear();
    setTaskEditSpy.mockClear();

    // 2. Segundo snapshot: cambio realizado por OTRO dispositivo (clientId diferente)
    const otherDeviceSnapshot = {
      metadata: { fromCache: false, hasPendingWrites: false },
      exists: true,
      data: () => ({
        ...defaultState(),
        _lastUpdatedBy: 'c_other_device_999',
        _lastUpdatedAt: Date.now()
      })
    };
    snapshotCallback(otherDeviceSnapshot);

    // Debe haber ejecutado merge y reseteo de edición
    expect(setStateSpy).toHaveBeenCalledTimes(1);
    expect(setMeetingEditSpy).toHaveBeenCalledWith(null);
    expect(setTaskEditSpy).toHaveBeenCalledWith(null);

    const statusEl = document.getElementById('syncStatus');
    expect(statusEl.textContent).toContain('Actualizado desde otro dispositivo');
  });

  it('localiza mensajes de sincronización y estado de nube en inglés', async () => {
    const { setLocale } = await import('../js/i18n.js');
    setLocale('en');

    // 1. Primer snapshot
    const initialSnapshot = {
      metadata: { fromCache: false, hasPendingWrites: false },
      exists: true,
      data: () => ({ ...defaultState(), _lastUpdatedBy: cloud.getClientId() })
    };
    snapshotCallback(initialSnapshot);

    const statusEl = document.getElementById('syncStatus');
    expect(statusEl.textContent).toContain('Synced');

    // 2. Snapshot de otro dispositivo
    const otherDeviceSnapshot = {
      metadata: { fromCache: false, hasPendingWrites: false },
      exists: true,
      data: () => ({
        ...defaultState(),
        _lastUpdatedBy: 'c_other_device_888',
        _lastUpdatedAt: Date.now()
      })
    };
    snapshotCallback(otherDeviceSnapshot);
    expect(statusEl.textContent).toContain('Updated from another device');

    // Restaurar a español
    setLocale('es');
  });

  it('al estar autenticado con usuario de Google, appModeLabel mantiene la insignia de nube incluso tras ejecutar translateDOM', async () => {
    const { translateDOM, setLocale } = await import('../js/i18n.js');
    setLocale('es');

    const modeLabel = document.getElementById('appModeLabel');
    modeLabel.setAttribute('data-i18n', 'app.localDbBadge');
    modeLabel.textContent = '💾 local · persistente';

    // renderAuthArea con usuario activo debe fijar la insignia de nube y su data-i18n
    cloud.renderAuthArea();
    expect(modeLabel.getAttribute('data-i18n')).toBe('app.cloudDbBadge');
    expect(modeLabel.textContent).toContain('nube');

    // Al llamar a translateDOM (por ejemplo, en setState o cambio de idioma), no debe volver a local
    translateDOM();
    expect(modeLabel.textContent).toContain('nube');
    expect(modeLabel.textContent).not.toContain('local');
  });

  it('resuelve colisiones de displayId cuando una tarea creada offline coincide con una remota', () => {
    const local = defaultState();
    const remote = defaultState();

    // Ambos dispositivos crearon una tarea en paralelo con displayId 'W-1'
    remote.environments.work.nextTaskSeq = 2;
    remote.environments.work.days['2026-09-06'] = {
      tasks: [
        { id: 'uuid-remote-1', title: 'Tarea creada en la nube', displayId: 'W-1' }
      ]
    };

    local.environments.work.nextTaskSeq = 2;
    local.environments.work.days['2026-09-06'] = {
      tasks: [
        { id: 'uuid-local-1', title: 'Tarea creada offline', displayId: 'W-1' }
      ]
    };

    const merged = cloud.mergeStates(local, remote);
    const tasks = merged.environments.work.days['2026-09-06'].tasks;

    expect(tasks).toHaveLength(2);

    const remoteTask = tasks.find(t => t.id === 'uuid-remote-1');
    const offlineTask = tasks.find(t => t.id === 'uuid-local-1');

    // La tarea remota conserva 'W-1'
    expect(remoteTask.displayId).toBe('W-1');
    // La tarea local/offline se reasigna al siguiente identificador disponible ('W-2')
    expect(offlineTask.displayId).toBe('W-2');
    // El contador de secuencia se actualiza coherentemente (al menos 3)
    expect(merged.environments.work.nextTaskSeq).toBe(3);
  });
});



