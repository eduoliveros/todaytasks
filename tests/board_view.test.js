import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { computeSchedule } from '../js/scheduler.js';
import { TodayTasksBoardView } from '../js/views/board.js';
import { setLocale } from '../js/i18n.js';

describe('TodayTasksBoardView - Internacionalización (i18n)', () => {
  let state;
  let boardView;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="boardTitle"></div>
      <div id="boardNow"></div>
      <div id="boardContent"></div>
      <div id="meetingsSummaryList"></div>
      <div id="completedList"></div>
      <div id="pendingList"></div>
    `;
    setLocale('es');
    state = defaultState();
    state.selectedDate = '2026-09-04';
    state.workStart = 540; // 09:00
    state.workEnd = 1080;  // 18:00
    state.meetings = [
      { id: 'm1', title: 'Daily', start: 540, end: 570 }
    ];
    state.tasks = [
      { id: 't1', title: 'Task 1', planned: 60, status: 'pending', elapsedBefore: 0, order: 1 }
    ];

    boardView = TodayTasksBoardView({
      getState: () => state
    });
  });

  it('renderiza títulos de timeline y marcas en español', () => {
    state.planningMode = false;
    const schedule = computeSchedule(state, () => 600);
    boardView.renderBoard(schedule);

    const titleEl = document.getElementById('boardTitle');
    expect(titleEl.textContent).toBe('Desde ahora hasta el fin de jornada');

    const workEndBadge = document.querySelector('.calendar-work-end-badge');
    expect(workEndBadge.textContent).toContain('Fin de jornada');

    const bufferSlot = document.querySelector('.slot.slot-buffer');
    expect(bufferSlot.textContent).toContain('colchón · Daily');

    boardView.renderSummary(schedule);
    const meetingsEl = document.getElementById('meetingsSummaryList');
    expect(meetingsEl.textContent).toContain('Inicio');
    expect(meetingsEl.textContent).toContain('Fin');
  });

  it('renderiza títulos de timeline y marcas en inglés', () => {
    setLocale('en');
    state.planningMode = false;
    const schedule = computeSchedule(state, () => 600);
    boardView.renderBoard(schedule);

    const titleEl = document.getElementById('boardTitle');
    expect(titleEl.textContent).toBe('From now until workday end');

    const workEndBadge = document.querySelector('.calendar-work-end-badge');
    expect(workEndBadge.textContent).toContain('Workday end');

    const bufferSlot = document.querySelector('.slot.slot-buffer');
    expect(bufferSlot.textContent).toContain('buffer · Daily');

    boardView.renderSummary(schedule);
    const meetingsEl = document.getElementById('meetingsSummaryList');
    expect(meetingsEl.textContent).toContain('Start');
    expect(meetingsEl.textContent).toContain('End');

    const pendingEl = document.getElementById('pendingList');
    expect(pendingEl.textContent).toContain('Est. start');
    expect(pendingEl.textContent).toContain('Est. end');
    expect(pendingEl.textContent).toContain('pending');

    setLocale('es');
  });

  it('renderiza mensaje vacío cuando la jornada ha terminado en español e inglés', () => {
    state.meetings = [];
    state.tasks = [];
    const schedule = { now: 1100, viewStart: 1100, segmentsByTask: {} };

    boardView.renderBoard(schedule);
    const boardEl = document.getElementById('boardContent');
    expect(boardEl.textContent).toContain('La jornada laboral ha terminado.');

    setLocale('en');
    boardView.renderBoard(schedule);
    expect(boardEl.textContent).toContain('The workday has ended.');
    setLocale('es');
  });
});
