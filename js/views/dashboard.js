/* views/dashboard.js — Reloj, estadísticas de cabecera, barra de progreso, entorno, formularios */
import { nowMinutes, fmt, fmtDur, computeOccupiedMeetingTime, computeDayDeviation, getTodayStr, getDayAbbr } from '../utils.js';
import { t } from '../i18n.js';

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
    const dev = computeDayDeviation(state.tasks);

    const isOver = dev.deviationMin > 0;
    const isUnder = dev.deviationMin < 0;
    const sign = isOver ? '+' : (isUnder ? '−' : '');
    const devClass = isOver ? 'stat-dev-over' : (isUnder ? 'stat-dev-under' : 'stat-dev-neutral');
    const taskCountLabel = t('dashboard.statsDevTaskCount', { count: dev.evaluatedCount });
    const devTitle = t('dashboard.statsDevTitle', {
      real: fmtDur(dev.realMin),
      planned: fmtDur(dev.plannedMin),
      count: dev.evaluatedCount,
      taskLabel: taskCountLabel
    });

    const workStart = state.workStart;
    const workEnd = state.workEnd;
    const isFree = workStart === null || workEnd === null;
    const workdayTotal = isFree ? 0 : Math.max(0, workEnd - workStart);
    const unassignedTime = isFree ? 0 : Math.max(0, workdayTotal - meetingsTotal - tasksTotal);

    el.innerHTML = `
      <span class="stat-chip stat-meeting"><span class="stat-icon">🗓</span>${t('dashboard.statsMeetings')} <span class="stat-value">${fmtDur(meetingsTotal)}</span></span>
      <span class="stat-chip stat-task"><span class="stat-icon">🗒</span>${t('dashboard.statsTasks')} <span class="stat-value">${fmtDur(tasksTotal)}</span></span>
      <span class="stat-chip"><span class="stat-icon">✓</span>${t('dashboard.statsCompleted')} <span class="stat-value">${fmtDur(completedTotal)}</span></span>
      ${intTotal > 0 ? `<span class="stat-chip"><span class="stat-icon">⚡</span>${t('dashboard.statsInterruptions')} <span class="stat-value" style="color:var(--danger)">${fmtDur(intTotal)}</span></span>` : ''}
      ${dev.evaluatedCount > 0 ? `
        <span class="stat-chip stat-dev stat-dev-dual ${devClass}" title="${devTitle}">
          <span class="stat-icon">⏱</span>
          <span class="stat-dual-values">${fmtDur(dev.realMin)} / ${fmtDur(dev.plannedMin)}</span>
          <span class="stat-dual-delta">${sign}${fmtDur(Math.abs(dev.deviationMin))}</span>
        </span>
      ` : ''}
      ${isFree
        ? `<span class="stat-chip stat-free" title="${t('dashboard.statsFreeDayTooltip')}"><span class="stat-icon">🏖</span>${t('dashboard.statsFreeDay')}</span>`
        : `<span class="stat-chip stat-free" title="${t('dashboard.statsUnassignedTooltip', { start: fmt(workStart), end: fmt(workEnd) })}"><span class="stat-icon">⏳</span>${t('dashboard.statsUnassignedTime')} <span class="stat-value">${fmtDur(unassignedTime)}</span></span>`
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
              <span class="progress-title">${t('dashboard.progressTitle')}</span>
              <div class="progress-legend">
                <span class="legend-item leg-completed"><span class="dot"></span> ${t('dashboard.progressCompleted', { count: 0 })}</span>
                <span class="legend-item leg-running"><span class="dot"></span> ${t('dashboard.progressRunning', { count: 0 })}</span>
                <span class="legend-item leg-paused"><span class="dot"></span> ${t('dashboard.progressPaused', { count: 0 })}</span>
                <span class="legend-item leg-pending"><span class="dot"></span> ${t('dashboard.progressPending', { count: 0 })}</span>
              </div>
            </div>
            <span class="progress-total-badge">${t('dashboard.progressTotal', { count: 0, taskLabel: t('task.countLabel', { count: 0 }) })}</span>
          </div>
          <div class="progress-track empty-track">
            <span class="empty-track-text">${t('dashboard.progressEmpty')}</span>
          </div>
        </div>
      `;
      return;
    }

    const pctCompleted = (completed / total) * 100;
    const pctRunning = (running / total) * 100;
    const pctPaused = (paused / total) * 100;
    const pctUnstarted = (unstarted / total) * 100;

    const compLabel = completed > 0 ? (pctCompleted >= 10 ? t('dashboard.progressCompleted', { count: completed }) : `${completed}`) : '';
    const runLabel = running > 0 ? (pctRunning >= 10 ? t('dashboard.progressRunningShort', { count: running }) : `${running}`) : '';
    const pauseLabel = paused > 0 ? (pctPaused >= 10 ? t('dashboard.progressPaused', { count: paused }) : `${paused}`) : '';
    const unstartedLabel = unstarted > 0 ? (pctUnstarted >= 10 ? t('dashboard.progressPending', { count: unstarted }) : `${unstarted}`) : '';

    container.innerHTML = `
      <div class="progress-banner">
        <div class="progress-header">
          <div class="progress-header-left">
            <span class="progress-title">${t('dashboard.progressTitle')}</span>
            <div class="progress-legend">
              <span class="legend-item leg-completed"><span class="dot"></span> ${t('dashboard.progressCompleted', { count: completed })}</span>
              <span class="legend-item leg-running"><span class="dot"></span> ${t('dashboard.progressRunning', { count: running })}</span>
              <span class="legend-item leg-paused"><span class="dot"></span> ${t('dashboard.progressPaused', { count: paused })}</span>
              <span class="legend-item leg-pending"><span class="dot"></span> ${t('dashboard.progressPending', { count: unstarted })}</span>
            </div>
          </div>
          <span class="progress-total-badge">${t('dashboard.progressTotal', { count: total, taskLabel: t('task.countLabel', { count: total }) })}</span>
        </div>
        <div class="progress-track">
          <div class="progress-seg seg-completed" style="width: ${pctCompleted}%" title="${t('dashboard.progressCompleted', { count: completed })} (${Math.round(pctCompleted)}%)">
            ${compLabel ? `<span class="seg-label">${compLabel}</span>` : ''}
          </div>
          <div class="progress-seg seg-running" style="width: ${pctRunning}%" title="${t('dashboard.progressRunning', { count: running })} (${Math.round(pctRunning)}%)">
            ${runLabel ? `<span class="seg-label">${runLabel}</span>` : ''}
          </div>
          <div class="progress-seg seg-paused" style="width: ${pctPaused}%" title="${t('dashboard.progressPaused', { count: paused })} (${Math.round(pctPaused)}%)">
            ${pauseLabel ? `<span class="seg-label">${pauseLabel}</span>` : ''}
          </div>
          <div class="progress-seg seg-pending" style="width: ${pctUnstarted}%" title="${t('dashboard.progressPending', { count: unstarted })} (${Math.round(pctUnstarted)}%)">
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
    const ls = document.getElementById("languageSelect");
    const ab = document.getElementById("autoBreakToggle");
    const dpi = document.getElementById("datePickerInput");
    const dayLabel = document.getElementById("selectedDayLabel") || document.getElementById("datePickerDayLabel");
    const todayBtn = document.getElementById("todayBtn") || document.getElementById("btnDateToday");

    if(ws) ws.value = state.workStart !== null && state.workStart !== undefined ? fmt(state.workStart) : "";
    if(we) we.value = state.workEnd !== null && state.workEnd !== undefined ? fmt(state.workEnd) : "";
    if(ni) ni.value = state.notifyIntervalMin || 10;
    if(ts) ts.value = state.themeMode || "auto";
    if(ls) ls.value = state.language || "es";
    if(dpi) dpi.value = dateStr;
    renderDayLabel();
    if(todayBtn) {
      todayBtn.style.display = isToday ? "none" : "inline-flex";
    }
    refreshPlanningModeBtn();
    refreshAutoBreakBtn();
    renderEnvSwitcher();
  }

  function renderDayLabel(){
    if (typeof document === "undefined") return;
    const state = getState();
    const dateStr = state.selectedDate || getTodayStr();
    const dayLabel = document.getElementById("selectedDayLabel") || document.getElementById("datePickerDayLabel");
    if(dayLabel) dayLabel.textContent = getDayAbbr(dateStr);
  }

  function refreshPlanningModeBtn(){
    if (typeof document === "undefined") return;
    const btn = document.getElementById("planningModeBtn");
    if(!btn) return;
    const state = getState();
    btn.classList.toggle("active", state.planningMode);
    btn.textContent = state.planningMode ? t("time.planningModeOn") : t("time.planningMode");
  }

  function refreshAutoBreakBtn(){
    if (typeof document === "undefined") return;
    const btn = document.getElementById("autoBreakBtn");
    if(!btn) return;
    const state = getState();
    const isEnabled = state.autoBreakEnabled !== false;
    btn.classList.toggle("active", isEnabled);
    btn.textContent = isEnabled ? t("config.autoBreaksOn") : t("config.autoBreaksOff");
  }

  return {
    renderClock, renderHeaderStats, renderTaskProgressBar, renderDayLabel,
    renderEnvSwitcher, syncFormInputsFromState, refreshPlanningModeBtn, refreshAutoBreakBtn
  };
}

export default TodayTasksDashboard;
