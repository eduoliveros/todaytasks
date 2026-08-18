/* views.js — Coordinador: ensambla los sub-módulos de vistas */
(function(){
  "use strict";

  window.TodayTasksViews = function(ctx){
    /* Instanciar sub-módulos */
    const dashboard  = window._TodayTasksDashboard(ctx);
    const meetingsV  = window._TodayTasksMeetingsView(ctx);
    const tasksV     = window._TodayTasksTasksView(ctx);
    const boardV     = window._TodayTasksBoardView(ctx);
    const focusV     = window._TodayTasksFocusView(ctx);

    const { getCurrentView } = ctx;

    function renderAll(){
      dashboard.renderClock();
      dashboard.renderEnvSwitcher();
      dashboard.renderHeaderStats();
      dashboard.renderTaskProgressBar();
      const schedule = ctx.computeSchedule();
      meetingsV.renderMeetings();
      tasksV.renderTasks(schedule);
      boardV.renderBoard(schedule);
      boardV.renderSummary(schedule);
      const currentView = getCurrentView();
      if(currentView === 'task'){
        focusV.renderTaskFocusView();
      } else if(currentView === 'interruption'){
        focusV.renderInterruptionView();
      }
    }

    function smartRender(){
      const currentView = getCurrentView();
      if(currentView === 'interruption'){
        focusV.renderInterruptionView();
      } else if(currentView === 'task'){
        focusV.renderTaskFocusView();
      } else {
        renderAll();
      }
    }

    return {
      /* Dashboard */
      renderClock:            dashboard.renderClock,
      renderEnvSwitcher:      dashboard.renderEnvSwitcher,
      renderHeaderStats:      dashboard.renderHeaderStats,
      renderTaskProgressBar:  dashboard.renderTaskProgressBar,
      syncFormInputsFromState:dashboard.syncFormInputsFromState,
      refreshPlanningModeBtn: dashboard.refreshPlanningModeBtn,
      /* Meetings */
      renderMeetings:         meetingsV.renderMeetings,
      /* Tasks */
      renderTasks:            tasksV.renderTasks,
      /* Board */
      renderBoard:            boardV.renderBoard,
      renderSummary:          boardV.renderSummary,
      /* Focus */
      renderInterruptionView: focusV.renderInterruptionView,
      renderTaskFocusView:    focusV.renderTaskFocusView,
      /* Orchestration */
      renderAll,
      smartRender
    };
  };
})();
