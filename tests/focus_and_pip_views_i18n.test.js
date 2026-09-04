import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultState, wrapState } from '../js/state.js';
import { TodayTasksFocusView } from '../js/views/focus.js';
import { TodayTasksPiP } from '../js/pip.js';
import { setLocale } from '../js/i18n.js';

describe('Focus View & PiP Mini-Widget - Internacionalización (i18n)', () => {
  let state;
  let focusView;
  let pip;
  let mockPipWindow;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-task"></div>
      <div id="view-interruption"></div>
    `;
    setLocale('es');
    state = wrapState(defaultState());

    focusView = TodayTasksFocusView({
      getState: () => state,
      getCurrentView: () => 'task',
      getFocusTaskId: () => 'task-1',
      fmtMMSS: () => '01:23',
      RING_R: 85,
      RING_C: 534.07,
      nowMinutes: () => 600
    });

    const pipDocument = document.implementation.createHTMLDocument('PiP Doc');
    mockPipWindow = {
      document: pipDocument,
      closed: false,
      focus: vi.fn(),
      close: vi.fn(() => {
        mockPipWindow.closed = true;
        mockPipWindow._listeners.pagehide?.forEach(cb => cb());
      }),
      _listeners: {},
      addEventListener: vi.fn((event, cb) => {
        if (!mockPipWindow._listeners[event]) mockPipWindow._listeners[event] = [];
        mockPipWindow._listeners[event].push(cb);
      }),
      removeEventListener: vi.fn()
    };

    window.documentPictureInPicture = {
      requestWindow: vi.fn().mockResolvedValue(mockPipWindow)
    };

    pip = TodayTasksPiP({
      getState: () => state,
      saveState: vi.fn(),
      actionsModule: {},
      showToast: vi.fn(),
      renderAll: vi.fn(),
      fmtMMSS: () => '01:23'
    });
  });

  afterEach(() => {
    delete window.documentPictureInPicture;
  });

  it('renderTaskFocusView renderiza controles, metadatos y etiquetas bilingües', () => {
    state.tasks = [
      { id: 'task-1', title: 'Deep Work Session', status: 'running', planned: 50, elapsedBefore: 10, runningStart: 590 }
    ];

    focusView.renderTaskFocusView();
    const taskContainer = document.getElementById('view-task');
    expect(taskContainer.textContent).toContain('← Volver al tablero');
    expect(taskContainer.textContent).toContain('Mini-Widget [W]');
    expect(taskContainer.textContent).toContain('Planificado');
    expect(taskContainer.textContent).toContain('Transcurrido');
    expect(taskContainer.textContent).toContain('Fin previsto');
    expect(taskContainer.textContent).toContain('⏸ Pausar');
    expect(taskContainer.textContent).toContain('✓ Completar');

    setLocale('en');
    focusView.renderTaskFocusView();
    expect(taskContainer.textContent).toContain('← Back to board');
    expect(taskContainer.textContent).toContain('Mini-Widget [W]');
    expect(taskContainer.textContent).toContain('Planned');
    expect(taskContainer.textContent).toContain('Elapsed');
    expect(taskContainer.textContent).toContain('Est. end');
    expect(taskContainer.textContent).toContain('⏸ Pause');
    expect(taskContainer.textContent).toContain('✓ Complete');
    setLocale('es');
  });

  it('renderInterruptionView renderiza tarjeta de interrupción en español e inglés', () => {
    state.activeInterruption = {
      id: 'int-1',
      title: 'Urgencia del cliente',
      start: 600,
      startEpoch: Date.now()
    };

    focusView.renderInterruptionView();
    const intContainer = document.getElementById('view-interruption');
    expect(intContainer.textContent).toContain('⚡ Interrupción en curso');
    expect(intContainer.textContent).toContain('Tiempo transcurrido');
    expect(intContainer.textContent).toContain('Iniciada a las');
    expect(intContainer.textContent).toContain('✓ Finalizar interrupción');
    expect(intContainer.textContent).toContain('✕ Cancelar (Esc)');

    setLocale('en');
    intContainer.innerHTML = ''; // reset so it re-renders
    focusView.renderInterruptionView();
    expect(intContainer.textContent).toContain('⚡ Active interruption');
    expect(intContainer.textContent).toContain('Elapsed time');
    expect(intContainer.textContent).toContain('Started at');
    expect(intContainer.textContent).toContain('✓ Finish interruption');
    expect(intContainer.textContent).toContain('✕ Cancel (Esc)');
    setLocale('es');
  });

  it('PiP renderiza estados y botones en español e inglés', async () => {
    state.tasks = [
      { id: 'task-1', title: 'Task in PiP', status: 'running', planned: 30, elapsedBefore: 0, runningStartEpoch: Date.now() }
    ];

    await pip.openPiP();
    const pipBody = mockPipWindow.document.body;
    expect(pipBody.textContent).toContain('En marcha');
    expect(pipBody.textContent).toContain('restante');
    expect(pipBody.textContent).toContain('Plan: 30 min');
    expect(pipBody.textContent).toContain('⏸ Pausar');
    expect(pipBody.textContent).toContain('✓ Listo');
    expect(pipBody.textContent).toContain('⚡ Interrumpir');

    setLocale('en');
    pip.render();
    expect(pipBody.textContent).toContain('Running');
    expect(pipBody.textContent).toContain('remaining');
    expect(pipBody.textContent).toContain('Plan: 30 min');
    expect(pipBody.textContent).toContain('⏸ Pause');
    expect(pipBody.textContent).toContain('✓ Done');
    expect(pipBody.textContent).toContain('⚡ Interrupt');
    setLocale('es');
  });

  it('PiP renderiza estado de reposo (idle) en español e inglés', async () => {
    state.tasks = [];
    await pip.openPiP();
    const pipBody = mockPipWindow.document.body;
    expect(pipBody.textContent).toContain('Sin tarea activa');
    expect(pipBody.textContent).toContain('✓ No hay tareas pendientes para hoy');
    expect(pipBody.textContent).toContain('Abrir tablero principal');

    setLocale('en');
    pip.render();
    expect(pipBody.textContent).toContain('No active task');
    expect(pipBody.textContent).toContain('✓ No pending tasks for today');
    expect(pipBody.textContent).toContain('Open main board');
    setLocale('es');
  });
});
