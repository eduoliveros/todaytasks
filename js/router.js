/* router.js — SPA hash router */
import { renderHistoryView } from './history.js';

export function TodayTasksRouter(ctx){
  const { getState, renderInterruptionView, renderTaskFocusView, renderAll } = ctx;

  let currentView = 'main';   // 'main' | 'task' | 'interruption'
  let focusTaskId = null;
  let focusRefreshTimer = null;
  let interruptionRefreshTimer = null;

  function showView(view, taskId){
    if (typeof document === "undefined") return;
    const mainEl = document.getElementById('view-main');
    const taskEl = document.getElementById('view-task');
    const interruptionEl = document.getElementById('view-interruption');
    const historyEl = document.getElementById('view-history');

    if(view === 'interruption'){
      currentView = 'interruption';
      if(focusRefreshTimer){ clearInterval(focusRefreshTimer); focusRefreshTimer = null; }
      if(mainEl) mainEl.style.display = 'none';
      if(taskEl) taskEl.style.display = 'none';
      if(historyEl) historyEl.style.display = 'none';
      if(interruptionEl) interruptionEl.style.display = 'flex';
      if(renderInterruptionView) renderInterruptionView();
      if(interruptionRefreshTimer) clearInterval(interruptionRefreshTimer);
      interruptionRefreshTimer = setInterval(renderInterruptionView, 1000);
    } else if(view === 'history'){
      currentView = 'history';
      if(focusRefreshTimer){ clearInterval(focusRefreshTimer); focusRefreshTimer = null; }
      if(interruptionRefreshTimer){ clearInterval(interruptionRefreshTimer); interruptionRefreshTimer = null; }
      if(mainEl) mainEl.style.display = 'none';
      if(taskEl) taskEl.style.display = 'none';
      if(interruptionEl) interruptionEl.style.display = 'none';
      if(historyEl) historyEl.style.display = 'block';
      if(renderHistoryView){
        renderHistoryView(ctx);
      }
    } else if(view === 'task' && taskId){
      focusTaskId = taskId;
      currentView = 'task';
      if(interruptionRefreshTimer){ clearInterval(interruptionRefreshTimer); interruptionRefreshTimer = null; }
      if(mainEl) mainEl.style.display = 'none';
      if(interruptionEl) interruptionEl.style.display = 'none';
      if(historyEl) historyEl.style.display = 'none';
      if(taskEl) taskEl.style.display = 'flex';
      if(renderTaskFocusView) renderTaskFocusView();
      if(focusRefreshTimer) clearInterval(focusRefreshTimer);
      focusRefreshTimer = setInterval(renderTaskFocusView, 10000);
    } else {
      focusTaskId = null;
      currentView = 'main';
      if(interruptionRefreshTimer){ clearInterval(interruptionRefreshTimer); interruptionRefreshTimer = null; }
      if(mainEl) mainEl.style.display = '';
      if(taskEl) taskEl.style.display = 'none';
      if(interruptionEl) interruptionEl.style.display = 'none';
      if(historyEl) historyEl.style.display = 'none';
      if(focusRefreshTimer){ clearInterval(focusRefreshTimer); focusRefreshTimer = null; }
      if(ctx.resetBoardScroll) ctx.resetBoardScroll();
      if(renderAll) renderAll();
    }
  }

  function router(){
    const state = getState ? getState() : {};
    const hash = (typeof window !== "undefined" && window.location.hash) ? window.location.hash : '#/';
    if(state.activeInterruption && hash !== '#/interruption'){
      if (typeof window !== "undefined") window.location.hash = '#/interruption';
      return;
    }
    if(hash === '#/interruption'){
      showView('interruption');
      return;
    }
    if(hash === '#/history'){
      showView('history');
      return;
    }
    if(hash.startsWith('#/task/')){
      const rawId = decodeURIComponent(hash.replace('#/task/', '')).trim();
      if(rawId){
        const parsed = Number(rawId);
        const id = !isNaN(parsed) && String(parsed) === rawId ? parsed : rawId;
        showView('task', id);
        return;
      }
    }
    showView('main');
  }

  return {
    getCurrentView: () => currentView,
    getFocusTaskId: () => focusTaskId,
    showView,
    router
  };
}

export default TodayTasksRouter;

