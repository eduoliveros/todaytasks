/* views/triage.js — Vista de Triaje Rápido (#/triage) */
import {
  nowMinutes, fmt, fmtDur, getTaskElapsed, getTodayStr, formatDateFriendly,
  getDayOfWeek, getNextWorkingDays, URGENCY_LEVELS, DEFAULT_URGENCY, MAX_FEATURED_TASKS,
  formatRecurrenceRule
} from '../utils.js';
import { escapeHtml, escapeAttr, showToast } from '../ui.js';
import { computeSchedule } from '../scheduler.js';

export function TodayTasksTriageView(ctx) {
  const { getState, saveState, renderAll, smartRender, actionsModule, getTaskEdit } = ctx;

  let currentSort = 'urgency'; // 'urgency' | 'viability' | 'duration' | 'featured'
  const collapsedGroups = new Set(['days', 'week', 'later']); // por defecto 'today' abierto, resto plegados
  const selectedTaskIds = new Set();
  let activeSingleUrgencyTaskId = null;
  let lastRenderedDate = null;

  function getTargetDateStr() {
    const state = getState();
    return state.selectedDate || getTodayStr();
  }

  function compareTasksMainOrder(a, b) {
    if (a.status === 'running') return -1;
    if (b.status === 'running') return 1;
    return (a.order || 0) - (b.order || 0);
  }

  function getActiveTasks(targetDateStr) {
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

    return tasksList.filter(t => t && t.status !== 'completed').sort(compareTasksMainOrder);
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

    function isTaskOverflow(t) {
      if (!overflowIds || !t) return false;
      const tid = t.id;
      if (overflowIds.has(tid)) return true;
      if (overflowIds.has(String(tid))) return true;
      if (typeof tid === 'string' && !isNaN(Number(tid)) && overflowIds.has(Number(tid))) return true;
      if (typeof tid === 'number' && overflowIds.has(String(tid))) return true;
      return false;
    }

    if (currentSort === 'urgency') {
      const groups = [
        { id: 'today', title: 'Hoy', icon: '🟠', tasks: [] },
        { id: 'days', title: 'Próximos días', icon: '🔵', tasks: [] },
        { id: 'week', title: 'Esta semana', icon: '🟣', tasks: [] },
        { id: 'later', title: 'Más adelante', icon: '⚪', tasks: [] }
      ];
      activeTasks.forEach(t => {
        const u = t.urgency || DEFAULT_URGENCY;
        const g = groups.find(x => x.id === u) || groups[1];
        g.tasks.push({ ...t, overflow: isTaskOverflow(t) });
      });
      // Prioridad máxima al orden manual de la pantalla principal
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (currentSort === 'viability') {
      const isToday = targetDateStr === getTodayStr();
      const groups = [
        { id: 'fits', title: isToday ? 'Caben dentro del horario de hoy' : 'Caben dentro de la jornada', icon: '✅', tasks: [] },
        { id: 'overflow', title: 'Desbordan la jornada (Overflow)', icon: '⚠️', tasks: [] }
      ];
      activeTasks.forEach(t => {
        const isOverflow = isTaskOverflow(t);
        if (!isOverflow) {
          groups[0].tasks.push({ ...t, overflow: false });
        } else {
          groups[1].tasks.push({ ...t, overflow: true });
        }
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (currentSort === 'duration') {
      const groups = [
        { id: 'quick', title: 'Quick Wins (≤ 15 min)', icon: '⚡', tasks: [] },
        { id: 'medium', title: 'Medias (20 a 45 min)', icon: '⏳', tasks: [] },
        { id: 'long', title: 'Largas (> 45 min)', icon: '🏋️', tasks: [] }
      ];
      activeTasks.forEach(t => {
        const dur = t.planned || 0;
        const item = { ...t, overflow: isTaskOverflow(t) };
        if (dur <= 15) groups[0].tasks.push(item);
        else if (dur <= 45) groups[1].tasks.push(item);
        else groups[2].tasks.push(item);
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (currentSort === 'featured') {
      const groups = [
        { id: 'feat', title: 'Tareas Destacadas (⭐ Top 5)', icon: '⭐', tasks: [] },
        { id: 'unfeat', title: 'Otras tareas en cola', icon: '📋', tasks: [] }
      ];
      activeTasks.forEach(t => {
        const item = { ...t, overflow: isTaskOverflow(t) };
        if (t.featured) groups[0].tasks.push(item);
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

  let triageClickTimer = null;
  let lastClickedTaskId = null;
  let lastClickTime = 0;

  function handleTriageRowClick(taskId, event) {
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
    if (event.target.closest('button') || event.target.closest('input[type="checkbox"]') || event.target.closest('.drag-handle')) {
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

    const allSelected = group.tasks.length > 0 && group.tasks.every(t => selectedTaskIds.has(String(t.id)));
    group.tasks.forEach(t => {
      const strId = String(t.id);
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
    const t = activeTasks.find(x => String(x.id) === String(taskId)) ||
              (state.tasks || []).find(x => String(x.id) === String(taskId));
    if (!t) return;
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
    if (actions && actions.moveTaskToDate) {
      actions.moveTaskToDate(taskId, targetDateStr);
    }
    selectedTaskIds.delete(String(taskId));
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
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar las ${count} tareas seleccionadas?`)) {
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
      const t = activeTasks.find(x => String(x.id) === String(id)) ||
                (state.tasks || []).find(x => String(x.id) === String(id));
      if (t && t.ruleId) {
        recurringTasks.push(t);
      } else {
        normalIds.push(id);
      }
    });

    if (recurringTasks.length > 0 && actions.deleteRecurringTaskInstance) {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(`Eliminar ${ids.length} tareas`);
      }
      recurringTasks.forEach(t => {
        actions.deleteRecurringTaskInstance(t.ruleId, targetDateStr);
      });
    }

    if (normalIds.length > 0 && actions.deleteTasks) {
      actions.deleteTasks(normalIds);
    }

    selectedTaskIds.clear();
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

  function renderTriageView() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('view-triage');
    if (!container) return;

    const state = getState();
    const targetDateStr = getTargetDateStr();
    if (lastRenderedDate !== targetDateStr) {
      lastRenderedDate = targetDateStr;
      selectedTaskIds.clear();
      closeTriagePopovers();
    }
    const activeTasks = getActiveTasks(targetDateStr);
    const groups = getGroups(activeTasks, targetDateStr);

    const next7Days = getNextWorkingDays(targetDateStr, 7, state, state.activeEnv || 'work');
    const quick5Days = next7Days.slice(0, 5);

    const totalMinutes = activeTasks.reduce((sum, t) => sum + (t.planned || 0), 0);
    const friendlyDate = formatDateFriendly ? formatDateFriendly(targetDateStr) : targetDateStr;
    const selectedCount = selectedTaskIds.size;

    const sortButtons = [
      { id: 'urgency', label: '🎯 Urgencia' },
      { id: 'viability', label: '⏱️ Viabilidad hoy' },
      { id: 'duration', label: '⏳ Duración' },
      { id: 'featured', label: '⭐ Destacadas' }
    ];

    const taskEdit = (getTaskEdit ? getTaskEdit() : (ctx.getTaskEdit ? ctx.getTaskEdit() : null));
    // El modal de edición se inyecta en un host externo al container para
    // que position:fixed no sea afectado por transforms del ancestro.
    let modalHost = document.getElementById('triageEditModalHost');
    if (!modalHost && typeof document !== 'undefined' && document.body) {
      modalHost = document.createElement('div');
      modalHost.id = 'triageEditModalHost';
      document.body.appendChild(modalHost);
    }
    if (modalHost) {
      if (taskEdit && taskEdit.id) {
        const editUrgency = taskEdit.urgency || DEFAULT_URGENCY;
        const editUrgencyInfo = URGENCY_LEVELS[editUrgency] || URGENCY_LEVELS[DEFAULT_URGENCY];
        modalHost.innerHTML = `
          <div class="modal-overlay" id="triageTaskEditModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100000;align-items:center;justify-content:center;" onclick="if(event.target===this) app.cancelEditTask()">
            <div class="modal-box triage-edit-modal-box" onclick="event.stopPropagation()">
              <div class="triage-edit-modal-header">
                <h3><span>✎</span> ${taskEdit.mode === 'series' ? 'Editar Serie Recurrente 🔁' : (taskEdit.ruleId ? 'Editar Ocurrencia Recurrente 🔁' : 'Editar Tarea')}</h3>
                <button type="button" class="close-modal-btn" onclick="app.cancelEditTask()" title="Cerrar (Esc)" aria-label="Cerrar">&times;</button>
              </div>

              <div class="triage-edit-modal-body">
                <div style="margin-bottom:12px;">
                  <label class="triage-edit-label">Título de la tarea:</label>
                  <input type="text" id="triageEditTitleInput" class="triage-edit-input" value="${escapeAttr(taskEdit.title)}" oninput="app.updateTaskEditField('title', this.value)" placeholder="Título de la tarea">
                </div>

                <div class="triage-edit-time-grid">
                  <label class="triage-edit-label">
                    Planificado:
                    <input type="text" class="triage-edit-input" value="${escapeAttr(taskEdit.duration)}" placeholder="ej. 30, 1h 30m" oninput="app.updateTaskEditField('duration', this.value)">
                  </label>
                  <label class="triage-edit-label">
                    Consumido:
                    <input type="text" class="triage-edit-input" value="${escapeAttr(taskEdit.actual||0)}" placeholder="ej. 15, 1h" oninput="app.updateTaskEditField('actual', this.value)">
                  </label>
                  <label class="triage-edit-label">
                    A partir de:
                    <input type="time" class="triage-edit-input" value="${escapeAttr(taskEdit.startAfter || '')}" oninput="app.updateTaskEditField('startAfter', this.value)">
                  </label>
                </div>

                <div class="triage-edit-badges-row">
                  <button type="button" class="urgency-pill-btn urgency-btn-${escapeAttr(editUrgency)}"
                          onclick="app.openEditUrgencyDropdown('${escapeAttr(taskEdit.id)}', event)"
                          title="Urgencia: ${escapeAttr(editUrgencyInfo.label)} (clic para cambiar)"
                          id="edit-urgency-pill-${escapeAttr(taskEdit.id)}">
                    <span>${editUrgencyInfo.icon}</span>
                    <span>${escapeHtml(editUrgencyInfo.label)}</span>
                    <span class="urgency-pill-chevron">▾</span>
                  </button>

                  <button type="button" class="icon-btn star-btn ${taskEdit.featured ? 'is-featured' : ''}"
                          title="${taskEdit.featured ? 'Quitar destacado' : 'Marcar como destacada (máx. 5 al día)'}"
                          onclick="app.toggleEditFeatured('${escapeAttr(taskEdit.id)}', event)">
                    ${taskEdit.featured ? '⭐' : '☆'}
                  </button>
                </div>

                <div class="row task-edit-notes-wrap" style="margin-bottom:12px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;width:100%;">
                    <label class="triage-edit-label" style="margin:0;">
                      <span>📝</span> Notas / Enlaces (Markdown):
                    </label>
                    <div class="task-notes-mini-toolbar">
                      <button type="button" class="btn-notes-tool" onclick="app.insertEditNotesFormat('${escapeAttr(taskEdit.id)}', '**', '**')" title="Negrita (**texto**)">B</button>
                      <button type="button" class="btn-notes-tool italic" onclick="app.insertEditNotesFormat('${escapeAttr(taskEdit.id)}', '*', '*')" title="Cursiva (*texto*)">I</button>
                      <button type="button" class="btn-notes-tool" onclick="app.insertEditNotesLink('${escapeAttr(taskEdit.id)}')" title="Insertar enlace">🔗 Link</button>
                      <button type="button" class="btn-notes-tool" id="btn-preview-edit-${escapeAttr(taskEdit.id)}" onclick="app.toggleEditNotesPreview('${escapeAttr(taskEdit.id)}')" title="Alternar vista previa">👁️</button>
                    </div>
                  </div>
                  <textarea id="task-edit-notes-${escapeAttr(taskEdit.id)}" class="task-edit-notes-textarea" rows="3" placeholder="Notas, enlaces o contexto (ej. **importante**, https://... o [PR](url))" oninput="app.updateTaskEditField('notes', this.value)">${escapeHtml(taskEdit.notes || '')}</textarea>
                  <div id="task-edit-notes-preview-${escapeAttr(taskEdit.id)}" class="task-edit-notes-preview task-note-content" style="display:none;margin-top:6px;"></div>
                </div>

                ${!taskEdit.ruleId ? `
                <div style="margin-top:6px;margin-bottom:6px;">
                  <label style="font-size:0.82rem;display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:var(--ink);">
                    <input type="checkbox" ${taskEdit.autoMoveToToday ? 'checked' : ''} onchange="app.updateTaskEditField('autoMoveToToday', this.checked)"> Auto-mover a hoy si no se completa
                  </label>
                </div>` : ''}
              </div>

              <div class="triage-edit-modal-footer">
                <button type="button" class="btn secondary small" onclick="app.cancelEditTask()">Cancelar</button>
                <button type="button" class="btn primary small done" onclick="app.saveEditTask('${escapeAttr(taskEdit.id)}')">Guardar</button>
              </div>
            </div>
          </div>
        `;
        // Auto-focus en el título
        setTimeout(() => {
          const input = document.getElementById('triageEditTitleInput');
          if (input) input.focus();
        }, 50);
      } else {
        // Sin edición activa: limpiar el host
        modalHost.innerHTML = '';
      }
    }

    let html = `
      <div class="triage-view-inner">
        <!-- TOP BAR -->
        <header class="triage-header">
          <div class="triage-header-left">
            <button class="btn secondary small triage-btn-back" onclick="if(window.location.hash==='#/triage') window.location.hash='#/'; else if(app.showView) app.showView('main');" title="Volver al tablero (Esc o X)">
              ← Tablero [X]
            </button>
            <div>
              <div class="triage-title-row">
                <h1 class="triage-title">⚡ Triaje Rápido</h1>
                <span class="triage-badge-count">${activeTasks.length} ${activeTasks.length === 1 ? 'tarea' : 'tareas acumuladas'}</span>
              </div>
              <p class="triage-subtitle">
                Tareas de <strong>${escapeHtml(friendlyDate)}</strong> (${escapeHtml(targetDateStr)}) · Estimación total: <strong>${formatShortDuration(totalMinutes)}</strong>
              </p>
            </div>
          </div>

          <div class="triage-header-right">
            <div class="triage-sort-selector">
              <span class="triage-sort-label">Ordenar:</span>
              ${sortButtons.map(b => `
                <button class="triage-sort-btn ${currentSort === b.id ? 'active' : ''}" onclick="app.setTriageSortMode('${b.id}')">
                  ${b.label}
                </button>
              `).join('')}
            </div>

            <div class="triage-collapse-tools">
              <button class="btn secondary small" onclick="app.toggleAllTriageGroups(false)" title="Plegar todos los grupos">▸ Plegar todo</button>
              <button class="btn secondary small" onclick="app.toggleAllTriageGroups(true)" title="Desplegar todos los grupos">▾ Desplegar todo</button>
            </div>
          </div>
        </header>

        <!-- GRUPOS DE TAREAS -->
        <main class="triage-groups-container">
    `;

    if (activeTasks.length === 0) {
      html += `
        <div class="triage-empty-state">
          <span class="triage-empty-icon">🎉</span>
          <h3>¡No hay tareas pendientes en este día!</h3>
          <p>La cola de tareas para ${escapeHtml(friendlyDate)} está completamente despejada.</p>
          <button class="btn primary small" onclick="window.location.hash='#/'">Volver al tablero</button>
        </div>
      `;
    } else {
      groups.forEach(g => {
        const groupDuration = g.tasks.reduce((sum, t) => sum + (t.planned || 0), 0);
        const isCollapsed = collapsedGroups.has(g.id);
        const allSelected = g.tasks.length > 0 && g.tasks.every(t => selectedTaskIds.has(String(t.id)));
        const someSelected = g.tasks.some(t => selectedTaskIds.has(String(t.id))) && !allSelected;

        html += `
          <div class="triage-group-card ${isCollapsed ? 'collapsed' : ''}" id="triage-group-${escapeAttr(g.id)}">
            <!-- CABECERA DE GRUPO: [▾ Plegar] [ ] Checkbox Icono Título ... -->
            <div class="triage-group-header" onclick="app.toggleTriageGroup('${escapeAttr(g.id)}')">
              <div class="triage-group-header-left">
                <button type="button" class="triage-chevron-btn" title="${isCollapsed ? 'Desplegar grupo' : 'Plegar grupo'}">
                  ▾
                </button>
                <input type="checkbox" class="triage-group-cb" ${allSelected ? 'checked' : ''} ${someSelected ? 'data-indeterminate="true"' : ''} onclick="app.toggleTriageGroupSelect('${escapeAttr(g.id)}', event)" title="Seleccionar todas las tareas del grupo">
                <span class="triage-group-icon">${g.icon}</span>
                <span class="triage-group-title">${escapeHtml(g.title)}</span>
                <span class="triage-group-badge">${g.tasks.length} ${g.tasks.length === 1 ? 'tarea' : 'tareas'}</span>
              </div>
              <div class="triage-group-header-right">
                <span class="triage-group-duration">⏱️ ${formatShortDuration(groupDuration)}</span>
              </div>
            </div>

            <!-- CONTENIDO PLEGABLE DEL GRUPO -->
            <div class="triage-group-body" style="${isCollapsed ? 'display:none;' : ''}">
              ${g.tasks.length === 0 ? `
                <div class="triage-group-empty">Sin tareas en este grupo.</div>
              ` : `
                <div class="triage-tasks-list">
                  ${g.tasks.map(t => {
                    const isSelected = selectedTaskIds.has(String(t.id));
                    const urgencyKey = t.urgency || DEFAULT_URGENCY;
                    const uInfo = URGENCY_LEVELS[urgencyKey] || URGENCY_LEVELS[DEFAULT_URGENCY];
                    const isRecurring = !!(t.isRecurring || t.ruleId);

                    let recurringTag = '';
                    if (isRecurring) {
                      let ruleTooltip = 'Tarea recurrente · Clic para ver información de la regla';
                      if (t.ruleId) {
                        const envKey = state.activeEnv || 'work';
                        const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
                        const rule = env && Array.isArray(env.recurringTasks) ? env.recurringTasks.find(r => String(r.id) === String(t.ruleId)) : null;
                        if (rule) {
                          const formatted = formatRecurrenceRule(rule);
                          ruleTooltip = `Tarea recurrente: ${formatted.summaryText} (${formatted.dateRangeText}) · Clic para detalles`;
                        }
                      }
                      recurringTag = `
                        <button type="button" class="tag recurring-tag-btn triage-recurring-btn" onclick="app.openRecurringInfoPopover('${escapeAttr(t.id)}', event, 'task')" title="${escapeAttr(ruleTooltip)}" aria-label="Información de recurrencia">
                          <span class="triage-recurring-icon">🔁</span>
                          <span class="triage-recurring-label">Recurrente</span>
                        </button>
                      `;
                    }

                    const isDraggable = t.status === "pending" || t.status === "paused";
                    const dragAttrs = isDraggable
                      ? `draggable="true"
                         ondragstart="app.taskDragStart(event, '${escapeAttr(t.id)}')"
                         ondragover="app.taskDragOver(event)"
                         ondragleave="app.taskDragLeave(event)"
                         ondrop="app.taskDrop(event, '${escapeAttr(t.id)}')"
                         ondragend="app.taskDragEnd(event)"`
                      : '';
                    const dragHandle = isDraggable
                      ? `<span class="drag-handle triage-drag-handle" title="Arrastra para reordenar" onmousedown="app.armTaskDrag()">⠿</span>`
                      : '';

                    return `
                      <div class="triage-task-row ${isSelected ? 'selected' : ''} ${isRecurring ? 'is-recurring' : ''}" data-task-id="${escapeAttr(t.id)}" onclick="app.handleTriageRowClick('${escapeAttr(t.id)}', event)" ondblclick="app.handleTriageRowDblClick('${escapeAttr(t.id)}', event)" ${dragAttrs}>
                        <!-- LADO IZQUIERDO: PUNTITOS, CHECKBOX, ESTRELLA, NOMBRE + DURACIÓN (EN 1 LÍNEA) -->
                        <div class="triage-task-left">
                          ${dragHandle}
                          <input type="checkbox" class="triage-task-cb" ${isSelected ? 'checked' : ''} onclick="app.toggleTriageTaskSelect('${escapeAttr(t.id)}', event)">
                          <button type="button" class="triage-star-btn ${t.featured ? 'is-featured' : ''}" onclick="app.toggleTriageTaskStar('${escapeAttr(t.id)}', event)" title="${t.featured ? 'Quitar destacada' : 'Marcar destacada (máx 5)'}">
                            ${t.featured ? '⭐' : '☆'}
                          </button>
                          <span class="triage-task-title ${t.overflow ? 'is-overflow' : ''}" title="${escapeAttr(t.title)}">
                            ${escapeHtml(t.title)}
                          </span>
                          <span class="triage-task-duration" title="Duración estimada">${formatShortDuration(t.planned || 0)}</span>
                          ${recurringTag}
                          ${t.overflow ? '<span class="triage-overflow-tag" title="Esta tarea desborda el fin de jornada laboral">⚠️ Desborda</span>' : ''}
                        </div>

                        <!-- LADO DERECHO: ACCIONES DIRECTAS EN LA MISMA LÍNEA -->
                        <div class="triage-task-right">
                          <!-- BOTÓN URGENCIA CON MENU -->
                          <button type="button" class="triage-urgency-btn urgency-btn-${escapeAttr(urgencyKey)}" onclick="app.openTriageSingleUrgency('${escapeAttr(t.id)}', event)" title="Urgencia: ${escapeAttr(uInfo.label)} (clic para cambiar)">
                            <span>${uInfo.icon}</span>
                            <span class="triage-urgency-text">${escapeHtml(uInfo.label)}</span>
                            <span class="triage-chevron-mini">▾</span>
                          </button>

                          <!-- 5 BOTONES RÁPIDOS DE FECHA LABORABLE -->
                          <div class="triage-quick-days-wrap">
                            ${quick5Days.map(d => `
                              <button type="button" class="triage-quick-day-btn" onclick="app.moveTriageTaskToDate('${escapeAttr(t.id)}', '${escapeAttr(d.date)}', '${escapeAttr(d.label)}', event)" title="Mover a ${escapeAttr(d.label)} (${escapeAttr(d.date)})">
                                ${escapeHtml(d.shortChip)}
                              </button>
                            `).join('')}
                          </div>

                          <!-- BOTÓN BORRAR -->
                          <button type="button" class="triage-delete-btn" onclick="app.deleteTriageSingleTask('${escapeAttr(t.id)}', event)" title="Eliminar tarea">
                            🗑️
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>
        `;
      });
    }

    html += `
        </main>

        <!-- BARRA FLOTANTE DE ACCIONES POR LOTE -->
        <div class="triage-floating-bar ${selectedCount > 0 ? 'visible' : ''}" id="triageFloatingBar">
          <div class="triage-floating-left">
            <span class="triage-selected-badge">${selectedCount}</span>
            <span class="triage-selected-text"><strong>${selectedCount}</strong> ${selectedCount === 1 ? 'tarea seleccionada' : 'tareas seleccionadas'}</span>
            <button type="button" class="triage-link-btn" onclick="app.clearTriageSelection()">Deseleccionar</button>
          </div>

          <div class="triage-floating-actions">
            <!-- BOTÓN MOVER A FECHA (7 DÍAS LABORABLES) -->
            <div class="triage-dropdown-anchor">
              <button type="button" class="btn primary small" onclick="app.toggleTriageDropdown('triageMoveDropdown', event)">
                <span>📅 Mover a fecha</span>
                <span class="triage-chevron-mini">▾</span>
              </button>
              <div class="triage-floating-dropdown" id="triageMoveDropdown" style="display:none;">
                <div class="triage-dropdown-title">Próximos 7 días laborables</div>
                <div class="triage-dropdown-list">
                  ${next7Days.map(d => `
                    <button type="button" class="triage-dropdown-item" onclick="app.executeTriageMoveSelectedDate('${escapeAttr(d.date)}')">
                      <span>${escapeHtml(d.label)}</span>
                      <span class="triage-date-sub">${escapeHtml(d.date)}</span>
                    </button>
                  `).join('')}
                </div>
                <div class="triage-dropdown-custom-row">
                  <label class="triage-custom-date-label">Otra fecha:</label>
                  <input type="date" class="triage-custom-date-input" onchange="if(this.value) app.executeTriageMoveSelectedDate(this.value)">
                </div>
              </div>
            </div>

            <!-- BOTÓN URGENCIA POR LOTE -->
            <div class="triage-dropdown-anchor">
              <button type="button" class="btn secondary small" onclick="app.toggleTriageDropdown('triageBatchUrgencyDropdown', event)">
                <span>🎯 Urgencia</span>
                <span class="triage-chevron-mini">▾</span>
              </button>
              <div class="triage-floating-dropdown" id="triageBatchUrgencyDropdown" style="display:none;min-width:160px;">
                <div class="triage-dropdown-title">Cambiar urgencia</div>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('today')">
                  <span>🟠</span> <strong>Hoy</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('days')">
                  <span>🔵</span> <strong>Próximos días</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('week')">
                  <span>🟣</span> <strong>Esta semana</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('later')">
                  <span>⚪</span> <strong>Más adelante</strong>
                </button>
              </div>
            </div>

            <!-- BOTONES DESTACAR Y ELIMINAR POR LOTE -->
            <button type="button" class="btn secondary small" onclick="app.executeTriageBatchStar(true)" title="Marcar seleccionadas con estrella">
              ⭐ Destacar
            </button>
            <button type="button" class="btn secondary small" onclick="app.executeTriageBatchStar(false)" title="Quitar destacado a seleccionadas">
              ☆ Quitar
            </button>
            <button type="button" class="btn danger small" onclick="app.executeTriageBatchDelete()" title="Eliminar tareas seleccionadas">
              🗑️ Borrar
            </button>
          </div>
        </div>

        <!-- POPOVER FLOTANTE PARA CAMBIO INDIVIDUAL DE URGENCIA -->
        <div id="triageSingleUrgencyPopover" class="triage-single-urgency-popover" style="display:none;">
          <div class="triage-dropdown-title">Cambiar urgencia</div>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('today')">
            <span>🟠</span> <strong>Hoy</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('days')">
            <span>🔵</span> <strong>Próximos días</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('week')">
            <span>🟣</span> <strong>Esta semana</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('later')">
            <span>⚪</span> <strong>Más adelante</strong>
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;

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
    deleteTriageSingleTask,
    openTriageSingleUrgency,
    applyTriageSingleUrgency,
    closeTriagePopovers,
    executeTriageMoveSelectedDate,
    executeTriageBatchUrgency,
    executeTriageBatchStar,
    executeTriageBatchDelete,
    toggleTriageDropdown,
    getTargetDateStr
  };
}

export default TodayTasksTriageView;
