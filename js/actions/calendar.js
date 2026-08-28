/* actions/calendar.js — Navegación de fechas, rollover, entorno, copia de tareas, día nuevo */
import { getTodayStr, formatDateFriendly, addDays, getTaskElapsed } from '../utils.js';
import { snapshotAndPrune, saveHistoryMetric as historySaveMetric, deleteHistoryMetric as historyDeleteMetric } from '../history.js';

export function TodayTasksCalendar(ctx, helpers){
  const {
    getState, getMeetingEdit, setMeetingEdit, getTaskEdit, setTaskEdit,
    saveState, newId, renderAll, smartRender
  } = ctx;
  const { nowMinutes, fmt, fmtDur, showToast } = helpers;

  function switchEnvironment(envName){
    const state = getState();
    if(!state.environments || !state.environments[envName]) return;
    if(state.activeEnv === envName) return;

    const currentView = ctx.getCurrentView ? ctx.getCurrentView() : 'main';
    const wasInterruption = state.activeInterruption || currentView === 'interruption';
    const wasFocus = currentView === 'task';

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
      if (typeof document !== "undefined") {
        const container = document.getElementById('view-interruption');
        if(container) container.innerHTML = "";
      }
      showToast(`Interrupción "${title}" finalizada (${fmtDur(duration)}).`);
    }

    state.activeEnv = envName;
    saveState();

    if(ctx.resetBoardScroll) ctx.resetBoardScroll();
    if(ctx.syncFormInputsFromState) ctx.syncFormInputsFromState();

    if(wasFocus || wasInterruption || (typeof window !== "undefined" && window.location.hash !== '' && window.location.hash !== '#/')){
      if (typeof window !== "undefined") window.location.hash = '#/';
      renderAll();
    } else {
      renderAll();
    }

    showToast(`Ambiente cambiado a ${envName === 'work' ? '💼 Trabajo' : '🏠 Personal'}`);
  }

  function countPendingAutoMoveTasks(targetDateStr) {
    const state = getState();
    const dateStr = targetDateStr || state.selectedDate || getTodayStr();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    if (!env || !env.days) return 0;
    const pastDates = Object.keys(env.days).filter(d => d < dateStr);
    let count = 0;
    pastDates.forEach(d => {
      const dayObj = env.days[d];
      if (dayObj && Array.isArray(dayObj.tasks)) {
        dayObj.tasks.forEach(t => {
          if (t.status !== "completed" && t.autoMoveToToday) {
            count++;
          }
        });
      }
    });
    return count;
  }

  function rolloverPendingTasks(materializeRecurringTasks, targetDate = null) {
    const state = getState();
    const today = getTodayStr();
    const targetDateStr = targetDate || today;
    const isToday = targetDateStr === today;
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    if (!env || !env.days) return 0;

    if (snapshotAndPrune) {
      snapshotAndPrune(state);
    }

    if (!env.days[targetDateStr]) {
      env.days[targetDateStr] = { meetings: [], tasks: [], interruptions: [], planningMode: false };
    }
    const targetDayObj = env.days[targetDateStr];
    if (!Array.isArray(targetDayObj.tasks)) targetDayObj.tasks = [];

    const pastDates = Object.keys(env.days).filter(d => d < targetDateStr).sort();
    let movedCount = 0;
    const movedTitles = [];

    pastDates.forEach(dateStr => {
      const dayObj = env.days[dateStr];
      if (!dayObj || !Array.isArray(dayObj.tasks)) return;

      const remainingTasks = [];
      dayObj.tasks.forEach(t => {
        if (t.status !== "completed" && t.autoMoveToToday) {
          const alreadyInTarget = targetDayObj.tasks.some(existing => String(existing.id) === String(t.id));
          if (!alreadyInTarget) {
            const maxOrder = targetDayObj.tasks.reduce((m, task) => Math.max(m, task.order || 0), 0);
            const savedElapsed = getTaskElapsed(t);
            const taskStatus = savedElapsed > 0 ? "paused" : "pending";

            targetDayObj.tasks.push({
              ...t,
              order: maxOrder + 1,
              status: taskStatus,
              runningStart: null,
              elapsedBefore: savedElapsed,
              completedAt: null,
              actualDuration: null
            });
            movedCount++;
            movedTitles.push(t.title);
          }
        } else {
          remainingTasks.push(t);
        }
      });
      dayObj.tasks = remainingTasks;
    });

    if (movedCount > 0) {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(`Mover ${movedCount} tareas automáticas a ${targetDateStr}`);
      }
      saveState();
      smartRender ? smartRender() : renderAll();
      const taskLabel = movedCount === 1 ? `"${movedTitles[0]}"` : `${movedCount} tareas pendientes`;
      const destLabel = isToday ? "hoy" : (formatDateFriendly ? `el ${formatDateFriendly(targetDateStr)}` : targetDateStr);
      showToast(`${taskLabel} se ha${movedCount === 1 ? '' : 'n'} movido a ${destLabel} ⏩`);
    }

    return movedCount;
  }

  function rolloverPendingTasksToDate(targetDateStr, materializeRecurringTasks) {
    return rolloverPendingTasks(materializeRecurringTasks, targetDateStr);
  }

  function selectDate(dateStr, materializeRecurringTasks, rollover){
    if(!dateStr) return;
    const state = getState();
    if(state.selectedDate === dateStr) return;
    state.selectedDate = dateStr;
    if(snapshotAndPrune){
      snapshotAndPrune(state);
    }
    if(materializeRecurringTasks) materializeRecurringTasks();
    const today = getTodayStr();
    if(dateStr === today && rollover){
      rollover();
    }
    if(ctx.resetBoardScroll) ctx.resetBoardScroll();
    saveState();
    if(ctx.syncFormInputsFromState) ctx.syncFormInputsFromState();
    smartRender ? smartRender() : renderAll();
    showToast(`Viendo planificación del ${formatDateFriendly(dateStr)} (${dateStr})`);
  }

  function changeDateByDays(deltaDays, selectDateFn){
    const state = getState();
    const current = state.selectedDate || getTodayStr();
    const targetDate = addDays(current, deltaDays);
    selectDateFn(targetDate);
  }

  function resetToToday(materializeRecurringTasks, rollover){
    const state = getState();
    const today = getTodayStr();
    state.selectedDate = today;
    if(snapshotAndPrune){
      snapshotAndPrune(state);
    }
    if(materializeRecurringTasks) materializeRecurringTasks();
    if(rollover) rollover();
    if(ctx.resetBoardScroll) ctx.resetBoardScroll();
    saveState();
    if(ctx.syncFormInputsFromState) ctx.syncFormInputsFromState();
    smartRender ? smartRender() : renderAll();
    showToast("Cargado el día actual (Hoy).");
  }

  function saveHistoryMetric(dateStr, metrics){
    const state = getState();
    if(historySaveMetric){
      historySaveMetric(state, dateStr, metrics);
    }
    saveState();
    smartRender ? smartRender() : renderAll();
    showToast(`Mediciones guardadas para el día ${dateStr}.`);
  }

  function deleteHistoryMetric(dateStr){
    if(typeof window !== "undefined" && !window.confirm(`¿Eliminar la medición guardada del día ${dateStr}?`)) return;
    const state = getState();
    if(historyDeleteMetric){
      historyDeleteMetric(state, dateStr);
    }
    saveState();
    smartRender ? smartRender() : renderAll();
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

    if(typeof window !== "undefined" && !window.confirm(msg)) return;

    if(snapshotAndPrune){
      snapshotAndPrune(state);
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
    let originalTask = (state.tasks || []).find(t => String(t.id) === String(taskId));
    if (!originalTask) {
      const currentDateStr = state.selectedDate || getTodayStr();
      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      if (env && env.days && env.days[currentDateStr]) {
        originalTask = (env.days[currentDateStr].tasks || []).find(t => String(t.id) === String(taskId));
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
      actualDuration: null,
      urgency: originalTask.urgency || "days",
      featured: false
    };

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Copiar tarea "${originalTask.title}" al ${targetDateStr}`);
    }

    targetDayObj.tasks.push(copiedTask);

    saveState();
    renderAll();

    const friendlyDate = formatDateFriendly ? formatDateFriendly(targetDateStr) : targetDateStr;
    showToast(`Tarea "${originalTask.title}" copiada al ${friendlyDate} 📋`);
  }

  function moveTaskToDate(taskId, targetDateStr) {
    if (!targetDateStr) return;
    const state = getState();
    const currentDateStr = state.selectedDate || getTodayStr();

    if (currentDateStr === targetDateStr) {
      showToast("La tarea ya está en esta fecha.");
      return;
    }

    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    if (!env || !env.days) return;

    let originalTask = null;
    let sourceDateStr = null;

    if (env.days[currentDateStr] && Array.isArray(env.days[currentDateStr].tasks)) {
      const found = env.days[currentDateStr].tasks.find(t => String(t.id) === String(taskId));
      if (found) {
        originalTask = found;
        sourceDateStr = currentDateStr;
      }
    }

    if (!originalTask) {
      for (const d of Object.keys(env.days)) {
        if (Array.isArray(env.days[d].tasks)) {
          const found = env.days[d].tasks.find(t => String(t.id) === String(taskId));
          if (found) {
            originalTask = found;
            sourceDateStr = d;
            break;
          }
        }
      }
    }

    if (!originalTask || !sourceDateStr) {
      showToast("No se encontró la tarea a mover.");
      return;
    }

    if (sourceDateStr === targetDateStr) {
      showToast("La tarea ya está en esta fecha.");
      return;
    }

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Mover tarea "${originalTask.title}" al ${targetDateStr}`);
    }

    if (!env.days[targetDateStr]) {
      env.days[targetDateStr] = {
        meetings: [],
        tasks: [],
        interruptions: [],
        planningMode: false
      };
    }

    const sourceDayObj = env.days[sourceDateStr];
    const targetDayObj = env.days[targetDateStr];
    if (!Array.isArray(targetDayObj.tasks)) targetDayObj.tasks = [];

    // Remove from source day
    sourceDayObj.tasks = (sourceDayObj.tasks || []).filter(t => String(t.id) !== String(taskId));

    const maxOrder = targetDayObj.tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const savedElapsed = getTaskElapsed(originalTask);
    const taskStatus = originalTask.status === "completed"
      ? "completed"
      : (savedElapsed > 0 ? "paused" : "pending");

    const movedTask = {
      ...originalTask,
      order: maxOrder + 1,
      status: taskStatus,
      runningStart: null,
      elapsedBefore: savedElapsed,
      completedAt: originalTask.status === "completed" ? originalTask.completedAt : null,
      actualDuration: originalTask.status === "completed" ? originalTask.actualDuration : null
    };

    targetDayObj.tasks.push(movedTask);

    saveState();
    smartRender ? smartRender() : renderAll();

    const friendlyDate = formatDateFriendly ? formatDateFriendly(targetDateStr) : targetDateStr;
    showToast(`Tarea "${originalTask.title}" movida al ${friendlyDate} ➡️`);
  }

  function openCopyTaskModal(taskId, copyTaskToDateFn, moveTaskToDateFn) {
    const state = getState();
    const today = getTodayStr();
    if (typeof document === "undefined") return;
    const modal = document.getElementById("copyTaskModal");

    let taskTitle = "";
    let originalTask = (state.tasks || []).find(t => String(t.id) === String(taskId));
    if (!originalTask) {
      const currentDateStr = state.selectedDate || today;
      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      if (env && env.days && env.days[currentDateStr]) {
        originalTask = (env.days[currentDateStr].tasks || []).find(t => String(t.id) === String(taskId));
      }
    }
    if (!originalTask) {
      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      if (env && env.days) {
        for (const d of Object.keys(env.days)) {
          const found = (env.days[d].tasks || []).find(t => String(t.id) === String(taskId));
          if (found) {
            originalTask = found;
            break;
          }
        }
      }
    }
    if (originalTask) taskTitle = originalTask.title;

    const isAutoMove = !!(originalTask && !originalTask.isRecurring && originalTask.autoMoveToToday);
    const actionFn = isAutoMove ? (moveTaskToDateFn || moveTaskToDate) : (copyTaskToDateFn || copyTaskToDate);

    if (!modal) {
      const verb = isAutoMove ? "mover" : "copiar";
      const targetDate = prompt(`¿A qué fecha deseas ${verb} "${taskTitle || 'la tarea'}"? (YYYY-MM-DD)`, today);
      if (targetDate && targetDate.trim()) actionFn(taskId, targetDate.trim());
      return;
    }

    const titleEl = document.getElementById("copyTaskModalTitle");
    const descEl = document.getElementById("copyTaskModalDesc");
    const labelTodaySpan = document.getElementById("copyTaskBtnTodayText");
    const btnCustom = document.getElementById("copyTaskBtnCustomDate");

    if (isAutoMove) {
      if (titleEl) titleEl.textContent = taskTitle ? `Mover "${taskTitle}" ➡️` : "Mover tarea ➡️";
      if (descEl) descEl.textContent = "¿A qué fecha deseas mover esta tarea? Se trasladará conservando el tiempo consumido y se quitará del día actual.";
      if (labelTodaySpan) labelTodaySpan.innerHTML = "📅 <strong>Mover a Hoy</strong>";
      if (btnCustom) btnCustom.textContent = "Mover";
    } else {
      if (titleEl) titleEl.textContent = taskTitle ? `Copiar "${taskTitle}" 📋` : "Copiar tarea 📋";
      if (descEl) descEl.textContent = "¿A qué fecha deseas copiar esta tarea? Se creará una copia en estado pendiente con la duración completa original.";
      if (labelTodaySpan) labelTodaySpan.innerHTML = "📅 <strong>Copiar a Hoy</strong>";
      if (btnCustom) btnCustom.textContent = "Copiar";
    }

    const dateInput = document.getElementById("copyTaskDateInput");
    if (dateInput) dateInput.value = state.selectedDate && state.selectedDate !== today ? state.selectedDate : today;

    const btnToday = document.getElementById("copyTaskBtnToday");
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
        actionFn(taskId, today);
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
        actionFn(taskId, val);
      };
    }

    if (btnCancel) {
      btnCancel.onclick = () => {
        cleanup();
      };
    }
  }

  return {
    switchEnvironment, rolloverPendingTasks, rolloverPendingTasksToDate,
    countPendingAutoMoveTasks, selectDate, changeDateByDays,
    resetToToday, saveHistoryMetric, deleteHistoryMetric, startNewDay,
    copyTaskToDate, moveTaskToDate, openCopyTaskModal
  };
}

export default TodayTasksCalendar;


