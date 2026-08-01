(function () {
  function blockedIntervals(state){
    const raw = state.meetings.map(m => ({start:m.start, end:m.end+10}))
                               .sort((a,b)=>a.start-b.start);
    const merged = [];
    for(const iv of raw){
      if(merged.length && iv.start <= merged[merged.length-1].end){
        merged[merged.length-1].end = Math.max(merged[merged.length-1].end, iv.end);
      } else {
        merged.push({start:iv.start, end:iv.end});
      }
    }
    return merged;
  }

  function computeSchedule(state, nowMinutes){
    const now = nowMinutes();
    const blocked = blockedIntervals(state);
    const segmentsByTask = {};
    const overflowIds = new Set();

    const running = state.tasks.find(t => t.status === "running");
    const viewStart = state.planningMode ? state.workStart : now;
    let cursor;

    if(running){
      const plannedEnd = running.runningStart + (running.planned - (running.elapsedBefore||0));
      const effectiveEnd = Math.max(plannedEnd, now);
      segmentsByTask[running.id] = [{start: running.runningStart, end: effectiveEnd}];
      cursor = effectiveEnd;
    } else {
      cursor = viewStart;
    }

    const queue = state.tasks
      .filter(t => t.status === "pending" || t.status === "paused")
      .sort((a,b) => a.order - b.order);

    for(const t of queue){
      let remaining = t.status === "paused"
        ? Math.max(0, t.planned - (t.elapsedBefore||0))
        : t.planned;

      const segs = [];
      let pos = cursor;
      let guard = 0;

      while(remaining > 0.01 && guard < 200){
        guard++;
        if(pos >= state.workEnd){
          overflowIds.add(t.id);
          break;
        }
        const activeBlock = blocked.find(b => b.start <= pos && pos < b.end);
        if(activeBlock){
          pos = activeBlock.end;
          continue;
        }
        const nextBlock = blocked.find(b => b.start > pos);
        const limit = Math.min(nextBlock ? nextBlock.start : Infinity, state.workEnd);
        const available = limit - pos;
        if(available <= 0.01){
          overflowIds.add(t.id);
          break;
        }
        const use = Math.min(available, remaining);
        segs.push({start: pos, end: pos+use});
        pos += use;
        remaining -= use;
      }
      if(remaining > 0.01) overflowIds.add(t.id);
      segmentsByTask[t.id] = segs;
      cursor = pos;
    }

    return {segmentsByTask, overflowIds, blocked, now, viewStart};
  }


  window.TodayTasksScheduler = { computeSchedule };
})();

