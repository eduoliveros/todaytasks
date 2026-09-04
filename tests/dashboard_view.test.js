import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksDashboard } from '../js/views/dashboard.js';
import { setLocale } from '../js/i18n.js';

describe('TodayTasksDashboard - Internacionalización (i18n)', () => {
  let state;
  let dashboard;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="clockDisplay"></div>
      <div id="headerStats"></div>
      <div id="taskProgressContainer"></div>
    `;
    setLocale('es');
    state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080;  // 18:00
    state.meetings = [
      { id: 1, title: 'Daily', start: 600, end: 630 }
    ];
    state.tasks = [
      { id: 10, title: 'Feature', planned: 60, status: 'pending', elapsedBefore: 0 }
    ];

    dashboard = TodayTasksDashboard({
      getState: () => state,
      computeSchedule: () => null
    });
  });

  it('renderiza chips de estadísticas en español por defecto', () => {
    dashboard.renderHeaderStats();
    const statsEl = document.getElementById('headerStats');

    expect(statsEl.textContent).toContain('Reuniones');
    expect(statsEl.textContent).toContain('Tareas por hacer');
    expect(statsEl.textContent).toContain('Completado hoy');
    expect(statsEl.textContent).toContain('Tiempo no asignado');
  });

  it('renderiza chips de estadísticas en inglés cuando el locale es en', () => {
    setLocale('en');
    dashboard.renderHeaderStats();
    const statsEl = document.getElementById('headerStats');

    expect(statsEl.textContent).toContain('Meetings');
    expect(statsEl.textContent).toContain('Tasks to do');
    expect(statsEl.textContent).toContain('Completed today');
    expect(statsEl.textContent).toContain('Unassigned time');
    expect(statsEl.innerHTML).toContain('Available time in workday excluding meetings');
    setLocale('es');
  });

  it('renderiza chip de día libre traducido cuando no hay horario de jornada', () => {
    const customDashboard = TodayTasksDashboard({
      getState: () => ({
        ...state,
        workStart: null,
        workEnd: null,
        meetings: [],
        tasks: [],
        interruptions: []
      }),
      computeSchedule: () => null
    });

    customDashboard.renderHeaderStats();
    const statsEl = document.getElementById('headerStats');
    expect(statsEl.textContent).toContain('Día libre');
    expect(statsEl.innerHTML).toContain('Día libre sin horario de jornada fijo');

    setLocale('en');
    customDashboard.renderHeaderStats();
    expect(statsEl.textContent).toContain('Day off');
    expect(statsEl.innerHTML).toContain('Day off without fixed workday schedule');
    setLocale('es');
  });

  it('renderiza tooltip de desviación del día traducido bilingüe', () => {
    state.tasks = [
      { id: 1, title: 'T1', planned: 30, status: 'completed', actualDuration: 45 }
    ];

    dashboard.renderHeaderStats();
    let statsEl = document.getElementById('headerStats');
    expect(statsEl.innerHTML).toContain('Desviación del día: 45 min reales vs 30 min planificados (1 tarea evaluada)');

    setLocale('en');
    dashboard.renderHeaderStats();
    statsEl = document.getElementById('headerStats');
    expect(statsEl.innerHTML).toContain('Day deviation: 45 min actual vs 30 min planned (1 evaluated task)');
    setLocale('es');
  });

  it('renderiza barra de progreso en español e inglés', () => {
    dashboard.renderTaskProgressBar();
    const container = document.getElementById('taskProgressContainer');
    expect(container.textContent).toContain('Progreso de tareas');
    expect(container.textContent).toContain('sin iniciar');

    setLocale('en');
    dashboard.renderTaskProgressBar();
    expect(container.textContent).toContain('Task progress');
    expect(container.textContent).toContain('not started');
    setLocale('es');
  });

  it('actualiza automáticamente selectedDayLabel al cambiar de idioma con translateDOM y renderAll', async () => {
    const { TodayTasksViews } = await import('../js/views.js');
    const { translateDOM } = await import('../js/i18n.js');

    document.body.innerHTML = `
      <div id="clockDisplay"></div>
      <div id="headerStats"></div>
      <div id="taskProgressContainer"></div>
      <span id="selectedDayLabel" class="day-abbr-badge"></span>
      <input type="date" id="datePickerInput" value="2026-09-04">
      <button id="planningModeBtn"></button>
      <button id="autoBreakBtn"></button>
    `;

    state.selectedDate = '2026-09-04'; // Viernes / Friday
    dashboard.syncFormInputsFromState();

    const dayLabel = document.getElementById('selectedDayLabel');
    expect(dayLabel.textContent).toBe('Vie');

    // Cambiamos el idioma a inglés
    setLocale('en');
    translateDOM();

    const views = TodayTasksViews({
      getState: () => state,
      getCurrentView: () => 'main',
      computeSchedule: () => null
    });
    views.renderAll();

    // Debe haber cambiado a 'Fri' automáticamente
    expect(dayLabel.textContent).toBe('Fri');
    setLocale('es');
  });

  it('translateDOM traduce directamente selectedDayLabel a partir del valor de datePickerInput', async () => {
    const { translateDOM } = await import('../js/i18n.js');

    document.body.innerHTML = `
      <span id="selectedDayLabel" class="day-abbr-badge">Vie</span>
      <input type="date" id="datePickerInput" value="2026-09-04">
    `;

    const dayLabel = document.getElementById('selectedDayLabel');
    expect(dayLabel.textContent).toBe('Vie');

    setLocale('en');
    translateDOM();
    expect(dayLabel.textContent).toBe('Fri');

    setLocale('es');
    translateDOM();
    expect(dayLabel.textContent).toBe('Vie');
  });
});
