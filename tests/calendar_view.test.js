import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { computeSchedule } from '../js/scheduler.js';
import { TodayTasksViews } from '../js/views.js';

describe('Calendar Day View (Board) Tests', () => {
  let state;
  let views;

  beforeEach(() => {
    document.body.innerHTML = `
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
    state.selectedDate = '2026-08-22';
    state.planningMode = false;
    state.workStart = 540;  // 09:00
    state.workEnd = 1080;  // 18:00
  });

  it('renderiza la cuadrícula de calendario con eje de horas y marcas temporales', () => {
    const NOW = 600; // 10:00
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const timeAxis = boardContent.querySelector('.calendar-time-axis');
    const hourMarks = boardContent.querySelectorAll('.calendar-hour-mark');
    const gridLines = boardContent.querySelectorAll('.calendar-grid-line');

    expect(timeAxis).not.toBeNull();
    expect(hourMarks.length).toBeGreaterThanOrEqual(10); // Desde 09:00 hasta 20:00 (+2h)
    expect(gridLines.length).toBeGreaterThanOrEqual(10);
    expect(boardContent.textContent).toContain('09:00');
    expect(boardContent.textContent).toContain('18:00');
    expect(boardContent.textContent).toContain('20:00');
  });

  it('renderiza la barra horizontal de momento actual (NOW) en la posición correcta', () => {
    const NOW = 630; // 10:30
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const nowIndicator = boardContent.querySelector('.calendar-now-indicator');
    expect(nowIndicator).not.toBeNull();

    const nowBadge = nowIndicator.querySelector('.calendar-now-badge');
    expect(nowBadge).not.toBeNull();
    expect(nowBadge.textContent).toContain('10:30');

    // Inicio de calendario a las 09:00 (540 min). NOW = 630 min (90 min después).
    // top = 90 * 1.2 = 108px
    expect(nowIndicator.style.top).toBe('108px');
  });

  it('extiende el calendario 2 horas tras el fin de jornada y proyecta tareas en overflow', () => {
    // Jornada acaba a las 18:00 (1080 min). Tarea 1 ocupa 17:00 a 18:00.
    // Tarea 2 ocupa 18:00 a 18:45 (entra en la zona extendida +2h).
    state.planningMode = true;
    state.tasks = [
      { id: 1, title: 'Tarea dentro de jornada', planned: 60, status: 'pending', order: 1, elapsedBefore: 0 },
      { id: 2, title: 'Tarea en zona extendida', planned: 45, status: 'pending', order: 2, elapsedBefore: 0 }
    ];
    // Modificamos workStart para que la Tarea 1 empiece a las 17:00 (1020)
    state.workStart = 1020;
    state.workEnd = 1080; // 18:00

    const NOW = 1020;
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const extendedZone = boardContent.querySelector('.calendar-extended-zone');
    expect(extendedZone).not.toBeNull();
    expect(extendedZone.textContent).toContain('+2h tras fin de jornada');

    const workEndMarker = boardContent.querySelector('.calendar-work-end-line');
    expect(workEndMarker).not.toBeNull();
    expect(workEndMarker.textContent).toContain('Fin de jornada (18:00)');

    const slots = boardContent.querySelectorAll('.slot.slot-task');
    expect(slots).toHaveLength(2);

    // Tarea 1: 17:00–18:00
    expect(slots[0].textContent).toContain('17:00–18:00');
    expect(slots[0].textContent).toContain('Tarea dentro de jornada');

    // Tarea 2: 18:00–18:45 (en la zona extendida con clase slot-overflow y tag ⚠ +jornada)
    expect(slots[1].textContent).toContain('18:00–18:45');
    expect(slots[1].textContent).toContain('Tarea en zona extendida');
    expect(slots[1].classList.contains('slot-overflow')).toBe(true);
  });

  it('posiciona proporcionalmente reuniones y colchones de 10 minutos', () => {
    state.planningMode = true;
    state.workStart = 540; // 09:00
    state.workEnd = 1080;  // 18:00
    state.meetings = [
      { id: 'm1', title: 'Daily Standup', start: 570, end: 600 } // 09:30 a 10:00 (30m) + 10m buffer
    ];

    const NOW = 540;
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const meetingSlot = boardContent.querySelector('.slot.slot-meeting');
    const bufferSlot = boardContent.querySelector('.slot.slot-buffer');

    expect(meetingSlot).not.toBeNull();
    expect(meetingSlot.textContent).toContain('Daily Standup');
    expect(meetingSlot.textContent).toContain('09:30–10:00');
    // top = (570 - 540) * 1.2 = 36px; height = 30 * 1.2 = 36px
    expect(meetingSlot.style.top).toBe('36px');
    expect(meetingSlot.style.height).toBe('36px');

    expect(bufferSlot).not.toBeNull();
    expect(bufferSlot.textContent).toContain('colchón');
    expect(bufferSlot.textContent).toContain('10:00–10:10');
    // top = (600 - 540) * 1.2 = 72px; height = 10 * 1.2 = 12px -> min height 24px
    expect(bufferSlot.style.top).toBe('72px');
    expect(bufferSlot.style.height).toBe('24px');
  });

  it('divide horizontalmente en columnas paralelas las tareas cortas que se solapan visualmente', () => {
    state.planningMode = true;
    state.workStart = 540; // 09:00
    state.workEnd = 1080;  // 18:00
    state.tasks = [
      { id: 1, title: 'Tarea Corta A', planned: 10, status: 'pending', order: 1, elapsedBefore: 0 },
      { id: 2, title: 'Tarea Corta B', planned: 10, status: 'pending', order: 2, elapsedBefore: 0 }
    ];

    const NOW = 540;
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const slots = boardContent.querySelectorAll('.slot.slot-task');
    expect(slots).toHaveLength(2);

    // Ambas tareas cortas deben dividirse en columnas paralelas lado a lado
    expect(slots[0].classList.contains('slot-multi-col')).toBe(true);
    expect(slots[1].classList.contains('slot-multi-col')).toBe(true);
    expect(slots[0].style.width).toContain('50%');
    expect(slots[1].style.width).toContain('50%');
    expect(slots[0].style.left).toContain('0%');
    expect(slots[1].style.left).toContain('50%');
  });

  it('preserva la posición del scroll (scrollTop) tras sucesivas actualizaciones de la vista', () => {
    let nowVal = 600; // 10:00
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => nowVal),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    let scrollEl = boardContent.querySelector('.board-calendar-scroll');
    expect(scrollEl).not.toBeNull();

    // Simular que el usuario hace scroll hacia abajo a 180px
    scrollEl.scrollTop = 180;
    scrollEl.dispatchEvent(new Event('scroll'));

    // Actualizar la hora (simular siguiente tick de 15s)
    nowVal = 601; // 10:01
    views.renderAll();

    // El nuevo elemento de scroll debe haber preservado la posición 180px
    scrollEl = boardContent.querySelector('.board-calendar-scroll');
    expect(scrollEl.scrollTop).toBe(180);
  });

  it('ajusta automáticamente el scroll al momento actual con margen de contexto superior', () => {
    // Día de 09:00 (540 min) a 18:00 (1080 min). Momento actual: 13:00 (780 min).
    // nowOffset = (780 - 540) * 1.2 = 288px.
    // Con margen de 80px, targetScroll = 288 - 80 = 208px.
    const NOW = 780; // 13:00
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const scrollEl = boardContent.querySelector('.board-calendar-scroll');
    expect(scrollEl).not.toBeNull();
    expect(scrollEl.scrollTop).toBe(208);
  });

  it('ajusta el scroll a 0 si el momento actual está cerca del inicio de la jornada', () => {
    // Día de 09:00 (540 min) a 18:00 (1080 min). Momento actual: 09:15 (555 min).
    // nowOffset = (555 - 540) * 1.2 = 18px.
    // targetScroll = Math.max(0, 18 - 80) = 0px.
    const NOW = 555; // 09:15
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const scrollEl = boardContent.querySelector('.board-calendar-scroll');
    expect(scrollEl).not.toBeNull();
    expect(scrollEl.scrollTop).toBe(0);
  });

  it('en modo planificación el scroll se posiciona al inicio (0) para ver todo el plan', () => {
    state.planningMode = true;
    const NOW = 780; // 13:00
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const scrollEl = boardContent.querySelector('.board-calendar-scroll');
    expect(scrollEl).not.toBeNull();
    expect(scrollEl.scrollTop).toBe(0);
  });

  it('reajusta el scroll al momento actual cuando se invoca resetBoardScroll', () => {
    const NOW = 780; // 13:00 -> 208px target
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => NOW),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    views = TodayTasksViews(ctx);
    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    let scrollEl = boardContent.querySelector('.board-calendar-scroll');
    expect(scrollEl.scrollTop).toBe(208);

    // Usuario mueve el scroll manualmente a 50px
    scrollEl.scrollTop = 50;
    scrollEl.dispatchEvent(new Event('scroll'));

    // Re-render preserva 50px
    views.renderAll();
    scrollEl = boardContent.querySelector('.board-calendar-scroll');
    expect(scrollEl.scrollTop).toBe(50);

    // Al invocar resetBoardScroll (por ejemplo al volver a Hoy o vista principal), vuelve a 208px
    views.resetBoardScroll();
    views.renderAll();
    scrollEl = boardContent.querySelector('.board-calendar-scroll');
    expect(scrollEl.scrollTop).toBe(208);
  });
});
