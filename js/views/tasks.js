/* views/tasks.js — Renderizado de la lista de tareas activas */
import {
  nowMinutes, fmt, fmtDur, fmtRemaining, getTaskElapsed, getTodayStr, matchesSearchQuery,
  matchesTaskSearch, formatRecurrenceRule,
  URGENCY_LEVELS, DEFAULT_URGENCY, formatTitleWithTags
} from '../utils.js';
import { escapeHtml, escapeAttr, renderNotesMarkdown } from '../ui.js';
import { t } from '../i18n.js';

export function TodayTasksTasksView(ctx){
  const { getState, getTaskEdit } = ctx;
  const expandedNotesTasks = new Set();

  function isTaskNotesExpanded(id) {
    return expandedNotesTasks.has(String(id));
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

    if(taskEdit && String(taskEdit.id) === String(task.id)){
      const isRecurring = task.isRecurring || !!taskEdit.ruleId;
      const editUrgency = taskEdit.urgency || urgencyKey;
      const editUrgencyInfo = URGENCY_LEVELS[editUrgency] || URGENCY_LEVELS[DEFAULT_URGENCY];
      return `
      <div class="item task-item editing ${taskEdit.featured ? 'featured-task' : ''} ${isOverflow ? 'task-overflow' : ''}" id="task-item-${escapeAttr(task.id)}">
        <div class="row">
          <input type="text" id="task-edit-title-${escapeAttr(task.id)}" value="${escapeAttr(taskEdit.title)}" onfocus="if(app.attachTagAutocompleteToEl) app.attachTagAutocompleteToEl(this)" oninput="app.updateTaskEditField('title', this.value)" placeholder="${escapeAttr(t('tasks.inputTitlePlaceholder'))}">
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
          <textarea id="task-edit-notes-${escapeAttr(task.id)}" class="task-edit-notes-textarea" rows="2" style="width:100%;box-sizing:border-box;" placeholder="${escapeAttr(t('tasks.notesPlaceholder'))}" oninput="app.updateTaskEditField('notes', this.value)">${escapeHtml(taskEdit.notes || '')}</textarea>
          <div id="task-edit-notes-preview-${escapeAttr(task.id)}" class="task-edit-notes-preview task-note-content" style="display:none;"></div>
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

    let startTag, startVal, endTag, endVal, trClass, splitNote = "", remainingChip = "";
    if(task.status === "running"){
      const plannedEnd = task.runningStart + (task.planned - (task.elapsedBefore||0));
      startTag = t('summary.tagRealStart'); startVal = fmt(task.runningStart);
      endTag = t('tasks.tagEstEnd'); endVal = fmt(plannedEnd);
      trClass = "tr-running";
      const rem = fmtRemaining(plannedEnd, nowMinutes());
      remainingChip = `<span class="remaining-chip ${rem.overrun ? 'overrun' : ''}">${escapeHtml(rem.text)}</span>`;
    } else if(segs.length > 0){
      startTag = t('tasks.tagEstStart'); startVal = fmt(segs[0].start);
      endTag = t('tasks.tagEstEnd'); endVal = fmt(segs[segs.length-1].end);
      trClass = "tr-pending";
      if(segs.length > 1){
        const parts = segs.map(s => `${fmt(s.start)}-${fmt(s.end)}`).join(", ");
        splitNote = `<div class="meta" style="color:#B45309">${t('tasks.splitByMeetings', { parts })}</div>`;
      }
    } else {
      startTag = t('tasks.tagEstStart'); startVal = "—";
      endTag = t('tasks.tagEstEnd'); endVal = "—";
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

    return `
      <div class="item task-item ${task.status} ${featuredClass} ${overflowClass}" id="task-item-${escapeAttr(task.id)}" data-task-id="${escapeAttr(task.id)}" ondblclick="app.startEditTask('${escapeAttr(task.id)}')" ${dragAttrs}>
        <div class="top">
          <div style="display:flex;align-items:flex-start;gap:6px;flex:1;min-width:0;">
            ${dragHandle}
            <div style="flex:1;min-width:0;">
              <div class="title">${formatTitleWithTags(task.title, 'app.filterByTag')}</div>
              <div class="time-range ${trClass}">
                ${urgencyPill}
                ${startAfterPill}
                ${notesPill}
                <span class="tag">${startTag}</span>${startVal}<span class="arrow">→</span><span class="tag">${endTag}</span>${endVal}
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
            <button class="btn small run" onclick="app.startTask('${escapeAttr(task.id)}')">${t('tasks.btnStart')}</button>
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
            <button class="btn small run" onclick="app.resumeTask('${escapeAttr(task.id)}')">${t('tasks.btnResume')}</button>
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
      <div class="item task-item completed-search-item" id="task-item-${escapeAttr(task.id)}" data-task-id="${escapeAttr(task.id)}">
        <div class="top">
          <div style="flex:1;min-width:0;">
            <div class="title completed-title">${formatTitleWithTags(task.title, 'app.filterByTag')}</div>
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
        return;
      }
      el.innerHTML = active.map(t => renderTaskItem(t, schedule, taskEdit)).join("");
      return;
    }

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
      return;
    }

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

  return { renderTasks, renderTaskItem, renderCompletedSearchItem, toggleTaskNotes, isTaskNotesExpanded };
}

export default TodayTasksTasksView;
