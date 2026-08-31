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

  it('renderTasks renderiza el chip interactivo start-after-pill-btn con la notación HH:MM+ si tiene startAfter', () => {
    state.tasks = [
      { id: 501, title: 'Tarea Tarde', planned: 30, status: 'pending', startAfter: 960, order: 1 } // 16:00
    ];

    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const pill = document.querySelector('.start-after-pill-btn');
    expect(pill).not.toBeNull();
    expect(pill.textContent).toContain('16:00+');
    expect(pill.getAttribute('onclick')).toContain("app.openStartAfterPopover('501'");
  });

  it('renderTasks renderiza el input A partir de en modo de edición', () => {
    state.tasks = [
      { id: 502, title: 'Tarea Editable', planned: 45, status: 'pending', startAfter: 930, order: 1 }
    ];

    taskEdit = { id: 502, title: 'Tarea Editable', duration: '45', actual: '0', startAfter: '15:30' };
    tasksView.renderTasks({ segmentsByTask: {}, overflowIds: new Set() });

    const inputTime = document.querySelector('.task-item.editing input[type="time"]');
    expect(inputTime).not.toBeNull();
    expect(inputTime.value).toBe('15:30');
    expect(inputTime.getAttribute('oninput')).toContain("app.updateTaskEditField('startAfter'");
  });

  it('renderTasks aplica la clase task-overflow y la insignia ⚠ Fuera de jornada a tareas fuera del horario laboral', () => {
    state.tasks = [
      { id: 601, title: 'Tarea Que Cabe', planned: 30, status: 'pending', order: 1 },
      { id: 602, title: 'Tarea Desbordada', planned: 60, status: 'pending', order: 2 }
    ];

    const overflowIds = new Set([602]);
    tasksView.renderTasks({ segmentsByTask: { 601: [{ start: 540, end: 570 }], 602: [{ start: 1050, end: 1110 }] }, overflowIds });

    const item1 = document.getElementById('task-item-601');
    const item2 = document.getElementById('task-item-602');

    expect(item1).not.toBeNull();
    expect(item2).not.toBeNull();

    expect(item1.classList.contains('task-overflow')).toBe(false);
    expect(item1.querySelector('.overflow-badge')).toBeNull();

    expect(item2.classList.contains('task-overflow')).toBe(true);
    const badge = item2.querySelector('.overflow-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Fuera de jornada');
  });

  it('renderTasks mantiene la clase task-overflow en modo de edición si la tarea está desbordada', () => {
    state.tasks = [
      { id: 603, title: 'Tarea Desbordada Editando', planned: 60, status: 'pending', order: 1 }
    ];

    taskEdit = { id: 603, title: 'Tarea Desbordada Editando', duration: '60', actual: '0' };
    const overflowIds = new Set([603]);
    tasksView.renderTasks({ segmentsByTask: { 603: [{ start: 1050, end: 1110 }] }, overflowIds });

    const item = document.getElementById('task-item-603');
    expect(item).not.toBeNull();
    expect(item.classList.contains('editing')).toBe(true);
    expect(item.classList.contains('task-overflow')).toBe(true);
  });
});


