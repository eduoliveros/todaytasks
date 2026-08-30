/* app.js — Coordinador principal de la aplicación */
import TodayTasksConfig from './config.js';
import { nowMinutes, fmt, fmtDur, fmtRemaining, timeToMinutes, getTodayStr, getDayOfWeek, getTaskElapsed } from './utils.js';
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
  setState: (newState) => { state = wrapState(newState); },
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
viewsModule = TodayTasksViews(ctx);
cloudModule = TodayTasksCloud(ctx);
routerModule = TodayTasksRouter(ctx);

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
      ? "Modo planificación activado: las tareas se reparten desde el inicio de jornada (" + fmt(state.workStart) + ")."
      : "Modo planificación desactivado: las tareas vuelven a repartirse desde la hora actual.");
  }

  const planningBtnEl = document.getElementById("planningModeBtn");
  if(planningBtnEl) planningBtnEl.addEventListener("click", togglePlanningMode);
  viewsModule.refreshPlanningModeBtn();

  document.getElementById("newDayBtn").addEventListener("click", actionsModule.startNewDay);
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
  }

  if(window.matchMedia){
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if((state.themeMode || "auto") === "auto"){
        applyTheme("auto");
      }
    });
  }

  applyTheme();

  const themeSelectEl = document.getElementById("themeSelect");
  if(themeSelectEl){
    themeSelectEl.value = state.themeMode || "auto";
    themeSelectEl.addEventListener("change", (e)=>{
      state.themeMode = e.target.value;
      saveState();
      applyTheme(state.themeMode);
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
  }

  /* ---------------- Shortcuts sub-module ---------------- */
  TodayTasksShortcuts({
    getState: () => state,
    getMeetingEdit: () => meetingEdit,
    getTaskEdit: () => taskEdit,
    actionsModule,
    routerModule,
    viewsModule,
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
    moveTask: actionsModule.moveTask,
    startTask: actionsModule.startTask,
    pauseTask: actionsModule.pauseTask,
    resumeTask: actionsModule.resumeTask,
    completeTask: actionsModule.completeTask,
    uncompleteTask: actionsModule.uncompleteTask,
    copyTaskToDate: actionsModule.copyTaskToDate,
    moveTaskToDate: actionsModule.moveTaskToDate,
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
    updateTaskAdvancedIndicators: function() {
      const autoMoveCb = document.getElementById('isAutoMoveTaskCheckbox');
      const recCb = document.getElementById('isRecurringTaskCheckbox');
      const startAfterInput = document.getElementById('taskStartAfterInput');

      const autoMoveBadge = document.getElementById('formAutoMoveBadge');
      const recBadge = document.getElementById('formRecurringBadge');
      const startAfterBadge = document.getElementById('formStartAfterBadge');

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
        const taskEdit = typeof actionsModule.getTaskEdit === 'function' ? actionsModule.getTaskEdit() : null;
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
        // Determine current featured state from taskEdit
        const taskInState = (state.tasks || []).find(t => String(t.id) === String(taskId));
        // We need to read taskEdit; actionsModule doesn't expose getTaskEdit, so read state directly
        // toggleTaskFeatured checks limit and calls showFeaturedLimitModal internally
        actionsModule.toggleTaskFeatured(taskId);
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

        dropdown.style.left = `${left + window.scrollX}px`;
        dropdown.style.top = `${top + window.scrollY}px`;
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
        // Update the inline edit form via the action (triggers re-render with updated pill)
        actionsModule.updateTaskEditField('urgency', urgency);
        this._editUrgencyTaskId = null;
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
          // Check the featured limit
          const currentState = state;
          const featuredCount = (currentState.tasks || []).filter(t => t.featured).length;
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
    }
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

