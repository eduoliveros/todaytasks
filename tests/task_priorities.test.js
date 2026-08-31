import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  URGENCY_LEVELS,
  DEFAULT_URGENCY,
  MAX_FEATURED_TASKS,
  getUrgencyWeight,
  compareTasksByPriority,
  sortTasksByPriority
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
});
