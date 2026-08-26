import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TodayTasksUndo } from '../js/undo.js';
import { TodayTasksTasks } from '../js/actions/tasks.js';
import { TodayTasksExecution } from '../js/actions/execution.js';
import { showToast } from '../js/ui.js';
import { defaultState, wrapState } from '../js/state.js';

describe('Undo / Redo History System (js/undo.js)', () => {
  let state;
  let ctx;
  let undoModule;

  beforeEach(() => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <div id="toast"></div>
    `;

    state = {
      tasks: [
        { id: 'task-1', title: 'Comprar café', status: 'pending', planned: 15, order: 1 }
      ],
      meetings: [
        { id: 'm-1', title: 'Reunión semanal', start: 600, end: 630 }
      ],
      environments: {
        work: { days: {}, history: [] }
      },
      selectedDate: '2026-08-27'
    };

    ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      saveState: vi.fn(),
      renderAll: vi.fn(),
      showToast: vi.fn(),
      newId: () => 'uuid-new-1',
      getTaskEdit: () => null,
      setTaskEdit: vi.fn(),
      getMeetingEdit: () => null,
      setMeetingEdit: vi.fn(),
      getNotifyState: () => null,
      setNotifyState: vi.fn()
    };

    undoModule = TodayTasksUndo(ctx);
    ctx.undoModule = undoModule;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty history stacks', () => {
    expect(undoModule.canUndo()).toBe(false);
    expect(undoModule.canRedo()).toBe(false);
  });

  it('records snapshots and caps history at 25 entries', () => {
    for (let i = 1; i <= 30; i++) {
      state.tasks.push({ id: `task-${i}`, title: `Tarea ${i}` });
      undoModule.pushSnapshot(`Acción ${i}`);
    }

    expect(undoModule.canUndo()).toBe(true);

    let undoCount = 0;
    while (undoModule.canUndo()) {
      undoModule.undo();
      undoCount++;
    }

    expect(undoCount).toBe(25);
  });

  it('undo restores previous state and updates redo stack', () => {
    // Initial state: 1 task
    expect(state.tasks.length).toBe(1);

    // Push snapshot before adding a second task
    undoModule.pushSnapshot('Añadir tarea 2');
    state.tasks.push({ id: 'task-2', title: 'Documentar API', status: 'pending' });

    expect(state.tasks.length).toBe(2);
    expect(undoModule.canUndo()).toBe(true);
    expect(undoModule.canRedo()).toBe(false);

    // Undo action
    const undoResult = undoModule.undo();
    expect(undoResult).toBe(true);
    expect(state.tasks.length).toBe(1);
    expect(state.tasks[0].id).toBe('task-1');
    expect(ctx.saveState).toHaveBeenCalled();
    expect(ctx.renderAll).toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith('Deshecho: Añadir tarea 2');
    expect(undoModule.canRedo()).toBe(true);

    // Redo action
    const redoResult = undoModule.redo();
    expect(redoResult).toBe(true);
    expect(state.tasks.length).toBe(2);
    expect(ctx.showToast).toHaveBeenCalledWith('Rehecho: Añadir tarea 2');
    expect(undoModule.canRedo()).toBe(false);
  });

  it('clears redo stack when a new action is performed after undo', () => {
    undoModule.pushSnapshot('Acción 1');
    state.tasks.push({ id: 'task-2', title: 'Tarea 2' });

    undoModule.undo();
    expect(undoModule.canRedo()).toBe(true);

    // New user action
    undoModule.pushSnapshot('Acción 3');
    expect(undoModule.canRedo()).toBe(false);
  });

  it('returns false and informs user when undo/redo is invoked on empty stack', () => {
    expect(undoModule.undo()).toBe(false);
    expect(ctx.showToast).toHaveBeenCalledWith('No hay acciones para deshacer.');

    expect(undoModule.redo()).toBe(false);
    expect(ctx.showToast).toHaveBeenCalledWith('No hay acciones para rehacer.');
  });

  it('recovers deleted task when deleteTask is undone via action', () => {
    const helpers = {
      nowMinutes: () => 600,
      showToast: (msg, action) => {
        // Simulates toast displaying and user clicking "Deshacer"
        if (action && typeof action.onClick === 'function') {
          action.onClick();
        }
      },
      showRecurringModal: vi.fn()
    };

    const tasksActions = TodayTasksTasks(ctx, helpers);

    // Initial state: 1 task
    expect(state.tasks.length).toBe(1);

    // Delete task
    tasksActions.deleteTask('task-1');

    // Because onClick was invoked immediately in mock showToast, task is restored
    expect(state.tasks.length).toBe(1);
    expect(state.tasks[0].id).toBe('task-1');
    expect(state.tasks[0].title).toBe('Comprar café');
  });

  it('recovers completed task when completeTask is undone', () => {
    const helpers = {
      nowMinutes: () => 600,
      fmtDur: (m) => `${m} min`,
      showToast: vi.fn()
    };

    const execActions = TodayTasksExecution(ctx, helpers);

    // Complete task
    execActions.completeTask('task-1');
    expect(state.tasks[0].status).toBe('completed');

    // Undo completion
    undoModule.undo();
    expect(state.tasks[0].status).toBe('pending');
  });

  it('supports interactive action button in showToast', () => {
    const actionCallback = vi.fn();
    showToast('Elemento borrado', {
      label: 'Deshacer',
      onClick: actionCallback
    });

    const toastEl = document.getElementById('toast');
    expect(toastEl.classList.contains('visible')).toBe(true);

    const btn = toastEl.querySelector('.toast-action-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Deshacer');

    btn.click();
    expect(actionCallback).toHaveBeenCalledTimes(1);
    expect(toastEl.classList.contains('visible')).toBe(false);
  });

  it('preserves state getters (state.tasks, state.meetings) when wrapped state is restored via undo/redo', () => {
    state = wrapState(defaultState());
    state.tasks = [{ id: 't1', title: 'Task 1', status: 'pending', planned: 30, order: 1 }];
    state.meetings = [{ id: 'm1', title: 'Daily', start: 600, end: 630 }];

    undoModule.pushSnapshot('Before adding second task');
    state.tasks.push({ id: 't2', title: 'Task 2', status: 'pending', planned: 20, order: 2 });
    expect(state.tasks.length).toBe(2);

    // Undo the addition
    undoModule.undo();

    // The bug caused state.tasks and state.meetings to be undefined on the restored state
    expect(state.tasks).toBeDefined();
    expect(Array.isArray(state.tasks)).toBe(true);
    expect(state.tasks.length).toBe(1);
    expect(state.tasks[0].title).toBe('Task 1');

    expect(state.meetings).toBeDefined();
    expect(Array.isArray(state.meetings)).toBe(true);
    expect(state.meetings.length).toBe(1);
    expect(state.meetings[0].title).toBe('Daily');
  });
});
