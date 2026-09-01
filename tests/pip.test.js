import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TodayTasksPiP } from '../js/pip.js';
import { defaultState, wrapState } from '../js/state.js';

describe('TodayTasksPiP (Document Picture-in-Picture Mini-Widget)', () => {
  let ctx;
  let state;
  let mockActions;
  let mockPipWindow;
  let mockRequestWindow;

  beforeEach(() => {
    state = wrapState(defaultState());

    mockActions = {
      pauseTask: vi.fn(),
      resumeTask: vi.fn(),
      startTask: vi.fn(),
      completeTask: vi.fn(),
      startInterruption: vi.fn(),
      completeInterruption: vi.fn(),
      cancelInterruption: vi.fn(),
      switchEnvironment: vi.fn()
    };

    // Crear DOM mock para la ventana PiP
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

    mockRequestWindow = vi.fn().mockResolvedValue(mockPipWindow);

    // Mock de window.documentPictureInPicture
    window.documentPictureInPicture = {
      requestWindow: mockRequestWindow
    };

    ctx = {
      getState: () => state,
      saveState: vi.fn(),
      actionsModule: mockActions,
      showToast: vi.fn(),
      renderAll: vi.fn(),
      fmtMMSS: (epoch) => '02:30'
    };
  });

  afterEach(() => {
    delete window.documentPictureInPicture;
  });

  it('detecta soporte nativo de Document Picture-in-Picture', () => {
    const pip = TodayTasksPiP(ctx);
    expect(pip.isSupported()).toBe(true);

    delete window.documentPictureInPicture;
    expect(pip.isSupported()).toBe(false);
  });

  it('abre la ventana PiP con dimensiones compactas (~370x195) y sincroniza estilos y tema', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const pip = TodayTasksPiP(ctx);

    expect(pip.isOpen()).toBe(false);
    const opened = await pip.openPiP();
    expect(opened).toBe(true);
    expect(pip.isOpen()).toBe(true);

    expect(mockRequestWindow).toHaveBeenCalledWith(expect.objectContaining({
      width: 370,
      height: 195
    }));

    // Verifica que la ventana PiP tiene la clase en el body y el atributo de tema
    expect(mockPipWindow.document.body.className).toBe('pip-window-body');
    expect(mockPipWindow.document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('renderiza el modo Tarea en Marcha con tiempo restante y porcentaje', async () => {
    state.tasks = [
      { id: 'task-1', title: 'Implementar PiP', status: 'running', planned: 30, elapsedBefore: 10, runningStartEpoch: Date.now() - 5000 }
    ];

    const pip = TodayTasksPiP(ctx);
    await pip.openPiP();

    const body = mockPipWindow.document.body;
    expect(body.textContent).toContain('Implementar PiP');
    expect(body.textContent).toContain('En marcha');

    // Botones de acción
    const pauseBtn = mockPipWindow.document.getElementById('pipPauseBtn');
    expect(pauseBtn).toBeTruthy();
    pauseBtn.click();
    expect(mockActions.pauseTask).toHaveBeenCalledWith('task-1');

    const completeBtn = mockPipWindow.document.getElementById('pipCompleteBtn');
    expect(completeBtn).toBeTruthy();
    completeBtn.click();
    expect(mockActions.completeTask).toHaveBeenCalledWith('task-1');
  });

  it('renderiza sobretiempo (+MM:SS) cuando el tiempo transcurrido supera el planificado', async () => {
    state.tasks = [
      { id: 'task-1', title: 'Tarea larga', status: 'running', planned: 20, elapsedBefore: 25, runningStartEpoch: Date.now() }
    ];

    const pip = TodayTasksPiP(ctx);
    await pip.openPiP();

    const body = mockPipWindow.document.body;
    expect(body.textContent).toContain('Sobretiempo');
    expect(body.textContent).toContain('tiempo extra');
    expect(body.textContent).toContain('Excedida');
  });

  it('renderiza la cuenta regresiva y la marca de corte cuando hay una reunión próxima', async () => {
    state.tasks = [
      { id: 'task-1', title: 'Tarea antes de reunión', status: 'running', planned: 60, elapsedBefore: 0, runningStartEpoch: Date.now() }
    ];
    // Reunión programada para dentro de 15 minutos (corta la tarea de 60m)
    const currentNow = Math.floor((new Date().getHours() * 60) + new Date().getMinutes());
    state.meetings = [
      { id: 'meet-1', title: 'Daily Standup', start: currentNow + 15, end: currentNow + 45 }
    ];

    const pip = TodayTasksPiP(ctx);
    await pip.openPiP();

    const banner = mockPipWindow.document.querySelector('.pip-meeting-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Daily Standup');
    const notch = mockPipWindow.document.querySelector('.pip-progress-notch');
    expect(notch).toBeTruthy();
  });

  it('renderiza el modo Interrupción activa con cronómetro y botones de finalizar/descartar', async () => {
    state.activeInterruption = {
      id: 'int-1',
      title: 'Llamada urgente',
      start: 600,
      startEpoch: Date.now() - 60000
    };

    const pip = TodayTasksPiP(ctx);
    await pip.openPiP();

    const body = mockPipWindow.document.body;
    expect(body.textContent).toContain('Interrupción');

    const finishBtn = mockPipWindow.document.getElementById('pipFinishIntBtn');
    expect(finishBtn).toBeTruthy();
    finishBtn.click();
    expect(mockActions.completeInterruption).toHaveBeenCalled();

    const cancelBtn = mockPipWindow.document.getElementById('pipCancelIntBtn');
    expect(cancelBtn).toBeTruthy();
    cancelBtn.click();
    expect(mockActions.cancelInterruption).toHaveBeenCalled();
  });

  it('renderiza el modo Reposo cuando no hay tareas activas y permite iniciar la siguiente', async () => {
    state.tasks = [
      { id: 'task-next', title: 'Siguiente tarea en cola', status: 'pending', planned: 25, order: 1 }
    ];

    const pip = TodayTasksPiP(ctx);
    await pip.openPiP();

    const body = mockPipWindow.document.body;
    expect(body.textContent).toContain('Sin tarea activa');
    expect(body.textContent).toContain('Siguiente tarea en cola');

    const startBtn = mockPipWindow.document.getElementById('pipStartNextBtn');
    expect(startBtn).toBeTruthy();
    startBtn.click();
    expect(mockActions.startTask).toHaveBeenCalledWith('task-next');
  });

  it('cierra la ventana PiP y limpia temporizadores con closePiP()', async () => {
    const pip = TodayTasksPiP(ctx);
    await pip.openPiP();
    expect(pip.isOpen()).toBe(true);

    pip.closePiP();
    expect(mockPipWindow.close).toHaveBeenCalled();
    expect(pip.isOpen()).toBe(false);
  });

  it('togglePiP alterna entre abrir y cerrar la ventana flotante', async () => {
    const pip = TodayTasksPiP(ctx);
    expect(pip.isOpen()).toBe(false);

    await pip.togglePiP();
    expect(pip.isOpen()).toBe(true);

    await pip.togglePiP();
    expect(pip.isOpen()).toBe(false);
  });
});
