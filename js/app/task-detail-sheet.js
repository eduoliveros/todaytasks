/* app/task-detail-sheet.js — Bottom Sheet de detalle y acciones móviles para tareas */
import {
  nowMinutes, fmt, fmtDur, fmtRemaining, getTaskElapsed, getTodayStr, getNextWorkingDays,
  formatRecurrenceRule, formatTitleWithTags, URGENCY_LEVELS, DEFAULT_URGENCY,
  findTaskInEnvironment, isTaskBlocked, getTaskBlockingDetails
} from '../utils.js';
import { escapeHtml, escapeAttr, renderNotesMarkdown } from '../ui.js';
import { t } from '../i18n.js';

export function TodayTasksTaskDetailSheet(ctx) {
  let activeTaskId = null;

  function isMobileViewport() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  }

  function handleTaskClick(taskId, event) {
    if (!isMobileViewport()) return;
    // Si el clic fue en un botón, enlace o elemento interactivo interno, ignorar
    if (event && event.target && event.target.closest('button, a, input, textarea, select, .dep-chip-remove')) {
      return;
    }
    openTaskDetailSheet(taskId);
  }

  function openTaskDetailSheet(taskId) {
    if (typeof document === 'undefined') return;
    const sheet = document.getElementById('taskDetailSheet');
    if (!sheet) return;

    activeTaskId = String(taskId);
    const state = ctx.getState ? ctx.getState() : {};
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;

    // Buscar tarea activa o en histórico
    let task = (state.tasks || []).find(t => String(t.id) === String(taskId));
    let isHistorical = false;
    if (!task && env) {
      const found = findTaskInEnvironment(env, taskId);
      if (found) {
        task = found.task;
        isHistorical = true;
      }
    }

    if (!task) {
      closeTaskDetailSheet();
      return;
    }

    const urgencyKey = task.urgency || DEFAULT_URGENCY;
    const urgencyInfo = URGENCY_LEVELS[urgencyKey] || URGENCY_LEVELS[DEFAULT_URGENCY];
    const isBlockedTask = env ? isTaskBlocked(task, env) : false;
    const elapsedReal = getTaskElapsed(task);

    // Título y badges
    const titleEl = document.getElementById('taskDetailSheetTitle');
    if (titleEl) {
      const idBadge = task.displayId ? `<span class="task-id-badge">${escapeHtml(task.displayId)}</span>` : '';
      const starIcon = task.featured ? ' ⭐' : '';
      titleEl.innerHTML = `${idBadge}${formatTitleWithTags(task.title, 'app.filterByTag')}${starIcon}`;
    }

    // Sección de meta (urgencia, planificado, consumido, horario)
    const metaEl = document.getElementById('taskDetailSheetMeta');
    if (metaEl) {
      const statusLabel = task.status === 'running' ? t('task.statusRunning')
                        : task.status === 'paused' ? t('task.statusPaused')
                        : task.status === 'completed' ? t('tasks.tagCompleted')
                        : '';
      const statusBadge = statusLabel
        ? `<span class="status-badge ${escapeAttr(task.status || 'pending')}">${escapeHtml(statusLabel)}</span>`
        : '';

      let timeRangeStr = '';
      if (task.status === 'running') {
        const plannedEnd = task.runningStart + (task.planned - (task.elapsedBefore || 0));
        const rem = fmtRemaining(plannedEnd, nowMinutes());
        timeRangeStr = `<span class="task-detail-time-tag">${fmt(task.runningStart)} → ${fmt(plannedEnd)} (${rem.text})</span>`;
      } else if (task.completedAt) {
        timeRangeStr = `<span class="task-detail-time-tag">✓ ${fmt(task.completedAt)}</span>`;
      }

      const startAfterTag = (task.startAfter !== null && task.startAfter !== undefined && !isNaN(task.startAfter))
        ? `<span class="start-after-pill-btn"><span class="start-after-icon">⏰</span> ${fmt(task.startAfter)}+</span>`
        : '';

      const recurringTag = task.isRecurring
        ? `<span class="tag recurring-tag-btn">${t('tasks.recurringTagLabel')}</span>`
        : '';

      const urgencyPill = `
        <button type="button" class="urgency-pill-btn urgency-btn-${escapeAttr(urgencyKey)}"
                onclick="app.openUrgencyDropdown('${escapeAttr(task.id)}', event)"
                title="${escapeAttr(t('tasks.urgencyPillTooltip', { label: urgencyInfo.label }))}"
                aria-label="${escapeAttr(t('tasks.urgencyPillAria', { label: urgencyInfo.label }))}">
          <span class="urgency-pill-dot">${urgencyInfo.icon}</span>
          <span class="urgency-pill-label">${escapeHtml(urgencyInfo.label)}</span>
          <span class="urgency-pill-chevron">▾</span>
        </button>
      `;

      metaEl.innerHTML = `
        <div class="task-detail-chips-row">
          ${urgencyPill}
          ${statusBadge}
          ${recurringTag}
          ${startAfterTag}
          ${timeRangeStr}
        </div>
        <div class="task-detail-time-info">
          <span>${t('tasks.metaPlanned', { planned: fmtDur(task.planned) })}</span> · 
          <span>${t('tasks.metaSpent')}: <strong>${fmtDur(elapsedReal)}</strong></span>
        </div>
      `;
    }

    // Notas de la tarea
    const notesEl = document.getElementById('taskDetailSheetNotes');
    if (notesEl) {
      if (task.notes && task.notes.trim()) {
        notesEl.innerHTML = `
          <div class="task-detail-notes-box">
            <div class="task-note-content">${renderNotesMarkdown(task.notes)}</div>
          </div>
        `;
        notesEl.style.display = 'block';
      } else {
        notesEl.innerHTML = '';
        notesEl.style.display = 'none';
      }
    }

    // Dependencias
    const depsEl = document.getElementById('taskDetailSheetDeps');
    if (depsEl) {
      if (isBlockedTask) {
        const blockingDetails = env ? getTaskBlockingDetails(task, env) : [];
        const uncompleted = blockingDetails.filter(d => !d.isCompleted);
        const blockersListStr = uncompleted.map(b => (b.displayId ? `[${b.displayId}] ` : '') + b.title).join(', ');
        depsEl.innerHTML = `
          <div class="task-detail-blocked-box">
            <span>🔒 ${escapeHtml(t('tasks.blockedBadge'))}: ${escapeHtml(blockersListStr)}</span>
          </div>
        `;
        depsEl.style.display = 'block';
      } else {
        depsEl.innerHTML = '';
        depsEl.style.display = 'none';
      }
    }

    // Botones de acción dinámicos
    const actionsEl = document.getElementById('taskDetailSheetActions');
    const isCompleted = task.status === 'completed';
    if (actionsEl) {
      let html = '';

      if (!isCompleted) {
        if (task.status === 'pending') {
          html += `<button type="button" class="btn run task-detail-btn" onclick="app.taskDetailSheetAction('start')">${isBlockedTask ? '🔒 ' : ''}${t('tasks.btnStart')}</button>`;
          html += `<button type="button" class="btn done task-detail-btn" onclick="app.taskDetailSheetAction('complete')">${t('tasks.btnComplete')}</button>`;
        } else if (task.status === 'running') {
          html += `<button type="button" class="btn pause task-detail-btn" onclick="app.taskDetailSheetAction('pause')">${t('tasks.btnPause')}</button>`;
          html += `<button type="button" class="btn done task-detail-btn" onclick="app.taskDetailSheetAction('complete')">${t('tasks.btnComplete')}</button>`;
        } else if (task.status === 'paused') {
          html += `<button type="button" class="btn run task-detail-btn" onclick="app.taskDetailSheetAction('resume')">${isBlockedTask ? '🔒 ' : ''}${t('tasks.btnResume')}</button>`;
          html += `<button type="button" class="btn done task-detail-btn" onclick="app.taskDetailSheetAction('complete')">${t('tasks.btnComplete')}</button>`;
        }
        html += `
          <button type="button" class="btn secondary task-detail-btn" onclick="app.taskDetailSheetAction('edit')">✎ ${t('action.edit')}</button>
          <button type="button" class="btn secondary task-detail-btn" onclick="app.taskDetailSheetAction('star')">${task.featured ? '⭐ ' + t('tasks.unstarTooltip') : '☆ ' + t('tasks.starTooltip')}</button>
          <button type="button" class="btn secondary task-detail-btn" onclick="app.taskDetailSheetAction('copy-ref')">📋 ${t('action.copy')}</button>
          <button type="button" class="btn danger task-detail-btn" onclick="app.taskDetailSheetAction('delete')">✕ ${t('action.delete')}</button>
        `;
      } else {
        html += `
          <button type="button" class="btn secondary task-detail-btn" onclick="app.taskDetailSheetAction('reopen')">${t('summary.btnReopen')}</button>
          <button type="button" class="btn secondary task-detail-btn" onclick="app.taskDetailSheetAction('copy-ref')">📋 ${t('action.copy')}</button>
          <button type="button" class="btn danger task-detail-btn" onclick="app.taskDetailSheetAction('delete')">✕ ${t('action.delete')}</button>
        `;
      }
      actionsEl.innerHTML = html;
    }

    // Helper para quitar emojis iniciales de cadenas de i18n
    const stripLeadingEmoji = (str) => (str || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

    // Sección Posición (Reordenar en la jornada)
    const positionEl = document.getElementById('taskDetailSheetPosition');
    if (positionEl) {
      if (!isCompleted) {
        if (task.status === 'running') {
          positionEl.innerHTML = `
            <div class="task-detail-section-title">${t('tasks.detailSheetPosition')}</div>
            <div class="task-detail-running-notice">
              <span>⚠️ ${t('triage.runningTaskMoveNotice')}</span>
            </div>
          `;
        } else {
          const hasGrid = positionEl.querySelector('.task-detail-position-grid');
          if (!hasGrid) {
            positionEl.innerHTML = `
              <div class="task-detail-section-title">${t('tasks.detailSheetPosition')}</div>
              <div class="task-detail-position-grid" ondblclick="event.preventDefault()">
                <button type="button" class="btn secondary task-detail-grid-btn" onclick="app.taskDetailSheetMove('top', event)" ondblclick="event.preventDefault()">⤒ ${escapeHtml(stripLeadingEmoji(t('triage.moveToTop')))}</button>
                <button type="button" class="btn secondary task-detail-grid-btn" onclick="app.taskDetailSheetMove('up', event)" ondblclick="event.preventDefault()">▲ ${escapeHtml(stripLeadingEmoji(t('triage.moveUp')))}</button>
                <button type="button" class="btn secondary task-detail-grid-btn" onclick="app.taskDetailSheetMove('down', event)" ondblclick="event.preventDefault()">▼ ${escapeHtml(stripLeadingEmoji(t('triage.moveDown')))}</button>
                <button type="button" class="btn secondary task-detail-grid-btn" onclick="app.taskDetailSheetMove('bottom', event)" ondblclick="event.preventDefault()">⤓ ${escapeHtml(stripLeadingEmoji(t('triage.moveToBottom')))}</button>
              </div>
            `;
          }
        }
        positionEl.style.display = 'block';
      } else {
        positionEl.innerHTML = '';
        positionEl.style.display = 'none';
      }
    }

    // Sección Reprogramar (Versión compacta de los 5 días hábiles siguientes, igual que en desktop)
    const rescheduleEl = document.getElementById('taskDetailSheetReschedule');
    if (rescheduleEl) {
      if (!isCompleted) {
        const targetDate = state.selectedDate || getTodayStr();
        const nextDays = getNextWorkingDays(targetDate, 5, state, state.activeEnv || 'work');
        rescheduleEl.innerHTML = `
          <div class="task-detail-section-title">${t('tasks.detailSheetReschedule')}</div>
          <div class="task-detail-dates-chips task-detail-quick-days-grid">
            ${nextDays.map(d => `
              <button type="button" class="task-detail-date-chip task-detail-quick-day-btn" onclick="app.taskDetailSheetReschedule('${escapeAttr(d.date)}')" title="${escapeAttr(d.label)}">
                ${escapeHtml(d.shortChip)}
              </button>
            `).join('')}
          </div>
        `;
        rescheduleEl.style.display = 'block';
      } else {
        rescheduleEl.innerHTML = '';
        rescheduleEl.style.display = 'none';
      }
    }

    sheet.style.display = 'flex';
  }

  function closeTaskDetailSheet() {
    if (typeof document === 'undefined') return;
    const sheet = document.getElementById('taskDetailSheet');
    if (sheet) sheet.style.display = 'none';
    activeTaskId = null;
  }

  function getActiveTaskId() {
    return activeTaskId;
  }

  function handleAction(actionType) {
    if (!activeTaskId) return;
    const id = activeTaskId;
    closeTaskDetailSheet();

    if (!window.app) return;

    switch (actionType) {
      case 'start':
        if (window.app.startTask) window.app.startTask(id);
        break;
      case 'pause':
        if (window.app.pauseTask) window.app.pauseTask(id);
        break;
      case 'resume':
        if (window.app.resumeTask) window.app.resumeTask(id);
        break;
      case 'complete':
        if (window.app.completeTask) window.app.completeTask(id);
        break;
      case 'reopen':
        if (window.app.uncompleteTask) window.app.uncompleteTask(id);
        break;
      case 'edit':
        if (window.app.startEditTask) window.app.startEditTask(id);
        break;
      case 'star':
        if (window.app.toggleTaskFeatured) window.app.toggleTaskFeatured(id);
        break;
      case 'copy-ref':
        if (window.app.copyTaskReference) window.app.copyTaskReference(id);
        break;
      case 'delete':
        if (window.app.deleteTask) window.app.deleteTask(id);
        break;
      default:
        break;
    }
  }

  function handleMove(direction, event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (!activeTaskId) return;
    const id = activeTaskId;
    if (window.app && window.app.moveTaskDirectly) {
      window.app.moveTaskDirectly(id, direction);
    } else if (ctx.actionsModule && ctx.actionsModule.moveTaskDirectly) {
      ctx.actionsModule.moveTaskDirectly(id, direction);
    }
    // Si triaje está abierto, re-renderizar vista de triaje
    if (window.app && window.app.renderTriageView && typeof window !== 'undefined' && window.location && window.location.hash === '#/triage') {
      window.app.renderTriageView();
    }
  }

  function handleReschedule(dateStr) {
    if (!activeTaskId || !dateStr) return;
    const id = activeTaskId;
    closeTaskDetailSheet();
    if (window.app && window.app.moveTaskToDate) {
      window.app.moveTaskToDate(id, dateStr);
    } else if (ctx.actionsModule && ctx.actionsModule.moveTaskToDate) {
      ctx.actionsModule.moveTaskToDate(id, dateStr);
    }
    // Si triaje está abierto, re-renderizar vista de triaje
    if (window.app && window.app.renderTriageView && typeof window !== 'undefined' && window.location && window.location.hash === '#/triage') {
      window.app.renderTriageView();
    }
  }

  function refreshIfOpen() {
    if (typeof document === 'undefined') return;
    const sheet = document.getElementById('taskDetailSheet');
    if (sheet && sheet.style.display !== 'none' && activeTaskId) {
      openTaskDetailSheet(activeTaskId);
    }
  }

  return {
    isMobileViewport,
    handleTaskClick,
    openTaskDetailSheet,
    closeTaskDetailSheet,
    getActiveTaskId,
    handleAction,
    handleMove,
    handleReschedule,
    refreshIfOpen
  };
}

