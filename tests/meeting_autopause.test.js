import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksNotifications } from '../js/notifications.js';
import { TodayTasksActions } from '../js/actions.js';

describe('Auto-pausa de tareas activas al iniciar reuniones', () => {
  let state;
  let actions;
  let notifyModule;
  let notifyState;
  let currentMinutes = 540; // 09:00 por defecto
  let toasts = [];

  beforeEach(() => {
    state = defaultState();
    notifyState = { taskId: null, lastNotifiedAt: null, timeEndNotified: false };
    currentMinutes = 540;
    toasts = [];

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => null,
      setTaskEdit: () => {},
      getNotifyState: () => notifyState,
      setNotifyState: (v) => { notifyState = v; },
      saveState: () => {},
      newId: () => Math.floor(Math.random() * 1000000),
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {}
    };

    actions = TodayTasksActions(ctx);

    notifyModule = TodayTasksNotifications({
      getState: () => state,
      getNotifyState: () => notifyState,
      setNotifyState: (v) => { notifyState = v; },
      pauseTask: (id) => actions.pauseTask(id),
      saveState: () => {},
      nowMinutes: () => currentMinutes,
      fmt: (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`,
      fmtRemaining: () => ({ text: '', overrun: false }),
      showToast: (msg) => { toasts.push(msg); }
    });
  });

  it('pausa automáticamente la tarea activa cuando comienza una reunión puntual', () => {
    // 09:30 (570 min): se añade tarea y se pone en marcha
    actions.addTask('Desarrollo Backend', '60');
    const taskId = state.tasks[0].id;
    currentMinutes = 570; // 09:30
    actions.startTask(taskId);
    expect(state.tasks[0].status).toBe('running');

    // Se programa una reunión de 10:00 a 10:30 (600 a 630 min)
    actions.addMeeting('Reunión de Equipo', '10:00', '10:30');

    // A las 09:59 (599 min): la tarea sigue en marcha
    currentMinutes = 599;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks[0].status).toBe('running');

    // A las 10:00 (600 min): la reunión empieza -> la tarea debe pausarse automáticamente
    currentMinutes = 600;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks[0].status).toBe('paused');
    expect(toasts.some(t => t.includes('Reunión') && t.includes('pausado'))).toBe(true);
  });

  it('pausa automáticamente la tarea activa cuando comienza una reunión recurrente', () => {
    actions.addTask('Escribir Tests', '45');
    const taskId = state.tasks[0].id;
    currentMinutes = 650; // 10:50
    actions.startTask(taskId);
    expect(state.tasks[0].status).toBe('running');

    // Reunión recurrente diaria de 11:00 a 11:30 (660 a 690 min)
    actions.addMeeting('Daily Standup', '11:00', '11:30', {
      isRecurring: true,
      freq: 'daily',
      interval: 1
    });

    // A las 11:00 (660 min)
    currentMinutes = 660;
    notifyModule.checkMeetingNotifications();

    expect(state.tasks[0].status).toBe('paused');
    expect(toasts.some(t => t.includes('Daily Standup') || t.includes('pausado'))).toBe(true);
  });

  it('permite al usuario reanudar manualmente la tarea durante la reunión sin volver a pausarla en los siguientes ticks', () => {
    actions.addTask('Tarea Urgente', '30');
    const taskId = state.tasks[0].id;
    actions.addMeeting('Sincro 10:00-10:30', '10:00', '10:30');

    // 09:50: Iniciar tarea
    currentMinutes = 590;
    actions.startTask(taskId);

    // 10:00: Empieza reunión -> auto-pausa
    currentMinutes = 600;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks[0].status).toBe('paused');

    // 10:05: El usuario decide expresamente reanudar la tarea durante la reunión
    currentMinutes = 605;
    actions.resumeTask(taskId);
    expect(state.tasks[0].status).toBe('running');

    // 10:06, 10:10, 10:20: Comprobaciones posteriores durante la misma reunión -> NO se vuelve a pausar
    currentMinutes = 606;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks[0].status).toBe('running');

    currentMinutes = 620;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks[0].status).toBe('running');
  });

  it('cuando termina la reunión, la tarea NO se reactiva automáticamente', () => {
    actions.addTask('Tarea A', '60');
    const taskId = state.tasks[0].id;
    actions.addMeeting('Reunión Corta', '10:00', '10:15');

    // 09:55: Tarea en marcha
    currentMinutes = 595;
    actions.startTask(taskId);

    // 10:00: Se pausa al empezar la reunión
    currentMinutes = 600;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks[0].status).toBe('paused');

    // 10:15: Termina la reunión
    currentMinutes = 615;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks[0].status).toBe('paused'); // Sigue en pausa

    // 10:30: Ha pasado tiempo tras la reunión
    currentMinutes = 630;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks[0].status).toBe('paused'); // Sigue en pausa sin reactivarse
  });

  it('gestiona reuniones consecutivas (back-to-back) pausando las tareas activas al inicio de cada reunión', () => {
    actions.addTask('Tarea Primera', '60');
    actions.addTask('Tarea Segunda', '60');
    const task1 = state.tasks[0].id;
    const task2 = state.tasks[1].id;

    // Reunión 1: 10:00 - 10:30, Reunión 2: 10:30 - 11:00
    actions.addMeeting('Reunión 1', '10:00', '10:30');
    actions.addMeeting('Reunión 2', '10:30', '11:00');

    // 09:50: Iniciar Tarea 1
    currentMinutes = 590;
    actions.startTask(task1);

    // 10:00: Reunión 1 empieza -> Tarea 1 se pausa
    currentMinutes = 600;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks.find(t => t.id === task1).status).toBe('paused');

    // 10:15: Usuario reanuda Tarea 2 en medio de la Reunión 1
    currentMinutes = 615;
    actions.startTask(task2);
    expect(state.tasks.find(t => t.id === task2).status).toBe('running');

    // 10:30: Reunión 2 empieza -> Tarea 2 se pausa automáticamente
    currentMinutes = 630;
    notifyModule.checkMeetingNotifications();
    expect(state.tasks.find(t => t.id === task2).status).toBe('paused');
  });

  it('no produce errores si no hay ninguna tarea en marcha al comenzar una reunión', () => {
    actions.addMeeting('Reunión Libre', '12:00', '12:30');
    currentMinutes = 720; // 12:00
    expect(() => {
      notifyModule.checkMeetingNotifications();
    }).not.toThrow();
  });
});
