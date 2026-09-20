/* actions/dragdrop.js — Drag & drop y reordenación de tareas */
import { t } from '../i18n.js';
import { fmt } from '../utils.js';

export function TodayTasksDragDrop(ctx, helpers = {}){
  const { getState, saveState, renderAll } = ctx;
  const showToast = helpers.showToast || ctx.showToast || (typeof window !== 'undefined' && window.app && window.app.showToast);

  let dragArmed = false;
  let draggedTaskId = null;
  let draggedSelectedIds = null;
  let pendingForbiddenReason = null;

  function normalizeSelectedIds(selectedIds) {
    if (!selectedIds) return null;
    if (selectedIds instanceof Set) return selectedIds;
    if (Array.isArray(selectedIds)) return new Set(selectedIds.map(String));
    return null;
  }

  function armTaskDrag(){
    dragArmed = true;
  }

  /**
   * Calcula los índices mínimo y máximo permitidos (en la cola sin la tarea o bloque)
   * para cumplir con:
   * 1. Dependencias (no estar antes de sus dependencias en la cola, ni después de tareas que dependen de ella).
   * 2. startAfter (no estar antes de tareas con startAfter menor/igual, ni después de tareas con startAfter mayor).
   * Las tareas sin startAfter no imponen restricciones de hora.
   */
  function getTaskOrderingBounds(movingTasks, remainingQueue) {
    let minAllowedIdx = 0;
    let maxAllowedIdx = remainingQueue.length;
    let minReason = null;
    let maxReason = null;

    const movingIds = new Set(movingTasks.map(t => String(t.id)));

    // Determinar conjunto acumulado de dependencias de las tareas que se mueven
    const allDependsOn = new Set();
    movingTasks.forEach(t => {
      if (Array.isArray(t.dependsOn)) {
        t.dependsOn.forEach(dId => allDependsOn.add(String(dId)));
      }
    });

    // 1. Min index por dependencias: debe ir DESPUÉS de cualquier tarea que esté en allDependsOn
    remainingQueue.forEach((t, idx) => {
      if (allDependsOn.has(String(t.id))) {
        if (idx + 1 > minAllowedIdx) {
          minAllowedIdx = idx + 1;
          minReason = { type: 'dependency', blockerId: t.displayId || t.title || t.id };
        }
      }
    });

    // 2. Max index por dependencias: ninguna tarea que dependa de movingTasks puede quedar ANTES
    remainingQueue.forEach((t, idx) => {
      if (Array.isArray(t.dependsOn)) {
        const dependsOnMoving = t.dependsOn.some(dId => movingIds.has(String(dId)));
        if (dependsOnMoving) {
          if (idx < maxAllowedIdx) {
            maxAllowedIdx = idx;
            maxReason = { type: 'dependency_reverse', dependentId: t.displayId || t.title || t.id };
          }
        }
      }
    });

    // 3. Restricción startAfter:
    // Solo aplica entre tareas que ambas tengan startAfter definido (número no nulo)
    const movingStartAfters = movingTasks
      .map(t => t.startAfter)
      .filter(s => s !== null && s !== undefined && !isNaN(s));

    if (movingStartAfters.length > 0) {
      const minMovingStartAfter = Math.min(...movingStartAfters);
      const maxMovingStartAfter = Math.max(...movingStartAfters);

      // No puede ir antes de tareas restantes que tengan un startAfter MENOR
      remainingQueue.forEach((t, idx) => {
        if (t.startAfter !== null && t.startAfter !== undefined && !isNaN(t.startAfter)) {
          if (t.startAfter < minMovingStartAfter) {
            if (idx + 1 > minAllowedIdx) {
              minAllowedIdx = idx + 1;
              minReason = { type: 'startAfter', time: t.startAfter };
            }
          }
        }
      });

      // No puede ir después de tareas restantes que tengan un startAfter MAYOR
      remainingQueue.forEach((t, idx) => {
        if (t.startAfter !== null && t.startAfter !== undefined && !isNaN(t.startAfter)) {
          if (t.startAfter > maxMovingStartAfter) {
            if (idx < maxAllowedIdx) {
              maxAllowedIdx = idx;
              maxReason = { type: 'startAfter_reverse', time: t.startAfter };
            }
          }
        }
      });
    }

    return { minAllowedIdx, maxAllowedIdx, minReason, maxReason };
  }

  function notifyConstraintFailure(reason) {
    if (!reason || typeof showToast !== 'function') return;
    const translate = ctx.t || t;
    if (reason.type === 'dependency') {
      showToast(translate('tasks.toastAdjustedByDependency', { id: reason.blockerId }));
    } else if (reason.type === 'dependency_reverse') {
      showToast(translate('tasks.toastAdjustedByReverseDependency', { id: reason.dependentId }));
    } else if (reason.type === 'startAfter') {
      showToast(translate('tasks.toastAdjustedByStartTime', { time: fmt(reason.time) }));
    } else if (reason.type === 'startAfter_reverse') {
      showToast(translate('tasks.toastAdjustedByReverseStartTime', { time: fmt(reason.time) }));
    }
  }

  function taskDragStart(e, id, selectedIds = null){
    if(!dragArmed){ e.preventDefault(); return; }
    draggedTaskId = id;
    const selectedSet = normalizeSelectedIds(selectedIds);
    draggedSelectedIds = (selectedSet && selectedSet.has(String(id))) ? selectedSet : null;

    e.dataTransfer.effectAllowed = "move";
    try{ e.dataTransfer.setData("text/plain", String(id)); }catch(err){}
    e.currentTarget.classList.add("dragging");

    if (draggedSelectedIds && typeof document !== 'undefined') {
      draggedSelectedIds.forEach(selId => {
        const row = document.querySelector(`[data-task-id="${selId}"]`);
        if (row && row.classList) {
          row.classList.add("dragging");
        }
      });
    }
  }

  function checkIsDropTargetAllowed(targetId) {
    if (draggedTaskId === null || !targetId) return true;
    const state = getState();
    const queue = (state.tasks || []).filter(t => t.status === "pending" || t.status === "paused")
                                    .sort((a,b) => (a.order || 0) - (b.order || 0));
    const activeSelectedIds = draggedSelectedIds;
    const isGroup = activeSelectedIds && activeSelectedIds.has(String(draggedTaskId)) && activeSelectedIds.size > 1;

    let movingTasks = [];
    if (isGroup) {
      movingTasks = queue.filter(t => activeSelectedIds.has(String(t.id)));
    } else {
      const single = queue.find(t => String(t.id) === String(draggedTaskId));
      if (single) movingTasks = [single];
    }
    if (movingTasks.length === 0) return true;

    const movingIds = new Set(movingTasks.map(t => String(t.id)));
    const remainingQueue = queue.filter(t => !movingIds.has(String(t.id)));

    const fromIdx = queue.findIndex(t => String(t.id) === String(draggedTaskId));
    const toIdx = queue.findIndex(t => String(t.id) === String(targetId));

    let targetIdxInRemaining = remainingQueue.findIndex(t => String(t.id) === String(targetId));
    let desiredInsertIdx;
    if (targetIdxInRemaining === -1) {
      desiredInsertIdx = 0;
    } else if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
      desiredInsertIdx = targetIdxInRemaining + 1;
    } else {
      desiredInsertIdx = targetIdxInRemaining;
    }

    const { minAllowedIdx, maxAllowedIdx } = getTaskOrderingBounds(movingTasks, remainingQueue);
    return (desiredInsertIdx >= minAllowedIdx && desiredInsertIdx <= maxAllowedIdx);
  }

  function taskDragOver(e, optTargetId = null){
    if(draggedTaskId === null) return;
    e.preventDefault();

    let targetId = optTargetId;
    if (!targetId && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.taskId) {
      targetId = e.currentTarget.dataset.taskId;
    }

    const isAllowed = checkIsDropTargetAllowed(targetId);

    // dropEffect = "move" permite que ondrop se dispare en el navegador,
    // garantizando que se ajuste a la primera posición válida y se notifique el motivo
    e.dataTransfer.dropEffect = "move";

    if (e.currentTarget && e.currentTarget.classList) {
      if (!isAllowed) {
        e.currentTarget.classList.add("drag-forbidden");
        e.currentTarget.classList.remove("drag-over");
      } else {
        e.currentTarget.classList.remove("drag-forbidden");
        e.currentTarget.classList.add("drag-over");
      }
    }
  }

  function taskDragLeave(e){
    if (e.currentTarget && e.currentTarget.classList) {
      e.currentTarget.classList.remove("drag-over", "drag-forbidden");
    }
  }

  function taskDrop(e, targetId, selectedIds = null){
    if(e && e.preventDefault) e.preventDefault();
    if(e && e.currentTarget && e.currentTarget.classList){
      e.currentTarget.classList.remove("drag-over", "drag-forbidden");
    }
    const activeSelectedIds = selectedIds || draggedSelectedIds;
    if(draggedTaskId !== null){
      if (draggedTaskId !== targetId || (activeSelectedIds && activeSelectedIds.has(String(targetId)) && activeSelectedIds.size > 1)) {
        reorderTaskByDrag(draggedTaskId, targetId, activeSelectedIds);
      } else if (draggedTaskId === targetId) {
        // Soltado sobre sí misma sin movimiento: si intentó soltar pero no puede moverse
        const state = getState();
        const queue = (state.tasks || []).filter(t=>t.status==="pending"||t.status==="paused")
                                  .sort((a,b)=>(a.order || 0) - (b.order || 0));
        const selfTask = queue.find(t => String(t.id) === String(draggedTaskId));
        if (selfTask) {
          const remaining = queue.filter(t => String(t.id) !== String(draggedTaskId));
          const { minReason, maxReason } = getTaskOrderingBounds([selfTask], remaining);
          if (minReason || maxReason) {
            notifyConstraintFailure(minReason || maxReason);
          }
        }
      }
    }
    draggedTaskId = null;
    draggedSelectedIds = null;
  }

  function taskDragEnd(e){
    if (typeof document !== "undefined") {
      document.querySelectorAll(".task-item.dragging, .task-item.drag-over, .task-item.drag-forbidden, .triage-task-row.dragging, .triage-task-row.drag-over, .triage-task-row.drag-forbidden")
        .forEach(el => el.classList.remove("dragging", "drag-over", "drag-forbidden"));
    }
    dragArmed = false;
    draggedTaskId = null;
    draggedSelectedIds = null;
  }

  function reorderTaskByDrag(fromId, toId, selectedIds = null){
    const state = getState();
    const queue = (state.tasks || []).filter(t=>t.status==="pending"||t.status==="paused")
                              .sort((a,b)=>(a.order || 0) - (b.order || 0));
    const fromIdx = queue.findIndex(t => String(t.id) === String(fromId));
    let toIdx = queue.findIndex(t => String(t.id) === String(toId));

    // Si toId es una tarea en ejecución (status: 'running'), colocar la tarea arrastrada
    // en la primera posición de la cola de pendientes (toIdx = 0)
    if(toIdx === -1) {
      const targetTask = (state.tasks || []).find(t => String(t.id) === String(toId));
      if(targetTask && targetTask.status === 'running') {
        toIdx = 0;
      }
    }

    if(fromIdx === -1 || toIdx === -1) {
      const translate = ctx.t || t;
      if (fromIdx === -1) {
        const fromTask = (state.tasks || []).find(t => String(t.id) === String(fromId));
        if (fromTask && fromTask.status === 'running' && typeof showToast === 'function') {
          showToast(translate('tasks.toastCannotMoveRunning'));
        }
      } else if (toIdx === -1) {
        const targetTask = (state.tasks || []).find(t => String(t.id) === String(toId));
        if (targetTask && targetTask.status === 'completed' && typeof showToast === 'function') {
          showToast(translate('tasks.toastCannotMoveCompleted'));
        }
      }
      return;
    }

    const selectedSet = normalizeSelectedIds(selectedIds);
    const isGroupDrag = selectedSet && selectedSet.has(String(fromId)) && selectedSet.size > 1;

    if (isGroupDrag) {
      // Filtrar todas las tareas seleccionadas que están en la cola, manteniendo su orden relativo
      const selectedTasks = queue.filter(t => selectedSet.has(String(t.id)));
      const nonSelected = queue.filter(t => !selectedSet.has(String(t.id)));

      let targetIdxInNonSelected = nonSelected.findIndex(t => String(t.id) === String(toId));
      let desiredInsertIdx;

      if (selectedSet.has(String(toId))) {
        // Soltado sobre una tarea de la misma selección -> agrupar alrededor de donde estaba toId
        const toIdIdxInQueue = queue.findIndex(t => String(t.id) === String(toId));
        desiredInsertIdx = nonSelected.filter(t => queue.indexOf(t) < toIdIdxInQueue).length;
      } else if (targetIdxInNonSelected === -1) {
        desiredInsertIdx = 0;
      } else if (fromIdx < toIdx) {
        desiredInsertIdx = targetIdxInNonSelected + 1;
      } else {
        desiredInsertIdx = targetIdxInNonSelected;
      }

      // Aplicar restricciones de límites
      const { minAllowedIdx, maxAllowedIdx, minReason, maxReason } = getTaskOrderingBounds(selectedTasks, nonSelected);
      let effectiveInsertIdx = desiredInsertIdx;
      let adjusted = false;
      let reasonUsed = null;

      if (effectiveInsertIdx < minAllowedIdx) {
        effectiveInsertIdx = minAllowedIdx;
        adjusted = true;
        reasonUsed = minReason;
      } else if (effectiveInsertIdx > maxAllowedIdx) {
        effectiveInsertIdx = maxAllowedIdx;
        adjusted = true;
        reasonUsed = maxReason;
      }

      const newQueue = [
        ...nonSelected.slice(0, effectiveInsertIdx),
        ...selectedTasks,
        ...nonSelected.slice(effectiveInsertIdx)
      ];

      const isSameOrder = newQueue.every((t, i) => queue[i] && String(t.id) === String(queue[i].id));
      if (isSameOrder && !adjusted && (minReason || maxReason)) {
        notifyConstraintFailure(minReason || maxReason);
      }

      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot('Reordenar tareas');
      }

      newQueue.forEach((t, i) => {
        t.order = i + 1;
        t.manualOrder = i + 1;
      });
      state.tasks.sort((x, y) => (x.order || 0) - (y.order || 0));
      saveState();
      renderAll();

      if (adjusted) {
        notifyConstraintFailure(reasonUsed);
      }
      return;
    }

    const moved = queue[fromIdx];
    const remaining = queue.filter((_, idx) => idx !== fromIdx);

    let targetIdxInRemaining = remaining.findIndex(t => String(t.id) === String(toId));
    let desiredInsertIdx;
    if (targetIdxInRemaining === -1) {
      desiredInsertIdx = 0;
    } else if (fromIdx < toIdx) {
      desiredInsertIdx = targetIdxInRemaining + 1;
    } else {
      desiredInsertIdx = targetIdxInRemaining;
    }

    const { minAllowedIdx, maxAllowedIdx, minReason, maxReason } = getTaskOrderingBounds([moved], remaining);
    let effectiveInsertIdx = desiredInsertIdx;
    let adjusted = false;
    let reasonUsed = null;

    if (effectiveInsertIdx < minAllowedIdx) {
      effectiveInsertIdx = minAllowedIdx;
      adjusted = true;
      reasonUsed = minReason;
    } else if (effectiveInsertIdx > maxAllowedIdx) {
      effectiveInsertIdx = maxAllowedIdx;
      adjusted = true;
      reasonUsed = maxReason;
    }

    const newQueue = [
      ...remaining.slice(0, effectiveInsertIdx),
      moved,
      ...remaining.slice(effectiveInsertIdx)
    ];

    const isSameOrder = newQueue.every((t, i) => queue[i] && String(t.id) === String(queue[i].id));
    if (isSameOrder && !adjusted && (minReason || maxReason)) {
      notifyConstraintFailure(minReason || maxReason);
    }

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot('Reordenar tareas');
    }

    newQueue.forEach((t, i) => {
      t.order = i + 1;
      t.manualOrder = i + 1;
    });
    state.tasks.sort((x, y) => (x.order || 0) - (y.order || 0));
    saveState();
    renderAll();

    if (adjusted) {
      notifyConstraintFailure(reasonUsed);
    }
  }

  function moveTasksGroupDirectly(selectedIds, direction) {
    const selectedSet = normalizeSelectedIds(selectedIds);
    if (!selectedSet || selectedSet.size === 0) return false;

    const translate = ctx.t || t;
    const state = getState();
    const queue = (state.tasks || []).filter(t=>t.status==="pending"||t.status==="paused")
                              .sort((a,b)=>(a.order || 0) - (b.order || 0));
    const selectedTasks = queue.filter(t => selectedSet.has(String(t.id)));
    if (selectedTasks.length === 0) return false;

    const nonSelected = queue.filter(t => !selectedSet.has(String(t.id)));
    const { minAllowedIdx, maxAllowedIdx, minReason, maxReason } = getTaskOrderingBounds(selectedTasks, nonSelected);

    let insertIdx;
    if (direction === 'top') {
      insertIdx = 0;
    } else if (direction === 'bottom') {
      insertIdx = nonSelected.length;
    } else if (direction === 'up') {
      const firstIdxInQueue = queue.findIndex(t => selectedSet.has(String(t.id)));
      if (firstIdxInQueue === 0) {
        if (typeof showToast === 'function') showToast(translate('tasks.toastAlreadyAtTop'));
        return false;
      }
      const countBefore = nonSelected.filter(t => queue.indexOf(t) < firstIdxInQueue).length;
      if (countBefore === 0) {
        if (typeof showToast === 'function') showToast(translate('tasks.toastAlreadyAtTop'));
        return false;
      }
      insertIdx = countBefore - 1;
    } else if (direction === 'down') {
      const lastIdxInQueue = queue.reduce((max, t, idx) => selectedSet.has(String(t.id)) ? idx : max, -1);
      if (lastIdxInQueue === queue.length - 1) {
        if (typeof showToast === 'function') showToast(translate('tasks.toastAlreadyAtBottom'));
        return false;
      }
      const countBefore = nonSelected.filter(t => queue.indexOf(t) < lastIdxInQueue).length;
      if (countBefore >= nonSelected.length) {
        if (typeof showToast === 'function') showToast(translate('tasks.toastAlreadyAtBottom'));
        return false;
      }
      insertIdx = countBefore + 1;
    } else {
      return false;
    }

    // Clamp con bounds
    const clampedInsertIdx = Math.max(minAllowedIdx, Math.min(maxAllowedIdx, insertIdx));
    if (clampedInsertIdx !== insertIdx && (insertIdx < minAllowedIdx || insertIdx > maxAllowedIdx)) {
      notifyConstraintFailure(insertIdx < minAllowedIdx ? minReason : maxReason);
    }
    insertIdx = clampedInsertIdx;

    const newQueue = [
      ...nonSelected.slice(0, insertIdx),
      ...selectedTasks,
      ...nonSelected.slice(insertIdx)
    ];

    // Comprobar si realmente hubo cambio de orden
    const isSameOrder = newQueue.every((t, i) => queue[i] && String(t.id) === String(queue[i].id));
    if (isSameOrder) {
      if (insertIdx < minAllowedIdx && minReason) {
        notifyConstraintFailure(minReason);
      } else if (insertIdx > maxAllowedIdx && maxReason) {
        notifyConstraintFailure(maxReason);
      } else if (minReason && (direction === 'up' || direction === 'top')) {
        notifyConstraintFailure(minReason);
      } else if (maxReason && (direction === 'down' || direction === 'bottom')) {
        notifyConstraintFailure(maxReason);
      } else if ((direction === 'up' || direction === 'top') && typeof showToast === 'function') {
        showToast(translate('tasks.toastAlreadyAtTop'));
      } else if ((direction === 'down' || direction === 'bottom') && typeof showToast === 'function') {
        showToast(translate('tasks.toastAlreadyAtBottom'));
      }
      return false;
    }

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot('Reordenar tareas');
    }

    newQueue.forEach((t, i) => {
      t.order = i + 1;
      t.manualOrder = i + 1;
    });
    state.tasks.sort((x, y) => (x.order || 0) - (y.order || 0));
    saveState();
    renderAll();
    return true;
  }

  function moveTaskDirectly(taskId, direction, selectedIds = null){
    const selectedSet = normalizeSelectedIds(selectedIds);
    if (selectedSet && selectedSet.has(String(taskId)) && selectedSet.size > 1) {
      return moveTasksGroupDirectly(selectedSet, direction);
    }

    const state = getState();
    const queue = (state.tasks || []).filter(t=>t.status==="pending"||t.status==="paused")
                              .sort((a,b)=>a.order-b.order);
    const fromIdx = queue.findIndex(t => String(t.id) === String(taskId));
    if(fromIdx === -1) {
      const translate = ctx.t || t;
      const allTasks = state.tasks || [];
      const found = allTasks.find(t => String(t.id) === String(taskId));
      if (found && found.status === 'running' && typeof showToast === 'function') {
        showToast(translate('tasks.toastCannotMoveRunning'));
      }
      return false;
    }

    const moved = queue[fromIdx];
    const remaining = queue.filter((_, idx) => idx !== fromIdx);
    const { minAllowedIdx, maxAllowedIdx, minReason, maxReason } = getTaskOrderingBounds([moved], remaining);

    let desiredInsertIdx = fromIdx;
    if(direction === 'up') desiredInsertIdx = Math.max(0, fromIdx - 1);
    else if(direction === 'down') desiredInsertIdx = Math.min(remaining.length, fromIdx + 1);
    else if(direction === 'top') desiredInsertIdx = 0;
    else if(direction === 'bottom') desiredInsertIdx = remaining.length;

    const effectiveInsertIdx = Math.max(minAllowedIdx, Math.min(maxAllowedIdx, desiredInsertIdx));
    if(effectiveInsertIdx === fromIdx) {
      const translate = ctx.t || t;
      if (desiredInsertIdx < minAllowedIdx && minReason) {
        notifyConstraintFailure(minReason);
      } else if (desiredInsertIdx > maxAllowedIdx && maxReason) {
        notifyConstraintFailure(maxReason);
      } else if (minReason && (direction === 'up' || direction === 'top')) {
        notifyConstraintFailure(minReason);
      } else if (maxReason && (direction === 'down' || direction === 'bottom')) {
        notifyConstraintFailure(maxReason);
      } else if ((direction === 'up' || direction === 'top') && fromIdx === 0 && typeof showToast === 'function') {
        showToast(translate('tasks.toastAlreadyAtTop'));
      } else if ((direction === 'down' || direction === 'bottom') && fromIdx === remaining.length && typeof showToast === 'function') {
        showToast(translate('tasks.toastAlreadyAtBottom'));
      }
      return false;
    }

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot('Reordenar tareas');
    }

    const newQueue = [
      ...remaining.slice(0, effectiveInsertIdx),
      moved,
      ...remaining.slice(effectiveInsertIdx)
    ];

    newQueue.forEach((t, i) => {
      t.order = i + 1;
      t.manualOrder = i + 1;
    });
    state.tasks.sort((x, y) => (x.order || 0) - (y.order || 0));
    saveState();
    renderAll();
    return true;
  }

  return {
    armTaskDrag, taskDragStart, taskDragOver, taskDragLeave, taskDrop, taskDragEnd, moveTaskDirectly, moveTasksGroupDirectly, reorderTaskByDrag, checkIsDropTargetAllowed
  };
}

export default TodayTasksDragDrop;

