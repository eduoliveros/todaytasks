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

  function rolloverPendingTasks(materializeRecurringTasks) {
    const state = getState();
    const today = getTodayStr();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    if (!env || !env.days) return 0;

    if (snapshotAndPrune) {
      snapshotAndPrune(state);
    }

    if (!env.days[today]) {
      env.days[today] = { meetings: [], tasks: [], interruptions: [], planningMode: false };
    }
    const todayDayObj = env.days[today];
    if (!Array.isArray(todayDayObj.tasks)) todayDayObj.tasks = [];

    const pastDates = Object.keys(env.days).filter(d => d < today).sort();
    let movedCount = 0;
    const movedTitles = [];

    pastDates.forEach(dateStr => {
      const dayObj = env.days[dateStr];
      if (!dayObj || !Array.isArray(dayObj.tasks)) return;

      const remainingTasks = [];
      dayObj.tasks.forEach(t => {
        if (t.status !== "completed" && t.autoMoveToToday) {
          const alreadyInToday = todayDayObj.tasks.some(existing => existing.id === t.id);
          if (!alreadyInToday) {
            const maxOrder = todayDayObj.tasks.reduce((m, task) => Math.max(m, task.order || 0), 0);
            const savedElapsed = getTaskElapsed(t);
            const taskStatus = savedElapsed > 0 ? "paused" : "pending";

            todayDayObj.tasks.push({
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
      saveState();
      smartRender ? smartRender() : renderAll();
      const taskLabel = movedCount === 1 ? `"${movedTitles[0]}"` : `${movedCount} tareas pendientes`;
      showToast(`${taskLabel} se ha${movedCount === 1 ? '' : 'n'} movido a hoy ⏩`);
    }

    return movedCount;
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
    const currentDateStr = state.selectedDate || getTodayStr();

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

    const friendlyDate = formatDateFriendly ? formatDateFriendly(targetDateStr) : targetDateStr;
    showToast(`Tarea "${originalTask.title}" copiada al ${friendlyDate} 📋`);
  }

  function openCopyTaskModal(taskId, copyTaskToDateFn) {
    const state = getState();
    const today = getTodayStr();
    if (typeof document === "undefined") return;
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
      if (targetDate && targetDate.trim()) copyTaskToDateFn(taskId, targetDate.trim());
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
        copyTaskToDateFn(taskId, today);
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
        copyTaskToDateFn(taskId, val);
      };
    }

    if (btnCancel) {
      btnCancel.onclick = () => {
        cleanup();
      };
    }
  }

  return {
    switchEnvironment, rolloverPendingTasks, selectDate, changeDateByDays,
    resetToToday, saveHistoryMetric, deleteHistoryMetric, startNewDay,
    copyTaskToDate, openCopyTaskModal
  };
}

export default TodayTasksCalendar;

