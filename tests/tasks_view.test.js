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

  it('renderTasks muestra el botón ➡️ Mover en tareas auto-move y 📋 Copiar en tareas normales', () => {
    state.tasks = [
      { id: 201, title: 'Tarea Auto-mover', planned: 30, status: 'pending', autoMoveToToday: true, order: 1 },
      { id: 202, title: 'Tarea Normal', planned: 40, status: 'pending', autoMoveToToday: false, order: 2 }
    ];

    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const tasksList = document.getElementById('tasksList');
    const buttons = tasksList.querySelectorAll('.icon-btn[onclick*="openCopyTaskModal"]');
    expect(buttons.length).toBe(2);

    // Tarea 201 tiene ➡️ y título Mover a otro día
    expect(buttons[0].textContent.trim()).toBe('➡️');
    expect(buttons[0].getAttribute('title')).toBe('Mover a otro día');

    // Tarea 202 tiene 📋 y título Copiar a otro día
    expect(buttons[1].textContent.trim()).toBe('📋');
    expect(buttons[1].getAttribute('title')).toBe('Copiar a otro día');
  });

  it('renderTasks renderiza el banner de auto-mover en días futuros si hay tareas pendientes en días pasados', () => {
    document.body.innerHTML = `
      <div id="tasksAutoMoveBanner" style="display:none;"></div>
      <div id="tasksList"></div>
    `;

    state.selectedDate = '2099-01-02'; // Fecha futura
    const envKey = state.activeEnv || 'work';
    state.environments[envKey].days['2099-01-01'] = {
      meetings: [],
      interruptions: [],
      planningMode: false,
      tasks: [
        { id: 301, title: 'Pendiente pasada', planned: 25, status: 'pending', autoMoveToToday: true }
      ]
    };

    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const banner = document.getElementById('tasksAutoMoveBanner');
    expect(banner.style.display).toBe('block');
    expect(banner.textContent).toContain('1 tarea automática');
    expect(banner.querySelector('.btn-bring')).not.toBeNull();
  });

  it('renderTasks asigna id="task-item-${t.id}" a cada elemento de tarea tanto en vista normal como en edición', () => {
    state.tasks = [
      { id: 401, title: 'Tarea Normal ID', planned: 30, status: 'pending', order: 1 },
      { id: 402, title: 'Tarea Editando ID', planned: 45, status: 'pending', order: 2 }
    ];

    // Modo normal
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });
    expect(document.getElementById('task-item-401')).not.toBeNull();
    expect(document.getElementById('task-item-402')).not.toBeNull();

    // Modo edición
    taskEdit = { id: 402, title: 'Tarea Editando ID', duration: 45, actual: 0 };
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });
    const editingEl = document.getElementById('task-item-402');
    expect(editingEl).not.toBeNull();
    expect(editingEl.classList.contains('editing')).toBe(true);
  });
});

