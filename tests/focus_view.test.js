import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { computeSchedule } from '../js/scheduler.js';
import { TodayTasksViews } from '../js/views.js';

describe('Focus View - Render and Navigation', () => {
  let state;
  let views;
  let currentTaskId = null;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-main"></div>
      <div id="view-task" style="display:none"></div>
      <div id="view-interruption" style="display:none"></div>
      <div id="view-history" style="display:none"></div>
      <div id="clockDisplay"></div>
      <div id="headerStats"></div>
      <div id="taskProgressContainer"></div>
      <div id="meetingsList"></div>
      <div id="tasksList"></div>
      <div id="boardTitle"></div>
      <div id="boardNow"></div>
      <div id="boardContent"></div>
      <div id="meetingsSummaryList"></div>
      <div id="completedList"></div>
      <div id="pendingList"></div>
      <div id="planningModeBtn"></div>
      <div id="envBtnWork"></div>
      <div id="envBtnPersonal"></div>
    `;

    state = defaultState();
    state.tasks = [
      { id: 42, title: 'Tarea para Foco', planned: 45, status: 'running', runningStart: 600, order: 1, elapsedBefore: 10 }
    ];
    currentTaskId = 42;

    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'task',
      getFocusTaskId: () => currentTaskId,
      computeSchedule: () => computeSchedule(state, () => 610),
      fmtMMSS: () => '00:00',
      RING_R: 85,
      RING_C: 534.07
    };

    views = TodayTasksViews(ctx);
  });

  it('renderTaskFocusView debe renderizar el contenido de la vista de foco en #view-task', () => {
    const taskContainer = document.getElementById('view-task');
    expect(taskContainer).not.toBeNull();
    expect(taskContainer.innerHTML).toBe('');

    views.renderTaskFocusView();

    expect(taskContainer.innerHTML).toContain('focus-view');
    expect(taskContainer.innerHTML).toContain('Tarea para Foco');
    expect(taskContainer.innerHTML).toContain('Volver al tablero');
    expect(taskContainer.innerHTML).toContain('focus-ring-wrap');
    expect(taskContainer.innerHTML).toContain('⏸ Pausar');
    expect(taskContainer.innerHTML).toContain('✓ Completar');
  });


  it('renderTaskFocusView debe renderizar correctamente una tarea en estado paused', () => {
    state.tasks[0].status = 'paused';
    const taskContainer = document.getElementById('view-task');

    views.renderTaskFocusView();

    expect(taskContainer.innerHTML).toContain('▶ Reanudar');
    expect(taskContainer.innerHTML).toContain('✓ Completar');
  });

  it('renderTaskFocusView debe renderizar correctamente una tarea en estado pending', () => {
    state.tasks[0].status = 'pending';
    const taskContainer = document.getElementById('view-task');

    views.renderTaskFocusView();

    expect(taskContainer.innerHTML).toContain('▶ Iniciar');
    expect(taskContainer.innerHTML).toContain('✓ Completar');
  });

  it('renderTaskFocusView debe renderizar correctamente una tarea en estado completed con opción de reabrir', () => {
    state.tasks[0].status = 'completed';
    state.tasks[0].actualDuration = 20;
    const taskContainer = document.getElementById('view-task');

    views.renderTaskFocusView();

    expect(taskContainer.innerHTML).toContain('Completada');
    expect(taskContainer.innerHTML).toContain('app.uncompleteTask');
    expect(taskContainer.innerHTML).toContain('Volver al tablero');
    expect(taskContainer.innerHTML).not.toContain('▶ Iniciar');
  });

  it('renderTaskFocusView debe entrecomillar los IDs de tarea en los botones onclick', () => {
    state.tasks[0].id = 'rec_task_294';
    currentTaskId = 'rec_task_294';
    state.tasks[0].status = 'running';
    const taskContainer = document.getElementById('view-task');

    views.renderTaskFocusView();

    expect(taskContainer.innerHTML).toContain("app.pauseTask('rec_task_294')");
    expect(taskContainer.innerHTML).toContain("app.completeTask('rec_task_294')");
  });
});


