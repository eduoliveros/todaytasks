/* views/dashboard.js — Reloj, estadísticas de cabecera, barra de progreso, entorno, formularios */
import { nowMinutes, fmt, fmtDur, computeOccupiedMeetingTime, getTodayStr, getDayAbbr } from '../utils.js';

export function TodayTasksDashboard(ctx){
  const { getState, computeSchedule } = ctx;

  const _nowMinutes = () => (window.TodayTasksUtils && window.TodayTasksUtils.nowMinutes) ? window.TodayTasksUtils.nowMinutes() : nowMinutes();
  const _fmt = (min) => (window.TodayTasksUtils && window.TodayTasksUtils.fmt) ? window.TodayTasksUtils.fmt(min) : fmt(min);
  const _fmtDur = (min) => (window.TodayTasksUtils && window.TodayTasksUtils.fmtDur) ? window.TodayTasksUtils.fmtDur(min) : fmtDur(min);
  const _getTodayStr = () => (window.TodayTasksUtils && window.TodayTasksUtils.getTodayStr) ? window.TodayTasksUtils.getTodayStr() : getTodayStr();

  function renderClock(){
    if (typeof document === "undefined") return;
    const el = document.getElementById("clockDisplay");
    if (el) el.textContent = _fmt(_nowMinutes());
  }

  function renderHeaderStats(){
    if (typeof document === "undefined") return;
    const el = document.getElementById("headerStats");
    if(!el) return;
    const state = getState();
    const meetingsTotal = (window.TodayTasksUtils && window.TodayTasksUtils.computeOccupiedMeetingTime)
      ? window.TodayTasksUtils.computeOccupiedMeetingTime(state.meetings)
      : computeOccupiedMeetingTime(state.meetings);
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
      <span class="stat-chip stat-meeting"><span class="stat-icon">🗓</span>Reuniones <span class="stat-value">${_fmtDur(meetingsTotal)}</span></span>
      <span class="stat-chip stat-task"><span class="stat-icon">🗒</span>Tareas por hacer <span class="stat-value">${_fmtDur(tasksTotal)}</span></span>
      <span class="stat-chip"><span class="stat-icon">✓</span>Completado hoy <span class="stat-value">${_fmtDur(completedTotal)}</span></span>
      ${intTotal > 0 ? `<span class="stat-chip"><span class="stat-icon">⚡</span>Interrupciones <span class="stat-value" style="color:var(--danger)">${_fmtDur(intTotal)}</span></span>` : ''}
      ${isFree
        ? `<span class="stat-chip stat-free" title="Día libre sin horario de jornada fijo"><span class="stat-icon">🏖</span>Día libre</span>`
        : `<span class="stat-chip stat-free" title="Tiempo disponible en la jornada descontando reuniones y tareas por hacer (${_fmt(workStart)} - ${_fmt(workEnd)})"><span class="stat-icon">⏳</span>Tiempo no asignado <span class="stat-value">${_fmtDur(unassignedTime)}</span></span>`
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
              <span class="progress-counts">0/0</span>
            </div>
            <span class="progress-pct">0%</span>
          </div>
          <div class="progress-bar-bg"><div class="progress-bar-fill progress-fill-completed" style="width:0%"></div></div>
        </div>`;
      return;
    }

    const pctCompleted = Math.round((completed / total) * 100);
    const pctRunning = Math.round((running / total) * 100);
    const pctPaused = Math.round((paused / total) * 100);
    const pctUnstarted = Math.max(0, 100 - pctCompleted - pctRunning - pctPaused);

    const legendItems = [];
    if(completed > 0) legendItems.push(`<span class="legend-item legend-completed">✓ ${completed} compl.</span>`);
    if(running > 0) legendItems.push(`<span class="legend-item legend-running">▶ ${running} en curso</span>`);
    if(paused > 0) legendItems.push(`<span class="legend-item legend-paused">⏸ ${paused} pausada${paused > 1 ? 's' : ''}</span>`);
    if(unstarted > 0) legendItems.push(`<span class="legend-item legend-unstarted">· ${unstarted} pend.</span>`);

    container.innerHTML = `
      <div class="progress-banner">
        <div class="progress-header">
          <div class="progress-header-left">
            <span class="progress-title">Progreso de tareas</span>
            <span class="progress-counts">${completed}/${total} completadas</span>
            <span class="progress-legend">${legendItems.join("")}</span>
          </div>
          <span class="progress-pct">${pctCompleted}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill progress-fill-completed" style="width:${pctCompleted}%" title="${completed} completadas (${pctCompleted}%)"></div>
          <div class="progress-bar-fill progress-fill-running" style="width:${pctRunning}%" title="${running} en curso (${pctRunning}%)"></div>
          <div class="progress-bar-fill progress-fill-paused" style="width:${pctPaused}%" title="${paused} pausadas (${pctPaused}%)"></div>
          <div class="progress-bar-fill progress-fill-unstarted" style="width:${pctUnstarted}%" title="${unstarted} sin empezar (${pctUnstarted}%)"></div>
        </div>
      </div>`;
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
    const dateStr = state.selectedDate || _getTodayStr();
    const isToday = dateStr === _getTodayStr();

    const ws = document.getElementById("workStartInput") || document.getElementById("workStart");
    const we = document.getElementById("workEndInput") || document.getElementById("workEnd");
    const ni = document.getElementById("notifyIntervalInput") || document.getElementById("notifyInterval");
    const ts = document.getElementById("themeSelect");
    const dpi = document.getElementById("datePickerInput");
    const dayLabel = document.getElementById("selectedDayLabel") || document.getElementById("datePickerDayLabel");
    const todayBtn = document.getElementById("todayBtn") || document.getElementById("btnDateToday");

    if(ws) ws.value = state.workStart !== null && state.workStart !== undefined ? _fmt(state.workStart) : "";
    if(we) we.value = state.workEnd !== null && state.workEnd !== undefined ? _fmt(state.workEnd) : "";
    if(ni) ni.value = state.notifyIntervalMin || 10;
    if(ts) ts.value = state.themeMode || "auto";
    if(dpi) dpi.value = dateStr;
    if(dayLabel) dayLabel.textContent = (window.TodayTasksUtils && window.TodayTasksUtils.getDayAbbr) ? window.TodayTasksUtils.getDayAbbr(dateStr) : getDayAbbr(dateStr);
    if(todayBtn) {
      todayBtn.style.display = isToday ? "none" : "inline-flex";
    }
    refreshPlanningModeBtn();
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

  return {
    renderClock, renderHeaderStats, renderTaskProgressBar,
    renderEnvSwitcher, syncFormInputsFromState, refreshPlanningModeBtn
  };
}

if (typeof window !== "undefined") {
  window._TodayTasksDashboard = TodayTasksDashboard;
}

export default TodayTasksDashboard;
