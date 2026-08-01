(function(){
  "use strict";

  const STORAGE_KEY = window.TodayTasksConfig.storageKey;
  const { nowMinutes, fmt, fmtDur, fmtRemaining, timeToMinutes } = window.TodayTasksUtils;

  /* ---------------- State ---------------- */
  let state = window.TodayTasksState.loadState(STORAGE_KEY);

  /* Transient (non-persisted) inline-edit state */
  let meetingEdit = null; // {id, title, start, end}
  let taskEdit = null;    // {id, title, duration}
  let notifyState = {taskId:null, lastNotifiedAt:null};

  /* ---------------- Router state ---------------- */
  let currentView = 'main';   // 'main' | 'task'
  let focusTaskId = null;
  let focusRefreshTimer = null;
  const RING_R = 85;
  const RING_C = +(2 * Math.PI * RING_R).toFixed(2); // 534.07

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    pushToCloud();
  }

  function newId(){
    const id = state.nextId || 1;
    state.nextId = id + 1;
    return id;
  }


  function computeSchedule(){
    return window.TodayTasksScheduler.computeSchedule(state, nowMinutes);
  }

  /* ---------------- Actions: meetings ---------------- */
  function addMeeting(title, startStr, endStr){
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
    state.meetings = state.meetings.filter(m=>m.id!==id);
    if(meetingEdit && meetingEdit.id===id) meetingEdit = null;
    saveState();
    renderAll();
  }
  function startEditMeeting(id){
    const m = state.meetings.find(m=>m.id===id);
    if(!m) return;
    meetingEdit = {id, title:m.title, start:fmt(m.start), end:fmt(m.end)};
    renderAll();
  }
  function updateMeetingEditField(field, value){
    if(meetingEdit) meetingEdit[field] = value;
  }
  function cancelEditMeeting(){
    meetingEdit = null;
    renderAll();
  }
  function saveEditMeeting(id){
    if(!meetingEdit || meetingEdit.id !== id) return;
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
    meetingEdit = null;
    saveState();
    renderAll();
  }

  /* ---------------- Actions: tasks ---------------- */
  const DEFAULT_TASK_DURATION = 30;
  function addTask(title, durationStr){
    if(!title){
      alert("Indica un título para la tarea.");
      return;
    }
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
    state.tasks = state.tasks.filter(t=>t.id!==id);
    if(taskEdit && taskEdit.id===id) taskEdit = null;
    saveState();
    renderAll();
  }
  function startEditTask(id){
    const t = state.tasks.find(t=>t.id===id);
    if(!t) return;
    taskEdit = {id, title:t.title, duration:String(t.planned)};
    renderAll();
  }
  function updateTaskEditField(field, value){
    if(taskEdit) taskEdit[field] = value;
  }
  function cancelEditTask(){
    taskEdit = null;
    renderAll();
  }
  function saveEditTask(id){
    if(!taskEdit || taskEdit.id !== id) return;
    const t = state.tasks.find(t=>t.id===id);
    if(!t) return;
    const title = (taskEdit.title||"").trim();
    const planned = parseInt(taskEdit.duration, 10);
    if(!title || !planned || planned <= 0){
      alert("Indica un título y una duración en minutos mayor que 0.");
      return;
    }
    t.title = title; t.planned = planned;
    taskEdit = null;
    saveState();
    renderAll();
  }
  function moveTask(id, dir){
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

  /* ---------------- Drag-and-drop reordering (mouse) ---------------- */
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
  function startTask(id){
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
    notifyState = {taskId: targetTask.id, lastNotifiedAt: nowMinutes()};
    saveState();
    smartRender();
  }

  function pauseTask(id){
    const t = state.tasks.find(t=>t.id===id);
    if(!t || t.status!=="running") return;
    const elapsed = nowMinutes() - t.runningStart;
    t.elapsedBefore = (t.elapsedBefore||0) + Math.max(0, elapsed);
    t.runningStart = null;
    t.status = "paused";
    if(notifyState.taskId === id) notifyState = {taskId:null, lastNotifiedAt:null};
    saveState();
    smartRender();
  }

  function resumeTask(id){
    startTask(id);
  }
  function completeTask(id){
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
    if(notifyState.taskId === id) notifyState = {taskId:null, lastNotifiedAt:null};
    saveState();
    // If completing from focus view, navigate back to main
    if(currentView === 'task' && focusTaskId === id){
      window.location.hash = '#/';
    } else {
      smartRender();
    }
  }

  function uncompleteTask(id){
    const t = state.tasks.find(t=>t.id===id);
    if(!t || t.status !== "completed") return;
    // restore to pending, put it at the end of the queue
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

  function startNewDay(){
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
    meetingEdit = null;
    taskEdit = null;
    saveState();
    renderAll();
    showToast("Día nuevo iniciado. Reuniones y tareas anteriores se han borrado.");
  }

  function renderClock(){
    document.getElementById("clockDisplay").textContent = fmt(nowMinutes());
  }

  function renderHeaderStats(){
    const el = document.getElementById("headerStats");
    if(!el) return;
    const meetingsTotal = state.meetings.reduce((s,m) => s + (m.end - m.start), 0);
    const activeTasks = state.tasks.filter(t => t.status !== "completed");
    const tasksTotal = activeTasks.reduce((s,t) => s + t.planned, 0);
    const completedTotal = state.tasks
      .filter(t => t.status === "completed")
      .reduce((s,t) => s + (t.actualDuration||0), 0);

    el.innerHTML = `
      <span class="stat-chip stat-meeting"><span class="stat-icon">🗓</span>Reuniones <span class="stat-value">${fmtDur(meetingsTotal)}</span></span>
      <span class="stat-chip stat-task"><span class="stat-icon">🗒</span>Tareas por hacer <span class="stat-value">${fmtDur(tasksTotal)}</span></span>
      <span class="stat-chip"><span class="stat-icon">✓</span>Completado hoy <span class="stat-value">${fmtDur(completedTotal)}</span></span>
    `;
  }

  function renderTaskProgressBar(){
    const container = document.getElementById("taskProgressContainer");
    if(!container) return;

    const tasks = state.tasks;
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const running = tasks.filter(t => t.status === "running").length;
    const pending = tasks.filter(t => t.status === "pending" || t.status === "paused").length;

    if(total === 0){
      container.innerHTML = `
        <div class="progress-banner">
          <div class="progress-header">
            <div class="progress-header-left">
              <span class="progress-title">Progreso de tareas</span>
              <div class="progress-legend">
                <span class="legend-item leg-completed"><span class="dot"></span> 0 completadas</span>
                <span class="legend-item leg-running"><span class="dot"></span> 0 en ejecución</span>
                <span class="legend-item leg-pending"><span class="dot"></span> 0 pendientes</span>
              </div>
            </div>
            <span class="progress-total-badge">Total: <strong>0</strong> tareas</span>
          </div>
          <div class="progress-track empty-track">
            <span class="empty-track-text">No hay tareas creadas todavía</span>
          </div>
        </div>
      `;
      return;
    }

    const pctCompleted = (completed / total) * 100;
    const pctRunning = (running / total) * 100;
    const pctPending = (pending / total) * 100;

    const compLabel = completed > 0 ? (pctCompleted >= 12 ? `${completed} completada${completed!==1?'s':''}` : `${completed}`) : '';
    const runLabel = running > 0 ? (pctRunning >= 12 ? `${running} en curso` : `${running}`) : '';
    const pendLabel = pending > 0 ? (pctPending >= 12 ? `${pending} pendiente${pending!==1?'s':''}` : `${pending}`) : '';

    container.innerHTML = `
      <div class="progress-banner">
        <div class="progress-header">
          <div class="progress-header-left">
            <span class="progress-title">Progreso de tareas</span>
            <div class="progress-legend">
              <span class="legend-item leg-completed"><span class="dot"></span> ${completed} completada${completed!==1?'s':''}</span>
              <span class="legend-item leg-running"><span class="dot"></span> ${running} en ejecución</span>
              <span class="legend-item leg-pending"><span class="dot"></span> ${pending} pendiente${pending!==1?'s':''}</span>
            </div>
          </div>
          <span class="progress-total-badge">Total: <strong>${total}</strong> tarea${total!==1?'s':''}</span>
        </div>
        <div class="progress-track">
          <div class="progress-seg seg-completed" style="width: ${pctCompleted}%" title="${completed} completada${completed!==1?'s':''} (${Math.round(pctCompleted)}%)">
            ${compLabel ? `<span class="seg-label">${compLabel}</span>` : ''}
          </div>
          <div class="progress-seg seg-running" style="width: ${pctRunning}%" title="${running} en ejecución (${Math.round(pctRunning)}%)">
            ${runLabel ? `<span class="seg-label">${runLabel}</span>` : ''}
          </div>
          <div class="progress-seg seg-pending" style="width: ${pctPending}%" title="${pending} pendiente${pending!==1?'s':''} (${Math.round(pctPending)}%)">
            ${pendLabel ? `<span class="seg-label">${pendLabel}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderMeetings(){
    const el = document.getElementById("meetingsList");
    if(state.meetings.length === 0){
      el.innerHTML = '<div class="empty">Aún no hay reuniones.</div>';
      return;
    }
    el.innerHTML = state.meetings.map(m => {
      if(meetingEdit && meetingEdit.id === m.id){
        return `
      <div class="item editing">
        <div class="row">
          <input type="text" value="${escapeAttr(meetingEdit.title)}" oninput="app.updateMeetingEditField('title', this.value)" placeholder="Título de la reunión">
        </div>
        <div class="row">
          <input type="time" value="${escapeAttr(meetingEdit.start)}" style="flex:1" oninput="app.updateMeetingEditField('start', this.value)">
          <input type="time" value="${escapeAttr(meetingEdit.end)}" style="flex:1" oninput="app.updateMeetingEditField('end', this.value)">
        </div>
        <div class="task-actions">
          <button class="btn small done" onclick="app.saveEditMeeting(${m.id})">Guardar</button>
          <button class="btn small secondary" onclick="app.cancelEditMeeting()">Cancelar</button>
        </div>
      </div>`;
      }
      return `
      <div class="item">
        <div class="top">
          <div>
            <div class="title">${escapeHtml(m.title)}</div>
            <div class="time-range tr-meeting"><span class="tag">Inicio</span>${fmt(m.start)}<span class="arrow">→</span><span class="tag">Fin</span>${fmt(m.end)}</div>
            <div class="meta">colchón hasta ${fmt(m.end+10)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:2px;">
            <button class="icon-btn" title="Editar" onclick="app.startEditMeeting(${m.id})">✎</button>
            <button class="icon-btn" title="Eliminar" onclick="app.deleteMeeting(${m.id})">✕</button>
          </div>
        </div>
      </div>`;
    }).join("");
  }

  function renderTasks(schedule){
    const el = document.getElementById("tasksList");
    const active = state.tasks.filter(t => t.status !== "completed")
                               .sort((a,b)=>{
                                 if(a.status==="running") return -1;
                                 if(b.status==="running") return 1;
                                 return a.order-b.order;
                               });
    if(active.length === 0){
      el.innerHTML = '<div class="empty">Aún no hay tareas.</div>';
      return;
    }


    el.innerHTML = active.map(t => {
      if(taskEdit && taskEdit.id === t.id){
        return `
        <div class="item task-item editing">
          <div class="row">
            <input type="text" value="${escapeAttr(taskEdit.title)}" oninput="app.updateTaskEditField('title', this.value)" placeholder="Título de la tarea">
          </div>
          <div class="row">
            <input type="number" min="1" value="${escapeAttr(taskEdit.duration)}" style="width:100px" oninput="app.updateTaskEditField('duration', this.value)" placeholder="Minutos">
          </div>
          <div class="task-actions">
            <button class="btn small done" onclick="app.saveEditTask(${t.id})">Guardar</button>
            <button class="btn small secondary" onclick="app.cancelEditTask()">Cancelar</button>
          </div>
        </div>`;
      }
      const segs = schedule.segmentsByTask[t.id] || [];
      const isOverflow = schedule.overflowIds.has(t.id);
      const label = t.status === "running" ? "en ejecución"
                  : t.status === "paused" ? "en pausa"
                  : "pendiente";
      const badgeClass = t.status;

      let startTag, startVal, endTag, endVal, trClass, splitNote = "", remainingChip = "";
      if(t.status === "running"){
        const plannedEnd = t.runningStart + (t.planned - (t.elapsedBefore||0));
        startTag = "Inicio real"; startVal = fmt(t.runningStart);
        endTag = "Fin previsto"; endVal = fmt(plannedEnd);
        trClass = "tr-running";
        const rem = fmtRemaining(plannedEnd, nowMinutes());
        remainingChip = `<span class="remaining-chip${rem.overrun?" overrun":""}">${rem.text}</span>`;
      } else if(segs.length){
        startTag = "Inicio est."; startVal = fmt(segs[0].start);
        endTag = "Fin est."; endVal = fmt(segs[segs.length-1].end);
        trClass = t.status === "paused" ? "tr-paused" : "tr-pending";
        if(segs.length > 1){
          splitNote = '<div class="meta">se divide en: ' + segs.map(s => fmt(s.start)+"–"+fmt(s.end)).join(", ") + " (por reuniones en medio)</div>";
        }
      } else {
        startTag = null;
      }

      const draggableAttrs = t.status !== "running"
        ? `draggable="true" ondragstart="app.taskDragStart(event, ${t.id})" ondragover="app.taskDragOver(event)" ondragleave="app.taskDragLeave(event)" ondrop="app.taskDrop(event, ${t.id})" ondragend="app.taskDragEnd(event)"`
        : "";

      return `
        <div class="item task-item state-${t.status}" ${draggableAttrs}>
          <div class="top">
            <div style="display:flex;gap:8px;">
              ${t.status!=="running" ? `<span class="drag-handle" title="Arrastrar para reordenar" onmousedown="app.armTaskDrag()">⠿</span>` : ""}
              <div>
                <div class="title">${escapeHtml(t.title)}</div>
                <div class="meta">${fmtDur(t.planned)} planificados</div>
                ${startTag ? `<div class="time-range ${trClass}"><span class="tag">${startTag}</span>${startVal}<span class="arrow">→</span><span class="tag">${endTag}</span>${endVal}${remainingChip ? " "+remainingChip : ""}</div>` : '<div class="meta" style="color:var(--danger)">sin hueco antes del fin de jornada</div>'}
                ${splitNote}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="badge ${badgeClass}">${label}</span>
              <button class="icon-btn" title="Editar" onclick="app.startEditTask(${t.id})">✎</button>
              ${t.status!=="running" ? `<button class="icon-btn" title="Eliminar" onclick="app.deleteTask(${t.id})">✕</button>` : ""}
            </div>
          </div>
          ${isOverflow ? '<div class="meta" style="color:var(--danger)">⚠ no cabe antes del fin de jornada</div>' : ""}
          <div class="task-actions">
            ${t.status==="pending" ? `
              <button class="btn small run" onclick="app.startTask(${t.id})">▶ Iniciar</button>
              <div class="order-controls">
                <button class="icon-btn" title="Subir" onclick="app.moveTask(${t.id},-1)">▲</button>
                <button class="icon-btn" title="Bajar" onclick="app.moveTask(${t.id},1)">▼</button>
              </div>
            ` : ""}
            ${t.status==="running" ? `
              <a href="#/task/${t.id}" class="btn small secondary focus-link" title="Abrir vista de foco">◎ Foco</a>
              <button class="btn small pause" onclick="app.pauseTask(${t.id})">⏸ Pausar</button>
              <button class="btn small done" onclick="app.completeTask(${t.id})">✓ Completar</button>
            ` : ""}
            ${t.status==="paused" ? `
              <button class="btn small run" onclick="app.resumeTask(${t.id})">▶ Reanudar</button>
              <button class="btn small done" onclick="app.completeTask(${t.id})">✓ Completar</button>
              <div class="order-controls">
                <button class="icon-btn" title="Subir" onclick="app.moveTask(${t.id},-1)">▲</button>
                <button class="icon-btn" title="Bajar" onclick="app.moveTask(${t.id},1)">▼</button>
              </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  function renderBoard(schedule){
    const el = document.getElementById("boardContent");
    const now = schedule.now;
    const viewStart = schedule.viewStart;
    const workEnd = state.workEnd;

    const titleEl = document.getElementById("boardTitle");
    const badgeEl = document.getElementById("boardNow");
    if(titleEl){
      titleEl.textContent = state.planningMode
        ? "Plan completo · desde el inicio de jornada"
        : "Desde ahora hasta el fin de jornada";
    }
    if(badgeEl){
      badgeEl.textContent = state.planningMode
        ? "inicio " + fmt(state.workStart)
        : "ahora " + fmt(now);
    }

    // build a flat list of visual events: meetings, buffers, task segments
    const events = [];
    for(const m of state.meetings){
      if(m.end + 10 <= viewStart) continue; // fully before the view's start point
      events.push({start:Math.max(m.start, viewStart-1440), end:m.end, kind:"meeting", label:m.title});
      events.push({start:m.end, end:m.end+10, kind:"buffer", label:m.title});
    }
    for(const t of state.tasks){
      if(t.status === "completed") continue;
      const segs = schedule.segmentsByTask[t.id] || [];
      for(const s of segs){
        events.push({start:s.start, end:s.end, kind:"task-"+t.status, label:t.title});
      }
    }
    events.sort((a,b)=>a.start-b.start);
    const visible = events.filter(e => e.end > viewStart && e.start < workEnd);

    if(!state.planningMode && now >= workEnd){
      el.innerHTML = '<div class="board-empty">La jornada laboral ha terminado. Consulta el resumen abajo.</div>';
      return;
    }

    if(visible.length === 0){
      el.innerHTML = '<div class="board-empty">No hay reuniones ni tareas programadas hasta el fin de jornada (' + fmt(workEnd) + ').</div>';
      return;
    }

    let html = '<div class="track">';
    for(const e of visible){
      const start = Math.max(e.start, viewStart);
      const kindClass = e.kind === "meeting" ? "slot-meeting"
                       : e.kind === "buffer" ? "slot-buffer"
                       : "slot-task " + e.kind.replace("task-","");
      const label = e.kind === "meeting" ? "🗓 " + escapeHtml(e.label)
                  : e.kind === "buffer" ? "colchón · " + escapeHtml(e.label)
                  : escapeHtml(e.label) + (e.kind==="task-running" ? " (en curso)" : "");
      html += `
        <div class="slot ${kindClass}">
          <span class="time-label">${fmt(start)}<span class="sep">–</span>${fmt(e.end)}</span>
          <span>${label}</span>
          <span class="dur">${fmtDur(e.end-start)}</span>
        </div>`;
    }
    html += `<div class="slot" style="opacity:.6;border:1px dashed var(--board-line);background:none;">
        <span class="time-label">${fmt(workEnd)}</span>
        <span>fin de jornada</span>
      </div>`;
    html += '</div>';

    if(schedule.overflowIds.size > 0){
      html += `<div class="overflow-note">⚠ ${schedule.overflowIds.size} tarea(s) no caben antes del fin de jornada con el orden actual.</div>`;
    }

    el.innerHTML = html;
  }

  function renderSummary(schedule){
    const meetings = [...state.meetings].sort((a,b)=>a.start-b.start);
    const completed = state.tasks.filter(t=>t.status==="completed").sort((a,b)=>a.completedAt-b.completedAt);
    const pending = state.tasks.filter(t=>t.status!=="completed").sort((a,b)=>a.order-b.order);

    const meetingsEl = document.getElementById("meetingsSummaryList");
    meetingsEl.innerHTML = meetings.length ? meetings.map(m => `
      <div class="summary-row">
        <div class="row-top"><span>${escapeHtml(m.title)}</span></div>
        <div class="time-range tr-meeting"><span class="tag">Inicio</span>${fmt(m.start)}<span class="arrow">→</span><span class="tag">Fin</span>${fmt(m.end)}</div>
      </div>
    `).join("") : '<div class="empty">Ninguna todavía.</div>';

    const completedEl = document.getElementById("completedList");
    completedEl.innerHTML = completed.length ? completed.map(t => {
      const realStart = t.completedAt - t.actualDuration;
      return `
      <div class="summary-row">
        <div class="row-top"><span>${escapeHtml(t.title)}</span><span class="dur">${fmtDur(t.actualDuration)} (plan. ${fmtDur(t.planned)})</span></div>
        <div class="time-range tr-running"><span class="tag">Inicio</span>${fmt(realStart)}<span class="arrow">→</span><span class="tag">Fin</span>${fmt(t.completedAt)}</div>
        <div style="margin-top:6px">
          <button class="btn small secondary" onclick="app.uncompleteTask(${t.id})" title="Deshacer completado y volver a pendiente">↩ Reabrir</button>
        </div>
      </div>
    `; }).join("") : '<div class="empty">Ninguna todavía.</div>';

    const pendingEl = document.getElementById("pendingList");
    pendingEl.innerHTML = pending.length ? pending.map(t => {
      let rangeHtml;
      if(t.status === "running"){
        const plannedEnd = t.runningStart + (t.planned - (t.elapsedBefore||0));
        const rem = fmtRemaining(plannedEnd, nowMinutes());
        const chip = `<span class="remaining-chip${rem.overrun?" overrun":""}">${rem.text}</span>`;
        rangeHtml = `<div class="time-range tr-running"><span class="tag">Inicio real</span>${fmt(t.runningStart)}<span class="arrow">→</span><span class="tag">Fin previsto</span>${fmt(plannedEnd)} ${chip}</div>`;
      } else {
        const segs = (schedule && schedule.segmentsByTask[t.id]) || [];
        if(segs.length){
          const trClass = t.status === "paused" ? "tr-paused" : "tr-pending";
          rangeHtml = `<div class="time-range ${trClass}"><span class="tag">Inicio est.</span>${fmt(segs[0].start)}<span class="arrow">→</span><span class="tag">Fin est.</span>${fmt(segs[segs.length-1].end)}</div>`;
        } else {
          rangeHtml = `<div class="meta" style="color:var(--danger)">sin hueco antes del fin de jornada</div>`;
        }
      }
      return `
      <div class="summary-row">
        <div class="row-top"><span>${escapeHtml(t.title)}</span><span class="dur">${fmtDur(t.planned)} · ${t.status}</span></div>
        ${rangeHtml}
      </div>
    `; }).join("") : '<div class="empty">Todo completado.</div>';
  }

  const { escapeHtml, escapeAttr, showToast } = window.TodayTasksUi;
  const { refreshNotifyBtn, requestNotificationPermission, checkRunningTaskNotification } =
    window.TodayTasksNotifications({ getState: () => state, nowMinutes, fmt, fmtRemaining, showToast });

  /* ---------------- Cloud sync (Firebase) ---------------- */
  const firebaseConfig = window.TodayTasksConfig.firebase;

  let fbAuth = null, fbDb = null, currentUser = null, cloudUnsubscribe = null;
  let applyingRemoteUpdate = false; // guards against feedback loops from our own writes

  function cloudDocRef(uid){
    return fbDb.collection("tableroDia").doc(uid);
  }

  function setSyncStatus(kind, text){
    const el = document.getElementById("syncStatus");
    if(!el) return;
    el.className = "sync-status" + (kind ? " " + kind : "");
    el.textContent = text;
  }

  function pushToCloud(){
    if(!currentUser || !fbDb || applyingRemoteUpdate) return;
    setSyncStatus("saving", "⏳ Guardando en la nube…");
    cloudDocRef(currentUser.uid).set(state)
      .then(()=> setSyncStatus("", "☁ Sincronizado"))
      .catch(err => {
        console.error("Error guardando en Firestore", err);
        setSyncStatus("error", "⚠ Error al sincronizar");
      });
  }

  function attachCloudSync(uid){
    setSyncStatus("saving", "⏳ Conectando con la nube…");
    let firstUsableSnapshotSeen = false;
    let slowConnectionTimer = setTimeout(()=>{
      if(!firstUsableSnapshotSeen){
        setSyncStatus("error", "⚠ Tardando en conectar con la nube… tus cambios se guardan en local mientras tanto.");
      }
    }, 8000);

    if(cloudUnsubscribe) cloudUnsubscribe();
    cloudUnsubscribe = cloudDocRef(uid).onSnapshot({includeMetadataChanges: true}, doc => {
      // Skip snapshots that are only a local guess with nothing behind them yet (not confirmed by
      // the server and no cached copy either) — wait for the next, more informative snapshot instead
      // of treating "no answer yet" as "no data in the cloud".
      if(doc.metadata.fromCache && !doc.exists && !firstUsableSnapshotSeen){
        return;
      }

      if(!firstUsableSnapshotSeen){
        firstUsableSnapshotSeen = true;
        clearTimeout(slowConnectionTimer);

        if(doc.exists){
          const cloudData = doc.data();
          const useCloud = window.confirm(
            "Hay datos guardados en la nube para tu cuenta.\n\n" +
            "Aceptar = cargar los datos de la nube (sustituirán a los de este dispositivo).\n" +
            "Cancelar = mantener los datos de este dispositivo y subirlos, sobrescribiendo la nube."
          );
          if(useCloud){
            applyingRemoteUpdate = true;
            state = Object.assign(defaultState(), cloudData);
            meetingEdit = null; taskEdit = null;
            applyingRemoteUpdate = false;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            syncFormInputsFromState();
            renderAll();
            showToast("Datos cargados desde la nube.");
          } else {
            pushToCloud();
          }
        } else {
          pushToCloud(); // first time for this account: seed the cloud with local data
        }
        setSyncStatus("", "☁ Sincronizado");
        return;
      }

      // Subsequent snapshots: real-time updates coming from another device.
      if(doc.metadata.hasPendingWrites) return; // echo of our own write, ignore
      if(!doc.exists) return;
      applyingRemoteUpdate = true;
      state = Object.assign(defaultState(), doc.data());
      meetingEdit = null; taskEdit = null;
      applyingRemoteUpdate = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      syncFormInputsFromState();
      renderAll();
      setSyncStatus("", "☁ Actualizado desde otro dispositivo");
      showToast("Se han actualizado los datos desde otro dispositivo.");
    }, err => {
      clearTimeout(slowConnectionTimer);
      console.error("Error en la escucha de Firestore", err);
      setSyncStatus("error", "⚠ Se perdió la conexión con la nube");
    });
  }

  function detachCloudSync(){
    if(cloudUnsubscribe){ cloudUnsubscribe(); cloudUnsubscribe = null; }
  }

  function syncFormInputsFromState(){
    // Reflect state values (possibly replaced by cloud data) back into the header inputs.
    const ws = document.getElementById("workStartInput");
    const we = document.getElementById("workEndInput");
    const ni = document.getElementById("notifyIntervalInput");
    if(ws) ws.value = fmt(state.workStart);
    if(we) we.value = fmt(state.workEnd);
    if(ni) ni.value = state.notifyIntervalMin;
    refreshPlanningModeBtn();
  }

  function renderAuthArea(){
    const el = document.getElementById("authArea");
    const modeLabel = document.getElementById("appModeLabel");
    if(!el) return;
    if(currentUser){
      if(modeLabel) modeLabel.textContent = "nube · sincronizado";
      const photo = currentUser.photoURL ? `<img src="${escapeAttr(currentUser.photoURL)}" alt="">` : "";
      el.innerHTML = `
        <span class="auth-user">${photo}${escapeHtml(currentUser.displayName || currentUser.email || "")}</span>
        <span class="sync-status" id="syncStatus">☁ Conectado</span>
        <button class="btn secondary" id="signOutBtn">Cerrar sesión</button>
      `;
      document.getElementById("signOutBtn").addEventListener("click", ()=>{
        detachCloudSync();
        fbAuth.signOut();
      });
    } else {
      if(modeLabel) modeLabel.textContent = "local · persistente";
      el.innerHTML = `<button class="btn secondary" id="signInBtn">☁ Iniciar sesión con Google</button>`;
      document.getElementById("signInBtn").addEventListener("click", signInWithGoogle);
    }
  }

  function isMobileBrowser(){
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  function signInWithGoogle(){
    if(!fbAuth){ showToast("La conexión con Firebase no está disponible."); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    if(isMobileBrowser()){
      // Popups are unreliable on mobile WebKit (iOS Safari/Chrome) due to storage-partitioning
      // between the popup and the opener, so the result never reaches onAuthStateChanged.
      // A full-page redirect avoids that problem.
      fbAuth.signInWithRedirect(provider);
    } else {
      fbAuth.signInWithPopup(provider).catch(err => {
        console.error("Error al iniciar sesión", err);
        showToast("No se pudo iniciar sesión: " + (err.message || err.code || "error desconocido") + ". Si has abierto el archivo con doble clic (file://), el inicio de sesión con Google no funciona ahí — pruébalo sirviendo el archivo por http://localhost o subiéndolo a un hosting.");
      });
    }
  }

  function initFirebase(){
    if(typeof firebase === "undefined"){
      console.error("El SDK de Firebase no se cargó.");
      return;
    }
    try{
      firebase.initializeApp(firebaseConfig);
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
      // Auto-fall back to long-polling if the normal WebChannel gets blocked
      // (common with ad-blockers/privacy extensions flagging Firestore's Listen channel).
      fbDb.settings({ experimentalAutoDetectLongPolling: true });
      fbAuth.onAuthStateChanged(user => {
        currentUser = user;
        renderAuthArea();
        if(user){
          attachCloudSync(user.uid);
        } else {
          detachCloudSync();
        }
      });
      // Completes the redirect-based sign-in flow used on mobile and surfaces any error,
      // since a redirect doesn't have a click-time promise to catch() like the popup flow does.
      fbAuth.getRedirectResult().catch(err => {
        console.error("Error al completar el inicio de sesión por redirect", err);
        showToast("No se pudo iniciar sesión: " + (err.message || err.code || "error desconocido"));
      });
    }catch(err){
      console.error("No se pudo inicializar Firebase", err);
    }
  }

  function renderAll(){
    renderClock();
    renderHeaderStats();
    renderTaskProgressBar();
    const schedule = computeSchedule();
    renderMeetings();
    renderTasks(schedule);
    renderBoard(schedule);
    renderSummary(schedule);
  }

  /* ---------------- Smart render (view-aware) ---------------- */
  function smartRender(){
    if(currentView === 'task'){
      renderTaskFocusView();
    } else {
      renderAll();
    }
  }

  /* ---------------- Task Focus View ---------------- */
  function renderTaskFocusView(){
    const container = document.getElementById('view-task');
    if(!container) return;
    const t = state.tasks.find(t => t.id === focusTaskId);
    if(!t || (t.status !== 'running' && t.status !== 'paused')){
      window.location.hash = '#/';
      return;
    }

    const now = nowMinutes();
    let elapsed = t.elapsedBefore || 0;
    if(t.status === 'running' && t.runningStart !== null){
      elapsed += Math.max(0, now - t.runningStart);
    }
    const remaining = t.planned - elapsed;  // negative = overrun
    const overrun = remaining < 0;
    const pct = Math.min(elapsed / t.planned, 1);
    const dashOffset = +(RING_C * (1 - pct)).toFixed(2);
    const plannedEnd = t.runningStart !== null
      ? t.runningStart + (t.planned - (t.elapsedBefore || 0))
      : null;

    const ringClass = t.status === 'paused' ? 'state-paused' : (overrun ? 'state-overrun' : '');
    const timeDisplay = overrun ? fmtDur(-remaining) : fmtDur(remaining);
    const labelText  = overrun ? '⚠️ excedida' : t.status === 'paused' ? 'en pausa' : 'restantes';

    container.innerHTML = `
      <div class="focus-view">
        <div class="focus-header">
          <a href="#/" class="btn secondary focus-back">← Inicio</a>
          <span class="badge ${t.status}">${t.status === 'running' ? 'en ejecución' : 'en pausa'}</span>
        </div>

        <h2 class="focus-task-name">${escapeHtml(t.title)}</h2>

        <div class="focus-ring-wrap">
          <svg class="focus-ring" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <circle class="ring-track" cx="100" cy="100" r="${RING_R}" stroke-width="16" fill="none"/>
            <circle class="ring-progress ${ringClass}"
                    cx="100" cy="100" r="${RING_R}"
                    stroke-width="16" fill="none"
                    stroke-dasharray="${RING_C}"
                    stroke-dashoffset="${dashOffset}"
                    transform="rotate(-90 100 100)"/>
          </svg>
          <div class="focus-ring-center">
            <div class="ring-main-time${overrun ? ' overrun-text' : ''}">${timeDisplay}</div>
            <div class="ring-label">${labelText}</div>
          </div>
        </div>

        <div class="focus-meta">
          <div class="focus-meta-item">
            <span class="meta-label">Planificado</span>
            <span class="meta-value">${fmtDur(t.planned)}</span>
          </div>
          <div class="focus-meta-item">
            <span class="meta-label">Transcurrido</span>
            <span class="meta-value">${fmtDur(elapsed)}</span>
          </div>
          ${plannedEnd !== null ? `
          <div class="focus-meta-item">
            <span class="meta-label">Fin previsto</span>
            <span class="meta-value">${fmt(plannedEnd)}</span>
          </div>` : ''}
        </div>

        <div class="focus-actions">
          ${t.status === 'running' ? `
            <button class="btn pause" onclick="app.pauseTask(${t.id})">⏸ Pausar</button>
            <button class="btn done" onclick="app.completeTask(${t.id})">✓ Completar</button>
          ` : `
            <button class="btn run" onclick="app.resumeTask(${t.id})">▶ Reanudar</button>
            <button class="btn done" onclick="app.completeTask(${t.id})">✓ Completar</button>
          `}
        </div>

        <span class="focus-updated">Actualizado: ${fmt(now)}</span>
      </div>
    `;
  }

  /* ---------------- SPA Router ---------------- */
  function showView(view, taskId){
    const mainEl = document.getElementById('view-main');
    const taskEl = document.getElementById('view-task');
    if(view === 'task' && taskId){
      focusTaskId = taskId;
      currentView = 'task';
      if(mainEl) mainEl.style.display = 'none';
      if(taskEl) taskEl.style.display = 'flex';
      renderTaskFocusView();
      if(focusRefreshTimer) clearInterval(focusRefreshTimer);
      focusRefreshTimer = setInterval(renderTaskFocusView, 10000);
    } else {
      focusTaskId = null;
      currentView = 'main';
      if(mainEl) mainEl.style.display = '';
      if(taskEl) taskEl.style.display = 'none';
      if(focusRefreshTimer){ clearInterval(focusRefreshTimer); focusRefreshTimer = null; }
      renderAll();
    }
  }

  function router(){
    const hash = window.location.hash || '#/';
    if(hash.startsWith('#/task/')){
      const id = parseInt(hash.replace('#/task/', ''), 10);
      if(!isNaN(id)){
        showView('task', id);
        return;
      }
    }
    showView('main');
  }

  /* ---------------- Wiring ---------------- */
  document.getElementById("workStartInput").value = fmt(state.workStart);
  document.getElementById("workStartInput").addEventListener("change", (e)=>{
    const v = timeToMinutes(e.target.value);
    if(v !== null){
      state.workStart = v;
      saveState();
      renderAll();
    }
  });

  document.getElementById("workEndInput").value = fmt(state.workEnd);
  document.getElementById("workEndInput").addEventListener("change", (e)=>{
    const v = timeToMinutes(e.target.value);
    if(v !== null){
      state.workEnd = v;
      saveState();
      renderAll();
    }
  });

  function refreshPlanningModeBtn(){
    const btn = document.getElementById("planningModeBtn");
    if(!btn) return;
    btn.classList.toggle("active", state.planningMode);
    btn.textContent = state.planningMode ? "🗺 Planificación: ON" : "🗺 Modo planificación";
  }
  document.getElementById("planningModeBtn").addEventListener("click", ()=>{
    state.planningMode = !state.planningMode;
    saveState();
    refreshPlanningModeBtn();
    renderAll();
    showToast(state.planningMode
      ? "Modo planificación activado: las tareas se reparten desde el inicio de jornada (" + fmt(state.workStart) + ")."
      : "Modo planificación desactivado: las tareas vuelven a repartirse desde la hora actual.");
  });
  refreshPlanningModeBtn();

  document.getElementById("newDayBtn").addEventListener("click", startNewDay);
  document.getElementById("notifyBtn").addEventListener("click", requestNotificationPermission);
  refreshNotifyBtn();

  document.getElementById("notifyIntervalInput").value = state.notifyIntervalMin;
  document.getElementById("notifyIntervalInput").addEventListener("change", (e)=>{
    const v = parseInt(e.target.value, 10);
    if(v && v > 0){
      state.notifyIntervalMin = v;
      saveState();
      showToast("Avisos configurados cada " + v + " min mientras haya una tarea en marcha.");
    } else {
      e.target.value = state.notifyIntervalMin; // revert invalid input
    }
  });

  document.getElementById("meetingStart").addEventListener("change", (e)=>{
    const endInput = document.getElementById("meetingEnd");
    if(endInput.value) return; // don't override a value the user already set
    const start = timeToMinutes(e.target.value);
    if(start === null) return;
    endInput.value = fmt(start + 30);
  });

  document.getElementById("addMeetingBtn").addEventListener("click", ()=>{
    const title = document.getElementById("meetingTitle").value.trim();
    const start = document.getElementById("meetingStart").value;
    const end = document.getElementById("meetingEnd").value;
    addMeeting(title, start, end);
    document.getElementById("meetingTitle").value = "";
    document.getElementById("meetingStart").value = "";
    document.getElementById("meetingEnd").value = "";
  });

  document.getElementById("addTaskBtn").addEventListener("click", ()=>{
    const title = document.getElementById("taskTitle").value.trim();
    const dur = document.getElementById("taskDuration").value;
    addTask(title, dur);
    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDuration").value = "";
  });

  document.getElementById("summaryToggle").addEventListener("click", ()=>{
    const body = document.getElementById("summaryBody");
    const chevron = document.getElementById("summaryChevron");
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "block" : "none";
    chevron.textContent = isHidden ? "▴" : "▾";
  });

  // expose actions for inline onclick handlers
  window.app = {
    deleteMeeting, deleteTask, moveTask, startTask, pauseTask, resumeTask, completeTask, uncompleteTask,
    startEditMeeting, updateMeetingEditField, cancelEditMeeting, saveEditMeeting,
    startEditTask, updateTaskEditField, cancelEditTask, saveEditTask,
    armTaskDrag, taskDragStart, taskDragOver, taskDragLeave, taskDrop, taskDragEnd
  };

  window.addEventListener('hashchange', router);

  router();          // render whichever view matches the current URL
  renderAuthArea();
  initFirebase();
  setInterval(()=>{
    if(currentView === 'task') return; // focus view has its own timer
    if(meetingEdit === null && taskEdit === null){
      renderAll();
    } else {
      renderClock();
    }
  }, 15000);
  setInterval(checkRunningTaskNotification, 30000);
})();


