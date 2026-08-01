window.TodayTasksNotifications = function ({ getState, nowMinutes, fmt, fmtRemaining, showToast }) {
  const notifSupported = ("Notification" in window);

  function notificationPermissionLabel(){
    if(!notifSupported) return "no disponibles en este navegador";
    if(Notification.permission === "granted") return "activadas";
    if(Notification.permission === "denied") return "bloqueadas en el navegador";
    return "desactivadas";
  }
  function refreshNotifyBtn(){
    const btn = document.getElementById("notifyBtn");
    if(!btn) return;
    btn.textContent = "🔔 Avisos: " + notificationPermissionLabel();
    btn.disabled = !notifSupported || Notification.permission === "denied";
  }
  function requestNotificationPermission(){
    if(!notifSupported){
      showToast("Este navegador no admite notificaciones de escritorio.");
      return;
    }
    if(Notification.permission === "granted"){
      showToast("Los avisos de escritorio ya están activados.");
      return;
    }
    if(Notification.permission === "denied"){
      showToast("Has bloqueado los avisos para esta página en el navegador; actívalos desde su configuración.");
      return;
    }
    Notification.requestPermission().then(perm => {
      refreshNotifyBtn();
      showToast(perm === "granted"
        ? "Avisos de escritorio activados. Recibirás uno cada 10 min mientras haya una tarea en marcha."
        : "No se han activado los avisos; seguirás viendo el aviso dentro de la app.");
    });
  }
  function sendDesktopNotification(title, body){
    if(notifSupported && Notification.permission === "granted"){
      try{
        const n = new Notification(title, {body, tag:"tablero-dia-tarea"});
        n.onclick = () => { window.focus(); };
      }catch(err){
        console.error("No se pudo mostrar la notificación de escritorio", err);
      }
    }
    // Always mirror it inside the app too, in case desktop notifications are off/blocked.
    showToast(title + " — " + body);
  }
  function checkRunningTaskNotification(){
    const running = getState().tasks.find(t=>t.status==="running");
    if(!running){
      if(notifyState.taskId !== null) notifyState = {taskId:null, lastNotifiedAt:null};
      return;
    }
    const now = nowMinutes();
    if(notifyState.taskId !== running.id){
      // e.g. page was reloaded mid-run: start the 10-min cycle from now without notifying immediately.
      notifyState = {taskId: running.id, lastNotifiedAt: now};
      return;
    }
    const intervalMin = (getState().notifyIntervalMin && getState().notifyIntervalMin > 0) ? getState().notifyIntervalMin : 10;
    if(now - notifyState.lastNotifiedAt >= intervalMin){
      const plannedEnd = running.runningStart + (running.planned - (running.elapsedBefore||0));
      const rem = fmtRemaining(plannedEnd, now);
      const body = rem.overrun
        ? "Se ha excedido " + rem.text.replace("excedida ","") + " · fin previsto era a las " + fmt(plannedEnd)
        : "Quedan " + rem.text.replace("quedan ","") + " · fin previsto a las " + fmt(plannedEnd);
      sendDesktopNotification(running.title, body);
      notifyState.lastNotifiedAt = now;
    }
  }


  return { refreshNotifyBtn, requestNotificationPermission, checkRunningTaskNotification };
};

