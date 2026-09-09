/* actions/dragdrop.js — Drag & drop y reordenación de tareas */

export function TodayTasksDragDrop(ctx){
  const { getState, saveState, renderAll } = ctx;

  let dragArmed = false;
  let draggedTaskId = null;
  let draggedSelectedIds = null;

  function normalizeSelectedIds(selectedIds) {
    if (!selectedIds) return null;
    if (selectedIds instanceof Set) return selectedIds;
    if (Array.isArray(selectedIds)) return new Set(selectedIds.map(String));
    return null;
  }

  function armTaskDrag(){
    dragArmed = true;
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

  function taskDragOver(e){
    if(draggedTaskId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("drag-over");
  }

  function taskDragLeave(e){
    e.currentTarget.classList.remove("drag-over");
  }

  function taskDrop(e, targetId, selectedIds = null){
    if(e && e.preventDefault) e.preventDefault();
    if(e && e.currentTarget && e.currentTarget.classList){
      e.currentTarget.classList.remove("drag-over");
    }
    const activeSelectedIds = selectedIds || draggedSelectedIds;
    if(draggedTaskId !== null){
      if (draggedTaskId !== targetId || (activeSelectedIds && activeSelectedIds.has(String(targetId)) && activeSelectedIds.size > 1)) {
        reorderTaskByDrag(draggedTaskId, targetId, activeSelectedIds);
      }
    }
    draggedTaskId = null;
    draggedSelectedIds = null;
  }

  function taskDragEnd(e){
    if (typeof document !== "undefined") {
      document.querySelectorAll(".task-item.dragging, .task-item.drag-over, .triage-task-row.dragging, .triage-task-row.drag-over")
        .forEach(el => el.classList.remove("dragging","drag-over"));
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

    if(fromIdx === -1 || toIdx === -1) return;

    const selectedSet = normalizeSelectedIds(selectedIds);
    const isGroupDrag = selectedSet && selectedSet.has(String(fromId)) && selectedSet.size > 1;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot('Reordenar tareas');
    }

    if (isGroupDrag) {
      // Filtrar todas las tareas seleccionadas que están en la cola, manteniendo su orden relativo
      const selectedTasks = queue.filter(t => selectedSet.has(String(t.id)));

      let newQueue;
      if (selectedSet.has(String(toId))) {
        // Caso A: Se soltó sobre una tarea perteneciente al mismo grupo.
        // Agrupar todas las tareas seleccionadas alrededor de toId
        const nonSelectedBefore = queue.filter((t, idx) => !selectedSet.has(String(t.id)) && idx < toIdx);
        const nonSelectedAfter = queue.filter((t, idx) => !selectedSet.has(String(t.id)) && idx > toIdx);
        newQueue = [...nonSelectedBefore, ...selectedTasks, ...nonSelectedAfter];
      } else {
        // Caso B: Se soltó sobre una tarea no seleccionada.
        const nonSelected = queue.filter(t => !selectedSet.has(String(t.id)));
        const targetIdxInNonSelected = nonSelected.findIndex(t => String(t.id) === String(toId));
        let insertIdx;
        if (targetIdxInNonSelected === -1) {
          insertIdx = 0;
        } else if (fromIdx < toIdx) {
          // Arrastrado hacia abajo -> colocar después del objetivo
          insertIdx = targetIdxInNonSelected + 1;
        } else {
          // Arrastrado hacia arriba -> colocar en la posición del objetivo (antes de él)
          insertIdx = targetIdxInNonSelected;
        }
        newQueue = [
          ...nonSelected.slice(0, insertIdx),
          ...selectedTasks,
          ...nonSelected.slice(insertIdx)
        ];
      }

      newQueue.forEach((t, i) => {
        t.order = i + 1;
        t.manualOrder = i + 1;
      });
      state.tasks.sort((x, y) => (x.order || 0) - (y.order || 0));
      saveState();
      renderAll();
      return;
    }

    const [moved] = queue.splice(fromIdx, 1);
    queue.splice(toIdx, 0, moved);
    queue.forEach((t, i) => {
      t.order = i + 1;
      t.manualOrder = i + 1;
    });
    state.tasks.sort((x, y) => (x.order || 0) - (y.order || 0));
    saveState();
    renderAll();
  }

  function moveTasksGroupDirectly(selectedIds, direction) {
    const selectedSet = normalizeSelectedIds(selectedIds);
    if (!selectedSet || selectedSet.size === 0) return false;

    const state = getState();
    const queue = (state.tasks || []).filter(t=>t.status==="pending"||t.status==="paused")
                              .sort((a,b)=>(a.order || 0) - (b.order || 0));
    const selectedTasks = queue.filter(t => selectedSet.has(String(t.id)));
    if (selectedTasks.length === 0) return false;

    const nonSelected = queue.filter(t => !selectedSet.has(String(t.id)));

    let newQueue;
    if (direction === 'top') {
      newQueue = [...selectedTasks, ...nonSelected];
    } else if (direction === 'bottom') {
      newQueue = [...nonSelected, ...selectedTasks];
    } else if (direction === 'up') {
      const firstIdxInQueue = queue.findIndex(t => selectedSet.has(String(t.id)));
      if (firstIdxInQueue === 0) return false;
      const countBefore = nonSelected.filter(t => queue.indexOf(t) < firstIdxInQueue).length;
      if (countBefore === 0) return false;
      const insertIdx = countBefore - 1;
      newQueue = [
        ...nonSelected.slice(0, insertIdx),
        ...selectedTasks,
        ...nonSelected.slice(insertIdx)
      ];
    } else if (direction === 'down') {
      const lastIdxInQueue = queue.reduce((max, t, idx) => selectedSet.has(String(t.id)) ? idx : max, -1);
      if (lastIdxInQueue === queue.length - 1) return false;
      const countBefore = nonSelected.filter(t => queue.indexOf(t) < lastIdxInQueue).length;
      if (countBefore >= nonSelected.length) return false;
      const insertIdx = countBefore + 1;
      newQueue = [
        ...nonSelected.slice(0, insertIdx),
        ...selectedTasks,
        ...nonSelected.slice(insertIdx)
      ];
    } else {
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
    if(fromIdx === -1) return false;

    let toIdx = fromIdx;
    if(direction === 'up') toIdx = Math.max(0, fromIdx - 1);
    else if(direction === 'down') toIdx = Math.min(queue.length - 1, fromIdx + 1);
    else if(direction === 'top') toIdx = 0;
    else if(direction === 'bottom') toIdx = queue.length - 1;

    if(toIdx === fromIdx) return false;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot('Reordenar tareas');
    }

    const [moved] = queue.splice(fromIdx, 1);
    queue.splice(toIdx, 0, moved);
    queue.forEach((t, i) => {
      t.order = i + 1;
      t.manualOrder = i + 1;
    });
    state.tasks.sort((x, y) => (x.order || 0) - (y.order || 0));
    saveState();
    renderAll();
    return true;
  }

  return {
    armTaskDrag, taskDragStart, taskDragOver, taskDragLeave, taskDrop, taskDragEnd, moveTaskDirectly, moveTasksGroupDirectly, reorderTaskByDrag
  };
}

export default TodayTasksDragDrop;

