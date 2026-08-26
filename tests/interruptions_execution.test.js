import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TodayTasksExecution } from '../js/actions/execution.js';

describe('Interruptions & Task Recovery Execution (js/actions/execution.js)', () => {
  let state;
  let ctx;
  let helpers;
  let execution;
  let notifyState;

  beforeEach(() => {
    vi.useFakeTimers();

    state = {
      tasks: [
        { id: 'task-1', title: 'Task 1', status: 'running', runningStart: 500, planned: 30, elapsedBefore: 0, order: 1 },
        { id: 'task-2', title: 'Task 2', status: 'completed', planned: 20, elapsedBefore: 20, actualDuration: 22, completedAt: 522, order: 2 }
      ],
      interruptions: [],
      activeInterruption: null
    };

    notifyState = { taskId: 'task-1', lastNotifiedAt: 500, timeEndNotified: false };

    ctx = {
      getState: () => state,
      setNotifyState: vi.fn(ns => { notifyState = ns; }),
      getNotifyState: () => notifyState,
      saveState: vi.fn(),
      newId: () => 'generated_uuid_123',
      renderAll: vi.fn(),
      smartRender: vi.fn(),
      getCurrentView: () => 'main',
      getFocusTaskId: () => null
    };

    helpers = {
      nowMinutes: vi.fn(() => 530),
      fmtDur: (m) => `${m} min`,
      showToast: vi.fn()
    };

    execution = TodayTasksExecution(ctx, helpers);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = '';
  });

  it('starts an interruption, pausing any running task and routing to #/interruption', () => {
    execution.startInterruption();

    // Active running task should be paused
    const task1 = state.tasks.find(t => t.id === 'task-1');
    expect(task1.status).toBe('paused');

    // Active interruption state is initialized
    expect(state.activeInterruption).not.toBeNull();
    expect(state.activeInterruption.id).toBe('generated_uuid_123');
    expect(state.activeInterruption.start).toBe(530);
    expect(window.location.hash).toBe('#/interruption');
    expect(ctx.saveState).toHaveBeenCalled();
  });

  it('updates interruption title with debounce and saves state', () => {
    execution.startInterruption();
    ctx.saveState.mockClear();

    execution.updateInterruptionTitle('Urgencia con cliente');
    expect(state.activeInterruption.title).toBe('Urgencia con cliente');
    expect(ctx.saveState).not.toHaveBeenCalled();

    // Fast-forward 2000ms debounce
    vi.advanceTimersByTime(2000);
    expect(ctx.saveState).toHaveBeenCalledTimes(1);
  });

  it('completes interruption, records duration in history and clears active state', () => {
    execution.startInterruption();
    execution.updateInterruptionTitle('Llamada importante');

    // End interruption 15 minutes later at minute 545
    helpers.nowMinutes.mockReturnValue(545);
    execution.completeInterruption();

    expect(state.activeInterruption).toBeNull();
    expect(state.interruptions.length).toBe(1);
    expect(state.interruptions[0]).toEqual({
      id: 'generated_uuid_123',
      title: 'Llamada importante',
      start: 530,
      end: 545,
      duration: 15
    });

    expect(helpers.showToast).toHaveBeenCalledWith(expect.stringContaining('Llamada importante'));
    expect(window.location.hash).toBe('#/');
  });

  it('cancels interruption without recording in history', () => {
    execution.startInterruption();
    execution.cancelInterruption();

    expect(state.activeInterruption).toBeNull();
    expect(state.interruptions.length).toBe(0);
    expect(helpers.showToast).toHaveBeenCalledWith('Interrupción cancelada.');
    expect(window.location.hash).toBe('#/');
  });

  it('uncompletes a task restoring elapsed time and placing at bottom of active queue', () => {
    execution.uncompleteTask('task-2');

    const task2 = state.tasks.find(t => t.id === 'task-2');
    expect(task2.status).toBe('paused'); // Since elapsedBefore/actualDuration was > 0
    expect(task2.completedAt).toBeNull();
    expect(task2.elapsedBefore).toBe(22);
    expect(task2.order).toBe(2); // maxOrder + 1
    expect(ctx.saveState).toHaveBeenCalled();
    expect(helpers.showToast).toHaveBeenCalledWith(expect.stringContaining('se ha devuelto a en pausa'));
  });
});
