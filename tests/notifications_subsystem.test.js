import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TodayTasksNotifications } from '../js/notifications.js';
import { getTodayStr } from '../js/utils.js';

describe('Notifications Subsystem (js/notifications.js)', () => {
  let state;
  let notifyState;
  let notifInstance;
  let ctx;
  let mockNotificationConstructor;

  beforeEach(() => {
    vi.useFakeTimers();

    const todayStr = getTodayStr();

    state = {
      notifyEnabled: true,
      notifyIntervalMin: 10,
      activeEnv: 'work',
      tasks: [
        { id: 'task-1', title: 'Coding feature', status: 'running', runningStart: 600, planned: 30, elapsedBefore: 0 }
      ],
      environments: {
        work: {
          days: {
            [todayStr]: {
              meetings: [
                { id: 'm-1', title: 'Daily Standup', start: 630, end: 660 }
              ],
              tasks: []
            }
          },
          recurringMeetings: []
        }
      }
    };

    notifyState = { taskId: 'task-1', lastNotifiedAt: 600, timeEndNotified: false };

    mockNotificationConstructor = vi.fn();
    global.Notification = mockNotificationConstructor;
    global.Notification.permission = 'granted';

    ctx = {
      getState: () => state,
      getNotifyState: () => notifyState,
      setNotifyState: vi.fn(ns => { notifyState = ns; }),
      pauseTask: vi.fn(),
      saveState: vi.fn(),
      nowMinutes: vi.fn(() => 600),
      fmt: (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`,
      fmtRemaining: (end, now) => ({ text: `${end - now} min`, overrun: now > end }),
      showToast: vi.fn()
    };

    notifInstance = TodayTasksNotifications(ctx);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates notification button label based on permission', () => {
    document.body.innerHTML = '<button id="notifyBtn"></button>';

    notifInstance.refreshNotifyBtn();
    const btn = document.getElementById('notifyBtn');
    expect(btn.textContent).toContain('activados');

    state.notifyEnabled = false;
    notifInstance.refreshNotifyBtn();
    expect(btn.textContent).toContain('desactivados');
  });

  it('sends planned end notification when task finishes scheduled time', () => {
    // Current time is at planned end: 600 + 30 = 630
    ctx.nowMinutes.mockReturnValue(630);

    notifInstance.checkRunningTaskNotification();

    expect(mockNotificationConstructor).toHaveBeenCalled();
    const [title, options] = mockNotificationConstructor.mock.calls[0];
    expect(title).toContain('Tiempo planificado completado');
    expect(options.body).toContain('Coding feature');
    expect(notifyState.timeEndNotified).toBe(true);
  });

  it('sends periodic notifications based on configured interval', () => {
    notifyState.timeEndNotified = true;
    notifyState.lastNotifiedAt = 630;

    // Advance 10 minutes (to 640)
    ctx.nowMinutes.mockReturnValue(640);
    notifInstance.checkRunningTaskNotification();

    expect(mockNotificationConstructor).toHaveBeenCalled();
    const [title] = mockNotificationConstructor.mock.calls[0];
    expect(title).toBe('Coding feature');
    expect(notifyState.lastNotifiedAt).toBe(640);
  });

  it('notifies 2 minutes prior to meeting start', () => {
    // Meeting starts at 630 -> 2 minutes before is 628
    ctx.nowMinutes.mockReturnValue(628);

    notifInstance.checkMeetingNotifications();

    expect(mockNotificationConstructor).toHaveBeenCalled();
    const [title, options] = mockNotificationConstructor.mock.calls[0];
    expect(title).toContain('Reunión en 2 min: Daily Standup');
    expect(options.body).toContain('Empieza a las 10:30');
  });

  it('notifies at meeting exact start and automatically pauses the active running task', () => {
    // Meeting starts at 630
    ctx.nowMinutes.mockReturnValue(630);

    notifInstance.checkMeetingNotifications();

    expect(mockNotificationConstructor).toHaveBeenCalled();
    const [title] = mockNotificationConstructor.mock.calls[0];
    expect(title).toContain('Reunión ahora: Daily Standup');
    expect(ctx.pauseTask).toHaveBeenCalledWith('task-1');
    expect(ctx.showToast).toHaveBeenCalledWith(expect.stringContaining('se ha pausado automáticamente'));
  });

  it('localiza las notificaciones de tareas y reuniones al inglés cuando el idioma activo es en', async () => {
    const { setLocale } = await import('../js/i18n.js');
    setLocale('en');

    document.body.innerHTML = '<button id="notifyBtn"></button>';
    notifInstance.refreshNotifyBtn();
    const btn = document.getElementById('notifyBtn');
    expect(btn.textContent).toContain('enabled');

    // Notificación de fin de tarea
    ctx.nowMinutes.mockReturnValue(630);
    notifInstance.checkRunningTaskNotification();
    expect(mockNotificationConstructor).toHaveBeenCalled();
    const [taskTitle, taskOptions] = mockNotificationConstructor.mock.calls[0];
    expect(taskTitle).toContain('Planned time completed');
    expect(taskOptions.body).toContain('Task "Coding feature" has reached its planned time');

    // Notificación de reunión inminente
    mockNotificationConstructor.mockClear();
    ctx.nowMinutes.mockReturnValue(628);
    notifInstance.checkMeetingNotifications();
    const [meetingTitle, meetingOptions] = mockNotificationConstructor.mock.calls[0];
    expect(meetingTitle).toContain('Meeting in 2 min: Daily Standup');
    expect(meetingOptions.body).toContain('Starts at 10:30');

    // Restaurar a español
    setLocale('es');
  });
});
