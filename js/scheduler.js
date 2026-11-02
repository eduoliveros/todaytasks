import { findTaskInEnvironment } from './utils.js';

export function computeMeetingClusters(meetings, autoBreakEnabled = true) {
  if (!meetings || meetings.length === 0) return [];
  const sorted = [...meetings].sort((a, b) => a.start - b.start || a.end - b.end);
  const clusters = [];
  let currentCluster = null;

  for (const m of sorted) {
    if (!currentCluster) {
      currentCluster = { start: m.start, end: m.end, meetings: [m] };
    } else if (m.start <= currentCluster.end) {
      // Overlapping or back-to-back meeting
      currentCluster.end = Math.max(currentCluster.end, m.end);
      currentCluster.meetings.push(m);
    } else {
      clusters.push(currentCluster);
      currentCluster = { start: m.start, end: m.end, meetings: [m] };
    }
  }
  if (currentCluster) {
    clusters.push(currentCluster);
  }

  return clusters.map(c => {
    const duration = c.end - c.start;
    const breakDuration = autoBreakEnabled !== false
      ? Math.max(10, Math.round((duration / 60) * 10))
      : 10;
    return {
      start: c.start,
      end: c.end,
      meetings: c.meetings,
      duration,
      breakDuration,
      blockedEnd: c.end + breakDuration
    };
  });
}

export function blockedIntervals(state) {
  const autoBreakEnabled = state.autoBreakEnabled !== false;
  const clusters = computeMeetingClusters(state.meetings || [], autoBreakEnabled);
  const merged = [];
  for (const c of clusters) {
    const iv = { start: c.start, end: c.blockedEnd };
    if (merged.length && iv.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
    } else {
      merged.push(iv);
    }
  }
  return merged;
}

function getTaskDependencyStatus(t, state, env, segmentsByTask, remainingQueue) {
  if (!Array.isArray(t.dependsOn) || t.dependsOn.length === 0) {
    return { isBlockedExternally: false, isWaitingSameDay: false, minStartFromDeps: 0 };
  }

  let isBlockedExternally = false;
  let isWaitingSameDay = false;
  let minStartFromDeps = 0;

  for (const depId of t.dependsOn) {
    const strDepId = String(depId);
    const sameDayTask = (state.tasks || []).find(x => x && String(x.id) === strDepId);

    if (sameDayTask) {
      if (sameDayTask.status === 'completed') {
        continue;
      }
      if (segmentsByTask[strDepId] && segmentsByTask[strDepId].length > 0) {
        const lastSeg = segmentsByTask[strDepId][segmentsByTask[strDepId].length - 1];
        minStartFromDeps = Math.max(minStartFromDeps, lastSeg.end);
      } else {
        const isStillInQueue = remainingQueue.some(x => x && String(x.id) === strDepId);
        if (isStillInQueue) {
          isWaitingSameDay = true;
        } else {
          isBlockedExternally = true;
        }
      }
    } else {
      const found = findTaskInEnvironment(env, strDepId);
      if (found && found.task) {
        if (found.task.status === 'completed') {
          continue;
        } else {
          isBlockedExternally = true;
        }
      }
    }
  }

  return { isBlockedExternally, isWaitingSameDay, minStartFromDeps };
}

export function computeSchedule(state, nowMinutes) {
  const now = typeof nowMinutes === "function" ? nowMinutes() : nowMinutes;
  const autoBreakEnabled = state.autoBreakEnabled !== false;
  const intervalLimit = state.autoBreakIntervalMin || 60;
  const baseBreakDur = state.autoBreakDurationMin || 10;

  const blocked = blockedIntervals(state);
  const segmentsByTask = {};
  const overflowIds = new Set();
  const breaks = [];

  const running = (state.tasks || []).find(t => t.status === "running");
  const workStartVal = state.workStart !== null && state.workStart !== undefined ? state.workStart : 9 * 60;
  const workEndVal = state.workEnd !== null && state.workEnd !== undefined ? state.workEnd : 24 * 60;

  const viewStart = state.planningMode ? workStartVal : now;
  let cursor;
  let continuousWork = 0;
  let lastPlacedEnd;

  if (running) {
    const plannedEnd = running.runningStart + (running.planned - (running.elapsedBefore || 0));
    const effectiveEnd = Math.max(plannedEnd, now);
    segmentsByTask[running.id] = [{ start: running.runningStart, end: effectiveEnd }];
    if (effectiveEnd > workEndVal) {
      overflowIds.add(running.id);
    }
    continuousWork = Math.max(0, effectiveEnd - running.runningStart);

    cursor = state.planningMode ? Math.max(effectiveEnd, workStartVal) : effectiveEnd;
    lastPlacedEnd = effectiveEnd;

    if (autoBreakEnabled && continuousWork >= intervalLimit) {
      const breakDur = Math.max(baseBreakDur, Math.round((continuousWork / 60) * 10));
      breaks.push({ start: effectiveEnd, end: effectiveEnd + breakDur, duration: breakDur });
      cursor = Math.max(cursor, effectiveEnd + breakDur);
      lastPlacedEnd = cursor;
      continuousWork = 0;
    }
  } else {
    cursor = viewStart;
    continuousWork = 0;
    lastPlacedEnd = cursor;
  }

  const queue = (state.tasks || [])
    .filter(t => t.status === "pending" || t.status === "paused")
    .sort((a, b) => a.order - b.order);

  const remainingQueue = [...queue];
  const envKey = state.activeEnv || 'work';
  const env = (state.environments && state.environments[envKey]) ? state.environments[envKey] : null;

  while (remainingQueue.length > 0) {
    if (cursor >= 24 * 60) {
      remainingQueue.forEach(t => overflowIds.add(t.id));
      break;
    }
    const activeBlock = blocked.find(b => b.start <= cursor && cursor < b.end);
    if (activeBlock) {
      continuousWork = 0;
      cursor = activeBlock.end;
      lastPlacedEnd = cursor;
      continue;
    }

    // Buscar la siguiente tarea elegible considerando dependencias y startAfter
    let eligibleIndex = -1;
    let minCandidateStart = Infinity;

    for (let i = 0; i < remainingQueue.length; i++) {
      const t = remainingQueue[i];
      const depStatus = getTaskDependencyStatus(t, state, env, segmentsByTask, remainingQueue);

      if (depStatus.isBlockedExternally) {
        continue;
      }
      if (depStatus.isWaitingSameDay) {
        continue;
      }

      const taskStartAfter = (t.startAfter !== null && t.startAfter !== undefined && !isNaN(t.startAfter)) ? t.startAfter : 0;
      const effectiveStart = Math.max(taskStartAfter, depStatus.minStartFromDeps);

      if (effectiveStart <= cursor) {
        eligibleIndex = i;
        break;
      } else if (effectiveStart > cursor) {
        if (effectiveStart < minCandidateStart) {
          minCandidateStart = effectiveStart;
        }
      }
    }

    if (eligibleIndex === -1) {
      if (minCandidateStart === Infinity || minCandidateStart <= cursor || minCandidateStart >= 24 * 60) {
        remainingQueue.forEach(t => overflowIds.add(t.id));
        break;
      }
      cursor = minCandidateStart;
      continuousWork = 0;
      lastPlacedEnd = cursor;
      continue;
    }

    const [t] = remainingQueue.splice(eligibleIndex, 1);

    let remaining = Math.max(0, t.planned - (t.elapsedBefore || 0));

    const segs = [];
    let pos = cursor;
    let guard = 0;

    while (remaining > 0.01 && guard < 200) {
      guard++;
      if (pos >= 24 * 60) {
        overflowIds.add(t.id);
        break;
      }
      const activeBlock = blocked.find(b => b.start <= pos && pos < b.end);
      if (activeBlock) {
        continuousWork = 0;
        pos = activeBlock.end;
        lastPlacedEnd = pos;
        continue;
      }
      const nextBlock = blocked.find(b => b.start > pos);
      const limit = nextBlock ? nextBlock.start : 24 * 60;
      const available = limit - pos;
      if (available <= 0.01) {
        overflowIds.add(t.id);
        break;
      }

      if (pos > lastPlacedEnd && (pos - lastPlacedEnd) >= baseBreakDur) {
        continuousWork = 0;
      }

      if (!autoBreakEnabled) {
        const use = Math.min(available, remaining);
        segs.push({ start: pos, end: pos + use });
        pos += use;
        lastPlacedEnd = pos;
        remaining -= use;
      } else {
        const canWork = Math.max(0, intervalLimit - continuousWork);
        if (canWork <= 0.01) {
          const breakDur = Math.max(baseBreakDur, Math.round((continuousWork / 60) * 10));
          breaks.push({ start: pos, end: pos + breakDur, duration: breakDur });
          pos += breakDur;
          lastPlacedEnd = pos;
          continuousWork = 0;
          continue;
        }

        const use = Math.min(available, remaining, canWork);
        segs.push({ start: pos, end: pos + use });
        pos += use;
        lastPlacedEnd = pos;
        remaining -= use;
        continuousWork += use;
      }
    }
    const taskEnd = segs.length > 0 ? segs[segs.length - 1].end : pos;
    if (taskEnd > workEndVal || remaining > 0.01) {
      overflowIds.add(t.id);
    }
    segmentsByTask[t.id] = segs;
    cursor = pos;
  }

  return { segmentsByTask, overflowIds, blocked, breaks, now, viewStart };
}

/**
 * Ordena tareas cronológicamente según la planificación generada (schedule.segmentsByTask).
 * Las tareas en curso (running) tienen máxima prioridad y se sitúan al principio.
 * Para tareas pendientes o en pausa, se utiliza el inicio del primer segmento planificado.
 * Si no están planificadas o tienen el mismo inicio, se desempata por su orden de prioridad (order).
 */
export function sortTasksChronologically(tasks, schedule) {
  if (!Array.isArray(tasks) || tasks.length <= 1) return tasks || [];
  return [...tasks].sort((a, b) => {
    if (a.status === "running") return -1;
    if (b.status === "running") return 1;

    const segsA = (schedule && schedule.segmentsByTask && (schedule.segmentsByTask[a.id] || schedule.segmentsByTask[String(a.id)])) || [];
    const segsB = (schedule && schedule.segmentsByTask && (schedule.segmentsByTask[b.id] || schedule.segmentsByTask[String(b.id)])) || [];
    const startA = segsA.length > 0 ? segsA[0].start : Infinity;
    const startB = segsB.length > 0 ? segsB[0].start : Infinity;

    if (startA !== startB) {
      return startA - startB;
    }
    return (a.order || 0) - (b.order || 0);
  });
}

/**
 * Proyecta un feed cronológico unificado de tareas, reuniones, buffers y descansos,
 * garantizando una secuencia temporal matemática idéntica al tablero del calendar.
 * Las tareas divididas en varios tramos generan un elemento por cada segmento planificado.
 */
export function buildChronologicalFeed(state, schedule) {
  if (!state) return [];
  const sched = schedule || computeSchedule(state, 540);
  const tasks = Array.isArray(state.tasks) ? state.tasks.filter(t => t && t.status !== "completed") : [];
  const meetings = Array.isArray(state.meetings) ? state.meetings : [];
  const segmentsByTask = (sched && sched.segmentsByTask) ? sched.segmentsByTask : {};
  const overflowIds = (sched && sched.overflowIds) ? sched.overflowIds : new Set();
  const autoBreakEnabled = state.autoBreakEnabled !== false;
  const clusters = computeMeetingClusters(meetings, autoBreakEnabled);
  const breaks = (sched && Array.isArray(sched.breaks)) ? sched.breaks : [];
  const workEnd = (state.workEnd !== null && state.workEnd !== undefined) ? state.workEnd : 18 * 60;

  const items = [];
  const unassignedTasks = [];

  // 1. Tareas y sus segmentos calculados
  for (const t of tasks) {
    const segs = segmentsByTask[t.id] || segmentsByTask[String(t.id)] || [];
    if (segs.length === 0) {
      unassignedTasks.push(t);
      continue;
    }
    const totalParts = segs.length;
    segs.forEach((s, partIndex) => {
      const isOverflow = s.end > workEnd || overflowIds.has(t.id) || overflowIds.has(String(t.id));
      items.push({
        type: "task",
        start: s.start,
        end: s.end,
        task: t,
        partIndex,
        totalParts,
        segment: s,
        isOverflow,
        order: t.order || 0,
        status: t.status
      });
    });
  }

  // 2. Reuniones
  for (const m of meetings) {
    items.push({
      type: "meeting",
      start: m.start,
      end: m.end,
      meeting: m
    });
  }

  // 3. Buffers post-reunión
  for (const c of clusters) {
    if (c.breakDuration > 0) {
      items.push({
        type: "buffer",
        start: c.end,
        end: c.blockedEnd,
        duration: c.breakDuration,
        cluster: c
      });
    }
  }

  // 4. Descansos automáticos (breaks)
  for (const b of breaks) {
    items.push({
      type: "break",
      start: b.start,
      end: b.end,
      duration: b.duration,
      breakItem: b
    });
  }

  // Ordenación idéntica al calendar (board.js: visible.sort((a,b) => a.start - b.start || a.end - b.end))
  items.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.type === "task" && a.status === "running") return -1;
    if (b.type === "task" && b.status === "running") return 1;
    if (a.end !== b.end) return a.end - b.end;
    const typeOrder = { meeting: 0, buffer: 1, break: 2, task: 3 };
    return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
  });

  // Tareas sin tramos asignados van al final del feed
  for (const t of unassignedTasks) {
    items.push({
      type: "task",
      start: Infinity,
      end: Infinity,
      task: t,
      partIndex: 0,
      totalParts: 1,
      segment: null,
      isOverflow: true,
      order: t.order || 0,
      status: t.status
    });
  }

  return items;
}

export const TodayTasksScheduler = { computeSchedule, blockedIntervals, computeMeetingClusters, sortTasksChronologically, buildChronologicalFeed };

export default TodayTasksScheduler;


