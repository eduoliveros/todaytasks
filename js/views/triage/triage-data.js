/* views/triage/triage-data.js — Acceso a datos, ordenación, grupos y proyección de horarios en triaje */
import {
  nowMinutes, getTodayStr, DEFAULT_URGENCY
} from '../../utils.js';
import { computeSchedule } from '../../scheduler.js';
import { t } from '../../i18n.js';

export function createTriageData(ctx, state, deps) {
  const { getState, actionsModule } = ctx;
  const { renderTriageView } = deps;

  const collapsedGroups = state.collapsedGroups;

  function getCurrentSort() {
    return typeof state.currentSort === 'function' ? state.currentSort() : (state.currentSort || 'urgency');
  }

  function setCurrentSort(val) {
    if (typeof state.setCurrentSort === 'function') {
      state.setCurrentSort(val);
    } else {
      state.currentSort = val;
    }
  }

  function getActions() {
    return ctx.actionsModule || actionsModule || (typeof window !== 'undefined' ? window.app : null) || {};
  }

  function getTargetDateStr() {
    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    return currentState.selectedDate || getTodayStr();
  }

  function compareTasksMainOrder(a, b) {
    if (a.status === 'running') return -1;
    if (b.status === 'running') return 1;
    return (a.order || 0) - (b.order || 0);
  }

  function getAllTasks(targetDateStr) {
    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    const envKey = currentState.activeEnv || 'work';
    const env = currentState.environments ? (currentState.environments[envKey] || currentState.environments.work) : null;
    const dayObj = env && env.days ? env.days[targetDateStr] : null;

    let tasksList = [];
    if (dayObj && Array.isArray(dayObj.tasks) && dayObj.tasks.length > 0) {
      tasksList = dayObj.tasks;
    } else if (targetDateStr === (currentState.selectedDate || getTodayStr()) && Array.isArray(currentState.tasks) && currentState.tasks.length > 0) {
      tasksList = currentState.tasks;
    } else if (dayObj && Array.isArray(dayObj.tasks)) {
      tasksList = dayObj.tasks;
    } else if (targetDateStr === (currentState.selectedDate || getTodayStr()) && Array.isArray(currentState.tasks)) {
      tasksList = currentState.tasks;
    }
    return tasksList;
  }

  function getActiveTasks(targetDateStr) {
    return getAllTasks(targetDateStr).filter(task => task && task.status !== 'completed').sort(compareTasksMainOrder);
  }

  function formatShortDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function getEffectiveSchedule(targetDateStr, activeTasks) {
    const currentState = getState ? getState() : (ctx.getState ? ctx.getState() : {});
    const isToday = targetDateStr === getTodayStr();

    if (ctx && typeof ctx.computeSchedule === 'function' && (currentState.selectedDate || getTodayStr()) === targetDateStr) {
      const sched = ctx.computeSchedule();
      if (sched && sched.overflowIds && sched.segmentsByTask) {
        return sched;
      }
    }

    const envKey = currentState.activeEnv || 'work';
    const env = currentState.environments ? (currentState.environments[envKey] || currentState.environments.work) : null;
    const dayObj = env && env.days ? env.days[targetDateStr] : null;

    let workStart = currentState.workStart;
    let workEnd = currentState.workEnd;
    let meetings = currentState.meetings;

    if (currentState.selectedDate !== targetDateStr && dayObj) {
      if (dayObj.hasCustomHours && dayObj.workStart !== undefined) {
        workStart = dayObj.workStart;
      }
      if (dayObj.hasCustomHours && dayObj.workEnd !== undefined) {
        workEnd = dayObj.workEnd;
      }
      if (Array.isArray(dayObj.meetings)) {
        meetings = dayObj.meetings;
      }
    }

    if (workStart === null || workStart === undefined) workStart = 9 * 60;
    if (workEnd === null || workEnd === undefined) workEnd = 18 * 60;
    if (!Array.isArray(meetings)) meetings = [];

    const schedState = {
      ...currentState,
      workStart,
      workEnd,
      meetings,
      tasks: activeTasks,
      selectedDate: targetDateStr,
      planningMode: isToday ? !!currentState.planningMode : true,
      autoBreakEnabled: currentState.autoBreakEnabled !== false,
      autoBreakIntervalMin: currentState.autoBreakIntervalMin || 60,
      autoBreakDurationMin: currentState.autoBreakDurationMin || 10
    };

    const nowFn = (ctx && ctx.nowMinutes) ? ctx.nowMinutes : nowMinutes;
    return computeSchedule(schedState, nowFn);
  }

  function getGroups(activeTasks, targetDateStr, schedule) {
    if (!schedule) schedule = getEffectiveSchedule(targetDateStr, activeTasks);
    const overflowIds = schedule && schedule.overflowIds ? schedule.overflowIds : new Set();

    function isTaskOverflow(task) {
      if (!overflowIds || !task) return false;
      const tid = task.id;
      if (overflowIds.has(tid)) return true;
      if (overflowIds.has(String(tid))) return true;
      if (typeof tid === 'string' && !isNaN(Number(tid)) && overflowIds.has(Number(tid))) return true;
      if (typeof tid === 'number' && overflowIds.has(String(tid))) return true;
      return false;
    }

    const sortMode = getCurrentSort();

    if (sortMode === 'urgency') {
      const groups = [
        { id: 'today', title: t('triage.groupToday'), icon: '🟠', tasks: [] },
        { id: 'days', title: t('triage.groupDays'), icon: '🔵', tasks: [] },
        { id: 'week', title: t('triage.groupWeek'), icon: '🟣', tasks: [] },
        { id: 'later', title: t('triage.groupLater'), icon: '⚪', tasks: [] }
      ];
      activeTasks.forEach(task => {
        const u = task.urgency || DEFAULT_URGENCY;
        const g = groups.find(x => x.id === u) || groups[1];
        g.tasks.push({ ...task, overflow: isTaskOverflow(task) });
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (sortMode === 'viability') {
      const isToday = targetDateStr === getTodayStr();
      const groups = [
        { id: 'fits', title: isToday ? t('triage.groupFitsToday') : t('triage.groupFitsWorkday'), icon: '✅', tasks: [] },
        { id: 'overflow', title: t('triage.groupOverflow'), icon: '⚠️', tasks: [] }
      ];
      activeTasks.forEach(task => {
        const isOverflow = isTaskOverflow(task);
        if (!isOverflow) {
          groups[0].tasks.push({ ...task, overflow: false });
        } else {
          groups[1].tasks.push({ ...task, overflow: true });
        }
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (sortMode === 'duration') {
      const groups = [
        { id: 'quick', title: t('triage.groupQuick'), icon: '⚡', tasks: [] },
        { id: 'medium', title: t('triage.groupMedium'), icon: '⏳', tasks: [] },
        { id: 'long', title: t('triage.groupLong'), icon: '🏋️', tasks: [] }
      ];
      activeTasks.forEach(task => {
        const dur = task.planned || 0;
        const item = { ...task, overflow: isTaskOverflow(task) };
        if (dur <= 15) groups[0].tasks.push(item);
        else if (dur <= 45) groups[1].tasks.push(item);
        else groups[2].tasks.push(item);
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    if (sortMode === 'featured') {
      const groups = [
        { id: 'feat', title: t('triage.groupFeatured'), icon: '⭐', tasks: [] },
        { id: 'unfeat', title: t('triage.groupUnfeatured'), icon: '📋', tasks: [] }
      ];
      activeTasks.forEach(task => {
        const item = { ...task, overflow: isTaskOverflow(task) };
        if (task.featured) groups[0].tasks.push(item);
        else groups[1].tasks.push(item);
      });
      groups.forEach(g => g.tasks.sort(compareTasksMainOrder));
      return groups;
    }

    return [];
  }

  function setTriageSortMode(mode) {
    if (!['urgency', 'viability', 'duration', 'featured'].includes(mode)) return;
    setCurrentSort(mode);
    collapsedGroups.clear();
    if (mode === 'urgency') {
      collapsedGroups.add('days');
      collapsedGroups.add('week');
      collapsedGroups.add('later');
    } else if (mode === 'duration') {
      collapsedGroups.add('long');
    } else if (mode === 'featured') {
      collapsedGroups.add('unfeat');
    }
    renderTriageView();
  }

  function toggleTriageGroup(groupId) {
    if (collapsedGroups.has(groupId)) {
      collapsedGroups.delete(groupId);
    } else {
      collapsedGroups.add(groupId);
    }
    renderTriageView();
  }

  function toggleAllTriageGroups(open) {
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const groups = getGroups(activeTasks, targetDateStr);
    if (open) {
      collapsedGroups.clear();
    } else {
      groups.forEach(g => collapsedGroups.add(g.id));
    }
    renderTriageView();
  }

  return {
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
    toggleAllTriageGroups,
  };
}
