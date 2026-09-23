/* views/triage/index.js — Coordinador y punto de entrada de la vista de Triaje Rápido (#/triage) */
import {
  formatDateFriendly, getNextWorkingDays, matchesTaskSearch
} from '../../utils.js';
import { createTriageData } from './triage-data.js';
import { createTriageEvents } from './triage-events.js';
import { createTriageRender } from './triage-render.js';
import { createTriageBatch } from './triage-batch.js';
import { createTriageDragDrop } from './triage-dragdrop.js';
import { createTriageTaskModal } from './triage-task-modal.js';

export function TodayTasksTriageView(ctx) {
  const { getState, getTaskEdit } = ctx;

  let currentSort = 'urgency'; // 'urgency' | 'viability' | 'duration' | 'featured'
  const collapsedGroups = new Set(['days', 'week', 'later']); // por defecto 'today' abierto, resto plegados
  const selectedTaskIds = new Set();
  let activeSingleUrgencyTaskId = null;
  let activeMoveSheetTaskId = null;
  let triageClickTimer = null;
  let lastRenderedDate = null;
  let triageSearchQuery = '';

  function triggerRender() {
    renderTriageView();
  }

  const dataModule = createTriageData(
    ctx,
    {
      collapsedGroups,
      get currentSort() { return currentSort; },
      set currentSort(val) { currentSort = val; }
    },
    {
      renderTriageView: triggerRender
    }
  );

  const {
    getActions,
    getTargetDateStr,
    compareTasksMainOrder,
    getAllTasks,
    getActiveTasks,
    formatShortDuration,
    getEffectiveSchedule,
    getGroups,
    setTriageSortMode,
    toggleTriageGroup,
    toggleAllTriageGroups
  } = dataModule;

  const batchModule = createTriageBatch(
    ctx,
    {
      selectedTaskIds,
      get activeSingleUrgencyTaskId() { return activeSingleUrgencyTaskId; },
      set activeSingleUrgencyTaskId(val) { activeSingleUrgencyTaskId = val; }
    },
    {
      getTargetDateStr,
      getActiveTasks,
      getGroups,
      getActions,
      renderTriageView: triggerRender
    }
  );

  const {
    toggleTriageTaskSelect,
    toggleTriageGroupSelect,
    clearTriageSelection,
    openTriageSingleUrgency,
    applyTriageSingleUrgency,
    closeTriagePopovers,
    toggleTriageDropdown,
    executeTriageMoveSelectedDate,
    executeTriageBatchUrgency,
    executeTriageBatchStar,
    executeTriageBatchDelete,
    executeTriageBatchComplete,
    executeTriageBatchMoveDirection,
    triageUndo,
    triageRedo,
    canTriageUndo,
    canTriageRedo
  } = batchModule;

  const dragDropModule = createTriageDragDrop(
    ctx,
    {
      selectedTaskIds,
      get activeMoveSheetTaskId() { return activeMoveSheetTaskId; },
      set activeMoveSheetTaskId(val) { activeMoveSheetTaskId = val; },
      get currentSort() { return currentSort; },
      get triageClickTimer() { return triageClickTimer; },
      set triageClickTimer(val) { triageClickTimer = val; }
    },
    {
      getTargetDateStr,
      getActiveTasks,
      getGroups,
      getActions,
      renderTriageView: triggerRender
    }
  );

  const {
    moveTriageTaskDirection,
    openMobileMoveSheet,
    closeMobileMoveSheet,
    getActiveMoveSheetTaskId,
    touchEngine,
    handleTriageTouchStart,
    handleTriageTouchMove,
    handleTriageTouchEnd,
    handleTriageTouchCancel,
    handleTriageMouseDown,
    wasJustDragged,
    triageTaskDragStart,
    triageGroupDragOver,
    triageGroupDrop,
    triageTaskDrop
  } = dragDropModule;

  const taskModalModule = createTriageTaskModal(
    ctx,
    {},
    {
      getActions,
      renderTriageView: triggerRender,
      getTaskEdit: () => (getTaskEdit ? getTaskEdit() : (ctx.getTaskEdit ? ctx.getTaskEdit() : null))
    }
  );

  const {
    openTriageNewTaskModal,
    toggleTriageEditRecurring,
    onTriageRecurrenceFreqChange,
    toggleTriageRecurrenceDay,
    clearTriageRecurrenceEndDate,
    submitTriageNewTask,
    openMobileAddModal,
    closeMobileAddModal,
    handleTriageAddBarSubmit,
    handleMobileAddModalSubmit,
    focusTriageAddBar
  } = taskModalModule;

  const eventsModule = createTriageEvents(
    ctx,
    {
      selectedTaskIds,
      get triageSearchQuery() { return triageSearchQuery; },
      set triageSearchQuery(val) { triageSearchQuery = val; },
      get triageClickTimer() { return triageClickTimer; },
      set triageClickTimer(val) { triageClickTimer = val; }
    },
    {
      getTargetDateStr,
      getActiveTasks,
      getActions,
      renderTriageView: triggerRender,
      wasJustDragged,
      toggleTriageTaskSelect
    }
  );

  const {
    setTriageSearchQuery,
    getTriageSearchQuery,
    clearTriageSearch,
    isMobileViewport,
    handleTriageRowClick,
    handleTriageRowDblClick,
    toggleTriageTaskStar,
    moveTriageTaskToDate,
    completeTriageSingleTask,
    deleteTriageSingleTask
  } = eventsModule;

  const renderModule = createTriageRender(
    ctx,
    {
      selectedTaskIds,
      collapsedGroups
    },
    {
      getTargetDateStr,
      getActiveTasks,
      getEffectiveSchedule,
      formatShortDuration,
      setTriageSearchQuery,
      clearTriageSearch,
      getActions
    }
  );

  const {
    renderTriageDependencyChips,
    renderTriageCompletedRow,
    renderTriageTaskRow,
    renderTriageGroupsContent,
    setupTriageSearch,
    syncTriageEditModal,
    buildFloatingBarHTML,
    buildMobileBottomSheetHTML,
    updateTriageViewSelective,
    buildTriageFullHTML,
    renderTriageViewFullOrSelective
  } = renderModule;

  function renderTriageView() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('view-triage');
    if (!container) return;

    const state = getState();
    const targetDateStr = getTargetDateStr();
    const isDifferentDate = lastRenderedDate !== targetDateStr;
    if (isDifferentDate) {
      lastRenderedDate = targetDateStr;
      selectedTaskIds.clear();
      closeTriagePopovers();
    }
    const allActiveTasks = getActiveTasks(targetDateStr);
    const searchQuery = (triageSearchQuery || '').trim();
    const isSearching = searchQuery.length > 0;

    const activeTasks = isSearching
      ? allActiveTasks.filter(t => matchesTaskSearch(t, searchQuery))
      : allActiveTasks;

    const allTasksOfDate = getAllTasks(targetDateStr);
    const matchingCompleted = isSearching
      ? allTasksOfDate.filter(t => t && t.status === 'completed' && matchesTaskSearch(t, searchQuery))
                      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      : [];

    const schedule = getEffectiveSchedule(targetDateStr, allActiveTasks);
    const groups = getGroups(activeTasks, targetDateStr, schedule);

    const next7Days = getNextWorkingDays(targetDateStr, 7, state, state.activeEnv || 'work');
    const quick5Days = next7Days.slice(0, 5);

    const totalMinutes = activeTasks.reduce((sum, task) => sum + (task.planned || 0), 0);
    const friendlyDate = formatDateFriendly ? formatDateFriendly(targetDateStr) : targetDateStr;
    const selectedCount = selectedTaskIds.size;

    const taskEdit = (getTaskEdit ? getTaskEdit() : (ctx.getTaskEdit ? ctx.getTaskEdit() : null));
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;

    syncTriageEditModal(taskEdit, env);

    renderTriageViewFullOrSelective({
      container,
      isDifferentDate,
      activeTasks,
      groups,
      isSearching,
      matchingCompleted,
      friendlyDate,
      searchQuery,
      env,
      quick5Days,
      schedule,
      allActiveTasksCount: allActiveTasks.length,
      targetDateStr,
      totalMinutes,
      selectedCount,
      currentSort,
      canUndo: canTriageUndo(),
      canRedo: canTriageRedo(),
      triageSearchQuery,
      next7Days
    });
  }

  // Listener global para cerrar menús al hacer clic fuera
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#triageMoveDropdown') &&
          !e.target.closest('#triageBatchUrgencyDropdown') &&
          !e.target.closest('#triageSingleUrgencyPopover') &&
          !e.target.closest('.triage-urgency-btn') &&
          !e.target.closest('.triage-dropdown-anchor')) {
        closeTriagePopovers();
      }
    });
  }

  function applyAutoOrder() {
    const actions = getActions();
    if (actions && actions.applyAutoOrder) {
      actions.applyAutoOrder();
    }
  }

  return {
    renderTriageView,
    setTriageSortMode,
    toggleTriageGroup,
    toggleAllTriageGroups,
    handleTriageRowClick,
    handleTriageRowDblClick,
    toggleTriageTaskSelect,
    toggleTriageGroupSelect,
    clearTriageSelection,
    toggleTriageTaskStar,
    moveTriageTaskToDate,
    completeTriageSingleTask,
    deleteTriageSingleTask,
    openTriageSingleUrgency,
    applyTriageSingleUrgency,
    closeTriagePopovers,
    executeTriageMoveSelectedDate,
    executeTriageBatchUrgency,
    executeTriageBatchStar,
    executeTriageBatchComplete,
    executeTriageBatchDelete,
    toggleTriageDropdown,
    getTargetDateStr,
    applyAutoOrder,
    triageUndo,
    triageRedo,
    canTriageUndo,
    canTriageRedo,
    submitTriageNewTask,
    openTriageNewTaskModal,
    toggleTriageEditRecurring,
    onTriageRecurrenceFreqChange,
    toggleTriageRecurrenceDay,
    clearTriageRecurrenceEndDate,
    openMobileAddModal,
    closeMobileAddModal,
    handleTriageAddBarSubmit,
    handleMobileAddModalSubmit,
    focusTriageAddBar,
    moveTriageTaskDirection,
    executeTriageBatchMoveDirection,
    openMobileMoveSheet,
    closeMobileMoveSheet,
    getActiveMoveSheetTaskId,
    handleTriageTouchStart,
    handleTriageTouchMove,
    handleTriageTouchEnd,
    handleTriageTouchCancel,
    handleTriageMouseDown,
    triageTaskDragStart,
    triageTaskDrop,
    triageGroupDragOver,
    triageGroupDrop,
    getSelectedTaskIds: () => selectedTaskIds,
    setTriageSearchQuery,
    getTriageSearchQuery,
    clearTriageSearch
  };
}

export default TodayTasksTriageView;
