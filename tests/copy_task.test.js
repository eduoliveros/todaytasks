import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { getTodayStr, addDays } from '../js/utils.js';
import { setLocale } from '../js/i18n.js';

describe('TodayTasksActions - Copiar Tareas a Otro Día', () => {
  let actions;
  let state;
  let idCounter = 1;

  beforeEach(() => {
    window.alert = vi.fn();

    state = defaultState();
    idCounter = 1;

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

    actions = TodayTasksActions(ctx);
  });

  it('copia una tarea activa del día actual a una fecha futura con estado pending y duración completa', () => {
    actions.addTask('Informe Trimestral', '60');
    const sourceTask = state.tasks[0];
    const sourceId = sourceTask.id;

    const targetDate = '2026-08-10';
    actions.copyTaskToDate(sourceId, targetDate);

    const env = state.environments[state.activeEnv];
    expect(env.days[targetDate]).toBeDefined();
    const copiedTasks = env.days[targetDate].tasks;
    expect(copiedTasks).toHaveLength(1);
    expect(copiedTasks[0]).toMatchObject({
      title: 'Informe Trimestral',
      planned: 60,
      status: 'pending',
      elapsedBefore: 0,
      completedAt: null,
      actualDuration: null
    });
    expect(copiedTasks[0].id).not.toBe(sourceId);
  });

  it('copia una tarea completada de un día pasado al día actual (Hoy) reseteando estado a pending y duración completa', () => {
    const pastDate = '2026-08-01';
    state.selectedDate = pastDate;

    actions.addTask('Tarea Pasada', '45');
    const pastTask = state.tasks[0];
    actions.startTask(pastTask.id);
    actions.completeTask(pastTask.id);

    expect(state.tasks[0].status).toBe('completed');

    const todayStr = getTodayStr();
    actions.copyTaskToDate(pastTask.id, todayStr);

    state.selectedDate = todayStr;
    const todayTasks = state.tasks;
    expect(todayTasks.some(t => t.title === 'Tarea Pasada' && t.status === 'pending' && t.planned === 45 && t.elapsedBefore === 0)).toBe(true);
  });

  it('mueve una tarea con autoMoveToToday a otra fecha eliminándola del día origen y preservando tiempo consumido', () => {
    const today = getTodayStr();
    actions.addTask('Tarea con seguimiento', '50', false, null, true);
    const sourceTask = state.tasks[0];
    const sourceId = sourceTask.id;

    // Simular que se ha trabajado 25 min en la tarea
    sourceTask.elapsedBefore = 25;
    sourceTask.status = 'paused';

    const targetDate = '2026-11-20';
    actions.moveTaskToDate(sourceId, targetDate);

    const env = state.environments[state.activeEnv];
    // Ya NO debe estar en el día origen (today)
    expect(env.days[today].tasks.some(t => t.id === sourceId)).toBe(false);

    // Debe estar en targetDate con los mismos datos y tiempo consumido
    expect(env.days[targetDate]).toBeDefined();
    const movedTasks = env.days[targetDate].tasks;
    expect(movedTasks).toHaveLength(1);
    expect(movedTasks[0]).toMatchObject({
      id: sourceId,
      title: 'Tarea con seguimiento',
      planned: 50,
      elapsedBefore: 25,
      initialElapsed: 25,
      status: 'paused',
      autoMoveToToday: true
    });
  });

  it('openCopyTaskModal configura el modal como "Mover" para tareas auto-move y como "Copiar" para tareas normales', () => {
    document.body.innerHTML = `
      <div id="copyTaskModal" style="display:none;">
        <h3 id="copyTaskModalTitle"></h3>
        <p id="copyTaskModalDesc"></p>
        <span id="copyTaskBtnTodayText"></span>
        <button id="copyTaskBtnToday"></button>
        <input type="date" id="copyTaskDateInput" />
        <button id="copyTaskBtnCustomDate"></button>
        <button id="copyTaskBtnCancel"></button>
        <small id="copyTaskTodayLabel"></small>
      </div>
    `;

    // 1. Tarea normal
    actions.addTask('Tarea Normal', '30', false, null, false);
    const normalTaskId = state.tasks[0].id;
    actions.openCopyTaskModal(normalTaskId);

    const titleEl = document.getElementById('copyTaskModalTitle');
    const descEl = document.getElementById('copyTaskModalDesc');
    const btnTodayText = document.getElementById('copyTaskBtnTodayText');
    const btnCustom = document.getElementById('copyTaskBtnCustomDate');
    const dateInput = document.getElementById('copyTaskDateInput');

    expect(titleEl.textContent).toContain('Copiar');
    expect(descEl.textContent).toContain('copiar');
    expect(btnTodayText.textContent).toContain('Copiar a Hoy');
    expect(btnCustom.textContent).toBe('Copiar');
    expect(dateInput.value).toBe(addDays(getTodayStr(), 1));

    // 2. Tarea auto-move
    actions.addTask('Tarea AutoMove', '40', false, null, true);
    const autoTaskId = state.tasks[1].id;
    actions.openCopyTaskModal(autoTaskId);

    expect(titleEl.textContent).toContain('Mover');
    expect(descEl.textContent).toContain('mover');
    expect(btnTodayText.textContent).toContain('Mover a Hoy');
    expect(btnCustom.textContent).toBe('Mover');
  });

  it('openCopyTaskModal muestra los textos en inglés cuando el idioma activo es "en"', () => {
    setLocale('en');
    try {
      document.body.innerHTML = `
        <div id="copyTaskModal" style="display:none;">
          <h3 id="copyTaskModalTitle"></h3>
          <p id="copyTaskModalDesc"></p>
          <span id="copyTaskBtnTodayText"></span>
          <button id="copyTaskBtnToday"></button>
          <input type="date" id="copyTaskDateInput" />
          <button id="copyTaskBtnCustomDate"></button>
          <button id="copyTaskBtnCancel"></button>
          <small id="copyTaskTodayLabel"></small>
        </div>
      `;

      // 1. Tarea normal en inglés
      actions.addTask('English Task', '30', false, null, false);
      const normalTaskId = state.tasks[0].id;
      actions.openCopyTaskModal(normalTaskId);

      const titleEl = document.getElementById('copyTaskModalTitle');
      const descEl = document.getElementById('copyTaskModalDesc');
      const btnTodayText = document.getElementById('copyTaskBtnTodayText');
      const btnCustom = document.getElementById('copyTaskBtnCustomDate');
      const dateInput = document.getElementById('copyTaskDateInput');

      expect(titleEl.textContent).toContain('Copy');
      expect(descEl.textContent).toContain('Which date do you want to copy this task to?');
      expect(btnTodayText.textContent).toContain('Copy to Today');
      expect(btnCustom.textContent).toBe('Copy');
      expect(dateInput.value).toBe(addDays(getTodayStr(), 1));

      // 2. Tarea auto-move en inglés
      actions.addTask('English AutoMove Task', '40', false, null, true);
      const autoTaskId = state.tasks[1].id;
      actions.openCopyTaskModal(autoTaskId);

      expect(titleEl.textContent).toContain('Move');
      expect(descEl.textContent).toContain('Which date do you want to move this task to?');
      expect(btnTodayText.textContent).toContain('Move to Today');
      expect(btnCustom.textContent).toBe('Move');
    } finally {
      setLocale('es');
    }
  });

  describe('startNewDay (Reiniciar día / Borrar tareas)', () => {
    it('pide confirmación advirtiendo del borrado de tareas y reuniones, y borra si se confirma', () => {
      actions.addTask('Tarea a borrar', '30');
      state.meetings = [{ id: 'm1', title: 'Reunión 1', start: '10:00', duration: 30 }];

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      actions.startNewDay();

      expect(confirmSpy).toHaveBeenCalled();
      const confirmPrompt = confirmSpy.mock.calls[0][0];
      expect(confirmPrompt).toContain('Vas a reiniciar el día');
      expect(confirmPrompt).toContain('Se borrarán permanentemente todas las tareas y reuniones');
      expect(confirmPrompt).toContain('¿Estás seguro de que deseas borrar todas las tareas?');

      expect(state.tasks).toHaveLength(0);
      expect(state.meetings).toHaveLength(0);
      confirmSpy.mockRestore();
    });

    it('no borra nada si el usuario cancela la confirmación', () => {
      actions.addTask('Tarea que sobrevive', '45');
      state.meetings = [{ id: 'm2', title: 'Reunión intacta', start: '11:00', duration: 45 }];

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      actions.startNewDay();

      expect(confirmSpy).toHaveBeenCalled();
      expect(state.tasks).toHaveLength(1);
      expect(state.meetings).toHaveLength(1);
      confirmSpy.mockRestore();
    });

    it('genera el mensaje de confirmación en inglés cuando locale es en', () => {
      setLocale('en');
      try {
        actions.addTask('English Task to wipe', '20');
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

        actions.startNewDay();

        expect(confirmSpy).toHaveBeenCalled();
        const confirmPrompt = confirmSpy.mock.calls[0][0];
        expect(confirmPrompt).toContain('You are about to reset the day');
        expect(confirmPrompt).toContain('All tasks and meetings for this date will be permanently deleted');
        expect(confirmPrompt).toContain('Are you sure you want to delete all tasks?');
        confirmSpy.mockRestore();
      } finally {
        setLocale('es');
      }
    });
  });
});

