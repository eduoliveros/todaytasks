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
      nowMinutes: () => 610,
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

  it('renderTaskFocusView debe mostrar la marca de corte en el arco SVG y badge de advertencia cuando una reunión corta la tarea', () => {
    // Tarea: planificada 45 min, transcurridos 10 min, quedan 35 min.
    // Reunión a las 625 (en 15 min desde now=610). 15 min < 35 min restantes -> Interrumpe la tarea.
    state.meetings = [
      { id: 101, title: 'Daily Standup', start: 625, end: 640 }
    ];
    const taskContainer = document.getElementById('view-task');

    views.renderTaskFocusView();

    // Debe contener el notch o dot en el SVG
    expect(taskContainer.innerHTML).toContain('ring-meeting-notch');
    expect(taskContainer.innerHTML).toContain('ring-meeting-dot');

    // Debe contener el badge central con aviso de tiempo restante hasta la reunión
    expect(taskContainer.innerHTML).toContain('focus-meeting-badge');
    expect(taskContainer.innerHTML).toContain('Daily Standup');
    expect(taskContainer.innerHTML).toContain('15 min');

    // Debe contener el bloque de reunión en la sección de metadatos
    expect(taskContainer.innerHTML).toContain('Siguiente reunión');
    expect(taskContainer.innerHTML).toContain('10:25');
  });

  it('renderTaskFocusView no debe mostrar marca de corte en el arco si la reunión empieza después de que termine la tarea', () => {
    // Tarea: quedan 35 min (fin previsto = 645 a las 10:45).
    // Reunión a las 700 (11:40, en 90 min). 90 min > 35 min restantes -> No interrumpe.
    state.meetings = [
      { id: 102, title: 'Sprint Review', start: 700, end: 760 }
    ];
    const taskContainer = document.getElementById('view-task');

    views.renderTaskFocusView();

    // No debe dibujar marca de corte en el arco de la tarea
    expect(taskContainer.innerHTML).not.toContain('ring-meeting-notch');

    // Pero sí debe informar de la siguiente reunión en metadatos
    expect(taskContainer.innerHTML).toContain('Siguiente reunión');
    expect(taskContainer.innerHTML).toContain('Sprint Review');
    expect(taskContainer.innerHTML).toContain('11:40');
  });

  it('renderTaskFocusView debe mostrar indicador de reunión en curso cuando coincide la hora actual', () => {
    // Reunión en curso: start=600, end=630, now=610
    state.meetings = [
      { id: 103, title: 'Reunión con Cliente', start: 600, end: 630 }
    ];
    const taskContainer = document.getElementById('view-task');

    views.renderTaskFocusView();

    expect(taskContainer.innerHTML).toContain('focus-meeting-badge');
    expect(taskContainer.innerHTML).toContain('Reunión en curso');
    expect(taskContainer.innerHTML).toContain('Reunión con Cliente');
  });
});



