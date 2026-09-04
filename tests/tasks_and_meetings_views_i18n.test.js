import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksMeetingsView } from '../js/views/meetings.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';
import { setLocale } from '../js/i18n.js';

describe('Tasks and Meetings Views - Internacionalización (i18n)', () => {
  let state;
  let meetingsView;
  let tasksView;
  let taskEdit = null;
  let meetingEdit = null;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="meetingsList"></div>
      <div id="tasksList"></div>
    `;
    setLocale('es');
    state = defaultState();
    taskEdit = null;
    meetingEdit = null;

    meetingsView = TodayTasksMeetingsView({
      getState: () => state,
      getMeetingEdit: () => meetingEdit,
      nowMinutes: () => 600,
      getTodayStr: () => '2026-09-04'
    });

    tasksView = TodayTasksTasksView({
      getState: () => state,
      getTaskEdit: () => taskEdit
    });
  });

  it('renderMeetings renderiza estado vacío y botones en español e inglés', () => {
    state.meetings = [];
    meetingsView.renderMeetings();
    const meetingsList = document.getElementById('meetingsList');
    expect(meetingsList.textContent).toContain('Aún no hay reuniones.');

    setLocale('en');
    meetingsView.renderMeetings();
    expect(meetingsList.textContent).toContain('No meetings yet.');

    state.meetings = [
      { id: 'm1', title: 'Sprint Review', start: 600, end: 660 }
    ];
    meetingsView.renderMeetings();
    expect(meetingsList.textContent).toContain('Start');
    expect(meetingsList.textContent).toContain('End');
    expect(meetingsList.textContent).toContain('buffer until');

    setLocale('es');
    meetingsView.renderMeetings();
    expect(meetingsList.textContent).toContain('Inicio');
    expect(meetingsList.textContent).toContain('Fin');
    expect(meetingsList.textContent).toContain('colchón hasta');
  });

  it('renderMeetings renderiza formulario inline de edición traducido bilingüe', () => {
    state.meetings = [
      { id: 'm1', title: 'Sprint Review', start: 600, end: 660 }
    ];
    meetingEdit = { id: 'm1', title: 'Sprint Review', start: '10:00', end: '11:00', mode: 'series' };

    meetingsView.renderMeetings();
    const meetingsList = document.getElementById('meetingsList');
    expect(meetingsList.textContent).toContain('Editando reunión (Toda la serie)');
    expect(meetingsList.textContent).toContain('Guardar');
    expect(meetingsList.textContent).toContain('Cancelar');

    setLocale('en');
    meetingsView.renderMeetings();
    expect(meetingsList.textContent).toContain('Editing meeting (Entire series)');
    expect(meetingsList.textContent).toContain('Save');
    expect(meetingsList.textContent).toContain('Cancel');
    setLocale('es');
  });

  it('renderTasks renderiza acciones y badges de tareas en español e inglés', () => {
    state.tasks = [
      { id: 't1', title: 'Build feature', planned: 30, status: 'pending', elapsedBefore: 0, order: 1 }
    ];

    tasksView.renderTasks({ segmentsByTask: { t1: [{ start: 600, end: 630 }] } });
    const tasksList = document.getElementById('tasksList');
    expect(tasksList.textContent).toContain('Inicio prev.');
    expect(tasksList.textContent).toContain('Fin prev.');
    expect(tasksList.textContent).toContain('▶ Iniciar');
    expect(tasksList.textContent).toContain('✓ Completar');

    setLocale('en');
    tasksView.renderTasks({ segmentsByTask: { t1: [{ start: 600, end: 630 }] } });
    expect(tasksList.textContent).toContain('Est. start');
    expect(tasksList.textContent).toContain('Est. end');
    expect(tasksList.textContent).toContain('▶ Start');
    expect(tasksList.textContent).toContain('✓ Complete');
    setLocale('es');
  });

  it('renderTasks renderiza formulario inline de edición de tarea traducido bilingüe', () => {
    state.tasks = [
      { id: 't1', title: 'Build feature', planned: 30, status: 'pending', elapsedBefore: 0, order: 1 }
    ];
    taskEdit = { id: 't1', title: 'Build feature', duration: '30', actual: '0', urgency: 'days' };

    tasksView.renderTasks({ segmentsByTask: {} });
    const tasksList = document.getElementById('tasksList');
    expect(tasksList.textContent).toContain('Planificado:');
    expect(tasksList.textContent).toContain('Consumido:');
    expect(tasksList.textContent).toContain('Guardar');
    expect(tasksList.textContent).toContain('Cancelar');

    setLocale('en');
    tasksView.renderTasks({ segmentsByTask: {} });
    expect(tasksList.textContent).toContain('Planned:');
    expect(tasksList.textContent).toContain('Spent:');
    expect(tasksList.textContent).toContain('Save');
    expect(tasksList.textContent).toContain('Cancel');
    setLocale('es');
  });
});
