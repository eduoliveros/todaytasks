/* views/dashboard.js — Reloj, estadísticas de cabecera, barra de progreso, entorno, formularios */
(function(){
  "use strict";

  window._TodayTasksDashboard = function(ctx){
    const { getState, computeSchedule } = ctx;
    const { nowMinutes, fmt, fmtDur } = window.TodayTasksUtils;

    function renderClock(){
      document.getElementById("clockDisplay").textContent = fmt(nowMinutes());
    }

    function renderHeaderStats(){
      const el = document.getElementById("headerStats");
      if(!el) return;
      const state = getState();
      const meetingsTotal = window.TodayTasksUtils.computeOccupiedMeetingTime(state.meetings);
      const activeTasks = state.tasks.filter(t => t.status !== "completed");
      const tasksTotal = activeTasks.reduce((s,t) => s + t.planned, 0);
      const completedTotal = state.tasks
        .filter(t => t.status === "completed")
        .reduce((s,t) => s + (t.actualDuration||0), 0);
      const intTotal = (state.interruptions||[]).reduce((s,i) => s + (i.duration||0), 0);

      const workStart = state.workStart;
      const workEnd = state.workEnd;
      const isFree = workStart === null || workEnd === null;
      const workdayTotal = isFree ? 0 : Math.max(0, workEnd - workStart);
      const unassignedTime = isFree ? 0 : Math.max(0, workdayTotal - meetingsTotal - tasksTotal);

      el.innerHTML = `
        <span class="stat-chip stat-meeting"><span class="stat-icon">🗓</span>Reuniones <span class="stat-value">${fmtDur(meetingsTotal)}</span></span>
        <span class="stat-chip stat-task"><span class="stat-icon">🗒</span>Tareas por hacer <span class="stat-value">${fmtDur(tasksTotal)}</span></span>
        <span class="stat-chip"><span class="stat-icon">✓</span>Completado hoy <span class="stat-value">${fmtDur(completedTotal)}</span></span>
        ${intTotal > 0 ? `<span class="stat-chip"><span class="stat-icon">⚡</span>Interrupciones <span class="stat-value" style="color:var(--danger)">${fmtDur(intTotal)}</span></span>` : ''}
        ${isFree
          ? `<span class="stat-chip stat-free" title="Día libre sin horario de jornada fijo"><span class="stat-icon">🏖</span>Día libre</span>`
          : `<span class="stat-chip stat-free" title="Tiempo disponible en la jornada descontando reuniones y tareas por hacer (${fmt(workStart)} - ${fmt(workEnd)})"><span class="stat-icon">⏳</span>Tiempo no asignado <span class="stat-value">${fmtDur(unassignedTime)}</span></span>`
        }
      `;
    }

    function renderTaskProgressBar(){
      const container = document.getElementById("taskProgressContainer");
      if(!container) return;

      const state = getState();
      const tasks = state.tasks;
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === "completed").length;
      const running = tasks.filter(t => t.status === "running").length;
      const paused = tasks.filter(t => t.status !== "completed" && t.status !== "running" && (t.status === "paused" || (t.elapsedBefore || 0) > 0)).length;
      const unstarted = tasks.filter(t => t.status === "pending" && (!t.elapsedBefore || t.elapsedBefore === 0)).length;

      if(total === 0){
        container.innerHTML = `
          <div class="progress-banner">
            <div class="progress-header">
              <div class="progress-header-left">
                <span class="progress-title">Progreso de tareas</span>
                <div class="progress-legend">
                  <span class="legend-item leg-completed"><span class="dot"></span> 0 completadas</span>
                  <span class="legend-item leg-running"><span class="dot"></span> 0 en ejecución</span>
                  <span class="legend-item leg-paused"><span class="dot"></span> 0 en pausa</span>
                  <span class="legend-item leg-pending"><span class="dot"></span> 0 sin iniciar</span>
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
      const pctPaused = (paused / total) * 100;
      const pctUnstarted = (unstarted / total) * 100;

      const compLabel = completed > 0 ? (pctCompleted >= 10 ? `${completed} completada${completed!==1?'s':''}` : `${completed}`) : '';
      const runLabel = running > 0 ? (pctRunning >= 10 ? `${running} en curso` : `${running}`) : '';
      const pauseLabel = paused > 0 ? (pctPaused >= 10 ? `${paused} en pausa` : `${paused}`) : '';
      const unstartedLabel = unstarted > 0 ? (pctUnstarted >= 10 ? `${unstarted} sin iniciar` : `${unstarted}`) : '';

      container.innerHTML = `
        <div class="progress-banner">
          <div class="progress-header">
            <div class="progress-header-left">
              <span class="progress-title">Progreso de tareas</span>
              <div class="progress-legend">
                <span class="legend-item leg-completed"><span class="dot"></span> ${completed} completada${completed!==1?'s':''}</span>
                <span class="legend-item leg-running"><span class="dot"></span> ${running} en ejecución</span>
                <span class="legend-item leg-paused"><span class="dot"></span> ${paused} en pausa</span>
                <span class="legend-item leg-pending"><span class="dot"></span> ${unstarted} sin iniciar</span>
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
            <div class="progress-seg seg-paused" style="width: ${pctPaused}%" title="${paused} en pausa (${Math.round(pctPaused)}%)">
              ${pauseLabel ? `<span class="seg-label">${pauseLabel}</span>` : ''}
            </div>
            <div class="progress-seg seg-pending" style="width: ${pctUnstarted}%" title="${unstarted} sin iniciar (${Math.round(pctUnstarted)}%)">
              ${unstartedLabel ? `<span class="seg-label">${unstartedLabel}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    function renderEnvSwitcher(){
      const state = getState();
      const activeEnv = state.activeEnv || 'work';
      const workBtn = document.getElementById("envBtnWork");
      const personalBtn = document.getElementById("envBtnPersonal");

      if(workBtn){
        workBtn.classList.toggle("active", activeEnv === "work");
      }
      if(personalBtn){
        personalBtn.classList.toggle("active", activeEnv === "personal");
      }
    }

    function syncFormInputsFromState(){
      const state = getState();
      const ws = document.getElementById("workStartInput");
      const we = document.getElementById("workEndInput");
      const ni = document.getElementById("notifyIntervalInput");
      const ts = document.getElementById("themeSelect");
      const dpi = document.getElementById("datePickerInput");
      const todayBtn = document.getElementById("todayBtn");
      const dayLabel = document.getElementById("selectedDayLabel");
      const today = window.TodayTasksUtils.getTodayStr();
      const isToday = !state.selectedDate || state.selectedDate === today;
      const dateStr = state.selectedDate || today;

      if(ws) ws.value = fmt(state.workStart);
      if(we) we.value = fmt(state.workEnd);
      if(ni) ni.value = state.notifyIntervalMin;
      if(ts) ts.value = state.themeMode || "auto";
      if(dpi) dpi.value = dateStr;
      if(dayLabel) dayLabel.textContent = window.TodayTasksUtils.getDayAbbr(dateStr);
      if(todayBtn) {
        todayBtn.style.display = isToday ? "none" : "inline-flex";
      }
      refreshPlanningModeBtn();
      renderEnvSwitcher();
    }

    function refreshPlanningModeBtn(){
      const btn = document.getElementById("planningModeBtn");
      if(!btn) return;
      const state = getState();
      btn.classList.toggle("active", state.planningMode);
      btn.textContent = state.planningMode ? "🗺 Planificación: ON" : "🗺 Modo planificación";
    }

    return {
      renderClock, renderHeaderStats, renderTaskProgressBar,
      renderEnvSwitcher, syncFormInputsFromState, refreshPlanningModeBtn
    };
  };
})();
