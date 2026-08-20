import { describe, it, expect } from 'vitest';
import * as scheduler from '../js/scheduler.js';
import { TodayTasksScheduler, computeSchedule, blockedIntervals } from '../js/scheduler.js';
import { defaultState } from '../js/state.js';

describe('TodayTasksScheduler (ES Module & Global bridge)', () => {
  it('exporta correctamente tanto funciones nombradas como objeto consolidado y window.TodayTasksScheduler', () => {
    expect(TodayTasksScheduler).toBeDefined();
    expect(computeSchedule).toBeDefined();
    expect(blockedIntervals).toBeDefined();
    expect(window.TodayTasksScheduler).toBeDefined();
    expect(window.TodayTasksScheduler.computeSchedule).toBe(computeSchedule);
  });

  it('asigna tareas secuencialmente en tiempo libre', () => {
    const state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080; // 18:00
    state.meetings = [];
    state.tasks = [
      { id: 1, title: 'Tarea 1', planned: 60, elapsedBefore: 0, status: 'pending', order: 1 },
      { id: 2, title: 'Tarea 2', planned: 30, elapsedBefore: 0, status: 'pending', order: 2 }
    ];

    // Simular que son las 09:00 (540 minutos)
    const mockNowMins = () => 540;
    const schedule = computeSchedule(state, mockNowMins);

    expect(schedule.overflowIds.size).toBe(0);
    // Tarea 1 de 09:00 a 10:00 (540 -> 600)
    expect(schedule.segmentsByTask[1]).toEqual([{ start: 540, end: 600 }]);
    // Tarea 2 de 10:00 a 10:30 (600 -> 630)
    expect(schedule.segmentsByTask[2]).toEqual([{ start: 600, end: 630 }]);
  });

  it('respeta las reuniones y añade buffer de 10 minutos', () => {
    const state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 1080; // 18:00
    // Reunión de 09:30 a 10:00 (570 -> 600)
    state.meetings = [{ id: 'm1', title: 'Daily', start: 570, end: 600 }];
    state.tasks = [
      { id: 1, title: 'Tarea Larga', planned: 60, elapsedBefore: 0, status: 'pending', order: 1 }
    ];

    const mockNowMins = () => 540;
    const schedule = computeSchedule(state, mockNowMins);

    // La reunión bloquea de 570 a 610 (600 + 10 min de buffer)
    // Tarea 1 de 30 min (540->570) y 30 min restantes (610->640)
    const segs = schedule.segmentsByTask[1];
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ start: 540, end: 570 });
    expect(segs[1]).toEqual({ start: 610, end: 640 });
  });

  it('detecta tareas en desbordamiento (overflow) cuando superan la jornada', () => {
    const state = defaultState();
    state.workStart = 540; // 09:00
    state.workEnd = 600;  // 10:00 (jornada corta de 1h)
    state.meetings = [];
    state.tasks = [
      { id: 1, title: 'Tarea 1', planned: 45, elapsedBefore: 0, status: 'pending', order: 1 },
      { id: 2, title: 'Tarea 2', planned: 30, elapsedBefore: 0, status: 'pending', order: 2 }
    ];

    const mockNowMins = () => 540;
    const schedule = computeSchedule(state, mockNowMins);

    // Tarea 1 usa 45 min (540->585)
    // Tarea 2 necesita 30 min pero solo hay 15 min disponibles (585->600) -> Entra en overflow
    expect(schedule.overflowIds.has(2)).toBe(true);
  });
});

