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
    // IDs de reuniones puntuales son Number; los recurrentes son "rec_N" (string).
    // El HTML los pasa siempre como string desde onclick='...'. Esto normaliza al tipo correcto.
    function normalizeMeetingId(id) {
      if (typeof id === 'string' && !id.startsWith('rec_')) {
        const n = parseInt(id, 10);
        return isNaN(n) ? id : n;
      }
      return id;
    }

    function showRecurringModal(title, desc, onInstance, onSeries) {
      const modal = document.getElementById("recurringModal");
      if (!modal) {
        if (window.confirm(`${title}\n\n${desc}\n\nPresiona ACEPTAR para solo esta ocurrencia, o CANCELAR para toda la serie.`)) {
          if (onInstance) onInstance();
        } else {
          if (onSeries) onSeries();
        }
        return;
      }
      document.getElementById("recurringModalTitle").textContent = title;
      document.getElementById("recurringModalDesc").textContent = desc;

      const btnInst = document.getElementById("recModalBtnInstance");
      const btnSeries = document.getElementById("recModalBtnSeries");
      const btnCancel = document.getElementById("recModalBtnCancel");

      modal.style.display = "flex";

      function cleanup() {
        modal.style.display = "none";
        btnInst.onclick = null;
        btnSeries.onclick = null;
        btnCancel.onclick = null;
      }

      btnInst.onclick = () => {
        cleanup();
        if (onInstance) onInstance();
      };
      btnSeries.onclick = () => {
        cleanup();
        if (onSeries) onSeries();
      };
      btnCancel.onclick = () => {
        cleanup();
      };
    }

    function addMeeting(title, startStr, endStr, recurringData){
      const state = getState();
      const start = timeToMinutes(startStr);
      const end = timeToMinutes(endStr);
      if(!title || start === null || end === null || end <= start){
        alert("Revisa el título y que la hora de fin sea posterior a la de inicio.");
        return;
      }

      if (recurringData && recurringData.isRecurring) {
        if (!Array.isArray(state.recurringMeetings)) {
          state.recurringMeetings = [];
        }
        state.recurringMeetings.push({
          id: "rec_" + newId(),
          title,
          start,
          end,
          freq: recurringData.freq || "weekly",
          interval: recurringData.interval || 1,
          daysOfWeek: recurringData.daysOfWeek || [1],
          startDate: state.selectedDate || window.TodayTasksUtils.getTodayStr(),
          endDate: recurringData.endDate || null,
          exceptions: {}
        });
        showToast(`Reunión recurrente "${title}" añadida 🔁`);
      } else {
        const envKey = state.activeEnv || "work";
        const env = state.environments[envKey] || state.environments.work;
        const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
        if (!env.days[dateStr]) {
          env.days[dateStr] = { workStart: 9*60, workEnd: 18*60, meetings: [], tasks: [], interruptions: [], planningMode: false };
        }
        if (!Array.isArray(env.days[dateStr].meetings)) env.days[dateStr].meetings = [];
        env.days[dateStr].meetings.push({id:newId(), title, start, end});
        env.days[dateStr].meetings.sort((a,b)=>a.start-b.start);
      }

      saveState();
      renderAll();
    }

    function deleteMeetingInstance(ruleId, dateStr) {
      const state = getState();
      const rule = (state.recurringMeetings || []).find(r => r.id === ruleId);
      if (rule) {
        if (!rule.exceptions) rule.exceptions = {};
        rule.exceptions[dateStr] = { type: "cancelled" };
        if (getMeetingEdit() && getMeetingEdit().id === ruleId) setMeetingEdit(null);
        saveState();
        renderAll();
        showToast(`Ocurrencia del ${dateStr} eliminada ✕`);
      }
    }

    function deleteMeetingSeries(ruleId) {
      const state = getState();
      if (Array.isArray(state.recurringMeetings)) {
        state.recurringMeetings = state.recurringMeetings.filter(r => r.id !== ruleId);
      }
      if (getMeetingEdit() && getMeetingEdit().id === ruleId) setMeetingEdit(null);
      saveState();
      renderAll();
      showToast(`Serie recurrente eliminada ✕`);
    }

    function deleteMeeting(id){
      id = normalizeMeetingId(id);
      const state = getState();
      const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
      const target = state.meetings.find(m => m.id === id);

      if (target && target.isRecurring) {
        const ruleId = target.ruleId || id;
        showRecurringModal(
          `Eliminar "${target.title}" 🔁`,
          `¿Deseas eliminar solo la reunión del día ${dateStr} o eliminar toda la serie recurrente?`,
          () => deleteMeetingInstance(ruleId, dateStr),
          () => deleteMeetingSeries(ruleId)
        );
        return;
      }

      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      const dayObj = env.days && env.days[dateStr];
      if (dayObj && Array.isArray(dayObj.meetings)) {
        dayObj.meetings = dayObj.meetings.filter(m => m.id !== id);
      }
      if (getMeetingEdit() && getMeetingEdit().id === id) setMeetingEdit(null);
      saveState();
      renderAll();
    }

    function startEditMeeting(id){
      id = normalizeMeetingId(id);
      const state = getState();
      const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
      const m = state.meetings.find(m=>m.id===id);
      if(!m) return;

      if (m.isRecurring) {
        const ruleId = m.ruleId || id;
        showRecurringModal(
          `Editar "${m.title}" 🔁`,
          `¿Deseas editar solo la reunión del día ${dateStr} o editar las propiedades de toda la serie recurrente?`,
          () => {
            setMeetingEdit({
              id: m.id,
              ruleId,
              mode: "instance",
              dateStr,
              title: m.title,
              start: fmt(m.start),
              end: fmt(m.end)
            });
            renderAll();
          },
          () => {
            const rule = m.rule || (state.recurringMeetings || []).find(r => r.id === ruleId);
            setMeetingEdit({
              id: m.id,
              ruleId,
              mode: "series",
              dateStr,
              title: rule ? rule.title : m.title,
              start: rule ? fmt(rule.start) : fmt(m.start),
              end: rule ? fmt(rule.end) : fmt(m.end)
            });
            renderAll();
          }
        );
        return;
      }

      setMeetingEdit({id, mode: "single", title:m.title, start:fmt(m.start), end:fmt(m.end)});
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
      id = normalizeMeetingId(id);
      const meetingEdit = getMeetingEdit();
      if(!meetingEdit || meetingEdit.id !== id) return;
      const state = getState();
      const title = (meetingEdit.title||"").trim();
      const start = timeToMinutes(meetingEdit.start);
      const end = timeToMinutes(meetingEdit.end);
      if(!title || start === null || end === null || end <= start){
        alert("Revisa el título y que la hora de fin sea posterior a la de inicio.");
        return;
      }

      if (meetingEdit.mode === "instance") {
        const rule = (state.recurringMeetings || []).find(r => r.id === meetingEdit.ruleId);
        if (rule) {
          if (!rule.exceptions) rule.exceptions = {};
          rule.exceptions[meetingEdit.dateStr] = { type: "modified", title, start, end };
        }
      } else if (meetingEdit.mode === "series") {
        const rule = (state.recurringMeetings || []).find(r => r.id === meetingEdit.ruleId);
        if (rule) {
          rule.title = title;
          rule.start = start;
          rule.end = end;
        }
      } else {
        const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
        const envKey = state.activeEnv || "work";
        const env = state.environments[envKey] || state.environments.work;
        const dayObj = env.days && env.days[dateStr];
        if (dayObj && Array.isArray(dayObj.meetings)) {
          const m = dayObj.meetings.find(m => m.id === id);
          if (m) {
            m.title = title;
            m.start = start;
            m.end = end;
            dayObj.meetings.sort((a,b)=>a.start-b.start);
          }
        }
      }

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
      const plannedEnd = targetTask.runningStart + (targetTask.planned - (targetTask.elapsedBefore||0));
      setNotifyState({taskId: targetTask.id, lastNotifiedAt: nowMinutes(), timeEndNotified: nowMinutes() >= plannedEnd});
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
      if(ctx.getNotifyState().taskId === id) setNotifyState({taskId:null, lastNotifiedAt:null, timeEndNotified:false});
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
      t.elapsedBefore = actual;
      t.runningStart = null;
      if(ctx.getNotifyState().taskId === id) setNotifyState({taskId:null, lastNotifiedAt:null, timeEndNotified:false});
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
      const savedElapsed = t.actualDuration ?? t.elapsedBefore ?? 0;
      t.status = savedElapsed > 0 ? "paused" : "pending";
      t.completedAt = null;
      t.elapsedBefore = savedElapsed;
      t.actualDuration = null;
      t.runningStart = null;
      t.order = maxOrder + 1;
      saveState();
      renderAll();
      showToast(`"${t.title}" se ha devuelto a ${t.status === "paused" ? "en pausa" : "pendientes"}.`);
    }

    /* ---------------- Interruptions ---------------- */
    let interruptionTitleTimer = null;

    function startInterruption(){
      if(interruptionTitleTimer){
        clearTimeout(interruptionTitleTimer);
        interruptionTitleTimer = null;
      }
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
        if(interruptionTitleTimer){
          clearTimeout(interruptionTitleTimer);
        }
        interruptionTitleTimer = setTimeout(() => {
          saveState();
          interruptionTitleTimer = null;
        }, 2000);
      }
    }

    function completeInterruption(){
      if(interruptionTitleTimer){
        clearTimeout(interruptionTitleTimer);
        interruptionTitleTimer = null;
      }
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
      if(interruptionTitleTimer){
        clearTimeout(interruptionTitleTimer);
        interruptionTitleTimer = null;
      }
      const state = getState();
      if(!state.activeInterruption && ctx.getCurrentView() !== 'interruption') return;
      state.activeInterruption = null;
      saveState();

      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";

      showToast("Interrupción cancelada.");
      window.location.hash = '#/';
    }

    function switchEnvironment(envName){
      const state = getState();
      if(!state.environments || !state.environments[envName]) return;
      if(state.activeEnv === envName) return;

      const currentView = ctx.getCurrentView ? ctx.getCurrentView() : 'main';
      const wasInterruption = state.activeInterruption || currentView === 'interruption';
      const wasFocus = currentView === 'task';

      // 1. Si hay una interrupción activa, finalizarla en el ambiente actual antes de cambiar
      if(state.activeInterruption){
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
        const container = document.getElementById('view-interruption');
        if(container) container.innerHTML = "";
        showToast(`Interrupción "${title}" finalizada (${fmtDur(duration)}).`);
      }

      // 2. Cambiar ambiente activo
      state.activeEnv = envName;
      saveState();

      if(ctx.syncFormInputsFromState) ctx.syncFormInputsFromState();

      // 3. Si estábamos en vista focus o interrupción, ir a la vista general (#/)
      if(wasFocus || wasInterruption || (window.location.hash !== '' && window.location.hash !== '#/')){
        window.location.hash = '#/';
        renderAll();
      } else {
        renderAll();
      }

      showToast(`Ambiente cambiado a ${envName === 'work' ? '💼 Trabajo' : '🏠 Personal'}`);
    }

    function selectDate(dateStr){
      if(!dateStr) return;
      const state = getState();
      if(state.selectedDate === dateStr) return;
      state.selectedDate = dateStr;
      if(window.TodayTasksHistory && window.TodayTasksHistory.snapshotAndPrune){
        window.TodayTasksHistory.snapshotAndPrune(state);
      }
      saveState();
      if(ctx.syncFormInputsFromState) ctx.syncFormInputsFromState();
      smartRender();
      showToast(`Viendo planificación del ${window.TodayTasksUtils.formatDateFriendly(dateStr)} (${dateStr})`);
    }

    function resetToToday(){
      const state = getState();
      const today = window.TodayTasksUtils.getTodayStr();
      state.selectedDate = today;
      if(window.TodayTasksHistory && window.TodayTasksHistory.snapshotAndPrune){
        window.TodayTasksHistory.snapshotAndPrune(state);
      }
      saveState();
      if(ctx.syncFormInputsFromState) ctx.syncFormInputsFromState();
      smartRender();
      showToast("Cargado el día actual (Hoy).");
    }

    function saveHistoryMetric(dateStr, metrics){
      const state = getState();
      if(window.TodayTasksHistory && window.TodayTasksHistory.saveHistoryMetric){
        window.TodayTasksHistory.saveHistoryMetric(state, dateStr, metrics);
      }
      saveState();
      smartRender();
      showToast(`Mediciones guardadas para el día ${dateStr}.`);
    }

    function deleteHistoryMetric(dateStr){
      if(!window.confirm(`¿Eliminar la medición guardada del día ${dateStr}?`)) return;
      const state = getState();
      if(window.TodayTasksHistory && window.TodayTasksHistory.deleteHistoryMetric){
        window.TodayTasksHistory.deleteHistoryMetric(state, dateStr);
      }
      saveState();
      smartRender();
      showToast(`Medición del día ${dateStr} eliminada.`);
    }

    function startNewDay(){
      const state = getState();
      const envName = state.activeEnv === 'work' ? "Trabajo" : "Personal";
      const completedCount = state.tasks.filter(t=>t.status==="completed").length;
      const pendingCount = state.tasks.filter(t=>t.status!=="completed").length;
      const meetingsCount = state.meetings.length;
      const anyRunning = state.tasks.some(t=>t.status==="running");

      if(meetingsCount === 0 && state.tasks.length === 0){
        showToast(`El ambiente ${envName} ya está vacío, listo para empezar.`);
        return;
      }

      let msg = `Vas a empezar un día nuevo en el ambiente "${envName}". Se borrarán:\n`;
      msg += "· " + meetingsCount + " reunión(es)\n";
      msg += "· " + completedCount + " tarea(s) completada(s)\n";
      msg += "· " + pendingCount + " tarea(s) pendiente(s) o en pausa" + (anyRunning ? " (incluida una en ejecución)" : "") + "\n";
      msg += "\nEsta acción no afectará al otro ambiente. ¿Continuar?";

      if(!window.confirm(msg)) return;

      if(window.TodayTasksHistory && window.TodayTasksHistory.snapshotAndPrune){
        window.TodayTasksHistory.snapshotAndPrune(state);
      }

      state.meetings = [];
      state.tasks = [];
      state.interruptions = [];
      state.activeInterruption = null;
      setMeetingEdit(null);
      setTaskEdit(null);
      saveState();
      renderAll();
      showToast(`Día nuevo iniciado en "${envName}". Reuniones y tareas anteriores se han borrado.`);
    }

    function copyTaskToDate(taskId, targetDateStr) {
      if (!targetDateStr) return;
      const state = getState();
      const currentDateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();

      let originalTask = (state.tasks || []).find(t => t.id === taskId);
      if (!originalTask) {
        const envKey = state.activeEnv || "work";
        const env = state.environments[envKey] || state.environments.work;
        if (env && env.days && env.days[currentDateStr]) {
          originalTask = (env.days[currentDateStr].tasks || []).find(t => t.id === taskId);
        }
      }

      if (!originalTask) {
        showToast("No se encontró la tarea a copiar.");
        return;
      }

      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      if (!env.days) env.days = {};
      if (!env.days[targetDateStr]) {
        env.days[targetDateStr] = {
          workStart: envKey === "personal" ? 18 * 60 : 9 * 60,
          workEnd: envKey === "personal" ? 23 * 60 : 18 * 60,
          meetings: [],
          tasks: [],
          interruptions: [],
          planningMode: false
        };
      }

      const targetDayObj = env.days[targetDateStr];
      if (!Array.isArray(targetDayObj.tasks)) targetDayObj.tasks = [];

      const maxOrder = targetDayObj.tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);

      const copiedTask = {
        id: newId(),
        title: originalTask.title,
        planned: originalTask.planned,
        order: maxOrder + 1,
        status: "pending",
        runningStart: null,
        elapsedBefore: 0,
        completedAt: null,
        actualDuration: null
      };

      targetDayObj.tasks.push(copiedTask);

      saveState();
      renderAll();

      const friendlyDate = window.TodayTasksUtils.formatDateFriendly ? window.TodayTasksUtils.formatDateFriendly(targetDateStr) : targetDateStr;
      showToast(`Tarea "${originalTask.title}" copiada al ${friendlyDate} 📋`);
    }

    function openCopyTaskModal(taskId) {
      const state = getState();
      const today = window.TodayTasksUtils.getTodayStr();
      const modal = document.getElementById("copyTaskModal");

      let taskTitle = "";
      let originalTask = (state.tasks || []).find(t => t.id === taskId);
      if (!originalTask) {
        const currentDateStr = state.selectedDate || today;
        const envKey = state.activeEnv || "work";
        const env = state.environments[envKey] || state.environments.work;
        if (env && env.days && env.days[currentDateStr]) {
          originalTask = (env.days[currentDateStr].tasks || []).find(t => t.id === taskId);
        }
      }
      if (originalTask) taskTitle = originalTask.title;

      if (!modal) {
        const targetDate = prompt(`¿A qué fecha deseas copiar "${taskTitle || 'la tarea'}"? (YYYY-MM-DD)`, today);
        if (targetDate && targetDate.trim()) copyTaskToDate(taskId, targetDate.trim());
        return;
      }

      const titleEl = document.getElementById("copyTaskModalTitle");
      if (titleEl) titleEl.textContent = taskTitle ? `Copiar "${taskTitle}" 📋` : "Copiar tarea 📋";

      const dateInput = document.getElementById("copyTaskDateInput");
      if (dateInput) dateInput.value = state.selectedDate && state.selectedDate !== today ? state.selectedDate : today;

      const btnToday = document.getElementById("copyTaskBtnToday");
      const btnCustom = document.getElementById("copyTaskBtnCustomDate");
      const btnCancel = document.getElementById("copyTaskBtnCancel");
      const todayLabel = document.getElementById("copyTaskTodayLabel");

      if (todayLabel) todayLabel.textContent = `(${today})`;

      modal.style.display = "flex";

      function cleanup() {
        modal.style.display = "none";
        if (btnToday) btnToday.onclick = null;
        if (btnCustom) btnCustom.onclick = null;
        if (btnCancel) btnCancel.onclick = null;
      }

      if (btnToday) {
        btnToday.onclick = () => {
          cleanup();
          copyTaskToDate(taskId, today);
        };
      }

      if (btnCustom) {
        btnCustom.onclick = () => {
          const val = dateInput ? dateInput.value : today;
          if (!val) {
            alert("Selecciona una fecha válida.");
            return;
          }
          cleanup();
          copyTaskToDate(taskId, val);
        };
      }

      if (btnCancel) {
        btnCancel.onclick = () => {
          cleanup();
        };
      }
    }

    return {
      switchEnvironment, addMeeting, deleteMeeting, startEditMeeting, updateMeetingEditField, cancelEditMeeting, saveEditMeeting,
      addTask, deleteTask, startEditTask, updateTaskEditField, cancelEditTask, saveEditTask, moveTask,
      armTaskDrag, taskDragStart, taskDragOver, taskDragLeave, taskDrop, taskDragEnd,
      startTask, pauseTask, resumeTask, completeTask, uncompleteTask,
      copyTaskToDate, openCopyTaskModal,
      startInterruption, updateInterruptionTitle, completeInterruption, cancelInterruption,
      selectDate, resetToToday, saveHistoryMetric, deleteHistoryMetric,
      startNewDay
    };
  };
})();

