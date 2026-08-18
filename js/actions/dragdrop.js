/* actions/dragdrop.js — Drag & drop y reordenación de tareas */
(function(){
  "use strict";

  window._TodayTasksDragDrop = function(ctx){
    const { getState, saveState, renderAll } = ctx;

    let dragArmed = false;
    let draggedTaskId = null;

    function armTaskDrag(){
      dragArmed = true;
    }

    function taskDragStart(e, id){
      if(!dragArmed){ e.preventDefault(); return; }
      draggedTaskId = id;
      e.dataTransfer.effectAllowed = "move";
      try{ e.dataTransfer.setData("text/plain", String(id)); }catch(err){}
      e.currentTarget.classList.add("dragging");
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

    function taskDrop(e, targetId){
      e.preventDefault();
      e.currentTarget.classList.remove("drag-over");
      if(draggedTaskId !== null && draggedTaskId !== targetId){
        reorderTaskByDrag(draggedTaskId, targetId);
      }
      draggedTaskId = null;
    }

    function taskDragEnd(e){
      dragArmed = false;
      draggedTaskId = null;
      document.querySelectorAll(".task-item.dragging, .task-item.drag-over")
        .forEach(el => el.classList.remove("dragging","drag-over"));
    }

    function reorderTaskByDrag(fromId, toId){
      const state = getState();
      const queue = state.tasks.filter(t=>t.status==="pending"||t.status==="paused")
                                .sort((a,b)=>a.order-b.order);
      const fromIdx = queue.findIndex(t=>t.id===fromId);
      const toIdx = queue.findIndex(t=>t.id===toId);
      if(fromIdx === -1 || toIdx === -1) return;
      const [moved] = queue.splice(fromIdx, 1);
      queue.splice(toIdx, 0, moved);
      queue.forEach((t, i) => { t.order = i + 1; });
      saveState();
      renderAll();
    }

    return {
      armTaskDrag, taskDragStart, taskDragOver, taskDragLeave, taskDrop, taskDragEnd
    };
  };
})();
