(function(){
  "use strict";

  const STORAGE_KEY = window.TodayTasksConfig.storageKey;
  const { nowMinutes, fmt, fmtDur, fmtRemaining, timeToMinutes } = window.TodayTasksUtils;
  const { escapeHtml, escapeAttr, showToast } = window.TodayTasksUi;
  const { defaultState, loadState } = window.TodayTasksState;

  // mm:ss format using real seconds precision for interruption timer
  function fmtMMSS(startEpoch){
    if(!startEpoch) return "00:00";
    const totalSec = Math.max(0, Math.floor((Date.now() - startEpoch) / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  /* ---------------- State ---------------- */
  let state = loadState(STORAGE_KEY);

  /* Transient (non-persisted) inline-edit state */
  let meetingEdit = null; // {id, title, start, end}
  let taskEdit = null;    // {id, title, duration}
  let notifyState = {taskId:null, lastNotifiedAt:null, timeEndNotified:false};

  const RING_R = 85;
  const RING_C = +(2 * Math.PI * RING_R).toFixed(2); // 534.07

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if(cloudModule && cloudModule.pushToCloud) cloudModule.pushToCloud();
  }

  function newId(){
    const id = state.nextId || 1;
    state.nextId = id + 1;
    return id;
  }

  function computeSchedule(){
    return window.TodayTasksScheduler.computeSchedule(state, nowMinutes);
  }

  // Forward declarations for modules
  let actionsModule, viewsModule, cloudModule, routerModule;

  // Context object for sharing between modules
  const ctx = {
    STORAGE_KEY,
    getState: () => state,
    setState: (newState) => { state = newState; },
    getMeetingEdit: () => meetingEdit,
    setMeetingEdit: (v) => { meetingEdit = v; },
    getTaskEdit: () => taskEdit,
    setTaskEdit: (v) => { taskEdit = v; },
    getNotifyState: () => notifyState,
    setNotifyState: (v) => { notifyState = v; },
    getCurrentView: () => routerModule ? routerModule.getCurrentView() : 'main',
    getFocusTaskId: () => routerModule ? routerModule.getFocusTaskId() : null,
    saveState,
    newId,
    computeSchedule,
    fmtMMSS,
    RING_R,
    RING_C,
    renderAll: () => viewsModule && viewsModule.renderAll(),
    smartRender: () => viewsModule && viewsModule.smartRender(),
    renderInterruptionView: () => viewsModule && viewsModule.renderInterruptionView(),
    renderTaskFocusView: () => viewsModule && viewsModule.renderTaskFocusView(),
    syncFormInputsFromState: () => viewsModule && viewsModule.syncFormInputsFromState(),
    refreshPlanningModeBtn: () => viewsModule && viewsModule.refreshPlanningModeBtn()
  };

  // Initialize modules
  actionsModule = window.TodayTasksActions(ctx);
  viewsModule = window.TodayTasksViews(ctx);
  cloudModule = window.TodayTasksCloud(ctx);
  routerModule = window.TodayTasksRouter(ctx);

  const { refreshNotifyBtn, requestNotificationPermission, checkRunningTaskNotification, checkMeetingNotifications } =
    window.TodayTasksNotifications({
      getState: () => state,
      getNotifyState: () => notifyState,
      setNotifyState: (v) => { notifyState = v; },
      saveState,
      nowMinutes,
      fmt,
      fmtRemaining,
      showToast
    });

  /* ---------------- Wiring ---------------- */

  function switchHeaderTab(target){
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

  /* --- Header tab switching --- */
  (function(){
    const tabs = document.querySelectorAll('.header-tab');
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        switchHeaderTab(tab.dataset.tab);
      });
    });
  })();

  document.getElementById("workStartInput").value = fmt(state.workStart);
  document.getElementById("workStartInput").addEventListener("change", (e)=>{
    const v = timeToMinutes(e.target.value);
    if(v !== null){
      state.workStart = v;
      saveState();
      viewsModule.renderAll();
    }
  });

  document.getElementById("workEndInput").value = fmt(state.workEnd);
  document.getElementById("workEndInput").addEventListener("change", (e)=>{
    const v = timeToMinutes(e.target.value);
    if(v !== null){
      state.workEnd = v;
      saveState();
      viewsModule.renderAll();
    }
  });

  document.getElementById("planningModeBtn").addEventListener("click", ()=>{
    state.planningMode = !state.planningMode;
    saveState();
    viewsModule.refreshPlanningModeBtn();
    viewsModule.renderAll();
    showToast(state.planningMode
      ? "Modo planificación activado: las tareas se reparten desde el inicio de jornada (" + fmt(state.workStart) + ")."
      : "Modo planificación desactivado: las tareas vuelven a repartirse desde la hora actual.");
  });
  viewsModule.refreshPlanningModeBtn();

  document.getElementById("newDayBtn").addEventListener("click", actionsModule.startNewDay);
  document.getElementById("notifyBtn").addEventListener("click", requestNotificationPermission);
  refreshNotifyBtn();

  const dpiEl = document.getElementById("datePickerInput");
  if(dpiEl){
    dpiEl.value = state.selectedDate || window.TodayTasksUtils.getTodayStr();
    dpiEl.addEventListener("change", (e) => actionsModule.selectDate(e.target.value));
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

  /* Theme management */
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

  document.getElementById("meetingStart").addEventListener("change", (e)=>{
    const endInput = document.getElementById("meetingEnd");
    if(endInput.value) return;
    const start = timeToMinutes(e.target.value);
    if(start === null) return;
    endInput.value = fmt(start + 30);
  });

  const isRecurringCb = document.getElementById("isRecurringCheckbox");
  if (isRecurringCb) {
    isRecurringCb.addEventListener("change", (e) => {
      const opts = document.getElementById("recurringFormOptions");
      if (opts) opts.style.display = e.target.checked ? "block" : "none";
    });
  }

  function handleMeetingSubmit(){
    const titleEl = document.getElementById("meetingTitle");
    const title = titleEl.value.trim();
    const start = document.getElementById("meetingStart").value;
    const end = document.getElementById("meetingEnd").value;
    if(!title){
      showToast("Escribe un título para la reunión.");
      titleEl.focus();
      return;
    }

    let recurringData = null;
    if (isRecurringCb && isRecurringCb.checked) {
      const freq = document.getElementById("recFreq").value;
      const interval = parseInt(document.getElementById("recInterval").value, 10) || 1;
      const dayCbs = document.querySelectorAll(".rec-day-cb:checked");
      const daysOfWeek = Array.from(dayCbs).map(cb => parseInt(cb.value, 10));
      const endDate = document.getElementById("recEndDate").value || null;
      recurringData = { isRecurring: true, freq, interval, daysOfWeek, endDate };
    }

    actionsModule.addMeeting(title, start, end, recurringData);
    titleEl.value = "";
    document.getElementById("meetingStart").value = "";
    document.getElementById("meetingEnd").value = "";
    if (isRecurringCb) {
      isRecurringCb.checked = false;
      const opts = document.getElementById("recurringFormOptions");
      if (opts) opts.style.display = "none";
    }
    titleEl.focus();
  }

  function handleTaskSubmit(){
    const titleEl = document.getElementById("taskTitle");
    const title = titleEl.value.trim();
    const dur = document.getElementById("taskDuration").value;
    if(!title){
      showToast("Escribe un título para la tarea.");
      titleEl.focus();
      return;
    }
    actionsModule.addTask(title, dur);
    titleEl.value = "";
    document.getElementById("taskDuration").value = "";
    titleEl.focus();
  }

  document.getElementById("addMeetingBtn").addEventListener("click", handleMeetingSubmit);
  document.getElementById("addTaskBtn").addEventListener("click", handleTaskSubmit);

  ["meetingTitle", "meetingStart", "meetingEnd"].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){
          e.preventDefault();
          handleMeetingSubmit();
        }
      });
    }
  });

  ["taskTitle", "taskDuration"].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){
          e.preventDefault();
          handleTaskSubmit();
        }
      });
    }
  });

  document.getElementById("summaryToggle").addEventListener("click", ()=>{
    const body = document.getElementById("summaryBody");
    const chevron = document.getElementById("summaryChevron");
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "block" : "none";
    chevron.textContent = isHidden ? "▴" : "▾";
  });

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

  window.addEventListener("keydown", (e) => {
    if(e.key === "Escape" || e.key === "Esc"){
      if(state.activeInterruption || routerModule.getCurrentView() === 'interruption'){
        e.preventDefault();
        actionsModule.cancelInterruption();
        return;
      }

      const active = document.activeElement;
      const tag = active ? active.tagName.toLowerCase() : "";
      if(tag === "input" || tag === "textarea" || tag === "select" || (active && active.isContentEditable)){
        e.preventDefault();
        active.blur();
        if(meetingEdit) actionsModule.cancelEditMeeting();
        if(taskEdit) actionsModule.cancelEditTask();
        return;
      }

      if(meetingEdit){
        e.preventDefault();
        actionsModule.cancelEditMeeting();
        return;
      }
      if(taskEdit){
        e.preventDefault();
        actionsModule.cancelEditTask();
        return;
      }
    }

    // Alt + 1, Alt + 2, Alt + 3 for switching header tabs from anywhere
    if(e.altKey && (e.key === "1" || e.key === "2" || e.key === "3")){
      e.preventDefault();
      const tabMap = { "1": "entorno", "2": "tiempo", "3": "config" };
      switchHeaderTab(tabMap[e.key]);
      return;
    }

    const active = document.activeElement;
    const tag = active ? active.tagName.toLowerCase() : "";
    if(tag === "input" || tag === "textarea" || (active && active.isContentEditable)) return;

    if(e.key === "1" || e.key === "2" || e.key === "3"){
      e.preventDefault();
      const tabMap = { "1": "entorno", "2": "tiempo", "3": "config" };
      switchHeaderTab(tabMap[e.key]);
    } else if(e.key === "e" || e.key === "E"){
      e.preventDefault();
      const nextEnv = state.activeEnv === "work" ? "personal" : "work";
      actionsModule.switchEnvironment(nextEnv);
    } else if(e.key === "h" || e.key === "H"){
      e.preventDefault();
      if(routerModule.getCurrentView() === 'history'){
        window.location.hash = '#/';
      } else {
        window.location.hash = '#/history';
      }
    } else if(e.key === "i" || e.key === "I"){
      e.preventDefault();
      actionsModule.startInterruption();
    } else if(e.key === "f" || e.key === "F"){
      const running = state.tasks.find(t => t.status === "running");
      const pendingOrPaused = state.tasks.filter(t => t.status !== "completed").sort((a,b) => a.order - b.order)[0];
      const targetTask = running || pendingOrPaused;

      if(targetTask){
        e.preventDefault();
        if(routerModule.getCurrentView() === 'task' && routerModule.getFocusTaskId() === targetTask.id){
          window.location.hash = '#/';
        } else {
          window.location.hash = '#/task/' + targetTask.id;
        }
      }
    } else if(e.key === "t" || e.key === "T"){
      e.preventDefault();
      if(routerModule.getCurrentView() !== 'main'){
        window.location.hash = '#/';
      }
      setTimeout(() => {
        const el = document.getElementById("taskTitle");
        if(el) el.focus();
      }, 50);
    } else if(e.key === "r" || e.key === "R"){
      e.preventDefault();
      if(routerModule.getCurrentView() !== 'main'){
        window.location.hash = '#/';
      }
      setTimeout(() => {
        const el = document.getElementById("meetingTitle");
        if(el) el.focus();
      }, 50);
    }
  });

  function toggleHistorySeries(key){
    if(window.TodayTasksHistory){
      window.TodayTasksHistory.toggleSeries(key);
      if(routerModule.getCurrentView() === 'history'){
        window.TodayTasksHistory.renderHistoryView(ctx);
      }
    }
  }

  function promptAddHistoryMetric(){
    const dateStr = prompt("Introduce la fecha en formato YYYY-MM-DD:", window.TodayTasksUtils.getTodayStr());
    if(!dateStr) return;
    const mStr = prompt("Tiempo de Reuniones (minutos):", "0");
    if(mStr === null) return;
    const cStr = prompt("Tiempo de Tareas Completadas (minutos):", "0");
    if(cStr === null) return;
    const wStr = prompt("Tiempo Trabajado en Pendientes (minutos):", "0");
    if(wStr === null) return;
    const nwStr = prompt("Tiempo No Trabajado en Pendientes (minutos):", "0");
    if(nwStr === null) return;
    const iStr = prompt("Tiempo de Interrupciones (minutos):", "0");
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
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || {};
    const existing = (env.history || []).find(h => h.date === dateStr) || {};

    const mStr = prompt(`[${dateStr}] Tiempo de Reuniones (minutos):`, String(existing.meetingsTime || 0));
    if(mStr === null) return;
    const cStr = prompt(`[${dateStr}] Tiempo de Tareas Completadas (minutos):`, String(existing.completedTasksTime || 0));
    if(cStr === null) return;
    const wStr = prompt(`[${dateStr}] Tiempo Trabajado en Pendientes (minutos):`, String(existing.uncompletedTasksWorkedTime || 0));
    if(wStr === null) return;
    const nwStr = prompt(`[${dateStr}] Tiempo No Trabajado en Pendientes (minutos):`, String(existing.uncompletedTasksNotWorkedTime || 0));
    if(nwStr === null) return;
    const iStr = prompt(`[${dateStr}] Tiempo de Interrupciones (minutos):`, String(existing.interruptionsTime || 0));
    if(iStr === null) return;

    actionsModule.saveHistoryMetric(dateStr, {
      meetingsTime: mStr,
      completedTasksTime: cStr,
      uncompletedTasksWorkedTime: wStr,
      uncompletedTasksNotWorkedTime: nwStr,
      interruptionsTime: iStr
    });
  }

  // expose actions for inline onclick handlers
  window.app = {
    switchEnvironment: actionsModule.switchEnvironment,
    selectDate: actionsModule.selectDate,
    resetToToday: actionsModule.resetToToday,
    deleteMeeting: actionsModule.deleteMeeting,
    deleteTask: actionsModule.deleteTask,
    moveTask: actionsModule.moveTask,
    startTask: actionsModule.startTask,
    pauseTask: actionsModule.pauseTask,
    resumeTask: actionsModule.resumeTask,
    completeTask: actionsModule.completeTask,
    uncompleteTask: actionsModule.uncompleteTask,
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
    restoreLocalBackup: cloudModule.restoreLocalBackup
  };

  window.addEventListener('hashchange', routerModule.router);

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
})();

