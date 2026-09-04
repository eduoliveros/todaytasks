/* app.js — Coordinador principal de la aplicación */
import TodayTasksConfig from './config.js';
import { nowMinutes, fmt, fmtDur, fmtRemaining, timeToMinutes, getTodayStr, getDayOfWeek, getTaskElapsed, formatRecurrenceRule } from './utils.js';
import { escapeHtml, escapeAttr, showToast, scrollToElement } from './ui.js';
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
import { TodayTasksPopovers } from './app/popovers.js';
import { TodayTasksUrgencyDropdown, getUrgencyMap } from './app/urgency-dropdown.js';
import { TodayTasksHistoryMetrics } from './app/history-metrics.js';
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
  renderHistoryView: () => TodayTasksHistory && TodayTasksHistory.renderHistoryView && TodayTasksHistory.renderHistoryView(ctx),
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
  const formsModule = TodayTasksForms({
    getState: () => state,
    actionsModule,
    showToast,
    fmt,
    timeToMinutes,
    setTaskSearchQuery: ctx.setTaskSearchQuery,
    renderTasks: ctx.renderTasks,
    renderAll: ctx.renderAll
  });
  ctx.formsModule = formsModule;

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

  /* ---------------- Popovers sub-module ---------------- */
  const popoversModule = TodayTasksPopovers({
    getState: () => state,
    saveState,
    viewsModule,
    getActionsModule: () => actionsModule,
    showToast,
    undoModule,
    fmt
  });
  ctx.popoversModule = popoversModule;

  /* ---------------- Urgency Dropdown sub-module ---------------- */
  const urgencyDropdownModule = TodayTasksUrgencyDropdown({
    getState: () => state,
    getActionsModule: () => actionsModule,
    getTaskEdit: () => taskEdit
  });
  ctx.urgencyDropdownModule = urgencyDropdownModule;

  /* ---------------- History metrics sub-module ---------------- */
  const historyMetricsModule = TodayTasksHistoryMetrics({
    getState: () => state,
    getActionsModule: () => actionsModule
  });
  ctx.historyMetricsModule = historyMetricsModule;

  function promptAddHistoryMetric(){
    return historyMetricsModule.promptAddHistoryMetric();
  }

  function editHistoryMetricPrompt(dateStr){
    return historyMetricsModule.editHistoryMetricPrompt(dateStr);
  }

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
    openTimePopover: (taskId, event) => popoversModule.openTimePopover(taskId, event),
    closeTimePopover: () => popoversModule.closeTimePopover(),
    saveTimePopover: () => popoversModule.saveTimePopover(),
    adjustTimePopover: (deltaMin) => popoversModule.adjustTimePopover(deltaMin),
    openStartAfterPopover: (taskId, event) => popoversModule.openStartAfterPopover(taskId, event),
    closeStartAfterPopover: () => popoversModule.closeStartAfterPopover(),
    saveStartAfterPopover: () => popoversModule.saveStartAfterPopover(),
    clearStartAfterPopover: () => popoversModule.clearStartAfterPopover(),
    openRecurringInfoPopover: (entityId, event, type) => popoversModule.openRecurringInfoPopover(entityId, event, type),
    closeRecurringInfoPopover: () => popoversModule.closeRecurringInfoPopover(),
    editRecurringSeriesFromPopover: (showEdit) => popoversModule.editRecurringSeriesFromPopover(showEdit),
    toggleEditRecurrenceInPopover: (showEdit) => popoversModule.toggleEditRecurrenceInPopover(showEdit),
    onRecurrencePopoverFreqChange: (freq) => popoversModule.onRecurrencePopoverFreqChange(freq),
    toggleRecurrencePopoverDay: (dayNum) => popoversModule.toggleRecurrencePopoverDay(dayNum),
    saveRecurrenceFromPopover: () => popoversModule.saveRecurrenceFromPopover(),
    toggleTaskFormRecurrenceDay: (dayNum) => popoversModule.toggleTaskFormRecurrenceDay(dayNum),
    toggleMeetingFormRecurrenceDay: (dayNum) => popoversModule.toggleMeetingFormRecurrenceDay(dayNum),
    get currentPopoverTaskId() { return popoversModule.currentPopoverTaskId; },
    set currentPopoverTaskId(v) { popoversModule.currentPopoverTaskId = v; },
    get currentStartAfterTaskId() { return popoversModule.currentStartAfterTaskId; },
    set currentStartAfterTaskId(v) { popoversModule.currentStartAfterTaskId = v; },
    get _isFormStartAfter() { return popoversModule._isFormStartAfter; },
    set _isFormStartAfter(v) { popoversModule._isFormStartAfter = v; },
    get currentRecurringEntityId() { return popoversModule.currentRecurringEntityId; },
    set currentRecurringEntityId(v) { popoversModule.currentRecurringEntityId = v; },
    get currentRecurringEntityType() { return popoversModule.currentRecurringEntityType; },
    set currentRecurringEntityType(v) { popoversModule.currentRecurringEntityType = v; },
    get _popoverSelectedDays() { return popoversModule._popoverSelectedDays; },
    set _popoverSelectedDays(v) { popoversModule._popoverSelectedDays = v; },
    updateTaskAdvancedIndicators: () => formsModule.updateTaskAdvancedIndicators(),
    insertFormNotesFormat: (prefix, suffix) => formsModule.insertFormNotesFormat(prefix, suffix),
    insertFormNotesLink: () => formsModule.insertFormNotesLink(),
    insertEditNotesFormat: (taskId, prefix, suffix) => formsModule.insertEditNotesFormat(taskId, prefix, suffix),
    insertEditNotesLink: (taskId) => formsModule.insertEditNotesLink(taskId),
    toggleEditNotesPreview: (taskId) => formsModule.toggleEditNotesPreview(taskId),
    toggleTaskNotes: function(taskId, event) {
      if (viewsModule && viewsModule.toggleTaskNotes) {
        viewsModule.toggleTaskNotes(taskId, event);
      }
    },
    onFormStartAfterChange: (val) => formsModule.onFormStartAfterChange(val),
    clearFormStartAfterDirect: () => formsModule.clearFormStartAfterDirect(),
    toggleTaskAdvancedOptions: () => formsModule.toggleTaskAdvancedOptions(),
    setTaskStartAfter: actionsModule.setTaskStartAfter,
    setTaskUrgency: actionsModule.setTaskUrgency,
    setTaskFeatured: actionsModule.setTaskFeatured,
    toggleTaskFeatured: actionsModule.toggleTaskFeatured,
    resolveFeaturedLimit: actionsModule.resolveFeaturedLimit,
    openEditUrgencyDropdown: (taskId, event) => urgencyDropdownModule.openEditUrgencyDropdown(taskId, event),
    toggleEditFeatured: (taskId, event) => urgencyDropdownModule.toggleEditFeatured(taskId, event),
    openUrgencyDropdown: (taskId, event) => urgencyDropdownModule.openUrgencyDropdown(taskId, event),
    selectTaskUrgency: (urgency) => urgencyDropdownModule.selectTaskUrgency(urgency),
    openFormUrgencyDropdown: (event) => urgencyDropdownModule.openFormUrgencyDropdown(event),
    toggleFormFeatured: (event) => urgencyDropdownModule.toggleFormFeatured(event),
    closeUrgencyDropdown: () => urgencyDropdownModule.closeUrgencyDropdown(),
    getUrgencyMap,
    get currentUrgencyTaskId() { return urgencyDropdownModule.currentUrgencyTaskId; },
    set currentUrgencyTaskId(v) { urgencyDropdownModule.currentUrgencyTaskId = v; },
    get _formUrgencyMode() { return urgencyDropdownModule._formUrgencyMode; },
    set _formUrgencyMode(v) { urgencyDropdownModule._formUrgencyMode = v; },
    get _editUrgencyTaskId() { return urgencyDropdownModule._editUrgencyTaskId; },
    set _editUrgencyTaskId(v) { urgencyDropdownModule._editUrgencyTaskId = v; },
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

