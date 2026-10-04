import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';
import { TodayTasksActions } from '../js/actions.js';

describe('Tasks Presentation - First Task Highlight & Sort Modes', () => {
  let state;
  let taskEdit = null;
  let tasksView;
  let actions;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="taskListSortBar">
        <button type="button" class="task-sort-btn active" id="taskSortPriorityBtn">Prioridad</button>
        <button type="button" class="task-sort-btn" id="taskSortChronoBtn">Cronológico</button>
      </div>
      <div id="tasksList"></div>
    `;

    state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080;  // 18:00
    taskEdit = null;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      saveState: () => {},
      getTaskEdit: () => taskEdit,
      setTaskEdit: (t) => { taskEdit = t; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      newId: () => 1,
      smartRender: () => {},
      renderAll: () => {}
    };

    tasksView = TodayTasksTasksView(ctx);
    actions = TodayTasksActions(ctx);
  });

  it('resalta con marco verde (clase is-first-task) únicamente a la primera tarea programada cronológicamente', () => {
    state.tasks = [
      { id: 'task-1', title: 'Tarea tarde', planned: 60, status: 'pending', startAfter: 960, order: 1 }, // 16:00
      { id: 'task-2', title: 'Tarea mediodía', planned: 45, status: 'pending', startAfter: 690, order: 2 }, // 11:30
      { id: 'task-3', title: 'Tarea primera de la mañana', planned: 30, status: 'pending', startAfter: null, order: 3 } // 09:00
    ];

    const schedule = {
      segmentsByTask: {
        'task-1': [{ start: 960, end: 1020 }],
        'task-2': [{ start: 690, end: 735 }],
        'task-3': [{ start: 540, end: 570 }]
      },
      overflowIds: new Set()
    };

    tasksView.renderTasks(schedule);

    const card1 = document.getElementById('task-item-task-1');
    const card2 = document.getElementById('task-item-task-2');
    const card3 = document.getElementById('task-item-task-3');

    // La tarea 3 (09:00) debe tener la clase is-first-task
    expect(card3.classList.contains('is-first-task')).toBe(true);
    // Las demás no deben tener is-first-task
    expect(card1.classList.contains('is-first-task')).toBe(false);
    expect(card2.classList.contains('is-first-task')).toBe(false);

    // No debe añadir ningún texto redundante de badge "1ª A EJECUTAR"
    expect(card3.textContent).not.toContain('1ª A EJECUTAR');
  });

  it('asigna la clase is-deferred a tareas con startAfter posterior al umbral de inicio sin añadir texto innecesario', () => {
    state.planningMode = true; // threshold = state.workStart (540 = 09:00)
    state.tasks = [
      { id: 'task-late', title: 'Tarea de tarde', planned: 60, status: 'pending', startAfter: 960, order: 1 }, // 16:00 > 09:00 -> diferida
      { id: 'task-early', title: 'Tarea matutina', planned: 30, status: 'pending', startAfter: null, order: 2 } // no diferida
    ];

    const schedule = {
      segmentsByTask: {
        'task-late': [{ start: 960, end: 1020 }],
        'task-early': [{ start: 540, end: 570 }]
      },
      overflowIds: new Set()
    };

    tasksView.renderTasks(schedule);

    const cardLate = document.getElementById('task-item-task-late');
    const cardEarly = document.getElementById('task-item-task-early');

    expect(cardLate.classList.contains('is-deferred')).toBe(true);
    expect(cardEarly.classList.contains('is-deferred')).toBe(false);

    // No debe contener texto "En espera hasta las..." porque ya tiene el pill de hora
    expect(cardLate.textContent).not.toContain('En espera hasta las');
  });

  it('en modo prioridad ordena las tareas por task.order', () => {
    state.taskSortMode = 'priority';
    state.tasks = [
      { id: 't1', title: 'T1 Orden 1', planned: 30, status: 'pending', order: 1 },
      { id: 't2', title: 'T2 Orden 2', planned: 30, status: 'pending', order: 2 },
      { id: 't3', title: 'T3 Orden 3', planned: 30, status: 'pending', order: 3 }
    ];

    const schedule = {
      segmentsByTask: {
        't1': [{ start: 960, end: 990 }],
        't2': [{ start: 690, end: 720 }],
        't3': [{ start: 540, end: 570 }]
      },
      overflowIds: new Set()
    };

    tasksView.renderTasks(schedule);

    const renderedCards = document.querySelectorAll('#tasksList .task-item');
    expect(renderedCards[0].id).toBe('task-item-t1');
    expect(renderedCards[1].id).toBe('task-item-t2');
    expect(renderedCards[2].id).toBe('task-item-t3');

    // En modo prioridad, existen controles de reordenación (▲ / ▼)
    expect(renderedCards[0].querySelector('.order-controls')).not.toBeNull();
  });

  it('en modo cronológico ordena las tareas según la hora de inicio calculada', () => {
    state.taskSortMode = 'chronological';
    state.tasks = [
      { id: 't1', title: 'T1 Orden 1 pero a las 16:00', planned: 30, status: 'pending', startAfter: 960, order: 1 },
      { id: 't2', title: 'T2 Orden 2 pero a las 11:30', planned: 30, status: 'pending', startAfter: 690, order: 2 },
      { id: 't3', title: 'T3 Orden 3 pero a las 09:00', planned: 30, status: 'pending', startAfter: null, order: 3 }
    ];

    const schedule = {
      segmentsByTask: {
        't1': [{ start: 960, end: 990 }],
        't2': [{ start: 690, end: 720 }],
        't3': [{ start: 540, end: 570 }]
      },
      overflowIds: new Set()
    };

    tasksView.renderTasks(schedule);

    const renderedCards = document.querySelectorAll('#tasksList .task-item');
    // En modo cronológico: t3 (09:00) debe ser la primera, t2 (11:30) segunda, t1 (16:00) tercera
    expect(renderedCards[0].id).toBe('task-item-t3');
    expect(renderedCards[1].id).toBe('task-item-t2');
    expect(renderedCards[2].id).toBe('task-item-t1');

    // En modo cronológico, los controles manuales de reordenación (▲ / ▼) se ocultan
    expect(renderedCards[0].querySelector('.order-controls')).toBeNull();
  });

  it('setTaskSortMode actualiza la propiedad en state y los botones activos en el DOM', () => {
    actions.setTaskSortMode('chronological');
    expect(state.taskSortMode).toBe('chronological');

    tasksView.renderTasks({ segmentsByTask: {} });

    const priorityBtn = document.getElementById('taskSortPriorityBtn');
    const chronoBtn = document.getElementById('taskSortChronoBtn');

    expect(priorityBtn.classList.contains('active')).toBe(false);
    expect(chronoBtn.classList.contains('active')).toBe(true);

    actions.setTaskSortMode('priority');
    expect(state.taskSortMode).toBe('priority');

    tasksView.renderTasks({ segmentsByTask: {} });
    expect(priorityBtn.classList.contains('active')).toBe(true);
    expect(chronoBtn.classList.contains('active')).toBe(false);
  });
});
