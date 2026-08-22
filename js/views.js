/* views.js — Coordinador: ensambla los sub-módulos de vistas */
import { TodayTasksDashboard } from './views/dashboard.js';
import { TodayTasksMeetingsView } from './views/meetings.js';
import { TodayTasksTasksView } from './views/tasks.js';
import { TodayTasksBoardView } from './views/board.js';
import { TodayTasksFocusView } from './views/focus.js';

export function TodayTasksViews(ctx){
  /* Instanciar sub-módulos */
  const dashboard = TodayTasksDashboard(ctx);
  const meetingsV = TodayTasksMeetingsView(ctx);
  const tasksV    = TodayTasksTasksView(ctx);
  const boardV    = TodayTasksBoardView(ctx);
  const focusV    = TodayTasksFocusView(ctx);

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
    resetBoardScroll:       boardV.resetBoardScroll,
    /* Focus */
    renderInterruptionView: focusV.renderInterruptionView,
    renderTaskFocusView:    focusV.renderTaskFocusView,
    /* Orchestration */
    renderAll,
    smartRender
  };
}

export default TodayTasksViews;

