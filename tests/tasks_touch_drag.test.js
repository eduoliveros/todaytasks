import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';
import { getTodayStr } from '../js/utils.js';

describe('Drag & Drop táctil en el tablero (Fase 2)', () => {
  let state;
  let tasksView;
  let container;
  let reorderSpy;

  beforeEach(() => {
    document.body.innerHTML = `<div id="tasksList"></div>`;
    container = document.getElementById('tasksList');

    state = defaultState();
    state.selectedDate = getTodayStr();
    state.tasks = [
      { id: 'task-1', title: 'Primera tarea', planned: 30, urgency: 'today', order: 1, manualOrder: 1, status: 'pending' },
      { id: 'task-2', title: 'Segunda tarea', planned: 45, urgency: 'today', order: 2, manualOrder: 2, status: 'pending' },
      { id: 'task-3', title: 'Tarea en curso', planned: 45, urgency: 'today', order: 3, manualOrder: 3, status: 'running' }
    ];

    reorderSpy = vi.fn();

    const ctx = {
      getState: () => state,
      getTaskEdit: () => null,
      getTaskSearchQuery: () => '',
      countPendingAutoMoveTasks: vi.fn(() => 0),
      renderAll: vi.fn(),
      smartRender: vi.fn(),
      actionsModule: { reorderTaskByDrag: reorderSpy }
    };

    tasksView = TodayTasksTasksView(ctx);
  });

  it('renderiza atributos táctiles en tarjetas arrastrables (pending/paused)', () => {
    tasksView.renderTasks(null);
    const item = container.querySelector('.task-item[data-task-id="task-1"]');
    expect(item.getAttribute('ontouchstart')).toContain("app.handleTaskTouchStart('task-1'");
    expect(item.getAttribute('ontouchmove')).toContain('app.handleTaskTouchMove');
    expect(item.getAttribute('ontouchend')).toContain('app.handleTaskTouchEnd');
    expect(item.getAttribute('ontouchcancel')).toContain('app.handleTaskTouchCancel');
  });

  it('NO renderiza atributos táctiles en tareas en ejecución (running)', () => {
    tasksView.renderTasks(null);
    const item = container.querySelector('.task-item[data-task-id="task-3"]');
    expect(item.getAttribute('ontouchstart')).toBeNull();
  });

  it('long-press activa el drag y soltar sobre otra tarjeta reordena vía reorderTaskByDrag', () => {
    vi.useFakeTimers();
    try {
      tasksView.renderTasks(null);
      const row1 = container.querySelector('.task-item[data-task-id="task-1"]');
      const row2 = container.querySelector('.task-item[data-task-id="task-2"]');

      tasksView.handleTaskTouchStart('task-1', {
        touches: [{ clientX: 100, clientY: 100 }],
        target: row1.querySelector('.title'),
        currentTarget: row1
      });

      // Antes del long-press no está activo el drag
      expect(row1.classList.contains('dragging')).toBe(false);

      vi.advanceTimersByTime(420);
      expect(row1.classList.contains('dragging')).toBe(true);
      expect(row1.classList.contains('long-press-active')).toBe(true);

      document.elementFromPoint = vi.fn().mockReturnValue(row2);
      tasksView.handleTaskTouchMove({
        touches: [{ clientX: 100, clientY: 200 }],
        cancelable: true,
        preventDefault: vi.fn()
      });

      tasksView.handleTaskTouchEnd({ cancelable: true, preventDefault: vi.fn() });

      expect(reorderSpy).toHaveBeenCalledWith('task-1', 'task-2', null);

      // Limpieza de clases tras soltar
      expect(row1.classList.contains('dragging')).toBe(false);
      expect(row1.classList.contains('long-press-active')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
