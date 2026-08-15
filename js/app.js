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

      // Auto-sync Personal: si el entorno activo es Trabajo, actualiza workStart de Personal
      // para el día seleccionado, pero solo si ese día de Personal sigue siendo "derivado"
      if(state.activeEnv === 'work') {
        const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
        const personalEnv = state.environments.personal;
        const dow = window.TodayTasksUtils.getDayOfWeek(dateStr);
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
    dpiEl.value = state.selectedDate || window.TodayTasksUtils.getTodayStr();
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

  /* ---- Weekly Schedule Modal ---- */

  function derivePersonalFromWork() {
    const workSched = state.environments.work.weeklySchedule;
    const derived = {};
    for (let d = 1; d <= 7; d++) {
      const ws = workSched ? workSched[d] : { start: 9*60, end: 18*60 };
      if (ws === null) {
        derived[d] = { start: 9*60, end: 23*60, derived: true };
      } else if (ws === undefined) {
        derived[d] = { start: 18*60, end: 23*60, derived: true };
      } else {
        derived[d] = { start: ws.end, end: 23*60, derived: true };
      }
    }
    return derived;
  }

  function syncPersonalFromWork() {
    const personalEnv = state.environments.personal;
    if (!personalEnv.weeklySchedule) {
      personalEnv.weeklySchedule = derivePersonalFromWork();
      return;
    }
    for (let d = 1; d <= 7; d++) {
      const slot = personalEnv.weeklySchedule[d];
      if (slot && slot.derived) {
        const workSched = state.environments.work.weeklySchedule;
        const ws = workSched ? workSched[d] : { start: 9*60, end: 18*60 };
        if (ws === null) {
          personalEnv.weeklySchedule[d] = { start: 9*60, end: 23*60, derived: true };
        } else if (ws === undefined) {
          personalEnv.weeklySchedule[d] = { start: 18*60, end: 23*60, derived: true };
        } else {
          personalEnv.weeklySchedule[d] = { start: ws.end, end: 23*60, derived: true };
        }
      }
    }
  }

  function getOrDeriveWeeklySchedule(envKey) {
    const env = state.environments[envKey];
    if (env.weeklySchedule) return Object.assign({}, env.weeklySchedule);
    if (envKey === 'personal') return derivePersonalFromWork();
    // Trabajo sin configurar: L-V 9-18, S-D libre
    return { 1:{start:9*60,end:18*60}, 2:{start:9*60,end:18*60}, 3:{start:9*60,end:18*60},
             4:{start:9*60,end:18*60}, 5:{start:9*60,end:18*60}, 6:null, 7:null };
  }

  function renderWeeklyScheduleRows(schedule) {
    const container = document.getElementById('weeklyScheduleRows');
    if (!container) return;
    const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    let html = '';
    for (let d = 1; d <= 7; d++) {
      const slot = schedule[d];
      const isFree = slot === null;
      const startVal = isFree ? '' : fmt(slot.start);
      const endVal   = isFree ? '' : fmt(slot.end);
      html += `
        <div class="weekly-schedule-row${isFree ? ' is-free-day' : ''}" data-dow="${d}">
          <span class="ws-day-name">${dayNames[d]}</span>
          <label class="ws-free-label">
            <input type="checkbox" class="ws-free-cb" data-dow="${d}"${isFree ? ' checked' : ''}>
            Libre
          </label>
          <div class="ws-times${isFree ? ' ws-times-hidden' : ''}">
            <input type="time" class="ws-start" data-dow="${d}" value="${startVal}" aria-label="Inicio ${dayNames[d]}">
            <span class="ws-sep">→</span>
            <input type="time" class="ws-end" data-dow="${d}" value="${endVal}" aria-label="Fin ${dayNames[d]}">
          </div>
        </div>`;
    }
    container.innerHTML = html;

    // Toggle libre / horario
    container.querySelectorAll('.ws-free-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const row = cb.closest('.weekly-schedule-row');
        const times = row.querySelector('.ws-times');
        row.classList.toggle('is-free-day', cb.checked);
        times.classList.toggle('ws-times-hidden', cb.checked);
      });
    });
  }

  function readWeeklyScheduleFromModal(envKey) {
    const container = document.getElementById('weeklyScheduleRows');
    if (!container) return null;
    const oldSched = state.environments[envKey].weeklySchedule || {};
    const result = {};
    for (let d = 1; d <= 7; d++) {
      const cb = container.querySelector(`.ws-free-cb[data-dow="${d}"]`);
      if (cb && cb.checked) {
        result[d] = null;
      } else {
        const startEl = container.querySelector(`.ws-start[data-dow="${d}"]`);
        const endEl   = container.querySelector(`.ws-end[data-dow="${d}"]`);
        const startV  = timeToMinutes(startEl ? startEl.value : '');
        const endV    = timeToMinutes(endEl   ? endEl.value   : '');
        if (startV !== null && endV !== null) {
          // Conservar derived=true si no se ha editado manualmente
          const oldSlot = oldSched[d];
          const wasDerived = oldSlot && oldSlot.derived &&
            oldSlot.start === startV && oldSlot.end === endV;
          result[d] = { start: startV, end: endV, ...(wasDerived ? { derived: true } : {}) };
        } else {
          result[d] = { start: 9*60, end: 18*60 };
        }
      }
    }
    return result;
  }

  function openWeeklyScheduleModal() {
    const envKey = state.activeEnv;
    const envName = envKey === 'work' ? '💼 Trabajo' : '🏠 Personal';
    const titleEl = document.getElementById('weeklyScheduleTitle');
    if (titleEl) titleEl.textContent = '📅 Horario semanal — ' + envName;
    const schedule = getOrDeriveWeeklySchedule(envKey);
    renderWeeklyScheduleRows(schedule);
    const modal = document.getElementById('weeklyScheduleModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeWeeklyScheduleModal() {
    const modal = document.getElementById('weeklyScheduleModal');
    if (modal) modal.style.display = 'none';
  }

  const weeklyScheduleBtnEl = document.getElementById('weeklyScheduleBtn');
  if (weeklyScheduleBtnEl) weeklyScheduleBtnEl.addEventListener('click', openWeeklyScheduleModal);

  const closeWeeklyScheduleBtnEl = document.getElementById('closeWeeklyScheduleBtn');
  if (closeWeeklyScheduleBtnEl) closeWeeklyScheduleBtnEl.addEventListener('click', closeWeeklyScheduleModal);

  const cancelWeeklyScheduleBtnEl = document.getElementById('cancelWeeklyScheduleBtn');
  if (cancelWeeklyScheduleBtnEl) cancelWeeklyScheduleBtnEl.addEventListener('click', closeWeeklyScheduleModal);

  const saveWeeklyScheduleBtnEl = document.getElementById('saveWeeklyScheduleBtn');
  if (saveWeeklyScheduleBtnEl) {
    saveWeeklyScheduleBtnEl.addEventListener('click', () => {
      const envKey = state.activeEnv;
      const newSched = readWeeklyScheduleFromModal(envKey);
      if (!newSched) { closeWeeklyScheduleModal(); return; }
      state.environments[envKey].weeklySchedule = newSched;

      // Si acabamos de guardar Trabajo, re-sincronizar Personal en los días derived
      if (envKey === 'work') {
        syncPersonalFromWork();
      }

      // Limpiar overrides locales de los días que no hayan sido fijados manualmente
      const envObj = state.environments[envKey];
      if (envObj && envObj.days) {
        Object.keys(envObj.days).forEach(d => {
          if (!envObj.days[d].hasCustomHours) {
            delete envObj.days[d].workStart;
            delete envObj.days[d].workEnd;
          }
        });
      }

      saveState();
      viewsModule.syncFormInputsFromState();
      viewsModule.renderAll();
      closeWeeklyScheduleModal();
      showToast('📅 Horario semanal guardado');
    });
  }

  /* ---- End Weekly Schedule Modal ---- */

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

  const isRecurringTaskCb = document.getElementById("isRecurringTaskCheckbox");
  if (isRecurringTaskCb) {
    isRecurringTaskCb.addEventListener("change", (e) => {
      const opts = document.getElementById("recurringTaskFormOptions");
      if (opts) opts.style.display = e.target.checked ? "block" : "none";
    });
  }

  const recFreqEl = document.getElementById("recFreq");
  if (recFreqEl) {
    recFreqEl.addEventListener("change", (e) => {
      const daysWrap = document.getElementById("recDaysWrap");
      if (daysWrap) daysWrap.style.display = e.target.value === "daily" ? "none" : "block";
    });
  }

  const recTaskFreqEl = document.getElementById("recTaskFreq");
  if (recTaskFreqEl) {
    recTaskFreqEl.addEventListener("change", (e) => {
      const daysWrap = document.getElementById("recTaskDaysWrap");
      if (daysWrap) daysWrap.style.display = e.target.value === "daily" ? "none" : "block";
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

  function handleTaskSubmit(toTop = false){
    const titleEl = document.getElementById("taskTitle");
    const title = titleEl.value.trim();
    const dur = document.getElementById("taskDuration").value;
    if(!title){
      showToast("Escribe un título para la tarea.");
      titleEl.focus();
      return;
    }

    let recurringData = null;
    const recurringTaskCb = document.getElementById("isRecurringTaskCheckbox");
    if (recurringTaskCb && recurringTaskCb.checked) {
      const freq = document.getElementById("recTaskFreq").value;
      const interval = parseInt(document.getElementById("recTaskInterval").value, 10) || 1;
      const dayCbs = document.querySelectorAll(".rec-task-day-cb:checked");
      const daysOfWeek = Array.from(dayCbs).map(cb => parseInt(cb.value, 10));
      const endDate = document.getElementById("recTaskEndDate").value || null;
      recurringData = { isRecurring: true, freq, interval, daysOfWeek, endDate };
    }

    actionsModule.addTask(title, dur, toTop, recurringData);
    titleEl.value = "";
    document.getElementById("taskDuration").value = "";
    if (recurringTaskCb) {
      recurringTaskCb.checked = false;
      const opts = document.getElementById("recurringTaskFormOptions");
      if (opts) opts.style.display = "none";
    }
    titleEl.focus();
  }

  document.getElementById("addMeetingBtn").addEventListener("click", handleMeetingSubmit);

  const addTaskBtn = document.getElementById("addTaskBtn");
  let longPressTimeout = null;
  let isLongPress = false;

  function startHolding(e) {
    if (e.type === "mousedown" && e.button !== 0) return;
    isLongPress = false;
    if (addTaskBtn) addTaskBtn.classList.add("btn-holding");
    longPressTimeout = setTimeout(() => {
      isLongPress = true;
      showInsertPositionMenu();
      cancelHolding();
    }, 600);
  }

  function cancelHolding() {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
    if (addTaskBtn) addTaskBtn.classList.remove("btn-holding");
  }

  if (addTaskBtn) {
    addTaskBtn.addEventListener("mousedown", startHolding);
    addTaskBtn.addEventListener("touchstart", startHolding, { passive: true });
    addTaskBtn.addEventListener("mouseup", cancelHolding);
    addTaskBtn.addEventListener("mouseleave", cancelHolding);
    addTaskBtn.addEventListener("touchend", cancelHolding);
    addTaskBtn.addEventListener("touchcancel", cancelHolding);
    
    addTaskBtn.addEventListener("click", (e) => {
      if (isLongPress) {
        e.preventDefault();
        e.stopPropagation();
        isLongPress = false;
        return;
      }
      handleTaskSubmit(false);
    });
  }

  function showInsertPositionMenu() {
    const existing = document.getElementById("addTaskPositionMenu");
    if (existing) existing.remove();

    const titleEl = document.getElementById("taskTitle");
    const title = titleEl.value.trim();
    if(!title){
      showToast("Escribe un título para la tarea.");
      titleEl.focus();
      return;
    }

    const menu = document.createElement("div");
    menu.id = "addTaskPositionMenu";
    menu.className = "task-context-menu";

    const optionTop = document.createElement("div");
    optionTop.className = "task-menu-item";
    optionTop.innerHTML = "<span>⬆️</span> <span>Añadir al inicio (arriba)</span>";
    optionTop.addEventListener("click", () => {
      handleTaskSubmit(true);
      menu.remove();
    });

    const optionBottom = document.createElement("div");
    optionBottom.className = "task-menu-item";
    optionBottom.innerHTML = "<span>⬇️</span> <span>Añadir al final (abajo)</span>";
    optionBottom.addEventListener("click", () => {
      handleTaskSubmit(false);
      menu.remove();
    });

    menu.appendChild(optionTop);
    menu.appendChild(optionBottom);
    document.body.appendChild(menu);

    const rect = addTaskBtn.getBoundingClientRect();
    menu.style.position = "absolute";
    menu.style.top = `${rect.bottom + window.scrollY + 6}px`;

    const menuWidth = 190;
    let leftPos = rect.right + window.scrollX - menuWidth;
    if (leftPos < 0) leftPos = rect.left + window.scrollX;
    menu.style.left = `${leftPos}px`;

    setTimeout(() => {
      const clickOutside = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== addTaskBtn) {
          menu.remove();
          document.removeEventListener("click", clickOutside);
        }
      };
      document.addEventListener("click", clickOutside);
    }, 50);
  }

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
          handleTaskSubmit(e.shiftKey);
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

  function toggleShortcutsModal(show){
    const modal = document.getElementById("shortcutsModal");
    if(!modal) return;
    const isVisible = modal.style.display === "flex";
    const nextState = typeof show === "boolean" ? show : !isVisible;
    modal.style.display = nextState ? "flex" : "none";
  }

  const helpBtn = document.getElementById("helpBtn");
  if(helpBtn) helpBtn.addEventListener("click", () => toggleShortcutsModal(true));

  const closeShortcutsBtn = document.getElementById("closeShortcutsBtn");
  if(closeShortcutsBtn) closeShortcutsBtn.addEventListener("click", () => toggleShortcutsModal(false));

  const shortcutsModalEl = document.getElementById("shortcutsModal");
  if(shortcutsModalEl){
    shortcutsModalEl.addEventListener("click", (e) => {
      if(e.target === shortcutsModalEl) toggleShortcutsModal(false);
    });
  }

  window.addEventListener("keydown", (e) => {
    if(e.key === "Escape" || e.key === "Esc"){
      const sModal = document.getElementById("shortcutsModal");
      if(sModal && sModal.style.display === "flex"){
        e.preventDefault();
        toggleShortcutsModal(false);
        return;
      }

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

    const active = document.activeElement;
    const tag = active ? active.tagName.toLowerCase() : "";
    if(tag === "input" || tag === "textarea" || (active && active.isContentEditable)) return;

    if(e.key === "?" || (e.shiftKey && e.key === "/")){
      e.preventDefault();
      toggleShortcutsModal();
    } else if(e.key === "1" || e.key === "2" || e.key === "3"){
      e.preventDefault();
      const tabMap = { "1": "entorno", "2": "tiempo", "3": "config" };
      switchHeaderTab(tabMap[e.key]);
    } else if(e.key === "e" || e.key === "E"){
      e.preventDefault();
      const nextEnv = state.activeEnv === "work" ? "personal" : "work";
      actionsModule.switchEnvironment(nextEnv);
    } else if(e.key === "d" || e.key === "D"){
      e.preventDefault();
      switchHeaderTab("tiempo");
      actionsModule.resetToToday();
    } else if(e.key === "p" || e.key === "P"){
      e.preventDefault();
      togglePlanningMode();
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
    openCopyTaskModal: actionsModule.openCopyTaskModal,
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
        const t = currentState.tasks.find(t => String(t.id) === String(taskId));
        if(!t) return;
        
        const actual = window.TodayTasksUtils.getTaskElapsed(t);
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
    }
  };

  window.addEventListener('hashchange', routerModule.router);

  // Materialize recurring tasks for the current day on startup
  actionsModule.materializeRecurringTasks();

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

