/* app/dependencies.js — Gestión de dependencias entre tareas y selectores modales */
import { t } from '../i18n.js';
import { searchAllTasks, findTaskInEnvironment, checkCircularDependency, getTaskBlockingDetails } from '../utils.js';
import { escapeHtml, escapeAttr } from '../ui.js';

export function TodayTasksDependencies(appCtx) {
  const { getState, actionsModule, showToast, renderAll } = appCtx;

  // Estado del formulario principal
  let formDependencies = [];

  // Estado del selector modal
  let currentSelectorTargetId = null;
  let currentSelectorSource = 'form'; // 'form' | 'task-edit' | 'triage'

  // Estado del modal de confirmación de tarea bloqueada
  let pendingStartCallback = null;
  let pendingBlockedTask = null;
  let pendingBlockingTask = null;

  /* --- Manejo de dependencias del formulario de nueva tarea --- */
  function getFormDependencies() {
    return [...formDependencies];
  }

  function setFormDependencies(deps) {
    formDependencies = Array.isArray(deps) ? [...deps] : [];
    renderFormDependencies();
    if (appCtx.updateTaskAdvancedIndicators) {
      appCtx.updateTaskAdvancedIndicators();
    }
  }

  function clearFormDependencies() {
    formDependencies = [];
    renderFormDependencies();
    if (appCtx.updateTaskAdvancedIndicators) {
      appCtx.updateTaskAdvancedIndicators();
    }
  }

  function addFormDependency(depId) {
    if (!depId) return;
    const strId = String(depId);
    if (!formDependencies.includes(strId)) {
      formDependencies.push(strId);
      renderFormDependencies();
      if (appCtx.updateTaskAdvancedIndicators) {
        appCtx.updateTaskAdvancedIndicators();
      }
    }
  }

  function removeFormDependency(depId) {
    const strId = String(depId);
    formDependencies = formDependencies.filter(id => id !== strId);
    renderFormDependencies();
    if (appCtx.updateTaskAdvancedIndicators) {
      appCtx.updateTaskAdvancedIndicators();
    }
  }

  function renderFormDependencies() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('formTaskDependenciesList');
    if (!listEl) return;

    if (!formDependencies || formDependencies.length === 0) {
      listEl.innerHTML = `<span class="empty" data-i18n="tasks.noDependencies">${escapeHtml(t('tasks.noDependencies'))}</span>`;
      return;
    }

    const state = typeof getState === 'function' ? getState() : {};
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;

    listEl.innerHTML = formDependencies.map(depId => {
      const found = env ? findTaskInEnvironment(env, depId) : null;
      const dTask = found ? found.task : null;
      const dId = dTask?.displayId || depId;
      const dTitle = dTask?.title || depId;

      return `
        <span class="dep-chip" data-dep-id="${escapeAttr(depId)}">
          <span class="task-id-badge">${escapeHtml(dId)}</span>
          <span class="dep-chip-title">${escapeHtml(dTitle)}</span>
          <button type="button" class="dep-chip-remove" onclick="app.removeFormDependency('${escapeAttr(depId)}')" title="${escapeAttr(t('action.delete'))}">✕</button>
        </span>
      `;
    }).join('');
  }

  /* --- Selector Modal de Dependencias --- */
  function openDependencySelector(targetTaskId = null, source = 'form') {
    if (typeof document === 'undefined') return;
    currentSelectorTargetId = targetTaskId ? String(targetTaskId) : null;
    currentSelectorSource = source;

    const modal = document.getElementById('dependencySelectorModal');
    const input = document.getElementById('dependencySelectorSearchInput');
    if (!modal) return;

    modal.style.display = 'flex';
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
    renderDependencySearchResults('');
  }

  function closeDependencySelector() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('dependencySelectorModal');
    if (modal) modal.style.display = 'none';
    currentSelectorTargetId = null;
  }

  function onDependencySearchInput(val) {
    renderDependencySearchResults(val);
  }

  function renderDependencySearchResults(query) {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('dependencySelectorList');
    if (!listEl) return;

    const state = typeof getState === 'function' ? getState() : {};
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;

    const searchResults = searchAllTasks(state, query, { envKey, filter: 'all' });

    // Filtrar candidatos válidos
    const validResults = searchResults.filter(item => {
      if (item.isTemplateRule) return false;
      if (currentSelectorTargetId && String(item.id) === currentSelectorTargetId) return false;
      return true;
    });

    if (validResults.length === 0) {
      listEl.innerHTML = `<div class="dependency-selector-empty">${escapeHtml(t('tasks.noSearchMatches'))}</div>`;
      return;
    }

    // Obtener dependencias actuales según la fuente
    let currentDeps = [];
    if (currentSelectorSource === 'form') {
      currentDeps = formDependencies;
    } else {
      const taskEdit = appCtx.getTaskEdit ? appCtx.getTaskEdit() : null;
      currentDeps = (taskEdit && Array.isArray(taskEdit.dependsOn)) ? taskEdit.dependsOn.map(String) : [];
      // Si no hay taskEdit pero hay targetTaskId en env
      if (currentDeps.length === 0 && currentSelectorTargetId && env) {
        const found = findTaskInEnvironment(env, currentSelectorTargetId);
        if (found && found.task && Array.isArray(found.task.dependsOn)) {
          currentDeps = found.task.dependsOn.map(String);
        }
      }
    }

    listEl.innerHTML = validResults.slice(0, 50).map(item => {
      const strId = String(item.id);
      const isAlreadyAdded = currentDeps.includes(strId);
      const wouldCauseCycle = currentSelectorTargetId ? checkCircularDependency(currentSelectorTargetId, strId, env) : false;

      let itemClass = 'dependency-selector-item';
      let clickAttr = `onclick="app.selectDependency('${escapeAttr(strId)}')"` ;
      let titleAttr = '';

      if (isAlreadyAdded) {
        itemClass += ' already-added';
        clickAttr = '';
        titleAttr = `title="${escapeAttr(t('tasks.dependencyAlreadyAdded'))}"`;
      } else if (wouldCauseCycle) {
        itemClass += ' selected';
        clickAttr = '';
        titleAttr = `title="${escapeAttr(t('tasks.circularDepError'))}"`;
      }

      const statusLabel = item.status === 'completed' ? t('tasks.searchCompleted') : t('tasks.searchPending');
      const badgeClass = item.status === 'completed' ? 'done' : 'pending';

      return `
        <div class="${itemClass}" ${clickAttr} ${titleAttr}>
          <div class="dependency-selector-item-main">
            ${item.displayId ? `<span class="task-id-badge">${escapeHtml(item.displayId)}</span>` : ''}
            <span class="dependency-selector-item-title">${escapeHtml(item.title)}</span>
          </div>
          <div class="dependency-selector-item-meta">
            <span>${escapeHtml(item.dateStr || '')}</span>
            <span class="status-badge ${badgeClass}" style="font-size:10px;">${escapeHtml(statusLabel)}</span>
            ${isAlreadyAdded ? '<span style="color:#059669;font-weight:bold;margin-left:4px;">✓</span>' : ''}
            ${wouldCauseCycle ? `<span style="color:#dc2626;font-size:11px;margin-left:4px;">(${escapeHtml(t('tasks.circularDependency'))})</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function selectDependency(depId) {
    if (!depId) return;
    const strId = String(depId);

    if (currentSelectorSource === 'form') {
      addFormDependency(strId);
    } else if (currentSelectorSource === 'task-edit' || currentSelectorSource === 'triage') {
      if (actionsModule && actionsModule.addEditTaskDependency) {
        actionsModule.addEditTaskDependency(strId);
      } else if (actionsModule && actionsModule.addDependency && currentSelectorTargetId) {
        actionsModule.addDependency(currentSelectorTargetId, strId);
      }
    }

    closeDependencySelector();
  }

  /* --- Modal de confirmación de inicio de tarea bloqueada --- */
  function confirmBlockedTaskStart(task, onConfirm) {
    if (typeof document === 'undefined') {
      if (onConfirm) onConfirm();
      return;
    }

    pendingStartCallback = onConfirm;
    pendingBlockedTask = task;

    const modal = document.getElementById('blockedTaskConfirmModal');
    const detailsEl = document.getElementById('blockedConfirmDetails');
    const jumpBtn = document.getElementById('btnJumpToBlockingTask');
    const forceBtn = document.getElementById('btnForceStartBlockedTask');

    const state = typeof getState === 'function' ? getState() : {};
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;

    const blockingDetails = env ? getTaskBlockingDetails(task, env) : [];
    const uncompletedBlockers = blockingDetails.filter(bt => !bt.isCompleted);
    pendingBlockingTask = uncompletedBlockers[0] || null;

    if (detailsEl) {
      const blockingListHtml = uncompletedBlockers.map(bt => {
        const isDone = bt.isCompleted;
        const stLabel = isDone ? t('tasks.searchCompleted') : t('tasks.searchPending');
        const badgeColor = isDone ? 'color:#059669;' : 'color:#d97706;';
        return `
          <li style="margin-top:4px;display:flex;align-items:center;gap:6px;">
            ${bt.displayId ? `<span class="task-id-badge" style="font-size:10px;">${escapeHtml(bt.displayId)}</span>` : ''}
            <span style="font-weight:500;">${escapeHtml(bt.title)}</span>
            <span style="font-size:11px;${badgeColor}">(${escapeHtml(stLabel)})</span>
          </li>
        `;
      }).join('');

      detailsEl.innerHTML = `
        <div style="font-weight:600;margin-bottom:6px;color:var(--ink);">${escapeHtml(t('tasks.blockedTooltip'))}:</div>
        <ul style="margin:0;padding-left:16px;list-style:disc;">
          ${blockingListHtml}
        </ul>
      `;
    }

    if (jumpBtn) {
      jumpBtn.style.display = pendingBlockingTask ? 'inline-block' : 'none';
      jumpBtn.onclick = jumpToBlockingTask;
    }

    if (forceBtn) {
      forceBtn.onclick = forceStartBlockedTask;
    }

    if (modal) {
      modal.style.display = 'flex';
    }
  }

  function closeBlockedConfirmModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('blockedTaskConfirmModal');
    if (modal) modal.style.display = 'none';
    pendingStartCallback = null;
    pendingBlockedTask = null;
    pendingBlockingTask = null;
  }

  function forceStartBlockedTask() {
    const cb = pendingStartCallback;
    closeBlockedConfirmModal();
    if (typeof cb === 'function') {
      cb();
    }
  }

  function jumpToBlockingTask() {
    const bt = pendingBlockingTask;
    closeBlockedConfirmModal();
    if (bt && appCtx.goToTask) {
      appCtx.goToTask(bt.id, bt.dateStr);
    }
  }

  // Setup click outside on modal overlays if document available
  if (typeof document !== 'undefined') {
    const depModal = document.getElementById('dependencySelectorModal');
    if (depModal) {
      depModal.addEventListener('click', (e) => {
        if (e.target === depModal) closeDependencySelector();
      });
    }

    const blockedModal = document.getElementById('blockedTaskConfirmModal');
    if (blockedModal) {
      blockedModal.addEventListener('click', (e) => {
        if (e.target === blockedModal) closeBlockedConfirmModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (depModal && depModal.style.display === 'flex') {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeDependencySelector();
        } else if (blockedModal && blockedModal.style.display === 'flex') {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeBlockedConfirmModal();
        }
      }
    });
  }

  return {
    getFormDependencies,
    setFormDependencies,
    clearFormDependencies,
    addFormDependency,
    removeFormDependency,
    renderFormDependencies,
    openDependencySelector,
    closeDependencySelector,
    onDependencySearchInput,
    selectDependency,
    confirmBlockedTaskStart,
    closeBlockedConfirmModal,
    forceStartBlockedTask,
    jumpToBlockingTask
  };
}

export default TodayTasksDependencies;
