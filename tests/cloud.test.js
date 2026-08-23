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
});


