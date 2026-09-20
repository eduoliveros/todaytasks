import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodayTasksDragDrop } from '../js/actions/dragdrop.js';

describe('Drag and Drop Constraints - Dependencies & startAfter (js/actions/dragdrop.js)', () => {
  let state;
  let ctx;
  let dragDrop;

  beforeEach(() => {
    state = {
      tasks: [
        { id: 'task-1', displayId: 'W-1', title: 'Task 1 (Base)', status: 'pending', order: 1, manualOrder: 1 },
        { id: 'task-2', displayId: 'W-2', title: 'Task 2 (Depends on W-1)', status: 'pending', order: 2, manualOrder: 2, dependsOn: ['task-1'] },
        { id: 'task-3', displayId: 'W-3', title: 'Task 3 (Free)', status: 'pending', order: 3, manualOrder: 3 },
        { id: 'task-4', displayId: 'W-4', title: 'Task 4 (startAfter 10:00)', status: 'pending', order: 4, manualOrder: 4, startAfter: 600 },
        { id: 'task-5', displayId: 'W-5', title: 'Task 5 (startAfter 16:00)', status: 'pending', order: 5, manualOrder: 5, startAfter: 960 }
      ]
    };

    ctx = {
      getState: () => state,
      saveState: vi.fn(),
      renderAll: vi.fn(),
      undoModule: { pushSnapshot: vi.fn() }
    };

    dragDrop = TodayTasksDragDrop(ctx);
  });

  describe('Dependency constraints', () => {
    it('does not allow a dependent task to be placed before its blocker and auto-adjusts immediately after blocker', () => {
      // Arrastrar task-2 (depende de task-1) a la posición de task-1 (arriba de ella)
      dragDrop.armTaskDrag();
      dragDrop.taskDragStart({
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: null, setData: vi.fn() },
        currentTarget: { classList: { add: vi.fn() } }
      }, 'task-2');

      dragDrop.taskDrop({ preventDefault: vi.fn() }, 'task-1');

      // task-1 debe seguir antes que task-2
      const t1 = state.tasks.find(t => t.id === 'task-1');
      const t2 = state.tasks.find(t => t.id === 'task-2');
      expect(t1.order).toBeLessThan(t2.order);
      expect(t2.order).toBe(2); // Inmediatamente después de task-1
    });

    it('does not allow a blocker task to be placed after its dependent task and auto-adjusts immediately before dependent', () => {
      // Arrastrar task-1 (bloquea a task-2) a la posición de task-3 (después de task-2)
      dragDrop.armTaskDrag();
      dragDrop.taskDragStart({
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: null, setData: vi.fn() },
        currentTarget: { classList: { add: vi.fn() } }
      }, 'task-1');

      dragDrop.taskDrop({ preventDefault: vi.fn() }, 'task-3');

      const t1 = state.tasks.find(t => t.id === 'task-1');
      const t2 = state.tasks.find(t => t.id === 'task-2');
      // task-1 debe quedar antes que task-2
      expect(t1.order).toBeLessThan(t2.order);
    });

    it('prevents moveTaskDirectly up/top if it would violate dependencies', () => {
      // Intentar mover task-2 hacia 'up' (que sería antes de task-1)
      const res = dragDrop.moveTaskDirectly('task-2', 'up');
      // No debe moverse antes de task-1
      const t1 = state.tasks.find(t => t.id === 'task-1');
      const t2 = state.tasks.find(t => t.id === 'task-2');
      expect(t1.order).toBeLessThan(t2.order);
    });
  });

  describe('startAfter constraints', () => {
    it('does not allow a task with later startAfter to precede a task with earlier startAfter', () => {
      // task-5 tiene startAfter: 960 (16:00), task-4 tiene startAfter: 600 (10:00)
      // Intentar arrastrar task-5 a la posición de task-4 (arriba de ella)
      dragDrop.armTaskDrag();
      dragDrop.taskDragStart({
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: null, setData: vi.fn() },
        currentTarget: { classList: { add: vi.fn() } }
      }, 'task-5');

      dragDrop.taskDrop({ preventDefault: vi.fn() }, 'task-4');

      const t4 = state.tasks.find(t => t.id === 'task-4');
      const t5 = state.tasks.find(t => t.id === 'task-5');
      // task-4 debe seguir antes que task-5
      expect(t4.order).toBeLessThan(t5.order);
    });

    it('allows a free task without startAfter to be moved anywhere (before, between, or after startAfter tasks)', () => {
      // task-3 no tiene startAfter. Puede moverse después de task-5 o antes de task-4
      dragDrop.armTaskDrag();
      dragDrop.taskDragStart({
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: null, setData: vi.fn() },
        currentTarget: { classList: { add: vi.fn() } }
      }, 'task-3');

      dragDrop.taskDrop({ preventDefault: vi.fn() }, 'task-5');

      const t3 = state.tasks.find(t => t.id === 'task-3');
      const t4 = state.tasks.find(t => t.id === 'task-4');
      const t5 = state.tasks.find(t => t.id === 'task-5');

      // task-3 se colocó exitosamente después de task-5 (o al final)
      expect(t3.order).toBeGreaterThan(t4.order);
    });
  });

  describe('Visual feedback and checkIsDropTargetAllowed', () => {
    it('reports target as not allowed when dropping a dependent before its blocker', () => {
      dragDrop.armTaskDrag();
      dragDrop.taskDragStart({
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: null, setData: vi.fn() },
        currentTarget: { classList: { add: vi.fn() } }
      }, 'task-2'); // depende de task-1

      const isAllowed = dragDrop.checkIsDropTargetAllowed('task-1');
      expect(isAllowed).toBe(false);

      const isAllowedFree = dragDrop.checkIsDropTargetAllowed('task-3');
      expect(isAllowedFree).toBe(true);
    });

    it('adds drag-forbidden class during taskDragOver on invalid target', () => {
      const classList = new Set();
      const mockElement = {
        classList: {
          add: (cls) => classList.add(cls),
          remove: (cls) => classList.delete(cls)
        },
        dataset: { taskId: 'task-1' }
      };

      dragDrop.armTaskDrag();
      dragDrop.taskDragStart({
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: null, setData: vi.fn() },
        currentTarget: { classList: { add: vi.fn() } }
      }, 'task-2'); // depende de task-1

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: { dropEffect: 'move' },
        currentTarget: mockElement
      };

      dragDrop.taskDragOver(mockEvent, 'task-1');
      expect(mockEvent.dataTransfer.dropEffect).toBe('move');
      expect(classList.has('drag-forbidden')).toBe(true);
      expect(classList.has('drag-over')).toBe(false);
    });

    it('displays informative toast message explaining why a task cannot move or was adjusted', () => {
      const showToast = vi.fn();
      const customDragDrop = TodayTasksDragDrop(ctx, { showToast });

      // 1. Intentar mover task-2 (depende de task-1) antes de task-1
      customDragDrop.armTaskDrag();
      customDragDrop.taskDragStart({
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: null, setData: vi.fn() },
        currentTarget: { classList: { add: vi.fn() } }
      }, 'task-2');
      customDragDrop.taskDrop({ preventDefault: vi.fn() }, 'task-1');

      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('W-1'));

      // 2. Intentar mover task-5 (startAfter 16:00) antes de task-4 (startAfter 10:00)
      showToast.mockClear();
      customDragDrop.armTaskDrag();
      customDragDrop.taskDragStart({
        preventDefault: vi.fn(),
        dataTransfer: { effectAllowed: null, setData: vi.fn() },
        currentTarget: { classList: { add: vi.fn() } }
      }, 'task-5');
      customDragDrop.taskDrop({ preventDefault: vi.fn() }, 'task-4');

      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('10:00'));

      // 3. Botón de mover arriba directamente bloqueado por dependencia
      showToast.mockClear();
      const moved = customDragDrop.moveTaskDirectly('task-2', 'up');
      expect(moved).toBe(false);
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('W-1'));

      // 4. Mover hacia arriba cuando la tarea ya está en la primera posición
      showToast.mockClear();
      const movedTop = customDragDrop.moveTaskDirectly('task-1', 'up');
      expect(movedTop).toBe(false);
      expect(showToast).toHaveBeenCalledWith('La tarea ya está en la primera posición');

      // 5. Mover hacia abajo cuando la tarea ya está en la última posición
      showToast.mockClear();
      const movedBottom = customDragDrop.moveTaskDirectly('task-5', 'down');
      expect(movedBottom).toBe(false);
      expect(showToast).toHaveBeenCalledWith('La tarea ya está en la última posición');

      // 6. Intentar mover tarea en ejecución (status: running)
      showToast.mockClear();
      state.tasks.push({ id: 'task-running', title: 'Running Task', status: 'running', order: 0 });
      const movedRunning = customDragDrop.moveTaskDirectly('task-running', 'down');
      expect(movedRunning).toBe(false);
      expect(showToast).toHaveBeenCalledWith('No se puede mover una tarea en ejecución. Paúsala primero.');

      // 7. Intentar mover hacia una tarea completada
      showToast.mockClear();
      state.tasks.push({ id: 'task-done', title: 'Done Task', status: 'completed', order: 99 });
      customDragDrop.reorderTaskByDrag('task-1', 'task-done');
      expect(showToast).toHaveBeenCalledWith('No se puede mover hacia una tarea completada.');
    });

    it('permite reordenar tareas con la misma hora de comienzo (mismo startAfter)', () => {
      state.tasks = [
        { id: 'sa-1', displayId: 'W-SA1', title: 'Task SA 1', status: 'pending', order: 1, startAfter: 10 * 60 },
        { id: 'sa-2', displayId: 'W-SA2', title: 'Task SA 2', status: 'pending', order: 2, startAfter: 10 * 60 }
      ];

      const showToast = vi.fn();
      const customDragDrop = TodayTasksDragDrop(ctx, { showToast });

      const moved = customDragDrop.moveTaskDirectly('sa-2', 'up');
      expect(moved).toBe(true);
      expect(state.tasks[0].id).toBe('sa-2');
      expect(state.tasks[1].id).toBe('sa-1');
      expect(showToast).not.toHaveBeenCalled();
    });
  });
});
