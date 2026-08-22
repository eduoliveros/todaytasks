import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';

describe('Tasks View - Main Page Active Tasks List', () => {
  let state;
  let taskEdit = null;
  let tasksView;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tasksList"></div>
    `;

    state = defaultState();
    taskEdit = null;

    const ctx = {
      getState: () => state,
      getTaskEdit: () => taskEdit
    };

    tasksView = TodayTasksTasksView(ctx);
  });

  it('renderTasks debe renderizar el tiempo consumido como editable con task-duration-clickable y openTimePopover', () => {
    state.tasks = [
      { id: 101, title: 'Tarea Principal', planned: 45, status: 'pending', elapsedBefore: 15, order: 1 }
    ];

    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const tasksList = document.getElementById('tasksList');
    expect(tasksList).not.toBeNull();

    const clickableTime = tasksList.querySelector('.task-duration-clickable');
    expect(clickableTime).not.toBeNull();
    expect(clickableTime.getAttribute('onclick')).toContain("app.openTimePopover('101'");
    expect(clickableTime.textContent).toContain('15 min');
    expect(clickableTime.getAttribute('title')).toBe('Clic para ajustar tiempo consumido');
  });

  it('renderTasks debe permitir editar tiempo consumido también en tareas en ejecución y en pausa', () => {
    state.tasks = [
      { id: 102, title: 'Tarea en Pausa', planned: 30, status: 'paused', elapsedBefore: 10, order: 1 },
      { id: 103, title: 'Tarea Corriendo', planned: 60, status: 'running', runningStart: 500, elapsedBefore: 5, order: 2 }
    ];

    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const tasksList = document.getElementById('tasksList');
    const clickableElements = tasksList.querySelectorAll('.task-duration-clickable');
    expect(clickableElements.length).toBe(2);

    expect(clickableElements[0].getAttribute('onclick')).toContain("app.openTimePopover('103'");
    expect(clickableElements[1].getAttribute('onclick')).toContain("app.openTimePopover('102'");
  });
});
