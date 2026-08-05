import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TodayTasksActions - Interrupciones', () => {
  let actions;
  let state;

  beforeEach(async () => {
    window.TodayTasksUi = { showToast: () => {}, renderAll: () => {} };
    window.alert = vi.fn();

    await import('../js/utils.js');
    await import('../js/state.js');
    await import('../js/actions.js');

    state = window.TodayTasksState.defaultState();
    let idCounter = 1;

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
      newId: () => idCounter++,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {}
    };

    actions = window.TodayTasksActions(ctx);
  });

  it('inicia una interrupción y pausa la tarea que estaba en ejecución', () => {
    // Crear y arrancar una tarea previa
    actions.addTask('Tarea Principal', '60');
    const taskId = state.tasks[0].id;
    actions.startTask(taskId);
    expect(state.tasks[0].status).toBe('running');

    // Iniciar interrupción
    actions.startInterruption();

    // La tarea previa pasa a pausada
    expect(state.tasks[0].status).toBe('paused');
    // Se crea la interrupción activa
    expect(state.activeInterruption).not.toBeNull();
    expect(state.activeInterruption.start).toBeDefined();
  });

  it('actualiza el título de la interrupción activa', () => {
    actions.startInterruption();
    actions.updateInterruptionTitle('Llamada Imprevista Cliente');
    expect(state.activeInterruption.title).toBe('Llamada Imprevista Cliente');
  });

  it('completa la interrupción agregándola al registro del día', () => {
    actions.startInterruption();
    actions.updateInterruptionTitle('Consulta Rápida');

    const activeId = state.activeInterruption.id;
    actions.completeInterruption();

    expect(state.activeInterruption).toBeNull();
    expect(state.interruptions).toHaveLength(1);
    expect(state.interruptions[0]).toMatchObject({
      id: activeId,
      title: 'Consulta Rápida'
    });
    expect(state.interruptions[0].duration).toBeGreaterThanOrEqual(0);
  });

  it('cancela la interrupción sin guardarla en el registro', () => {
    actions.startInterruption();
    actions.updateInterruptionTitle('Falsa Alarma');

    actions.cancelInterruption();

    expect(state.activeInterruption).toBeNull();
    expect(state.interruptions).toHaveLength(0);
  });
});
