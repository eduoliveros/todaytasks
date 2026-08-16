import { describe, it, expect, beforeEach } from 'vitest';

describe('TodayTasksCloud - mergeStates', () => {
  let cloud;

  beforeEach(async () => {
    window.TodayTasksUi = { showToast: () => {} };
    await import('../js/config.js');
    await import('../js/utils.js');
    await import('../js/state.js');
    await import('../js/cloud.js');

    const ctx = {
      getState: () => window.TodayTasksState.defaultState(),
      setState: () => {},
      setMeetingEdit: () => {},
      setTaskEdit: () => {},
      saveState: () => {},
      STORAGE_KEY: 'test_key',
      syncFormInputsFromState: () => {},
      renderAll: () => {}
    };

    cloud = window.TodayTasksCloud(ctx);
  });

  it('preserva y combina correctamente las reuniones y tareas recurrentes en mergeStates', () => {
    const local = window.TodayTasksState.defaultState();
    local.environments.work.recurringMeetings = [
      { id: 1, title: 'Reunión Recurrente Local', freq: 'daily', interval: 1, startDate: '2026-08-01' }
    ];
    local.environments.work.recurringTasks = [
      { id: 2, title: 'Tarea Recurrente Local', planned: 30, freq: 'weekly', interval: 1, startDate: '2026-08-01', daysOfWeek: [1] }
    ];

    const remote = window.TodayTasksState.defaultState();
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

  it('preserva y combina correctamente el horario semanal (weeklySchedule) en mergeStates', () => {
    const local = window.TodayTasksState.defaultState();
    local.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 },
      5: { start: 540, end: 900 }
    };

    const remote = window.TodayTasksState.defaultState();
    remote.environments.work.weeklySchedule = {
      1: { start: 480, end: 960 },
      6: null
    };

    const merged = cloud.mergeStates(local, remote);

    // El día 1 se sobrescribe por el valor de la nube
    expect(merged.environments.work.weeklySchedule[1]).toEqual({ start: 480, end: 960 });
    // El día 5 se conserva del local
    expect(merged.environments.work.weeklySchedule[5]).toEqual({ start: 540, end: 900 });
    // El día 6 se conserva como nulo (día libre) proveniente de la nube
    expect(merged.environments.work.weeklySchedule[6]).toBeNull();
  });

  it('preserva el horario semanal local si la nube aún no tiene horario configurado (null)', () => {
    const local = window.TodayTasksState.defaultState();
    local.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 }
    };

    const remote = window.TodayTasksState.defaultState();
    remote.environments.work.weeklySchedule = null;

    const merged = cloud.mergeStates(local, remote);
    expect(merged.environments.work.weeklySchedule).toEqual({
      1: { start: 540, end: 1020 }
    });
  });
});
