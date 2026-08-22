import { describe, it, expect } from 'vitest';
import { computeSchedule, blockedIntervals } from '../js/scheduler.js';
import { defaultState } from '../js/state.js';

describe('Descansos Automáticos y Proporcionales (Scheduler)', () => {
  it('divide una tarea de 90 min en 60 min de trabajo + 10 min de descanso + 30 min restantes', () => {
    const state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080; // 18:00
    state.meetings = [];
    state.autoBreakEnabled = true;
    state.tasks = [
      { id: 1, title: 'Tarea 90m', planned: 90, elapsedBefore: 0, status: 'pending', order: 1 }
    ];

    const mockNowMins = () => 540;
    const schedule = computeSchedule(state, mockNowMins);

    expect(schedule.segmentsByTask[1]).toEqual([
      { start: 540, end: 600 },
      { start: 610, end: 640 }
    ]);
    expect(schedule.breaks).toBeDefined();
    expect(schedule.breaks).toHaveLength(1);
    expect(schedule.breaks[0]).toEqual({
      start: 600,
      end: 610,
      duration: 10
    });
  });

  it('inserta descanso de 10 min cuando dos tareas consecutivas superan 60 min', () => {
    const state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080; // 18:00
    state.meetings = [];
    state.autoBreakEnabled = true;
    state.tasks = [
      { id: 1, title: 'Tarea 1 (45m)', planned: 45, elapsedBefore: 0, status: 'pending', order: 1 },
      { id: 2, title: 'Tarea 2 (45m)', planned: 45, elapsedBefore: 0, status: 'pending', order: 2 }
    ];

    const mockNowMins = () => 540;
    const schedule = computeSchedule(state, mockNowMins);

    // Tarea 1: 540 -> 585 (45 min)
    expect(schedule.segmentsByTask[1]).toEqual([{ start: 540, end: 585 }]);

    // Tarea 2: 585 -> 600 (15 min para llegar a 60 min continuo), luego descanso 600->610, luego 610->640 (30 min restantes)
    expect(schedule.segmentsByTask[2]).toEqual([
      { start: 585, end: 600 },
      { start: 610, end: 640 }
    ]);
    expect(schedule.breaks).toHaveLength(1);
    expect(schedule.breaks[0]).toEqual({ start: 600, end: 610, duration: 10 });
  });

  it('no inserta descanso intermedio en reuniones consecutivas y aplica descanso proporcional de 20 min tras 2 horas', () => {
    const state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080; // 18:00
    // Dos reuniones consecutivas: 10:00 a 11:00 (600 a 660) y 11:00 a 12:00 (660 a 720) = 120 min de trabajo continuo
    state.meetings = [
      { id: 'm1', title: 'Reunión 1', start: 600, end: 660 },
      { id: 'm2', title: 'Reunión 2', start: 660, end: 720 }
    ];
    state.autoBreakEnabled = true;
    state.tasks = [
      { id: 1, title: 'Tarea posterior', planned: 40, elapsedBefore: 0, status: 'pending', order: 1 }
    ];

    // blockedIntervals unifica el bloque continuo 600->720 y añade buffer proporcional de 20 min (720->740)
    const blocked = blockedIntervals(state);
    expect(blocked).toEqual([{ start: 600, end: 740 }]);

    const mockNowMins = () => 600;
    const schedule = computeSchedule(state, mockNowMins);

    // La tarea posterior empieza tras el descanso proporcional de 20 min (a las 12:20 = 740)
    expect(schedule.segmentsByTask[1]).toEqual([{ start: 740, end: 780 }]);
  });

  it('calcula descanso proporcional de 15 min tras una reunión larga de 90 min', () => {
    const state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080; // 18:00
    // Reunión de 90 min: 10:00 a 11:30 (600 a 690)
    state.meetings = [
      { id: 'm1', title: 'Reunión Larga', start: 600, end: 690 }
    ];
    state.autoBreakEnabled = true;
    state.tasks = [
      { id: 1, title: 'Tarea post reunión', planned: 30, elapsedBefore: 0, status: 'pending', order: 1 }
    ];

    // Proporcional: 90 / 60 * 10 = 15 min de descanso -> blocked de 600 a 705 (690 + 15)
    const blocked = blockedIntervals(state);
    expect(blocked).toEqual([{ start: 600, end: 705 }]);

    const mockNowMins = () => 600;
    const schedule = computeSchedule(state, mockNowMins);
    expect(schedule.segmentsByTask[1]).toEqual([{ start: 705, end: 735 }]);
  });

  it('resetea el contador continuo ante huecos libres >= duración de descanso', () => {
    const state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080; // 18:00
    // Reunión de 09:00 a 09:30 (540 a 570) con buffer de 10 min (570 a 580)
    // Tarea 1 a las 10:00 (600) -> hay un hueco libre de 20 min (580 a 600)
    state.meetings = [
      { id: 'm1', title: 'Reunión corta', start: 540, end: 570 }
    ];
    state.tasks = [
      { id: 1, title: 'Tarea 1 (45m)', planned: 45, elapsedBefore: 0, status: 'pending', order: 1 }
    ];

    const mockNowMins = () => 540;
    const schedule = computeSchedule(state, mockNowMins);

    // Tras la reunión (540-570) + buffer (570-580), la tarea 1 empieza a las 580 y corre 45m (580-625) sin partirse
    expect(schedule.segmentsByTask[1]).toEqual([{ start: 580, end: 625 }]);
  });

  it('no divide tareas si autoBreakEnabled es false', () => {
    const state = defaultState();
    state.workStart = 540;
    state.workEnd = 1080;
    state.autoBreakEnabled = false;
    state.meetings = [];
    state.tasks = [
      { id: 1, title: 'Tarea 90m', planned: 90, elapsedBefore: 0, status: 'pending', order: 1 }
    ];

    const mockNowMins = () => 540;
    const schedule = computeSchedule(state, mockNowMins);

    expect(schedule.segmentsByTask[1]).toEqual([{ start: 540, end: 630 }]);
    expect(schedule.breaks).toEqual([]);
  });

  it('renderiza la etiqueta de colchón sin duplicar la palabra colchón', async () => {
    const { TodayTasksViews } = await import('../js/views.js');
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
      <div id="autoBreakBtn"></div>
      <div id="envBtnWork"></div>
      <div id="envBtnPersonal"></div>
    `;

    const state = defaultState();
    state.workStart = 540;
    state.workEnd = 1080;
    state.meetings = [{ id: 'm1', title: 'Daily Standup', start: 540, end: 570 }];
    state.tasks = [];

    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => computeSchedule(state, () => 540),
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };

    const views = TodayTasksViews(ctx);
    views.renderAll();

    const bufferSlot = document.querySelector('.slot.slot-buffer');
    expect(bufferSlot).not.toBeNull();
    // Debe tener el icono y no repetir 'colchón · colchón'
    expect(bufferSlot.textContent).toContain('☕ colchón · Daily Standup');
    expect(bufferSlot.textContent).not.toContain('colchón · colchón');

    // Verificar botón autoBreakBtn
    const autoBreakBtn = document.getElementById('autoBreakBtn');
    expect(autoBreakBtn.classList.contains('active')).toBe(true);
    expect(autoBreakBtn.textContent).toContain('Auto descansos: ON');
  });
});
