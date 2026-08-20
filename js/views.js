/* views.js — Coordinador: ensambla los sub-módulos de vistas */
import { TodayTasksDashboard } from './views/dashboard.js';
import { TodayTasksMeetingsView } from './views/meetings.js';
import { TodayTasksTasksView } from './views/tasks.js';
import { TodayTasksBoardView } from './views/board.js';
import { TodayTasksFocusView } from './views/focus.js';

export function TodayTasksViews(ctx){
  /* Instanciar sub-módulos */
  const dashboardFactory = (typeof window !== "undefined" && window._TodayTasksDashboard) ? window._TodayTasksDashboard : TodayTasksDashboard;
  const meetingsVFactory = (typeof window !== "undefined" && window._TodayTasksMeetingsView) ? window._TodayTasksMeetingsView : TodayTasksMeetingsView;
  const tasksVFactory    = (typeof window !== "undefined" && window._TodayTasksTasksView) ? window._TodayTasksTasksView : TodayTasksTasksView;
  const boardVFactory    = (typeof window !== "undefined" && window._TodayTasksBoardView) ? window._TodayTasksBoardView : TodayTasksBoardView;
  const focusVFactory    = (typeof window !== "undefined" && window._TodayTasksFocusView) ? window._TodayTasksFocusView : TodayTasksFocusView;

  const dashboard  = dashboardFactory(ctx);
  const meetingsV  = meetingsVFactory(ctx);
  const tasksV     = tasksVFactory(ctx);
  const boardV     = boardVFactory(ctx);
  const focusV     = focusVFactory(ctx);

  const { getCurrentView } = ctx;

  function renderAll(){
    dashboard.renderClock();
    dashboard.renderEnvSwitcher();
    dashboard.renderHeaderStats();
    dashboard.renderTaskProgressBar();
    const schedule = ctx.computeSchedule ? ctx.computeSchedule() : null;
    meetingsV.renderMeetings();
    tasksV.renderTasks(schedule);
    boardV.renderBoard(schedule);
    boardV.renderSummary(schedule);
    const currentView = getCurrentView ? getCurrentView() : 'main';
    if(currentView === 'task'){
      focusV.renderTaskFocusView();
    } else if(currentView === 'interruption'){
      focusV.renderInterruptionView();
    }
  }

  function smartRender(){
    const currentView = getCurrentView ? getCurrentView() : 'main';
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
}

if (typeof window !== "undefined") {
  window.TodayTasksViews = TodayTasksViews;
}

export default TodayTasksViews;

