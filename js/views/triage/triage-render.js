/* views/triage/triage-render.js — Renderizado de filas de tareas, dependencias, grupos y configuración de búsqueda */
import {
  fmt, URGENCY_LEVELS, DEFAULT_URGENCY, formatRecurrenceRule, formatTitleWithTags,
  findTaskInEnvironment, isTaskBlocked, getTaskBlockingDetails, getTasksBlockedBy
} from '../../utils.js';
import { escapeHtml, escapeAttr } from '../../ui.js';
import { t } from '../../i18n.js';

export function createTriageRender(ctx, state, deps) {
  const { getState } = ctx;
  const {
    getTargetDateStr,
    getActiveTasks,
    getEffectiveSchedule,
    formatShortDuration,
    setTriageSearchQuery,
    clearTriageSearch,
    getActions
  } = deps;

  const selectedTaskIds = state.selectedTaskIds;
  const collapsedGroups = state.collapsedGroups;

  function renderTriageDependencyChips(depsList, env) {
    if (!depsList || depsList.length === 0) {
      return `<span class="empty" style="font-size:0.8rem;">${escapeHtml(t('tasks.noDependencies'))}</span>`;
    }
    return depsList.map(depId => {
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

  function renderTriageCompletedRow(task) {
    const isRecurring = !!(task.isRecurring || task.ruleId);
    let completedTimeHtml = '';
    if (task.completedAt !== undefined && task.actualDuration !== undefined && !isNaN(task.completedAt) && !isNaN(task.actualDuration)) {
      const realStart = task.completedAt - task.actualDuration;
      completedTimeHtml = `<span class="triage-task-time tr-running">${fmt(realStart)}<span class="arrow">→</span>${fmt(task.completedAt)}</span>`;
    }
    return `
      <div class="triage-task-row is-completed triage-completed-item" data-task-id="${escapeAttr(task.id)}"
           ondragover="app.taskDragOver(event)"
           ondrop="app.triageTaskDrop(event, '${escapeAttr(task.id)}')">
        <div class="triage-task-left">
          <span class="status-badge completed" style="margin-right:6px;">✓</span>
          ${task.displayId ? `<button type="button" class="task-id-badge" onclick="app.copyTaskId('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('tasks.copyIdTooltip', { id: task.displayId }))}">${escapeHtml(task.displayId)}</button>` : ''}
          <span class="triage-task-title" style="text-decoration:line-through;opacity:0.7;" title="${escapeAttr(task.title)}">
            ${formatTitleWithTags(task.title, 'app.filterByTag')}
          </span>
          <span class="triage-task-duration" title="${escapeAttr(t('triage.durationTooltip'))}">${formatShortDuration(task.planned || 0)}</span>
          ${completedTimeHtml}
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

  function renderTriageTaskRow(task, env, quick5Days, schedule) {
    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    const isSelected = selectedTaskIds.has(String(task.id));
    const urgencyKey = task.urgency || DEFAULT_URGENCY;
    const uInfo = URGENCY_LEVELS[urgencyKey] || URGENCY_LEVELS[DEFAULT_URGENCY];
    const urgencyLabel = t('urgency.' + urgencyKey) || uInfo.label;
    const isRecurring = !!(task.isRecurring || task.ruleId);

    const effSched = schedule || getEffectiveSchedule(getTargetDateStr(), getActiveTasks(getTargetDateStr()));
    const segs = (effSched && effSched.segmentsByTask && (effSched.segmentsByTask[task.id] || effSched.segmentsByTask[String(task.id)])) || [];
    let startVal, endVal, trClass;
    if (task.status === "running") {
      const plannedEnd = task.runningStart + (task.planned - (task.elapsedBefore || 0));
      startVal = fmt(task.runningStart);
      endVal = fmt(plannedEnd);
      trClass = "tr-running";
    } else if (segs.length > 0) {
      startVal = fmt(segs[0].start);
      endVal = fmt(segs[segs.length - 1].end);
      trClass = task.status === "paused" ? "tr-paused" : "tr-pending";
    } else {
      startVal = "—";
      endVal = "—";
      trClass = "tr-pending";
    }
    const timeRangeHtml = `<span class="triage-task-time ${trClass}">${startVal}<span class="arrow">→</span>${endVal}</span>`;

    let recurringTag = '';
    if (isRecurring) {
      let ruleTooltip = t('triage.recurringTooltipDefault');
      if (task.ruleId) {
        const envKey = currentState.activeEnv || 'work';
        const envObj = currentState.environments ? (currentState.environments[envKey] || currentState.environments.work) : null;
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
      : `ondragover="app.taskDragOver(event)" ondrop="app.triageTaskDrop(event, '${escapeAttr(task.id)}')"` ;
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
          ${escapeHtml(t('tasks.blockedBadge'))} (${escapeHtml(blockerDisplay)}${escapeHtml(extraCount)})
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

    const featuredClass = task.featured ? 'featured-task' : '';

    return `
      <div class="triage-task-row ${isSelected ? 'selected' : ''} ${isRecurring ? 'is-recurring' : ''} ${isBlocked ? 'is-blocked' : ''} ${featuredClass}" data-task-id="${escapeAttr(task.id)}"
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
          <label class="triage-cb-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" class="triage-task-cb" ${isSelected ? 'checked' : ''} onclick="app.toggleTriageTaskSelect('${escapeAttr(task.id)}', event)">
          </label>
          <button type="button" class="triage-star-btn ${task.featured ? 'is-featured' : ''}" onclick="app.toggleTriageTaskStar('${escapeAttr(task.id)}', event)" title="${task.featured ? escapeAttr(t('triage.unstarTooltip')) : escapeAttr(t('triage.starTooltip'))}">
            ${task.featured ? '⭐' : '☆'}
          </button>
          ${task.displayId ? `<button type="button" class="task-id-badge" onclick="app.copyTaskId('${escapeAttr(task.id)}', event)" title="${escapeAttr(t('tasks.copyIdTooltip', { id: task.displayId }))}">${escapeHtml(task.displayId)}</button>` : ''}
          ${triageDepBadges}
          <span class="triage-task-title ${task.overflow ? 'is-overflow' : ''}" title="${escapeAttr(task.title)}">
            ${formatTitleWithTags(task.title, 'app.filterByTag')}
          </span>
          <span class="triage-task-duration" title="${escapeAttr(t('triage.durationTooltip'))}">${formatShortDuration(task.planned || 0)}</span>
          ${timeRangeHtml}
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

  function renderTriageGroupsContent(activeTasks, groups, isSearching, matchingCompleted, friendlyDate, searchQuery, env, quick5Days, schedule) {
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
        <div class="triage-group-card ${isCollapsed ? 'collapsed' : ''}" id="triage-group-${escapeAttr(g.id)}"
             ondragover="app.triageGroupDragOver(event, '${escapeAttr(g.id)}')">
          <!-- CABECERA DE GRUPO -->
          <div class="triage-group-header" onclick="app.toggleTriageGroup('${escapeAttr(g.id)}')"
               ondragover="app.triageGroupDragOver(event, '${escapeAttr(g.id)}')')"
               ondrop="app.triageGroupDrop(event, '${escapeAttr(g.id)}')">
            <div class="triage-group-header-left">
              <button type="button" class="triage-chevron-btn" title="${isCollapsed ? escapeAttr(t('triage.groupExpandTooltip')) : escapeAttr(t('triage.groupCollapseTooltip'))}">
                ▾
              </button>
              <label class="triage-cb-wrap" onclick="event.stopPropagation()">
                <input type="checkbox" class="triage-group-cb" ${allSelected ? 'checked' : ''} ${someSelected ? 'data-indeterminate="true"' : ''} onclick="app.toggleTriageGroupSelect('${escapeAttr(g.id)}', event)" title="${escapeAttr(t('triage.groupSelectAllTooltip'))}">
              </label>
              <span class="triage-group-icon">${g.icon}</span>
              <span class="triage-group-title">${escapeHtml(g.title)}</span>
              <span class="triage-group-badge">${t('triage.groupTaskCount', { count: g.tasks.length })}</span>
            </div>
            <div class="triage-group-header-right">
              <span class="triage-group-duration">⏱️ ${formatShortDuration(groupDuration)}</span>
            </div>
          </div>

          <!-- CONTENIDO PLEGABLE DEL GRUPO -->
          <div class="triage-group-body" style="${isCollapsed ? 'display:none;' : ''}"
               ondragover="app.triageGroupDragOver(event, '${escapeAttr(g.id)}')">
            ${g.tasks.length === 0 ? `
              <div class="triage-group-empty" ondragover="app.triageGroupDragOver(event, '${escapeAttr(g.id)}')">${t('triage.groupEmpty')}</div>
            ` : `
              <div class="triage-tasks-list">
                ${g.tasks.map(task => renderTriageTaskRow(task, env, quick5Days, schedule)).join('')}
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
        if (setTriageSearchQuery) setTriageSearchQuery(e.target.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          e.preventDefault();
          e.stopPropagation();
          if (clearTriageSearch) clearTriageSearch();
        }
      });
      if (typeof window !== 'undefined' && window.app && window.app.attachTagAutocompleteToEl) {
        window.app.attachTagAutocompleteToEl(input);
      }
    }
    if (clearBtn && !clearBtn._hasTriageSearchEvents) {
      clearBtn._hasTriageSearchEvents = true;
      clearBtn.addEventListener('click', () => {
        if (clearTriageSearch) clearTriageSearch();
      });
    }
  }

  function syncTriageEditModal(taskEdit, env) {
    if (typeof document === 'undefined') return;
    let modalHost = document.getElementById('triageEditModalHost');
    if (!modalHost && document.body) {
      modalHost = document.createElement('div');
      modalHost.id = 'triageEditModalHost';
      document.body.appendChild(modalHost);
    }
    if (!modalHost) return;

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
        <div class="modal-overlay" id="triageTaskEditModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:100000;align-items:center;justify-content:center;">
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
      const modalEl = modalHost.querySelector('#triageTaskEditModal');
      if (modalEl) {
        modalEl.addEventListener('mousedown', (e) => {
          modalEl._overlayMouseDown = (e.target === modalEl);
        });
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl && modalEl._overlayMouseDown) {
            const actions = getActions ? getActions() : null;
            if (actions && actions.cancelEditTask) {
              actions.cancelEditTask();
            }
          }
          modalEl._overlayMouseDown = false;
        });
      }

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

  function buildFloatingBarHTML(selectedCount, next7Days) {
    return `
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
    `;
  }

  function buildMobileBottomSheetHTML(quick5Days) {
    return `
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
          <div class="triage-move-sheet-grid" ondblclick="event.preventDefault()">
            <button type="button" class="triage-move-grid-btn" onclick="app.moveTriageTaskDirection(app.getActiveMoveSheetTaskId(), 'up', event)" ondblclick="event.preventDefault()">
              <span>${t('triage.moveUp')}</span>
            </button>
            <button type="button" class="triage-move-grid-btn" onclick="app.moveTriageTaskDirection(app.getActiveMoveSheetTaskId(), 'down', event)" ondblclick="event.preventDefault()">
              <span>${t('triage.moveDown')}</span>
            </button>
            <button type="button" class="triage-move-grid-btn" onclick="app.moveTriageTaskDirection(app.getActiveMoveSheetTaskId(), 'top', event)" ondblclick="event.preventDefault()">
              <span>${t('triage.moveToTop')}</span>
            </button>
            <button type="button" class="triage-move-grid-btn" onclick="app.moveTriageTaskDirection(app.getActiveMoveSheetTaskId(), 'bottom', event)" ondblclick="event.preventDefault()">
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
    `;
  }

  function updateTriageViewSelective(params) {
    const {
      container,
      activeTasks,
      groups,
      isSearching,
      matchingCompleted,
      friendlyDate,
      searchQuery,
      env,
      quick5Days,
      schedule,
      allActiveTasksCount,
      targetDateStr,
      totalMinutes,
      selectedCount,
      currentSort,
      canUndo,
      canRedo,
      triageSearchQuery
    } = params;

    const groupsContainer = container.querySelector('.triage-groups-container');
    if (groupsContainer) {
      groupsContainer.innerHTML = renderTriageGroupsContent(activeTasks, groups, isSearching, matchingCompleted, friendlyDate, searchQuery, env, quick5Days, schedule);
      groupsContainer.querySelectorAll('.triage-group-cb[data-indeterminate="true"]').forEach(cb => {
        cb.indeterminate = true;
      });
    }
    const badgeCountEl = container.querySelector('.triage-badge-count');
    if (badgeCountEl) {
      badgeCountEl.textContent = t('triage.taskCount', { count: allActiveTasksCount });
    }
    const subtitleEl = container.querySelector('.triage-subtitle');
    if (subtitleEl) {
      subtitleEl.innerHTML = t('triage.subtitle', { date: escapeHtml(friendlyDate), dateStr: escapeHtml(targetDateStr), totalTime: formatShortDuration(totalMinutes) });
    }
    container.classList.toggle('has-floating-bar', selectedCount > 0);
    const innerEl = container.querySelector('.triage-view-inner');
    if (innerEl) {
      innerEl.classList.toggle('has-floating-bar', selectedCount > 0);
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
    if (undoBtn) undoBtn.disabled = !canUndo;
    const redoBtn = container.querySelector('#triageRedoBtn');
    if (redoBtn) redoBtn.disabled = !canRedo;
    container.querySelectorAll('.triage-sort-btn').forEach(btn => {
      const mode = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      if (mode) {
        btn.className = `triage-sort-btn ${currentSort === mode ? 'active' : ''}`;
      }
    });
    const searchInpEl = document.getElementById('triageSearchInput');
    if (searchInpEl && searchInpEl.value !== triageSearchQuery) {
      searchInpEl.value = triageSearchQuery;
    }
    const clearBtn = document.getElementById('triageSearchClearBtn');
    if (clearBtn) {
      clearBtn.style.display = isSearching ? 'block' : 'none';
    }
  }

  function buildTriageFullHTML(params) {
    const {
      selectedCount,
      allActiveTasksCount,
      friendlyDate,
      targetDateStr,
      totalMinutes,
      sortButtons,
      currentSort,
      canUndo,
      canRedo,
      triageSearchQuery,
      isSearching,
      activeTasks,
      groups,
      matchingCompleted,
      searchQuery,
      env,
      quick5Days,
      schedule,
      next7Days
    } = params;

    return `
      <div class="triage-view-inner ${selectedCount > 0 ? 'has-floating-bar' : ''}">
        <!-- TOP BAR -->
        <header class="triage-header">
          <div class="triage-header-left">
            <button class="btn primary small triage-btn-back" onclick="if(window.location.hash==='#/triage') window.location.hash='#/'; else if(app.showView) app.showView('main');" title="${escapeAttr(t('triage.btnBackTooltip'))}">
              ${t('triage.btnBack')}
            </button>
            <div class="triage-undo-redo-group">
              <button type="button" class="btn secondary small triage-history-btn" id="triageUndoBtn" onclick="app.triageUndo()" ${canUndo ? '' : 'disabled'} title="${escapeAttr(t('triage.btnUndoTooltip'))}">
                <span class="triage-history-icon">↶</span>
                <span class="triage-history-label">${t('triage.btnUndo')}</span>
              </button>
              <button type="button" class="btn secondary small triage-history-btn" id="triageRedoBtn" onclick="app.triageRedo()" ${canRedo ? '' : 'disabled'} title="${escapeAttr(t('triage.btnRedoTooltip'))}">
                <span class="triage-history-icon">↷</span>
                <span class="triage-history-label">${t('triage.btnRedo')}</span>
              </button>
            </div>
            <div>
              <div class="triage-title-row">
                <h1 class="triage-title">${t('triage.title')}</h1>
                <span class="triage-badge-count">${t('triage.taskCount', { count: allActiveTasksCount })}</span>
              </div>
              <p class="triage-subtitle">
                ${t('triage.subtitle', { date: escapeHtml(friendlyDate), dateStr: escapeHtml(targetDateStr), totalTime: formatShortDuration(totalMinutes) })}
              </p>
            </div>
          </div>

          <div class="triage-header-right">
            <div class="triage-sort-selector">
              <span class="triage-sort-label">${t('triage.sortLabel')}</span>
              ${(sortButtons || [
                { id: 'urgency', label: t('triage.sortUrgency') },
                { id: 'viability', label: t('triage.sortViability') },
                { id: 'duration', label: t('triage.sortDuration') },
                { id: 'featured', label: t('triage.sortFeatured') }
              ]).map(b => `
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
          ${renderTriageGroupsContent(activeTasks, groups, isSearching, matchingCompleted, friendlyDate, searchQuery, env, quick5Days, schedule)}
        </main>

        ${buildFloatingBarHTML(selectedCount, next7Days)}

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

        ${buildMobileBottomSheetHTML(quick5Days)}
      </div>
    `;
  }

  function renderTriageViewFullOrSelective(params) {
    const { container, isDifferentDate, ...rest } = params;
    const innerEl = container.querySelector('.triage-view-inner');
    const searchInpEl = document.getElementById('triageSearchInput');
    if (innerEl && searchInpEl && !isDifferentDate) {
      updateTriageViewSelective({ container, ...rest });
      return;
    }

    container.classList.toggle('has-floating-bar', rest.selectedCount > 0);
    container.innerHTML = buildTriageFullHTML(rest);
    setupTriageSearch();
    container.querySelectorAll('.triage-group-cb[data-indeterminate="true"]').forEach(cb => {
      cb.indeterminate = true;
    });
  }

  return {
    renderTriageDependencyChips,
    renderTriageCompletedRow,
    renderTriageTaskRow,
    renderTriageGroupsContent,
    setupTriageSearch,
    syncTriageEditModal,
    buildFloatingBarHTML,
    buildMobileBottomSheetHTML,
    updateTriageViewSelective,
    buildTriageFullHTML,
    renderTriageViewFullOrSelective
  };
}
