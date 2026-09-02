/* actions.js — Coordinador: ensambla los sub-módulos de acciones */
import { TodayTasksMeetings } from './actions/meetings.js';
import { TodayTasksTasks } from './actions/tasks.js';
import { TodayTasksDragDrop } from './actions/dragdrop.js';
import { TodayTasksExecution } from './actions/execution.js';
import { TodayTasksCalendar } from './actions/calendar.js';
import { nowMinutes, fmt, fmtDur, timeToMinutes } from './utils.js';
import { showToast } from './ui.js';

export function TodayTasksActions(ctx) {
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

  /* Helper compartido: modal de límite de tareas destacadas (máx 5) */
  function showFeaturedLimitModal(targetTaskId, onResolve) {
    if (typeof document === "undefined") {
      return;
    }
    const modal = document.getElementById("featuredLimitModal");
    const state = ctx.getState();
    const targetTask = targetTaskId ? (state.tasks || []).find(t => String(t.id) === String(targetTaskId)) : null;
    const featuredTasks = (state.tasks || []).filter(t => t.featured && t.status !== 'completed' && (!targetTaskId || String(t.id) !== String(targetTaskId)));

    if (!modal) {
      if (typeof window !== "undefined" && window.confirm(`Has alcanzado el límite de 5 tareas destacadas.\n\n¿Deseas quitar el destacado de alguna para destacar "${targetTask ? targetTask.title : 'la nueva tarea'}"?`)) {
        if (featuredTasks.length > 0 && onResolve) {
          onResolve(featuredTasks[0].id);
        }
      }
      return;
    }

    const descEl = document.getElementById("featuredLimitModalDesc");
    const listEl = document.getElementById("featuredLimitModalList");
    const btnCancel = document.getElementById("featuredLimitModalBtnCancel");

    if (descEl) {
      descEl.innerHTML = targetTask
        ? `Para destacar <strong>"${targetTask.title}"</strong>`
        : `Para que la nueva tarea sea <strong>destacada</strong>`;
    }

    function cleanup() {
      modal.style.display = "none";
      if (btnCancel) btnCancel.onclick = null;
      modal.onclick = null;
    }

    if (listEl) {
      listEl.innerHTML = featuredTasks.map(t => `
        <button class="featured-limit-task-row" data-unfeature-id="${t.id}" title="Quitar destacado de esta tarea">
          <span class="featured-limit-task-star">⭐</span>
          <span class="featured-limit-task-name">${t.title}</span>
          <span class="featured-limit-task-action">Quitar ✕</span>
        </button>
      `).join("");

      listEl.querySelectorAll(".featured-limit-task-row").forEach(btn => {
        btn.onclick = () => {
          const unfeatureId = btn.dataset.unfeatureId;
          cleanup();
          if (onResolve) onResolve(unfeatureId);
        };
      });
    }

    modal.style.display = "flex";

    if (btnCancel) btnCancel.onclick = () => { cleanup(); };
    modal.onclick = (e) => {
      if (e.target === modal) cleanup();
    };
  }

  /* Helpers compartidos que se inyectan en los sub-módulos */
  const helpers = {
    nowMinutes, fmt, fmtDur, timeToMinutes, showToast, showRecurringModal, showFeaturedLimitModal
  };

  /* Instanciar sub-módulos */
  const meetings  = TodayTasksMeetings(ctx, helpers);
  const tasks     = TodayTasksTasks(ctx, helpers);
  const dragdrop  = TodayTasksDragDrop(ctx);
  const execution = TodayTasksExecution(ctx, helpers);
  const calendar  = TodayTasksCalendar(ctx, helpers);

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
  function rolloverPendingTasks(targetDate = null){
    return calendar.rolloverPendingTasks(materializeRecurringTasks, targetDate);
  }
  function rolloverPendingTasksToDate(targetDateStr){
    return calendar.rolloverPendingTasksToDate(targetDateStr, materializeRecurringTasks);
  }
  function openCopyTaskModal(taskId){
    calendar.openCopyTaskModal(taskId, calendar.copyTaskToDate, calendar.moveTaskToDate);
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
    setTaskUrgency:         tasks.setTaskUrgency,
    setTasksUrgency:        tasks.setTasksUrgency,
    setTaskFeatured:        tasks.setTaskFeatured,
    setTasksFeatured:       tasks.setTasksFeatured,
    toggleTaskFeatured:     tasks.toggleTaskFeatured,
    resolveFeaturedLimit:   tasks.resolveFeaturedLimit,
    setTaskStartAfter:      tasks.setTaskStartAfter,
    deleteTasks:            tasks.deleteTasks,
    deleteRecurringTaskInstance: tasks.deleteRecurringTaskInstance,
    showFeaturedLimitModal,
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
    rolloverPendingTasksToDate,
    countPendingAutoMoveTasks: calendar.countPendingAutoMoveTasks,
    selectDate,
    changeDateByDays,
    resetToToday,
    saveHistoryMetric:      calendar.saveHistoryMetric,
    deleteHistoryMetric:    calendar.deleteHistoryMetric,
    startNewDay:            calendar.startNewDay,
    copyTaskToDate:         calendar.copyTaskToDate,
    moveTaskToDate:         calendar.moveTaskToDate,
    moveTasksToDate:        calendar.moveTasksToDate,
    openCopyTaskModal
  };
}

export default TodayTasksActions;

