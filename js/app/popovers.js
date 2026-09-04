/* app/popovers.js — Popovers contextuales: Tiempo, StartAfter y Reglas Recurrentes */
import { t } from '../i18n.js';
import { positionPopover } from '../ui.js';
import { getTodayStr, getTaskElapsed, formatRecurrenceRule, matchesRecurrenceRule } from '../utils.js';

export function TodayTasksPopovers(ctx) {
  const { getState, saveState, viewsModule, getActionsModule, showToast, undoModule, fmt } = ctx;

  let currentPopoverTaskId = null;
  let currentStartAfterTaskId = null;
  let _isFormStartAfter = false;
  let currentRecurringEntityId = null;
  let currentRecurringEntityType = 'task';
  let _popoverSelectedDays = [1];

  const getActions = () => (typeof getActionsModule === 'function' ? getActionsModule() : ctx.actionsModule);
  const formatTime = typeof fmt === 'function' ? fmt : (m => m != null ? String(m) : '');

  /* ==================== 1. Time Popover ==================== */
  function openTimePopover(taskId, event) {
    try {
      if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      currentPopoverTaskId = taskId;
      const overlay = document.getElementById('timePopoverOverlay');
      const popover = document.getElementById('timePopover');
      const input = document.getElementById('timePopoverInput');
      if (!overlay || !popover || !input) return;

      const state = typeof getState === 'function' ? getState() : {};
      const t = (state.tasks || []).find(x => String(x.id) === String(taskId));
      if (!t) return;

      const actual = getTaskElapsed(t);
      input.value = actual;

      overlay.style.display = 'block';
      popover.style.display = 'flex';

      positionPopover(event, popover, { width: 220, height: 110, gap: 6 });

      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    } catch (err) {
      console.error("Error in openTimePopover:", err);
    }
  }

  function closeTimePopover() {
    const overlay = document.getElementById('timePopoverOverlay');
    const popover = document.getElementById('timePopover');
    if (overlay) overlay.style.display = 'none';
    if (popover) popover.style.display = 'none';
    currentPopoverTaskId = null;
  }

  function saveTimePopover() {
    if (!currentPopoverTaskId) return;
    const input = document.getElementById('timePopoverInput');
    const actions = getActions();
    if (actions && actions.updateTaskTimeFast) {
      actions.updateTaskTimeFast(currentPopoverTaskId, input ? input.value : '');
    }
    closeTimePopover();
  }

  function adjustTimePopover(deltaMin) {
    if (!currentPopoverTaskId) return;
    const actions = getActions();
    if (actions && actions.adjustTaskElapsed) {
      actions.adjustTaskElapsed(currentPopoverTaskId, deltaMin);
    }
    closeTimePopover();
  }

  /* ==================== 2. StartAfter Popover ==================== */
  function openStartAfterPopover(taskId, event) {
    try {
      if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      _isFormStartAfter = false;
      currentStartAfterTaskId = taskId;
      const overlay = document.getElementById('startAfterPopoverOverlay');
      const popover = document.getElementById('startAfterPopover');
      const input = document.getElementById('startAfterPopoverInput');
      if (!overlay || !popover || !input) return;

      const state = typeof getState === 'function' ? getState() : {};
      const t = (state.tasks || []).find(x => String(x.id) === String(taskId));
      if (!t) return;

      input.value = (t.startAfter !== null && t.startAfter !== undefined) ? formatTime(t.startAfter) : '';

      overlay.style.display = 'block';
      popover.style.display = 'flex';

      positionPopover(event, popover, { width: 230, height: 130, gap: 6 });

      setTimeout(() => {
        input.focus();
      }, 50);
    } catch (err) {
      console.error("Error in openStartAfterPopover:", err);
    }
  }

  function closeStartAfterPopover() {
    const overlay = document.getElementById('startAfterPopoverOverlay');
    const popover = document.getElementById('startAfterPopover');
    if (overlay) overlay.style.display = 'none';
    if (popover) popover.style.display = 'none';
    currentStartAfterTaskId = null;
  }

  function saveStartAfterPopover() {
    if (!currentStartAfterTaskId) return;
    const input = document.getElementById('startAfterPopoverInput');
    const val = input ? input.value : '';
    const actions = getActions();
    if (actions && actions.setTaskStartAfter) {
      actions.setTaskStartAfter(currentStartAfterTaskId, val || null);
    }
    closeStartAfterPopover();
  }

  function clearStartAfterPopover() {
    if (!currentStartAfterTaskId) return;
    const actions = getActions();
    if (actions && actions.setTaskStartAfter) {
      actions.setTaskStartAfter(currentStartAfterTaskId, null);
    }
    closeStartAfterPopover();
  }

  /* ==================== 3. Recurring Info Popover ==================== */
  function openRecurringInfoPopover(entityId, event, type = 'task') {
    try {
      if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      currentRecurringEntityId = entityId;
      currentRecurringEntityType = type;

      const overlay = document.getElementById('recurringInfoPopoverOverlay');
      const popover = document.getElementById('recurringInfoPopover');
      if (!overlay || !popover) return;

      const state = typeof getState === 'function' ? getState() : {};
      const envKey = state.activeEnv || 'work';
      const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
      if (!env) return;

      let entity = null;
      let rule = null;
      const isTask = (type === 'task');

      if (isTask) {
        entity = (state.tasks || []).find(t => String(t.id) === String(entityId));
        if (entity && entity.ruleId && Array.isArray(env.recurringTasks)) {
          rule = env.recurringTasks.find(r => String(r.id) === String(entity.ruleId));
        }
      } else {
        entity = (state.meetings || []).find(m => String(m.id) === String(entityId));
        if (entity && entity.ruleId && Array.isArray(env.recurringMeetings)) {
          rule = env.recurringMeetings.find(r => String(r.id) === String(entity.ruleId));
        }
      }

      if (!rule) {
        rule = {
          title: entity ? entity.title : 'Elemento recurrente',
          freq: 'daily',
          interval: 1,
          startDate: state.selectedDate || getTodayStr()
        };
      }

      const formatted = formatRecurrenceRule(rule);
      const headingEl = document.getElementById('recurringPopoverHeading');
      const titleEl = document.getElementById('recurringPopoverTitle');
      const freqEl = document.getElementById('recurringPopoverFreq');
      const daysEl = document.getElementById('recurringPopoverDays');
      const datesEl = document.getElementById('recurringPopoverDates');
      const statusBadgeEl = document.getElementById('recurringPopoverStatusBadge');

      if (headingEl) headingEl.textContent = isTask ? 'Regla de tarea recurrente' : 'Regla de reunión recurrente';
      if (titleEl) titleEl.textContent = rule.title || (entity ? entity.title : '—');
      if (freqEl) freqEl.textContent = formatted.intervalText || formatted.freqText;
      if (daysEl) daysEl.textContent = formatted.daysText;
      if (datesEl) datesEl.textContent = formatted.dateRangeText;

      if (statusBadgeEl) {
        const isModified = entity && entity.isModifiedInstance;
        if (isModified) {
          statusBadgeEl.textContent = '✎ Ocurrencia modificada hoy';
          statusBadgeEl.className = 'rec-pop-status-badge modified';
        } else {
          statusBadgeEl.textContent = '✓ Ocurrencia sincronizada con la serie';
          statusBadgeEl.className = 'rec-pop-status-badge';
        }
      }

      const viewModeEl = document.getElementById('recurringPopoverViewMode');
      const editModeEl = document.getElementById('recurringPopoverEditMode');
      if (viewModeEl) viewModeEl.style.display = 'flex';
      if (editModeEl) editModeEl.style.display = 'none';

      overlay.style.display = 'block';
      popover.style.display = 'flex';

      positionPopover(event, popover, { width: 300, height: 260, gap: 6 });
    } catch (err) {
      console.error("Error in openRecurringInfoPopover:", err);
    }
  }

  function closeRecurringInfoPopover() {
    const overlay = document.getElementById('recurringInfoPopoverOverlay');
    const popover = document.getElementById('recurringInfoPopover');
    if (overlay) overlay.style.display = 'none';
    if (popover) popover.style.display = 'none';
    currentRecurringEntityId = null;
    currentRecurringEntityType = 'task';
  }

  function editRecurringSeriesFromPopover(showEdit) {
    const viewModeEl = document.getElementById('recurringPopoverViewMode');
    const editModeEl = document.getElementById('recurringPopoverEditMode');
    if (!viewModeEl || !editModeEl) return;

    if (!showEdit) {
      viewModeEl.style.display = 'flex';
      editModeEl.style.display = 'none';
      return;
    }

    const state = typeof getState === 'function' ? getState() : {};
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
    if (!env) return;

    const entityId = currentRecurringEntityId;
    const isTask = (currentRecurringEntityType === 'task');
    let entity = null;
    let rule = null;

    if (isTask) {
      entity = (state.tasks || []).find(t => String(t.id) === String(entityId));
      if (entity && entity.ruleId && Array.isArray(env.recurringTasks)) {
        rule = env.recurringTasks.find(r => String(r.id) === String(entity.ruleId));
      }
    } else {
      entity = (state.meetings || []).find(m => String(m.id) === String(entityId));
      if (entity && entity.ruleId && Array.isArray(env.recurringMeetings)) {
        rule = env.recurringMeetings.find(r => String(r.id) === String(entity.ruleId));
      }
    }

    if (!rule) return;

    const freqSelect = document.getElementById('recPopEditFreq');
    const intervalInput = document.getElementById('recPopEditInterval');
    const endDateInput = document.getElementById('recPopEditEndDate');

    const freq = rule.freq || (Array.isArray(rule.daysOfWeek) ? 'weekly' : 'daily');
    if (freqSelect) freqSelect.value = freq;
    if (intervalInput) intervalInput.value = rule.interval || 1;
    if (endDateInput) endDateInput.value = rule.endDate || '';

    _popoverSelectedDays = Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0
      ? [...rule.daysOfWeek]
      : [1];

    _updateRecurrencePopoverDayButtons();
    onRecurrencePopoverFreqChange(freq);

    viewModeEl.style.display = 'none';
    editModeEl.style.display = 'flex';
  }

  function onRecurrencePopoverFreqChange(freq) {
    const unitLabel = document.getElementById('recPopEditIntervalUnit');
    const daysWrap = document.getElementById('recPopEditDaysWrap');
    if (unitLabel) {
      unitLabel.textContent = freq === 'daily' ? 'día(s)' : 'semana(s)';
    }
    if (daysWrap) {
      daysWrap.style.display = freq === 'daily' ? 'none' : 'block';
    }
  }

  function toggleRecurrencePopoverDay(dayNum) {
    if (!Array.isArray(_popoverSelectedDays)) _popoverSelectedDays = [1];
    const d = parseInt(dayNum, 10);
    if (_popoverSelectedDays.includes(d)) {
      if (_popoverSelectedDays.length > 1) {
        _popoverSelectedDays = _popoverSelectedDays.filter(x => x !== d);
      }
    } else {
      _popoverSelectedDays.push(d);
      _popoverSelectedDays.sort((a, b) => a - b);
    }
    _updateRecurrencePopoverDayButtons();
  }

  function _updateRecurrencePopoverDayButtons() {
    const selected = _popoverSelectedDays || [];
    const buttons = document.querySelectorAll('#recPopEditDaysWrap .rec-pop-day-btn');
    buttons.forEach(btn => {
      const day = parseInt(btn.getAttribute('data-day'), 10);
      if (selected.includes(day)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function saveRecurrenceFromPopover() {
    const entityId = currentRecurringEntityId;
    const isTask = (currentRecurringEntityType === 'task');
    if (!entityId) return;

    const state = typeof getState === 'function' ? getState() : {};
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
    if (!env) return;

    let entity = null;
    let rule = null;

    if (isTask) {
      entity = (state.tasks || []).find(t => String(t.id) === String(entityId));
      if (entity && entity.ruleId && Array.isArray(env.recurringTasks)) {
        rule = env.recurringTasks.find(r => String(r.id) === String(entity.ruleId));
      }
    } else {
      entity = (state.meetings || []).find(m => String(m.id) === String(entityId));
      if (entity && entity.ruleId && Array.isArray(env.recurringMeetings)) {
        rule = env.recurringMeetings.find(r => String(r.id) === String(entity.ruleId));
      }
    }

    if (!rule) return;

    const freqSelect = document.getElementById('recPopEditFreq');
    const intervalInput = document.getElementById('recPopEditInterval');
    const endDateInput = document.getElementById('recPopEditEndDate');

    const newFreq = freqSelect ? freqSelect.value : 'weekly';
    const newInterval = intervalInput ? Math.max(1, parseInt(intervalInput.value, 10) || 1) : 1;
    const newDays = newFreq === 'daily'
      ? [1, 2, 3, 4, 5, 6, 7]
      : (Array.isArray(_popoverSelectedDays) && _popoverSelectedDays.length > 0 ? _popoverSelectedDays : [1]);
    const newEndDate = (endDateInput && endDateInput.value && endDateInput.value.trim()) ? endDateInput.value.trim() : null;

    if (undoModule && undoModule.pushSnapshot) {
      undoModule.pushSnapshot(`Modificar patrón recurrente de "${rule.title}"`);
    }

    rule.freq = newFreq;
    rule.interval = newInterval;
    rule.daysOfWeek = newDays;
    rule.endDate = newEndDate;

    const actions = getActions();

    if (isTask) {
      if (env.days) {
        Object.entries(env.days).forEach(([dStr, dayObj]) => {
          if (dayObj && Array.isArray(dayObj.tasks)) {
            const matches = matchesRecurrenceRule(rule, dStr);
            if (!matches) {
              dayObj.tasks = dayObj.tasks.filter(t => !(String(t.ruleId) === String(rule.id) && t.status === "pending" && (t.elapsedBefore || 0) === 0));
            }
          }
        });
      }
      if (actions && actions.materializeRecurringTasks) {
        actions.materializeRecurringTasks();
      }
    }

    closeRecurringInfoPopover();
    if (typeof saveState === 'function') saveState();
    if (viewsModule && viewsModule.renderAll) viewsModule.renderAll();
    if (typeof showToast === 'function') showToast(`Regla de recurrencia actualizada 🔁 (${formatRecurrenceRule(rule).summaryText})`);
  }

  function toggleTaskFormRecurrenceDay(dayNum) {
    const d = parseInt(dayNum, 10);
    const cb = document.getElementById(`recTaskDayCb${d}`);
    const btn = document.querySelector(`#recTaskDaysRow .rec-pop-day-btn[data-day="${d}"]`);
    if (!cb || !btn) return;
    
    const allCbs = document.querySelectorAll('.rec-task-day-cb:checked');
    if (cb.checked && allCbs.length <= 1) {
      return;
    }
    
    cb.checked = !cb.checked;
    btn.classList.toggle('active', cb.checked);
  }

  function toggleMeetingFormRecurrenceDay(dayNum) {
    const d = parseInt(dayNum, 10);
    const cb = document.getElementById(`recDayCb${d}`);
    const btn = document.querySelector(`#recMeetingDaysRow .rec-pop-day-btn[data-day="${d}"]`);
    if (!cb || !btn) return;
    
    const allCbs = document.querySelectorAll('.rec-day-cb:checked');
    if (cb.checked && allCbs.length <= 1) {
      return;
    }
    
    cb.checked = !cb.checked;
    btn.classList.toggle('active', cb.checked);
  }

  return {
    openTimePopover,
    closeTimePopover,
    saveTimePopover,
    adjustTimePopover,
    openStartAfterPopover,
    closeStartAfterPopover,
    saveStartAfterPopover,
    clearStartAfterPopover,
    openRecurringInfoPopover,
    closeRecurringInfoPopover,
    editRecurringSeriesFromPopover,
    toggleEditRecurrenceInPopover: editRecurringSeriesFromPopover,
    onRecurrencePopoverFreqChange,
    toggleRecurrencePopoverDay,
    _updateRecurrencePopoverDayButtons,
    saveRecurrenceFromPopover,
    toggleTaskFormRecurrenceDay,
    toggleMeetingFormRecurrenceDay,
    get currentPopoverTaskId() { return currentPopoverTaskId; },
    set currentPopoverTaskId(v) { currentPopoverTaskId = v; },
    get currentStartAfterTaskId() { return currentStartAfterTaskId; },
    set currentStartAfterTaskId(v) { currentStartAfterTaskId = v; },
    get _isFormStartAfter() { return _isFormStartAfter; },
    set _isFormStartAfter(v) { _isFormStartAfter = v; },
    get currentRecurringEntityId() { return currentRecurringEntityId; },
    set currentRecurringEntityId(v) { currentRecurringEntityId = v; },
    get currentRecurringEntityType() { return currentRecurringEntityType; },
    set currentRecurringEntityType(v) { currentRecurringEntityType = v; },
    get _popoverSelectedDays() { return _popoverSelectedDays; },
    set _popoverSelectedDays(v) { _popoverSelectedDays = v; }
  };
}

export default TodayTasksPopovers;
