import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { getTodayStr } from '../js/utils.js';

describe('TodayTasksActions - Copiar Tareas a Otro Día', () => {
  let actions;
  let state;
  let idCounter = 1;

  beforeEach(() => {
    window.alert = vi.fn();

    state = defaultState();
    idCounter = 1;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => null,
      setTaskEdit: () => {},
      setNotifyState: () => {},
      getNotifyState: () => ({ taskId: null }),
      saveState: () => {},
      newId: () => idCounter++,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {}
    };

    actions = TodayTasksActions(ctx);
  });

  it('copia una tarea activa del día actual a una fecha futura con estado pending y duración completa', () => {
    actions.addTask('Informe Trimestral', '60');
    const sourceTask = state.tasks[0];
    const sourceId = sourceTask.id;

    const targetDate = '2026-08-10';
    actions.copyTaskToDate(sourceId, targetDate);

    const env = state.environments[state.activeEnv];
    expect(env.days[targetDate]).toBeDefined();
    const copiedTasks = env.days[targetDate].tasks;
    expect(copiedTasks).toHaveLength(1);
    expect(copiedTasks[0]).toMatchObject({
      title: 'Informe Trimestral',
      planned: 60,
      status: 'pending',
      elapsedBefore: 0,
      completedAt: null,
      actualDuration: null
    });
    expect(copiedTasks[0].id).not.toBe(sourceId);
  });

  it('copia una tarea completada de un día pasado al día actual (Hoy) reseteando estado a pending y duración completa', () => {
    const pastDate = '2026-08-01';
    state.selectedDate = pastDate;

    actions.addTask('Tarea Pasada', '45');
    const pastTask = state.tasks[0];
    actions.startTask(pastTask.id);
    actions.completeTask(pastTask.id);

    expect(state.tasks[0].status).toBe('completed');

    const todayStr = getTodayStr();
    actions.copyTaskToDate(pastTask.id, todayStr);

    state.selectedDate = todayStr;
    const todayTasks = state.tasks;
    expect(todayTasks.some(t => t.title === 'Tarea Pasada' && t.status === 'pending' && t.planned === 45 && t.elapsedBefore === 0)).toBe(true);
  });
});
