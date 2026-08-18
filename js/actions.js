/* actions.js — Coordinador: ensambla los sub-módulos de acciones */
(function(){
  "use strict";

  const _nowMinutes = () => window.TodayTasksUtils.nowMinutes();
  const { fmt, fmtDur, timeToMinutes } = window.TodayTasksUtils;
  const { showToast } = window.TodayTasksUi;

  window.TodayTasksActions = function(ctx){

    /* Helper compartido: modal de recurrencia */
    function showRecurringModal(title, desc, onInstance, onSeries) {
      const modal = document.getElementById("recurringModal");
      if (!modal) {
        if (window.confirm(`${title}\n\n${desc}\n\nPresiona ACEPTAR para solo esta ocurrencia, o CANCELAR para toda la serie.`)) {
          if (onInstance) onInstance();
        } else {
          if (onSeries) onSeries();
        }
        return;
      }
      document.getElementById("recurringModalTitle").textContent = title;
      document.getElementById("recurringModalDesc").textContent = desc;

      const btnInst = document.getElementById("recModalBtnInstance");
      const btnSeries = document.getElementById("recModalBtnSeries");
      const btnCancel = document.getElementById("recModalBtnCancel");

      modal.style.display = "flex";

      function cleanup() {
        modal.style.display = "none";
        btnInst.onclick = null;
        btnSeries.onclick = null;
        btnCancel.onclick = null;
      }

      btnInst.onclick = () => { cleanup(); if (onInstance) onInstance(); };
      btnSeries.onclick = () => { cleanup(); if (onSeries) onSeries(); };
      btnCancel.onclick = () => { cleanup(); };
    }

    /* Helpers compartidos que se inyectan en los sub-módulos */
    const helpers = {
      nowMinutes: _nowMinutes, fmt, fmtDur, timeToMinutes, showToast, showRecurringModal
    };

    /* Instanciar sub-módulos */
    const meetings  = window._TodayTasksMeetings(ctx, helpers);
    const tasks     = window._TodayTasksTasks(ctx, helpers);
    const dragdrop  = window._TodayTasksDragDrop(ctx);
    const execution = window._TodayTasksExecution(ctx, helpers);
    const calendar  = window._TodayTasksCalendar(ctx, helpers);

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
  };
})();
