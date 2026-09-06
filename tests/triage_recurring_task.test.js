import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { TodayTasksTriageView } from '../js/views/triage.js';
import { TodayTasksUndo } from '../js/undo.js';
import { TodayTasksUrgencyDropdown } from '../js/app/urgency-dropdown.js';

describe('Triage Recurring Task Creation (TDD)', () => {
  let state;
  let actions;
  let undoModule;
  let urgencyDropdownModule;
  let triageView;
  let container;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-triage"></div>
      <div id="triageEditModalHost"></div>
      <div id="urgencyDropdownOverlay" style="display:none;"></div>
      <div id="urgencyDropdownMenu" style="display:none;"></div>
    `;
    container = document.getElementById('view-triage');

    state = defaultState();
    // 2026-09-02 is a Wednesday (day 3)
    state.selectedDate = '2026-09-02';
    state.tasks = [];
    state.recurringTasks = [];

    let notifyState = { taskId: null };
    let currentTaskEdit = null;
    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      saveState: vi.fn(),
      renderAll: vi.fn(() => triageView.renderTriageView()),
      smartRender: vi.fn(() => triageView.renderTriageView()),
      getTaskEdit: () => currentTaskEdit,
      setTaskEdit: (te) => { currentTaskEdit = te; },
      getNotifyState: () => notifyState,
      setNotifyState: (ns) => { notifyState = ns; },
      newId: () => 'new-' + Math.random().toString(36).substr(2, 5)
    };

    undoModule = TodayTasksUndo({
      getState: ctx.getState,
      setState: ctx.setState,
      saveState: ctx.saveState,
      renderAll: ctx.renderAll,
      showToast: vi.fn()
    });
    ctx.undoModule = undoModule;

    actions = TodayTasksActions(ctx, {
      nowMinutes: () => 600,
      showToast: vi.fn(),
      showRecurringModal: vi.fn(),
      showFeaturedLimitModal: vi.fn()
    });
    ctx.actionsModule = actions;

    urgencyDropdownModule = TodayTasksUrgencyDropdown({
      getState: ctx.getState,
      getActionsModule: () => actions,
      getTaskEdit: ctx.getTaskEdit
    });

    triageView = TodayTasksTriageView(ctx);

    window.app = {
      ...actions,
      undo: () => undoModule.undo(),
      redo: () => undoModule.redo(),
      openEditUrgencyDropdown: (taskId, ev) => urgencyDropdownModule.openEditUrgencyDropdown(taskId, ev),
      selectTaskUrgency: (urg) => urgencyDropdownModule.selectTaskUrgency(urg),
      ...triageView
    };
    globalThis.app = window.app;
  });

  it('al abrir el modal de nueva tarea en triaje, renderiza la opción de recurrencia y el auto-mover', () => {
    triageView.renderTriageView();
    triageView.openTriageNewTaskModal({ title: 'Nueva tarea recurrente', duration: '30' });

    const modal = document.getElementById('triageTaskEditModal');
    expect(modal).not.toBeNull();

    const recurringCb = document.getElementById('triageEditIsRecurringCb');
    expect(recurringCb).not.toBeNull();
    expect(recurringCb.checked).toBe(false);

    const recurringOpts = document.getElementById('triageRecurringOptions');
    expect(recurringOpts).not.toBeNull();
    expect(recurringOpts.style.display).toBe('none');

    const autoMoveWrap = document.getElementById('triageAutoMoveOptionWrap');
    expect(autoMoveWrap).not.toBeNull();
    expect(autoMoveWrap.style.display).not.toBe('none');
  });

  it('al marcar el checkbox de recurrencia se muestra el panel y se oculta el auto-mover', () => {
    triageView.renderTriageView();
    triageView.openTriageNewTaskModal({ title: 'Standup semanal', duration: '15' });

    const recurringCb = document.getElementById('triageEditIsRecurringCb');
    recurringCb.checked = true;
    window.app.toggleTriageEditRecurring(true);

    const recurringOpts = document.getElementById('triageRecurringOptions');
    expect(recurringOpts.style.display).toBe('block');

    const autoMoveWrap = document.getElementById('triageAutoMoveOptionWrap');
    expect(autoMoveWrap.style.display).toBe('none');

    // Al desmarcar vuelve a mostrar auto-mover
    recurringCb.checked = false;
    window.app.toggleTriageEditRecurring(false);
    expect(recurringOpts.style.display).toBe('none');
    expect(autoMoveWrap.style.display).toBe('block');
  });

  it('al cambiar la frecuencia a diaria se oculta la fila de días y cambia la unidad de intervalo', () => {
    triageView.renderTriageView();
    triageView.openTriageNewTaskModal();

    window.app.toggleTriageEditRecurring(true);

    const freqSelect = document.getElementById('triageRecFreq');
    expect(freqSelect).not.toBeNull();

    const daysWrap = document.getElementById('triageRecDaysWrap');
    const unitLabel = document.getElementById('triageRecIntervalUnit');

    expect(daysWrap.style.display).not.toBe('none');
    expect(unitLabel.textContent).toContain('semana');

    // Cambiar a daily
    freqSelect.value = 'daily';
    window.app.onTriageRecurrenceFreqChange('daily');

    expect(daysWrap.style.display).toBe('none');
    expect(unitLabel.textContent).toContain('día');

    // Volver a weekly
    freqSelect.value = 'weekly';
    window.app.onTriageRecurrenceFreqChange('weekly');

    expect(daysWrap.style.display).toBe('block');
    expect(unitLabel.textContent).toContain('semana');
  });

  it('permite alternar días de la semana y asegura que al menos un día quede seleccionado', () => {
    triageView.renderTriageView();
    triageView.openTriageNewTaskModal();
    window.app.toggleTriageEditRecurring(true);

    const dayBtns = document.querySelectorAll('#triageRecDaysRow .rec-pop-day-btn');
    expect(dayBtns.length).toBe(7);

    // Lunes está seleccionado por defecto (data-day="1")
    const btnMon = document.querySelector('#triageRecDaysRow .rec-pop-day-btn[data-day="1"]');
    const btnWed = document.querySelector('#triageRecDaysRow .rec-pop-day-btn[data-day="3"]');
    expect(btnMon.classList.contains('active')).toBe(true);
    expect(btnWed.classList.contains('active')).toBe(false);

    // Activar miércoles
    window.app.toggleTriageRecurrenceDay(3);
    expect(btnWed.classList.contains('active')).toBe(true);

    // Desactivar lunes
    window.app.toggleTriageRecurrenceDay(1);
    expect(btnMon.classList.contains('active')).toBe(false);

    // Intentar desactivar miércoles (el único día activo que queda) no debe permitir vaciar la lista
    window.app.toggleTriageRecurrenceDay(3);
    expect(btnWed.classList.contains('active')).toBe(true);
  });

  it('permite limpiar la fecha límite con clearTriageRecurrenceEndDate', () => {
    triageView.renderTriageView();
    triageView.openTriageNewTaskModal();
    window.app.toggleTriageEditRecurring(true);

    const endDateInput = document.getElementById('triageRecEndDate');
    endDateInput.value = '2026-12-31';
    window.app.updateTaskEditField('recurringEndDate', '2026-12-31');

    window.app.clearTriageRecurrenceEndDate();
    expect(endDateInput.value).toBe('');
  });

  it('guardar la nueva tarea recurrente crea la regla en recurringTasks, materializa la ocurrencia y soporta Undo', () => {
    triageView.renderTriageView();
    // 2026-09-02 es miércoles (día 3)
    triageView.openTriageNewTaskModal({
      title: 'Revisión técnica periódica #dev',
      duration: '45',
      urgency: 'today'
    });

    window.app.toggleTriageEditRecurring(true);
    // Seleccionar miércoles (día 3)
    window.app.toggleTriageRecurrenceDay(3);

    // Guardar
    actions.saveEditTask('__new__');

    // Modal se cierra
    expect(document.getElementById('triageTaskEditModal')).toBeNull();

    // Regla creada en state.recurringTasks
    expect(state.recurringTasks.length).toBe(1);
    const rule = state.recurringTasks[0];
    expect(rule.title).toBe('Revisión técnica periódica #dev');
    expect(rule.planned).toBe(45);
    expect(rule.urgency).toBe('today');
    expect(rule.daysOfWeek).toContain(3);

    // Tarea materializada en el día actual (miércoles 2026-09-02)
    const materialized = state.tasks.find(t => t.title === 'Revisión técnica periódica #dev');
    expect(materialized).toBeDefined();
    expect(materialized.isRecurring).toBe(true);
    expect(materialized.ruleId).toBe(rule.id);

    // Deshacer con Undo en Triaje revierte la creación
    triageView.triageUndo();
    expect(state.recurringTasks.length).toBe(0);
    expect(state.tasks.some(t => t.title === 'Revisión técnica periódica #dev')).toBe(false);
  });
});
