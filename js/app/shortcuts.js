/* app/shortcuts.js — Atajos de teclado globales y modal de ayuda */
export function TodayTasksShortcuts(appCtx){
  const {
    getState, actionsModule, routerModule, viewsModule,
    switchHeaderTab, togglePlanningMode, undoModule
  } = appCtx;

  function getMeetingEdit() { return appCtx.getMeetingEdit ? appCtx.getMeetingEdit() : null; }
  function getTaskEdit() { return appCtx.getTaskEdit ? appCtx.getTaskEdit() : null; }

  function toggleShortcutsModal(show){
    if (typeof document === "undefined") return;
    const modal = document.getElementById("shortcutsModal");
    if(!modal) return;
    const isVisible = modal.style.display === "flex";
    const nextState = typeof show === "boolean" ? show : !isVisible;
    modal.style.display = nextState ? "flex" : "none";
  }

  if (typeof document !== "undefined") {
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
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
      const state = getState ? getState() : {};

      if(e.key === "Escape" || e.key === "Esc"){
        const fModal = document.getElementById("featuredLimitModal");
        if(fModal && fModal.style.display === "flex"){
          e.preventDefault();
          const cancelBtn = document.getElementById("featuredLimitModalBtnCancel");
          if(cancelBtn && typeof cancelBtn.click === "function") {
            cancelBtn.click();
          } else {
            fModal.style.display = "none";
          }
          return;
        }

        const sModal = document.getElementById("shortcutsModal");
        if(sModal && sModal.style.display === "flex"){
          e.preventDefault();
          toggleShortcutsModal(false);
          return;
        }

        const wsModal = document.getElementById("weeklyScheduleModal");
        if(wsModal && wsModal.style.display === "flex"){
          e.preventDefault();
          const wsBtn = document.getElementById("closeWeeklyScheduleBtn") || document.getElementById("cancelWeeklyScheduleBtn");
          if(wsBtn && typeof wsBtn.click === "function") wsBtn.click();
          else wsModal.style.display = "none";
          return;
        }

        const recModal = document.getElementById("recurringModal");
        if(recModal && recModal.style.display === "flex"){
          e.preventDefault();
          const recBtn = document.getElementById("recModalBtnCancel");
          if(recBtn && typeof recBtn.click === "function") recBtn.click();
          else recModal.style.display = "none";
          return;
        }

        const copyModal = document.getElementById("copyTaskModal");
        if(copyModal && copyModal.style.display === "flex"){
          e.preventDefault();
          const copyBtn = document.getElementById("cancelCopyTaskBtn");
          if(copyBtn && typeof copyBtn.click === "function") copyBtn.click();
          else copyModal.style.display = "none";
          return;
        }

        const urgencyMenu = document.getElementById("urgencyDropdownMenu");
        if(urgencyMenu && urgencyMenu.style.display === "block"){
          e.preventDefault();
          if(window.app && typeof window.app.closeUrgencyDropdown === "function") {
            window.app.closeUrgencyDropdown();
          } else {
            urgencyMenu.style.display = "none";
          }
          return;
        }

        const startAfterPopover = document.getElementById("startAfterPopover");
        if(startAfterPopover && startAfterPopover.style.display === "flex"){
          e.preventDefault();
          if(window.app && typeof window.app.closeStartAfterPopover === "function") {
            window.app.closeStartAfterPopover();
          } else {
            startAfterPopover.style.display = "none";
          }
          return;
        }

        const timePopover = document.getElementById("timePopover");
        if(timePopover && timePopover.style.display === "flex"){
          e.preventDefault();
          if(window.app && typeof window.app.closeTimePopover === "function") {
            window.app.closeTimePopover();
          } else {
            timePopover.style.display = "none";
          }
          return;
        }

        const recurringPopover = document.getElementById("recurringInfoPopover");
        if(recurringPopover && recurringPopover.style.display === "flex"){
          e.preventDefault();
          if(window.app && typeof window.app.closeRecurringInfoPopover === "function") {
            window.app.closeRecurringInfoPopover();
          } else {
            recurringPopover.style.display = "none";
          }
          return;
        }

        const triageUrgency = document.getElementById("triageSingleUrgencyPopover");
        if(triageUrgency && triageUrgency.style.display === "block"){
          e.preventDefault();
          if(window.app && typeof window.app.closeTriagePopovers === "function") {
            window.app.closeTriagePopovers();
          } else {
            triageUrgency.style.display = "none";
          }
          return;
        }

        if(state.activeInterruption || (routerModule && routerModule.getCurrentView() === 'interruption')){
          e.preventDefault();
          if (actionsModule && actionsModule.cancelInterruption) actionsModule.cancelInterruption();
          return;
        }

        const active = document.activeElement;
        const tag = active ? active.tagName.toLowerCase() : "";
        if(tag === "input" || tag === "textarea" || tag === "select" || (active && active.isContentEditable)){
          e.preventDefault();
          active.blur();
          if(getMeetingEdit() && actionsModule && actionsModule.cancelEditMeeting) actionsModule.cancelEditMeeting();
          if(getTaskEdit() && actionsModule && actionsModule.cancelEditTask) actionsModule.cancelEditTask();
          return;
        }

        if(getTaskEdit && getTaskEdit() && actionsModule && actionsModule.cancelEditTask){
          e.preventDefault();
          actionsModule.cancelEditTask();
          return;
        }

        if(getMeetingEdit && getMeetingEdit() && actionsModule && actionsModule.cancelEditMeeting){
          e.preventDefault();
          actionsModule.cancelEditMeeting();
          return;
        }

        if(routerModule && routerModule.getCurrentView() !== 'main'){
          e.preventDefault();
          window.location.hash = '#/';
          return;
        }

        return;
      }

      const active = document.activeElement;
      const tag = active ? active.tagName.toLowerCase() : "";
      const isInput = tag === "input" || tag === "textarea" || tag === "select" || (active && active.isContentEditable);
      if(isInput) return;

      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey){
        e.preventDefault();
        if(undoModule && undoModule.undo) {
          undoModule.undo();
        }
        return;
      }
      if(((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")){
        e.preventDefault();
        if(undoModule && undoModule.redo) {
          undoModule.redo();
        }
        return;
      }

      if(e.key === "?"){
        e.preventDefault();
        toggleShortcutsModal();
      } else if(e.key === "1" || e.key === "2" || e.key === "3"){
        e.preventDefault();
        const tabMap = { "1": "entorno", "2": "tiempo", "3": "config" };
        if(switchHeaderTab) switchHeaderTab(tabMap[e.key]);
      } else if(e.key === "e" || e.key === "E"){
        e.preventDefault();
        const nextEnv = state.activeEnv === "work" ? "personal" : "work";
        if(actionsModule && actionsModule.switchEnvironment) actionsModule.switchEnvironment(nextEnv);
      } else if(e.key === "d" || e.key === "D"){
        e.preventDefault();
        if(switchHeaderTab) switchHeaderTab("tiempo");
        if(actionsModule && actionsModule.resetToToday) actionsModule.resetToToday();
      } else if(e.key === "p" || e.key === "P"){
        e.preventDefault();
        if(togglePlanningMode) togglePlanningMode();
      } else if(e.key === "w" || e.key === "W"){
        e.preventDefault();
        if(appCtx.pipModule && appCtx.pipModule.togglePiP) {
          appCtx.pipModule.togglePiP();
        } else if (typeof window !== "undefined" && window.app && typeof window.app.togglePiP === "function") {
          window.app.togglePiP();
        }
      } else if(e.key === "h" || e.key === "H"){
        e.preventDefault();
        if(routerModule && routerModule.getCurrentView() === 'history'){
          window.location.hash = '#/';
        } else {
          window.location.hash = '#/history';
        }
      } else if(e.key === "x" || e.key === "X"){
        e.preventDefault();
        if(routerModule && routerModule.getCurrentView() === 'triage'){
          window.location.hash = '#/';
        } else {
          window.location.hash = '#/triage';
        }
      } else if(e.key === "i" || e.key === "I"){
        e.preventDefault();
        if(state.activeInterruption){
          if(actionsModule && actionsModule.completeInterruption) actionsModule.completeInterruption();
        } else {
          if(actionsModule && actionsModule.startInterruption) actionsModule.startInterruption();
        }
      } else if(e.key === "f" || e.key === "F"){
        const running = (state.tasks || []).find(t => t.status === "running");
        const pendingOrPaused = (state.tasks || []).filter(t => t.status !== "completed").sort((a,b) => a.order - b.order)[0];
        const targetTask = running || pendingOrPaused;

        if(targetTask){
          e.preventDefault();
          if(routerModule && routerModule.getCurrentView() === 'task' && routerModule.getFocusTaskId() === targetTask.id){
            window.location.hash = '#/';
          } else {
            window.location.hash = '#/task/' + targetTask.id;
          }
        }
      } else if(e.key === "t" || e.key === "T"){
        e.preventDefault();
        if(routerModule && routerModule.getCurrentView() !== 'main'){
          window.location.hash = '#/';
        }
        setTimeout(() => {
          const el = document.getElementById("taskTitle");
          if(el) el.focus();
        }, 50);
      } else if(e.key === "/"){
        e.preventDefault();
        if(routerModule && routerModule.getCurrentView() !== 'main'){
          window.location.hash = '#/';
        }
        setTimeout(() => {
          const el = document.getElementById("taskSearchInput");
          if(el) {
            el.focus();
            el.select();
          }
        }, 50);
      } else if(e.key === "r" || e.key === "R"){
        e.preventDefault();
        if(routerModule && routerModule.getCurrentView() !== 'main'){
          window.location.hash = '#/';
        }
        setTimeout(() => {
          const el = document.getElementById("meetingTitle");
          if(el) el.focus();
        }, 50);
      }
    });
  }

  return { toggleShortcutsModal };
}

export default TodayTasksShortcuts;
