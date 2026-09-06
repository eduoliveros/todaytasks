import { describe, it, expect } from 'vitest';
import { computeSchedule } from '../js/scheduler.js';

describe('Scheduler with Task Dependencies', () => {
  function makeState(tasks, dateStr = '2026-09-06') {
    return {
      selectedDate: dateStr,
      activeEnv: 'work',
      autoBreakEnabled: false, // disable auto-breaks to make arithmetic predictable
      workStart: 9 * 60, // 540 = 09:00
      workEnd: 18 * 60,  // 1080 = 18:00
      planningMode: true,
      meetings: [],
      tasks,
      environments: {
        work: {
          name: 'Trabajo',
          days: {
            [dateStr]: { tasks }
          }
        }
      }
    };
  }

  it('schedules dependent task after blocking task finishes in the same day', () => {
    // T1: 60 mins (09:00 -> 10:00).
    // T2: depends on T1, 30 mins.
    const t1 = { id: 't1', displayId: 'W-1', title: 'T1', planned: 60, status: 'pending', order: 1, dependsOn: [] };
    const t2 = { id: 't2', displayId: 'W-2', title: 'T2', planned: 30, status: 'pending', order: 2, dependsOn: ['t1'] };

    const state = makeState([t1, t2]);
    const schedule = computeSchedule(state, 9 * 60);

    const segsT1 = schedule.segmentsByTask['t1'];
    const segsT2 = schedule.segmentsByTask['t2'];

    expect(segsT1).toBeDefined();
    expect(segsT2).toBeDefined();

    expect(segsT1[0].start).toBe(540); // 09:00
    expect(segsT1[0].end).toBe(600);   // 10:00

    expect(segsT2[0].start).toBe(600); // 10:00 (starts right after T1)
    expect(segsT2[0].end).toBe(630);   // 10:30
  });

  it('respects dependency order even if user set reverse order', () => {
    // T2 has order 1, but depends on T1 (order 2).
    // The scheduler must place T1 first, then T2!
    const t2 = { id: 't2', displayId: 'W-2', title: 'T2', planned: 30, status: 'pending', order: 1, dependsOn: ['t1'] };
    const t1 = { id: 't1', displayId: 'W-1', title: 'T1', planned: 60, status: 'pending', order: 2, dependsOn: [] };

    const state = makeState([t2, t1]);
    const schedule = computeSchedule(state, 9 * 60);

    const segsT1 = schedule.segmentsByTask['t1'];
    const segsT2 = schedule.segmentsByTask['t2'];

    expect(segsT1[0].start).toBe(540); // T1 runs 09:00 -> 10:00
    expect(segsT1[0].end).toBe(600);
    expect(segsT2[0].start).toBe(600); // T2 runs 10:00 -> 10:30
    expect(segsT2[0].end).toBe(630);
  });

  it('marks task in overflow if blocking task is in a future date and pending', () => {
    const todayStr = '2026-09-06';
    const futureStr = '2026-09-07';

    const tToday = { id: 't_today', displayId: 'W-2', title: 'Tarea hoy', planned: 30, status: 'pending', order: 1, dependsOn: ['t_futura'] };
    const tFutura = { id: 't_futura', displayId: 'W-1', title: 'Tarea mañana', planned: 60, status: 'pending', order: 1, dependsOn: [] };

    const state = {
      selectedDate: todayStr,
      activeEnv: 'work',
      autoBreakEnabled: false,
      workStart: 9 * 60,
      workEnd: 18 * 60,
      planningMode: true,
      meetings: [],
      tasks: [tToday],
      environments: {
        work: {
          name: 'Trabajo',
          days: {
            [todayStr]: { tasks: [tToday] },
            [futureStr]: { tasks: [tFutura] }
          }
        }
      }
    };

    const schedule = computeSchedule(state, 9 * 60);
    expect(schedule.overflowIds.has('t_today')).toBe(true);
  });

  it('schedules task normally if blocking task in past/future is already completed', () => {
    const todayStr = '2026-09-06';
    const pastStr = '2026-09-05';

    const tToday = { id: 't_today', displayId: 'W-2', title: 'Tarea hoy', planned: 30, status: 'pending', order: 1, dependsOn: ['t_pasada'] };
    const tPasada = { id: 't_pasada', displayId: 'W-1', title: 'Tarea ayer', planned: 60, status: 'completed', order: 1, dependsOn: [] };

    const state = {
      selectedDate: todayStr,
      activeEnv: 'work',
      autoBreakEnabled: false,
      workStart: 9 * 60,
      workEnd: 18 * 60,
      planningMode: true,
      meetings: [],
      tasks: [tToday],
      environments: {
        work: {
          name: 'Trabajo',
          days: {
            [todayStr]: { tasks: [tToday] },
            [pastStr]: { tasks: [tPasada] }
          }
        }
      }
    };

    const schedule = computeSchedule(state, 9 * 60);
    expect(schedule.overflowIds.has('t_today')).toBe(false);
    expect(schedule.segmentsByTask['t_today']).toBeDefined();
    expect(schedule.segmentsByTask['t_today'][0].start).toBe(540);
  });
});
