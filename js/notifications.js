import { getTodayStr, matchesRecurrenceRule } from './utils.js';

export function TodayTasksNotifications({ getState, getNotifyState, setNotifyState, pauseTask, saveState, nowMinutes, fmt, fmtRemaining, showToast }) {
  const notifSupported = (typeof window !== "undefined" && "Notification" in window);

  function isNotifyActive(){
    const state = getState();
    if(state.notifyEnabled === false) return false;
    if(!notifSupported) return false;
    return Notification.permission === "granted";
  }

  function notificationPermissionLabel(){
    if(!notifSupported) return "no disponibles en este navegador";
    const state = getState();
    if(state.notifyEnabled === false){
      return "desactivados";
    }
    if(typeof window !== "undefined" && window.location && window.location.protocol === "file:"){
      return Notification.permission === "granted" ? "activados" : "no disponibles en archivo local (file://)";
    }
    if(Notification.permission === "granted") return "activados";
    if(Notification.permission === "denied") return "bloqueados en navegador (icono 🔒)";
    return "desactivados";
  }

  function refreshNotifyBtn(){
    if(typeof document === "undefined") return;
    const btn = document.getElementById("notifyBtn");
    if(!btn) return;
    btn.textContent = "🔔 Avisos: " + notificationPermissionLabel();
    btn.disabled = !notifSupported;
  }

  function toggleNotificationPermission(){
    const state = getState();

    // If currently active, turn off
    if(isNotifyActive()){
      state.notifyEnabled = false;
      if(saveState) saveState();
      refreshNotifyBtn();
      if(showToast) showToast("Avisos desactivados.");
      return;
    }

    // Otherwise enable
    state.notifyEnabled = true;
    if(saveState) saveState();

    if(!notifSupported){
      if(showToast) showToast("Este navegador no admite notificaciones de escritorio.");
      refreshNotifyBtn();
      return;
    }

    if(typeof window !== "undefined" && window.location && window.location.protocol === "file:"){
      if(showToast) showToast("Las notificaciones de escritorio son bloqueadas por el navegador en archivos locales (file://). Sirve la app en http://localhost o activa servidor web local. Los avisos internos visuales seguirán funcionando.");
      refreshNotifyBtn();
      return;
    }

    if(Notification.permission === "granted"){
      refreshNotifyBtn();
      if(showToast) showToast("Avisos de escritorio activados.");
      return;
    }

    if(Notification.permission === "denied"){
      refreshNotifyBtn();
      if(showToast) showToast("Las notificaciones están bloqueadas en tu navegador. Haz clic en el icono del candado 🔒 junto a la URL para permitirlas.");
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
            if(showToast) showToast("Avisos de escritorio activados.");
          } else if(perm === "denied"){
            if(showToast) showToast("Notificaciones denegadas en el navegador. Puedes activarlas desde los ajustes del sitio (icono 🔒).");
          } else {
            if(showToast) showToast("No se activaron los avisos de escritorio; se usarán los avisos visuales de la app.");
          }
        }).catch(err => {
          console.warn("Error al solicitar permiso de notificación:", err);
          if(showToast) showToast("No se pudo solicitar permisos de notificación en este contexto.");
          refreshNotifyBtn();
        });
      }
    }catch(err){
      console.warn("Excepción al solicitar permisos de notificación:", err);
      if(showToast) showToast("No se pudieron solicitar permisos de notificación.");
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
      const title = `⏰ ¡Tiempo planificado completado!`;
      const body = `La tarea "${running.title}" ha alcanzado su tiempo planificado (${running.planned} min).`;
      sendDesktopNotification(title, body, `task-time-end-${running.id}`);
      if(setNotifyState) setNotifyState({taskId: running.id, lastNotifiedAt: now, timeEndNotified: true});
      return;
    }

    // 2. Notificaciones periódicas según el intervalo configurado (ej: cada 10 min)
    const intervalMin = (getState().notifyIntervalMin && getState().notifyIntervalMin > 0) ? getState().notifyIntervalMin : 10;
    if(now - ns.lastNotifiedAt >= intervalMin){
      const rem = fmtRemaining ? fmtRemaining(plannedEnd, now) : { text: "", overrun: false };
      const fmtVal = fmt ? fmt(plannedEnd) : String(plannedEnd);
      const body = rem.overrun
        ? "Se ha excedido " + rem.text.replace("excedida ","") + " · fin previsto era a las " + fmtVal
        : "Quedan " + rem.text.replace("quedan ","") + " · fin previsto a las " + fmtVal;
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
          const title = `⏰ Reunión en 2 min: ${m.title}`;
          const body = `Empieza a las ${fmt ? fmt(m.start) : m.start} (duración hasta las ${fmt ? fmt(m.end) : m.end}).`;
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

          if(isStartWindow){
            const title = `🔔 Reunión ahora: ${m.title}`;
            const body = `La reunión "${m.title}" comienza ahora (${fmt ? fmt(m.start) : m.start} - ${fmt ? fmt(m.end) : m.end}).`;
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
              showToast(`Reunión iniciada: "${runningTask.title}" se ha pausado automáticamente.`);
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
