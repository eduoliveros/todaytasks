/* views/tasks.js — Renderizado de la lista de tareas activas */
import {
  nowMinutes, fmt, fmtDur, fmtRemaining, getTaskElapsed, getTodayStr, matchesSearchQuery,
  matchesTaskSearch, formatRecurrenceRule,
  URGENCY_LEVELS, DEFAULT_URGENCY, formatTitleWithTags,
  findTaskInEnvironment, isTaskBlocked, getTaskBlockingDetails, getTasksBlockedBy
} from '../utils.js';
import { escapeHtml, escapeAttr, renderNotesMarkdown } from '../ui.js';
import { t } from '../i18n.js';
import { createTouchDragEngine } from '../app/touch-drag.js';

export function TodayTasksTasksView(ctx){
  const { getState, getTaskEdit } = ctx;
  const expandedNotesTasks = new Set();

  function isTaskNotesExpanded(id) {
    return expandedNotesTasks.has(String(id));
  }

  // TOUCH LONG PRESS & DRAG (motor compartido js/app/touch-drag.js)
  const touchEngine = createTouchDragEngine({
    rowSelector: '.task-item',
    handleSelector: '.drag-handle',
    shouldIgnoreStart: (event) => {
      return !!(event.target && typeof event.target.closest === 'function' &&
        event.target.closest('button, a, input, textarea, select, .dep-chip-remove'));
    },
    isDraggable: (taskId) => {
      const state = getState();
      const task = (state.tasks || []).find(t => String(t.id) === String(taskId));
      return !!(task && (task.status === 'pending' || task.status === 'paused'));
    },
    onDragStart: (taskId, rowEl) => {
      if (rowEl) rowEl.classList.add('long-press-active', 'dragging');
    },
    onDrop: (sourceId, targetId) => {
      if (ctx.actionsModule && ctx.actionsModule.reorderTaskByDrag) {
        ctx.actionsModule.reorderTaskByDrag(sourceId, targetId, null);
      }
    },
    isDropTargetAllowed: (sourceId, targetId) => {
      if (ctx.actionsModule && typeof ctx.actionsModule.checkIsDropTargetAllowed === 'function') {
        return ctx.actionsModule.checkIsDropTargetAllowed(targetId, sourceId);
      }
      return true;
    }
  });

  function handleTaskTouchStart(taskId, event) {
    touchEngine.handleTouchStart(taskId, event);
  }

  function handleTaskTouchMove(event) {
    touchEngine.handleTouchMove(event);
  }

  function handleTaskTouchEnd(event) {
    touchEngine.handleTouchEnd(event);
  }

  function handleTaskTouchCancel(event) {
    touchEngine.handleTouchCancel(event);
  }

  function handleTaskMouseDown(taskId, event) {
    touchEngine.handleMouseDown(taskId, event);
  }

  function renderEditDependencyChips(deps, env) {
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

  function toggleTaskNotes(id, event) {
    if (event) {
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      if (typeof event.preventDefault === 'function') event.preventDefault();
    }
    const strId = String(id);
    if (expandedNotesTasks.has(strId)) {
      expandedNotesTasks.delete(strId);
    } else {
      expandedNotesTasks.add(strId);
    }
    const panel = document.getElementById(`task-notes-panel-${strId}`);
    if (panel) {
      const isNowOpen = expandedNotesTasks.has(strId);
      panel.style.display = isNowOpen ? 'block' : 'none';
      panel.classList.toggle('visible', isNowOpen);
    }
    // Redraw pill chevron if needed or smartRender
    if (ctx.smartRender) {
      ctx.smartRender();
    } else if (ctx.renderAll) {
      ctx.renderAll();
    }
  }

  function renderTaskItem(task, schedule, taskEdit){
    const urgencyKey = task.urgency || DEFAULT_URGENCY;
    const urgencyInfo = URGENCY_LEVELS[urgencyKey] || URGENCY_LEVELS[DEFAULT_URGENCY];

    const isOverflow = (schedule && schedule.overflowIds) ? schedule.overflowIds.has(task.id) : false;
    const state = typeof getState === 'function' ? getState() : {};
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;

    if(taskEdit && String(taskEdit.id) === String(task.id)){
      const isRecurring = task.isRecurring || !!taskEdit.ruleId;
      const editUrgency = taskEdit.urgency || urgencyKey;
      const editUrgencyInfo = URGENCY_LEVELS[editUrgency] || URGENCY_LEVELS[DEFAULT_URGENCY];
      return `
      <div class="item task-item editing ${taskEdit.featured ? 'featured-task' : ''} ${isOverflow ? 'task-overflow' : ''}" id="task-item-${escapeAttr(task.id)}">
        <div class="row">
          <input type="text" id="task-edit-title-${escapeAttr(task.id)}" value="${escapeAttr(taskEdit.title)}" onfocus="if(window.app && window.app.attachTagAutocompleteToEl) window.app.attachTagAutocompleteToEl(this)" oninput="if(window.app) window.app.updateTaskEditField('title', this.value)" placeholder="${escapeAttr(t('tasks.inputTitlePlaceholder'))}">
        </div>
        <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
          <label style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">${t('tasks.editPlanned')}<br><input type="text" value="${escapeAttr(taskEdit.duration)}" placeholder="${escapeAttr(t('tasks.editDurationPlaceholder'))}" style="width:95px;margin-top:4px;" oninput="app.updateTaskEditField('duration', this.value)"></label>
          <label style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">${t('tasks.editSpent')}<br><input type="text" value="${escapeAttr(taskEdit.actual||0)}" placeholder="${escapeAttr(t('tasks.editActualPlaceholder'))}" style="width:95px;margin-top:4px;" oninput="app.updateTaskEditField('actual', this.value)"></label>
          <label style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">${t('tasks.editStartAfter')}<br><input type="time" value="${escapeAttr(taskEdit.startAfter || '')}" style="width:110px;margin-top:4px;" oninput="app.updateTaskEditField('startAfter', this.value)"></label>
        </div>
        <div class="row" style="align-items:center;gap:8px;margin-bottom:10px;">
          <button type="button" class="urgency-pill-btn urgency-btn-${escapeAttr(editUrgency)}"
                  onclick="app.openEditUrgencyDropdown('${escapeAttr(task.id)}', event)"
                  title="${escapeAttr(t('tasks.editUrgencyTooltip', { label: editUrgencyInfo.label }))}"
                  id="edit-urgency-pill-${escapeAttr(task.id)}">
            <span>${editUrgencyInfo.icon}</span>
            <span>${escapeHtml(editUrgencyInfo.label)}</span>
            <span class="urgency-pill-chevron">▾</span>
          </button>
          <button type="button" class="icon-btn star-btn ${taskEdit.featured ? 'is-featured' : ''}"
                  title="${escapeAttr(taskEdit.featured ? t('tasks.unstarTooltip') : t('tasks.starTooltip'))}"
                  onclick="app.toggleEditFeatured('${escapeAttr(task.id)}', event)">
            ${taskEdit.featured ? '⭐' : '☆'}
          </button>
        </div>
        <div class="row task-edit-notes-wrap" style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;width:100%;">
            <label style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">
              <span>📝</span> ${t('tasks.editNotesLabel')}
            </label>
            <div class="task-notes-mini-toolbar">
              <button type="button" class="btn-notes-tool" onclick="app.insertEditNotesFormat('${escapeAttr(task.id)}', '**', '**')" title="${escapeAttr(t('markdown.boldTooltip'))}">B</button>
              <button type="button" class="btn-notes-tool italic" onclick="app.insertEditNotesFormat('${escapeAttr(task.id)}', '*', '*')" title="${escapeAttr(t('markdown.italicTooltip'))}">I</button>
              <button type="button" class="btn-notes-tool" onclick="app.insertEditNotesLink('${escapeAttr(task.id)}')" title="${escapeAttr(t('markdown.linkTooltip'))}">🔗 Link</button>
              <button type="button" class="btn-notes-tool" id="btn-preview-edit-${escapeAttr(task.id)}" onclick="app.toggleEditNotesPreview('${escapeAttr(task.id)}')" title="${escapeAttr(t('markdown.previewTooltip'))}">👁️</button>
            </div>
          </div>
          <textarea id="task-edit-notes-${escapeAttr(task.id)}" class="task-edit-notes-textarea" rows="2" style="width:100%;box-sizing:border-box;" placeholder="${escapeAttr(t('tasks.notesPlaceholder'))}" onfocus="if(window.app && window.app.attachTagAutocompleteToEl) window.app.attachTagAutocompleteToEl(this)" oninput="if(window.app) window.app.updateTaskEditField('notes', this.value)">${escapeHtml(taskEdit.notes || '')}</textarea>
          <div id="task-edit-notes-preview-${escapeAttr(task.id)}" class="task-edit-notes-preview task-note-content" style="display:none;"></div>
        </div>
        <div class="task-form-dependencies-row" style="margin-bottom:10px;">
          <div class="task-form-dependencies-header">
            <span class="task-form-dependencies-label" style="font-size:0.82rem;color:var(--text-muted);font-weight:500;display:inline-flex;align-items:center;gap:4px;">
              <span>🔒</span> ${t('tasks.dependenciesLabel')}
            </span>
            <button type="button" class="btn-add-dependency" onclick="app.openDependencySelector('${escapeAttr(task.id)}', 'task-edit')">${t('tasks.addDependencyBtn')}</button>
          </div>
          <div class="task-dependencies-chips-list" id="taskEditDependenciesList-${escapeAttr(task.id)}">
            ${renderEditDependencyChips(taskEdit.dependsOn || [], env)}
          </div>
        </div>
        ${!isRecurring ? `
        <div style="margin-bottom:8px;">
          <label style="font-size:0.82rem;display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:var(--ink);">
            <input type="checkbox" ${taskEdit.autoMoveToToday ? 'checked' : ''} onchange="app.updateTaskEditField('autoMoveToToday', this.checked)"> ${t('tasks.autoMoveCheckbox')}
          </label>
        </div>` : ''}
        <div class="task-actions">
          <button class="btn small done" onclick="app.saveEditTask('${escapeAttr(task.id)}')">${t('action.save')}</button>
          <button class="btn small secondary" onclick="app.cancelEditTask()">${t('action.cancel')}</button>
        </div>
      </div>`;
    }
    const elapsedReal = getTaskElapsed(task);
    const segs = (schedule && schedule.segmentsByTask && schedule.segmentsByTask[task.id]) ? schedule.segmentsByTask[task.id] : [];
    const label = task.status === "running" ? t('task.statusRunning')
                : task.status === "paused" ? t('task.statusPaused')
                : t('task.statusPending');
    const badgeClass = task.status;

    let startVal, endVal, trClass, splitNote = "", remainingChip = "";
    if(task.status === "running"){
      const plannedEnd = task.runningStart + (task.planned - (task.elapsedBefore||0));
      startVal = fmt(task.runningStart);
      endVal = fmt(plannedEnd);
      trClass = "tr-running";
      const rem = fmtRemaining(plannedEnd, nowMinutes());
      remainingChip = `<span class="remaining-chip ${rem.overrun ? 'overrun' : ''}">${escapeHtml(rem.text)}</span>`;
    } else if(segs.length > 0){
      startVal = fmt(segs[0].start);
      endVal = fmt(segs[segs.length-1].end);
      trClass = "tr-pending";
      if(segs.length > 1){
        const parts = segs.map(s => `${fmt(s.start)}-${fmt(s.end)}`).join(", ");
        splitNote = `<div class="meta" style="color:#B45309">${t('tasks.splitByMeetings', { parts })}</div>`;
      }
    } else {
      startVal = "—";
      endVal = "—";
      trClass = "tr-pending";
    }

    const isDraggable = (task.status === "pending" || task.status === "paused");
    const dragAttrs = isDraggable
      ? `draggable="true"
         ondragstart="app.taskDragStart(event, '${escapeAttr(task.id)}')"
         ondragover="app.taskDragOver(event)"
         ondragleave="app.taskDragLeave(event)"
         ondrop="app.taskDrop(event, '${escapeAttr(task.id)}')"
         ondragend="app.taskDragEnd(event)"`
      : '';
    const touchAttrs = isDraggable
      ? `ontouchstart="app.handleTaskTouchStart('${escapeAttr(task.id)}', event)"
         ontouchmove="app.handleTaskTouchMove(event)"
         ontouchend="app.handleTaskTouchEnd(event)"
         ontouchcancel="app.handleTaskTouchCancel(event)"
         onmousedown="app.handleTaskMouseDown('${escapeAttr(task.id)}', event)"`
      : '';
    const dragHandle = isDraggable
      ? `<span class="drag-handle" title="${escapeAttr(t('tasks.dragHandleTooltip'))}" onmousedown="app.armTaskDrag()">⠿</span>`
      : '';
    let recurringTag = '';
    if (task.isRecurring) {
      let ruleTooltip = t('tasks.recurringTagTooltip');
      if (task.ruleId) {
        const state = getState();
        const envKey = state.activeEnv || 'work';
        const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
        const rule = env && Array.isArray(env.recurringTasks) ? env.recurringTasks.find(r => String(r.id) === String(task.ruleId)) : null;
        if (rule) {
          const formatted = formatRecurrenceRule(rule);
          ruleTooltip = t('tasks.recurringRuleTooltip', { summary: formatted.summaryText, range: formatted.dateRangeText });
        }
      }
      recurringTag = `<button type="button" class="tag recurring-tag-btn" onclick="app.openRecurringInfoPopover('${escapeAttr(task.id)}', event, 'task')" title="${escapeAttr(ruleTooltip)}" aria-label="${escapeAttr(t('meetings.recurringTagAria'))}">${t('tasks.recurringTagLabel')}</button>`;
    }
    const autoMoveTag = (!task.isRecurring && task.autoMoveToToday) ? `<span class="tag tag-automove" title="${escapeAttr(t('tasks.autoMoveTagTooltip'))}">${t('summary.autoMoveTag')}</span>` : '';
    const featuredClass = task.featured ? 'featured-task' : '';

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

    const hasStartAfter = (task.startAfter !== null && task.startAfter !== undefined && !isNaN(task.startAfter));
    const startAfterPill = hasStartAfter ? `
      <button type="button" class="start-after-pill-btn"
              onclick="app.openStartAfterPopover('${escapeAttr(task.id)}', event)"
              title="${escapeAttr(t('tasks.startAfterPillTooltip', { time: fmt(task.startAfter) }))}"
              aria-label="${escapeAttr(t('tasks.startAfterPillAria', { time: fmt(task.startAfter) }))}">
        <span class="start-after-icon">⏰</span>
        <span class="start-after-label">${fmt(task.startAfter)}+</span>
        <span class="start-after-chevron">▾</span>
      </button>
    ` : '';

    const hasNotes = !!(task.notes && task.notes.trim());
    const isNotesExpanded = isTaskNotesExpanded(task.id);
    const notesPill = hasNotes ? `
      <button type="button" class="task-notes-pill-btn ${isNotesExpanded ? 'expanded' : ''}"
              onclick="app.toggleTaskNotes('${escapeAttr(task.id)}', event)"
              title="${escapeAttr(t('tasks.notesPillTooltip'))}"
              aria-label="${escapeAttr(t('tasks.notesPillAria'))}">
        <span class="task-notes-icon">📝</span>
        <span class="task-notes-label">${t('tasks.notesPillLabel')}</span>
        <span class="task-notes-chevron">${isNotesExpanded ? '▲' : '▾'}</span>
      </button>
    ` : '';

    const notesPanel = hasNotes ? `
      <div class="task-card-notes-panel ${isNotesExpanded ? 'visible' : ''}" id="task-notes-panel-${escapeAttr(task.id)}" style="${isNotesExpanded ? 'display:block;' : 'display:none;'}">
        <div class="task-note-content">
          ${renderNotesMarkdown(task.notes)}
        </div>
      </div>
    ` : '';

    const overflowClass = isOverflow ? 'task-overflow' : '';

    const isBlocked = env ? isTaskBlocked(task, env) : false;
    const blockingDetails = env ? getTaskBlockingDetails(task, env) : [];
    const uncompletedBlockers = blockingDetails.filter(d => !d.isCompleted);
    const blockedByList = env ? getTasksBlockedBy(task.id, env) : [];

    let depBadges = '';
    if (isBlocked) {
      const firstBlocker = uncompletedBlockers[0];
      const extraCount = uncompletedBlockers.length > 1 ? ` (+${uncompletedBlockers.length - 1})` : '';
      const blockerDisplay = firstBlocker?.displayId || '...';
      const blockerDate = firstBlocker?.dateStr || '';
      const blockingListStr = uncompletedBlockers.map(b => (b.displayId ? `[${b.displayId}] ` : '') + b.title).join(', ');
      depBadges += `
        <button type="button" class="task-dep-badge blocked" onclick="event.stopPropagation(); app.goToTask('${escapeAttr(firstBlocker?.id || '')}', '${escapeAttr(blockerDate)}')" title="${escapeAttr(t('tasks.blockedTooltip'))}: ${escapeAttr(blockingListStr)}">
          ${escapeHtml(t('tasks.blockedBadge'))} (${escapeHtml(blockerDisplay)}${escapeHtml(extraCount)})
        </button>
      `;
    } else if (task.dependsOn && task.dependsOn.length > 0) {
      const firstDepFound = env ? findTaskInEnvironment(env, task.dependsOn[0]) : null;
      const depDisplay = firstDepFound?.task?.displayId || '...';
      depBadges += `
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
      depBadges += `
        <button type="button" class="task-dep-badge blocking" onclick="event.stopPropagation(); app.goToTask('${escapeAttr(firstTarget.id)}', '${escapeAttr(targetDate)}')" title="${escapeAttr(t('tasks.blocksTooltip', { id: targetDisplay, title: blockedListStr }))}">
          ⛓️ ${escapeHtml(targetDisplay)}${escapeHtml(extraBlocked)}
        </button>
      `;
    }

    const blockedClass = isBlocked ? 'is-blocked' : '';

    return `
      <div class="item task-item ${task.status} ${featuredClass} ${overflowClass} ${blockedClass}" id="task-item-${escapeAttr(task.id)}" data-task-id="${escapeAttr(task.id)}" onclick="if(window.app && window.app.handleTaskMobileClick) window.app.handleTaskMobileClick('${escapeAttr(task.id)}', event)" ondblclick="app.startEditTask('${escapeAttr(task.id)}')" ${dragAttrs} ${touchAttrs}>
        <div class="top">
          <div style="display:flex;align-items:flex-start;gap:6px;flex:1;min-width:0;">
            ${dragHandle}
            <div style="flex:1;min-width:0;">
              <div class="title">${task.displayId ? `<button type="button" class="task-id-badge" onclick="app.copyTaskId('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('tasks.copyIdTooltip', { id: task.displayId }))}">${escapeHtml(task.displayId)}</button>` : ''}${formatTitleWithTags(task.title, 'app.filterByTag')}</div>
              <div class="time-range ${trClass}">
                ${urgencyPill}
                ${startAfterPill}
                ${notesPill}
                ${depBadges}
                ${startVal}<span class="arrow">→</span>${endVal}
                ${remainingChip}
                ${recurringTag}
                ${autoMoveTag}
              </div>
              <div class="meta">
                ${t('tasks.metaPlanned', { planned: fmtDur(task.planned) })} · ${t('tasks.metaSpent')}: <span class="task-duration-clickable" title="${escapeAttr(t('summary.adjustTimeTooltip'))}" onclick="app.openTimePopover('${escapeAttr(task.id)}', event)">${fmtDur(elapsedReal)}</span>
                <span class="status-badge ${badgeClass}">${label}</span>
                ${isOverflow ? `<span class="overflow-badge" title="${escapeAttr(t('tasks.overflowBadgeTooltip'))}">${t('tasks.overflowBadge')}</span>` : ''}
              </div>
              ${splitNote}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:2px;">
            <button class="icon-btn star-btn ${task.featured ? 'is-featured' : ''}" title="${escapeAttr(task.featured ? t('tasks.unstarTooltip') : t('tasks.starTooltip'))}" onclick="app.toggleTaskFeatured('${escapeAttr(task.id)}')">${task.featured ? '⭐' : '☆'}</button>
            <button type="button" class="icon-btn copy-ref-btn" title="${escapeAttr(t('tasks.copyReferenceTooltip', { id: task.displayId || '' }))}" onclick="app.copyTaskReference('${escapeAttr(task.id)}', event)"><svg class="copy-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
            <button class="icon-btn" title="${escapeAttr(t('tasks.btnSetStartAfterTooltip'))}" onclick="app.openStartAfterPopover('${escapeAttr(task.id)}', event)">⏰</button>
            ${!task.isRecurring && task.autoMoveToToday ? `
              <button class="icon-btn" title="${escapeAttr(t('tasks.btnMoveDayTooltip'))}" onclick="app.openCopyTaskModal('${escapeAttr(task.id)}')">➡️</button>
            ` : `
              <button class="icon-btn" title="${escapeAttr(t('tasks.btnCopyDayTooltip'))}" onclick="app.openCopyTaskModal('${escapeAttr(task.id)}')">📋</button>
            `}
            <button class="icon-btn" title="${escapeAttr(t('action.edit'))}" onclick="app.startEditTask('${escapeAttr(task.id)}')">✎</button>
            <button class="icon-btn" title="${escapeAttr(t('action.delete'))}" onclick="app.deleteTask('${escapeAttr(task.id)}')">✕</button>
          </div>
        </div>
        ${notesPanel}
        <div class="task-actions">
          ${task.status==="pending" ? `
            <button class="btn small run ${isBlocked ? 'is-blocked' : ''}" onclick="app.startTask('${escapeAttr(task.id)}')">${isBlocked ? '🔒 ' : ''}${t('tasks.btnStart')}</button>
            <button class="btn small done" onclick="app.completeTask('${escapeAttr(task.id)}')">${t('tasks.btnComplete')}</button>
            <div class="order-controls">
              <button class="icon-btn" title="${escapeAttr(t('tasks.btnMoveUp'))}" data-action="move-up" data-task-id="${escapeAttr(task.id)}" onclick="app.moveTask('${escapeAttr(task.id)}',-1,event)">▲</button>
              <button class="icon-btn" title="${escapeAttr(t('tasks.btnMoveDown'))}" data-action="move-down" data-task-id="${escapeAttr(task.id)}" onclick="app.moveTask('${escapeAttr(task.id)}',1,event)">▼</button>
            </div>
          ` : ""}
          ${task.status==="running" ? `
            <a href="#/task/${escapeAttr(task.id)}" class="btn small secondary focus-link" title="${escapeAttr(t('tasks.btnFocusTooltip'))}">${t('tasks.btnFocus')}</a>
            <button class="btn small pause" onclick="app.pauseTask('${escapeAttr(task.id)}')">${t('tasks.btnPause')}</button>
            <button class="btn small done" onclick="app.completeTask('${escapeAttr(task.id)}')">${t('tasks.btnComplete')}</button>
          ` : ""}
          ${task.status==="paused" ? `
            <button class="btn small run ${isBlocked ? 'is-blocked' : ''}" onclick="app.resumeTask('${escapeAttr(task.id)}')">${isBlocked ? '🔒 ' : ''}${t('tasks.btnResume')}</button>
            <button class="btn small done" onclick="app.completeTask('${escapeAttr(task.id)}')">${t('tasks.btnComplete')}</button>
            <div class="order-controls">
              <button class="icon-btn" title="${escapeAttr(t('tasks.btnMoveUp'))}" data-action="move-up" data-task-id="${escapeAttr(task.id)}" onclick="app.moveTask('${escapeAttr(task.id)}',-1,event)">▲</button>
              <button class="icon-btn" title="${escapeAttr(t('tasks.btnMoveDown'))}" data-action="move-down" data-task-id="${escapeAttr(task.id)}" onclick="app.moveTask('${escapeAttr(task.id)}',1,event)">▼</button>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  function renderCompletedSearchItem(task){
    const realStart = (task.completedAt !== null && task.completedAt !== undefined && task.actualDuration !== null) ? (task.completedAt - task.actualDuration) : null;
    let recurringTag = '';
    if (task.isRecurring) {
      let ruleTooltip = t('tasks.recurringTagTooltip');
      if (task.ruleId) {
        const state = getState();
        const envKey = state.activeEnv || 'work';
        const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
        const rule = env && Array.isArray(env.recurringTasks) ? env.recurringTasks.find(r => String(r.id) === String(task.ruleId)) : null;
        if (rule) {
          const formatted = formatRecurrenceRule(rule);
          ruleTooltip = t('tasks.recurringRuleTooltip', { summary: formatted.summaryText, range: formatted.dateRangeText });
        }
      }
      recurringTag = `<button type="button" class="tag recurring-tag-btn" onclick="app.openRecurringInfoPopover('${escapeAttr(task.id)}', event, 'task')" title="${escapeAttr(ruleTooltip)}" aria-label="${escapeAttr(t('meetings.recurringTagAria'))}">${t('tasks.recurringTagLabel')}</button>`;
    }
    const hasNotes = !!(task.notes && task.notes.trim());
    const isNotesExpanded = isTaskNotesExpanded(task.id);
    const notesPill = hasNotes ? `
      <button type="button" class="task-notes-pill-btn ${isNotesExpanded ? 'expanded' : ''}"
              onclick="app.toggleTaskNotes('${escapeAttr(task.id)}', event)"
              title="${escapeAttr(t('tasks.notesPillTooltip'))}"
              aria-label="${escapeAttr(t('tasks.notesPillAria'))}">
        <span class="task-notes-icon">📝</span>
        <span class="task-notes-label">${t('tasks.notesPillLabel')}</span>
        <span class="task-notes-chevron">${isNotesExpanded ? '▲' : '▾'}</span>
      </button>
    ` : '';
    const notesPanel = hasNotes ? `
      <div class="task-card-notes-panel ${isNotesExpanded ? 'visible' : ''}" id="task-notes-panel-${escapeAttr(task.id)}" style="${isNotesExpanded ? 'display:block;' : 'display:none;'}">
        <div class="task-note-content">
          ${renderNotesMarkdown(task.notes)}
        </div>
      </div>
    ` : '';
    return `
      <div class="item task-item completed-search-item" id="task-item-${escapeAttr(task.id)}" data-task-id="${escapeAttr(task.id)}" onclick="if(window.app && window.app.handleTaskMobileClick) window.app.handleTaskMobileClick('${escapeAttr(task.id)}', event)">
        <div class="top">
          <div style="flex:1;min-width:0;">
            <div class="title completed-title">${task.displayId ? `<button type="button" class="task-id-badge" onclick="app.copyTaskId('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('tasks.copyIdTooltip', { id: task.displayId }))}">${escapeHtml(task.displayId)}</button>` : ''}${formatTitleWithTags(task.title, 'app.filterByTag')}</div>
            <div class="time-range tr-meeting">
              <span class="tag">${t('tasks.tagCompleted')}</span>
              ${task.completedAt !== null && task.completedAt !== undefined ? fmt(task.completedAt) : ''}
              ${realStart !== null ? `<span class="arrow">·</span> <span class="tag">${t('tasks.tagRealDuration')}</span> ${fmtDur(task.actualDuration)}` : ''}
              ${notesPill}
              ${recurringTag}
            </div>
            <div class="meta">
              ${t('tasks.metaPlanned', { planned: fmtDur(task.planned) })} · ${t('tasks.metaActual')}: <span class="task-duration-clickable" title="${escapeAttr(t('summary.adjustTimeTooltip'))}" onclick="app.openTimePopover('${escapeAttr(task.id)}', event)">${fmtDur(task.actualDuration ?? task.planned)}</span>
              <span class="status-badge completed">${t('tasks.badgeCompleted')}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:2px;">
            <button type="button" class="icon-btn copy-ref-btn" title="${escapeAttr(t('tasks.copyReferenceTooltip', { id: task.displayId || '' }))}" onclick="app.copyTaskReference('${escapeAttr(task.id)}', event)"><svg class="copy-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
            <button class="icon-btn" title="${escapeAttr(t('tasks.btnCopyDayTooltip'))}" onclick="app.openCopyTaskModal('${escapeAttr(task.id)}')">📋</button>
            <button class="icon-btn" title="${escapeAttr(t('action.delete'))}" onclick="app.deleteTask('${escapeAttr(task.id)}')">✕</button>
          </div>
        </div>
        ${notesPanel}
        <div class="task-actions" style="margin-top:6px;display:flex;gap:6px;">
          <button class="btn small secondary" onclick="app.uncompleteTask('${escapeAttr(task.id)}')" title="${escapeAttr(t('summary.btnReopenTitle'))}">${t('summary.btnReopen')}</button>
          <button class="btn small secondary" onclick="app.openTimePopover('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('summary.adjustTimeTooltip'))}">${t('summary.btnAdjustTime')}</button>
        </div>
      </div>
    `;
  }

  function renderTasks(schedule){
    if (typeof document === "undefined") return;
    const el = document.getElementById("tasksList");
    if (!el) return;
    const state = getState();
    const today = getTodayStr();
    const isFuture = !!(state.selectedDate && state.selectedDate > today);
    const bannerEl = document.getElementById("tasksAutoMoveBanner");

    if (bannerEl) {
      if (isFuture) {
        let pendingCount = 0;
        if (ctx.countPendingAutoMoveTasks) {
          pendingCount = ctx.countPendingAutoMoveTasks(state.selectedDate);
        } else {
          const envKey = state.activeEnv || "work";
          const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
          if (env && env.days) {
            const pastDates = Object.keys(env.days).filter(d => d < state.selectedDate);
            pastDates.forEach(d => {
              const dayObj = env.days[d];
              if (dayObj && Array.isArray(dayObj.tasks)) {
                dayObj.tasks.forEach(t => {
                  if (t.status !== "completed" && t.autoMoveToToday) pendingCount++;
                });
              }
            });
          }
        }

        if (pendingCount > 0) {
          const countText = pendingCount === 1 ? t('tasks.bannerCountOne') : t('tasks.bannerCountOther', { count: pendingCount });
          bannerEl.innerHTML = `
            <div class="automove-banner">
              <span class="automove-banner-text">${t('tasks.bannerText', { countHtml: `<strong>${countText}</strong>` })}</span>
              <button class="btn-bring" onclick="app.rolloverPendingTasksToSelectedDate()" title="${escapeAttr(t('tasks.bannerBtnTooltip'))}">${t('tasks.bannerBtn')}</button>
            </div>`;
          bannerEl.style.display = "block";
        } else {
          bannerEl.innerHTML = "";
          bannerEl.style.display = "none";
        }
      } else {
        bannerEl.innerHTML = "";
        bannerEl.style.display = "none";
      }
    }

    const taskEdit = getTaskEdit();
    const searchQuery = (ctx.getTaskSearchQuery ? ctx.getTaskSearchQuery() : "").trim();

    const active = (state.tasks || []).filter(t => t.status !== "completed")
                               .sort((a,b)=>{
                                 if(a.status==="running") return -1;
                                 if(b.status==="running") return 1;
                                 return a.order-b.order;
                               });

    if(!searchQuery){
      if(active.length === 0){
        el.innerHTML = `<div class="empty">${t('tasks.empty')}</div>`;
      } else {
        el.innerHTML = active.map(t => renderTaskItem(t, schedule, taskEdit)).join("");
      }
    } else {
      // Búsqueda inteligente activa (título, urgencia y destacado)
      const matchingActive = active.filter(t => matchesTaskSearch(t, searchQuery));
      const matchingCompleted = (state.tasks || [])
        .filter(t => t.status === "completed" && matchesTaskSearch(t, searchQuery))
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

      if(matchingActive.length === 0 && matchingCompleted.length === 0){
        el.innerHTML = `
          <div class="search-results-info">
            <span>${t('tasks.searchTitle', { queryHtml: `<strong>"${escapeHtml(searchQuery)}"</strong>` })}</span>
            <button class="search-clear-link" onclick="app.clearTaskSearch()">${t('tasks.searchClear')}</button>
          </div>
          <div class="empty">${t('tasks.searchNoResults', { query: escapeHtml(searchQuery) })}</div>
        `;
      } else {
        let html = `
          <div class="search-results-info">
            <span>${t('tasks.searchResultsHeader', { queryHtml: `<strong>"${escapeHtml(searchQuery)}"</strong>`, active: matchingActive.length, completed: matchingCompleted.length })}</span>
            <button class="search-clear-link" onclick="app.clearTaskSearch()">${t('tasks.searchClear')}</button>
          </div>
        `;

        // Sección de tareas activas
        html += `
          <div class="search-section-heading active-heading">
            <span>${t('tasks.searchSectionActive', { count: matchingActive.length })}</span>
          </div>
        `;
        if(matchingActive.length > 0){
          html += matchingActive.map(t => renderTaskItem(t, schedule, taskEdit)).join("");
        } else {
          html += `<div class="empty empty-subtle">${t('tasks.searchNoActiveMatch')}</div>`;
        }

        // Sección de tareas completadas
        html += `
          <div class="search-section-heading completed-heading">
            <span>${t('tasks.searchSectionCompleted', { count: matchingCompleted.length })}</span>
          </div>
        `;
        if(matchingCompleted.length > 0){
          html += matchingCompleted.map(t => renderCompletedSearchItem(t)).join("");
        } else {
          html += `<div class="empty empty-subtle">${t('tasks.searchNoCompletedMatch')}</div>`;
        }

        el.innerHTML = html;
      }
    }

    if (taskEdit && taskEdit.id) {
      setTimeout(() => {
        const titleInp = document.getElementById(`task-edit-title-${taskEdit.id}`);
        const notesInp = document.getElementById(`task-edit-notes-${taskEdit.id}`);
        if (typeof window !== 'undefined' && window.app && window.app.attachTagAutocompleteToEl) {
          if (titleInp) window.app.attachTagAutocompleteToEl(titleInp);
          if (notesInp) window.app.attachTagAutocompleteToEl(notesInp);
        }
      }, 20);
    }
  }

  return { renderTasks, renderTaskItem, renderCompletedSearchItem, toggleTaskNotes, isTaskNotesExpanded, handleTaskTouchStart, handleTaskTouchMove, handleTaskTouchEnd, handleTaskTouchCancel, handleTaskMouseDown };
}

export default TodayTasksTasksView;
