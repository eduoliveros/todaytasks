import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodayTasksDragDrop } from '../js/actions/dragdrop.js';

describe('Drag and Drop Task Ordering (js/actions/dragdrop.js)', () => {
  let state;
  let ctx;
  let dragDrop;

  beforeEach(() => {
    state = {
      tasks: [
        { id: 'task-1', title: 'Task 1', status: 'pending', order: 1 },
        { id: 'task-2', title: 'Task 2', status: 'paused', order: 2 },
        { id: 'task-3', title: 'Task 3', status: 'pending', order: 3 },
        { id: 'task-4', title: 'Task 4', status: 'completed', order: 4 }
      ]
    };

    ctx = {
      getState: () => state,
      saveState: vi.fn(),
      renderAll: vi.fn()
    };

    dragDrop = TodayTasksDragDrop(ctx);
  });

  it('prevents drag start when drag is not armed', () => {
    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { effectAllowed: null, setData: vi.fn() },
      currentTarget: { classList: { add: vi.fn() } }
    };

    dragDrop.taskDragStart(mockEvent, 'task-1');
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.currentTarget.classList.add).not.toHaveBeenCalled();
  });

  it('allows drag start when armed and sets transfer data and class', () => {
    const classList = new Set();
    const mockElement = {
      classList: {
        add: (cls) => classList.add(cls),
        remove: (cls) => classList.delete(cls)
      }
    };
    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { effectAllowed: null, setData: vi.fn() },
      currentTarget: mockElement
    };

    dragDrop.armTaskDrag();
    dragDrop.taskDragStart(mockEvent, 'task-1');

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(mockEvent.dataTransfer.effectAllowed).toBe('move');
    expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'task-1');
    expect(classList.has('dragging')).toBe(true);
  });

  it('handles dragover and dragleave correctly', () => {
    const classList = new Set();
    const mockElement = {
      classList: {
        add: (cls) => classList.add(cls),
        remove: (cls) => classList.delete(cls)
      }
    };
    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: null },
      currentTarget: mockElement
    };

    // Arm and start dragging
    dragDrop.armTaskDrag();
    dragDrop.taskDragStart({
      preventDefault: vi.fn(),
      dataTransfer: { effectAllowed: null, setData: vi.fn() },
      currentTarget: { classList: { add: vi.fn() } }
    }, 'task-1');

    // Drag over target
    dragDrop.taskDragOver(mockEvent);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.dataTransfer.dropEffect).toBe('move');
    expect(classList.has('drag-over')).toBe(true);

    // Drag leave target
    dragDrop.taskDragLeave(mockEvent);
    expect(classList.has('drag-over')).toBe(false);
  });

  it('reorders task queue on drop and triggers saveState and renderAll', () => {
    const classList = new Set();
    const mockElement = {
      classList: {
        add: (cls) => classList.add(cls),
        remove: (cls) => classList.delete(cls)
      }
    };
    const mockEvent = {
      preventDefault: vi.fn(),
      currentTarget: mockElement
    };

    // Arm and start dragging task-3
    dragDrop.armTaskDrag();
    dragDrop.taskDragStart({
      preventDefault: vi.fn(),
      dataTransfer: { effectAllowed: null, setData: vi.fn() },
      currentTarget: { classList: { add: vi.fn() } }
    }, 'task-3');

    // Drop task-3 onto task-1 (move to top)
    dragDrop.taskDrop(mockEvent, 'task-1');

    expect(ctx.saveState).toHaveBeenCalled();
    expect(ctx.renderAll).toHaveBeenCalled();

    // Check new ordering in active tasks (task-3 should be first, then task-1, then task-2)
    const activeTasks = state.tasks.filter(t => t.status !== 'completed').sort((a, b) => a.order - b.order);
    expect(activeTasks[0].id).toBe('task-3');
    expect(activeTasks[0].order).toBe(1);
    expect(activeTasks[1].id).toBe('task-1');
    expect(activeTasks[1].order).toBe(2);
    expect(activeTasks[2].id).toBe('task-2');
    expect(activeTasks[2].order).toBe(3);
  });

  it('cleans up drag classes on drag end', () => {
    document.body.innerHTML = `
      <div class="task-item dragging"></div>
      <div class="task-item drag-over"></div>
    `;

    dragDrop.taskDragEnd({});

    expect(document.querySelectorAll('.dragging').length).toBe(0);
    expect(document.querySelectorAll('.drag-over').length).toBe(0);
  });
});
