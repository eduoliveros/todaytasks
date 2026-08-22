export function blockedIntervals(state) {
  const raw = (state.meetings || []).map(m => ({ start: m.start, end: m.end + 10 }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const iv of raw) {
    if (merged.length && iv.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
    } else {
      merged.push({ start: iv.start, end: iv.end });
    }
  }
  return merged;
}

export function computeSchedule(state, nowMinutes) {
  const now = typeof nowMinutes === "function" ? nowMinutes() : nowMinutes;
  const blocked = blockedIntervals(state);
  const segmentsByTask = {};
  const overflowIds = new Set();

  const running = (state.tasks || []).find(t => t.status === "running");
  const workStartVal = state.workStart !== null && state.workStart !== undefined ? state.workStart : 9 * 60;
  const workEndVal = state.workEnd !== null && state.workEnd !== undefined ? state.workEnd : 24 * 60;

  const viewStart = state.planningMode ? workStartVal : now;
  let cursor;

  if (running) {
    const plannedEnd = running.runningStart + (running.planned - (running.elapsedBefore || 0));
    const effectiveEnd = Math.max(plannedEnd, now);
    segmentsByTask[running.id] = [{ start: running.runningStart, end: effectiveEnd }];
    // In planning mode, if the running task ends before workStart (e.g. executing
    // before the workday starts), pending tasks must still be scheduled from workStart.
    cursor = state.planningMode ? Math.max(effectiveEnd, workStartVal) : effectiveEnd;
  } else {
    cursor = viewStart;
  }

  const queue = (state.tasks || [])
    .filter(t => t.status === "pending" || t.status === "paused")
    .sort((a, b) => a.order - b.order);

  for (const t of queue) {
    let remaining = Math.max(0, t.planned - (t.elapsedBefore || 0));

    const segs = [];
    let pos = cursor;
    let guard = 0;

    while (remaining > 0.01 && guard < 200) {
      guard++;
      if (pos >= workEndVal) {
        overflowIds.add(t.id);
        break;
      }
      const activeBlock = blocked.find(b => b.start <= pos && pos < b.end);
      if (activeBlock) {
        pos = activeBlock.end;
        continue;
      }
      const nextBlock = blocked.find(b => b.start > pos);
      const limit = Math.min(nextBlock ? nextBlock.start : Infinity, workEndVal);
      const available = limit - pos;
      if (available <= 0.01) {
        overflowIds.add(t.id);
        break;
      }
      const use = Math.min(available, remaining);
      segs.push({ start: pos, end: pos + use });
      pos += use;
      remaining -= use;
    }
    if (remaining > 0.01) overflowIds.add(t.id);
    segmentsByTask[t.id] = segs;
    cursor = pos;
  }

  return { segmentsByTask, overflowIds, blocked, now, viewStart };
}

export const TodayTasksScheduler = { computeSchedule, blockedIntervals };

export default TodayTasksScheduler;


