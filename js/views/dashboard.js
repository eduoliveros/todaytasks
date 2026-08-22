/* views/dashboard.js — Reloj, estadísticas de cabecera, barra de progreso, entorno, formularios */
import { nowMinutes, fmt, fmtDur, computeOccupiedMeetingTime, getTodayStr, getDayAbbr } from '../utils.js';

export function TodayTasksDashboard(ctx){
  const { getState, computeSchedule } = ctx;

  function renderClock(){
    if (typeof document === "undefined") return;
    const el = document.getElementById("clockDisplay");
    if (el) el.textContent = fmt(nowMinutes());
  }

  function renderHeaderStats(){
    if (typeof document === "undefined") return;
    const el = document.getElementById("headerStats");
    if(!el) return;
    const state = getState();
    const meetingsTotal = computeOccupiedMeetingTime(state.meetings);
    const activeTasks = (state.tasks || []).filter(t => t.status !== "completed");
    const tasksTotal = activeTasks.reduce((s,t) => s + t.planned, 0);
    const completedTotal = (state.tasks || [])
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
    if (typeof document === "undefined") return;
    const container = document.getElementById("taskProgressContainer");
    if(!container) return;

    const state = getState();
    const tasks = state.tasks || [];
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
    if (typeof document === "undefined") return;
    const state = getState();
    const isWork = state.activeEnv !== "personal";
    const btnWork = document.getElementById("envBtnWork");
    const btnPersonal = document.getElementById("envBtnPersonal");
    if(btnWork) btnWork.classList.toggle("active", isWork);
    if(btnPersonal) btnPersonal.classList.toggle("active", !isWork);

    const labelWork = document.getElementById("envWeeklyWorkLabel");
    const labelPersonal = document.getElementById("envWeeklyPersonalLabel");
    if(labelWork) labelWork.classList.toggle("active", isWork);
    if(labelPersonal) labelPersonal.classList.toggle("active", !isWork);
  }

  function syncFormInputsFromState(){
    if (typeof document === "undefined") return;
    const state = getState();
    const dateStr = state.selectedDate || getTodayStr();
    const isToday = dateStr === getTodayStr();

    const ws = document.getElementById("workStartInput") || document.getElementById("workStart");
    const we = document.getElementById("workEndInput") || document.getElementById("workEnd");
    const ni = document.getElementById("notifyIntervalInput") || document.getElementById("notifyInterval");
    const ts = document.getElementById("themeSelect");
    const ab = document.getElementById("autoBreakToggle");
    const dpi = document.getElementById("datePickerInput");
    const dayLabel = document.getElementById("selectedDayLabel") || document.getElementById("datePickerDayLabel");
    const todayBtn = document.getElementById("todayBtn") || document.getElementById("btnDateToday");

    if(ws) ws.value = state.workStart !== null && state.workStart !== undefined ? fmt(state.workStart) : "";
    if(we) we.value = state.workEnd !== null && state.workEnd !== undefined ? fmt(state.workEnd) : "";
    if(ni) ni.value = state.notifyIntervalMin || 10;
    if(ts) ts.value = state.themeMode || "auto";
    if(dpi) dpi.value = dateStr;
    if(dayLabel) dayLabel.textContent = getDayAbbr(dateStr);
    if(todayBtn) {
      todayBtn.style.display = isToday ? "none" : "inline-flex";
    }
    refreshPlanningModeBtn();
    refreshAutoBreakBtn();
    renderEnvSwitcher();
  }


  function refreshPlanningModeBtn(){
    if (typeof document === "undefined") return;
    const btn = document.getElementById("planningModeBtn");
    if(!btn) return;
    const state = getState();
    btn.classList.toggle("active", state.planningMode);
    btn.textContent = state.planningMode ? "🗺 Planificación: ON" : "🗺 Modo planificación";
  }

  function refreshAutoBreakBtn(){
    if (typeof document === "undefined") return;
    const btn = document.getElementById("autoBreakBtn");
    if(!btn) return;
    const state = getState();
    const isEnabled = state.autoBreakEnabled !== false;
    btn.classList.toggle("active", isEnabled);
    btn.textContent = isEnabled ? "☕ Auto descansos: ON" : "☕ Auto descansos: OFF";
  }

  return {
    renderClock, renderHeaderStats, renderTaskProgressBar,
    renderEnvSwitcher, syncFormInputsFromState, refreshPlanningModeBtn, refreshAutoBreakBtn
  };
}

export default TodayTasksDashboard;
