import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { TodayTasksShortcuts } from '../js/app/shortcuts.js';
import { getTodayStr } from '../js/utils.js';

describe('Atajo de teclado "D" (Tiempo y fecha de Hoy)', () => {
  let actions;
  let state;

  beforeEach(async () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    document.documentElement.innerHTML = html;

    window.alert = vi.fn();

    state = defaultState();
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

    actions = TodayTasksActions(ctx);
  });

  it('actions.resetToToday() establece selectedDate al día actual', () => {
    const today = getTodayStr();
    expect(state.selectedDate).not.toBe(today);

    actions.resetToToday();

    expect(state.selectedDate).toBe(today);
  });

  it('al pulsar la tecla "d", cambia al panel Tiempo y restablece la fecha a hoy', async () => {
    await import('../js/app.js');

    const today = getTodayStr();

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

    const today = getTodayStr();
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

  it('al pulsar Ctrl+Z o Cmd+Z ejecuta deshacer (Undo)', () => {
    const mockUndoModule = { undo: vi.fn(), redo: vi.fn() };
    TodayTasksShortcuts({
      getState: () => state,
      undoModule: mockUndoModule
    });

    const eventCtrlZ = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true });
    window.dispatchEvent(eventCtrlZ);

    expect(mockUndoModule.undo).toHaveBeenCalled();
  });

  it('al pulsar Ctrl+Y o Cmd+Shift+Z ejecuta rehacer (Redo)', () => {
    const mockUndoModule = { undo: vi.fn(), redo: vi.fn() };
    TodayTasksShortcuts({
      getState: () => state,
      undoModule: mockUndoModule
    });

    const eventCtrlY = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true });
    window.dispatchEvent(eventCtrlY);

    expect(mockUndoModule.redo).toHaveBeenCalled();
  });

  it('al pulsar "r", "R", "m" o "M", enfoca el campo de título de reunión (#meetingTitle)', async () => {
    vi.useFakeTimers();
    await import('../js/app.js');
    const meetingTitleInput = document.getElementById('meetingTitle');
    const focusSpy = vi.spyOn(meetingTitleInput, 'focus');

    // Probar 'r'
    meetingTitleInput.blur();
    focusSpy.mockClear();
    const eventR = new KeyboardEvent('keydown', { key: 'r', bubbles: true });
    window.dispatchEvent(eventR);
    vi.advanceTimersByTime(100);
    expect(focusSpy).toHaveBeenCalled();

    // Probar 'm'
    meetingTitleInput.blur();
    focusSpy.mockClear();
    const eventM = new KeyboardEvent('keydown', { key: 'm', bubbles: true });
    window.dispatchEvent(eventM);
    vi.advanceTimersByTime(100);
    expect(focusSpy).toHaveBeenCalled();

    // Probar 'M'
    meetingTitleInput.blur();
    focusSpy.mockClear();
    const eventUpperM = new KeyboardEvent('keydown', { key: 'M', bubbles: true });
    window.dispatchEvent(eventUpperM);
    vi.advanceTimersByTime(100);
    expect(focusSpy).toHaveBeenCalled();

    focusSpy.mockRestore();
    vi.useRealTimers();
  });

  it('no activa el atajo "m" o "r" si el foco está en un campo de texto', async () => {
    vi.useFakeTimers();
    await import('../js/app.js');
    const taskInput = document.getElementById('taskTitle');
    taskInput.focus();

    const meetingTitleInput = document.getElementById('meetingTitle');
    const focusSpy = vi.spyOn(meetingTitleInput, 'focus');

    const eventM = new KeyboardEvent('keydown', { key: 'm', bubbles: true });
    window.dispatchEvent(eventM);
    vi.advanceTimersByTime(100);

    expect(focusSpy).not.toHaveBeenCalled();
    focusSpy.mockRestore();
    vi.useRealTimers();
  });
});
