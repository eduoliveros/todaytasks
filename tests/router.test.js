import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TodayTasksRouter } from '../js/router.js';

describe('SPA Router (js/router.js)', () => {
  let ctx;
  let routerInstance;
  let mockState;

  beforeEach(() => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <div id="view-main"></div>
      <div id="view-task" style="display: none;"></div>
      <div id="view-interruption" style="display: none;"></div>
      <div id="view-history" style="display: none;"></div>
    `;

    mockState = {
      activeInterruption: null,
      activeEnv: 'work',
      environments: {
        work: { history: [], days: {} },
        personal: { history: [], days: {} }
      }
    };

    ctx = {
      getState: () => mockState,
      renderInterruptionView: vi.fn(),
      renderTaskFocusView: vi.fn(),
      renderAll: vi.fn(),
      resetBoardScroll: vi.fn()
    };

    routerInstance = TodayTasksRouter(ctx);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = '';
  });

  it('defaults to main view and renders main elements', () => {
    routerInstance.showView('main');
    expect(routerInstance.getCurrentView()).toBe('main');
    expect(routerInstance.getFocusTaskId()).toBeNull();

    expect(document.getElementById('view-main').style.display).toBe('');
    expect(document.getElementById('view-task').style.display).toBe('none');
    expect(document.getElementById('view-interruption').style.display).toBe('none');
    expect(document.getElementById('view-history').style.display).toBe('none');
    expect(ctx.renderAll).toHaveBeenCalled();
  });

  it('switches to task focus view with string or numeric taskId', () => {
    routerInstance.showView('task', 'uuid-1234');
    expect(routerInstance.getCurrentView()).toBe('task');
    expect(routerInstance.getFocusTaskId()).toBe('uuid-1234');

    expect(document.getElementById('view-task').style.display).toBe('flex');
    expect(document.getElementById('view-main').style.display).toBe('none');
    expect(ctx.renderTaskFocusView).toHaveBeenCalled();

    // Fast-forward 10s to verify focus view refresh interval
    vi.advanceTimersByTime(10000);
    expect(ctx.renderTaskFocusView).toHaveBeenCalledTimes(2);
  });

  it('switches to interruption view and periodically refreshes', () => {
    routerInstance.showView('interruption');
    expect(routerInstance.getCurrentView()).toBe('interruption');

    expect(document.getElementById('view-interruption').style.display).toBe('flex');
    expect(document.getElementById('view-main').style.display).toBe('none');
    expect(ctx.renderInterruptionView).toHaveBeenCalled();

    // Advance 1s interval for interruption timer
    vi.advanceTimersByTime(1000);
    expect(ctx.renderInterruptionView).toHaveBeenCalledTimes(2);
  });

  it('switches to history view and displays history container', () => {
    routerInstance.showView('history');
    expect(routerInstance.getCurrentView()).toBe('history');

    expect(document.getElementById('view-history').style.display).toBe('block');
    expect(document.getElementById('view-main').style.display).toBe('none');
  });

  it('locks router to interruption view when activeInterruption exists', () => {
    mockState.activeInterruption = { id: 'int_1', start: 600 };
    window.location.hash = '#/task/5';

    routerInstance.router();
    expect(window.location.hash).toBe('#/interruption');
  });

  it('routes correctly based on hash changes', () => {
    // Hash: #/history
    window.location.hash = '#/history';
    routerInstance.router();
    expect(routerInstance.getCurrentView()).toBe('history');

    // Hash: #/task/42
    window.location.hash = '#/task/42';
    routerInstance.router();
    expect(routerInstance.getCurrentView()).toBe('task');
    expect(routerInstance.getFocusTaskId()).toBe(42);

    // Hash: #/task/task-uuid-abc
    window.location.hash = '#/task/task-uuid-abc';
    routerInstance.router();
    expect(routerInstance.getCurrentView()).toBe('task');
    expect(routerInstance.getFocusTaskId()).toBe('task-uuid-abc');

    // Hash: #/ (root)
    window.location.hash = '#/';
    routerInstance.router();
    expect(routerInstance.getCurrentView()).toBe('main');
  });
});
