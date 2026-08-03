(function(){
  "use strict";

  window.TodayTasksRouter = function(ctx){
    const { getState, renderInterruptionView, renderTaskFocusView, renderAll } = ctx;

    let currentView = 'main';   // 'main' | 'task' | 'interruption'
    let focusTaskId = null;
    let focusRefreshTimer = null;
    let interruptionRefreshTimer = null;

    function showView(view, taskId){
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
        renderInterruptionView();
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
        if(window.TodayTasksHistory && window.TodayTasksHistory.renderHistoryView){
          window.TodayTasksHistory.renderHistoryView(ctx);
        }
      } else if(view === 'task' && taskId){
        focusTaskId = taskId;
        currentView = 'task';
        if(interruptionRefreshTimer){ clearInterval(interruptionRefreshTimer); interruptionRefreshTimer = null; }
        if(mainEl) mainEl.style.display = 'none';
        if(interruptionEl) interruptionEl.style.display = 'none';
        if(historyEl) historyEl.style.display = 'none';
        if(taskEl) taskEl.style.display = 'flex';
        renderTaskFocusView();
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
        renderAll();
      }
    }

    function router(){
      const state = getState();
      const hash = window.location.hash || '#/';
      if(state.activeInterruption && hash !== '#/interruption'){
        window.location.hash = '#/interruption';
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
        const id = parseInt(hash.replace('#/task/', ''), 10);
        if(!isNaN(id)){
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
  };
})();
