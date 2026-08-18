/* app/shortcuts.js — Atajos de teclado globales y modal de ayuda */
(function(){
  "use strict";

  window._TodayTasksShortcuts = function(appCtx){
    const {
      getState, actionsModule, routerModule, viewsModule,
      switchHeaderTab, togglePlanningMode
    } = appCtx;

    function getMeetingEdit() { return appCtx.getMeetingEdit(); }
    function getTaskEdit() { return appCtx.getTaskEdit(); }

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
      const state = getState();

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
          if(getMeetingEdit()) actionsModule.cancelEditMeeting();
          if(getTaskEdit()) actionsModule.cancelEditTask();
          return;
        }

        if(getMeetingEdit()){
          e.preventDefault();
          actionsModule.cancelEditMeeting();
          return;
        }
        if(getTaskEdit()){
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

    return { toggleShortcutsModal };
  };
})();
