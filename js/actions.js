/* actions.js — Coordinador: ensambla los sub-módulos de acciones */
import { TodayTasksMeetings } from './actions/meetings.js';
import { TodayTasksTasks } from './actions/tasks.js';
import { TodayTasksDragDrop } from './actions/dragdrop.js';
import { TodayTasksExecution } from './actions/execution.js';
import { TodayTasksCalendar } from './actions/calendar.js';
import { nowMinutes, fmt, fmtDur, timeToMinutes } from './utils.js';
import { showToast } from './ui.js';

export function TodayTasksActions(ctx) {
  const _nowMinutes = () => {
    return (typeof window !== "undefined" && window.TodayTasksUtils && window.TodayTasksUtils.nowMinutes)
      ? window.TodayTasksUtils.nowMinutes()
      : nowMinutes();
  };

  const _fmt = (min) => {
    return (typeof window !== "undefined" && window.TodayTasksUtils && window.TodayTasksUtils.fmt)
      ? window.TodayTasksUtils.fmt(min)
      : fmt(min);
  };

  const _fmtDur = (min) => {
    return (typeof window !== "undefined" && window.TodayTasksUtils && window.TodayTasksUtils.fmtDur)
      ? window.TodayTasksUtils.fmtDur(min)
      : fmtDur(min);
  };

  const _timeToMinutes = (str) => {
    return (typeof window !== "undefined" && window.TodayTasksUtils && window.TodayTasksUtils.timeToMinutes)
      ? window.TodayTasksUtils.timeToMinutes(str)
      : timeToMinutes(str);
  };

  const _showToast = (msg) => {
    return (typeof window !== "undefined" && window.TodayTasksUi && window.TodayTasksUi.showToast)
      ? window.TodayTasksUi.showToast(msg)
      : showToast(msg);
  };

  /* Helper compartido: modal de recurrencia */
  function showRecurringModal(title, desc, onInstance, onSeries) {
    if (typeof document === "undefined") {
      if (onInstance) onInstance();
      return;
    }
    const modal = document.getElementById("recurringModal");
    if (!modal) {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${desc}\n\nPresiona ACEPTAR para solo esta ocurrencia, o CANCELAR para toda la serie.`)) {
        if (onInstance) onInstance();
      } else {
        if (onSeries) onSeries();
      }
      return;
    }
    const titleEl = document.getElementById("recurringModalTitle");
    const descEl = document.getElementById("recurringModalDesc");
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;

    const btnInst = document.getElementById("recModalBtnInstance");
    const btnSeries = document.getElementById("recModalBtnSeries");
    const btnCancel = document.getElementById("recModalBtnCancel");

    modal.style.display = "flex";

    function cleanup() {
      modal.style.display = "none";
      if (btnInst) btnInst.onclick = null;
      if (btnSeries) btnSeries.onclick = null;
      if (btnCancel) btnCancel.onclick = null;
    }

    if (btnInst) btnInst.onclick = () => { cleanup(); if (onInstance) onInstance(); };
    if (btnSeries) btnSeries.onclick = () => { cleanup(); if (onSeries) onSeries(); };
    if (btnCancel) btnCancel.onclick = () => { cleanup(); };
  }

  /* Helpers compartidos que se inyectan en los sub-módulos */
  const helpers = {
    nowMinutes: _nowMinutes, fmt: _fmt, fmtDur: _fmtDur, timeToMinutes: _timeToMinutes, showToast: _showToast, showRecurringModal
  };

  /* Instanciar sub-módulos */
  const meetingsFactory = (typeof window !== "undefined" && window._TodayTasksMeetings) ? window._TodayTasksMeetings : TodayTasksMeetings;
  const tasksFactory = (typeof window !== "undefined" && window._TodayTasksTasks) ? window._TodayTasksTasks : TodayTasksTasks;
  const dragdropFactory = (typeof window !== "undefined" && window._TodayTasksDragDrop) ? window._TodayTasksDragDrop : TodayTasksDragDrop;
  const executionFactory = (typeof window !== "undefined" && window._TodayTasksExecution) ? window._TodayTasksExecution : TodayTasksExecution;
  const calendarFactory = (typeof window !== "undefined" && window._TodayTasksCalendar) ? window._TodayTasksCalendar : TodayTasksCalendar;

  const meetings  = meetingsFactory(ctx, helpers);
  const tasks     = tasksFactory(ctx, helpers);
  const dragdrop  = dragdropFactory(ctx);
  const execution = executionFactory(ctx, helpers);
  const calendar  = calendarFactory(ctx, helpers);

  /* Las funciones de calendar necesitan referencias cruzadas a tasks */
  const { materializeRecurringTasks } = tasks;
  const rollover = () => calendar.rolloverPendingTasks(materializeRecurringTasks);

  /* Wrappers de calendar que inyectan las dependencias de tareas */
  function selectDate(dateStr){
    calendar.selectDate(dateStr, materializeRecurringTasks, rollover);
  }
  function changeDateByDays(deltaDays){
    calendar.changeDateByDays(deltaDays, selectDate);
  }
  function resetToToday(){
    calendar.resetToToday(materializeRecurringTasks, rollover);
  }
  function rolloverPendingTasks(){
    return calendar.rolloverPendingTasks(materializeRecurringTasks);
  }
  function openCopyTaskModal(taskId){
    calendar.openCopyTaskModal(taskId, calendar.copyTaskToDate);
  }

  return {
    /* Meetings */
    addMeeting:             meetings.addMeeting,
    deleteMeeting:          meetings.deleteMeeting,
    startEditMeeting:       meetings.startEditMeeting,
    updateMeetingEditField: meetings.updateMeetingEditField,
    cancelEditMeeting:      meetings.cancelEditMeeting,
    saveEditMeeting:        meetings.saveEditMeeting,
    /* Tasks */
    materializeRecurringTasks,
    addTask:                tasks.addTask,
    deleteTask:             tasks.deleteTask,
    startEditTask:          tasks.startEditTask,
    updateTaskEditField:    tasks.updateTaskEditField,
    cancelEditTask:         tasks.cancelEditTask,
    saveEditTask:           tasks.saveEditTask,
    updateTaskTimeFast:     tasks.updateTaskTimeFast,
    moveTask:               tasks.moveTask,
    /* Drag & Drop */
    armTaskDrag:            dragdrop.armTaskDrag,
    taskDragStart:          dragdrop.taskDragStart,
    taskDragOver:           dragdrop.taskDragOver,
    taskDragLeave:          dragdrop.taskDragLeave,
    taskDrop:               dragdrop.taskDrop,
    taskDragEnd:            dragdrop.taskDragEnd,
    /* Execution */
    startTask:              execution.startTask,
    pauseTask:              execution.pauseTask,
    resumeTask:             execution.resumeTask,
    completeTask:           execution.completeTask,
    uncompleteTask:         execution.uncompleteTask,
    startInterruption:      execution.startInterruption,
    updateInterruptionTitle:execution.updateInterruptionTitle,
    completeInterruption:   execution.completeInterruption,
    cancelInterruption:     execution.cancelInterruption,
    /* Calendar */
    switchEnvironment:      calendar.switchEnvironment,
    rolloverPendingTasks,
    selectDate,
    changeDateByDays,
    resetToToday,
    saveHistoryMetric:      calendar.saveHistoryMetric,
    deleteHistoryMetric:    calendar.deleteHistoryMetric,
    startNewDay:            calendar.startNewDay,
    copyTaskToDate:         calendar.copyTaskToDate,
    openCopyTaskModal
  };
}

if (typeof window !== "undefined") {
  window.TodayTasksActions = TodayTasksActions;
}

export default TodayTasksActions;

