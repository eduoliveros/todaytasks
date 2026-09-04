/* app.js — Coordinador principal de la aplicación */
import TodayTasksConfig from './config.js';
import { nowMinutes, fmt, fmtDur, fmtRemaining, timeToMinutes, getTodayStr, getDayOfWeek, getTaskElapsed, formatRecurrenceRule } from './utils.js';
import { escapeHtml, escapeAttr, showToast, scrollToElement, renderNotesMarkdown } from './ui.js';
import { defaultState, loadState, wrapState } from './state.js';
import { computeSchedule } from './scheduler.js';
import { TodayTasksActions } from './actions.js';
import { TodayTasksViews } from './views.js';
import { TodayTasksCloud } from './cloud.js';
import { TodayTasksRouter } from './router.js';
import { TodayTasksNotifications } from './notifications.js';
import { TodayTasksWeeklySchedule } from './app/weekly-schedule.js';
import { TodayTasksForms } from './app/forms.js';
import { TodayTasksShortcuts } from './app/shortcuts.js';
import { TodayTasksHistory } from './history.js';
import { TodayTasksUndo } from './undo.js';
import { TodayTasksVersionSync } from './version.js';
import { TodayTasksPiP } from './pip.js';
import { t, setLocale, translateDOM } from './i18n.js';

const STORAGE_KEY = (TodayTasksConfig && TodayTasksConfig.storageKey) ? TodayTasksConfig.storageKey : "todaytasks_state_v1";

function fmtMMSS(startEpoch){
  if(!startEpoch) return "00:00";
  const totalSec = Math.max(0, Math.floor((Date.now() - startEpoch) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

/* ---------------- State ---------------- */
let state = loadState(STORAGE_KEY);

let meetingEdit = null;
let taskEdit = null;
let taskSearchQuery = "";
let notifyState = {taskId:null, lastNotifiedAt:null, timeEndNotified:false};

const RING_R = 85;
const RING_C = +(2 * Math.PI * RING_R).toFixed(2);

function saveState(){
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') {
        showToast('⚠️ Almacenamiento local lleno. Libera espacio o inicia sesión en la nube.');
      }
      console.error('Error guardando estado local:', e);
    }
  }
  if(cloudModule && cloudModule.pushToCloudDebounced) {
    cloudModule.pushToCloudDebounced();
  } else if(cloudModule && cloudModule.pushToCloud) {
    cloudModule.pushToCloud();
  }
}

function newId(){
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const id = state.nextId || 1;
  state.nextId = id + 1;
  return 'id_' + id + '_' + Date.now();
}

function computeScheduleFn(){
  return computeSchedule(state, nowMinutes);
}

let actionsModule, viewsModule, cloudModule, routerModule;

const ctx = {
  STORAGE_KEY,
  getState: () => state,
  setState: (newState) => {
    state = wrapState(newState);
    if (state.language) {
      setLocale(state.language);
      translateDOM();
      if (cloudModule && cloudModule.renderAuthArea) cloudModule.renderAuthArea();
    }
  },
  getMeetingEdit: () => meetingEdit,
  setMeetingEdit: (v) => { meetingEdit = v; },
  getTaskEdit: () => taskEdit,
  setTaskEdit: (v) => { taskEdit = v; },
  getTaskSearchQuery: () => taskSearchQuery,
  setTaskSearchQuery: (v) => { taskSearchQuery = v; },
  getNotifyState: () => notifyState,
  setNotifyState: (v) => { notifyState = v; },
  getCurrentView: () => routerModule ? routerModule.getCurrentView() : 'main',
  getFocusTaskId: () => routerModule ? routerModule.getFocusTaskId() : null,
  saveState,
  newId,
  computeSchedule: computeScheduleFn,
  fmtMMSS,
  RING_R,
  RING_C,
  renderAll: () => viewsModule && viewsModule.renderAll(),
  renderTasks: (sched) => viewsModule && viewsModule.renderTasks(sched || computeScheduleFn()),
  smartRender: () => viewsModule && viewsModule.smartRender(),
  renderInterruptionView: () => viewsModule && viewsModule.renderInterruptionView(),
  renderTaskFocusView: () => viewsModule && viewsModule.renderTaskFocusView(),
  renderTriageView: () => viewsModule && viewsModule.renderTriageView && viewsModule.renderTriageView(),
  syncFormInputsFromState: () => viewsModule && viewsModule.syncFormInputsFromState(),
  refreshPlanningModeBtn: () => viewsModule && viewsModule.refreshPlanningModeBtn(),
  resetBoardScroll: () => viewsModule && viewsModule.resetBoardScroll && viewsModule.resetBoardScroll(),
};

let undoModule = TodayTasksUndo({
  getState: () => state,
  setState: (newState) => { state = wrapState(newState); },
  saveState,
  renderAll: () => viewsModule && viewsModule.renderAll(),
  showToast
});
ctx.undoModule = undoModule;

actionsModule = TodayTasksActions(ctx);
ctx.actionsModule = actionsModule;
viewsModule = TodayTasksViews(ctx);
cloudModule = TodayTasksCloud(ctx);
ctx.cloudModule = cloudModule;
routerModule = TodayTasksRouter(ctx);

let versionSyncModule = TodayTasksVersionSync({
  getState: () => state,
  saveState,
  getTaskEdit: () => taskEdit,
  getMeetingEdit: () => meetingEdit,
  flushPendingCloudPush: () => cloudModule && cloudModule.flushPendingCloudPush && cloudModule.flushPendingCloudPush(),
  showToast
});
ctx.versionSyncModule = versionSyncModule;

let pipModule = TodayTasksPiP({
  ...ctx,
  actionsModule,
  viewsModule,
  showToast
});
ctx.pipModule = pipModule;

const { refreshNotifyBtn, requestNotificationPermission, checkRunningTaskNotification, checkMeetingNotifications } =
  TodayTasksNotifications({
    getState: () => state,
    getNotifyState: () => notifyState,
    setNotifyState: (v) => { notifyState = v; },
    pauseTask: (id) => actionsModule.pauseTask(id),
    saveState,
    nowMinutes,
    fmt,
    fmtRemaining,
    showToast
  });

/* ---------------- Header tabs ---------------- */
function switchHeaderTab(target){
  if (typeof document === "undefined") return;
  const tabs = document.querySelectorAll('.header-tab');
  const panels = document.querySelectorAll('.header-tab-panel');
  tabs.forEach(function(t){
    const isTarget = t.dataset.tab === target;
    t.classList.toggle('active', isTarget);
    t.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });
  panels.forEach(function(p){
    p.classList.toggle('active', p.id === 'htab-' + target);
  });
}


  (function(){
    const tabs = document.querySelectorAll('.header-tab');
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        switchHeaderTab(tab.dataset.tab);
      });
    });
  })();

  /* ---------------- Work hours inputs ---------------- */
  document.getElementById("workStartInput").value = fmt(state.workStart);
  document.getElementById("workStartInput").addEventListener("change", (e)=>{
    const val = e.target.value;
    if(!val) {
      state.workStart = null;
      saveState();
      viewsModule.renderAll();
      return;
    }
    const v = timeToMinutes(val);
    if(v !== null){
      state.workStart = v;
      saveState();
      viewsModule.renderAll();
    }
  });

  document.getElementById("workEndInput").value = fmt(state.workEnd);
  document.getElementById("workEndInput").addEventListener("change", (e)=>{
    const val = e.target.value;
    if(!val) {
      state.workEnd = null;
      saveState();
      viewsModule.renderAll();
      return;
    }
    const v = timeToMinutes(val);
    if(v !== null){
      state.workEnd = v;

      if(state.activeEnv === 'work') {
        const dateStr = state.selectedDate || getTodayStr();
        const personalEnv = state.environments.personal;
        const dow = getDayOfWeek(dateStr);
        const personalSched = personalEnv.weeklySchedule;
        const isDerived = !personalSched || personalSched[dow] === undefined ||
          (personalSched[dow] && personalSched[dow].derived);
        if(isDerived) {
          if(!personalEnv.days[dateStr]) {
            personalEnv.days[dateStr] = { meetings: [], tasks: [], interruptions: [], planningMode: false };
          }
          personalEnv.days[dateStr].hasCustomHours = true;
          personalEnv.days[dateStr].workStart = v;
        }
      }

      saveState();
      viewsModule.renderAll();
    }
  });

  /* ---------------- Planning mode ---------------- */
  function togglePlanningMode(){
    state.planningMode = !state.planningMode;
    saveState();
    viewsModule.refreshPlanningModeBtn();
    viewsModule.renderAll();
    showToast(state.planningMode
      ? t("time.planningModeToastOn", { start: fmt(state.workStart) })
      : t("time.planningModeToastOff"));
  }

  const planningBtnEl = document.getElementById("planningModeBtn");
  if(planningBtnEl) planningBtnEl.addEventListener("click", togglePlanningMode);
  viewsModule.refreshPlanningModeBtn();

  document.getElementById("newDayBtn").addEventListener("click", actionsModule.startNewDay);
  const autoOrderBtnEl = document.getElementById("autoOrderBtn");
  if(autoOrderBtnEl) autoOrderBtnEl.addEventListener("click", actionsModule.applyAutoOrder);
  document.getElementById("notifyBtn").addEventListener("click", requestNotificationPermission);
  refreshNotifyBtn();

  const dpiEl = document.getElementById("datePickerInput");
  if(dpiEl){
    dpiEl.value = state.selectedDate || getTodayStr();
    dpiEl.addEventListener("change", (e) => actionsModule.selectDate(e.target.value));
  }

  const prevDayBtnEl = document.getElementById("prevDayBtn");
  if(prevDayBtnEl){
    prevDayBtnEl.addEventListener("click", () => actionsModule.changeDateByDays(-1));
  }

  const nextDayBtnEl = document.getElementById("nextDayBtn");
  if(nextDayBtnEl){
    nextDayBtnEl.addEventListener("click", () => actionsModule.changeDateByDays(1));
  }

  const todayBtnEl = document.getElementById("todayBtn");
  if(todayBtnEl){
    todayBtnEl.addEventListener("click", () => actionsModule.resetToToday());
  }

  document.getElementById("notifyIntervalInput").value = state.notifyIntervalMin;
  document.getElementById("notifyIntervalInput").addEventListener("change", (e)=>{
    const v = parseInt(e.target.value, 10);
    if(v && v > 0){
      state.notifyIntervalMin = v;
      saveState();
      showToast("Avisos configurados cada " + v + " min mientras haya una tarea en marcha.");
    } else {
      e.target.value = state.notifyIntervalMin;
    }
  });

  /* ---------------- Theme ---------------- */
  function applyTheme(mode){
    const themeMode = mode || state.themeMode || "auto";
    let activeTheme = themeMode;
    if(themeMode === "auto"){
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      activeTheme = prefersDark ? "dark" : "light";
    }
    if(activeTheme === "dark"){
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    if (pipModule && pipModule.syncTheme) {
      pipModule.syncTheme();
    }
  }

  if(window.matchMedia){
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if((state.themeMode || "auto") === "auto"){
        applyTheme("auto");
      }
    });
  }

  applyTheme();
  setLocale(state.language || "es");
  translateDOM();

  const themeSelectEl = document.getElementById("themeSelect");
  if(themeSelectEl){
    themeSelectEl.value = state.themeMode || "auto";
    themeSelectEl.addEventListener("change", (e)=>{
      state.themeMode = e.target.value;
      saveState();
      applyTheme(state.themeMode);
    });
  }

  const languageSelectEl = document.getElementById("languageSelect");
  if(languageSelectEl){
    languageSelectEl.value = state.language || "es";
    languageSelectEl.addEventListener("change", (e)=>{
      state.language = e.target.value;
      saveState();
      setLocale(state.language);
      translateDOM();
      if(cloudModule && cloudModule.renderAuthArea) cloudModule.renderAuthArea();
      viewsModule.renderAll();
      if(viewsModule.syncFormInputsFromState) viewsModule.syncFormInputsFromState();
    });
  }

  const autoBreakBtnEl = document.getElementById("autoBreakBtn");
  if(autoBreakBtnEl){
    autoBreakBtnEl.addEventListener("click", ()=>{
      state.autoBreakEnabled = !(state.autoBreakEnabled !== false);
      saveState();
      viewsModule.renderAll();
      showToast(state.autoBreakEnabled ? "Auto descansos activados." : "Auto descansos desactivados.");
    });
  }

  /* ---------------- Weekly Schedule sub-module ---------------- */
  TodayTasksWeeklySchedule({
    getState: () => state,
    saveState,
    viewsModule,
    fmt,
    timeToMinutes,
    showToast
  });

  /* ---------------- Forms sub-module ---------------- */
  TodayTasksForms({
    getState: () => state,
    actionsModule,
    showToast,
    fmt,
    timeToMinutes,
    setTaskSearchQuery: ctx.setTaskSearchQuery,
    renderTasks: ctx.renderTasks,
    renderAll: ctx.renderAll
  });

  /* ---------------- Summary accordion toggle ---------------- */
  if (typeof document !== "undefined") {
    const summaryToggleEl = document.getElementById("summaryToggle");
    if (summaryToggleEl) {
      summaryToggleEl.addEventListener("click", ()=>{
        const body = document.getElementById("summaryBody");
        const chevron = document.getElementById("summaryChevron");
        if (!body || !chevron) return;
        const isHidden = body.style.display === "none";
        body.style.display = isHidden ? "block" : "none";
        chevron.textContent = isHidden ? "▴" : "▾";
      });
    }

    /* ---------------- Other button wiring ---------------- */
    const intBtn = document.getElementById("interruptionBtn");
    if(intBtn){
      intBtn.addEventListener("click", actionsModule.startInterruption);
    }

    const historyLinkBtn = document.getElementById("historyLinkBtn");
    if(historyLinkBtn){
      historyLinkBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if(routerModule.getCurrentView() === 'history'){
          window.location.hash = '#/';
        } else {
          window.location.hash = '#/history';
        }
      });
    }

    const envBtnWork = document.getElementById("envBtnWork");
    const envBtnPersonal = document.getElementById("envBtnPersonal");
    if(envBtnWork) envBtnWork.addEventListener("click", () => actionsModule.switchEnvironment("work"));
    if(envBtnPersonal) envBtnPersonal.addEventListener("click", () => actionsModule.switchEnvironment("personal"));

    const pipBtn = document.getElementById("pipBtn");
    if(pipBtn) {
      pipBtn.addEventListener("click", () => {
        if(pipModule && pipModule.togglePiP) pipModule.togglePiP();
      });
    }
  }

  /* ---------------- Shortcuts sub-module ---------------- */
  TodayTasksShortcuts({
    getState: () => state,
    getMeetingEdit: () => meetingEdit,
    getTaskEdit: () => taskEdit,
    actionsModule,
    routerModule,
    viewsModule,
    pipModule,
    switchHeaderTab,
    togglePlanningMode,
    undoModule
  });

  /* ---------------- History metrics UI ---------------- */
  function toggleHistorySeries(key){
    const historyMod = TodayTasksHistory;
    if(historyMod && historyMod.toggleSeries){
      historyMod.toggleSeries(key);
      if(routerModule.getCurrentView() === 'history' && historyMod.renderHistoryView){
        historyMod.renderHistoryView(ctx);
      }
    }
  }

  function promptAddHistoryMetric(){
    if (typeof window === "undefined" || !window.prompt) return;
    const dateStr = window.prompt("Introduce la fecha en formato YYYY-MM-DD:", getTodayStr());
    if(!dateStr) return;
    const mStr = window.prompt("Tiempo de Reuniones (minutos):", "0");
    if(mStr === null) return;
    const cStr = window.prompt("Tiempo de Tareas Completadas (minutos):", "0");
    if(cStr === null) return;
    const wStr = window.prompt("Tiempo Trabajado en Pendientes (minutos):", "0");
    if(wStr === null) return;
    const nwStr = window.prompt("Tiempo No Trabajado en Pendientes (minutos):", "0");
    if(nwStr === null) return;
    const iStr = window.prompt("Tiempo de Interrupciones (minutos):", "0");
    if(iStr === null) return;

    actionsModule.saveHistoryMetric(dateStr.trim(), {
      meetingsTime: mStr,
      completedTasksTime: cStr,
      uncompletedTasksWorkedTime: wStr,
      uncompletedTasksNotWorkedTime: nwStr,
      interruptionsTime: iStr
    });
  }

  function editHistoryMetricPrompt(dateStr){
    if (typeof window === "undefined" || !window.prompt) return;
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || {};
    const existing = (env.history || []).find(h => h.date === dateStr) || {};

    const mStr = window.prompt(`[${dateStr}] Tiempo de Reuniones (minutos):`, String(existing.meetingsTime || 0));
    if(mStr === null) return;
    const cStr = window.prompt(`[${dateStr}] Tiempo de Tareas Completadas (minutos):`, String(existing.completedTasksTime || 0));
    if(cStr === null) return;
    const wStr = window.prompt(`[${dateStr}] Tiempo Trabajado en Pendientes (minutos):`, String(existing.uncompletedTasksWorkedTime || 0));
    if(wStr === null) return;
    const nwStr = window.prompt(`[${dateStr}] Tiempo No Trabajado en Pendientes (minutos):`, String(existing.uncompletedTasksNotWorkedTime || 0));
    if(nwStr === null) return;
    const iStr = window.prompt(`[${dateStr}] Tiempo de Interrupciones (minutos):`, String(existing.interruptionsTime || 0));
    if(iStr === null) return;

    actionsModule.saveHistoryMetric(dateStr, {
      meetingsTime: mStr,
      completedTasksTime: cStr,
      uncompletedTasksWorkedTime: wStr,
      uncompletedTasksNotWorkedTime: nwStr,
      interruptionsTime: iStr
    });
  }

  /* ---------------- Public API (window.app & export app) ---------------- */
  export const app = {
    undo: () => undoModule.undo(),
    redo: () => undoModule.redo(),
    togglePlanningMode,
    switchEnvironment: actionsModule.switchEnvironment,
    selectDate: actionsModule.selectDate,
    changeDateByDays: actionsModule.changeDateByDays,
    resetToToday: actionsModule.resetToToday,
    deleteMeeting: actionsModule.deleteMeeting,
    deleteTask: actionsModule.deleteTask,
    deleteRecurringTaskInstance: (ruleId, dateStr) => actionsModule.deleteRecurringTaskInstance && actionsModule.deleteRecurringTaskInstance(ruleId, dateStr),
    moveTask: actionsModule.moveTask,
    applyAutoOrder: actionsModule.applyAutoOrder,
    startTask: actionsModule.startTask,
    pauseTask: actionsModule.pauseTask,
    resumeTask: actionsModule.resumeTask,
    completeTask: actionsModule.completeTask,
    completeTasks: actionsModule.completeTasks,
    uncompleteTask: actionsModule.uncompleteTask,
    copyTaskToDate: actionsModule.copyTaskToDate,
    moveTaskToDate: actionsModule.moveTaskToDate,
    moveTasksToDate: actionsModule.moveTasksToDate,
    setTasksUrgency: actionsModule.setTasksUrgency,
    setTasksFeatured: actionsModule.setTasksFeatured,
    deleteTasks: actionsModule.deleteTasks,
    openCopyTaskModal: actionsModule.openCopyTaskModal,
    rolloverPendingTasksToDate: (dateStr) => actionsModule.rolloverPendingTasksToDate(dateStr),
    rolloverPendingTasksToSelectedDate: () => actionsModule.rolloverPendingTasksToDate(state.selectedDate),
    countPendingAutoMoveTasks: (dateStr) => actionsModule.countPendingAutoMoveTasks(dateStr),
    startInterruption: actionsModule.startInterruption,
    updateInterruptionTitle: actionsModule.updateInterruptionTitle,
    completeInterruption: actionsModule.completeInterruption,
    cancelInterruption: actionsModule.cancelInterruption,
    startEditMeeting: actionsModule.startEditMeeting,
    updateMeetingEditField: actionsModule.updateMeetingEditField,
    cancelEditMeeting: actionsModule.cancelEditMeeting,
    saveEditMeeting: actionsModule.saveEditMeeting,
    startEditTask: actionsModule.startEditTask,
    updateTaskEditField: actionsModule.updateTaskEditField,
    updateTaskTimeFast: actionsModule.updateTaskTimeFast,
    cancelEditTask: actionsModule.cancelEditTask,
    saveEditTask: actionsModule.saveEditTask,
    armTaskDrag: actionsModule.armTaskDrag,
    taskDragStart: actionsModule.taskDragStart,
    taskDragOver: actionsModule.taskDragOver,
    taskDragLeave: actionsModule.taskDragLeave,
    taskDrop: actionsModule.taskDrop,
    taskDragEnd: actionsModule.taskDragEnd,
    toggleHistorySeries,
    promptAddHistoryMetric,
    editHistoryMetricPrompt,
    deleteHistoryMetric: actionsModule.deleteHistoryMetric,
    restoreLocalBackup: cloudModule.restoreLocalBackup,
    scrollToElement,
    /* Triage View */
    renderTriageView: () => viewsModule && viewsModule.renderTriageView && viewsModule.renderTriageView(),
    setTriageSortMode: (mode) => viewsModule && viewsModule.setTriageSortMode && viewsModule.setTriageSortMode(mode),
    toggleTriageGroup: (groupId) => viewsModule && viewsModule.toggleTriageGroup && viewsModule.toggleTriageGroup(groupId),
    toggleAllTriageGroups: (open) => viewsModule && viewsModule.toggleAllTriageGroups && viewsModule.toggleAllTriageGroups(open),
    handleTriageRowClick: (taskId, event) => viewsModule && viewsModule.handleTriageRowClick && viewsModule.handleTriageRowClick(taskId, event),
    handleTriageRowDblClick: (taskId, event) => viewsModule && viewsModule.handleTriageRowDblClick && viewsModule.handleTriageRowDblClick(taskId, event),
    toggleTriageTaskSelect: (taskId, event) => viewsModule && viewsModule.toggleTriageTaskSelect && viewsModule.toggleTriageTaskSelect(taskId, event),
    toggleTriageGroupSelect: (groupId, event) => viewsModule && viewsModule.toggleTriageGroupSelect && viewsModule.toggleTriageGroupSelect(groupId, event),
    clearTriageSelection: () => viewsModule && viewsModule.clearTriageSelection && viewsModule.clearTriageSelection(),
    toggleTriageTaskStar: (taskId, event) => viewsModule && viewsModule.toggleTriageTaskStar && viewsModule.toggleTriageTaskStar(taskId, event),
    moveTriageTaskToDate: (taskId, targetDateStr, friendlyLabel, event) => viewsModule && viewsModule.moveTriageTaskToDate && viewsModule.moveTriageTaskToDate(taskId, targetDateStr, friendlyLabel, event),
    completeTriageSingleTask: (taskId, event) => viewsModule && viewsModule.completeTriageSingleTask && viewsModule.completeTriageSingleTask(taskId, event),
    deleteTriageSingleTask: (taskId, event) => viewsModule && viewsModule.deleteTriageSingleTask && viewsModule.deleteTriageSingleTask(taskId, event),
    openTriageSingleUrgency: (taskId, event) => viewsModule && viewsModule.openTriageSingleUrgency && viewsModule.openTriageSingleUrgency(taskId, event),
    applyTriageSingleUrgency: (urgency) => viewsModule && viewsModule.applyTriageSingleUrgency && viewsModule.applyTriageSingleUrgency(urgency),
    closeTriagePopovers: () => viewsModule && viewsModule.closeTriagePopovers && viewsModule.closeTriagePopovers(),
    executeTriageMoveSelectedDate: (targetDateStr) => viewsModule && viewsModule.executeTriageMoveSelectedDate && viewsModule.executeTriageMoveSelectedDate(targetDateStr),
    executeTriageBatchUrgency: (urgency) => viewsModule && viewsModule.executeTriageBatchUrgency && viewsModule.executeTriageBatchUrgency(urgency),
    executeTriageBatchStar: (enable) => viewsModule && viewsModule.executeTriageBatchStar && viewsModule.executeTriageBatchStar(enable),
    executeTriageBatchComplete: () => viewsModule && viewsModule.executeTriageBatchComplete && viewsModule.executeTriageBatchComplete(),
    executeTriageBatchDelete: () => viewsModule && viewsModule.executeTriageBatchDelete && viewsModule.executeTriageBatchDelete(),
    toggleTriageDropdown: (dropdownId, event) => viewsModule && viewsModule.toggleTriageDropdown && viewsModule.toggleTriageDropdown(dropdownId, event),
    openTimePopover: function(taskId, event) {
      try {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        this.currentPopoverTaskId = taskId;
        const overlay = document.getElementById('timePopoverOverlay');
        const popover = document.getElementById('timePopover');
        const input = document.getElementById('timePopoverInput');
        if (!overlay || !popover || !input) return;

        const currentState = state;
        const t = (currentState.tasks || []).find(t => String(t.id) === String(taskId));
        if(!t) return;

        const actual = getTaskElapsed(t);
        input.value = actual;

        overlay.style.display = 'block';
        popover.style.display = 'flex';

        let target = null;
        if (event) {
          if (event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
            target = event.currentTarget;
          } else if (event.target && typeof event.target.getBoundingClientRect === 'function') {
            target = event.target;
          }
        }

        const popWidth = 220;
        let left = Math.max(10, (window.innerWidth - popWidth) / 2);
        let top = Math.max(10, (window.innerHeight - 120) / 2);

        if (target) {
          const rect = target.getBoundingClientRect();
          if (rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0)) {
            left = rect.left;
            top = rect.bottom + 6;
            if (left + popWidth > window.innerWidth - 10) {
              left = window.innerWidth - popWidth - 10;
            }
            if (left < 10) left = 10;

            if (top + 110 > window.innerHeight && rect.top > 110) {
              top = rect.top - 95;
            }
          }
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        setTimeout(() => {
          input.focus();
          input.select();
        }, 50);
      } catch (err) {
        console.error("Error in openTimePopover:", err);
      }
    },
    closeTimePopover: function() {
      const overlay = document.getElementById('timePopoverOverlay');
      const popover = document.getElementById('timePopover');
      if (overlay) overlay.style.display = 'none';
      if (popover) popover.style.display = 'none';
      this.currentPopoverTaskId = null;
    },
    saveTimePopover: function() {
      if(!this.currentPopoverTaskId) return;
      const input = document.getElementById('timePopoverInput');
      actionsModule.updateTaskTimeFast(this.currentPopoverTaskId, input.value);
      this.closeTimePopover();
    },
    openStartAfterPopover: function(taskId, event) {
      try {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        this._isFormStartAfter = false;
        this.currentStartAfterTaskId = taskId;
        const overlay = document.getElementById('startAfterPopoverOverlay');
        const popover = document.getElementById('startAfterPopover');
        const input = document.getElementById('startAfterPopoverInput');
        if (!overlay || !popover || !input) return;

        const currentState = state;
        const t = (currentState.tasks || []).find(t => String(t.id) === String(taskId));
        if(!t) return;

        input.value = (t.startAfter !== null && t.startAfter !== undefined) ? fmt(t.startAfter) : '';

        overlay.style.display = 'block';
        popover.style.display = 'flex';

        let target = null;
        if (event) {
          if (event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
            target = event.currentTarget;
          } else if (event.target && typeof event.target.getBoundingClientRect === 'function') {
            target = event.target;
          }
        }

        const popWidth = 230;
        let left = Math.max(10, (window.innerWidth - popWidth) / 2);
        let top = Math.max(10, (window.innerHeight - 140) / 2);

        if (target) {
          const rect = target.getBoundingClientRect();
          if (rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0)) {
            left = rect.left;
            top = rect.bottom + 6;
            if (left + popWidth > window.innerWidth - 10) {
              left = window.innerWidth - popWidth - 10;
            }
            if (left < 10) left = 10;

            if (top + 130 > window.innerHeight && rect.top > 130) {
              top = rect.top - 120;
            }
          }
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        setTimeout(() => {
          input.focus();
        }, 50);
      } catch (err) {
        console.error("Error in openStartAfterPopover:", err);
      }
    },
    closeStartAfterPopover: function() {
      const overlay = document.getElementById('startAfterPopoverOverlay');
      const popover = document.getElementById('startAfterPopover');
      if (overlay) overlay.style.display = 'none';
      if (popover) popover.style.display = 'none';
      this.currentStartAfterTaskId = null;
    },
    saveStartAfterPopover: function() {
      if(!this.currentStartAfterTaskId) return;
      const input = document.getElementById('startAfterPopoverInput');
      const val = input ? input.value : '';
      actionsModule.setTaskStartAfter(this.currentStartAfterTaskId, val || null);
      this.closeStartAfterPopover();
    },
    clearStartAfterPopover: function() {
      if(!this.currentStartAfterTaskId) return;
      actionsModule.setTaskStartAfter(this.currentStartAfterTaskId, null);
      this.closeStartAfterPopover();
    },
    openRecurringInfoPopover: function(entityId, event, type = 'task') {
      try {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        this.currentRecurringEntityId = entityId;
        this.currentRecurringEntityType = type;

        const overlay = document.getElementById('recurringInfoPopoverOverlay');
        const popover = document.getElementById('recurringInfoPopover');
        if (!overlay || !popover) return;

        const currentState = state;
        const envKey = currentState.activeEnv || 'work';
        const env = currentState.environments ? (currentState.environments[envKey] || currentState.environments.work) : null;
        if (!env) return;

        let entity = null;
        let rule = null;
        const isTask = (type === 'task');

        if (isTask) {
          entity = (currentState.tasks || []).find(t => String(t.id) === String(entityId));
          if (entity && entity.ruleId && Array.isArray(env.recurringTasks)) {
            rule = env.recurringTasks.find(r => String(r.id) === String(entity.ruleId));
          }
        } else {
          entity = (currentState.meetings || []).find(m => String(m.id) === String(entityId));
          if (entity && entity.ruleId && Array.isArray(env.recurringMeetings)) {
            rule = env.recurringMeetings.find(r => String(r.id) === String(entity.ruleId));
          }
        }

        if (!rule) {
          rule = {
            title: entity ? entity.title : 'Elemento recurrente',
            freq: 'daily',
            interval: 1,
            startDate: currentState.selectedDate || getTodayStr()
          };
        }

        const formatted = formatRecurrenceRule(rule);
        const headingEl = document.getElementById('recurringPopoverHeading');
        const titleEl = document.getElementById('recurringPopoverTitle');
        const freqEl = document.getElementById('recurringPopoverFreq');
        const daysEl = document.getElementById('recurringPopoverDays');
        const datesEl = document.getElementById('recurringPopoverDates');
        const statusBadgeEl = document.getElementById('recurringPopoverStatusBadge');

        if (headingEl) headingEl.textContent = isTask ? 'Regla de tarea recurrente' : 'Regla de reunión recurrente';
        if (titleEl) titleEl.textContent = rule.title || (entity ? entity.title : '—');
        if (freqEl) freqEl.textContent = formatted.intervalText || formatted.freqText;
        if (daysEl) daysEl.textContent = formatted.daysText;
        if (datesEl) datesEl.textContent = formatted.dateRangeText;

        if (statusBadgeEl) {
          const isModified = entity && entity.isModifiedInstance;
          if (isModified) {
            statusBadgeEl.textContent = '✎ Ocurrencia modificada hoy';
            statusBadgeEl.className = 'rec-pop-status-badge modified';
          } else {
            statusBadgeEl.textContent = '✓ Ocurrencia sincronizada con la serie';
            statusBadgeEl.className = 'rec-pop-status-badge';
          }
        }

        const viewModeEl = document.getElementById('recurringPopoverViewMode');
        const editModeEl = document.getElementById('recurringPopoverEditMode');
        if (viewModeEl) viewModeEl.style.display = 'flex';
        if (editModeEl) editModeEl.style.display = 'none';

        overlay.style.display = 'block';
        popover.style.display = 'flex';

        let target = null;
        if (event) {
          if (event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
            target = event.currentTarget;
          } else if (event.target && typeof event.target.getBoundingClientRect === 'function') {
            target = event.target;
          }
        }

        const popWidth = 300;
        let left = Math.max(10, (window.innerWidth - popWidth) / 2);
        let top = Math.max(10, (window.innerHeight - 250) / 2);

        if (target) {
          const rect = target.getBoundingClientRect();
          if (rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0)) {
            left = rect.left;
            top = rect.bottom + 6;
            if (left + popWidth > window.innerWidth - 10) {
              left = window.innerWidth - popWidth - 10;
            }
            if (left < 10) left = 10;

            if (top + 270 > window.innerHeight && rect.top > 270) {
              top = rect.top - 260;
            }
          }
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
      } catch (err) {
        console.error("Error in openRecurringInfoPopover:", err);
      }
    },
    closeRecurringInfoPopover: function() {
      const overlay = document.getElementById('recurringInfoPopoverOverlay');
      const popover = document.getElementById('recurringInfoPopover');
      if (overlay) overlay.style.display = 'none';
      if (popover) popover.style.display = 'none';
      this.currentRecurringEntityId = null;
      this.currentRecurringEntityType = null;
      this._popoverSelectedDays = [];
    },
    toggleEditRecurrenceInPopover: function(showEdit) {
      const viewModeEl = document.getElementById('recurringPopoverViewMode');
      const editModeEl = document.getElementById('recurringPopoverEditMode');
      if (!viewModeEl || !editModeEl) return;

      if (!showEdit) {
        viewModeEl.style.display = 'flex';
        editModeEl.style.display = 'none';
        return;
      }

      const currentState = state;
      const envKey = currentState.activeEnv || 'work';
      const env = currentState.environments ? (currentState.environments[envKey] || currentState.environments.work) : null;
      if (!env) return;

      const entityId = this.currentRecurringEntityId;
      const isTask = (this.currentRecurringEntityType === 'task');
      let entity = null;
      let rule = null;

      if (isTask) {
        entity = (currentState.tasks || []).find(t => String(t.id) === String(entityId));
        if (entity && entity.ruleId && Array.isArray(env.recurringTasks)) {
          rule = env.recurringTasks.find(r => String(r.id) === String(entity.ruleId));
        }
      } else {
        entity = (currentState.meetings || []).find(m => String(m.id) === String(entityId));
        if (entity && entity.ruleId && Array.isArray(env.recurringMeetings)) {
          rule = env.recurringMeetings.find(r => String(r.id) === String(entity.ruleId));
        }
      }

      if (!rule) return;

      const freqSelect = document.getElementById('recPopEditFreq');
      const intervalInput = document.getElementById('recPopEditInterval');
      const endDateInput = document.getElementById('recPopEditEndDate');

      const freq = rule.freq || (Array.isArray(rule.daysOfWeek) ? 'weekly' : 'daily');
      if (freqSelect) freqSelect.value = freq;
      if (intervalInput) intervalInput.value = rule.interval || 1;
      if (endDateInput) endDateInput.value = rule.endDate || '';

      this._popoverSelectedDays = Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0
        ? [...rule.daysOfWeek]
        : [1];

      this._updateRecurrencePopoverDayButtons();
      this.onRecurrencePopoverFreqChange(freq);

      viewModeEl.style.display = 'none';
      editModeEl.style.display = 'flex';
    },
    onRecurrencePopoverFreqChange: function(freq) {
      const unitLabel = document.getElementById('recPopEditIntervalUnit');
      const daysWrap = document.getElementById('recPopEditDaysWrap');
      if (unitLabel) {
        unitLabel.textContent = freq === 'daily' ? 'día(s)' : 'semana(s)';
      }
      if (daysWrap) {
        daysWrap.style.display = freq === 'daily' ? 'none' : 'block';
      }
    },
    toggleRecurrencePopoverDay: function(dayNum) {
      if (!Array.isArray(this._popoverSelectedDays)) this._popoverSelectedDays = [1];
      const d = parseInt(dayNum, 10);
      if (this._popoverSelectedDays.includes(d)) {
        if (this._popoverSelectedDays.length > 1) {
          this._popoverSelectedDays = this._popoverSelectedDays.filter(x => x !== d);
        }
      } else {
        this._popoverSelectedDays.push(d);
        this._popoverSelectedDays.sort((a, b) => a - b);
      }
      this._updateRecurrencePopoverDayButtons();
    },
    _updateRecurrencePopoverDayButtons: function() {
      const selected = this._popoverSelectedDays || [];
      const buttons = document.querySelectorAll('#recPopEditDaysWrap .rec-pop-day-btn');
      buttons.forEach(btn => {
        const day = parseInt(btn.getAttribute('data-day'), 10);
        if (selected.includes(day)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    },
    saveRecurrenceFromPopover: function() {
      const entityId = this.currentRecurringEntityId;
      const isTask = (this.currentRecurringEntityType === 'task');
      if (!entityId) return;

      const currentState = state;
      const envKey = currentState.activeEnv || 'work';
      const env = currentState.environments ? (currentState.environments[envKey] || currentState.environments.work) : null;
      if (!env) return;

      let entity = null;
      let rule = null;

      if (isTask) {
        entity = (currentState.tasks || []).find(t => String(t.id) === String(entityId));
        if (entity && entity.ruleId && Array.isArray(env.recurringTasks)) {
          rule = env.recurringTasks.find(r => String(r.id) === String(entity.ruleId));
        }
      } else {
        entity = (currentState.meetings || []).find(m => String(m.id) === String(entityId));
        if (entity && entity.ruleId && Array.isArray(env.recurringMeetings)) {
          rule = env.recurringMeetings.find(r => String(r.id) === String(entity.ruleId));
        }
      }

      if (!rule) return;

      const freqSelect = document.getElementById('recPopEditFreq');
      const intervalInput = document.getElementById('recPopEditInterval');
      const endDateInput = document.getElementById('recPopEditEndDate');

      const newFreq = freqSelect ? freqSelect.value : 'weekly';
      const newInterval = intervalInput ? Math.max(1, parseInt(intervalInput.value, 10) || 1) : 1;
      const newDays = newFreq === 'daily'
        ? [1, 2, 3, 4, 5, 6, 7]
        : (Array.isArray(this._popoverSelectedDays) && this._popoverSelectedDays.length > 0 ? this._popoverSelectedDays : [1]);
      const newEndDate = (endDateInput && endDateInput.value && endDateInput.value.trim()) ? endDateInput.value.trim() : null;

      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(`Modificar patrón recurrente de "${rule.title}"`);
      }

      rule.freq = newFreq;
      rule.interval = newInterval;
      rule.daysOfWeek = newDays;
      rule.endDate = newEndDate;

      if (isTask) {
        // Limpiar ocurrencias pendientes no iniciadas de días que ya no coincidan con la regla modificada
        if (env.days) {
          Object.entries(env.days).forEach(([dStr, dayObj]) => {
            if (dayObj && Array.isArray(dayObj.tasks)) {
              const matches = matchesRecurrenceRule(rule, dStr);
              if (!matches) {
                dayObj.tasks = dayObj.tasks.filter(t => !(String(t.ruleId) === String(rule.id) && t.status === "pending" && (t.elapsedBefore || 0) === 0));
              }
            }
          });
        }
        if (actionsModule && actionsModule.materializeRecurringTasks) {
          actionsModule.materializeRecurringTasks();
        }
      }

      this.closeRecurringInfoPopover();
      saveState();
      viewsModule.renderAll();
      showToast(`Regla de recurrencia actualizada 🔁 (${formatRecurrenceRule(rule).summaryText})`);
    },
    toggleTaskFormRecurrenceDay: function(dayNum) {
      const d = parseInt(dayNum, 10);
      const cb = document.getElementById(`recTaskDayCb${d}`);
      const btn = document.querySelector(`#recTaskDaysRow .rec-pop-day-btn[data-day="${d}"]`);
      if (!cb || !btn) return;
      
      const allCbs = document.querySelectorAll('.rec-task-day-cb:checked');
      if (cb.checked && allCbs.length <= 1) {
        return;
      }
      
      cb.checked = !cb.checked;
      btn.classList.toggle('active', cb.checked);
    },
    toggleMeetingFormRecurrenceDay: function(dayNum) {
      const d = parseInt(dayNum, 10);
      const cb = document.getElementById(`recDayCb${d}`);
      const btn = document.querySelector(`#recMeetingDaysRow .rec-pop-day-btn[data-day="${d}"]`);
      if (!cb || !btn) return;
      
      const allCbs = document.querySelectorAll('.rec-day-cb:checked');
      if (cb.checked && allCbs.length <= 1) {
        return;
      }
      
      cb.checked = !cb.checked;
      btn.classList.toggle('active', cb.checked);
    },
    updateTaskAdvancedIndicators: function() {
      const autoMoveCb = document.getElementById('isAutoMoveTaskCheckbox');
      const recCb = document.getElementById('isRecurringTaskCheckbox');
      const startAfterInput = document.getElementById('taskStartAfterInput');
      const notesInput = document.getElementById('taskNotesInput');

      const autoMoveBadge = document.getElementById('formAutoMoveBadge');
      const recBadge = document.getElementById('formRecurringBadge');
      const startAfterBadge = document.getElementById('formStartAfterBadge');
      const notesBadge = document.getElementById('formNotesBadge');

      if (autoMoveBadge) {
        autoMoveBadge.style.display = (autoMoveCb && autoMoveCb.checked && (!recCb || !recCb.checked)) ? 'inline-flex' : 'none';
      }
      if (recBadge) {
        recBadge.style.display = (recCb && recCb.checked) ? 'inline-flex' : 'none';
      }
      if (startAfterBadge) {
        const val = startAfterInput ? startAfterInput.value.trim() : '';
        if (val) {
          startAfterBadge.textContent = val + '+';
          startAfterBadge.style.display = 'inline-flex';
        } else {
          startAfterBadge.style.display = 'none';
        }
      }
      if (notesBadge) {
        const val = notesInput ? notesInput.value.trim() : '';
        notesBadge.style.display = val ? 'inline-flex' : 'none';
      }
    },
    insertFormNotesFormat: function(prefix, suffix) {
      const textarea = document.getElementById('taskNotesInput');
      if (!textarea) return;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const val = textarea.value || '';
      const selected = val.substring(start, end) || 'texto';
      textarea.value = val.substring(0, start) + prefix + selected + suffix + val.substring(end);
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
      this.updateTaskAdvancedIndicators();
    },
    insertFormNotesLink: function() {
      const textarea = document.getElementById('taskNotesInput');
      if (!textarea) return;
      const url = (typeof window !== "undefined" && window.prompt) ? window.prompt('Introduce la URL (ej: https://...):', 'https://') : 'https://';
      if (!url) return;
      const title = (typeof window !== "undefined" && window.prompt) ? (window.prompt('Texto del enlace (opcional):', 'Enlace') || 'Enlace') : 'Enlace';
      const start = textarea.selectionStart || 0;
      const val = textarea.value || '';
      const linkMd = `[${title}](${url})`;
      textarea.value = val.substring(0, start) + linkMd + val.substring(start);
      textarea.focus();
      this.updateTaskAdvancedIndicators();
    },
    insertEditNotesFormat: function(taskId, prefix, suffix) {
      const textarea = document.getElementById(`task-edit-notes-${taskId}`);
      if (!textarea) return;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const val = textarea.value || '';
      const selected = val.substring(start, end) || 'texto';
      textarea.value = val.substring(0, start) + prefix + selected + suffix + val.substring(end);
      actionsModule.updateTaskEditField('notes', textarea.value);
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    },
    insertEditNotesLink: function(taskId) {
      const textarea = document.getElementById(`task-edit-notes-${taskId}`);
      if (!textarea) return;
      const url = (typeof window !== "undefined" && window.prompt) ? window.prompt('Introduce la URL (ej: https://...):', 'https://') : 'https://';
      if (!url) return;
      const title = (typeof window !== "undefined" && window.prompt) ? (window.prompt('Texto del enlace (opcional):', 'Enlace') || 'Enlace') : 'Enlace';
      const start = textarea.selectionStart || 0;
      const val = textarea.value || '';
      const linkMd = `[${title}](${url})`;
      textarea.value = val.substring(0, start) + linkMd + val.substring(start);
      actionsModule.updateTaskEditField('notes', textarea.value);
      textarea.focus();
    },
    toggleEditNotesPreview: function(taskId) {
      const textarea = document.getElementById(`task-edit-notes-${taskId}`);
      const preview = document.getElementById(`task-edit-notes-preview-${taskId}`);
      const btn = document.getElementById(`btn-preview-edit-${taskId}`);
      if (!textarea || !preview) return;
      const isHidden = preview.style.display === 'none';
      if (isHidden) {
        preview.innerHTML = renderNotesMarkdown(textarea.value || '');
        preview.style.display = 'block';
        textarea.style.display = 'none';
        if (btn) btn.textContent = '✏️';
      } else {
        preview.style.display = 'none';
        textarea.style.display = 'block';
        if (btn) btn.textContent = '👁️';
      }
    },
    toggleTaskNotes: function(taskId, event) {
      if (viewsModule && viewsModule.toggleTaskNotes) {
        viewsModule.toggleTaskNotes(taskId, event);
      }
    },
    onFormStartAfterChange: function(val) {
      this.updateTaskAdvancedIndicators();
    },
    clearFormStartAfterDirect: function() {
      const input = document.getElementById('taskStartAfterInput');
      if (input) {
        input.value = '';
        input.focus();
      }
      this.updateTaskAdvancedIndicators();
    },
    toggleTaskAdvancedOptions: function() {
      const wrap = document.getElementById('taskAdvancedOptionsWrap');
      const btn = document.getElementById('taskAdvancedToggleBtn');
      const chevron = document.getElementById('taskAdvancedChevron');
      if (!wrap) return;
      const isOpen = wrap.style.display === 'block';
      wrap.style.display = isOpen ? 'none' : 'block';
      if (btn) btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    },
    setTaskStartAfter: actionsModule.setTaskStartAfter,
    setTaskUrgency: actionsModule.setTaskUrgency,
    setTaskFeatured: actionsModule.setTaskFeatured,
    toggleTaskFeatured: actionsModule.toggleTaskFeatured,
    resolveFeaturedLimit: actionsModule.resolveFeaturedLimit,
    /* Open the shared urgency dropdown anchored to the edit-form pill */
    openEditUrgencyDropdown: function(taskId, event) {
      this._editUrgencyTaskId = taskId;
      this._formUrgencyMode = false;
      this.currentUrgencyTaskId = null;
      this.openUrgencyDropdown('__edit__', event);
      // override task lookup to highlight current taskEdit urgency
      const dropdown = document.getElementById('urgencyDropdownMenu');
      if (dropdown) {
        const taskEdit = typeof ctx.getTaskEdit === 'function' ? ctx.getTaskEdit() : null;
        const currentUrgency = (taskEdit && taskEdit.urgency) || (state.tasks || []).find(x => String(x.id) === String(taskId))?.urgency || 'days';
        dropdown.querySelectorAll('.urgency-option-item').forEach(item => {
          item.classList.toggle('active', item.dataset.urgency === currentUrgency);
        });
      }
    },
    toggleEditFeatured: function(taskId, event) {
      try {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        const taskEdit = typeof ctx.getTaskEdit === 'function' ? ctx.getTaskEdit() : null;
        if (taskEdit) {
          taskEdit.featured = !taskEdit.featured;
          const starBtn = (event && (event.currentTarget || event.target)) || document.querySelector(`#task-item-${taskId} .star-btn`) || document.querySelector(`.triage-edit-modal-box .star-btn`);
          if (starBtn) {
            starBtn.classList.toggle('is-featured', taskEdit.featured);
            starBtn.textContent = taskEdit.featured ? '⭐' : '☆';
            starBtn.title = taskEdit.featured ? 'Quitar destacado' : 'Marcar como destacada (máx. 5 al día)';
          }
        } else {
          actionsModule.toggleTaskFeatured(taskId);
        }
      } catch (err) {
        console.error("Error in toggleEditFeatured:", err);
      }
    },
    openUrgencyDropdown: function(taskId, event) {
      try {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        this.currentUrgencyTaskId = taskId;
        const dropdown = document.getElementById('urgencyDropdownMenu');
        const overlay = document.getElementById('urgencyDropdownOverlay');
        if (!dropdown) return;

        const currentState = state;
        const t = (currentState.tasks || []).find(x => String(x.id) === String(taskId));
        const currentUrgency = t ? (t.urgency || "days") : "days";

        // Highlight selected urgency item in menu
        dropdown.querySelectorAll('.urgency-option-item').forEach(item => {
          const val = item.dataset.urgency;
          item.classList.toggle('active', val === currentUrgency);
        });

        if (overlay) overlay.style.display = 'block';
        dropdown.style.display = 'block';

        let target = null;
        if (event) {
          if (event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
            target = event.currentTarget;
          } else if (event.target && typeof event.target.getBoundingClientRect === 'function') {
            target = event.target;
          }
        }

        const menuWidth = 170;
        let left = Math.max(10, (window.innerWidth - menuWidth) / 2);
        let top = Math.max(10, (window.innerHeight - 180) / 2);

        if (target) {
          const rect = target.getBoundingClientRect();
          if (rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0)) {
            left = rect.left;
            top = rect.bottom + 4;
            if (left + menuWidth > window.innerWidth - 10) {
              left = window.innerWidth - menuWidth - 10;
            }
            if (left < 10) left = 10;
            if (top + 180 > window.innerHeight && rect.top > 180) {
              top = rect.top - 180;
            }
          }
        }

        dropdown.style.position = 'fixed';
        dropdown.style.left = `${left}px`;
        dropdown.style.top = `${top}px`;
      } catch (err) {
        console.error("Error in openUrgencyDropdown:", err);
      }
    },
    selectTaskUrgency: function(urgency) {
      if (this._formUrgencyMode) {
        // Update the new-task form pill
        this._formUrgencyMode = false;
        const hiddenInput = document.getElementById('taskUrgencySelect');
        if (hiddenInput) hiddenInput.value = urgency;
        const pill = document.getElementById('formUrgencyPill');
        const iconEl = document.getElementById('formUrgencyIcon');
        const labelEl = document.getElementById('formUrgencyLabel');
        const urgencyMap = { today: { icon: '🟠', label: 'Hoy', cls: 'urgency-btn-today' }, days: { icon: '🔵', label: 'Días', cls: 'urgency-btn-days' }, week: { icon: '🟣', label: 'Semana', cls: 'urgency-btn-week' }, later: { icon: '⚪', label: 'Más adelante', cls: 'urgency-btn-later' } };
        const info = urgencyMap[urgency] || urgencyMap.days;
        if (pill) { pill.className = `urgency-pill-btn ${info.cls}`; pill.setAttribute('aria-label', `Urgencia ${info.label}`); }
        if (iconEl) iconEl.textContent = info.icon;
        if (labelEl) labelEl.textContent = info.label;
      } else if (this._editUrgencyTaskId) {
        const editId = this._editUrgencyTaskId;
        actionsModule.updateTaskEditField('urgency', urgency);
        this._editUrgencyTaskId = null;
        const pill = document.getElementById(`edit-urgency-pill-${editId}`);
        if (pill) {
          const urgencyMap = {
            today: { icon: '🟠', label: 'Hoy', cls: 'urgency-btn-today' },
            days: { icon: '🔵', label: 'Días', cls: 'urgency-btn-days' },
            week: { icon: '🟣', label: 'Semana', cls: 'urgency-btn-week' },
            later: { icon: '⚪', label: 'Más adelante', cls: 'urgency-btn-later' }
          };
          const info = urgencyMap[urgency] || urgencyMap.days;
          pill.className = `urgency-pill-btn ${info.cls}`;
          pill.setAttribute('aria-label', `Urgencia ${info.label}`);
          pill.innerHTML = `<span>${info.icon}</span> <span>${info.label}</span> <span class="urgency-pill-chevron">▾</span>`;
        }
      } else if (this.currentUrgencyTaskId) {
        actionsModule.setTaskUrgency(this.currentUrgencyTaskId, urgency);
      }
      this.closeUrgencyDropdown();
    },
    openFormUrgencyDropdown: function(event) {
      try {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        this._formUrgencyMode = true;
        this.currentUrgencyTaskId = null;
        const dropdown = document.getElementById('urgencyDropdownMenu');
        const overlay = document.getElementById('urgencyDropdownOverlay');
        if (!dropdown) return;

        // Highlight current form urgency
        const currentUrgency = (document.getElementById('taskUrgencySelect') || {}).value || 'days';
        dropdown.querySelectorAll('.urgency-option-item').forEach(item => {
          item.classList.toggle('active', item.dataset.urgency === currentUrgency);
        });

        if (overlay) overlay.style.display = 'block';
        dropdown.style.display = 'block';

        const menuWidth = 170;
        let left = Math.max(10, (window.innerWidth - menuWidth) / 2);
        let top = Math.max(10, (window.innerHeight - 180) / 2);
        if (event && event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0)) {
            left = rect.left;
            top = rect.bottom + 4;
            if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
            if (left < 10) left = 10;
            if (top + 180 > window.innerHeight && rect.top > 180) top = rect.top - 180;
          }
        }
        dropdown.style.left = `${left + window.scrollX}px`;
        dropdown.style.top = `${top + window.scrollY}px`;
      } catch (err) {
        console.error("Error in openFormUrgencyDropdown:", err);
      }
    },
    toggleFormFeatured: function(event) {
      try {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        const hiddenInput = document.getElementById('isFeaturedTaskCheckbox');
        const starBtn = document.getElementById('formFeaturedStarBtn');
        const currentVal = hiddenInput ? hiddenInput.value === 'true' : false;
        const newVal = !currentVal;

        if (newVal) {
          // Check the featured limit (only active/non-completed tasks)
          const currentState = state;
          const featuredCount = (currentState.tasks || []).filter(t => t.status !== 'completed' && t.featured).length;
          if (featuredCount >= 5) {
            if (actionsModule && actionsModule.showFeaturedLimitModal) {
              actionsModule.showFeaturedLimitModal(null, (unfeatureId) => {
                actionsModule.setTaskFeatured(unfeatureId, false);
                if (hiddenInput) hiddenInput.value = 'true';
                if (starBtn) {
                  starBtn.textContent = '⭐';
                  starBtn.classList.add('is-featured');
                  starBtn.title = 'Quitar destacado';
                }
              });
            }
            return;
          }
        }

        if (hiddenInput) hiddenInput.value = String(newVal);
        if (starBtn) {
          starBtn.textContent = newVal ? '⭐' : '☆';
          starBtn.classList.toggle('is-featured', newVal);
          starBtn.title = newVal ? 'Quitar destacado' : 'Marcar como destacada (máx. 5 al día)';
        }
      } catch (err) {
        console.error("Error in toggleFormFeatured:", err);
      }
    },
    closeUrgencyDropdown: function() {
      const dropdown = document.getElementById('urgencyDropdownMenu');
      const overlay = document.getElementById('urgencyDropdownOverlay');
      if (dropdown) dropdown.style.display = 'none';
      if (overlay) overlay.style.display = 'none';
      this.currentUrgencyTaskId = null;
    },
    setTaskSearch: function(query) {
      taskSearchQuery = typeof query === "string" ? query : "";
      const input = document.getElementById("taskSearchInput");
      if (input && input.value !== taskSearchQuery) {
        input.value = taskSearchQuery;
      }
      const clearBtn = document.getElementById("taskSearchClearBtn");
      if (clearBtn) {
        clearBtn.style.display = taskSearchQuery ? "block" : "none";
      }
      const schedule = computeScheduleFn();
      viewsModule.renderTasks(schedule);
    },
    clearTaskSearch: function() {
      this.setTaskSearch("");
      const input = document.getElementById("taskSearchInput");
      if (input) {
        input.focus();
      }
    },
    versionSync: versionSyncModule,
    togglePiP: () => pipModule && pipModule.togglePiP(),
    openPiP: () => pipModule && pipModule.openPiP(),
    closePiP: () => pipModule && pipModule.closePiP(),
    isPiPOpen: () => pipModule && pipModule.isOpen(),
    pip: pipModule
  };

  if (typeof window !== "undefined") {
    window.app = app;
  }

  /* ---------------- Lifecycle ---------------- */
  if (typeof window !== "undefined") {
    window.addEventListener('hashchange', routerModule.router);
    window.addEventListener('beforeunload', () => {
      if(cloudModule && cloudModule.flushPendingCloudPush) {
        cloudModule.flushPendingCloudPush();
      }
    });
    window.addEventListener('pagehide', () => {
      if(cloudModule && cloudModule.flushPendingCloudPush) {
        cloudModule.flushPendingCloudPush();
      }
    });
  }

  state.selectedDate = getTodayStr();
  actionsModule.materializeRecurringTasks();
  actionsModule.rolloverPendingTasks();

  routerModule.router();
  cloudModule.renderAuthArea();
  cloudModule.initFirebase();

  checkMeetingNotifications();

  setInterval(()=>{
    if(routerModule.getCurrentView() === 'task' || routerModule.getCurrentView() === 'interruption' || routerModule.getCurrentView() === 'history') return;
    if(meetingEdit === null && taskEdit === null){
      viewsModule.renderAll();
    } else {
      viewsModule.renderClock();
    }
  }, 15000);

  setInterval(()=>{
    checkRunningTaskNotification();
    checkMeetingNotifications();
  }, 3000);

  export default app;

