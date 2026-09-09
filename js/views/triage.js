/* views/triage.js — Vista de Triaje Rápido (#/triage) */
import {
  nowMinutes, fmt, fmtDur, getTaskElapsed, getTodayStr, formatDateFriendly,
  getDayOfWeek, getNextWorkingDays, URGENCY_LEVELS, DEFAULT_URGENCY, MAX_FEATURED_TASKS,
  formatRecurrenceRule, formatTitleWithTags,
  findTaskInEnvironment, isTaskBlocked, getTaskBlockingDetails, getTasksBlockedBy,
  matchesTaskSearch
} from '../utils.js';
import { escapeHtml, escapeAttr, showToast } from '../ui.js';
import { computeSchedule } from '../scheduler.js';
import { t } from '../i18n.js';
import { attachTagAutocomplete } from '../app/tag-autocomplete.js';

export function TodayTasksTriageView(ctx) {
  const { getState, saveState, renderAll, smartRender, actionsModule, getTaskEdit } = ctx;

  function renderTriageDependencyChips(deps, env) {
    if (!deps || deps.length === 0) {
      return `<span class="empty" style="font-size:0.8rem;">${escapeHtml(t('tasks.noDependencies'))}</span>`;
    }
    return deps.map(depId => {
      const found = env ? findTaskInEnvironment(env, depId) : null;
      const dTask = found ? found.task : null;
      const dId = dTask?.displayId || depId;
      const dTitle = dTask?.title || depId;
      return `
        <span class="dep-chip" data-dep-id="${escapeAttr(depId)}">
          <span class="task-id-badge">${escapeHtml(dId)}</span>
          <span class="dep-chip-title">${escapeHtml(dTitle)}</span>
          <button type="button" class="dep-chip-remove" onclick="app.removeEditTaskDependency('${escapeAttr(depId)}')" title="${escapeAttr(t('action.delete'))}">✕</button>
        </span>
      `;
    }).join('');
  }

  let currentSort = 'urgency'; // 'urgency' | 'viability' | 'duration' | 'featured'
  const collapsedGroups = new Set(['days', 'week', 'later']); // por defecto 'today' abierto, resto plegados
  const selectedTaskIds = new Set();
  let activeSingleUrgencyTaskId = null;
  let lastRenderedDate = null;
  let triageSearchQuery = '';

  function setTriageSearchQuery(query) {
    triageSearchQuery = typeof query === 'string' ? query : '';
    const input = document.getElementById('triageSearchInput');
    if (input && input.value !== triageSearchQuery) {
      input.value = triageSearchQuery;
    }
    const clearBtn = document.getElementById('triageSearchClearBtn');
    if (clearBtn) {
      clearBtn.style.display = triageSearchQuery ? 'block' : 'none';
    }
    renderTriageView();
  }

  function getTriageSearchQuery() {
    return triageSearchQuery;
  }

  function clearTriageSearch() {
    triageSearchQuery = '';
    const input = document.getElementById('triageSearchInput');
    if (input) {
      input.value = '';
      input.focus();
    }
    const clearBtn = document.getElementById('triageSearchClearBtn');
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
    renderTriageView();
  }

  function getTargetDateStr() {
    const state = getState();
    return state.selectedDate || getTodayStr();
  }

  function compareTasksMainOrder(a, b) {
    if (a.status === 'running') return -1;
    if (b.status === 'running') return 1;
    return (a.order || 0) - (b.order || 0);
  }

  function getAllTasks(targetDateStr) {
    const state = getState();
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
    const dayObj = env && env.days ? env.days[targetDateStr] : null;

    let tasksList = [];
    if (dayObj && Array.isArray(dayObj.tasks) && dayObj.tasks.length > 0) {
      tasksList = dayObj.tasks;
    } else if (targetDateStr === (state.selectedDate || getTodayStr()) && Array.isArray(state.tasks) && state.tasks.length > 0) {
      tasksList = state.tasks;
    } else if (dayObj && Array.isArray(dayObj.tasks)) {
      tasksList = dayObj.tasks;
    } else if (targetDateStr === (state.selectedDate || getTodayStr()) && Array.isArray(state.tasks)) {
      tasksList = state.tasks;
    }
    return tasksList;
  }

  function getActiveTasks(targetDateStr) {
    return getAllTasks(targetDateStr).filter(task => task && task.status !== 'completed').sort(compareTasksMainOrder);
  }

  function formatShortDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function getEffectiveSchedule(targetDateStr, activeTasks) {
    const state = getState();
    const isToday = targetDateStr === getTodayStr();

    // Si coincide con la fecha seleccionada en el estado y ctx.computeSchedule existe,
    // usamos la proyección idéntica a la pantalla principal
    if (ctx && typeof ctx.computeSchedule === 'function' && state.selectedDate === targetDateStr) {
      const sched = ctx.computeSchedule();
      if (sched && sched.overflowIds) {
        return sched;
      }
    }

    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
    const dayObj = env && env.days ? env.days[targetDateStr] : null;

    let workStart = state.workStart;
    let workEnd = state.workEnd;
    let meetings = state.meetings;

    if (state.selectedDate !== targetDateStr && dayObj) {
      if (dayObj.hasCustomHours && dayObj.workStart !== undefined) {
        workStart = dayObj.workStart;
      }
      if (dayObj.hasCustomHours && dayObj.workEnd !== undefined) {
        workEnd = dayObj.workEnd;
      }
      if (Array.isArray(dayObj.meetings)) {
        meetings = dayObj.meetings;
      }
    }

    if (workStart === null || workStart === undefined) workStart = 9 * 60;
    if (workEnd === null || workEnd === undefined) workEnd = 18 * 60;
    if (!Array.isArray(meetings)) meetings = [];

    const schedState = {
      ...state,
      workStart,
      workEnd,
      meetings,
      tasks: activeTasks,
      selectedDate: targetDateStr,
      planningMode: isToday ? !!state.planningMode : true,
      autoBreakEnabled: state.autoBreakEnabled !== false,
      autoBreakIntervalMin: state.autoBreakIntervalMin || 60,
      autoBreakDurationMin: state.autoBreakDurationMin || 10
    };

    const nowFn = (ctx && ctx.nowMinutes) ? ctx.nowMinutes : nowMinutes;
    return computeSchedule(schedState, nowFn);
  }

  function getGroups(activeTasks, targetDateStr) {
    const schedule = getEffectiveSchedule(targetDateStr, activeTasks);
    const overflowIds = schedule && schedule.overflowIds ? schedule.overflowIds : new Set();

    function isTaskOverflow(task) {
      if (!overflowIds || !task) return false;
      const tid = task.id;
      if (overflowIds.has(tid)) return true;
      if (overflowIds.has(String(tid))) return true;
      if (typeof tid === 'string' && !isNaN(Number(tid)) && overflowIds.has(Number(tid))) return true;
      if (typeof tid === 'number' && overflowIds.has(String(tid))) return true;
      return false;
    }

    if (currentSort === 'urgency') {
      const groups = [
        { id: 'today', title: t('triage.groupToday'), icon: '🟠', tasks: [] },
        { id: 'days', title: t('triage.groupDays'), icon: '🔵', tasks: [] },
        { id: 'week', title: t('triage.groupWeek'), icon: '🟣', tasks: [] },
        { id: 'later', title: t('triage.groupLater'), icon: '⚪', tasks: [] }
      ];
      activeTasks.forEach(task => {
        const u = task.urgency || DEFAULT_URGENCY;
        const g = groups.find(x => x.id === u) || groups[1];
        g.tasks.push({ ...task, overflow: isTaskOverflow(task) });
      });
      // Prioridad máxima al orden manual de la pantalla principal
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (currentSort === 'viability') {
      const isToday = targetDateStr === getTodayStr();
      const groups = [
        { id: 'fits', title: isToday ? t('triage.groupFitsToday') : t('triage.groupFitsWorkday'), icon: '✅', tasks: [] },
        { id: 'overflow', title: t('triage.groupOverflow'), icon: '⚠️', tasks: [] }
      ];
      activeTasks.forEach(task => {
        const isOverflow = isTaskOverflow(task);
        if (!isOverflow) {
          groups[0].tasks.push({ ...task, overflow: false });
        } else {
          groups[1].tasks.push({ ...task, overflow: true });
        }
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (currentSort === 'duration') {
      const groups = [
        { id: 'quick', title: t('triage.groupQuick'), icon: '⚡', tasks: [] },
        { id: 'medium', title: t('triage.groupMedium'), icon: '⏳', tasks: [] },
        { id: 'long', title: t('triage.groupLong'), icon: '🏋️', tasks: [] }
      ];
      activeTasks.forEach(task => {
        const dur = task.planned || 0;
        const item = { ...task, overflow: isTaskOverflow(task) };
        if (dur <= 15) groups[0].tasks.push(item);
        else if (dur <= 45) groups[1].tasks.push(item);
        else groups[2].tasks.push(item);
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (currentSort === 'featured') {
      const groups = [
        { id: 'feat', title: t('triage.groupFeatured'), icon: '⭐', tasks: [] },
        { id: 'unfeat', title: t('triage.groupUnfeatured'), icon: '📋', tasks: [] }
      ];
      activeTasks.forEach(task => {
        const item = { ...task, overflow: isTaskOverflow(task) };
        if (task.featured) groups[0].tasks.push(item);
        else groups[1].tasks.push(item);
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    return [];
  }

  function setTriageSortMode(mode) {
    if (!['urgency', 'viability', 'duration', 'featured'].includes(mode)) return;
    currentSort = mode;
    // Si cambia de modo, reiniciar colapsos según sentido común
    collapsedGroups.clear();
    if (mode === 'urgency') {
      collapsedGroups.add('days');
      collapsedGroups.add('week');
      collapsedGroups.add('later');
    } else if (mode === 'duration') {
      collapsedGroups.add('long');
    } else if (mode === 'featured') {
      collapsedGroups.add('unfeat');
    }
    renderTriageView();
  }

  function toggleTriageGroup(groupId) {
    if (collapsedGroups.has(groupId)) {
      collapsedGroups.delete(groupId);
    } else {
      collapsedGroups.add(groupId);
    }
    renderTriageView();
  }

  function toggleAllTriageGroups(open) {
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const groups = getGroups(activeTasks, targetDateStr);
    if (open) {
      collapsedGroups.clear();
    } else {
      groups.forEach(g => collapsedGroups.add(g.id));
    }
    renderTriageView();
  }

  function getActions() {
    return ctx.actionsModule || actionsModule || (typeof window !== 'undefined' ? window.app : null) || {};
  }

  function triageUndo() {
    const actions = getActions();
    if (actions && actions.undo) {
      actions.undo();
    } else if (ctx.undoModule && ctx.undoModule.undo) {
      ctx.undoModule.undo();
    }
    renderTriageView();
  }

  function triageRedo() {
    const actions = getActions();
    if (actions && actions.redo) {
      actions.redo();
    } else if (ctx.undoModule && ctx.undoModule.redo) {
      ctx.undoModule.redo();
    }
    renderTriageView();
  }

  function canTriageUndo() {
    const undoM = ctx.undoModule || (typeof window !== 'undefined' && window.app && window.app.undoModule);
    if (undoM && typeof undoM.canUndo === 'function') {
      return undoM.canUndo();
    }
    const actions = getActions();
    if (actions && typeof actions.canUndo === 'function') {
      return actions.canUndo();
    }
    return false;
  }

  function canTriageRedo() {
    const undoM = ctx.undoModule || (typeof window !== 'undefined' && window.app && window.app.undoModule);
    if (undoM && typeof undoM.canRedo === 'function') {
      return undoM.canRedo();
    }
    const actions = getActions();
    if (actions && typeof actions.canRedo === 'function') {
      return actions.canRedo();
    }
    return false;
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
    const taskEdit = (getTaskEdit ? getTaskEdit() : (ctx.getTaskEdit ? ctx.getTaskEdit() : null));
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
    const taskEdit = (getTaskEdit ? getTaskEdit() : (ctx.getTaskEdit ? ctx.getTaskEdit() : null));
    if (taskEdit) taskEdit.recurringFreq = freq;
    const daysWrap = document.getElementById('triageRecDaysWrap');
    const unitLabel = document.getElementById('triageRecIntervalUnit');
    if (daysWrap) daysWrap.style.display = freq === 'daily' ? 'none' : 'block';
    if (unitLabel) unitLabel.textContent = freq === 'daily' ? t('recurrence.unitDays') : t('recurrence.unitWeeks');
  }

  function toggleTriageRecurrenceDay(dayNum) {
    const taskEdit = (getTaskEdit ? getTaskEdit() : (ctx.getTaskEdit ? ctx.getTaskEdit() : null));
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
    const taskEdit = (getTaskEdit ? getTaskEdit() : (ctx.getTaskEdit ? ctx.getTaskEdit() : null));
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

  function moveTriageTaskDirection(taskId, direction) {
    const actions = getActions();
    if (actions && actions.moveTaskDirectly) {
      actions.moveTaskDirectly(taskId, direction, selectedTaskIds);
    }
    closeMobileMoveSheet();
    renderTriageView();
  }

  function executeTriageBatchMoveDirection(direction) {
    if (selectedTaskIds.size === 0) return;
    const actions = getActions();
    if (actions && actions.moveTasksGroupDirectly) {
      actions.moveTasksGroupDirectly(selectedTaskIds, direction);
    } else if (actions && actions.moveTaskDirectly) {
      const firstId = Array.from(selectedTaskIds)[0];
      actions.moveTaskDirectly(firstId, direction, selectedTaskIds);
    }
    renderTriageView();
  }

  let activeMoveSheetTaskId = null;

  function openMobileMoveSheet(taskId, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    activeMoveSheetTaskId = String(taskId);
    const sheet = document.getElementById('triageMobileMoveSheet');
    if (!sheet) return;
    const state = getState();
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const task = activeTasks.find(t => String(t.id) === String(taskId)) ||
                 (state.tasks || []).find(t => String(t.id) === String(taskId));
    const titleEl = document.getElementById('triageMoveSheetTaskTitle');
    if (titleEl && task) {
      if (selectedTaskIds.has(String(taskId)) && selectedTaskIds.size > 1) {
        titleEl.textContent = `${task.title} (+${selectedTaskIds.size - 1} seleccionadas)`;
      } else {
        titleEl.textContent = task.title;
      }
    }

    const runningNotice = document.getElementById('triageMoveSheetRunningNotice');
    const moveGrid = sheet.querySelector('.triage-move-sheet-grid');
    if (task && task.status === 'running') {
      if (runningNotice) runningNotice.style.display = 'flex';
      if (moveGrid) moveGrid.style.opacity = '0.4';
    } else {
      if (runningNotice) runningNotice.style.display = 'none';
      if (moveGrid) moveGrid.style.opacity = '1';
    }

    sheet.style.display = 'flex';
  }

  function closeMobileMoveSheet() {
    activeMoveSheetTaskId = null;
    const sheet = document.getElementById('triageMobileMoveSheet');
    if (sheet) sheet.style.display = 'none';
  }

  function getActiveMoveSheetTaskId() {
    return activeMoveSheetTaskId;
  }

  // TOUCH LONG PRESS & DRAG
  let touchHoldTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchSourceTaskId = null;
  let touchSourceRowEl = null;
  let isTouchDragging = false;
  let currentTouchOverTaskId = null;
  let didLongPressTrigger = false;
  let touchDragJustEnded = false;

  function handleTriageTouchStart(taskId, event) {
    if (!event || !event.touches || event.touches.length === 0) return;
    if (event.target.closest('button') || event.target.closest('input[type="checkbox"]')) {
      return;
    }

    const state = getState();
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const task = activeTasks.find(t => String(t.id) === String(taskId)) ||
                 (state.tasks || []).find(t => String(t.id) === String(taskId));
    const isDraggable = task ? (task.status === 'pending' || task.status === 'paused') : true;

    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchSourceTaskId = String(taskId);
    didLongPressTrigger = false;
    isTouchDragging = false;
    currentTouchOverTaskId = null;

    const row = event.currentTarget || (event.target ? event.target.closest('.triage-task-row') : null);
    touchSourceRowEl = row;

    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }

    const isHandle = !!(event.target && event.target.closest('.triage-drag-handle'));

    if (!isDraggable) {
      // Si la tarea no es arrastrable (por ej. 'running'), permitimos pulsación larga
      // para abrir el menú móvil informativo, pero sin activar arrastre libre
      touchHoldTimer = setTimeout(() => {
        touchHoldTimer = null;
        didLongPressTrigger = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(45); } catch (e) {}
        }
        openMobileMoveSheet(taskId, event);
      }, 450);
      return;
    }

    // Si pulsó la manija ⠿ directamente, iniciamos arrastre muy rápido (60ms)
    // Si pulsó en el cuerpo de la fila, requiere pulsación prolongada (~420ms)
    const delay = isHandle ? 60 : 420;

    touchHoldTimer = setTimeout(() => {
      touchHoldTimer = null;
      didLongPressTrigger = true;
      isTouchDragging = true;

      if (triageClickTimer) {
        clearTimeout(triageClickTimer);
        triageClickTimer = null;
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(45); } catch (e) {}
      }

      if (touchSourceRowEl) {
        touchSourceRowEl.classList.add('long-press-active', 'dragging');
      }
      if (selectedTaskIds.has(String(taskId))) {
        selectedTaskIds.forEach(id => {
          const r = document.querySelector(`.triage-task-row[data-task-id="${id}"]`);
          if (r) r.classList.add('long-press-active', 'dragging');
        });
      }
    }, delay);
  }

  function handleTriageTouchMove(event) {
    if (!event || !event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    if (!isTouchDragging) {
      if (dx > 10 || dy > 10) {
        if (touchHoldTimer) {
          clearTimeout(touchHoldTimer);
          touchHoldTimer = null;
        }
      }
      return;
    }

    if (event.cancelable && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    if (typeof document !== 'undefined' && document.elementFromPoint) {
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const overRow = targetEl ? targetEl.closest('.triage-task-row') : null;
      const overTaskId = overRow ? overRow.getAttribute('data-task-id') : null;

      document.querySelectorAll('.triage-task-row.drag-over').forEach(el => {
        if (el !== overRow) el.classList.remove('drag-over');
      });

      if (overRow && overTaskId && overTaskId !== touchSourceTaskId) {
        overRow.classList.add('drag-over');
        currentTouchOverTaskId = overTaskId;
      } else {
        currentTouchOverTaskId = null;
      }
    }
  }

  function handleTriageTouchEnd(event) {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }

    const wasLongPress = didLongPressTrigger;
    const wasDragging = isTouchDragging;
    const sourceId = touchSourceTaskId;
    const targetId = currentTouchOverTaskId;

    if (touchSourceRowEl) {
      touchSourceRowEl.classList.remove('long-press-active', 'dragging');
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.triage-task-row.drag-over, .triage-task-row.long-press-active, .triage-task-row.dragging').forEach(el => {
        el.classList.remove('drag-over', 'long-press-active', 'dragging');
      });
    }

    touchSourceTaskId = null;
    touchSourceRowEl = null;
    isTouchDragging = false;
    currentTouchOverTaskId = null;
    didLongPressTrigger = false;

    // Evitar que el navegador emita un click sintético tras soltar el gesto
    if (wasLongPress || wasDragging) {
      touchDragJustEnded = true;
      setTimeout(() => { touchDragJustEnded = false; }, 400);
      if (event && event.cancelable && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    }

    if ((wasLongPress || wasDragging) && sourceId) {
      if (targetId && (targetId !== sourceId || (wasDragging && selectedTaskIds.has(String(targetId)) && selectedTaskIds.size > 1))) {
        // Reutilización directa del mecanismo de drag & drop existente con soporte multiselección
        const actions = getActions();
        if (actions && actions.reorderTaskByDrag) {
          actions.reorderTaskByDrag(sourceId, targetId, selectedTaskIds);
        } else if (actions && actions.taskDrop) {
          actions.taskDrop(event || { preventDefault: () => {} }, targetId, selectedTaskIds);
        }
        renderTriageView();
      } else if (wasLongPress && !wasDragging) {
        openMobileMoveSheet(sourceId, event);
      }
    }
  }

  function handleTriageTouchCancel(event) {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }
    if (touchSourceRowEl) {
      touchSourceRowEl.classList.remove('long-press-active', 'dragging');
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.triage-task-row.drag-over, .triage-task-row.long-press-active, .triage-task-row.dragging').forEach(el => {
        el.classList.remove('drag-over', 'long-press-active', 'dragging');
      });
    }
    touchSourceTaskId = null;
    touchSourceRowEl = null;
    isTouchDragging = false;
    currentTouchOverTaskId = null;
    didLongPressTrigger = false;
  }

  let triageClickTimer = null;
  let lastClickedTaskId = null;
  let lastClickTime = 0;

  function handleTriageRowClick(taskId, event) {
    if (touchDragJustEnded) return;
    if (!event) return;
    // Si el clic vino de un botón, checkbox o manija de arrastre, no conmutar selección de fila
    if (event.target.closest('button') || event.target.closest('input[type="checkbox"]') || event.target.closest('.drag-handle')) {
      return;
    }
    if (event.stopPropagation) event.stopPropagation();
    const strId = String(taskId);
    const now = Date.now();

    // Detección de doble clic / doble tap consecutivo en la misma tarea (ventana de 450ms)
    if (lastClickedTaskId === strId && (now - lastClickTime) < 450) {
      if (triageClickTimer) {
        clearTimeout(triageClickTimer);
        triageClickTimer = null;
      }
      lastClickedTaskId = null;
      lastClickTime = 0;
      handleTriageRowDblClick(taskId, event);
      return;
    }

    // Primer clic / tap: limpiamos selección previa pendiente si pulsó en otra fila
    if (triageClickTimer) {
      clearTimeout(triageClickTimer);
      triageClickTimer = null;
      if (lastClickedTaskId && lastClickedTaskId !== strId) {
        toggleTriageTaskSelect(lastClickedTaskId);
      }
    }

    lastClickedTaskId = strId;
    lastClickTime = now;

    // Esperamos 400ms para permitir doble clic/tap antes de conmutar selección
    triageClickTimer = setTimeout(() => {
      triageClickTimer = null;
      lastClickedTaskId = null;
      lastClickTime = 0;
      toggleTriageTaskSelect(taskId);
    }, 400);
  }

  function handleTriageRowDblClick(taskId, event) {
    if (!event) return;
    if (event.target && event.target.closest && (event.target.closest('button') || event.target.closest('input[type="checkbox"]') || event.target.closest('.drag-handle'))) {
      return;
    }
    if (event.stopPropagation) event.stopPropagation();
    if (triageClickTimer) {
      clearTimeout(triageClickTimer);
      triageClickTimer = null;
    }
    lastClickedTaskId = null;
    lastClickTime = 0;
    selectedTaskIds.delete(String(taskId));

    const actions = getActions();
    if (actions && actions.startEditTask) {
      actions.startEditTask(taskId);
    }
  }

  function toggleTriageTaskSelect(taskId, event) {
    if (event) event.stopPropagation();
    const strId = String(taskId);
    if (selectedTaskIds.has(strId)) {
      selectedTaskIds.delete(strId);
    } else {
      selectedTaskIds.add(strId);
    }
    renderTriageView();
  }

  function toggleTriageGroupSelect(groupId, event) {
    if (event) event.stopPropagation();
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const groups = getGroups(activeTasks, targetDateStr);
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const allSelected = group.tasks.length > 0 && group.tasks.every(task => selectedTaskIds.has(String(task.id)));
    group.tasks.forEach(task => {
      const strId = String(task.id);
      if (allSelected) selectedTaskIds.delete(strId);
      else selectedTaskIds.add(strId);
    });
    renderTriageView();
  }

  function clearTriageSelection() {
    selectedTaskIds.clear();
    renderTriageView();
  }

  // ACCIONES DIRECTAS POR FILA
  function toggleTriageTaskStar(taskId, event) {
    if (event) event.stopPropagation();
    const state = getState();
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const task = activeTasks.find(x => String(x.id) === String(taskId)) ||
                 (state.tasks || []).find(x => String(x.id) === String(taskId));
    if (!task) return;
    const actions = getActions();
    if (actions && actions.toggleTaskFeatured) {
      actions.toggleTaskFeatured(taskId);
    }
    renderTriageView();
  }

  function moveTriageTaskToDate(taskId, targetDateStr, friendlyLabel, event) {
    if (event) event.stopPropagation();
    if (!targetDateStr) return;
    const actions = getActions();
    const strId = String(taskId);
    if (selectedTaskIds.has(strId)) {
      const ids = Array.from(selectedTaskIds);
      if (actions && actions.moveTasksToDate) {
        actions.moveTasksToDate(ids, targetDateStr);
      } else if (actions && actions.moveTaskToDate) {
        ids.forEach(id => actions.moveTaskToDate(id, targetDateStr));
      }
    } else {
      if (actions && actions.moveTaskToDate) {
        actions.moveTaskToDate(taskId, targetDateStr);
      }
      selectedTaskIds.delete(strId);
    }
    renderTriageView();
  }

  function completeTriageSingleTask(taskId, event) {
    if (event) event.stopPropagation();
    selectedTaskIds.delete(String(taskId));

    const actions = getActions();
    if (actions && actions.completeTask) {
      actions.completeTask(taskId);
    }
    renderTriageView();
  }

  function deleteTriageSingleTask(taskId, event) {
    if (event) event.stopPropagation();
    selectedTaskIds.delete(String(taskId));

    const actions = getActions();
    if (actions && actions.deleteTask) {
      actions.deleteTask(taskId);
    }
    renderTriageView();
  }

  function openTriageSingleUrgency(taskId, event) {
    if (event) event.stopPropagation();
    activeSingleUrgencyTaskId = String(taskId);
    const popover = document.getElementById('triageSingleUrgencyPopover');
    if (!popover) return;
    const btn = event.currentTarget || event.target;
    if (!btn || typeof btn.getBoundingClientRect !== 'function') {
      popover.style.display = 'block';
      return;
    }
    const rect = btn.getBoundingClientRect();
    const rectTop = (rect.top !== undefined && rect.top !== null) ? rect.top : (rect.bottom - 28);
    const popoverWidth = 160;
    const popoverHeight = 175;

    // Posición horizontal (anclado a la izquierda del botón pero manteniéndose en pantalla)
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - popoverWidth - 10);
    }
    if (left < 10) left = 10;

    // Posición vertical: por defecto justo debajo del botón
    let top = rect.bottom + 4;

    // Si desborda por abajo de la ventana, mostramos el popover hacia arriba del botón
    if (top + popoverHeight > window.innerHeight - 10) {
      if (rectTop - popoverHeight - 4 >= 10) {
        // Cabe arriba
        top = rectTop - popoverHeight - 4;
      } else {
        // Si no cabe completamente ni arriba ni abajo, ajustamos al borde visible de la ventana
        top = Math.max(10, window.innerHeight - popoverHeight - 10);
      }
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.display = 'block';
  }

  function applyTriageSingleUrgency(urgency) {
    if (!activeSingleUrgencyTaskId) return;
    const actions = getActions();
    if (actions && actions.setTaskUrgency) {
      actions.setTaskUrgency(activeSingleUrgencyTaskId, urgency);
    }
    closeTriagePopovers();
    renderTriageView();
  }

  function closeTriagePopovers() {
    activeSingleUrgencyTaskId = null;
    const popover = document.getElementById('triageSingleUrgencyPopover');
    if (popover) popover.style.display = 'none';
    const moveDropdown = document.getElementById('triageMoveDropdown');
    if (moveDropdown) moveDropdown.style.display = 'none';
    const batchUrgencyDropdown = document.getElementById('triageBatchUrgencyDropdown');
    if (batchUrgencyDropdown) batchUrgencyDropdown.style.display = 'none';
  }

  // ACCIONES EN LOTE
  function executeTriageMoveSelectedDate(targetDateStr) {
    if (selectedTaskIds.size === 0 || !targetDateStr) return;
    const ids = Array.from(selectedTaskIds);
    const actions = getActions();
    if (actions && actions.moveTasksToDate) {
      actions.moveTasksToDate(ids, targetDateStr);
    }
    selectedTaskIds.clear();
    closeTriagePopovers();
    renderTriageView();
  }

  function executeTriageBatchUrgency(urgency) {
    if (selectedTaskIds.size === 0 || !urgency) return;
    const ids = Array.from(selectedTaskIds);
    const actions = getActions();
    if (actions && actions.setTasksUrgency) {
      actions.setTasksUrgency(ids, urgency);
    }
    selectedTaskIds.clear();
    closeTriagePopovers();
    renderTriageView();
  }

  function executeTriageBatchStar(enable) {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    const actions = getActions();
    if (actions && actions.setTasksFeatured) {
      actions.setTasksFeatured(ids, enable);
    }
    renderTriageView();
  }

  function executeTriageBatchDelete() {
    if (selectedTaskIds.size === 0) return;
    const count = selectedTaskIds.size;
    if (typeof window !== 'undefined' && !window.confirm(t('triage.confirmDeleteBatch', { count }))) {
      return;
    }
    const state = getState();
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const ids = Array.from(selectedTaskIds);
    const actions = getActions();

    const recurringTasks = [];
    const normalIds = [];

    ids.forEach(id => {
      const task = activeTasks.find(x => String(x.id) === String(id)) ||
                   (state.tasks || []).find(x => String(x.id) === String(id));
      if (task && task.ruleId) {
        recurringTasks.push(task);
      } else {
        normalIds.push(id);
      }
    });

    if (recurringTasks.length > 0 && actions.deleteRecurringTaskInstance) {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(t('triage.undoDeleteBatch', { count: ids.length }));
      }
      recurringTasks.forEach(task => {
        actions.deleteRecurringTaskInstance(task.ruleId, targetDateStr);
      });
    }

    if (normalIds.length > 0 && actions.deleteTasks) {
      actions.deleteTasks(normalIds);
    }

    selectedTaskIds.clear();
    renderTriageView();
  }

  function executeTriageBatchComplete() {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    selectedTaskIds.clear();
    closeTriagePopovers();

    const actions = getActions();
    if (actions && actions.completeTasks) {
      actions.completeTasks(ids);
    } else if (actions && actions.completeTask) {
      ids.forEach(id => actions.completeTask(id));
    }
    renderTriageView();
  }

  function toggleTriageDropdown(dropdownId, event) {
    if (event) event.stopPropagation();
    const el = document.getElementById(dropdownId);
    if (!el) return;
    const isVisible = el.style.display === 'block';
    closeTriagePopovers();
    if (!isVisible) {
      el.style.display = 'block';
    }
  }

  function renderTriageCompletedRow(task) {
    const isRecurring = !!(task.isRecurring || task.ruleId);
    return `
      <div class="triage-task-row is-completed triage-completed-item" data-task-id="${escapeAttr(task.id)}">
        <div class="triage-task-left">
          <span class="status-badge completed" style="margin-right:6px;">✓</span>
          ${task.displayId ? `<button type="button" class="task-id-badge" onclick="app.copyTaskId('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('tasks.copyIdTooltip', { id: task.displayId }))}">${escapeHtml(task.displayId)}</button>` : ''}
          <span class="triage-task-title" style="text-decoration:line-through;opacity:0.7;" title="${escapeAttr(task.title)}">
            ${formatTitleWithTags(task.title, 'app.filterByTag')}
          </span>
          <span class="triage-task-duration" title="${escapeAttr(t('triage.durationTooltip'))}">${formatShortDuration(task.planned || 0)}</span>
          ${isRecurring ? `<span class="triage-recurring-icon" style="margin-left:6px;" title="${escapeAttr(t('tasks.recurringTagLabel'))}">🔁</span>` : ''}
        </div>
        <div class="triage-task-right">
          <button type="button" class="btn small secondary" onclick="app.uncompleteTask('${escapeAttr(task.id)}')" title="${escapeAttr(t('summary.btnReopenTitle'))}">
            ${t('summary.btnReopen')}
          </button>
        </div>
      </div>
    `;
  }

  function triageTaskDragStart(event, taskId) {
    const actions = getActions();
    if (actions && actions.taskDragStart) {
      actions.taskDragStart(event, taskId, selectedTaskIds);
    }
  }

  function triageTaskDrop(event, taskId) {
    const actions = getActions();
    if (actions && actions.taskDrop) {
      actions.taskDrop(event, taskId, selectedTaskIds);
    }
    renderTriageView();
  }

  function renderTriageTaskRow(task, env, quick5Days) {
    const state = getState();
    const isSelected = selectedTaskIds.has(String(task.id));
    const urgencyKey = task.urgency || DEFAULT_URGENCY;
    const uInfo = URGENCY_LEVELS[urgencyKey] || URGENCY_LEVELS[DEFAULT_URGENCY];
    const urgencyLabel = t('urgency.' + urgencyKey) || uInfo.label;
    const isRecurring = !!(task.isRecurring || task.ruleId);

    let recurringTag = '';
    if (isRecurring) {
      let ruleTooltip = t('triage.recurringTooltipDefault');
      if (task.ruleId) {
        const envKey = state.activeEnv || 'work';
        const envObj = state.environments ? (state.environments[envKey] || state.environments.work) : null;
        const rule = envObj && Array.isArray(envObj.recurringTasks) ? envObj.recurringTasks.find(r => String(r.id) === String(task.ruleId)) : null;
        if (rule) {
          const formatted = formatRecurrenceRule(rule);
          ruleTooltip = t('triage.recurringTooltipDetails', { summary: formatted.summaryText, range: formatted.dateRangeText });
        }
      }
      recurringTag = `
        <button type="button" class="tag recurring-tag-btn triage-recurring-btn" onclick="app.openRecurringInfoPopover('${escapeAttr(task.id)}', event, 'task')" title="${escapeAttr(ruleTooltip)}" aria-label="${escapeAttr(t('tasks.recurringTagLabel'))}">
          <span class="triage-recurring-icon" aria-hidden="true">🔁</span>
          <span class="triage-recurring-label">${t('triage.recurringLabel')}</span>
        </button>
      `;
    }

    const isDraggable = task.status === "pending" || task.status === "paused";
    const dragAttrs = isDraggable
      ? `draggable="true"
         ondragstart="app.triageTaskDragStart(event, '${escapeAttr(task.id)}')"
         ondragover="app.taskDragOver(event)"
         ondragleave="app.taskDragLeave(event)"
         ondrop="app.triageTaskDrop(event, '${escapeAttr(task.id)}')"
         ondragend="app.taskDragEnd(event)"`
      : '';
    const dragHandle = isDraggable
      ? `<span class="drag-handle triage-drag-handle" title="${escapeAttr(t('triage.touchDragHint'))}" onmousedown="app.armTaskDrag()">⠿</span>`
      : '';

    const isBlocked = env ? isTaskBlocked(task, env) : false;
    const blockingDetails = env ? getTaskBlockingDetails(task, env) : [];
    const uncompletedBlockers = blockingDetails.filter(d => !d.isCompleted);
    const blockedByList = env ? getTasksBlockedBy(task.id, env) : [];

    let triageDepBadges = '';
    if (isBlocked) {
      const firstBlocker = uncompletedBlockers[0];
      const extraCount = uncompletedBlockers.length > 1 ? ` (+${uncompletedBlockers.length - 1})` : '';
      const blockerDisplay = firstBlocker?.displayId || '...';
      const blockerDate = firstBlocker?.dateStr || '';
      const blockingListStr = uncompletedBlockers.map(b => (b.displayId ? `[${b.displayId}] ` : '') + b.title).join(', ');
      triageDepBadges += `
        <button type="button" class="task-dep-badge blocked" onclick="event.stopPropagation(); app.goToTask('${escapeAttr(firstBlocker?.id || '')}', '${escapeAttr(blockerDate)}')" title="${escapeAttr(t('tasks.blockedTooltip'))}: ${escapeAttr(blockingListStr)}">
          🔒 ${escapeHtml(t('tasks.blockedBadge'))} (${escapeHtml(blockerDisplay)}${escapeHtml(extraCount)})
        </button>
      `;
    } else if (task.dependsOn && task.dependsOn.length > 0) {
      const firstDepFound = env ? findTaskInEnvironment(env, task.dependsOn[0]) : null;
      const depDisplay = firstDepFound?.task?.displayId || '...';
      triageDepBadges += `
        <span class="task-dep-badge unlocked" title="${escapeAttr(t('tasks.badgeUnlocked'))}">
          🔓 ${escapeHtml(depDisplay)} ✓
        </span>
      `;
    }
    if (blockedByList.length > 0) {
      const firstTarget = blockedByList[0];
      const extraBlocked = blockedByList.length > 1 ? ` (+${blockedByList.length - 1})` : '';
      const targetDisplay = firstTarget.displayId || '...';
      const targetDate = firstTarget.dateStr || '';
      const blockedListStr = blockedByList.map(b => (b.displayId ? `[${b.displayId}] ` : '') + b.title).join(', ');
      triageDepBadges += `
        <button type="button" class="task-dep-badge blocking" onclick="event.stopPropagation(); app.goToTask('${escapeAttr(firstTarget.id)}', '${escapeAttr(targetDate)}')" title="${escapeAttr(t('tasks.blocksTooltip', { id: targetDisplay, title: blockedListStr }))}">
          ⛓️ ${escapeHtml(targetDisplay)}${escapeHtml(extraBlocked)}
        </button>
      `;
    }

    return `
      <div class="triage-task-row ${isSelected ? 'selected' : ''} ${isRecurring ? 'is-recurring' : ''} ${isBlocked ? 'is-blocked' : ''}" data-task-id="${escapeAttr(task.id)}"
           onclick="app.handleTriageRowClick('${escapeAttr(task.id)}', event)"
           ondblclick="app.handleTriageRowDblClick('${escapeAttr(task.id)}', event)"
           ontouchstart="app.handleTriageTouchStart('${escapeAttr(task.id)}', event)"
           ontouchmove="app.handleTriageTouchMove(event)"
           ontouchend="app.handleTriageTouchEnd(event)"
           ontouchcancel="app.handleTriageTouchCancel(event)"
           ${dragAttrs}>
        <!-- LADO IZQUIERDO: PUNTITOS, CHECKBOX, ESTRELLA, NOMBRE + DURACIÓN (EN 1 LÍNEA) -->
        <div class="triage-task-left">
          ${dragHandle}
          <input type="checkbox" class="triage-task-cb" ${isSelected ? 'checked' : ''} onclick="app.toggleTriageTaskSelect('${escapeAttr(task.id)}', event)">
          <button type="button" class="triage-star-btn ${task.featured ? 'is-featured' : ''}" onclick="app.toggleTriageTaskStar('${escapeAttr(task.id)}', event)" title="${task.featured ? escapeAttr(t('triage.unstarTooltip')) : escapeAttr(t('triage.starTooltip'))}">
            ${task.featured ? '⭐' : '☆'}
          </button>
          ${task.displayId ? `<button type="button" class="task-id-badge" onclick="app.copyTaskId('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('tasks.copyIdTooltip', { id: task.displayId }))}">${escapeHtml(task.displayId)}</button>` : ''}
          ${triageDepBadges}
          <span class="triage-task-title ${task.overflow ? 'is-overflow' : ''}" title="${escapeAttr(task.title)}">
            ${formatTitleWithTags(task.title, 'app.filterByTag')}
          </span>
          <span class="triage-task-duration" title="${escapeAttr(t('triage.durationTooltip'))}">${formatShortDuration(task.planned || 0)}</span>
          ${recurringTag}
          ${task.overflow ? `<span class="triage-overflow-tag" title="${escapeAttr(t('triage.overflowTooltip'))}">${t('triage.overflowTag')}</span>` : ''}
        </div>

        <!-- LADO DERECHO: ACCIONES DIRECTAS EN LA MISMA LÍNEA -->
        <div class="triage-task-right">
          <!-- BOTÓN URGENCIA CON MENU -->
          <button type="button" class="triage-urgency-btn urgency-btn-${escapeAttr(urgencyKey)}" onclick="app.openTriageSingleUrgency('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('triage.urgencyButtonTooltip', { label: urgencyLabel }))}">
            <span>${uInfo.icon}</span>
            <span class="triage-urgency-text">${escapeHtml(urgencyLabel)}</span>
            <span class="triage-chevron-mini">▾</span>
          </button>

          <!-- 5 BOTONES RÁPIDOS DE FECHA LABORABLE -->
          <div class="triage-quick-days-wrap">
            ${quick5Days.map(d => `
              <button type="button" class="triage-quick-day-btn" onclick="app.moveTriageTaskToDate('${escapeAttr(task.id)}', '${escapeAttr(d.date)}', '${escapeAttr(d.label)}', event)" title="${escapeAttr(t('triage.quickMoveTooltip', { label: d.label, date: d.date }))}">
                ${escapeHtml(d.shortChip)}
              </button>
            `).join('')}
          </div>

          <!-- BOTÓN COPIAR REFERENCIA -->
          <button type="button" class="triage-copy-btn icon-btn" onclick="app.copyTaskReference('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('tasks.copyReferenceTooltip', { id: task.displayId || '' }))}">
            <svg class="copy-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>

          <!-- BOTÓN COMPLETAR -->
          <button type="button" class="triage-complete-btn" onclick="app.completeTriageSingleTask('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('triage.completeTaskTooltip'))}">
            ✓
          </button>

          <!-- BOTÓN BORRAR -->
          <button type="button" class="triage-delete-btn" onclick="app.deleteTriageSingleTask('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('triage.deleteTaskTooltip'))}">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  function renderTriageGroupsContent(activeTasks, groups, isSearching, matchingCompleted, friendlyDate, searchQuery, env, quick5Days) {
    if (!isSearching && activeTasks.length === 0) {
      return `
        <div class="triage-empty-state">
          <span class="triage-empty-icon">🎉</span>
          <h3>${t('triage.emptyHeading')}</h3>
          <p>${t('triage.emptyText', { date: escapeHtml(friendlyDate) })}</p>
          <button class="btn primary small" onclick="window.location.hash='#/'">${t('triage.emptyBackBtn')}</button>
        </div>
      `;
    }

    if (isSearching && activeTasks.length === 0 && matchingCompleted.length === 0) {
      return `
        <div class="search-results-info">
          <span>${t('tasks.searchTitle', { queryHtml: `<strong>"${escapeHtml(searchQuery)}"</strong>` })}</span>
          <button class="search-clear-link" onclick="app.clearTriageSearch()">${t('tasks.searchClear')}</button>
        </div>
        <div class="empty" style="padding:20px;text-align:center;">${t('tasks.searchNoResults', { query: escapeHtml(searchQuery) })}</div>
      `;
    }

    let html = '';

    if (isSearching) {
      html += `
        <div class="search-results-info">
          <span>${t('tasks.searchResultsHeader', { queryHtml: `<strong>"${escapeHtml(searchQuery)}"</strong>`, active: activeTasks.length, completed: matchingCompleted.length })}</span>
          <button class="search-clear-link" onclick="app.clearTriageSearch()">${t('tasks.searchClear')}</button>
        </div>
      `;
    }

    // Grupos de tareas activas
    groups.forEach(g => {
      const groupDuration = g.tasks.reduce((sum, task) => sum + (task.planned || 0), 0);
      const isCollapsed = collapsedGroups.has(g.id);
      const allSelected = g.tasks.length > 0 && g.tasks.every(task => selectedTaskIds.has(String(task.id)));
      const someSelected = g.tasks.some(task => selectedTaskIds.has(String(task.id))) && !allSelected;

      html += `
        <div class="triage-group-card ${isCollapsed ? 'collapsed' : ''}" id="triage-group-${escapeAttr(g.id)}">
          <!-- CABECERA DE GRUPO -->
          <div class="triage-group-header" onclick="app.toggleTriageGroup('${escapeAttr(g.id)}')">
            <div class="triage-group-header-left">
              <button type="button" class="triage-chevron-btn" title="${isCollapsed ? escapeAttr(t('triage.groupExpandTooltip')) : escapeAttr(t('triage.groupCollapseTooltip'))}">
                ▾
              </button>
              <input type="checkbox" class="triage-group-cb" ${allSelected ? 'checked' : ''} ${someSelected ? 'data-indeterminate="true"' : ''} onclick="app.toggleTriageGroupSelect('${escapeAttr(g.id)}', event)" title="${escapeAttr(t('triage.groupSelectAllTooltip'))}">
              <span class="triage-group-icon">${g.icon}</span>
              <span class="triage-group-title">${escapeHtml(g.title)}</span>
              <span class="triage-group-badge">${t('triage.groupTaskCount', { count: g.tasks.length })}</span>
            </div>
            <div class="triage-group-header-right">
              <span class="triage-group-duration">⏱️ ${formatShortDuration(groupDuration)}</span>
            </div>
          </div>

          <!-- CONTENIDO PLEGABLE DEL GRUPO -->
          <div class="triage-group-body" style="${isCollapsed ? 'display:none;' : ''}">
            ${g.tasks.length === 0 ? `
              <div class="triage-group-empty">${t('triage.groupEmpty')}</div>
            ` : `
              <div class="triage-tasks-list">
                ${g.tasks.map(task => renderTriageTaskRow(task, env, quick5Days)).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    });

    // Sección de tareas completadas coincidentes (solo si se está buscando)
    if (isSearching && matchingCompleted.length > 0) {
      html += `
        <div class="search-section-heading completed-heading" style="margin-top:16px;">
          <span>${t('tasks.searchSectionCompleted', { count: matchingCompleted.length })}</span>
        </div>
        <div class="triage-completed-list">
          ${matchingCompleted.map(task => renderTriageCompletedRow(task)).join('')}
        </div>
      `;
    }

    return html;
  }

  function setupTriageSearch() {
    const input = document.getElementById('triageSearchInput');
    const clearBtn = document.getElementById('triageSearchClearBtn');
    if (input && !input._hasTriageSearchEvents) {
      input._hasTriageSearchEvents = true;
      input.addEventListener('input', (e) => {
        setTriageSearchQuery(e.target.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          e.preventDefault();
          e.stopPropagation();
          clearTriageSearch();
        }
      });
      if (typeof window !== 'undefined' && window.app && window.app.attachTagAutocompleteToEl) {
        window.app.attachTagAutocompleteToEl(input);
      }
    }
    if (clearBtn && !clearBtn._hasTriageSearchEvents) {
      clearBtn._hasTriageSearchEvents = true;
      clearBtn.addEventListener('click', () => {
        clearTriageSearch();
      });
    }
  }

  function renderTriageView() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('view-triage');
    if (!container) return;

    const state = getState();
    const targetDateStr = getTargetDateStr();
    const isDifferentDate = lastRenderedDate !== targetDateStr;
    if (isDifferentDate) {
      lastRenderedDate = targetDateStr;
      selectedTaskIds.clear();
      closeTriagePopovers();
    }
    const allActiveTasks = getActiveTasks(targetDateStr);
    const searchQuery = (triageSearchQuery || '').trim();
    const isSearching = searchQuery.length > 0;

    const activeTasks = isSearching
      ? allActiveTasks.filter(t => matchesTaskSearch(t, searchQuery))
      : allActiveTasks;

    const allTasksOfDate = getAllTasks(targetDateStr);
    const matchingCompleted = isSearching
      ? allTasksOfDate.filter(t => t && t.status === 'completed' && matchesTaskSearch(t, searchQuery))
                      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      : [];

    const groups = getGroups(activeTasks, targetDateStr);

    const next7Days = getNextWorkingDays(targetDateStr, 7, state, state.activeEnv || 'work');
    const quick5Days = next7Days.slice(0, 5);

    const totalMinutes = activeTasks.reduce((sum, task) => sum + (task.planned || 0), 0);
    const friendlyDate = formatDateFriendly ? formatDateFriendly(targetDateStr) : targetDateStr;
    const selectedCount = selectedTaskIds.size;

    const sortButtons = [
      { id: 'urgency', label: t('triage.sortUrgency') },
      { id: 'viability', label: t('triage.sortViability') },
      { id: 'duration', label: t('triage.sortDuration') },
      { id: 'featured', label: t('triage.sortFeatured') }
    ];

    const taskEdit = (getTaskEdit ? getTaskEdit() : (ctx.getTaskEdit ? ctx.getTaskEdit() : null));
    let modalHost = document.getElementById('triageEditModalHost');
    if (!modalHost && typeof document !== 'undefined' && document.body) {
      modalHost = document.createElement('div');
      modalHost.id = 'triageEditModalHost';
      document.body.appendChild(modalHost);
    }
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
    if (modalHost) {
      if (taskEdit && taskEdit.id) {
        const isNewTask = taskEdit.isNew || String(taskEdit.id) === '__new__';
        const editUrgency = taskEdit.urgency || DEFAULT_URGENCY;
        const editUrgencyInfo = URGENCY_LEVELS[editUrgency] || URGENCY_LEVELS[DEFAULT_URGENCY];
        const modalTitle = isNewTask
          ? t('triage.modalTitleNewTask')
          : (taskEdit.mode === 'series'
            ? t('triage.editModalTitleSeries')
            : (taskEdit.ruleId ? t('triage.editModalTitleInstance') : t('triage.editModalTitleTask')));
        const modalIcon = isNewTask ? '＋' : '✎';
        const saveBtnText = isNewTask ? t('triage.addTaskSubmit') : t('action.save');
        const urgencyLabel = t('urgency.' + editUrgency) || editUrgencyInfo.label;

        modalHost.innerHTML = `
          <div class="modal-overlay" id="triageTaskEditModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100000;align-items:center;justify-content:center;" onclick="if(event.target===this) app.cancelEditTask()">
            <div class="modal-box triage-edit-modal-box" onclick="event.stopPropagation()">
              <div class="triage-edit-modal-header">
                <h3><span>${modalIcon}</span> ${escapeHtml(modalTitle)}</h3>
                <button type="button" class="close-modal-btn" onclick="app.cancelEditTask()" title="${escapeAttr(t('action.close'))} (Esc)" aria-label="${escapeAttr(t('action.close'))}">&times;</button>
              </div>

              <div class="triage-edit-modal-body">
                <div style="margin-bottom:12px;">
                  <label class="triage-edit-label">${t('triage.editLabelTitle')}</label>
                  <input type="text" id="triageEditTitleInput" class="triage-edit-input" value="${escapeAttr(taskEdit.title)}" onfocus="if(window.app && window.app.attachTagAutocompleteToEl) window.app.attachTagAutocompleteToEl(this)" oninput="if(window.app) window.app.updateTaskEditField('title', this.value)" onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); if(window.app) window.app.saveEditTask('${escapeAttr(taskEdit.id)}'); }" placeholder="${escapeAttr(t('tasks.inputTitlePlaceholder'))}">
                </div>

                <div class="triage-edit-time-grid">
                  <label class="triage-edit-label">
                    ${t('tasks.editPlanned')}
                    <input type="text" id="triageEditDurationInput" class="triage-edit-input" value="${escapeAttr(taskEdit.duration)}" placeholder="${escapeAttr(t('tasks.editDurationPlaceholder'))}" oninput="if(window.app) window.app.updateTaskEditField('duration', this.value)">
                  </label>
                  ${!isNewTask ? `
                  <label class="triage-edit-label">
                    ${t('tasks.editSpent')}
                    <input type="text" id="triageEditActualInput" class="triage-edit-input" value="${escapeAttr(taskEdit.actual||0)}" placeholder="${escapeAttr(t('tasks.editActualPlaceholder'))}" oninput="if(window.app) window.app.updateTaskEditField('actual', this.value)">
                  </label>` : ''}
                  <label class="triage-edit-label">
                    ${t('tasks.editStartAfter')}
                    <input type="time" id="triageEditStartAfterInput" class="triage-edit-input" value="${escapeAttr(taskEdit.startAfter || '')}" oninput="if(window.app) window.app.updateTaskEditField('startAfter', this.value)">
                  </label>
                </div>

                <div class="triage-edit-badges-row">
                  <button type="button" class="urgency-pill-btn urgency-btn-${escapeAttr(editUrgency)}"
                          onclick="app.openEditUrgencyDropdown('${escapeAttr(taskEdit.id)}', event)"
                          title="${escapeAttr(t('tasks.editUrgencyTooltip', { label: urgencyLabel }))}"
                          id="edit-urgency-pill-${escapeAttr(taskEdit.id)}">
                    <span>${editUrgencyInfo.icon}</span>
                    <span>${escapeHtml(urgencyLabel)}</span>
                    <span class="urgency-pill-chevron">▾</span>
                  </button>

                  <button type="button" class="icon-btn star-btn ${taskEdit.featured ? 'is-featured' : ''}"
                          title="${taskEdit.featured ? escapeAttr(t('tasks.unstarTooltip')) : escapeAttr(t('tasks.starTooltip'))}"
                          onclick="app.toggleEditFeatured('${escapeAttr(taskEdit.id)}', event)">
                    ${taskEdit.featured ? '⭐' : '☆'}
                  </button>
                </div>

                <div class="row task-edit-notes-wrap" style="margin-bottom:12px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;width:100%;">
                    <label class="triage-edit-label" style="margin:0;">
                      <span>📝</span> ${t('tasks.editNotesLabel')}
                    </label>
                    <div class="task-notes-mini-toolbar">
                      <button type="button" class="btn-notes-tool" onclick="app.insertEditNotesFormat('${escapeAttr(taskEdit.id)}', '**', '**')" title="${escapeAttr(t('tasks.boldTooltip'))}">B</button>
                      <button type="button" class="btn-notes-tool italic" onclick="app.insertEditNotesFormat('${escapeAttr(taskEdit.id)}', '*', '*')" title="${escapeAttr(t('tasks.italicTooltip'))}">I</button>
                      <button type="button" class="btn-notes-tool" onclick="app.insertEditNotesLink('${escapeAttr(taskEdit.id)}')" title="${escapeAttr(t('tasks.linkTooltip'))}">🔗 Link</button>
                      <button type="button" class="btn-notes-tool" id="btn-preview-edit-${escapeAttr(taskEdit.id)}" onclick="app.toggleEditNotesPreview('${escapeAttr(taskEdit.id)}')" title="${escapeAttr(t('tasks.previewTooltip'))}">👁️</button>
                    </div>
                  </div>
                  <textarea id="task-edit-notes-${escapeAttr(taskEdit.id)}" class="task-edit-notes-textarea" rows="3" placeholder="${escapeAttr(t('tasks.notesPlaceholder'))}" onfocus="if(window.app && window.app.attachTagAutocompleteToEl) window.app.attachTagAutocompleteToEl(this)" oninput="if(window.app) window.app.updateTaskEditField('notes', this.value)">${escapeHtml(taskEdit.notes || '')}</textarea>
                  <div id="task-edit-notes-preview-${escapeAttr(taskEdit.id)}" class="task-edit-notes-preview task-note-content" style="display:none;margin-top:6px;"></div>
                </div>

                ${isNewTask ? `
                <div class="triage-edit-recurring-section" style="margin-top:8px;margin-bottom:8px;padding-top:8px;border-top:1px solid var(--border,#e2e8f0);">
                  <label style="font-size:0.85rem;display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:var(--ink);font-weight:500;">
                    <input type="checkbox" id="triageEditIsRecurringCb" ${taskEdit.isRecurring ? 'checked' : ''} onchange="app.toggleTriageEditRecurring(this.checked)">
                    <span>${t('tasks.recurringLabel')}</span>
                  </label>

                  <div id="triageRecurringOptions" class="recurring-form-options-panel" style="display:${taskEdit.isRecurring ? 'block' : 'none'};margin-top:8px;">
                    <div class="rec-form-grid">
                      <div class="rec-form-field">
                        <label class="rec-form-label" for="triageRecFreq">${t('recurrence.freqLabel')}</label>
                        <select id="triageRecFreq" class="rec-form-select" onchange="app.onTriageRecurrenceFreqChange(this.value)">
                          <option value="weekly" ${(taskEdit.recurringFreq || 'weekly') === 'weekly' ? 'selected' : ''}>${t('recurrence.freqWeekly')}</option>
                          <option value="daily" ${taskEdit.recurringFreq === 'daily' ? 'selected' : ''}>${t('recurrence.freqDaily')}</option>
                        </select>
                      </div>
                      <div class="rec-form-field">
                        <label class="rec-form-label" for="triageRecInterval">${t('recurrence.repeatEvery')}</label>
                        <div style="display:flex;align-items:center;gap:6px;">
                          <input type="number" id="triageRecInterval" value="${escapeAttr(taskEdit.recurringInterval || 1)}" min="1" max="99" class="rec-form-input-number" style="width:65px;" oninput="app.updateTaskEditField('recurringInterval', parseInt(this.value,10)||1)">
                          <span id="triageRecIntervalUnit" class="rec-form-unit-label">${(taskEdit.recurringFreq || 'weekly') === 'daily' ? t('recurrence.unitDays') : t('recurrence.unitWeeks')}</span>
                        </div>
                      </div>
                    </div>

                    <div id="triageRecDaysWrap" class="rec-form-field" style="margin-top:8px;display:${(taskEdit.recurringFreq || 'weekly') === 'daily' ? 'none' : 'block'};">
                      <label class="rec-form-label">${t('recurrence.daysLabel')}</label>
                      <div class="rec-pop-days-row" id="triageRecDaysRow">
                        ${[1,2,3,4,5,6,7].map(d => {
                          const isSelected = (taskEdit.recurringDaysOfWeek || [1]).includes(d);
                          const dayLetters = t.dayLetters ? t.dayLetters() : ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
                          const dayNames = t.days ? t.days() : ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                          const title = d === 7 ? dayNames[0] : dayNames[d];
                          return `<button type="button" class="rec-pop-day-btn ${isSelected ? 'active' : ''}" data-day="${d}" onclick="app.toggleTriageRecurrenceDay(${d})" title="${escapeAttr(title)}">${dayLetters[d]}</button>`;
                        }).join('')}
                      </div>
                    </div>

                    <div class="rec-form-field" style="margin-top:8px;">
                      <div style="display:flex;align-items:center;justify-content:space-between;">
                        <label class="rec-form-label" for="triageRecEndDate">${t('recurrence.endDateLabel')}</label>
                        <button type="button" class="rec-pop-link-btn" onclick="app.clearTriageRecurrenceEndDate()">${t('recurrence.noLimitBtn')}</button>
                      </div>
                      <input type="date" id="triageRecEndDate" value="${escapeAttr(taskEdit.recurringEndDate || '')}" class="rec-form-input-date" style="width:100%;" onchange="app.updateTaskEditField('recurringEndDate', this.value || null)">
                    </div>
                  </div>
                </div>` : ''}

                ${(!taskEdit.ruleId && !taskEdit.isRecurring) ? `
                <div id="triageAutoMoveOptionWrap" style="margin-top:6px;margin-bottom:6px;">
                  <label style="font-size:0.82rem;display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:var(--ink);">
                    <input type="checkbox" id="triageEditAutoMoveCb" ${taskEdit.autoMoveToToday ? 'checked' : ''} onchange="app.updateTaskEditField('autoMoveToToday', this.checked)"> ${t('tasks.autoMoveCheckbox')}
                  </label>
                </div>` : ''}

                <div class="task-form-dependencies-row" style="margin-top:8px;margin-bottom:8px;padding-top:8px;border-top:1px solid var(--border,#e2e8f0);">
                  <div class="task-form-dependencies-header">
                    <span class="task-form-dependencies-label" style="font-size:0.85rem;font-weight:500;color:var(--ink);display:inline-flex;align-items:center;gap:5px;">
                      <span>🔒</span> ${t('tasks.dependenciesLabel')}
                    </span>
                    <button type="button" class="btn-add-dependency" onclick="app.openDependencySelector('${escapeAttr(taskEdit.id)}', 'triage')">${t('tasks.addDependencyBtn')}</button>
                  </div>
                  <div class="task-dependencies-chips-list" id="triageTaskDependenciesList">
                    ${renderTriageDependencyChips(taskEdit.dependsOn || [], env)}
                  </div>
                </div>
              </div>

              <div class="triage-edit-modal-footer">
                <button type="button" class="btn secondary small" onclick="app.cancelEditTask()">${t('action.cancel')}</button>
                <button type="button" class="btn primary small done" id="triageEditSaveBtn" onclick="app.saveEditTask('${escapeAttr(taskEdit.id)}')">${escapeHtml(saveBtnText)}</button>
              </div>
            </div>
          </div>
        `;
        // Auto-focus en el título y conectar autocompletado
        setTimeout(() => {
          const input = document.getElementById('triageEditTitleInput');
          const notes = document.getElementById(`task-edit-notes-${taskEdit.id}`);
          if (typeof window !== 'undefined' && window.app && window.app.attachTagAutocompleteToEl) {
            if (input) window.app.attachTagAutocompleteToEl(input);
            if (notes) window.app.attachTagAutocompleteToEl(notes);
          }
          if (input) input.focus();
        }, 50);
      } else {
        // Sin edición activa: limpiar el host
        modalHost.innerHTML = '';
      }
    }

    // Actualización selectiva de DOM si ya existe la vista renderizada y no cambió de fecha
    const innerEl = container.querySelector('.triage-view-inner');
    const searchInpEl = document.getElementById('triageSearchInput');
    if (innerEl && searchInpEl && !isDifferentDate) {
      const groupsContainer = container.querySelector('.triage-groups-container');
      if (groupsContainer) {
        groupsContainer.innerHTML = renderTriageGroupsContent(activeTasks, groups, isSearching, matchingCompleted, friendlyDate, searchQuery, env, quick5Days);
        groupsContainer.querySelectorAll('.triage-group-cb[data-indeterminate="true"]').forEach(cb => {
          cb.indeterminate = true;
        });
      }
      const badgeCountEl = container.querySelector('.triage-badge-count');
      if (badgeCountEl) {
        badgeCountEl.textContent = t('triage.taskCount', { count: allActiveTasks.length });
      }
      const subtitleEl = container.querySelector('.triage-subtitle');
      if (subtitleEl) {
        subtitleEl.innerHTML = t('triage.subtitle', { date: escapeHtml(friendlyDate), dateStr: escapeHtml(targetDateStr), totalTime: formatShortDuration(totalMinutes) });
      }
      const floatingBar = document.getElementById('triageFloatingBar');
      if (floatingBar) {
        floatingBar.className = `triage-floating-bar ${selectedCount > 0 ? 'visible' : ''}`;
        const badge = floatingBar.querySelector('.triage-selected-badge');
        if (badge) badge.textContent = String(selectedCount);
        const selText = floatingBar.querySelector('.triage-selected-text');
        if (selText) selText.innerHTML = t('triage.batchSelectedCount', { count: selectedCount });
      }
      const undoBtn = container.querySelector('#triageUndoBtn');
      if (undoBtn) undoBtn.disabled = !canTriageUndo();
      const redoBtn = container.querySelector('#triageRedoBtn');
      if (redoBtn) redoBtn.disabled = !canTriageRedo();
      container.querySelectorAll('.triage-sort-btn').forEach(btn => {
        const mode = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (mode) {
          btn.className = `triage-sort-btn ${currentSort === mode ? 'active' : ''}`;
        }
      });
      if (searchInpEl.value !== triageSearchQuery) {
        searchInpEl.value = triageSearchQuery;
      }
      const clearBtn = document.getElementById('triageSearchClearBtn');
      if (clearBtn) {
        clearBtn.style.display = isSearching ? 'block' : 'none';
      }
      return;
    }

    let html = `
      <div class="triage-view-inner">
        <!-- TOP BAR -->
        <header class="triage-header">
          <div class="triage-header-left">
            <button class="btn secondary small triage-btn-back" onclick="if(window.location.hash==='#/triage') window.location.hash='#/'; else if(app.showView) app.showView('main');" title="${escapeAttr(t('triage.btnBackTooltip'))}">
              ${t('triage.btnBack')}
            </button>
            <div class="triage-undo-redo-group">
              <button type="button" class="btn secondary small triage-history-btn" id="triageUndoBtn" onclick="app.triageUndo()" ${canTriageUndo() ? '' : 'disabled'} title="${escapeAttr(t('triage.btnUndoTooltip'))}">
                <span class="triage-history-icon">↶</span>
                <span class="triage-history-label">${t('triage.btnUndo')}</span>
              </button>
              <button type="button" class="btn secondary small triage-history-btn" id="triageRedoBtn" onclick="app.triageRedo()" ${canTriageRedo() ? '' : 'disabled'} title="${escapeAttr(t('triage.btnRedoTooltip'))}">
                <span class="triage-history-icon">↷</span>
                <span class="triage-history-label">${t('triage.btnRedo')}</span>
              </button>
            </div>
            <div>
              <div class="triage-title-row">
                <h1 class="triage-title">${t('triage.title')}</h1>
                <span class="triage-badge-count">${t('triage.taskCount', { count: allActiveTasks.length })}</span>
              </div>
              <p class="triage-subtitle">
                ${t('triage.subtitle', { date: escapeHtml(friendlyDate), dateStr: escapeHtml(targetDateStr), totalTime: formatShortDuration(totalMinutes) })}
              </p>
            </div>
          </div>

          <div class="triage-header-right">
            <button type="button" class="btn primary small triage-btn-add-task" id="triageBtnAddTask" onclick="app.openTriageNewTaskModal()" title="${escapeAttr(t('triage.btnAddTaskTooltip'))}">
              ${t('triage.btnAddTask')}
            </button>

            <div class="triage-sort-selector">
              <span class="triage-sort-label">${t('triage.sortLabel')}</span>
              ${sortButtons.map(b => `
                <button class="triage-sort-btn ${currentSort === b.id ? 'active' : ''}" onclick="app.setTriageSortMode('${b.id}')">
                  ${b.label}
                </button>
              `).join('')}
            </div>

            <div class="triage-collapse-tools">
              <button class="btn secondary small" onclick="app.toggleAllTriageGroups(false)" title="${escapeAttr(t('triage.collapseAllTooltip'))}">${t('triage.collapseAll')}</button>
              <button class="btn secondary small" onclick="app.toggleAllTriageGroups(true)" title="${escapeAttr(t('triage.expandAllTooltip'))}">${t('triage.expandAll')}</button>
              <button class="btn secondary small" id="triageAutoOrderBtn" onclick="app.applyAutoOrder()" title="${escapeAttr(t('triage.autoOrderTooltip'))}">${t('triage.autoOrder')}</button>
            </div>
          </div>
        </header>

        <!-- BARRA DE BÚSQUEDA DE TRIAJE -->
        <div class="task-search-bar triage-search-bar" id="triageSearchBar" style="margin-top:12px;margin-bottom:4px;">
          <span class="task-search-icon" aria-hidden="true">🔍</span>
          <input type="text" id="triageSearchInput" class="task-search-input" placeholder="${escapeAttr(t('tasks.searchPlaceholder') || 'Buscar tareas...')}" autocomplete="off" spellcheck="false" title="${escapeAttr(t('tasks.searchTooltip') || 'Buscar en tareas activas y completadas del día (Atajo: /)')}" value="${escapeAttr(triageSearchQuery)}">
          <button type="button" id="triageSearchClearBtn" class="task-search-clear-btn" title="${escapeAttr(t('tasks.searchClearTooltip') || 'Limpiar búsqueda')}" style="display:${isSearching ? 'block' : 'none'};" aria-label="${escapeAttr(t('tasks.searchClearAria') || 'Limpiar búsqueda')}">✕</button>
        </div>

        <!-- GRUPOS DE TAREAS -->
        <main class="triage-groups-container">
          ${renderTriageGroupsContent(activeTasks, groups, isSearching, matchingCompleted, friendlyDate, searchQuery, env, quick5Days)}
        </main>

        <!-- BARRA FLOTANTE DE ACCIONES POR LOTE -->
        <div class="triage-floating-bar ${selectedCount > 0 ? 'visible' : ''}" id="triageFloatingBar">
          <div class="triage-floating-left">
            <span class="triage-selected-badge">${selectedCount}</span>
            <span class="triage-selected-text">${t('triage.batchSelectedCount', { count: selectedCount })}</span>
            <button type="button" class="triage-link-btn" onclick="app.clearTriageSelection()">${t('triage.batchDeselect')}</button>
          </div>

          <div class="triage-floating-actions">
            <!-- BOTONES DE REORDENACIÓN DE POSICIÓN POR LOTE -->
            <div class="triage-batch-move-group">
              <button type="button" class="btn secondary small triage-batch-move-btn triage-batch-move-top" onclick="app.executeTriageBatchMoveDirection('top')" title="${escapeAttr(t('triage.moveToTop') || 'Mover al inicio')}">
                <span>⤒</span>
              </button>
              <button type="button" class="btn secondary small triage-batch-move-btn triage-batch-move-up" onclick="app.executeTriageBatchMoveDirection('up')" title="${escapeAttr(t('triage.moveUp') || 'Subir')}">
                <span>▲</span>
              </button>
              <button type="button" class="btn secondary small triage-batch-move-btn triage-batch-move-down" onclick="app.executeTriageBatchMoveDirection('down')" title="${escapeAttr(t('triage.moveDown') || 'Bajar')}">
                <span>▼</span>
              </button>
              <button type="button" class="btn secondary small triage-batch-move-btn triage-batch-move-bottom" onclick="app.executeTriageBatchMoveDirection('bottom')" title="${escapeAttr(t('triage.moveToBottom') || 'Mover al final')}">
                <span>⤓</span>
              </button>
            </div>

            <!-- BOTÓN MOVER A FECHA (7 DÍAS LABORABLES) -->
            <div class="triage-dropdown-anchor">
              <button type="button" class="btn primary small" onclick="app.toggleTriageDropdown('triageMoveDropdown', event)">
                <span>${t('triage.batchMoveBtn')}</span>
                <span class="triage-chevron-mini">▾</span>
              </button>
              <div class="triage-floating-dropdown" id="triageMoveDropdown" style="display:none;">
                <div class="triage-dropdown-title">${t('triage.batchMoveTitle')}</div>
                <div class="triage-dropdown-list">
                  ${next7Days.map(d => `
                    <button type="button" class="triage-dropdown-item" onclick="app.executeTriageMoveSelectedDate('${escapeAttr(d.date)}')">
                      <span>${escapeHtml(d.label)}</span>
                      <span class="triage-date-sub">${escapeHtml(d.date)}</span>
                    </button>
                  `).join('')}
                </div>
                <div class="triage-dropdown-custom-row">
                  <label class="triage-custom-date-label">${t('triage.batchCustomDate')}</label>
                  <input type="date" class="triage-custom-date-input" onchange="if(this.value) app.executeTriageMoveSelectedDate(this.value)">
                </div>
              </div>
            </div>

            <!-- BOTÓN URGENCIA POR LOTE -->
            <div class="triage-dropdown-anchor">
              <button type="button" class="btn secondary small" onclick="app.toggleTriageDropdown('triageBatchUrgencyDropdown', event)">
                <span>${t('triage.batchUrgencyBtn')}</span>
                <span class="triage-chevron-mini">▾</span>
              </button>
              <div class="triage-floating-dropdown" id="triageBatchUrgencyDropdown" style="display:none;min-width:160px;">
                <div class="triage-dropdown-title">${t('triage.batchUrgencyTitle')}</div>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('today')">
                  <span>🟠</span> <strong>${t('triage.groupToday')}</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('days')">
                  <span>🔵</span> <strong>${t('triage.groupDays')}</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('week')">
                  <span>🟣</span> <strong>${t('triage.groupWeek')}</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('later')">
                  <span>⚪</span> <strong>${t('triage.groupLater')}</strong>
                </button>
              </div>
            </div>

            <!-- BOTONES DESTACAR, COMPLETAR Y ELIMINAR POR LOTE -->
            <button type="button" class="btn secondary small" onclick="app.executeTriageBatchStar(true)" title="${escapeAttr(t('triage.batchStarTooltip'))}">
              ${t('triage.batchStar')}
            </button>
            <button type="button" class="btn secondary small" onclick="app.executeTriageBatchStar(false)" title="${escapeAttr(t('triage.batchUnstarTooltip'))}">
              ${t('triage.batchUnstar')}
            </button>
            <button type="button" class="btn done small" onclick="app.executeTriageBatchComplete()" title="${escapeAttr(t('triage.batchCompleteTooltip'))}">
              ${t('triage.batchComplete')}
            </button>
            <button type="button" class="btn danger small" onclick="app.executeTriageBatchDelete()" title="${escapeAttr(t('triage.batchDeleteTooltip'))}">
              ${t('triage.batchDelete')}
            </button>
          </div>
        </div>

        <!-- POPOVER FLOTANTE PARA CAMBIO INDIVIDUAL DE URGENCIA -->
        <div id="triageSingleUrgencyPopover" class="triage-single-urgency-popover" style="display:none;">
          <div class="triage-dropdown-title">${t('triage.batchUrgencyTitle')}</div>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('today')">
            <span>🟠</span> <strong>${t('triage.groupToday')}</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('days')">
            <span>🔵</span> <strong>${t('triage.groupDays')}</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('week')">
            <span>🟣</span> <strong>${t('triage.groupWeek')}</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('later')">
            <span>⚪</span> <strong>${t('triage.groupLater')}</strong>
          </button>
        </div>

        <!-- BOTÓN FLOTANTE MÓVIL (FAB) PARA AÑADIR TAREA -->
        <button type="button" class="triage-fab-add" id="triageFabAddTask" onclick="app.openTriageNewTaskModal()" title="${escapeAttr(t('triage.fabAddTaskTooltip'))}" aria-label="${escapeAttr(t('triage.fabAddTaskTooltip'))}">
          ＋
        </button>

        <!-- BOTTOM SHEET MÓVIL PARA MOVER TAREA (TRAS LONG-PRESS) -->
        <div id="triageMobileMoveSheet" class="triage-bottom-modal" style="display:none;" onclick="if(event.target===this) app.closeMobileMoveSheet()">
          <div class="triage-bottom-modal-card" onclick="event.stopPropagation()">
            <div class="triage-bottom-modal-header">
              <div>
                <span class="triage-move-sheet-eyebrow">${t('triage.mobileMoveSheetTitle')}</span>
                <h3 id="triageMoveSheetTaskTitle" class="triage-move-sheet-task-title">...</h3>
              </div>
              <button type="button" class="close-modal-btn" onclick="app.closeMobileMoveSheet()">&times;</button>
            </div>
            <div id="triageMoveSheetRunningNotice" style="display:none;padding:8px 12px;margin-bottom:12px;background:rgba(234,179,8,0.12);border:1px solid #EAB308;border-radius:8px;font-size:0.82rem;color:var(--ink);align-items:center;justify-content:space-between;gap:8px;">
              <span>⚠️ ${t('triage.runningTaskMoveNotice')}</span>
              <button type="button" class="btn small primary" style="white-space:nowrap;" onclick="if(app.pauseTask) { app.pauseTask(app.getActiveMoveSheetTaskId()); app.openMobileMoveSheet(app.getActiveMoveSheetTaskId()); }">
                ⏸️ ${t('triage.btnPauseToMove')}
              </button>
            </div>
            <div class="triage-move-sheet-grid">
              <button type="button" class="triage-move-grid-btn" onclick="app.moveTriageTaskDirection(app.getActiveMoveSheetTaskId(), 'up')">
                <span>${t('triage.moveUp')}</span>
              </button>
              <button type="button" class="triage-move-grid-btn" onclick="app.moveTriageTaskDirection(app.getActiveMoveSheetTaskId(), 'down')">
                <span>${t('triage.moveDown')}</span>
              </button>
              <button type="button" class="triage-move-grid-btn" onclick="app.moveTriageTaskDirection(app.getActiveMoveSheetTaskId(), 'top')">
                <span>${t('triage.moveToTop')}</span>
              </button>
              <button type="button" class="triage-move-grid-btn" onclick="app.moveTriageTaskDirection(app.getActiveMoveSheetTaskId(), 'bottom')">
                <span>${t('triage.moveToBottom')}</span>
              </button>
            </div>
            <div class="triage-move-sheet-dates">
              <span class="triage-move-sheet-dates-label">${t('triage.moveSheetDateSection')}</span>
              <div class="triage-move-dates-chips">
                ${quick5Days.map(d => `
                  <button type="button" class="triage-move-date-chip" onclick="app.moveTriageTaskToDate(app.getActiveMoveSheetTaskId(), '${escapeAttr(d.date)}', '${escapeAttr(d.label)}', event); app.closeMobileMoveSheet();">
                    ${escapeHtml(d.label)}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    setupTriageSearch();

    // Restaurar estado indeterminate de checkboxes de grupo
    container.querySelectorAll('.triage-group-cb[data-indeterminate="true"]').forEach(cb => {
      cb.indeterminate = true;
    });
  }

  // Listener global para cerrar menús al hacer clic fuera
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#triageMoveDropdown') &&
          !e.target.closest('#triageBatchUrgencyDropdown') &&
          !e.target.closest('#triageSingleUrgencyPopover') &&
          !e.target.closest('.triage-urgency-btn') &&
          !e.target.closest('.triage-dropdown-anchor')) {
        closeTriagePopovers();
      }
    });
  }

  function applyAutoOrder() {
    const actions = getActions();
    if (actions && actions.applyAutoOrder) {
      actions.applyAutoOrder();
    }
  }

  return {
    renderTriageView,
    setTriageSortMode,
    toggleTriageGroup,
    toggleAllTriageGroups,
    handleTriageRowClick,
    handleTriageRowDblClick,
    toggleTriageTaskSelect,
    toggleTriageGroupSelect,
    clearTriageSelection,
    toggleTriageTaskStar,
    moveTriageTaskToDate,
    completeTriageSingleTask,
    deleteTriageSingleTask,
    openTriageSingleUrgency,
    applyTriageSingleUrgency,
    closeTriagePopovers,
    executeTriageMoveSelectedDate,
    executeTriageBatchUrgency,
    executeTriageBatchStar,
    executeTriageBatchComplete,
    executeTriageBatchDelete,
    toggleTriageDropdown,
    getTargetDateStr,
    applyAutoOrder,
    triageUndo,
    triageRedo,
    canTriageUndo,
    canTriageRedo,
    submitTriageNewTask,
    openTriageNewTaskModal,
    toggleTriageEditRecurring,
    onTriageRecurrenceFreqChange,
    toggleTriageRecurrenceDay,
    clearTriageRecurrenceEndDate,
    openMobileAddModal,
    closeMobileAddModal,
    handleTriageAddBarSubmit,
    handleMobileAddModalSubmit,
    focusTriageAddBar,
    moveTriageTaskDirection,
    executeTriageBatchMoveDirection,
    openMobileMoveSheet,
    closeMobileMoveSheet,
    getActiveMoveSheetTaskId,
    handleTriageTouchStart,
    handleTriageTouchMove,
    handleTriageTouchEnd,
    handleTriageTouchCancel,
    triageTaskDragStart,
    triageTaskDrop,
    getSelectedTaskIds: () => selectedTaskIds,
    setTriageSearchQuery,
    getTriageSearchQuery,
    clearTriageSearch
  };
}

export default TodayTasksTriageView;
