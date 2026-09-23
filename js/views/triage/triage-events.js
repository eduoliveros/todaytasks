/* views/triage/triage-events.js — Manejadores de eventos de fila, clics, búsqueda y acciones individuales */

export function createTriageEvents(ctx, state, deps) {
  const { getState } = ctx;
  const {
    getTargetDateStr,
    getActiveTasks,
    getActions,
    renderTriageView,
    wasJustDragged,
    toggleTriageTaskSelect,
  } = deps;

  const selectedTaskIds = state.selectedTaskIds;
  let lastClickedTaskId = null;
  let lastClickTime = 0;

  function getSearchQuery() {
    return typeof state.getTriageSearchQuery === 'function'
      ? state.getTriageSearchQuery()
      : (state.triageSearchQuery || '');
  }

  function setSearchQuery(query) {
    if (typeof state.setTriageSearchQuery === 'function') {
      state.setTriageSearchQuery(query);
    } else {
      state.triageSearchQuery = query;
    }
  }

  function setTriageSearchQuery(query) {
    const val = typeof query === 'string' ? query : '';
    setSearchQuery(val);
    const input = document.getElementById('triageSearchInput');
    if (input && input.value !== val) {
      input.value = val;
    }
    const clearBtn = document.getElementById('triageSearchClearBtn');
    if (clearBtn) {
      clearBtn.style.display = val ? 'block' : 'none';
    }
    renderTriageView();
  }

  function getTriageSearchQuery() {
    return getSearchQuery();
  }

  function clearTriageSearch() {
    setSearchQuery('');
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

  function isMobileViewport() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  }

  function handleTriageRowClick(taskId, event) {
    if (wasJustDragged && wasJustDragged()) return;
    if (!event) return;
    if (event.target && event.target.closest && (
      event.target.closest('button') ||
      event.target.closest('input[type="checkbox"]') ||
      event.target.closest('.triage-cb-wrap') ||
      event.target.closest('.drag-handle') ||
      event.target.closest('.triage-drag-handle')
    )) {
      return;
    }
    if (event.stopPropagation) event.stopPropagation();

    // En móvil (<= 640px): abrir bottom sheet de detalle
    if (isMobileViewport()) {
      if (state.triageClickTimer) {
        clearTimeout(state.triageClickTimer);
        state.triageClickTimer = null;
      }
      lastClickedTaskId = null;
      lastClickTime = 0;
      if (window.app && window.app.openTaskDetailSheet) {
        window.app.openTaskDetailSheet(taskId);
      } else if (ctx && ctx.taskDetailSheetModule && ctx.taskDetailSheetModule.openTaskDetailSheet) {
        ctx.taskDetailSheetModule.openTaskDetailSheet(taskId);
      }
      return;
    }

    const strId = String(taskId);
    const now = Date.now();

    // Detección de doble clic / tap (450ms)
    if (lastClickedTaskId === strId && (now - lastClickTime) < 450) {
      if (state.triageClickTimer) {
        clearTimeout(state.triageClickTimer);
        state.triageClickTimer = null;
      }
      lastClickedTaskId = null;
      lastClickTime = 0;
      handleTriageRowDblClick(taskId, event);
      return;
    }

    if (state.triageClickTimer) {
      clearTimeout(state.triageClickTimer);
      state.triageClickTimer = null;
      if (lastClickedTaskId && lastClickedTaskId !== strId && toggleTriageTaskSelect) {
        toggleTriageTaskSelect(lastClickedTaskId);
      }
    }

    lastClickedTaskId = strId;
    lastClickTime = now;

    state.triageClickTimer = setTimeout(() => {
      state.triageClickTimer = null;
      lastClickedTaskId = null;
      lastClickTime = 0;
      if (toggleTriageTaskSelect) {
        toggleTriageTaskSelect(taskId);
      }
    }, 400);
  }

  function handleTriageRowDblClick(taskId, event) {
    if (!event) return;
    if (event.target && event.target.closest && (
      event.target.closest('button') ||
      event.target.closest('input[type="checkbox"]') ||
      event.target.closest('.drag-handle')
    )) {
      return;
    }
    if (event.stopPropagation) event.stopPropagation();
    if (state.triageClickTimer) {
      clearTimeout(state.triageClickTimer);
      state.triageClickTimer = null;
    }
    lastClickedTaskId = null;
    lastClickTime = 0;
    selectedTaskIds.delete(String(taskId));

    const actions = getActions();
    if (actions && actions.startEditTask) {
      actions.startEditTask(taskId);
    }
  }

  function toggleTriageTaskStar(taskId, event) {
    if (event) event.stopPropagation();
    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const task = activeTasks.find(x => String(x.id) === String(taskId)) ||
                 ((currentState.tasks || []).find(x => String(x.id) === String(taskId)));
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

  return {
    setTriageSearchQuery,
    getTriageSearchQuery,
    clearTriageSearch,
    isMobileViewport,
    handleTriageRowClick,
    handleTriageRowDblClick,
    toggleTriageTaskStar,
    moveTriageTaskToDate,
    completeTriageSingleTask,
    deleteTriageSingleTask,
  };
}
