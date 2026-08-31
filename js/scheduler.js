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

    // Buscar la siguiente tarea elegible (sin startAfter o con startAfter <= cursor)
    const eligibleIndex = remainingQueue.findIndex(t => {
      if (t.startAfter === null || t.startAfter === undefined || isNaN(t.startAfter)) return true;
      return t.startAfter <= cursor;
    });

    if (eligibleIndex === -1) {
      // Ninguna tarea puede empezar en el cursor actual.
      // Avanzar cursor a la hora mínima startAfter de las tareas restantes.
      const validStarts = remainingQueue
        .map(t => (t.startAfter !== null && t.startAfter !== undefined && !isNaN(t.startAfter)) ? t.startAfter : Infinity)
        .filter(st => st > cursor);
      const minStartAfter = validStarts.length > 0 ? Math.min(...validStarts) : Infinity;

      if (minStartAfter === Infinity || minStartAfter <= cursor) {
        remainingQueue.forEach(t => overflowIds.add(t.id));
        break;
      }
      cursor = minStartAfter;
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

export const TodayTasksScheduler = { computeSchedule, blockedIntervals, computeMeetingClusters };

export default TodayTasksScheduler;


