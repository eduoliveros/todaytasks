import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodayTasksDragDrop } from '../js/actions/dragdrop.js';
import { TodayTasksTriageView } from '../js/views/triage.js';

describe('Reordenación y Movimiento de Tareas Multiseleccionadas en Triaje', () => {
  let state;
  let ctx;
  let dragDrop;
  let undoSnapshots;

  beforeEach(() => {
    undoSnapshots = [];
    state = {
      selectedDate: '2026-09-09',
      activeEnv: 'work',
      environments: {
        work: {
          tasks: [],
          days: {}
        }
      },
      tasks: [
        { id: 'T1', title: 'Tarea 1', status: 'pending', order: 1 },
        { id: 'T2', title: 'Tarea 2', status: 'pending', order: 2 },
        { id: 'T3', title: 'Tarea 3', status: 'pending', order: 3 },
        { id: 'T4', title: 'Tarea 4', status: 'pending', order: 4 },
        { id: 'T5', title: 'Tarea 5', status: 'pending', order: 5 },
        { id: 'T6', title: 'Tarea 6', status: 'pending', order: 6 }
      ]
    };

    ctx = {
      getState: () => state,
      saveState: vi.fn(),
      renderAll: vi.fn(),
      undoModule: {
        pushSnapshot: vi.fn((label) => undoSnapshots.push(label))
      },
      actionsModule: {}
    };

    dragDrop = TodayTasksDragDrop(ctx);
    ctx.actionsModule = dragDrop;
  });

  describe('reorderTaskByDrag con tareas seleccionadas', () => {
    it('al arrastrar hacia abajo sobre una tarea no seleccionada, coloca el bloque de seleccionadas después del objetivo', () => {
      // Seleccionamos T2 y T4. Cola: [T1, T2, T3, T4, T5, T6]
      // Arrastramos T2 (idx 1) hacia abajo y soltamos sobre T5 (idx 4)
      const selected = new Set(['T2', 'T4']);
      dragDrop.reorderTaskByDrag('T2', 'T5', selected);

      const resultIds = state.tasks.map(t => t.id);
      // No seleccionadas: [T1, T3, T5, T6]
      // Bloque [T2, T4] insertado tras T5 -> [T1, T3, T5, T2, T4, T6]
      expect(resultIds).toEqual(['T1', 'T3', 'T5', 'T2', 'T4', 'T6']);
      expect(state.tasks.map(t => t.order)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(state.tasks.map(t => t.manualOrder)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(ctx.saveState).toHaveBeenCalled();
      expect(undoSnapshots).toContain('Reordenar tareas');
    });

    it('al arrastrar hacia arriba sobre una tarea no seleccionada, coloca el bloque de seleccionadas antes del objetivo', () => {
      // Seleccionamos T2 y T5. Cola: [T1, T2, T3, T4, T5, T6]
      // Arrastramos T5 (idx 4) hacia arriba y soltamos sobre T1 (idx 0)
      const selected = new Set(['T2', 'T5']);
      dragDrop.reorderTaskByDrag('T5', 'T1', selected);

      const resultIds = state.tasks.map(t => t.id);
      // No seleccionadas: [T1, T3, T4, T6]
      // Bloque [T2, T5] insertado antes de T1 -> [T2, T5, T1, T3, T4, T6]
      expect(resultIds).toEqual(['T2', 'T5', 'T1', 'T3', 'T4', 'T6']);
      expect(state.tasks.map(t => t.order)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('al soltar sobre una tarea del propio grupo seleccionado, agrupa todas las tareas en torno a dicha tarea', () => {
      // Seleccionamos T1, T4, T6. Cola: [T1, T2, T3, T4, T5, T6]
      // Soltamos sobre T4 (que pertenece al grupo)
      const selected = new Set(['T1', 'T4', 'T6']);
      dragDrop.reorderTaskByDrag('T1', 'T4', selected);

      const resultIds = state.tasks.map(t => t.id);
      // T4 estaba entre T3 y T5. El grupo [T1, T4, T6] se compacta donde estaba T4:
      // [T2, T3, T1, T4, T6, T5]
      expect(resultIds).toEqual(['T2', 'T3', 'T1', 'T4', 'T6', 'T5']);
      expect(state.tasks.map(t => t.order)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('al arrastrar una tarea no seleccionada, no altera las tareas seleccionadas y solo mueve la tarea arrastrada', () => {
      // Seleccionamos T2 y T4. Cola: [T1, T2, T3, T4, T5, T6]
      // Arrastramos T6 (no seleccionada) hacia arriba sobre T1
      const selected = new Set(['T2', 'T4']);
      dragDrop.reorderTaskByDrag('T6', 'T1', selected);

      const resultIds = state.tasks.map(t => t.id);
      // T6 se mueve a la primera posición: [T6, T1, T2, T3, T4, T5]
      expect(resultIds).toEqual(['T6', 'T1', 'T2', 'T3', 'T4', 'T5']);
    });
  });

  describe('moveTaskDirectly / moveTasksGroupDirectly para el grupo seleccionado', () => {
    it('mueve el grupo seleccionado hacia arriba (up) pasando por encima de la tarea previa no seleccionada', () => {
      // Seleccionamos T3 y T4. Cola: [T1, T2, T3, T4, T5, T6]
      const selected = new Set(['T3', 'T4']);
      dragDrop.moveTasksGroupDirectly(selected, 'up');

      const resultIds = state.tasks.map(t => t.id);
      // [T3, T4] sobrepasan T2 -> [T1, T3, T4, T2, T5, T6]
      expect(resultIds).toEqual(['T1', 'T3', 'T4', 'T2', 'T5', 'T6']);
    });

    it('mueve el grupo seleccionado hacia abajo (down) pasando por debajo de la tarea siguiente no seleccionada', () => {
      // Seleccionamos T3 y T4. Cola: [T1, T2, T3, T4, T5, T6]
      const selected = new Set(['T3', 'T4']);
      dragDrop.moveTasksGroupDirectly(selected, 'down');

      const resultIds = state.tasks.map(t => t.id);
      // [T3, T4] pasan tras T5 -> [T1, T2, T5, T3, T4, T6]
      expect(resultIds).toEqual(['T1', 'T2', 'T5', 'T3', 'T4', 'T6']);
    });

    it('mueve el grupo seleccionado al inicio (top)', () => {
      // Seleccionamos T3 y T5. Cola: [T1, T2, T3, T4, T5, T6]
      const selected = new Set(['T3', 'T5']);
      dragDrop.moveTasksGroupDirectly(selected, 'top');

      const resultIds = state.tasks.map(t => t.id);
      expect(resultIds).toEqual(['T3', 'T5', 'T1', 'T2', 'T4', 'T6']);
    });

    it('mueve el grupo seleccionado al final (bottom)', () => {
      // Seleccionamos T2 y T4. Cola: [T1, T2, T3, T4, T5, T6]
      const selected = new Set(['T2', 'T4']);
      dragDrop.moveTasksGroupDirectly(selected, 'bottom');

      const resultIds = state.tasks.map(t => t.id);
      expect(resultIds).toEqual(['T1', 'T3', 'T5', 'T6', 'T2', 'T4']);
    });
  });

  describe('Integración con la vista de Triaje', () => {
    let triageView;
    let container;
    let mockActions;

    beforeEach(() => {
      document.body.innerHTML = '<div id="view-triage"></div>';
      container = document.getElementById('view-triage');

      mockActions = {
        reorderTaskByDrag: vi.fn(),
        moveTasksGroupDirectly: vi.fn(),
        moveTaskDirectly: vi.fn(),
        moveTasksToDate: vi.fn(),
        moveTaskToDate: vi.fn()
      };

      triageView = TodayTasksTriageView({
        ...ctx,
        actionsModule: mockActions
      });
    });

    it('al pulsar un botón rápido de fecha en una tarea seleccionada, mueve todas las tareas seleccionadas a dicha fecha', () => {
      triageView.renderTriageView();
      // Seleccionamos T1 y T2
      triageView.toggleTriageTaskSelect('T1');
      triageView.toggleTriageTaskSelect('T2');

      expect(triageView.getSelectedTaskIds().has('T1')).toBe(true);
      expect(triageView.getSelectedTaskIds().has('T2')).toBe(true);

      // Invocamos mover fecha sobre T1
      triageView.moveTriageTaskToDate('T1', '2026-09-10', 'Mañana');

      expect(mockActions.moveTasksToDate).toHaveBeenCalledWith(
        expect.arrayContaining(['T1', 'T2']),
        '2026-09-10'
      );
    });

    it('la barra flotante incluye botones para mover posición (top, up, down, bottom)', () => {
      triageView.renderTriageView();
      triageView.toggleTriageTaskSelect('T1');
      triageView.toggleTriageTaskSelect('T2');

      const floatingBar = document.getElementById('triageFloatingBar');
      expect(floatingBar).toBeTruthy();

      const topBtn = floatingBar.querySelector('.triage-batch-move-top');
      const upBtn = floatingBar.querySelector('.triage-batch-move-up');
      const downBtn = floatingBar.querySelector('.triage-batch-move-down');
      const bottomBtn = floatingBar.querySelector('.triage-batch-move-bottom');

      expect(topBtn).toBeTruthy();
      expect(upBtn).toBeTruthy();
      expect(downBtn).toBeTruthy();
      expect(bottomBtn).toBeTruthy();

      // Ejecutar acción batch move
      triageView.executeTriageBatchMoveDirection('up');
      expect(mockActions.moveTasksGroupDirectly).toHaveBeenCalledWith(
        expect.any(Set),
        'up'
      );
      // Las tareas se mantienen seleccionadas
      expect(triageView.getSelectedTaskIds().has('T1')).toBe(true);
      expect(triageView.getSelectedTaskIds().has('T2')).toBe(true);
    });

    it('el Bottom Sheet móvil muestra el contador de tareas seleccionadas y delega el movimiento conjunto', () => {
      triageView.renderTriageView();
      triageView.toggleTriageTaskSelect('T1');
      triageView.toggleTriageTaskSelect('T2');

      triageView.openMobileMoveSheet('T1');
      const titleEl = document.getElementById('triageMoveSheetTaskTitle');
      expect(titleEl.textContent).toContain('+1 seleccionadas');

      triageView.moveTriageTaskDirection('T1', 'down');
      expect(mockActions.moveTaskDirectly).toHaveBeenCalledWith(
        'T1',
        'down',
        expect.any(Set)
      );
      // Las tareas se mantienen seleccionadas tras mover
      expect(triageView.getSelectedTaskIds().has('T1')).toBe(true);
      expect(triageView.getSelectedTaskIds().has('T2')).toBe(true);
    });

    it('gestos touch de arrastre pasan las tareas seleccionadas a actions.reorderTaskByDrag', () => {
      vi.useFakeTimers();
      try {
        triageView.renderTriageView();
        triageView.toggleTriageTaskSelect('T1');
        triageView.toggleTriageTaskSelect('T2');

        const row1 = container.querySelector('.triage-task-row[data-task-id="T1"]');
        const row3 = container.querySelector('.triage-task-row[data-task-id="T3"]');

        const mockTouchStart = {
          touches: [{ clientX: 100, clientY: 100 }],
          target: row1.querySelector('.triage-drag-handle'),
          currentTarget: row1
        };
        triageView.handleTriageTouchStart('T1', mockTouchStart);

        // Avanzamos el timer para activar el drag táctil
        vi.advanceTimersByTime(100);

        // Simulamos touchmove sobre row3
        document.elementFromPoint = vi.fn().mockReturnValue(row3);
        const mockTouchMove = {
          touches: [{ clientX: 100, clientY: 200 }],
          cancelable: true,
          preventDefault: vi.fn()
        };
        triageView.handleTriageTouchMove(mockTouchMove);

        // Simulamos touchend
        const mockTouchEnd = {
          cancelable: true,
          preventDefault: vi.fn()
        };
        triageView.handleTriageTouchEnd(mockTouchEnd);

        expect(mockActions.reorderTaskByDrag).toHaveBeenCalledWith(
          'T1',
          'T3',
          expect.any(Set)
        );
        // Persistencia de la selección
        expect(triageView.getSelectedTaskIds().has('T1')).toBe(true);
        expect(triageView.getSelectedTaskIds().has('T2')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
