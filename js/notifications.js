import { getTodayStr, matchesRecurrenceRule } from './utils.js';
import { t } from './i18n.js';

export function TodayTasksNotifications({ getState, getNotifyState, setNotifyState, pauseTask, saveState, nowMinutes, fmt, fmtRemaining, showToast }) {
  const notifSupported = (typeof window !== "undefined" && "Notification" in window);

  function isNotifyActive(){
    const state = getState();
    if(state.notifyEnabled === false) return false;
    if(!notifSupported) return false;
    return Notification.permission === "granted";
  }

  function notificationPermissionLabel(){
    if(!notifSupported) return t("notifications.labelUnsupported");
    const state = getState();
    if(state.notifyEnabled === false){
      return t("notifications.labelDisabled");
    }
    if(typeof window !== "undefined" && window.location && window.location.protocol === "file:"){
      return Notification.permission === "granted" ? t("notifications.labelEnabled") : t("notifications.labelFileProtocol");
    }
    if(Notification.permission === "granted") return t("notifications.labelEnabled");
    if(Notification.permission === "denied") return t("notifications.labelBlocked");
    return t("notifications.labelDisabled");
  }

  function refreshNotifyBtn(){
    if(typeof document === "undefined") return;
    const btn = document.getElementById("notifyBtn");
    if(!btn) return;
    btn.textContent = "🔔 " + t("notifications.btnLabel", { status: notificationPermissionLabel() });
    btn.disabled = !notifSupported;
  }

  function toggleNotificationPermission(){
    const state = getState();

    // If currently active, turn off
    if(isNotifyActive()){
      state.notifyEnabled = false;
      if(saveState) saveState();
      refreshNotifyBtn();
      if(showToast) showToast(t("notifications.toastDisabled"));
      return;
    }

    // Otherwise enable
    state.notifyEnabled = true;
    if(saveState) saveState();

    if(!notifSupported){
      if(showToast) showToast(t("notifications.toastNotSupported"));
      refreshNotifyBtn();
      return;
    }

    if(typeof window !== "undefined" && window.location && window.location.protocol === "file:"){
      if(showToast) showToast(t("notifications.toastFileProtocol"));
      refreshNotifyBtn();
      return;
    }

    if(Notification.permission === "granted"){
      refreshNotifyBtn();
      if(showToast) showToast(t("notifications.toastEnabled"));
      return;
    }

    if(Notification.permission === "denied"){
      refreshNotifyBtn();
      if(showToast) showToast(t("notifications.toastBlocked"));
      return;
    }

    try{
      const req = Notification.requestPermission();
      if(req && typeof req.then === "function"){
        req.then(perm => {
          if(perm !== "granted"){
            state.notifyEnabled = false;
            if(saveState) saveState();
          }
          refreshNotifyBtn();
          if(perm === "granted"){
            if(showToast) showToast(t("notifications.toastEnabled"));
          } else if(perm === "denied"){
            if(showToast) showToast(t("notifications.toastDenied"));
          } else {
            if(showToast) showToast(t("notifications.toastVisualFallback"));
          }
        }).catch(err => {
          console.warn("Error al solicitar permiso de notificación:", err);
          if(showToast) showToast(t("notifications.toastRequestError"));
          refreshNotifyBtn();
        });
      }
    }catch(err){
      console.warn("Excepción al solicitar permisos de notificación:", err);
      if(showToast) showToast(t("notifications.toastRequestException"));
      refreshNotifyBtn();
    }
  }

  function sendDesktopNotification(title, body, tag = "tablero-dia-tarea"){
    if(isNotifyActive()){
      try{
        const n = new Notification(title, {body, tag});
        n.onclick = () => { if(typeof window !== "undefined") window.focus(); };
      }catch(err){
        console.error("No se pudo mostrar la notificación de escritorio", err);
      }
    }
    // Always mirror it inside the app too, in case desktop notifications are off/blocked.
    if(showToast) showToast(title + " — " + body);
  }

  function checkRunningTaskNotification(){
    if(!isNotifyActive()) return;
    const ns = getNotifyState ? getNotifyState() : {taskId:null, lastNotifiedAt:null, timeEndNotified:false};
    const running = getState().tasks.find(t=>t.status==="running");
    if(!running){
      if(ns.taskId !== null && setNotifyState) setNotifyState({taskId:null, lastNotifiedAt:null, timeEndNotified:false});
      return;
    }
    const now = nowMinutes ? nowMinutes() : 0;
    const plannedEnd = running.runningStart + (running.planned - (running.elapsedBefore||0));

    if(ns.taskId !== running.id){
      // e.g. page was reloaded mid-run or new task running: start cycle
      const isAlreadyEnded = now >= plannedEnd;
      if(setNotifyState) setNotifyState({taskId: running.id, lastNotifiedAt: now, timeEndNotified: isAlreadyEnded});
      return;
    }

    // 1. Notificación inmediata cuando se acaba el tiempo planificado
    if(now >= plannedEnd && !ns.timeEndNotified){
      const title = t("notifications.taskTimeEndTitle");
      const body = t("notifications.taskTimeEndBody", { title: running.title, planned: running.planned });
      sendDesktopNotification(title, body, `task-time-end-${running.id}`);
      if(setNotifyState) setNotifyState({taskId: running.id, lastNotifiedAt: now, timeEndNotified: true});
      return;
    }

    // 2. Notificaciones periódicas según el intervalo configurado (ej: cada 10 min)
    const intervalMin = (getState().notifyIntervalMin && getState().notifyIntervalMin > 0) ? getState().notifyIntervalMin : 10;
    if(now - ns.lastNotifiedAt >= intervalMin){
      const rem = fmtRemaining ? fmtRemaining(plannedEnd, now) : { text: "", overrun: false };
      const fmtVal = fmt ? fmt(plannedEnd) : String(plannedEnd);
      const cleanTime = (rem.text || '').replace(/^quedan\s+/i, '').replace(/^excedida\s+/i, '').replace(/\s+left$/i, '').replace(/\s+overrun$/i, '');
      const body = rem.overrun
        ? t("notifications.taskOverrunBody", { time: cleanTime, plannedEnd: fmtVal })
        : t("notifications.taskRemainingBody", { time: cleanTime, plannedEnd: fmtVal });
      sendDesktopNotification(running.title, body);
      if(setNotifyState) setNotifyState({taskId: running.id, lastNotifiedAt: now, timeEndNotified: ns.timeEndNotified || false});
    }
  }

  const notifiedMeetingKeys = new Set();

  function checkMeetingNotifications(){
    const state = getState();
    const todayStr = getTodayStr();
    if(!todayStr || !state || !state.environments) return;

    const envKey = state.activeEnv || "work";
    const envObj = state.environments[envKey];
    const dayObj = (envObj && envObj.days) ? envObj.days[todayStr] : null;
    if(!dayObj) return;

    const now = nowMinutes ? nowMinutes() : 0;
    const singleMeetings = Array.isArray(dayObj.meetings) ? dayObj.meetings : [];
    const recurringRules = Array.isArray(envObj.recurringMeetings) ? envObj.recurringMeetings : [];
    const hydratedRecurring = [];
    recurringRules.forEach(rule => {
      const match = matchesRecurrenceRule(rule, todayStr);
      if (match) {
        hydratedRecurring.push(match);
      }
    });
    const meetings = [...singleMeetings, ...hydratedRecurring];
    meetings.sort((a, b) => a.start - b.start);

    meetings.forEach(m => {
      if(!m || typeof m.start !== "number") return;

      // 1. Notificación 2 minutos antes de la reunión
      const key2min = `${todayStr}_${m.id}_2min_${m.start}`;
      if(now >= (m.start - 2) && now < m.start){
        if(!notifiedMeetingKeys.has(key2min)){
          notifiedMeetingKeys.add(key2min);
          const fmtValStart = fmt ? fmt(m.start) : m.start;
          const fmtValEnd = fmt ? fmt(m.end) : m.end;
          const title = t("notifications.meeting2minTitle", { title: m.title });
          const body = t("notifications.meeting2minBody", { start: fmtValStart, end: fmtValEnd });
          sendDesktopNotification(title, body, `meeting-2min-${m.id}`);
        }
      }

      // 2. Notificación en la hora exacta de la reunión y auto-pausa de la tarea activa
      const keyStart = `${todayStr}_${m.id}_start_${m.start}`;
      const isStartWindow = (now >= m.start && now < (m.start + 2));
      const isDuringMeeting = (now >= m.start && (typeof m.end === 'number' ? now < m.end : now < (m.start + 2)));

      if(!notifiedMeetingKeys.has(keyStart)){
        if(isStartWindow || isDuringMeeting){
          notifiedMeetingKeys.add(keyStart);
          const fmtValStart = fmt ? fmt(m.start) : m.start;
          const fmtValEnd = fmt ? fmt(m.end) : m.end;

          if(isStartWindow){
            const title = t("notifications.meetingStartTitle", { title: m.title });
            const body = t("notifications.meetingStartBody", { title: m.title, start: fmtValStart, end: fmtValEnd });
            sendDesktopNotification(title, body, `meeting-start-${m.id}`);
          }

          // Auto-pausar tarea activa si existe
          const currentTasks = state.tasks || (dayObj.tasks || []);
          const runningTask = currentTasks.find(t => t.status === "running");
          if(runningTask && (isStartWindow || runningTask.runningStart === null || runningTask.runningStart < m.start)){
            if(pauseTask){
              pauseTask(runningTask.id);
            }
            if(showToast){
              showToast(t("notifications.meetingAutoPausedTask", { title: runningTask.title }));
            }
          }
        }
      }
    });
  }

  return {
    refreshNotifyBtn,
    requestNotificationPermission: toggleNotificationPermission,
    toggleNotificationPermission,
    checkRunningTaskNotification,
    checkMeetingNotifications
  };
}

export default TodayTasksNotifications;
