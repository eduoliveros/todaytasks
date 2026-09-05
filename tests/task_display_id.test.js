import { describe, it, expect } from 'vitest';
import { defaultState, wrapState, assignNextTaskDisplayId } from '../js/state.js';
import { TodayTasksTasks } from '../js/actions/tasks.js';
import { TodayTasksCalendar } from '../js/actions/calendar.js';
import { getTaskSearchableText, matchesTaskSearch, searchAllTasks } from '../js/utils.js';

describe('Identificadores Visibles de Tarea (W-1 / P-1)', () => {
  it('assignNextTaskDisplayId genera W-1, W-2 para trabajo y P-1, P-2 para personal', () => {
    const workEnv = { nextTaskSeq: 1 };
    expect(assignNextTaskDisplayId(workEnv, 'work')).toBe('W-1');
    expect(assignNextTaskDisplayId(workEnv, 'work')).toBe('W-2');
    expect(workEnv.nextTaskSeq).toBe(3);

    const personalEnv = { nextTaskSeq: 1 };
    expect(assignNextTaskDisplayId(personalEnv, 'personal')).toBe('P-1');
    expect(assignNextTaskDisplayId(personalEnv, 'personal')).toBe('P-2');
    expect(personalEnv.nextTaskSeq).toBe(3);
  });

  it('wrapState asigna retroactivamente displayId a tareas preexistentes sin identificador', () => {
    const raw = {
      activeEnv: 'work',
      selectedDate: '2026-09-06',
      environments: {
        work: {
          name: 'Trabajo',
          days: {
            '2026-09-06': {
              tasks: [
                { id: 'uuid-1', title: 'Tarea antigua 1', planned: 30, status: 'pending' },
                { id: 'uuid-2', title: 'Tarea antigua 2', planned: 45, status: 'pending' }
              ]
            }
          }
        },
        personal: {
          name: 'Personal',
          days: {
            '2026-09-06': {
              tasks: [
                { id: 'uuid-p1', title: 'Tarea personal antigua', planned: 20, status: 'pending' }
              ]
            }
          }
        }
      }
    };

    const state = wrapState(raw);
    const workTasks = state.environments.work.days['2026-09-06'].tasks;
    expect(workTasks[0].displayId).toBe('W-1');
    expect(workTasks[1].displayId).toBe('W-2');
    expect(state.environments.work.nextTaskSeq).toBe(3);

    const personalTasks = state.environments.personal.days['2026-09-06'].tasks;
    expect(personalTasks[0].displayId).toBe('P-1');
    expect(state.environments.personal.nextTaskSeq).toBe(2);
  });

  it('wrapState respeta displayId existentes y ajusta nextTaskSeq al siguiente número libre', () => {
    const raw = {
      activeEnv: 'work',
      selectedDate: '2026-09-06',
      environments: {
        work: {
          name: 'Trabajo',
          nextTaskSeq: 1,
          days: {
            '2026-09-06': {
              tasks: [
                { id: 'uuid-10', displayId: 'W-10', title: 'Tarea diez', planned: 30, status: 'pending' }
              ]
            }
          }
        },
        personal: { name: 'Personal', days: {} }
      }
    };

    const state = wrapState(raw);
    expect(state.environments.work.nextTaskSeq).toBe(11);
    expect(state.environments.work.days['2026-09-06'].tasks[0].displayId).toBe('W-10');
  });

  it('addTask asigna displayId consecutivo a la nueva tarea', () => {
    const state = defaultState();
    const ctx = {
      getState: () => state,
      getTaskEdit: () => null,
      setTaskEdit: () => {},
      saveState: () => {},
      newId: () => 'new-uuid-1',
      renderAll: () => {},
      smartRender: () => {}
    };
    const helpers = {
      nowMinutes: () => 600,
      showToast: () => {},
      showRecurringModal: () => {},
      showFeaturedLimitModal: () => {}
    };

    const taskActions = TodayTasksTasks(ctx, helpers);
    taskActions.addTask('Primera tarea creada', '30m');
    taskActions.addTask('Segunda tarea creada', '45m');

    expect(state.tasks.length).toBe(2);
    expect(state.tasks[0].displayId).toBe('W-1');
    expect(state.tasks[1].displayId).toBe('W-2');
  });

  it('copyTaskToDate genera un nuevo displayId para la tarea duplicada', () => {
    const state = defaultState();
    state.tasks.push({
      id: 'task-orig',
      displayId: 'W-1',
      title: 'Tarea original',
      planned: 30,
      order: 1,
      status: 'pending'
    });
    state.environments.work.nextTaskSeq = 2;

    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => null,
      setTaskEdit: () => {},
      saveState: () => {},
      newId: () => 'task-copy-uuid',
      renderAll: () => {}
    };
    const helpers = {
      nowMinutes: () => 600,
      fmt: () => '10:00',
      fmtDur: () => '30m',
      showToast: () => {}
    };

    const calendarActions = TodayTasksCalendar(ctx, helpers);
    calendarActions.copyTaskToDate('task-orig', '2026-09-07');

    const targetDayTasks = state.environments.work.days['2026-09-07'].tasks;
    expect(targetDayTasks.length).toBe(1);
    expect(targetDayTasks[0].id).toBe('task-copy-uuid');
    expect(targetDayTasks[0].displayId).toBe('W-2');
    expect(targetDayTasks[0].title).toBe('Tarea original');
  });

  it('getTaskSearchableText indexa displayId completo, en minúsculas y solo número (#1 y 1)', () => {
    const task = {
      title: 'Revisión de pull request',
      displayId: 'W-42',
      urgency: 'today'
    };
    const searchable = getTaskSearchableText(task);
    expect(searchable).toContain('W-42');
    expect(searchable).toContain('w-42');
    expect(searchable).toContain('#42');
    expect(searchable).toContain('42');
  });

  it('matchesTaskSearch encuentra tareas buscando por W-1, w-1 o #1', () => {
    const task = {
      title: 'Comprar billetes',
      displayId: 'P-1',
      urgency: 'days'
    };
    expect(matchesTaskSearch(task, 'P-1')).toBe(true);
    expect(matchesTaskSearch(task, 'p-1')).toBe(true);
    expect(matchesTaskSearch(task, '#1')).toBe(true);
    expect(matchesTaskSearch(task, '1')).toBe(true);
    expect(matchesTaskSearch(task, 'P-2')).toBe(false);
  });

  it('searchAllTasks (búsqueda global) encuentra la tarea por displayId e incluye displayId en los resultados', () => {
    const state = defaultState();
    state.environments.work.days[state.selectedDate].tasks = [
      { id: 't-1', displayId: 'W-7', title: 'Auditoría de seguridad', planned: 60, status: 'pending' }
    ];

    const results = searchAllTasks(state, 'W-7');
    expect(results.length).toBe(1);
    expect(results[0].displayId).toBe('W-7');
    expect(results[0].title).toBe('Auditoría de seguridad');

    // Búsqueda en minúsculas
    const resultsLower = searchAllTasks(state, 'w-7');
    expect(resultsLower.length).toBe(1);
    expect(resultsLower[0].id).toBe('t-1');
  });

  it('TodayTasksTasksView renderiza el badge task-id-badge y el botón copy-ref-btn en tareas activas y completadas', async () => {
    const { TodayTasksTasksView } = await import('../js/views/tasks.js');
    document.body.innerHTML = '<div id="tasksList"></div>';

    let currentQuery = '';
    const state = defaultState();
    state.tasks = [
      { id: 'task-act', displayId: 'W-1', title: 'Tarea Activa', planned: 30, status: 'pending', order: 1 },
      { id: 'task-comp', displayId: 'W-2', title: 'Tarea Hecha', planned: 45, actualDuration: 40, status: 'completed', order: 2 }
    ];

    const tasksView = TodayTasksTasksView({
      getState: () => state,
      getTaskEdit: () => null,
      getTaskSearchQuery: () => currentQuery
    });

    // 1. Renderizado normal (solo activas)
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });
    const tasksList = document.getElementById('tasksList');
    expect(tasksList).not.toBeNull();

    const activeBadge = tasksList.querySelector('.task-id-badge');
    expect(activeBadge).not.toBeNull();
    expect(activeBadge.textContent).toBe('W-1');
    expect(activeBadge.getAttribute('onclick')).toContain("app.copyTaskId('task-act'");

    const activeCopyBtn = tasksList.querySelector('.copy-ref-btn');
    expect(activeCopyBtn).not.toBeNull();
    expect(activeCopyBtn.getAttribute('onclick')).toContain("app.copyTaskReference('task-act'");

    // 2. Renderizado con búsqueda (busca y muestra también completadas)
    currentQuery = 'Tarea';
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const allBadges = tasksList.querySelectorAll('.task-id-badge');
    expect(allBadges.length).toBe(2);
    expect(allBadges[0].textContent).toBe('W-1');
    expect(allBadges[1].textContent).toBe('W-2');
    expect(allBadges[1].getAttribute('onclick')).toContain("app.copyTaskId('task-comp'");

    const allCopyBtns = tasksList.querySelectorAll('.copy-ref-btn');
    expect(allCopyBtns.length).toBe(2);
    expect(allCopyBtns[1].getAttribute('onclick')).toContain("app.copyTaskReference('task-comp'");
  });

  it('TodayTasksTriageView renderiza el badge task-id-badge y el botón triage-copy-btn en cada fila', async () => {
    const { TodayTasksTriageView } = await import('../js/views/triage.js');
    document.body.innerHTML = `
      <div id="view-triage"></div>
      <div id="triageEditModalHost"></div>
    `;

    const state = defaultState();
    state.tasks = [
      { id: 't-tri-1', displayId: 'W-5', title: 'Tarea de Triaje', planned: 20, urgency: 'today', status: 'pending' }
    ];

    const triageView = TodayTasksTriageView({
      getState: () => state,
      saveState: () => {},
      renderAll: () => {},
      smartRender: () => {},
      actionsModule: {},
      getTaskEdit: () => null,
      nowMinutes: () => 600,
      computeSchedule: () => ({ overflowIds: new Set() })
    });

    triageView.renderTriageView();
    const container = document.getElementById('view-triage');
    expect(container).not.toBeNull();

    const badge = container.querySelector('.task-id-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('W-5');
    expect(badge.getAttribute('onclick')).toContain("app.copyTaskId('t-tri-1'");

    const copyBtn = container.querySelector('.triage-copy-btn');
    expect(copyBtn).not.toBeNull();
    expect(copyBtn.getAttribute('onclick')).toContain("app.copyTaskReference('t-tri-1'");
  });
});

