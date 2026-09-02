/* views.js — Coordinador: ensambla los sub-módulos de vistas */
import { TodayTasksDashboard } from './views/dashboard.js';
import { TodayTasksMeetingsView } from './views/meetings.js';
import { TodayTasksTasksView } from './views/tasks.js';
import { TodayTasksBoardView } from './views/board.js';
import { TodayTasksFocusView } from './views/focus.js';
import { TodayTasksTriageView } from './views/triage.js';

export function TodayTasksViews(ctx){
  /* Instanciar sub-módulos */
  const dashboard = TodayTasksDashboard(ctx);
  const meetingsV = TodayTasksMeetingsView(ctx);
  const tasksV    = TodayTasksTasksView(ctx);
  const boardV    = TodayTasksBoardView(ctx);
  const focusV    = TodayTasksFocusView(ctx);
  const triageV   = TodayTasksTriageView(ctx);

  const { getCurrentView } = ctx;

  function renderAll(){
    dashboard.renderClock();
    dashboard.renderEnvSwitcher();
    dashboard.renderHeaderStats();
    dashboard.renderTaskProgressBar();
    dashboard.refreshPlanningModeBtn();
    dashboard.refreshAutoBreakBtn();
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
    } else if(currentView === 'triage'){
      triageV.renderTriageView();
    }
    if(ctx.pipModule && ctx.pipModule.render){
      ctx.pipModule.render();
    }
    if(ctx.pipModule && ctx.pipModule.updateAppPipButtons){
      ctx.pipModule.updateAppPipButtons();
    }
  }

  function smartRender(){
    const currentView = getCurrentView ? getCurrentView() : 'main';
    if(currentView === 'interruption'){
      focusV.renderInterruptionView();
    } else if(currentView === 'task'){
      focusV.renderTaskFocusView();
    } else if(currentView === 'triage'){
      triageV.renderTriageView();
    } else {
      renderAll();
    }
    if(ctx.pipModule && ctx.pipModule.render){
      ctx.pipModule.render();
    }
    if(ctx.pipModule && ctx.pipModule.updateAppPipButtons){
      ctx.pipModule.updateAppPipButtons();
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
    refreshAutoBreakBtn:    dashboard.refreshAutoBreakBtn,
    /* Meetings */
    renderMeetings:         meetingsV.renderMeetings,
    /* Tasks */
    renderTasks:            tasksV.renderTasks,
    toggleTaskNotes:        tasksV.toggleTaskNotes,
    isTaskNotesExpanded:    tasksV.isTaskNotesExpanded,
    /* Board */
    renderBoard:            boardV.renderBoard,
    renderSummary:          boardV.renderSummary,
    resetBoardScroll:       boardV.resetBoardScroll,
    /* Focus */
    renderInterruptionView: focusV.renderInterruptionView,
    renderTaskFocusView:    focusV.renderTaskFocusView,
    /* Triage */
    renderTriageView:             triageV.renderTriageView,
    setTriageSortMode:            triageV.setTriageSortMode,
    toggleTriageGroup:            triageV.toggleTriageGroup,
    toggleAllTriageGroups:        triageV.toggleAllTriageGroups,
    handleTriageRowClick:         triageV.handleTriageRowClick,
    handleTriageRowDblClick:      triageV.handleTriageRowDblClick,
    toggleTriageTaskSelect:       triageV.toggleTriageTaskSelect,
    toggleTriageGroupSelect:      triageV.toggleTriageGroupSelect,
    clearTriageSelection:         triageV.clearTriageSelection,
    toggleTriageTaskStar:         triageV.toggleTriageTaskStar,
    moveTriageTaskToDate:         triageV.moveTriageTaskToDate,
    deleteTriageSingleTask:       triageV.deleteTriageSingleTask,
    openTriageSingleUrgency:      triageV.openTriageSingleUrgency,
    applyTriageSingleUrgency:     triageV.applyTriageSingleUrgency,
    closeTriagePopovers:          triageV.closeTriagePopovers,
    executeTriageMoveSelectedDate:triageV.executeTriageMoveSelectedDate,
    executeTriageBatchUrgency:    triageV.executeTriageBatchUrgency,
    executeTriageBatchStar:       triageV.executeTriageBatchStar,
    executeTriageBatchDelete:     triageV.executeTriageBatchDelete,
    toggleTriageDropdown:         triageV.toggleTriageDropdown,
    /* Orchestration */
    renderAll,
    smartRender
  };
}

export default TodayTasksViews;

