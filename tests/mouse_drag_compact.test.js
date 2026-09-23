import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTouchDragEngine, wasRecentTouchDrag, _resetTouchDragState } from '../js/app/touch-drag.js';
import { defaultState } from '../js/state.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';
import { getTodayStr } from '../js/utils.js';
import fs from 'fs';
import path from 'path';

describe('Drag & drop con ratón por pulsación prolongada (mouse long-press)', () => {
  let engine;
  let onDrop;
  let onDragStart;

  beforeEach(() => {
    _resetTouchDragState();
    document.body.innerHTML = `
      <div class="row" data-task-id="task-1">Task 1</div>
      <div class="row" data-task-id="task-2">Task 2</div>
      <div class="row" data-task-id="task-3">Task 3</div>
    `;
    onDrop = vi.fn();
    onDragStart = vi.fn();
    engine = createTouchDragEngine({
      rowSelector: '.row',
      handleSelector: '.handle',
      mouseHoldDelay: 250,
      onDragStart,
      onDrop
    });
  });

  afterEach(() => {
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ignora mousedown si no es el botón principal (botón izquierdo, button === 0)', () => {
    vi.useFakeTimers();
    const row1 = document.querySelector('.row[data-task-id="task-1"]');
    engine.handleMouseDown('task-1', {
      button: 2, // clic derecho
      clientX: 50,
      clientY: 50,
      target: row1,
      currentTarget: row1
    });

    vi.advanceTimersByTime(300);
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('activa el arrastre tras mantener pulsado el ratón (mouse long-press de 250ms)', () => {
    vi.useFakeTimers();
    const row1 = document.querySelector('.row[data-task-id="task-1"]');
    const row2 = document.querySelector('.row[data-task-id="task-2"]');

    engine.handleMouseDown('task-1', {
      button: 0,
      clientX: 50,
      clientY: 50,
      target: row1,
      currentTarget: row1
    });

    // Antes de los 250ms aún no ha arrancado
    vi.advanceTimersByTime(200);
    expect(onDragStart).not.toHaveBeenCalled();

    // Al llegar a los 250ms, se activa
    vi.advanceTimersByTime(50);
    expect(onDragStart).toHaveBeenCalledWith('task-1', row1, null);
    expect(row1.classList.contains('dragging')).toBe(true);

    // Mover el ratón sobre la fila 2
    document.elementFromPoint = vi.fn().mockReturnValue(row2);
    engine.handleMouseMove({
      clientX: 50,
      clientY: 120,
      cancelable: true,
      preventDefault: vi.fn()
    });
    expect(row2.classList.contains('drag-over')).toBe(true);

    // Soltar ratón (mouseup) reordena y suprime click sintético
    engine.handleMouseUp({
      cancelable: true,
      preventDefault: vi.fn()
    });

    expect(onDrop).toHaveBeenCalledWith('task-1', 'task-2', null);
    expect(row1.classList.contains('dragging')).toBe(false);
    expect(row2.classList.contains('drag-over')).toBe(false);
    expect(wasRecentTouchDrag()).toBe(true);
  });

  it('cancela el arrastre si se suelta el ratón antes del tiempo de long-press (< 250ms)', () => {
    vi.useFakeTimers();
    const row1 = document.querySelector('.row[data-task-id="task-1"]');

    engine.handleMouseDown('task-1', {
      button: 0,
      clientX: 50,
      clientY: 50,
      target: row1,
      currentTarget: row1
    });

    // Soltar a los 100ms (clic ordinario)
    vi.advanceTimersByTime(100);
    engine.handleMouseUp({});

    // Avanzar más tiempo: no debe haberse disparado drag ni drop
    vi.advanceTimersByTime(300);
    expect(onDragStart).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
    expect(wasRecentTouchDrag()).toBe(false);
  });

  it('cancela el temporizador si el ratón se desplaza significativamente antes del long-press', () => {
    vi.useFakeTimers();
    const row1 = document.querySelector('.row[data-task-id="task-1"]');

    engine.handleMouseDown('task-1', {
      button: 0,
      clientX: 50,
      clientY: 50,
      target: row1,
      currentTarget: row1
    });

    // Mover 20px antes de que se cumpla el temporizador (ej. selección de texto)
    vi.advanceTimersByTime(50);
    engine.handleMouseMove({ clientX: 70, clientY: 50 });

    vi.advanceTimersByTime(250);
    expect(onDragStart).not.toHaveBeenCalled();
  });
});

describe('Integración de eventos de ratón en el tablero principal', () => {
  let state;
  let tasksView;
  let container;

  beforeEach(() => {
    document.body.innerHTML = `<div id="tasksList"></div>`;
    container = document.getElementById('tasksList');

    state = defaultState();
    state.selectedDate = getTodayStr();
    state.tasks = [
      { id: 'task-1', title: 'Primera tarea', planned: 30, urgency: 'today', order: 1, manualOrder: 1, status: 'pending' },
      { id: 'task-2', title: 'Tarea en curso', planned: 45, urgency: 'today', order: 2, manualOrder: 2, status: 'running' }
    ];

    const ctx = {
      getState: () => state,
      getTaskEdit: () => null,
      getTaskSearchQuery: () => '',
      countPendingAutoMoveTasks: vi.fn(() => 0),
      renderAll: vi.fn(),
      smartRender: vi.fn(),
      actionsModule: { reorderTaskByDrag: vi.fn() }
    };

    tasksView = TodayTasksTasksView(ctx);
  });

  it('renderiza onmousedown para long-press en tareas arrastrables (pending)', () => {
    tasksView.renderTasks(null);
    const item = container.querySelector('.task-item[data-task-id="task-1"]');
    expect(item.getAttribute('onmousedown')).toContain("app.handleTaskMouseDown('task-1'");
  });

  it('NO renderiza onmousedown de arrastre en tareas en ejecución (running)', () => {
    tasksView.renderTasks(null);
    const item = container.querySelector('.task-item[data-task-id="task-2"]');
    const onmousedown = item.getAttribute('onmousedown');
    expect(onmousedown ? onmousedown.includes('handleTaskMouseDown') : false).toBe(false);
  });
});

describe('Integración de eventos de ratón en la vista de triaje', () => {
  let state;
  let triageView;
  let container;
  let reorderSpy;

  beforeEach(async () => {
    _resetTouchDragState();
    document.body.innerHTML = `
      <div id="view-triage"></div>
      <div id="triageEditModalHost"></div>
    `;
    container = document.getElementById('view-triage');

    state = defaultState();
    state.selectedDate = getTodayStr();
    state.tasks = [
      { id: 'task-1', title: 'Primera tarea', planned: 30, urgency: 'today', order: 1, manualOrder: 1, status: 'pending' },
      { id: 'task-2', title: 'Segunda tarea', planned: 45, urgency: 'today', order: 2, manualOrder: 2, status: 'pending' }
    ];

    reorderSpy = vi.fn();
    const { TodayTasksTriageView } = await import('../js/views/triage.js');

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      saveState: vi.fn(),
      renderAll: vi.fn(),
      smartRender: vi.fn(),
      actionsModule: { reorderTaskByDrag: reorderSpy },
      getTaskEdit: () => null,
      setTaskEdit: vi.fn(),
      getNotifyState: () => ({ taskId: null }),
      setNotifyState: vi.fn(),
      newId: () => 'id-' + Math.random()
    };

    triageView = TodayTasksTriageView(ctx);
  });

  it('renderiza onmousedown en las filas de triaje para soporte de arrastre con ratón', () => {
    triageView.renderTriageView();
    const row = container.querySelector('.triage-task-row[data-task-id="task-1"]');
    expect(row).not.toBeNull();
    expect(row.getAttribute('onmousedown')).toContain("app.handleTriageMouseDown('task-1'");
  });

  it('permite reordenar tareas en triaje manteniendo pulsado el ratón (mouse long-press)', () => {
    vi.useFakeTimers();
    triageView.renderTriageView();

    const row1 = container.querySelector('.triage-task-row[data-task-id="task-1"]');
    const row2 = container.querySelector('.triage-task-row[data-task-id="task-2"]');

    // Iniciar pulsación sostenida con ratón en task-1
    triageView.handleTriageMouseDown('task-1', {
      button: 0,
      clientX: 50,
      clientY: 50,
      target: row1,
      currentTarget: row1
    });

    // Esperar 250ms de mouseHoldDelay
    vi.advanceTimersByTime(250);
    expect(row1.classList.contains('dragging')).toBe(true);

    // Mover ratón sobre row2
    document.elementFromPoint = vi.fn(() => row2);
    triageView.handleTriageTouchMove({
      clientX: 50,
      clientY: 100,
      cancelable: true,
      preventDefault: vi.fn()
    });

    // Soltar ratón
    triageView.handleTriageTouchEnd({
      cancelable: true,
      preventDefault: vi.fn()
    });

    expect(reorderSpy).toHaveBeenCalledWith('task-1', 'task-2', expect.any(Set));
    expect(wasRecentTouchDrag()).toBe(true);

    vi.advanceTimersByTime(401);
    expect(wasRecentTouchDrag()).toBe(false);
  });

  it('aplica la clase drag-forbidden (rallas rojas) al arrastrar con ratón sobre una posición no permitida en triaje', async () => {
    vi.useFakeTimers();
    const { TodayTasksDragDrop } = await import('../js/actions/dragdrop.js');
    state.tasks = [
      { id: 'task-1', title: 'Task 1 (Base)', urgency: 'today', status: 'pending', order: 1, manualOrder: 1 },
      { id: 'task-2', title: 'Task 2 (Depende de 1)', urgency: 'today', status: 'pending', order: 2, manualOrder: 2, dependsOn: ['task-1'] }
    ];
    const dragDrop = TodayTasksDragDrop({ getState: () => state, saveState: vi.fn(), renderAll: vi.fn() });
    const { TodayTasksTriageView } = await import('../js/views/triage.js');
    const customCtx = {
      getState: () => state,
      setState: (s) => { state = s; },
      saveState: vi.fn(),
      renderAll: vi.fn(),
      smartRender: vi.fn(),
      actionsModule: dragDrop,
      getTaskEdit: () => null,
      setTaskEdit: vi.fn(),
      getNotifyState: () => ({ taskId: null }),
      setNotifyState: vi.fn(),
      newId: () => 'id-' + Math.random()
    };
    const tView = TodayTasksTriageView(customCtx);
    tView.renderTriageView();

    const row1 = container.querySelector('.triage-task-row[data-task-id="task-1"]');
    const row2 = container.querySelector('.triage-task-row[data-task-id="task-2"]');

    // Iniciar arrastre con ratón en task-2
    tView.handleTriageMouseDown('task-2', {
      button: 0,
      clientX: 50,
      clientY: 100,
      target: row2,
      currentTarget: row2
    });

    vi.advanceTimersByTime(250);
    expect(row2.classList.contains('dragging')).toBe(true);

    // Mover sobre task-1 (posición imposible)
    document.elementFromPoint = vi.fn(() => row1);
    tView.handleTriageTouchMove({
      clientX: 50,
      clientY: 30,
      cancelable: true,
      preventDefault: vi.fn()
    });

    expect(row1.classList.contains('drag-forbidden')).toBe(true);
    expect(row1.classList.contains('drag-over')).toBe(false);

    tView.handleTriageTouchEnd({ cancelable: true, preventDefault: vi.fn() });
  });
});

describe('Reordenación por mouse long-press en el tablero principal', () => {
  let state;
  let tasksView;
  let container;
  let reorderSpy;

  beforeEach(() => {
    _resetTouchDragState();
    document.body.innerHTML = `<div id="tasksList"></div>`;
    container = document.getElementById('tasksList');

    state = defaultState();
    state.selectedDate = getTodayStr();
    state.tasks = [
      { id: 'task-1', title: 'Primera tarea', planned: 30, urgency: 'today', order: 1, manualOrder: 1, status: 'pending' },
      { id: 'task-2', title: 'Segunda tarea', planned: 45, urgency: 'today', order: 2, manualOrder: 2, status: 'pending' }
    ];

    reorderSpy = vi.fn();
    const ctx = {
      getState: () => state,
      getTaskEdit: () => null,
      getTaskSearchQuery: () => '',
      countPendingAutoMoveTasks: vi.fn(() => 0),
      renderAll: vi.fn(),
      smartRender: vi.fn(),
      actionsModule: { reorderTaskByDrag: reorderSpy }
    };

    tasksView = TodayTasksTasksView(ctx);
  });

  it('permite reordenar tareas en el tablero manteniendo pulsado el ratón (mouse long-press)', () => {
    vi.useFakeTimers();
    tasksView.renderTasks(null);

    const row1 = container.querySelector('.task-item[data-task-id="task-1"]');
    const row2 = container.querySelector('.task-item[data-task-id="task-2"]');

    // Iniciar pulsación sostenida con ratón en task-1
    tasksView.handleTaskMouseDown('task-1', {
      button: 0,
      clientX: 50,
      clientY: 50,
      target: row1,
      currentTarget: row1
    });

    // Esperar 250ms de mouseHoldDelay
    vi.advanceTimersByTime(250);
    expect(row1.classList.contains('dragging')).toBe(true);

    // Mover ratón sobre row2
    document.elementFromPoint = vi.fn(() => row2);
    tasksView.handleTaskTouchMove({
      clientX: 50,
      clientY: 100,
      cancelable: true,
      preventDefault: vi.fn()
    });

    // Soltar ratón
    tasksView.handleTaskTouchEnd({
      cancelable: true,
      preventDefault: vi.fn()
    });

    expect(reorderSpy).toHaveBeenCalledWith('task-1', 'task-2', null);
    expect(wasRecentTouchDrag()).toBe(true);

    vi.advanceTimersByTime(401);
    expect(wasRecentTouchDrag()).toBe(false);
  });

  it('aplica la clase drag-forbidden (rallas rojas) al arrastrar con ratón sobre una posición no permitida por dependencias en el tablero', async () => {
    vi.useFakeTimers();
    const { TodayTasksDragDrop } = await import('../js/actions/dragdrop.js');
    state.tasks = [
      { id: 'task-1', title: 'Task 1 (Base)', urgency: 'today', status: 'pending', order: 1, manualOrder: 1 },
      { id: 'task-2', title: 'Task 2 (Depende de 1)', urgency: 'today', status: 'pending', order: 2, manualOrder: 2, dependsOn: ['task-1'] }
    ];
    const dragDrop = TodayTasksDragDrop({ getState: () => state, saveState: vi.fn(), renderAll: vi.fn() });
    const ctxWithCheck = {
      getState: () => state,
      getTaskEdit: () => null,
      getTaskSearchQuery: () => '',
      countPendingAutoMoveTasks: vi.fn(() => 0),
      renderAll: vi.fn(),
      smartRender: vi.fn(),
      actionsModule: dragDrop
    };
    const view = TodayTasksTasksView(ctxWithCheck);
    view.renderTasks(null);

    const row1 = container.querySelector('.task-item[data-task-id="task-1"]');
    const row2 = container.querySelector('.task-item[data-task-id="task-2"]');

    // Iniciar arrastre con ratón en task-2 (que depende de task-1)
    view.handleTaskMouseDown('task-2', {
      button: 0,
      clientX: 50,
      clientY: 100,
      target: row2,
      currentTarget: row2
    });

    vi.advanceTimersByTime(250);
    expect(row2.classList.contains('dragging')).toBe(true);

    // Mover sobre task-1 (posición imposible porque task-2 no puede ir antes de task-1)
    document.elementFromPoint = vi.fn(() => row1);
    view.handleTaskTouchMove({
      clientX: 50,
      clientY: 30,
      cancelable: true,
      preventDefault: vi.fn()
    });

    expect(row1.classList.contains('drag-forbidden')).toBe(true);
    expect(row1.classList.contains('drag-over')).toBe(false);

    view.handleTaskTouchEnd({ cancelable: true, preventDefault: vi.fn() });
  });
});
