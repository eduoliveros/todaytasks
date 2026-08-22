import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { computeSchedule } from '../js/scheduler.js';
import { TodayTasksViews } from '../js/views.js';

describe('Planning Views - renderBoard & renderSummary chronological ordering', () => {
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
    state.selectedDate = '2026-08-17'; // Lunes
    state.planningMode = true; // Empieza desde trabajo start (09:00 / 540)
    state.workStart = 540;
    state.workEnd = 1080;

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

    views = TodayTasksViews(ctx);
  });

  it('renderiza los slots del panel de planificación (board) en estricto orden cronológico al añadir tarea a la parte superior', () => {
    state.tasks = [
      { id: 1, title: 'Tarea 1 (Original)', planned: 30, status: 'pending', order: 2, elapsedBefore: 0 },
      { id: 2, title: 'Tarea 2 (Nueva al inicio)', planned: 20, status: 'pending', order: 1, elapsedBefore: 0 }
    ];

    views.renderAll();

    const boardContent = document.getElementById('boardContent');
    const slots = boardContent.querySelectorAll('.slot.slot-task');
    expect(slots).toHaveLength(2);

    // Slot 1 debe ser Tarea 2 (09:00 - 09:20)
    expect(slots[0].textContent).toContain('09:00–09:20');
    expect(slots[0].textContent).toContain('Tarea 2 (Nueva al inicio)');

    // Slot 2 debe ser Tarea 1 (09:20 - 09:50)
    expect(slots[1].textContent).toContain('09:20–09:50');
    expect(slots[1].textContent).toContain('Tarea 1 (Original)');
  });

  it('reordena los slots del panel de planificación cuando cambian los órdenes de tareas (moveTask)', () => {
    state.tasks = [
      { id: 1, title: 'Tarea A', planned: 30, status: 'pending', order: 1, elapsedBefore: 0 },
      { id: 2, title: 'Tarea B', planned: 45, status: 'pending', order: 2, elapsedBefore: 0 }
    ];

    views.renderAll();

    let slots = document.getElementById('boardContent').querySelectorAll('.slot.slot-task');
    expect(slots[0].textContent).toContain('Tarea A');
    expect(slots[1].textContent).toContain('Tarea B');

    // Intercambiar orden (mover Tarea B arriba)
    state.tasks[0].order = 2;
    state.tasks[1].order = 1;

    views.renderAll();

    slots = document.getElementById('boardContent').querySelectorAll('.slot.slot-task');
    expect(slots[0].textContent).toContain('Tarea B');
    expect(slots[1].textContent).toContain('Tarea A');
  });

  it('prioriza la tarea en ejecución en el panel de agenda pendiente', () => {
    state.tasks = [
      { id: 1, title: 'Tarea Ejecutando', planned: 30, status: 'running', runningStart: 540, order: 2, elapsedBefore: 0 },
      { id: 2, title: 'Tarea Pendiente Nueva arriba', planned: 30, status: 'pending', order: 1, elapsedBefore: 0 }
    ];

    views.renderAll();

    const pendingList = document.getElementById('pendingList');
    const rows = pendingList.querySelectorAll('.summary-row');
    expect(rows).toHaveLength(2);

    // La primera fila de la agenda pendiente debe ser la tarea en ejecución
    expect(rows[0].textContent).toContain('Tarea Ejecutando');
    expect(rows[1].textContent).toContain('Tarea Pendiente Nueva arriba');
  });

  it('muestra todas las tareas en el board cuando una tarea se pone en ejecución (sin planning mode)', () => {
    // Simular: ahora son las 10:00 (600 min), la tarea se acaba de iniciar
    // En modo normal (sin planningMode), viewStart = now = 600
    state.planningMode = false;
    const NOW = 600; // 10:00
    const ctxNow = {
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
    const viewsNow = TodayTasksViews(ctxNow);

    state.tasks = [
      // Tarea A: en ejecución, runningStart = now = 600, 60 min planificados
      // plannedEnd = 600 + 60 = 660, effectiveEnd = max(660, 600) = 660
      { id: 1, title: 'Tarea A (en curso)', planned: 60, status: 'running', runningStart: NOW, order: 1, elapsedBefore: 0, runningStart: NOW },
      // Tarea B: pendiente, debe aparecer después de A
      { id: 2, title: 'Tarea B (pendiente)', planned: 30, status: 'pending', order: 2, elapsedBefore: 0 },
    ];

    viewsNow.renderAll();

    const boardContent = document.getElementById('boardContent');
    const slots = boardContent.querySelectorAll('.slot.slot-task');

    // Ambas tareas deben aparecer en el board
    expect(slots).toHaveLength(2);
    expect(boardContent.textContent).toContain('Tarea A (en curso)');
    expect(boardContent.textContent).toContain('Tarea B (pendiente)');
  });

  it('muestra la tarea en ejecución en el board aunque haya superado su tiempo planificado (effectiveEnd = now)', () => {
    // Escenario: ahora son las 10:30 (630), la tarea empezó a las 10:00 (600)
    // con 20 min planificados → plannedEnd = 620 < now=630
    // → effectiveEnd = max(620, 630) = 630 = now = viewStart
    // Bug: e.end (630) > viewStart (630) → FALSE → el evento se filtra y todo desaparece
    state.planningMode = false;
    const NOW = 630; // 10:30
    const ctxOvertime = {
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
    const viewsOvertime = TodayTasksViews(ctxOvertime);

    state.tasks = [
      // Tarea A: en ejecución con tiempo AGOTADO. plannedEnd=620 < now=630
      // effectiveEnd = max(620, 630) = 630 = now = viewStart
      { id: 1, title: 'Tarea A (overtime)', planned: 20, status: 'running', runningStart: 600, order: 1, elapsedBefore: 0 },
      { id: 2, title: 'Tarea B (pendiente)', planned: 30, status: 'pending', order: 2, elapsedBefore: 0 },
    ];

    viewsOvertime.renderAll();

    const boardContent = document.getElementById('boardContent');
    // La tarea A debe seguir visible (aunque esté en overtime)
    expect(boardContent.textContent).toContain('Tarea A (overtime)');
    // La tarea B también debe ser visible
    expect(boardContent.textContent).toContain('Tarea B (pendiente)');
  });

  it('PLANIFICACIÓN ON: muestra todas las tareas en el board cuando una tarea se pone en ejecución', () => {
    // Escenario: modo planificación activado, workStart=540 (09:00), now=630 (10:30)
    // viewStart = workStart = 540 (NO now)
    // running task: runningStart=630, planned=60 → plannedEnd=690, effectiveEnd=690
    // pending task: cursor=690 → segment {start:690, end:720}
    // Todas deben aparecer en el board
    state.planningMode = true;
    const NOW = 630; // 10:30
    const ctxPlan = {
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
    const viewsPlan = TodayTasksViews(ctxPlan);

    state.tasks = [
      { id: 1, title: 'Tarea A (en curso)', planned: 60, status: 'running', runningStart: NOW, order: 1, elapsedBefore: 0 },
      { id: 2, title: 'Tarea B (pendiente)', planned: 30, status: 'pending', order: 2, elapsedBefore: 0 },
      { id: 3, title: 'Tarea C (pendiente)', planned: 45, status: 'pending', order: 3, elapsedBefore: 0 },
    ];

    viewsPlan.renderAll();

    const boardContent = document.getElementById('boardContent');
    expect(boardContent.textContent).toContain('Tarea A (en curso)');
    expect(boardContent.textContent).toContain('Tarea B (pendiente)');
    expect(boardContent.textContent).toContain('Tarea C (pendiente)');
  });

  it('PLANIFICACIÓN ON: tareas pendientes visibles aunque la running empiece antes de workStart (ej. 09:00 con jornada a las 16:00)', () => {
    // Escenario exacto del usuario:
    // now = 540 (09:00), workStart = 960 (16:00), planningMode ON
    // viewStart = workStart = 960
    // Running task: runningStart=540, planned=60 → effectiveEnd=600 < workStart
    // Sin fix: cursor=600 → pending tasks scheduled 600-660, filtered out (< viewStart 960)
    // Con fix: cursor=max(600, 960)=960 → pending tasks scheduled from 960, visible ✅
    state.planningMode = true;
    state.workStart = 960;  // 16:00
    state.workEnd = 1200;   // 20:00
    const NOW = 540; // 09:00
    const ctxEarly = {
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
    const viewsEarly = TodayTasksViews(ctxEarly);

    state.tasks = [
      { id: 1, title: 'Tarea ejecutando antes de jornada', planned: 60, status: 'running', runningStart: NOW, order: 1, elapsedBefore: 0 },
      { id: 2, title: 'Tarea pendiente A', planned: 30, status: 'pending', order: 2, elapsedBefore: 0 },
      { id: 3, title: 'Tarea pendiente B', planned: 45, status: 'pending', order: 3, elapsedBefore: 0 },
    ];

    viewsEarly.renderAll();

    const boardContent = document.getElementById('boardContent');

    // Las tareas pendientes DEBEN aparecer en el board desde workStart (16:00)
    expect(boardContent.textContent).toContain('Tarea pendiente A');
    expect(boardContent.textContent).toContain('Tarea pendiente B');

    // Y deben estar programadas desde workStart (16:00 = 960)
    expect(boardContent.textContent).toContain('16:00');
  });
});
