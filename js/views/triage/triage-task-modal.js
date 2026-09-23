/* views/triage/triage-task-modal.js — Modal de creación/edición de tareas y lógica de recurrencia en triaje */
import { DEFAULT_URGENCY } from '../../utils.js';
import { t } from '../../i18n.js';

export function createTriageTaskModal(ctx, state, deps) {
  const { getActions, renderTriageView } = deps;

  function getActiveTaskEdit() {
    if (deps.getTaskEdit) return deps.getTaskEdit();
    if (ctx.getTaskEdit) return ctx.getTaskEdit();
    return null;
  }

  function openTriageNewTaskModal(defaults = {}) {
    const actions = getActions();
    if (actions && actions.startNewTask) {
      actions.startNewTask(defaults);
    } else {
      const setTaskEdit = (ctx && ctx.setTaskEdit) || null;
      if (setTaskEdit) {
        setTaskEdit({
          id: '__new__',
          isNew: true,
          title: defaults.title || '',
          duration: defaults.duration || '30',
          actual: '0',
          notes: defaults.notes || '',
          autoMoveToToday: defaults.autoMoveToToday !== false,
          urgency: defaults.urgency || DEFAULT_URGENCY,
          featured: !!defaults.featured,
          startAfter: defaults.startAfter || '',
          isRecurring: !!defaults.isRecurring,
          recurringFreq: defaults.recurringFreq || (defaults.recurring && defaults.recurring.freq) || 'weekly',
          recurringInterval: defaults.recurringInterval || (defaults.recurring && defaults.recurring.interval) || 1,
          recurringDaysOfWeek: defaults.recurringDaysOfWeek || (defaults.recurring && defaults.recurring.daysOfWeek) || [1],
          recurringEndDate: defaults.recurringEndDate || (defaults.recurring && defaults.recurring.endDate) || null
        });
      }
      renderTriageView();
    }
  }

  function toggleTriageEditRecurring(checked) {
    const taskEdit = getActiveTaskEdit();
    if (taskEdit) {
      taskEdit.isRecurring = !!checked;
      if (!taskEdit.recurringDaysOfWeek || taskEdit.recurringDaysOfWeek.length === 0) {
        taskEdit.recurringDaysOfWeek = [1];
      }
      if (!taskEdit.recurringFreq) {
        taskEdit.recurringFreq = 'weekly';
      }
      if (!taskEdit.recurringInterval) {
        taskEdit.recurringInterval = 1;
      }
    }
    const opts = document.getElementById('triageRecurringOptions');
    if (opts) opts.style.display = checked ? 'block' : 'none';
    const autoMoveWrap = document.getElementById('triageAutoMoveOptionWrap');
    if (autoMoveWrap) autoMoveWrap.style.display = checked ? 'none' : 'block';
  }

  function onTriageRecurrenceFreqChange(freq) {
    const taskEdit = getActiveTaskEdit();
    if (taskEdit) taskEdit.recurringFreq = freq;
    const daysWrap = document.getElementById('triageRecDaysWrap');
    const unitLabel = document.getElementById('triageRecIntervalUnit');
    if (daysWrap) daysWrap.style.display = freq === 'daily' ? 'none' : 'block';
    if (unitLabel) unitLabel.textContent = freq === 'daily' ? t('recurrence.unitDays') : t('recurrence.unitWeeks');
  }

  function toggleTriageRecurrenceDay(dayNum) {
    const taskEdit = getActiveTaskEdit();
    if (!taskEdit) return;
    const d = parseInt(dayNum, 10);
    let days = Array.isArray(taskEdit.recurringDaysOfWeek) ? [...taskEdit.recurringDaysOfWeek] : [1];
    if (days.includes(d)) {
      if (days.length > 1) {
        days = days.filter(x => x !== d);
      }
    } else {
      days.push(d);
      days.sort((a, b) => a - b);
    }
    taskEdit.recurringDaysOfWeek = days;
    const buttons = document.querySelectorAll('#triageRecDaysRow .rec-pop-day-btn');
    buttons.forEach(btn => {
      const bDay = parseInt(btn.getAttribute('data-day'), 10);
      btn.classList.toggle('active', days.includes(bDay));
    });
  }

  function clearTriageRecurrenceEndDate() {
    const input = document.getElementById('triageRecEndDate');
    if (input) input.value = '';
    const taskEdit = getActiveTaskEdit();
    if (taskEdit) taskEdit.recurringEndDate = null;
  }

  function submitTriageNewTask(title, durationStr, urgency = DEFAULT_URGENCY, featured = false, startAfter = null, notes = '', autoMoveToToday = true) {
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) {
      if (typeof window !== 'undefined' && window.alert) alert(t('tasks.enterTitleAlert') || 'Indica un título para la tarea.');
      return;
    }
    const actions = getActions();
    if (actions && actions.addTask) {
      actions.addTask(cleanTitle, durationStr, false, null, autoMoveToToday, urgency, featured, startAfter, notes);
    }
    const setTaskEdit = (ctx && ctx.setTaskEdit) || null;
    if (setTaskEdit) setTaskEdit(null);
    renderTriageView();
  }

  function openMobileAddModal() {
    openTriageNewTaskModal();
  }

  function closeMobileAddModal() {
    const actions = getActions();
    if (actions && actions.cancelEditTask) {
      actions.cancelEditTask();
    } else {
      const setTaskEdit = (ctx && ctx.setTaskEdit) || null;
      if (setTaskEdit) setTaskEdit(null);
      renderTriageView();
    }
  }

  function handleTriageAddBarSubmit(form) {
    openTriageNewTaskModal();
  }

  function handleMobileAddModalSubmit(form) {
    openTriageNewTaskModal();
  }

  function focusTriageAddBar() {
    openTriageNewTaskModal();
  }

  return {
    openTriageNewTaskModal,
    toggleTriageEditRecurring,
    onTriageRecurrenceFreqChange,
    toggleTriageRecurrenceDay,
    clearTriageRecurrenceEndDate,
    submitTriageNewTask,
    openMobileAddModal,
    closeMobileAddModal,
    handleTriageAddBarSubmit,
    handleMobileAddModalSubmit,
    focusTriageAddBar,
  };
}
