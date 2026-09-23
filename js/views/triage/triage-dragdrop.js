/* views/triage/triage-dragdrop.js — Drag & drop (desktop) y soporte táctil con bottom sheet móvil */
import { createTouchDragEngine } from '../../app/touch-drag.js';
import { flashTapFeedback, showToast } from '../../ui.js';
import { t } from '../../i18n.js';

export function createTriageDragDrop(ctx, state, deps) {
  const { getState, saveState } = ctx;
  const {
    getTargetDateStr,
    getActiveTasks,
    getGroups,
    getActions,
    renderTriageView,
  } = deps;

  const selectedTaskIds = state.selectedTaskIds;
  let activeMoveSheetTaskId = state.activeMoveSheetTaskId ?? null;

  function moveTriageTaskDirection(taskId, direction, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (event) {
      const btn = event.currentTarget || (event.target && typeof event.target.closest === 'function' ? event.target.closest('.triage-move-grid-btn') : null);
      flashTapFeedback(btn);
    }
    const actions = getActions();
    if (actions && actions.moveTaskDirectly) {
      actions.moveTaskDirectly(taskId, direction, selectedTaskIds);
    }
    closeMobileMoveSheet();
    renderTriageView();
  }

  function openMobileMoveSheet(taskId, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    activeMoveSheetTaskId = String(taskId);
    state.activeMoveSheetTaskId = activeMoveSheetTaskId;
    const sheet = document.getElementById('triageMobileMoveSheet');
    if (!sheet) return;
    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const task = activeTasks.find(t => String(t.id) === String(taskId)) ||
                 ((currentState.tasks || []).find(t => String(t.id) === String(taskId)));
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
    state.activeMoveSheetTaskId = null;
    const sheet = document.getElementById('triageMobileMoveSheet');
    if (sheet) sheet.style.display = 'none';
  }

  function getActiveMoveSheetTaskId() {
    return activeMoveSheetTaskId;
  }

  // TOUCH LONG PRESS & DRAG (motor compartido js/app/touch-drag.js)
  const touchEngine = createTouchDragEngine({
    rowSelector: '.triage-task-row',
    handleSelector: '.triage-drag-handle',
    shouldIgnoreStart: (event) => {
      return !!(event.target && typeof event.target.closest === 'function' &&
        (event.target.closest('button') || event.target.closest('input[type="checkbox"]') || event.target.closest('.triage-cb-wrap')));
    },
    isDraggable: (taskId) => {
      const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
      const targetDateStr = getTargetDateStr();
      const activeTasks = getActiveTasks(targetDateStr);
      const task = activeTasks.find(t => String(t.id) === String(taskId)) ||
                   ((currentState.tasks || []).find(t => String(t.id) === String(taskId)));
      return task ? (task.status === 'pending' || task.status === 'paused') : true;
    },
    getSelectedIds: () => selectedTaskIds,
    isDropTargetAllowed: (sourceId, targetId) => {
      const actions = getActions();
      if (actions && typeof actions.checkIsDropTargetAllowed === 'function') {
        return actions.checkIsDropTargetAllowed(targetId, sourceId, selectedTaskIds);
      }
      return true;
    },
    onDragStart: (taskId, rowEl) => {
      if (state.triageClickTimer) {
        clearTimeout(state.triageClickTimer);
        state.triageClickTimer = null;
      }
      if (rowEl) {
        rowEl.classList.add('long-press-active', 'dragging');
      }
      if (selectedTaskIds.has(String(taskId))) {
        selectedTaskIds.forEach(id => {
          const r = document.querySelector(`.triage-task-row[data-task-id="${id}"]`);
          if (r) r.classList.add('long-press-active', 'dragging');
        });
      }
    },
    onDrop: (sourceId, targetId, selectedIds) => {
      const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
      const targetDateStr = getTargetDateStr();
      const activeTasks = getActiveTasks(targetDateStr);
      const targetTask = activeTasks.find(t => String(t.id) === String(targetId)) ||
                         ((currentState.tasks || []).find(t => String(t.id) === String(targetId)));
      const movingIds = (selectedIds && selectedIds.size > 0 && selectedIds.has(String(sourceId)))
        ? Array.from(selectedIds)
        : [sourceId];

      const currentSort = typeof state.getCurrentSort === 'function'
        ? state.getCurrentSort()
        : (state.currentSort || 'urgency');

      if (targetTask && movingIds.length > 0) {
        if (currentSort === 'urgency' && targetTask.urgency) {
          movingIds.forEach(id => {
            const tObj = (currentState.tasks || []).find(x => String(x.id) === String(id));
            if (tObj) tObj.urgency = targetTask.urgency;
          });
        } else if (currentSort === 'featured' && targetTask.featured !== undefined) {
          movingIds.forEach(id => {
            const tObj = (currentState.tasks || []).find(x => String(x.id) === String(id));
            if (tObj) tObj.featured = targetTask.featured;
          });
        }
      }

      const actions = getActions();
      if (actions && actions.reorderTaskByDrag) {
        actions.reorderTaskByDrag(sourceId, targetId, selectedIds);
      } else if (actions && actions.taskDrop) {
        actions.taskDrop({ preventDefault: () => {} }, targetId, selectedIds);
      }
      renderTriageView();
    },
    onLongPressNotDraggable: (taskId, event) => {
      openMobileMoveSheet(taskId, event);
    }
  });

  function handleTriageTouchStart(taskId, event) {
    touchEngine.handleTouchStart(taskId, event);
  }

  function handleTriageTouchMove(event) {
    touchEngine.handleTouchMove(event);
  }

  function handleTriageTouchEnd(event) {
    touchEngine.handleTouchEnd(event);
  }

  function handleTriageTouchCancel(event) {
    touchEngine.handleTouchCancel(event);
  }

  function handleTriageMouseDown(taskId, event) {
    touchEngine.handleMouseDown(taskId, event);
  }

  function triageTaskDragStart(event, taskId) {
    const actions = getActions();
    if (actions && actions.taskDragStart) {
      actions.taskDragStart(event, taskId, selectedTaskIds);
    }
  }

  function triageGroupDragOver(event, groupId) {
    if (event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
  }

  function triageGroupDrop(event, groupId) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();

    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);

    const currentSort = typeof state.getCurrentSort === 'function'
      ? state.getCurrentSort()
      : (state.currentSort || 'urgency');

    if (currentSort === 'viability' || currentSort === 'duration') {
      showToast(t('tasks.toastCannotChangeGroupAuto'));
      return;
    }

    let draggedId = null;
    if (event && event.dataTransfer) {
      try { draggedId = event.dataTransfer.getData('text/plain'); } catch (e) {}
    }

    const movingIds = (selectedTaskIds.size > 0 && draggedId && selectedTaskIds.has(String(draggedId)))
      ? Array.from(selectedTaskIds)
      : (draggedId ? [draggedId] : []);

    if (movingIds.length === 0) return;

    const actions = getActions();
    if (currentSort === 'urgency') {
      movingIds.forEach(id => {
        const tObj = (currentState.tasks || []).find(x => String(x.id) === String(id));
        if (tObj) tObj.urgency = groupId;
      });
      const groups = getGroups(activeTasks, targetDateStr);
      const targetGroup = groups.find(g => g.id === groupId);
      if (targetGroup && targetGroup.tasks.length > 0) {
        const lastTask = targetGroup.tasks[targetGroup.tasks.length - 1];
        if (actions && actions.taskDrop) {
          actions.taskDrop(event, lastTask.id, selectedTaskIds);
        }
      } else {
        if (saveState) saveState();
      }
    } else if (currentSort === 'featured') {
      const enable = (groupId === 'feat');
      movingIds.forEach(id => {
        const tObj = (currentState.tasks || []).find(x => String(x.id) === String(id));
        if (tObj) tObj.featured = enable;
      });
      if (saveState) saveState();
    }

    renderTriageView();
  }

  function triageTaskDrop(event, taskId) {
    if (event && event.stopPropagation) event.stopPropagation();
    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);

    let draggedId = null;
    if (event && event.dataTransfer) {
      try { draggedId = event.dataTransfer.getData('text/plain'); } catch (e) {}
    }

    const movingIds = (selectedTaskIds.size > 0 && draggedId && selectedTaskIds.has(String(draggedId)))
      ? Array.from(selectedTaskIds)
      : (draggedId ? [draggedId] : []);

    const targetTask = activeTasks.find(t => String(t.id) === String(taskId)) ||
                       ((currentState.tasks || []).find(t => String(t.id) === String(taskId)));

    const currentSort = typeof state.getCurrentSort === 'function'
      ? state.getCurrentSort()
      : (state.currentSort || 'urgency');

    if (targetTask && movingIds.length > 0) {
      if (currentSort === 'urgency' && targetTask.urgency) {
        movingIds.forEach(id => {
          const tObj = (currentState.tasks || []).find(x => String(x.id) === String(id));
          if (tObj) tObj.urgency = targetTask.urgency;
        });
      } else if (currentSort === 'featured' && targetTask.featured !== undefined) {
        movingIds.forEach(id => {
          const tObj = (currentState.tasks || []).find(x => String(x.id) === String(id));
          if (tObj) tObj.featured = targetTask.featured;
        });
      }
    }

    const actions = getActions();
    if (actions && actions.taskDrop) {
      actions.taskDrop(event, taskId, selectedTaskIds);
    }
    renderTriageView();
  }

  return {
    moveTriageTaskDirection,
    openMobileMoveSheet,
    closeMobileMoveSheet,
    getActiveMoveSheetTaskId,
    touchEngine,
    handleTriageTouchStart,
    handleTriageTouchMove,
    handleTriageTouchEnd,
    handleTriageTouchCancel,
    handleTriageMouseDown,
    wasJustDragged: () => touchEngine.wasJustDragged(),
    triageTaskDragStart,
    triageGroupDragOver,
    triageGroupDrop,
    triageTaskDrop,
  };
}
