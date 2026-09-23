/* views/triage/triage-batch.js — Selección, acciones en lote, popovers y undo/redo */
import { t } from '../../i18n.js';

export function createTriageBatch(ctx, state, deps) {
  const { getState } = ctx;
  const {
    getTargetDateStr,
    getActiveTasks,
    getGroups,
    getActions,
    renderTriageView,
  } = deps;

  const selectedTaskIds = state.selectedTaskIds;
  let activeSingleUrgencyTaskId = state.activeSingleUrgencyTaskId ?? null;

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

  function openTriageSingleUrgency(taskId, event) {
    if (event) event.stopPropagation();
    activeSingleUrgencyTaskId = String(taskId);
    state.activeSingleUrgencyTaskId = activeSingleUrgencyTaskId;
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
    state.activeSingleUrgencyTaskId = null;
    const popover = document.getElementById('triageSingleUrgencyPopover');
    if (popover) popover.style.display = 'none';
    const moveDropdown = document.getElementById('triageMoveDropdown');
    if (moveDropdown) moveDropdown.style.display = 'none';
    const batchUrgencyDropdown = document.getElementById('triageBatchUrgencyDropdown');
    if (batchUrgencyDropdown) batchUrgencyDropdown.style.display = 'none';
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
    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const ids = Array.from(selectedTaskIds);
    const actions = getActions();

    const recurringTasks = [];
    const normalIds = [];

    ids.forEach(id => {
      const task = activeTasks.find(x => String(x.id) === String(id)) ||
                   ((currentState.tasks || []).find(x => String(x.id) === String(id)));
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

  return {
    toggleTriageTaskSelect,
    toggleTriageGroupSelect,
    clearTriageSelection,
    openTriageSingleUrgency,
    applyTriageSingleUrgency,
    closeTriagePopovers,
    toggleTriageDropdown,
    executeTriageMoveSelectedDate,
    executeTriageBatchUrgency,
    executeTriageBatchStar,
    executeTriageBatchDelete,
    executeTriageBatchComplete,
    executeTriageBatchMoveDirection,
    triageUndo,
    triageRedo,
    canTriageUndo,
    canTriageRedo,
  };
}
