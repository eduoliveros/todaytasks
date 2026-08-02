(function(){
  "use strict";

  const { nowMinutes, fmt, fmtDur, fmtRemaining, timeToMinutes } = window.TodayTasksUtils;
  const { showToast } = window.TodayTasksUi;

  window.TodayTasksActions = function(ctx){
    const {
      getState, setState, getMeetingEdit, setMeetingEdit, getTaskEdit, setTaskEdit,
      setNotifyState, saveState, newId, renderAll, smartRender
    } = ctx;

    const DEFAULT_TASK_DURATION = 30;

    /* ---------------- Actions: meetings ---------------- */
    function addMeeting(title, startStr, endStr){
      const state = getState();
      const start = timeToMinutes(startStr);
      const end = timeToMinutes(endStr);
      if(!title || start === null || end === null || end <= start){
        alert("Revisa el título y que la hora de fin sea posterior a la de inicio.");
        return;
      }
      state.meetings.push({id:newId(), title, start, end});
      state.meetings.sort((a,b)=>a.start-b.start);
      saveState();
      renderAll();
    }

    function deleteMeeting(id){
      const state = getState();
      state.meetings = state.meetings.filter(m=>m.id!==id);
      if(getMeetingEdit() && getMeetingEdit().id===id) setMeetingEdit(null);
      saveState();
      renderAll();
    }

    function startEditMeeting(id){
      const state = getState();
      const m = state.meetings.find(m=>m.id===id);
      if(!m) return;
      setMeetingEdit({id, title:m.title, start:fmt(m.start), end:fmt(m.end)});
      renderAll();
    }

    function updateMeetingEditField(field, value){
      const meetingEdit = getMeetingEdit();
      if(meetingEdit) meetingEdit[field] = value;
    }

    function cancelEditMeeting(){
      setMeetingEdit(null);
      renderAll();
    }

    function saveEditMeeting(id){
      const meetingEdit = getMeetingEdit();
      if(!meetingEdit || meetingEdit.id !== id) return;
      const state = getState();
      const m = state.meetings.find(m=>m.id===id);
      if(!m) return;
      const title = (meetingEdit.title||"").trim();
      const start = timeToMinutes(meetingEdit.start);
      const end = timeToMinutes(meetingEdit.end);
      if(!title || start === null || end === null || end <= start){
        alert("Revisa el título y que la hora de fin sea posterior a la de inicio.");
        return;
      }
      m.title = title; m.start = start; m.end = end;
      state.meetings.sort((a,b)=>a.start-b.start);
      setMeetingEdit(null);
      saveState();
      renderAll();
    }

    /* ---------------- Actions: tasks ---------------- */
    function addTask(title, durationStr){
      if(!title){
        alert("Indica un título para la tarea.");
        return;
      }
      const state = getState();
      let planned = parseInt(durationStr, 10);
      if(!planned || planned <= 0){
        planned = DEFAULT_TASK_DURATION;
        showToast(`No indicaste duración: "${title}" se ha añadido con ${DEFAULT_TASK_DURATION} minutos por defecto.`);
      }
      const maxOrder = state.tasks.reduce((m,t)=>Math.max(m,t.order), 0);
      state.tasks.push({
        id:newId(), title, planned, order:maxOrder+1,
        status:"pending", runningStart:null, elapsedBefore:0,
        completedAt:null, actualDuration:null
      });
      saveState();
      renderAll();
    }

    function deleteTask(id){
      const state = getState();
      state.tasks = state.tasks.filter(t=>t.id!==id);
      if(getTaskEdit() && getTaskEdit().id===id) setTaskEdit(null);
      saveState();
      renderAll();
    }

    function startEditTask(id){
      const state = getState();
      const t = state.tasks.find(t=>t.id===id);
      if(!t) return;
      setTaskEdit({id, title:t.title, duration:String(t.planned)});
      renderAll();
    }

    function updateTaskEditField(field, value){
      const taskEdit = getTaskEdit();
      if(taskEdit) taskEdit[field] = value;
    }

    function cancelEditTask(){
      setTaskEdit(null);
      renderAll();
    }

    function saveEditTask(id){
      const taskEdit = getTaskEdit();
      if(!taskEdit || taskEdit.id !== id) return;
      const state = getState();
      const t = state.tasks.find(t=>t.id===id);
      if(!t) return;
      const title = (taskEdit.title||"").trim();
      const planned = parseInt(taskEdit.duration, 10);
      if(!title || !planned || planned <= 0){
        alert("Indica un título y una duración en minutos mayor que 0.");
        return;
      }
      t.title = title; t.planned = planned;
      setTaskEdit(null);
      saveState();
      renderAll();
    }

    function moveTask(id, dir){
      const state = getState();
      const list = state.tasks.filter(t=>t.status==="pending"||t.status==="paused")
                               .sort((a,b)=>a.order-b.order);
      const idx = list.findIndex(t=>t.id===id);
      const swapIdx = idx + dir;
      if(idx<0 || swapIdx<0 || swapIdx>=list.length) return;
      const a = list[idx], b = list[swapIdx];
      const tmp = a.order; a.order = b.order; b.order = tmp;
      saveState();
      renderAll();
    }

    /* ---------------- Drag-and-drop ---------------- */
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

    /* ---------------- Task execution controls ---------------- */
    function startTask(id){
      const state = getState();
      const targetTask = state.tasks.find(t=>t.id===id);
      if(!targetTask || targetTask.status==="completed") return;

      const runningTask = state.tasks.find(t=>t.status==="running");

      if(runningTask && runningTask.id !== id){
        const elapsed = nowMinutes() - runningTask.runningStart;
        runningTask.elapsedBefore = (runningTask.elapsedBefore||0) + Math.max(0, elapsed);
        runningTask.runningStart = null;
        runningTask.status = "paused";
      }

      const activeQueue = state.tasks
        .filter(t => t.status !== "completed")
        .sort((a,b) => a.order - b.order);

      const otherTasks = activeQueue.filter(t => t.id !== targetTask.id && (!runningTask || t.id !== runningTask.id));

      const newOrder = [targetTask];
      if(runningTask && runningTask.id !== targetTask.id){
        newOrder.push(runningTask);
      }
      newOrder.push(...otherTasks);

      newOrder.forEach((t, idx) => {
        t.order = idx + 1;
      });

      targetTask.status = "running";
      targetTask.runningStart = nowMinutes();
      setNotifyState({taskId: targetTask.id, lastNotifiedAt: nowMinutes()});
      saveState();
      smartRender();
    }

    function pauseTask(id){
      const state = getState();
      const t = state.tasks.find(t=>t.id===id);
      if(!t || t.status!=="running") return;
      const elapsed = nowMinutes() - t.runningStart;
      t.elapsedBefore = (t.elapsedBefore||0) + Math.max(0, elapsed);
      t.runningStart = null;
      t.status = "paused";
      if(ctx.getNotifyState().taskId === id) setNotifyState({taskId:null, lastNotifiedAt:null});
      saveState();
      smartRender();
    }

    function resumeTask(id){
      startTask(id);
    }

    function completeTask(id){
      const state = getState();
      const t = state.tasks.find(t=>t.id===id);
      if(!t) return;
      let actual = t.elapsedBefore || 0;
      if(t.status === "running" && t.runningStart !== null){
        actual += Math.max(0, nowMinutes() - t.runningStart);
      }
      t.status = "completed";
      t.completedAt = nowMinutes();
      t.actualDuration = actual;
      t.runningStart = null;
      if(ctx.getNotifyState().taskId === id) setNotifyState({taskId:null, lastNotifiedAt:null});
      saveState();
      if(ctx.getCurrentView() === 'task' && ctx.getFocusTaskId() === id){
        window.location.hash = '#/';
      } else {
        smartRender();
      }
    }

    function uncompleteTask(id){
      const state = getState();
      const t = state.tasks.find(t=>t.id===id);
      if(!t || t.status !== "completed") return;
      const maxOrder = state.tasks.filter(t2=>t2.status!=="completed").reduce((m,t2)=>Math.max(m,t2.order),0);
      t.status = "pending";
      t.completedAt = null;
      t.actualDuration = null;
      t.elapsedBefore = 0;
      t.runningStart = null;
      t.order = maxOrder + 1;
      saveState();
      renderAll();
      showToast(`"${t.title}" se ha devuelto a pendientes.`);
    }

    /* ---------------- Interruptions ---------------- */
    function startInterruption(){
      const state = getState();
      const running = state.tasks.find(t => t.status === "running");
      if(running){
        pauseTask(running.id);
      }
      state.activeInterruption = {
        id: newId(),
        title: "",
        start: nowMinutes(),
        startEpoch: Date.now()
      };
      saveState();

      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";

      if(window.location.hash !== '#/interruption'){
        window.location.hash = '#/interruption';
      } else {
        smartRender();
      }
    }

    function updateInterruptionTitle(val){
      const state = getState();
      if(state.activeInterruption){
        state.activeInterruption.title = val;
        saveState();
      }
    }

    function completeInterruption(){
      const state = getState();
      if(!state.activeInterruption) return;
      const now = nowMinutes();
      const start = state.activeInterruption.start;
      const duration = Math.max(0, now - start);
      const title = (state.activeInterruption.title || "").trim() || "Interrupción";

      if(!Array.isArray(state.interruptions)){
        state.interruptions = [];
      }
      state.interruptions.push({
        id: state.activeInterruption.id,
        title,
        start,
        end: now,
        duration
      });

      state.activeInterruption = null;
      saveState();

      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";

      showToast(`Interrupción "${title}" finalizada (${fmtDur(duration)}).`);
      window.location.hash = '#/';
    }

    function cancelInterruption(){
      const state = getState();
      if(!state.activeInterruption && ctx.getCurrentView() !== 'interruption') return;
      state.activeInterruption = null;
      saveState();

      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";

      showToast("Interrupción cancelada.");
      window.location.hash = '#/';
    }

    function startNewDay(){
      const state = getState();
      const completedCount = state.tasks.filter(t=>t.status==="completed").length;
      const pendingCount = state.tasks.filter(t=>t.status!=="completed").length;
      const meetingsCount = state.meetings.length;
      const anyRunning = state.tasks.some(t=>t.status==="running");

      if(meetingsCount === 0 && state.tasks.length === 0){
        showToast("Ya está todo vacío, listo para empezar.");
        return;
      }

      let msg = "Vas a empezar un día nuevo. Se borrarán:\n";
      msg += "· " + meetingsCount + " reunión(es)\n";
      msg += "· " + completedCount + " tarea(s) completada(s)\n";
      msg += "· " + pendingCount + " tarea(s) pendiente(s) o en pausa" + (anyRunning ? " (incluida una en ejecución)" : "") + "\n";
      msg += "\nEsta acción no se puede deshacer. ¿Continuar?";

      if(!window.confirm(msg)) return;

      state.meetings = [];
      state.tasks = [];
      state.interruptions = [];
      state.activeInterruption = null;
      setMeetingEdit(null);
      setTaskEdit(null);
      saveState();
      renderAll();
      showToast("Día nuevo iniciado. Reuniones y tareas anteriores se han borrado.");
    }

    return {
      addMeeting, deleteMeeting, startEditMeeting, updateMeetingEditField, cancelEditMeeting, saveEditMeeting,
      addTask, deleteTask, startEditTask, updateTaskEditField, cancelEditTask, saveEditTask, moveTask,
      armTaskDrag, taskDragStart, taskDragOver, taskDragLeave, taskDrop, taskDragEnd,
      startTask, pauseTask, resumeTask, completeTask, uncompleteTask,
      startInterruption, updateInterruptionTitle, completeInterruption, cancelInterruption,
      startNewDay
    };
  };
})();
