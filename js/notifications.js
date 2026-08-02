window.TodayTasksNotifications = function ({ getState, getNotifyState, setNotifyState, nowMinutes, fmt, fmtRemaining, showToast }) {
  const notifSupported = ("Notification" in window);

  function notificationPermissionLabel(){
    if(!notifSupported) return "no disponibles en este navegador";
    if(window.location.protocol === "file:"){
      return Notification.permission === "granted" ? "activadas" : "no disponibles en archivo local (file://)";
    }
    if(Notification.permission === "granted") return "activadas";
    if(Notification.permission === "denied") return "bloqueadas en navegador (icono 🔒)";
    return "desactivadas";
  }

  function refreshNotifyBtn(){
    const btn = document.getElementById("notifyBtn");
    if(!btn) return;
    btn.textContent = "🔔 Avisos: " + notificationPermissionLabel();
    btn.disabled = !notifSupported;
  }

  function requestNotificationPermission(){
    if(!notifSupported){
      showToast("Este navegador no admite notificaciones de escritorio.");
      return;
    }
    if(window.location.protocol === "file:"){
      showToast("Las notificaciones de escritorio son bloqueadas por el navegador en archivos locales (file://). Sirve la app en http://localhost o activa servidor web local. Los avisos internos visuales seguirán funcionando.");
      return;
    }
    if(Notification.permission === "granted"){
      showToast("Los avisos de escritorio ya están activados. Recibirás avisos durante las tareas.");
      return;
    }
    if(Notification.permission === "denied"){
      showToast("Las notificaciones están bloqueadas en tu navegador. Haz clic en el icono del candado 🔒 junto a la URL para permitirlas.");
      return;
    }
    try{
      const req = Notification.requestPermission();
      if(req && typeof req.then === "function"){
        req.then(perm => {
          refreshNotifyBtn();
          if(perm === "granted"){
            showToast("Avisos de escritorio activados.");
          } else if(perm === "denied"){
            showToast("Notificaciones denegadas en el navegador. Puedes activarlas desde los ajustes del sitio (icono 🔒).");
          } else {
            showToast("No se activaron los avisos de escritorio; se usarán los avisos visuales de la app.");
          }
        }).catch(err => {
          console.warn("Error al solicitar permiso de notificación:", err);
          showToast("No se pudo solicitar permisos de notificación en este contexto.");
        });
      }
    }catch(err){
      console.warn("Excepción al solicitar permisos de notificación:", err);
      showToast("No se pudieron solicitar permisos de notificación.");
    }
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
    const ns = getNotifyState ? getNotifyState() : {taskId:null, lastNotifiedAt:null};
    const running = getState().tasks.find(t=>t.status==="running");
    if(!running){
      if(ns.taskId !== null) setNotifyState({taskId:null, lastNotifiedAt:null});
      return;
    }
    const now = nowMinutes();
    if(ns.taskId !== running.id){
      // e.g. page was reloaded mid-run: start the 10-min cycle from now without notifying immediately.
      setNotifyState({taskId: running.id, lastNotifiedAt: now});
      return;
    }
    const intervalMin = (getState().notifyIntervalMin && getState().notifyIntervalMin > 0) ? getState().notifyIntervalMin : 10;
    if(now - ns.lastNotifiedAt >= intervalMin){
      const plannedEnd = running.runningStart + (running.planned - (running.elapsedBefore||0));
      const rem = fmtRemaining(plannedEnd, now);
      const body = rem.overrun
        ? "Se ha excedido " + rem.text.replace("excedida ","") + " · fin previsto era a las " + fmt(plannedEnd)
        : "Quedan " + rem.text.replace("quedan ","") + " · fin previsto a las " + fmt(plannedEnd);
      sendDesktopNotification(running.title, body);
      setNotifyState({taskId: running.id, lastNotifiedAt: now});
    }
  }


  return { refreshNotifyBtn, requestNotificationPermission, checkRunningTaskNotification };
};

