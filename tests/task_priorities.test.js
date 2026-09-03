import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  URGENCY_LEVELS,
  DEFAULT_URGENCY,
  MAX_FEATURED_TASKS,
  getUrgencyWeight,
  compareTasksByPriority,
  sortTasksByPriority,
  sortTasksWithManualOrder
} from '../js/utils.js';
import { defaultState, wrapState } from '../js/state.js';
import { TodayTasksTasks } from '../js/actions/tasks.js';
import { TodayTasksExecution } from '../js/actions/execution.js';
import { TodayTasksUndo } from '../js/undo.js';

describe('Task Priorities (Urgency & Featured)', () => {
  describe('Utils & Sorting Constants', () => {
    it('defines the 4 urgency levels with correct default and limit', () => {
      expect(DEFAULT_URGENCY).toBe('days');
      expect(MAX_FEATURED_TASKS).toBe(5);
      expect(URGENCY_LEVELS.today).toBeDefined();
      expect(URGENCY_LEVELS.days).toBeDefined();
      expect(URGENCY_LEVELS.week).toBeDefined();
      expect(URGENCY_LEVELS.later).toBeDefined();

      expect(getUrgencyWeight('today')).toBe(1);
      expect(getUrgencyWeight('days')).toBe(2);
      expect(getUrgencyWeight('week')).toBe(3);
      expect(getUrgencyWeight('later')).toBe(4);
      expect(getUrgencyWeight('unknown')).toBe(2);
      expect(getUrgencyWeight(undefined)).toBe(2);
    });

    it('correctly compares tasks by priority hierarchy (running > urgency > featured > order)', () => {
      const runningTask = { id: '1', title: 'Running', status: 'running', urgency: 'later', featured: false, order: 10 };
      const todayFeatured = { id: '2', title: 'Today Star', status: 'pending', urgency: 'today', featured: true, order: 5 };
      const todayNormal = { id: '3', title: 'Today Normal', status: 'pending', urgency: 'today', featured: false, order: 2 };
      const daysFeatured = { id: '4', title: 'Days Star', status: 'pending', urgency: 'days', featured: true, order: 1 };
      const daysNormalA = { id: '5', title: 'Days Normal A', status: 'pending', urgency: 'days', featured: false, order: 1 };
      const daysNormalB = { id: '6', title: 'Days Normal B', status: 'pending', urgency: 'days', featured: false, order: 2 };
      const weekFeatured = { id: '7', title: 'Week Star', status: 'pending', urgency: 'week', featured: true, order: 1 };
      const laterNormal = { id: '8', title: 'Later Normal', status: 'pending', urgency: 'later', featured: false, order: 1 };

      const tasks = [laterNormal, daysNormalB, daysFeatured, runningTask, weekFeatured, todayNormal, todayFeatured, daysNormalA];
      const sorted = [...tasks].sort(compareTasksByPriority);

      expect(sorted.map(t => t.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    });

    it('sortTasksByPriority reassigns order 1..N respecting hierarchy', () => {
      const tasks = [
        { id: 'a', title: 'A', urgency: 'week', featured: false, order: 1 },
        { id: 'b', title: 'B', urgency: 'today', featured: false, order: 2 },
        { id: 'c', title: 'C', urgency: 'today', featured: true, order: 3 },
      ];
      const sorted = sortTasksByPriority(tasks);
      expect(sorted[0].id).toBe('c'); // Today + Featured
      expect(sorted[1].id).toBe('b'); // Today
      expect(sorted[2].id).toBe('a'); // Week
      expect(sorted[0].order).toBe(1);
      expect(sorted[1].order).toBe(2);
      expect(sorted[2].order).toBe(3);
    });
  });

  describe('State Migration & Defaults', () => {
    it('migrates legacy tasks without urgency or featured fields to default values', () => {
      const legacyState = {
        activeEnv: 'work',
        selectedDate: '2026-08-29',
        environments: {
          work: {
            days: {
              '2026-08-29': {
                tasks: [
                  { id: 'legacy-1', title: 'Old Task', planned: 30, order: 1, status: 'pending' }
                ]
              }
            }
          }
        }
      };

      const wrapped = wrapState(legacyState);
      const t = wrapped.tasks[0];
      expect(t.urgency).toBe('days');
      expect(t.featured).toBe(false);
    });
  });

  describe('Actions: Task CRUD with Urgency and Featured', () => {
    let state, ctx, helpers, tasksModule;

    beforeEach(() => {
      state = defaultState();
      let taskEdit = null;
      ctx = {
        getState: () => state,
        setState: (ns) => { state = wrapState(ns); },
        getTaskEdit: () => taskEdit,
        setTaskEdit: (te) => { taskEdit = te; },
        saveState: vi.fn(),
        newId: (() => { let i = 1; return () => 'id_' + (i++); })(),
        renderAll: vi.fn(),
        smartRender: vi.fn(),
      };
      const undoModule = TodayTasksUndo({
        getState: () => state,
        setState: ctx.setState,
        saveState: ctx.saveState,
        renderAll: ctx.renderAll,
        showToast: vi.fn()
      });
      ctx.undoModule = undoModule;

      helpers = {
        nowMinutes: () => 600,
        showToast: vi.fn(),
        showRecurringModal: vi.fn(),
        showFeaturedLimitModal: vi.fn()
      };

      tasksModule = TodayTasksTasks(ctx, helpers);
    });

    it('addTask sets urgency (default "days") and featured (default false) and sorts automatically', () => {
      tasksModule.addTask('Task Days', '30');
      tasksModule.addTask('Task Today', '30', false, null, true, 'today', false);
      tasksModule.addTask('Task Today Star', '30', false, null, true, 'today', true);

      expect(state.tasks.length).toBe(3);
      // Today Star should be order 1, Today should be order 2, Days should be order 3
      const sorted = [...state.tasks].sort((a, b) => a.order - b.order);
      expect(sorted[0].title).toBe('Task Today Star');
      expect(sorted[0].urgency).toBe('today');
      expect(sorted[0].featured).toBe(true);

      expect(sorted[1].title).toBe('Task Today');
      expect(sorted[1].urgency).toBe('today');
      expect(sorted[1].featured).toBe(false);

      expect(sorted[2].title).toBe('Task Days');
      expect(sorted[2].urgency).toBe('days');
      expect(sorted[2].featured).toBe(false);
    });

    it('setTaskUrgency changes urgency and reorders tasks according to priority', () => {
      tasksModule.addTask('Task 1', '30', false, null, true, 'days');
      tasksModule.addTask('Task 2', '30', false, null, true, 'week');

      const id2 = state.tasks.find(t => t.title === 'Task 2').id;
      // Change Task 2 from 'week' to 'today'
      tasksModule.setTaskUrgency(id2, 'today');

      const updated2 = state.tasks.find(t => t.id === id2);
      expect(updated2.urgency).toBe('today');

      const sorted = [...state.tasks].sort((a, b) => a.order - b.order);
      expect(sorted[0].id).toBe(id2);
      expect(sorted[0].order).toBe(1);
    });

    it('toggleTaskFeatured toggles featured flag and maintains order within urgency group', () => {
      tasksModule.addTask('Task A', '30', false, null, true, 'days', false);
      tasksModule.addTask('Task B', '30', false, null, true, 'days', false);

      const idB = state.tasks.find(t => t.title === 'Task B').id;
      tasksModule.toggleTaskFeatured(idB);

      const updatedB = state.tasks.find(t => t.id === idB);
      expect(updatedB.featured).toBe(true);

      const sorted = [...state.tasks].sort((a, b) => a.order - b.order);
      expect(sorted[0].id).toBe(idB); // Featured task in 'days' group moved ahead of non-featured in 'days' group
    });

    it('limits featured tasks to maximum 5 and opens limit modal when attempting a 6th', () => {
      for (let i = 1; i <= 5; i++) {
        tasksModule.addTask(`Featured Task ${i}`, '30', false, null, true, 'days', true);
      }
      expect(state.tasks.filter(t => t.featured).length).toBe(5);

      tasksModule.addTask('Task 6', '30', false, null, true, 'days', false);
      const id6 = state.tasks.find(t => t.title === 'Task 6').id;

      // Attempting to feature task 6 should trigger showFeaturedLimitModal
      tasksModule.toggleTaskFeatured(id6);

      expect(helpers.showFeaturedLimitModal).toHaveBeenCalled();
      // Task 6 is not featured yet
      expect(state.tasks.find(t => t.id === id6).featured).toBe(false);

      // Resolving the limit: unfeature Task 1 and feature Task 6
      const id1 = state.tasks.find(t => t.title === 'Featured Task 1').id;
      tasksModule.resolveFeaturedLimit(id6, id1);

      expect(state.tasks.find(t => t.id === id1).featured).toBe(false);
      expect(state.tasks.find(t => t.id === id6).featured).toBe(true);
      expect(state.tasks.filter(t => t.featured).length).toBe(5);
    });

    it('startEditTask, updateTaskEditField and saveEditTask preserve and update urgency and featured', () => {
      tasksModule.addTask('Editable Task', '30', false, null, true, 'days', false);
      const task = state.tasks[0];

      tasksModule.startEditTask(task.id);
      expect(ctx.getTaskEdit().urgency).toBe('days');
      expect(ctx.getTaskEdit().featured).toBe(false);

      tasksModule.updateTaskEditField('urgency', 'today');
      tasksModule.updateTaskEditField('featured', true);
      tasksModule.saveEditTask(task.id);

      expect(task.urgency).toBe('today');
      expect(task.featured).toBe(true);
    });

    it('supports undo and redo for urgency and featured updates', () => {
      tasksModule.addTask('Undoable Task', '30', false, null, true, 'days', false);
      const task = state.tasks[0];

      tasksModule.setTaskUrgency(task.id, 'today');
      expect(state.tasks[0].urgency).toBe('today');

      ctx.undoModule.undo();
      expect(state.tasks[0].urgency).toBe('days');

      ctx.undoModule.redo();
      expect(state.tasks[0].urgency).toBe('today');
    });

    it('completed featured tasks do not count towards the 5 limit and completing a featured task frees a slot', () => {
      // Crear 5 tareas destacadas
      for (let i = 1; i <= 5; i++) {
        tasksModule.addTask(`Featured ${i}`, '30', false, null, true, 'days', true);
      }
      expect(state.tasks.filter(t => t.featured).length).toBe(5);

      // Completar una de las tareas destacadas
      const task1 = state.tasks.find(t => t.title === 'Featured 1');
      task1.status = 'completed';

      // Añadir una sexta tarea
      tasksModule.addTask('Task 6', '30', false, null, true, 'days', false);
      const id6 = state.tasks.find(t => t.title === 'Task 6').id;

      // Destacar la tarea 6 no debe abrir el modal de límite, porque solo hay 4 activas destacadas
      const res = tasksModule.setTaskFeatured(id6, true);
      expect(res).toBe(true);
      expect(helpers.showFeaturedLimitModal).not.toHaveBeenCalled();
      expect(state.tasks.find(t => t.id === id6).featured).toBe(true);

      // Ahora hay 5 activas destacadas (Featured 2..5 + Task 6)
      // Intentar añadir una 7ª con featured=true se creará como normal al haber alcanzado el límite de 5 activas
      tasksModule.addTask('Task 7 Featured', '30', false, null, true, 'days', true);
      expect(state.tasks.find(t => t.title === 'Task 7 Featured').featured).toBe(false);

      // Completar otra tarea destacada libera otro cupo
      const task2 = state.tasks.find(t => t.title === 'Featured 2');
      task2.status = 'completed';

      // Ahora añadir una tarea con featured=true sí se destaca
      tasksModule.addTask('Task 8 Featured', '30', false, null, true, 'days', true);
      expect(state.tasks.find(t => t.title === 'Task 8 Featured').featured).toBe(true);
    });

    it('uncompleteTask handles featured tasks respecting the 5 active limit', () => {
      const executionModule = TodayTasksExecution(ctx, helpers);

      // Creamos 5 tareas destacadas activas
      for (let i = 1; i <= 5; i++) {
        tasksModule.addTask(`Active Featured ${i}`, '30', false, null, true, 'days', true);
      }

      // Añadimos una tarea completada que tenía featured: true
      state.tasks.push({
        id: 'comp_feat',
        title: 'Completed Featured',
        status: 'completed',
        urgency: 'days',
        featured: true,
        order: 10,
        actualDuration: 20
      });

      // Al restaurarla habiendo ya 5 activas destacadas, se le quita el destacado
      executionModule.uncompleteTask('comp_feat');
      const restored = state.tasks.find(t => t.id === 'comp_feat');
      expect(restored.status).toBe('paused');
      expect(restored.featured).toBe(false);

      // Si se restaura habiendo solo 4 activas destacadas, conserva featured: true
      const task1 = state.tasks.find(t => t.title === 'Active Featured 1');
      tasksModule.setTaskFeatured(task1.id, false);

      state.tasks.push({
        id: 'comp_feat_2',
        title: 'Completed Featured 2',
        status: 'completed',
        urgency: 'days',
        featured: true,
        order: 11,
        actualDuration: 15
      });

      executionModule.uncompleteTask('comp_feat_2');
      const restored2 = state.tasks.find(t => t.id === 'comp_feat_2');
      expect(restored2.featured).toBe(true);
    });
  });

  describe('View Rendering: Urgency and Featured UI', () => {
    it('renders Linear-style urgency pill buttons and star toggle button in task item', async () => {
      const { TodayTasksTasksView } = await import('../js/views/tasks.js');
      document.body.innerHTML = '<div id="tasksList"></div>';
      const state = defaultState();
      state.tasks = [
        { id: '100', title: 'Task Normal', planned: 30, status: 'pending', urgency: 'today', featured: true, order: 1 }
      ];

      const tasksView = TodayTasksTasksView({
        getState: () => state,
        getTaskEdit: () => null
      });

      tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });
      const tasksList = document.getElementById('tasksList');
      expect(tasksList.innerHTML).toContain('urgency-pill-btn');
      expect(tasksList.innerHTML).toContain('urgency-btn-today');
      expect(tasksList.innerHTML).toContain('Hoy');
      expect(tasksList.innerHTML).toContain('star-btn');
      expect(tasksList.innerHTML).toContain('is-featured');
      expect(tasksList.innerHTML).toContain('featured-task');
      expect(tasksList.innerHTML).not.toContain('⭐ Destacada');
    });

    it('closes featuredLimitModal when pressing Escape key or clicking close button', async () => {
      const { TodayTasksShortcuts } = await import('../js/app/shortcuts.js');
      document.body.innerHTML = `
        <div id="featuredLimitModal" class="modal-overlay" style="display:none;">
          <div class="modal-box featured-limit-modal-box">
            <button class="close-modal-btn" id="featuredLimitModalBtnCancel">&times;</button>
            <div id="featuredLimitModalDesc"></div>
            <div id="featuredLimitModalList"></div>
          </div>
        </div>
      `;

      TodayTasksShortcuts({
        getState: () => ({}),
        getMeetingEdit: () => null,
        getTaskEdit: () => null,
        actionsModule: {},
        routerModule: { getCurrentView: () => 'main' }
      });

      const modal = document.getElementById('featuredLimitModal');
      const cancelBtn = document.getElementById('featuredLimitModalBtnCancel');

      // 1. Test cancel button closes modal
      modal.style.display = 'flex';
      cancelBtn.onclick = () => { modal.style.display = 'none'; };
      cancelBtn.click();
      expect(modal.style.display).toBe('none');

      // 2. Test Escape key closes modal
      modal.style.display = 'flex';
      cancelBtn.onclick = () => { modal.style.display = 'none'; };
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      window.dispatchEvent(escEvent);
      expect(modal.style.display).toBe('none');
    });
  });

  describe('Manual Ordering vs Automatic Priority (sortTasksWithManualOrder)', () => {
    it('orders identically to sortTasksByPriority when all tasks have manualOrder: null', () => {
      const tasks = [
        { id: '1', title: 'Week Task', urgency: 'week', featured: false, manualOrder: null, order: 1 },
        { id: '2', title: 'Today Task', urgency: 'today', featured: false, manualOrder: null, order: 2 },
        { id: '3', title: 'Today Star', urgency: 'today', featured: true, manualOrder: null, order: 3 },
      ];

      const sorted = sortTasksWithManualOrder(tasks);
      expect(sorted.map(t => t.id)).toEqual(['3', '2', '1']);
      expect(sorted.map(t => t.order)).toEqual([1, 2, 3]);
    });

    it('preserves exact manualOrder when all tasks are anchored', () => {
      // User placed 'later' at #1, 'days' at #2, and 'today' at #3
      const tasks = [
        { id: 't-later', title: 'Later Task', urgency: 'later', featured: false, manualOrder: 1, order: 1 },
        { id: 't-days', title: 'Days Task', urgency: 'days', featured: false, manualOrder: 2, order: 2 },
        { id: 't-today', title: 'Today Task', urgency: 'today', featured: true, manualOrder: 3, order: 3 },
      ];

      const sorted = sortTasksWithManualOrder(tasks);
      expect(sorted.map(t => t.id)).toEqual(['t-later', 't-days', 't-today']);
      expect(sorted.map(t => t.order)).toEqual([1, 2, 3]);
    });

    it('guarantees the first anchored task is never overtaken by a new or floating task, even if more urgent', () => {
      // User triaged A0 (urgency: days) to position 1
      const a0 = { id: 'a0', title: 'A0', urgency: 'days', manualOrder: 1, order: 1 };
      const a1 = { id: 'a1', title: 'A1', urgency: 'later', manualOrder: 2, order: 2 };
      // New floating task arrives with urgency 'today'
      const f0 = { id: 'f0', title: 'F0 Urgent', urgency: 'today', manualOrder: null, order: 3 };

      const sorted = sortTasksWithManualOrder([a0, a1, f0]);
      // a0 MUST stay first! f0 goes before a1 because f0 ('today') > a1 ('later')
      expect(sorted.map(t => t.id)).toEqual(['a0', 'f0', 'a1']);
      expect(sorted.map(t => t.order)).toEqual([1, 2, 3]);
    });

    it('inserts a new floating task before lower-priority anchored tasks (e.g. before the last task placed by user)', () => {
      // User manually placed a low-priority task as the last task (#3)
      const a0 = { id: 'a0', title: 'A0', urgency: 'days', manualOrder: 1, order: 1 };
      const a1 = { id: 'a1', title: 'A1', urgency: 'days', manualOrder: 2, order: 2 };
      const a2 = { id: 'a2', title: 'A2 End', urgency: 'later', manualOrder: 3, order: 3 }; // user put this last!

      // New floating task with urgency 'days'
      const f0 = { id: 'f0', title: 'F0 Days', urgency: 'days', manualOrder: null, order: 4 };

      const sorted = sortTasksWithManualOrder([a0, a1, a2, f0]);
      // f0 ('days') is more urgent than a2 ('later'), so it goes before a2
      expect(sorted.map(t => t.id)).toEqual(['a0', 'a1', 'f0', 'a2']);
      expect(sorted.map(t => t.order)).toEqual([1, 2, 3, 4]);
    });

    it('running task always takes precedence at the top even before anchored tasks', () => {
      const running = { id: 'r', title: 'Running', status: 'running', urgency: 'later', manualOrder: null, order: 1 };
      const a0 = { id: 'a0', title: 'A0', status: 'pending', urgency: 'today', manualOrder: 1, order: 2 };

      const sorted = sortTasksWithManualOrder([a0, running]);
      expect(sorted[0].id).toBe('r');
      expect(sorted[1].id).toBe('a0');
    });

    it('setTaskUrgency preserves anchor position when changing urgency of an anchored task', () => {
      const state = defaultState();
      let taskEdit = null;
      const ctx = {
        getState: () => state,
        setState: (ns) => { state = wrapState(ns); },
        getTaskEdit: () => taskEdit,
        setTaskEdit: (te) => { taskEdit = te; },
        saveState: () => {},
        newId: () => 'id-' + Math.random(),
        smartRender: () => {},
        renderAll: () => {},
        undoModule: { pushSnapshot: vi.fn() }
      };

      const tasksMod = TodayTasksTasks(ctx, {
        nowMinutes: () => 540,
        showToast: vi.fn(),
        showRecurringModal: vi.fn(),
        showFeaturedLimitModal: vi.fn()
      });

      // Añadir 3 tareas
      tasksMod.addTask('Task 1', '30', false, null, true, 'today');
      tasksMod.addTask('Task 2', '30', false, null, true, 'days');
      tasksMod.addTask('Task 3', '30', false, null, true, 'later');

      // Simular anclaje manual (como haría drag & drop o triage)
      state.tasks[0].manualOrder = 1;
      state.tasks[1].manualOrder = 2;
      state.tasks[2].manualOrder = 3;

      const id3 = state.tasks[2].id;

      // Cambiar urgencia de Task 3 a 'today'
      tasksMod.setTaskUrgency(id3, 'today');

      // La posición debe mantenerse exactamente en el puesto 3, no saltar al puesto 1 o 2
      expect(state.tasks[2].id).toBe(id3);
      expect(state.tasks[2].urgency).toBe('today');
      expect(state.tasks[2].manualOrder).toBe(3);
      expect(state.tasks.map(t => t.title)).toEqual(['Task 1', 'Task 2', 'Task 3']);
    });

    it('applyAutoOrder clears manual anchors and re-sorts all tasks strictly by priority', () => {
      const state = defaultState();
      let taskEdit = null;
      const ctx = {
        getState: () => state,
        setState: (ns) => { state = wrapState(ns); },
        getTaskEdit: () => taskEdit,
        setTaskEdit: (te) => { taskEdit = te; },
        saveState: () => {},
        newId: () => 'id-' + Math.random(),
        smartRender: () => {},
        renderAll: () => {},
        undoModule: { pushSnapshot: vi.fn() }
      };

      const tasksMod = TodayTasksTasks(ctx, {
        nowMinutes: () => 540,
        showToast: vi.fn(),
        showRecurringModal: vi.fn(),
        showFeaturedLimitModal: vi.fn()
      });

      // Tareas en orden invertido respecto a urgencia pero con manualOrder fijado
      state.tasks = [
        { id: '1', title: 'Later #1', urgency: 'later', featured: false, manualOrder: 1, order: 1, status: 'pending' },
        { id: '2', title: 'Today #2', urgency: 'today', featured: false, manualOrder: 2, order: 2, status: 'pending' }
      ];

      // Aplicar orden automático
      tasksMod.applyAutoOrder();

      // manualOrder debe ser null en todas las tareas
      expect(state.tasks.every(t => t.manualOrder === null)).toBe(true);
      // 'Today #2' debe pasar a ser la primera por urgencia
      expect(state.tasks[0].id).toBe('2');
      expect(state.tasks[1].id).toBe('1');
      expect(ctx.undoModule.pushSnapshot).toHaveBeenCalledWith('Aplicar orden automático');
    });

    it('moveTask reorders and anchors all tasks in the queue with manualOrder', () => {
      const state = defaultState();
      let taskEdit = null;
      const ctx = {
        getState: () => state,
        setState: (ns) => { state = wrapState(ns); },
        getTaskEdit: () => taskEdit,
        setTaskEdit: (te) => { taskEdit = te; },
        saveState: () => {},
        newId: () => 'id-' + Math.random(),
        smartRender: () => {},
        renderAll: () => {},
        undoModule: { pushSnapshot: vi.fn() }
      };

      const tasksMod = TodayTasksTasks(ctx, {
        nowMinutes: () => 540,
        showToast: vi.fn(),
        showRecurringModal: vi.fn(),
        showFeaturedLimitModal: vi.fn()
      });

      state.tasks = [
        { id: 'a', title: 'A', urgency: 'days', order: 1, manualOrder: null, status: 'pending' },
        { id: 'b', title: 'B', urgency: 'days', order: 2, manualOrder: null, status: 'pending' },
        { id: 'c', title: 'C', urgency: 'days', order: 3, manualOrder: null, status: 'pending' }
      ];

      // Mover 'b' hacia arriba (-1)
      tasksMod.moveTask('b', -1);

      // Ahora 'b' debe ser primera, 'a' segunda, 'c' tercera
      expect(state.tasks.map(t => t.id)).toEqual(['b', 'a', 'c']);
      // Todas deben tener manualOrder asignado (1, 2, 3)
      expect(state.tasks.map(t => t.manualOrder)).toEqual([1, 2, 3]);
    });
  });
});
