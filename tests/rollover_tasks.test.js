import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { getTodayStr, addDays } from '../js/utils.js';

describe('TodayTasksActions - Auto-mover tareas pendientes a Hoy (Rollover)', () => {
  let actions;
  let state;
  let taskEdit = null;
  let notifyState = { taskId: null };
  let idCounter = 1;

  beforeEach(() => {
    window.alert = vi.fn();

    state = defaultState();
    idCounter = 1;
    taskEdit = null;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => taskEdit,
      setTaskEdit: (t) => { taskEdit = t; },
      setNotifyState: (n) => { notifyState = n; },
      getNotifyState: () => notifyState,
      saveState: vi.fn(),
      newId: () => idCounter++,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      renderAll: vi.fn(),
      smartRender: vi.fn()
    };

    actions = TodayTasksActions(ctx);
  });

  it('crea una tarea con autoMoveToToday = true cuando se marca la opción', () => {
    actions.addTask('Revisar presupuestos', '45', false, null, true);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].title).toBe('Revisar presupuestos');
    expect(state.tasks[0].autoMoveToToday).toBe(true);
  });

  it('crea una tarea con autoMoveToToday = false/falsy por defecto', () => {
    actions.addTask('Revisar presupuestos', '45');
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].autoMoveToToday).toBeFalsy();
  });

  it('permite editar y alternar la propiedad autoMoveToToday en una tarea existente', () => {
    actions.addTask('Tarea puntual', '30', false, null, false);
    const taskId = state.tasks[0].id;
    expect(state.tasks[0].autoMoveToToday).toBeFalsy();

    actions.startEditTask(taskId);
    expect(taskEdit).toBeDefined();
    expect(taskEdit.autoMoveToToday).toBeFalsy();

    actions.updateTaskEditField('autoMoveToToday', true);
    actions.saveEditTask(taskId);

    expect(state.tasks[0].autoMoveToToday).toBe(true);
  });

  it('mueve automáticamente tareas pendientes de días pasados (< today) a Hoy', () => {
    const today = getTodayStr();
    const yesterday = addDays(today, -1);
    const envKey = state.activeEnv || 'work';
    const env = state.environments[envKey];

    // Crear tareas en el día de ayer
    env.days[yesterday] = {
      meetings: [],
      interruptions: [],
      planningMode: false,
      tasks: [
        {
          id: 101,
          title: 'Tarea no terminada con auto-mover',
          planned: 40,
          order: 1,
          status: 'pending',
          elapsedBefore: 15,
          runningStart: null,
          completedAt: null,
          actualDuration: null,
          autoMoveToToday: true
        },
        {
          id: 102,
          title: 'Tarea no terminada fija (sin auto-mover)',
          planned: 30,
          order: 2,
          status: 'pending',
          elapsedBefore: 0,
          runningStart: null,
          completedAt: null,
          actualDuration: null,
          autoMoveToToday: false
        },
        {
          id: 103,
          title: 'Tarea completada con auto-mover',
          planned: 20,
          order: 3,
          status: 'completed',
          elapsedBefore: 20,
          runningStart: null,
          completedAt: 600,
          actualDuration: 20,
          autoMoveToToday: true
        }
      ]
    };

    // Asegurar que hoy esté seleccionado
    state.selectedDate = today;

    const movedCount = actions.rolloverPendingTasks();

    expect(movedCount).toBe(1);

    // En hoy debe aparecer la tarea 101
    const todayTasks = env.days[today].tasks;
    expect(todayTasks.some(t => t.id === 101 && t.title === 'Tarea no terminada con auto-mover')).toBe(true);
    const movedTask = todayTasks.find(t => t.id === 101);
    expect(movedTask.elapsedBefore).toBe(15);
    expect(movedTask.autoMoveToToday).toBe(true);

    // En ayer NO debe estar la tarea 101, pero SÍ la 102 y la 103
    const yesterdayTasks = env.days[yesterday].tasks;
    expect(yesterdayTasks.some(t => t.id === 101)).toBe(false);
    expect(yesterdayTasks.some(t => t.id === 102)).toBe(true);
    expect(yesterdayTasks.some(t => t.id === 103)).toBe(true);
  });

  it('NO mueve tareas a días futuros si el usuario navega a un día futuro (> today)', () => {
    const today = getTodayStr();
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);
    const envKey = state.activeEnv || 'work';
    const env = state.environments[envKey];

    env.days[yesterday] = {
      meetings: [],
      interruptions: [],
      planningMode: false,
      tasks: [
        {
          id: 201,
          title: 'Tarea de ayer',
          planned: 30,
          order: 1,
          status: 'pending',
          elapsedBefore: 0,
          autoMoveToToday: true
        }
      ]
    };

    // Si seleccionamos mañana, rolloverPendingTasks sólo traslada a today, nunca a tomorrow
    state.selectedDate = tomorrow;
    actions.rolloverPendingTasks();

    // En tomorrow no debe haber nada
    const tomorrowTasks = (env.days[tomorrow] && env.days[tomorrow].tasks) || [];
    expect(tomorrowTasks.some(t => t.id === 201)).toBe(false);

    // La tarea se mueve a today
    const todayTasks = (env.days[today] && env.days[today].tasks) || [];
    expect(todayTasks.some(t => t.id === 201)).toBe(true);
  });

  it('NO mueve tareas programadas en días futuros hacia hoy', () => {
    const today = getTodayStr();
    const tomorrow = addDays(today, 1);
    const envKey = state.activeEnv || 'work';
    const env = state.environments[envKey];

    env.days[tomorrow] = {
      meetings: [],
      interruptions: [],
      planningMode: false,
      tasks: [
        {
          id: 301,
          title: 'Tarea futura',
          planned: 30,
          order: 1,
          status: 'pending',
          elapsedBefore: 0,
          autoMoveToToday: true
        }
      ]
    };

    state.selectedDate = today;
    actions.rolloverPendingTasks();

    // En today no debe haberse traído la tarea de tomorrow
    const todayTasks = env.days[today].tasks;
    expect(todayTasks.some(t => t.id === 301)).toBe(false);

    // En tomorrow sigue intacta
    expect(env.days[tomorrow].tasks.some(t => t.id === 301)).toBe(true);
  });

  it('countPendingAutoMoveTasks cuenta correctamente tareas no completadas con autoMoveToToday de días anteriores a targetDate', () => {
    const today = getTodayStr();
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);
    const envKey = state.activeEnv || 'work';
    const env = state.environments[envKey];

    env.days[yesterday] = {
      meetings: [],
      interruptions: [],
      planningMode: false,
      tasks: [
        { id: 401, title: 'T1', planned: 20, status: 'pending', autoMoveToToday: true },
        { id: 402, title: 'T2', planned: 30, status: 'completed', autoMoveToToday: true },
        { id: 403, title: 'T3', planned: 40, status: 'pending', autoMoveToToday: false }
      ]
    };

    env.days[today] = {
      meetings: [],
      interruptions: [],
      planningMode: false,
      tasks: [
        { id: 404, title: 'T4', planned: 15, status: 'pending', autoMoveToToday: true }
      ]
    };

    // Para today, solo cuenta las de yesterday (1 tarea: 401)
    expect(actions.countPendingAutoMoveTasks(today)).toBe(1);

    // Para tomorrow, cuenta las de yesterday y today (2 tareas: 401 y 404)
    expect(actions.countPendingAutoMoveTasks(tomorrow)).toBe(2);
  });

  it('rolloverPendingTasksToDate traslada las tareas automáticas pendientes de días anteriores al día futuro especificado', () => {
    const today = getTodayStr();
    const yesterday = addDays(today, -1);
    const mondayFuture = addDays(today, 2);
    const envKey = state.activeEnv || 'work';
    const env = state.environments[envKey];

    env.days[yesterday] = {
      meetings: [],
      interruptions: [],
      planningMode: false,
      tasks: [
        { id: 501, title: 'Tarea de ayer con auto-mover', planned: 50, elapsedBefore: 20, status: 'paused', autoMoveToToday: true }
      ]
    };

    env.days[today] = {
      meetings: [],
      interruptions: [],
      planningMode: false,
      tasks: [
        { id: 502, title: 'Tarea de hoy con auto-mover', planned: 30, elapsedBefore: 0, status: 'pending', autoMoveToToday: true }
      ]
    };

    const moved = actions.rolloverPendingTasksToDate(mondayFuture);
    expect(moved).toBe(2);

    expect(env.days[yesterday].tasks.some(t => t.id === 501)).toBe(false);
    expect(env.days[today].tasks.some(t => t.id === 502)).toBe(false);

    const mondayTasks = env.days[mondayFuture].tasks;
    expect(mondayTasks).toHaveLength(2);
    expect(mondayTasks.find(t => t.id === 501)).toMatchObject({
      title: 'Tarea de ayer con auto-mover',
      elapsedBefore: 20,
      status: 'paused',
      autoMoveToToday: true
    });
    expect(mondayTasks.find(t => t.id === 502)).toMatchObject({
      title: 'Tarea de hoy con auto-mover',
      elapsedBefore: 0,
      status: 'pending',
      autoMoveToToday: true
    });
  });
});

