import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Atajo de teclado "D" (Tiempo y fecha de Hoy)', () => {
  let actions;
  let state;

  beforeEach(async () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    document.documentElement.innerHTML = html;

    window.TodayTasksConfig = { storageKey: 'todaytasks_test' };
    window.TodayTasksUi = {
      showToast: vi.fn(),
      renderAll: vi.fn(),
      refreshPlanningModeBtn: vi.fn(),
      escapeHtml: s => s,
      escapeAttr: s => s
    };
    window.alert = vi.fn();

    await import('../js/config.js');
    await import('../js/utils.js');
    await import('../js/history.js');
    await import('../js/state.js');
    await import('../js/scheduler.js');
    await import('../js/ui.js');
    await import('../js/notifications.js');
    await import('../js/actions/meetings.js');
    await import('../js/actions/tasks.js');
    await import('../js/actions/dragdrop.js');
    await import('../js/actions/execution.js');
    await import('../js/actions/calendar.js');
    await import('../js/actions.js');
    await import('../js/views/dashboard.js');
    await import('../js/views/meetings.js');
    await import('../js/views/tasks.js');
    await import('../js/views/board.js');
    await import('../js/views/focus.js');
    await import('../js/views.js');
    await import('../js/cloud.js');
    await import('../js/router.js');
    await import('../js/app/weekly-schedule.js');
    await import('../js/app/forms.js');
    await import('../js/app/shortcuts.js');

    state = window.TodayTasksState.defaultState();
    state.selectedDate = '2025-01-01';

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => null,
      setTaskEdit: () => {},
      setNotifyState: () => {},
      getNotifyState: () => ({ taskId: null }),
      saveState: () => {},
      newId: () => 1,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {}
    };

    actions = window.TodayTasksActions(ctx);
  });

  it('actions.resetToToday() establece selectedDate al día actual', () => {
    const today = window.TodayTasksUtils.getTodayStr();
    expect(state.selectedDate).not.toBe(today);

    actions.resetToToday();

    expect(state.selectedDate).toBe(today);
  });

  it('al pulsar la tecla "d", cambia al panel Tiempo y restablece la fecha a hoy', async () => {
    await import('../js/app.js');

    const today = window.TodayTasksUtils.getTodayStr();

    // Cambiar la fecha a un día del pasado a través de window.app
    window.app.selectDate('2025-01-01');
    const datePicker = document.getElementById('datePickerInput');
    expect(datePicker.value).toBe('2025-01-01');

    const tabEntorno = document.querySelector('.header-tab[data-tab="entorno"]');
    const tabTiempo = document.querySelector('.header-tab[data-tab="tiempo"]');
    const panelTiempo = document.getElementById('htab-tiempo');

    // Cambiar primero la pestaña a "entorno"
    tabEntorno.click();
    expect(tabEntorno.classList.contains('active')).toBe(true);

    const event = new KeyboardEvent('keydown', { key: 'd', bubbles: true });
    window.dispatchEvent(event);

    expect(tabTiempo.classList.contains('active')).toBe(true);
    expect(panelTiempo.classList.contains('active')).toBe(true);
    expect(tabEntorno.classList.contains('active')).toBe(false);
    expect(datePicker.value).toBe(today);
  });

  it('al pulsar "D" (mayúscula), también cambia al panel Tiempo y fecha de hoy', async () => {
    await import('../js/app.js');

    const today = window.TodayTasksUtils.getTodayStr();
    window.app.selectDate('2025-01-01');

    const datePicker = document.getElementById('datePickerInput');
    const tabTiempo = document.querySelector('.header-tab[data-tab="tiempo"]');
    const panelTiempo = document.getElementById('htab-tiempo');

    const event = new KeyboardEvent('keydown', { key: 'D', bubbles: true });
    window.dispatchEvent(event);

    expect(tabTiempo.classList.contains('active')).toBe(true);
    expect(panelTiempo.classList.contains('active')).toBe(true);
    expect(datePicker.value).toBe(today);
  });

  it('no activa el atajo "d" si el foco está en un input', async () => {
    await import('../js/app.js');
    window.app.selectDate('2025-01-01');
    const datePicker = document.getElementById('datePickerInput');

    const input = document.getElementById('taskTitle');
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 'd', bubbles: true });
    window.dispatchEvent(event);

    expect(datePicker.value).toBe('2025-01-01');
  });

  it('al pulsar "p" o "P", alterna el modo de planificación', async () => {
    await import('../js/app.js');
    const planningBtn = document.getElementById('planningModeBtn');
    const initialActive = planningBtn.classList.contains('active');

    const eventP = new KeyboardEvent('keydown', { key: 'p', bubbles: true });
    window.dispatchEvent(eventP);
    expect(planningBtn.classList.contains('active')).toBe(!initialActive);

    const eventShiftP = new KeyboardEvent('keydown', { key: 'P', bubbles: true });
    window.dispatchEvent(eventShiftP);
    expect(planningBtn.classList.contains('active')).toBe(initialActive);
  });

  it('no activa el atajo "p" si el foco está en un input', async () => {
    await import('../js/app.js');
    const planningBtn = document.getElementById('planningModeBtn');
    const initialActive = planningBtn.classList.contains('active');

    const input = document.getElementById('taskTitle');
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true });
    window.dispatchEvent(event);

    expect(planningBtn.classList.contains('active')).toBe(initialActive);
  });
});
