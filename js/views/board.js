/* views/board.js — Tablero visual (timeline) y resumen del día */
import { nowMinutes, fmt, fmtDur, fmtRemaining, getTaskElapsed, getTodayStr, formatDateFriendly } from '../utils.js';
import { escapeHtml, escapeAttr } from '../ui.js';
import { computeMeetingClusters } from '../scheduler.js';
import { t } from '../i18n.js';

export function computeCalendarLayout(events, calStartMin, PX_PER_MIN) {
  const MIN_HEIGHT = 24;

  const items = events.map((e, index) => {
    const top = Math.max(0, (e.start - calStartMin) * PX_PER_MIN);
    const rawHeight = Math.max(1, (e.end - e.start) * PX_PER_MIN);
    const height = Math.max(MIN_HEIGHT, rawHeight);
    const bottom = top + height;
    return { event: e, index, top, height, bottom, start: e.start, end: e.end };
  });

  // Sort by top ascending, then duration descending
  items.sort((a, b) => a.top - b.top || (b.bottom - b.top) - (a.bottom - a.top));

  // Form clusters of overlapping items (in visual vertical space)
  const clusters = [];
  let currentCluster = [];
  let clusterBottom = -1;

  for (const item of items) {
    if (currentCluster.length === 0 || item.top < clusterBottom) {
      currentCluster.push(item);
      clusterBottom = Math.max(clusterBottom, item.bottom);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterBottom = item.bottom;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Assign columns within each cluster
  for (const cluster of clusters) {
    const columns = [];

    for (const item of cluster) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (columns[col] <= item.top) {
          item.col = col;
          columns[col] = item.bottom;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.col = columns.length;
        columns.push(item.bottom);
      }
    }

    const numCols = columns.length;
    for (const item of cluster) {
      item.numCols = numCols;
    }
  }

  // Sort back chronologically
  items.sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);

  return items;
}

export function TodayTasksBoardView(ctx){
  const { getState } = ctx;
  let lastScrollTop = null;
  let lastRenderedDate = null;
  let lastRenderedEnv = null;
  let lastPlanningMode = null;
  let userHasManuallyScrolled = false;
  let isProgrammaticScroll = false;

  function resetBoardScroll(){
    userHasManuallyScrolled = false;
    lastScrollTop = null;
  }

  function renderBoard(schedule){
    if (typeof document === "undefined") return;
    const el = document.getElementById("boardContent");
    if (!el) return;
    const state = getState();
    const now = schedule.now;
    const viewStart = schedule.viewStart;
    const workStart = state.workStart !== null && state.workStart !== undefined ? state.workStart : 9 * 60;
    const workEnd = state.workEnd !== null && state.workEnd !== undefined ? state.workEnd : 18 * 60;
    const today = getTodayStr();
    const isToday = !state.selectedDate || state.selectedDate === today;
    const currentEnv = state.activeEnv || 'work';
    const currentPlanning = !!state.planningMode;
    const activeDateKey = state.selectedDate || today;

    // Reset manual scroll if context changed (different date, environment or planning mode)
    if (activeDateKey !== lastRenderedDate || currentEnv !== lastRenderedEnv || currentPlanning !== lastPlanningMode) {
      lastRenderedDate = activeDateKey;
      lastRenderedEnv = currentEnv;
      lastPlanningMode = currentPlanning;
      userHasManuallyScrolled = false;
      lastScrollTop = null;
    }

    const titleEl = document.getElementById("boardTitle");
    const badgeEl = document.getElementById("boardNow");
    if(titleEl){
      if(!isToday){
        titleEl.textContent = t('board.planningForDate', { friendly: formatDateFriendly(state.selectedDate), date: state.selectedDate });
      } else {
        titleEl.textContent = state.planningMode
          ? t('board.planFullFromStart')
          : t('board.planFromNow');
      }
    }
    if(badgeEl){
      badgeEl.textContent = state.planningMode
        ? t('board.badgeStart', { time: fmt(state.workStart) })
        : (isToday ? t('board.badgeNow', { time: fmt(now) }) : state.selectedDate);
    }

    const events = [];
    const autoBreakEnabled = state.autoBreakEnabled !== false;
    const meetingClusters = computeMeetingClusters(state.meetings || [], autoBreakEnabled);
    for(const m of (state.meetings || [])){
      events.push({start: m.start, end: m.end, kind: "meeting", label: m.title, id: m.id, targetKind: "meeting"});
    }
    for(const c of meetingClusters){
      if(c.breakDuration > 0){
        const meetingNames = c.meetings.map(m => m.title).filter(Boolean).join(', ');
        const label = c.breakDuration > 10
          ? t('board.clusterBreakNames', { duration: c.breakDuration, names: meetingNames })
          : (meetingNames ? t('board.clusterBufferNames', { names: meetingNames }) : t('board.clusterBufferDuration', { duration: c.breakDuration }));
        events.push({start: c.end, end: c.blockedEnd, kind: "buffer", label});
      }
    }
    for(const b of (schedule && schedule.breaks ? schedule.breaks : [])){
      events.push({start: b.start, end: b.end, kind: "break", label: t('board.breakDuration', { duration: b.duration }), duration: b.duration});
    }
    for(const t of (state.tasks || [])){
      if(t.status === "completed") continue;
      const segs = (schedule && schedule.segmentsByTask && schedule.segmentsByTask[t.id]) ? schedule.segmentsByTask[t.id] : [];
      for(const s of segs){
        const isOverflow = s.end > workEnd || (schedule && schedule.overflowIds && schedule.overflowIds.has(t.id));
        events.push({start: s.start, end: s.end, kind: "task-" + t.status, label: t.title, isOverflow, id: t.id, targetKind: "task", startAfter: t.startAfter});
      }
    }

    // Extended calendar window: at least 2 hours beyond workEnd (+120 min)
    const extendedWorkEnd = workEnd + 120;
    const startCandidates = [workStart, ...events.map(e => e.start)];
    const endCandidates = [extendedWorkEnd, ...events.map(e => e.end)];

    const minMin = Math.min(...startCandidates);
    const maxMin = Math.max(...endCandidates);
    const calStartHour = Math.max(0, Math.floor(minMin / 60));
    const calEndHour = Math.min(24, Math.ceil(maxMin / 60));
    const calStartMin = calStartHour * 60;
    const calEndMin = calEndHour * 60;
    const totalMinutes = Math.max(60, calEndMin - calStartMin);

    const PX_PER_MIN = 1.2;
    const totalHeight = totalMinutes * PX_PER_MIN;

    // Filter and sort events chronologically
    const visible = events.filter(e => e.end > calStartMin && e.start < calEndMin);
    visible.sort((a,b) => a.start - b.start || a.end - b.end);

    if(!state.planningMode && isToday && now >= workEnd && visible.length === 0){
      el.innerHTML = `<div class="board-empty">${t('board.workdayEndedEmpty')}</div>`;
      return;
    }

    // Generate Hour Axis Marks
    let axisHtml = '';
    let gridLinesHtml = '';
    for(let h = calStartHour; h <= calEndHour; h++){
      const top = (h * 60 - calStartMin) * PX_PER_MIN;
      axisHtml += `<div class="calendar-hour-mark" style="top:${top}px;">${fmt(h * 60)}</div>`;
      gridLinesHtml += `<div class="calendar-grid-line" style="top:${top}px;"></div>`;
      if(h * 60 + 30 < calEndMin){
        const halfTop = (h * 60 + 30 - calStartMin) * PX_PER_MIN;
        gridLinesHtml += `<div class="calendar-grid-line-half" style="top:${halfTop}px;"></div>`;
      }
    }

    // Extended Zone (+2h past workEnd)
    let extendedZoneHtml = '';
    if(calEndMin > workEnd){
      const extTop = Math.max(0, (workEnd - calStartMin) * PX_PER_MIN);
      const extHeight = (calEndMin - workEnd) * PX_PER_MIN;
      extendedZoneHtml = `
        <div class="calendar-extended-zone" style="top:${extTop}px; height:${extHeight}px;">
          <span class="calendar-extended-label">${t('board.extendedZoneLabel')}</span>
        </div>`;
    }

    // Work End line marker
    let workEndHtml = '';
    if(workEnd >= calStartMin && workEnd <= calEndMin){
      const weTop = (workEnd - calStartMin) * PX_PER_MIN;
      workEndHtml = `
        <div class="calendar-work-end-line" style="top:${weTop}px;">
          <span class="calendar-work-end-badge">${t('board.workEndBadge', { time: fmt(workEnd) })}</span>
        </div>`;
    }

    // Red/Orange NOW horizontal indicator line
    let nowIndicatorHtml = '';
    if(isToday && now >= calStartMin && now <= calEndMin){
      const nowTop = (now - calStartMin) * PX_PER_MIN;
      nowIndicatorHtml = `
        <div class="calendar-now-indicator" style="top:${nowTop}px;">
          <span class="calendar-now-badge"><span class="calendar-now-dot"></span>${fmt(now)}</span>
        </div>`;
    }

    // Event cards with horizontal division (multi-column) for overlapping or short items
    const layoutItems = computeCalendarLayout(visible, calStartMin, PX_PER_MIN);
    let slotsHtml = '';
    for(const item of layoutItems){
      const e = item.event;
      const top = item.top;
      const height = item.height;
      const kindClass = e.kind === "meeting" ? "slot-meeting"
                       : e.kind === "buffer" ? "slot-buffer"
                       : e.kind === "break" ? "slot-break"
                       : "slot-task " + e.kind.replace("task-","");
      const label = e.kind === "meeting" ? "🗓 " + escapeHtml(e.label)
                  : (e.kind === "buffer" || e.kind === "break") ? "☕ " + escapeHtml(e.label)
                  : escapeHtml(e.label) + (e.kind==="task-running" ? t('board.slotRunningTag') : "");
      const isPast = isToday && e.end <= now && !state.planningMode;
      const overflowClass = e.isOverflow ? "slot-overflow" : "";
      const pastClass = isPast ? "slot-past" : "";
      const overflowTag = e.isOverflow ? `<span class="slot-overflow-tag" title="${t('board.slotOverflowTitle')}">${t('board.slotOverflowTag')}</span>` : '';
      const multiColClass = item.numCols > 1 ? "slot-multi-col" : "";
      const compactClass = height < 28 ? "slot-compact" : "";

      let posStyles;
      if (item.numCols <= 1) {
        posStyles = `top:${top}px; height:${height}px; left:6px; right:6px;`;
      } else {
        const colWidthPct = 100 / item.numCols;
        const leftPct = item.col * colWidthPct;
        posStyles = `top:${top}px; height:${height}px; left:calc(${leftPct}% + 4px); width:calc(${colWidthPct}% - 8px);`;
      }

      const isInteractive = (e.id !== undefined && (e.targetKind === "meeting" || e.targetKind === "task"));
      const interactiveClass = isInteractive ? "slot-interactive" : "";
      const targetDomId = isInteractive
        ? (e.targetKind === "meeting" ? `meeting-item-${escapeAttr(e.id)}` : `task-item-${escapeAttr(e.id)}`)
        : "";
      const clickAttrs = isInteractive
        ? `onclick="app.scrollToElement('${targetDomId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();app.scrollToElement('${targetDomId}');}" data-target-id="${targetDomId}" role="button" tabindex="0"`
        : "";

      const actionHint = isInteractive
        ? (e.targetKind === "meeting" ? t('board.clickToViewMeeting') : t('board.clickToViewTask'))
        : "";

      const tooltip = e.kind === "break"
        ? t('board.breakTooltip', { duration: fmtDur(e.end - e.start), start: fmt(e.start), end: fmt(e.end) })
        : `${escapeAttr(e.label)} (${fmt(e.start)} – ${fmt(e.end)} · ${fmtDur(e.end - e.start)})${actionHint}`;

      const hasStartAfter = (e.startAfter !== null && e.startAfter !== undefined && !isNaN(e.startAfter));
      const startAfterTag = hasStartAfter ? `<span class="slot-startafter-tag" title="${t('board.startAfterTooltip', { time: fmt(e.startAfter) })}">⏰ ${fmt(e.startAfter)}+</span>` : '';

      slotsHtml += `
        <div class="slot ${kindClass} ${overflowClass} ${pastClass} ${multiColClass} ${compactClass} ${interactiveClass}" style="${posStyles}" title="${tooltip}" ${clickAttrs}>
          <span class="time-label">${fmt(e.start)}<span class="sep">–</span>${fmt(e.end)}</span>
          <span class="slot-title">${label}</span>
          ${startAfterTag}
          ${overflowTag}
          <span class="dur">${fmtDur(e.end - e.start)}</span>
        </div>`;
    }

    let html = `
      <div class="board-calendar-wrap">
        <div class="board-calendar-scroll">
          <div class="board-calendar-canvas" style="height:${totalHeight}px;">
            <div class="calendar-time-axis">
              ${axisHtml}
            </div>
            <div class="calendar-grid-track track">
              ${gridLinesHtml}
              ${extendedZoneHtml}
              ${workEndHtml}
              ${nowIndicatorHtml}
              ${slotsHtml}
            </div>
          </div>
        </div>
      </div>`;

    if(schedule && schedule.overflowIds && schedule.overflowIds.size > 0){
      html += `<div class="overflow-note">${t('board.overflowNote', { count: schedule.overflowIds.size, end: fmt(workEnd) })}</div>`;
    }

    el.innerHTML = html;

    const newScrollEl = el.querySelector(".board-calendar-scroll");
    if (newScrollEl) {
      const SCROLL_MARGIN_PX = 80;
      let targetScroll = 0;

      if (userHasManuallyScrolled && lastScrollTop !== null && lastScrollTop !== undefined) {
        targetScroll = lastScrollTop;
      } else if (isToday && !currentPlanning) {
        const nowOffset = (now - calStartMin) * PX_PER_MIN;
        targetScroll = Math.max(0, Math.round(nowOffset - SCROLL_MARGIN_PX));
      } else {
        targetScroll = 0;
      }

      isProgrammaticScroll = true;
      newScrollEl.scrollTop = targetScroll;
      isProgrammaticScroll = false;

      newScrollEl.addEventListener('scroll', () => {
        if (isProgrammaticScroll) return;
        if (!userHasManuallyScrolled && newScrollEl.scrollTop === targetScroll) return;
        userHasManuallyScrolled = true;
        lastScrollTop = newScrollEl.scrollTop;
      }, { passive: true });
    }
  }

  function renderSummary(schedule){
    if (typeof document === "undefined") return;
    const state = getState();
    const meetings = [...(state.meetings || [])].sort((a,b)=>a.start-b.start);
    const completed = (state.tasks || []).filter(t=>t.status==="completed").sort((a,b)=>a.completedAt-b.completedAt);
    const pending = (state.tasks || []).filter(t=>t.status!=="completed").sort((a,b)=>{
      if(a.status === "running") return -1;
      if(b.status === "running") return 1;
      return a.order - b.order;
    });

    const meetingsEl = document.getElementById("meetingsSummaryList");
    if (meetingsEl) {
      meetingsEl.innerHTML = meetings.length ? meetings.map(m => `
        <div class="summary-row">
          <div class="row-top"><span>${escapeHtml(m.title)}</span></div>
          <div class="time-range tr-meeting"><span class="tag">${t('summary.tagStart')}</span>${fmt(m.start)}<span class="arrow">→</span><span class="tag">${t('summary.tagEnd')}</span>${fmt(m.end)}</div>
        </div>
      `).join("") : `<div class="empty">${t('summary.emptyMeetings')}</div>`;
    }

    const interruptions = [...(state.interruptions || [])].sort((a,b) => a.start - b.start);

    const completedEl = document.getElementById("completedList");
    if (completedEl) {
      const completedRows = completed.map(tTask => {
        const realStart = tTask.completedAt - tTask.actualDuration;
        return `
        <div class="summary-row">
          <div class="row-top"><span>${escapeHtml(tTask.title)}</span><div style="text-align:right"><span class="dur task-duration-clickable" title="${t('summary.adjustTimeTooltip')}" onclick="app.openTimePopover('${escapeAttr(tTask.id)}', event)">${t('summary.actualDuration', { time: fmtDur(tTask.actualDuration) })}</span> <span class="dur" style="opacity:0.75">${t('summary.plannedDuration', { time: fmtDur(tTask.planned) })}</span></div></div>
          <div class="time-range tr-running"><span class="tag">${t('summary.tagStart')}</span>${fmt(realStart)}<span class="arrow">→</span><span class="tag">${t('summary.tagEnd')}</span>${fmt(tTask.completedAt)}</div>
          <div style="margin-top:6px;display:flex;gap:6px;">
            <button class="btn small secondary" onclick="app.openTimePopover('${escapeAttr(tTask.id)}', event)" title="${t('summary.adjustTimeTooltip')}">${t('summary.btnAdjustTime')}</button>
            <button class="btn small secondary" onclick="app.uncompleteTask('${escapeAttr(tTask.id)}')" title="${t('summary.btnReopenTitle')}">${t('summary.btnReopen')}</button>
            <button class="btn small secondary" onclick="app.openCopyTaskModal('${escapeAttr(tTask.id)}')" title="${t('summary.btnCopyTitle')}">${t('summary.btnCopy')}</button>
          </div>
        </div>`;
      });

      const interruptionRows = interruptions.map(i => `
        <div class="summary-row summary-row-interruption">
          <div class="row-top">
            <span>⚡ ${escapeHtml(i.title)}</span>
            <span class="dur" style="color:var(--danger)">${fmtDur(i.duration)}</span>
          </div>
          <div class="time-range tr-interruption">
            <span class="tag">${t('summary.tagStart')}</span>${fmt(i.start)}
            <span class="arrow">→</span>
            <span class="tag">${t('summary.tagEnd')}</span>${fmt(i.end)}
          </div>
        </div>`);

      const allCompleted = [...completedRows, ...interruptionRows];
      completedEl.innerHTML = allCompleted.length
        ? allCompleted.join('')
        : `<div class="empty">${t('summary.emptyCompleted')}</div>`;
    }

    const pendingEl = document.getElementById("pendingList");
    if (pendingEl) {
      pendingEl.innerHTML = pending.length ? pending.map(tTask => {
        let rangeHtml;
        if(tTask.status === "running"){
          const plannedEnd = tTask.runningStart + (tTask.planned - (tTask.elapsedBefore||0));
          const rem = fmtRemaining(plannedEnd, nowMinutes());
          const chip = `<span class="remaining-chip${rem.overrun?" overrun":""}">${escapeHtml(rem.text)}</span>`;
          rangeHtml = `<div class="time-range tr-running"><span class="tag">${t('summary.tagRealStart')}</span>${fmt(tTask.runningStart)}<span class="arrow">→</span><span class="tag">${t('summary.tagPlannedEnd')}</span>${fmt(plannedEnd)} ${chip}</div>`;
        } else {
          const segs = (schedule && schedule.segmentsByTask && schedule.segmentsByTask[tTask.id]) || [];
          if(segs.length){
            const trClass = tTask.status === "paused" ? "tr-paused" : "tr-pending";
            rangeHtml = `<div class="time-range ${trClass}"><span class="tag">${t('summary.tagEstStart')}</span>${fmt(segs[0].start)}<span class="arrow">→</span><span class="tag">${t('summary.tagEstEnd')}</span>${fmt(segs[segs.length-1].end)}</div>`;
          } else {
            rangeHtml = `<div class="meta" style="color:var(--danger)">${t('summary.noSlotBeforeEnd')}</div>`;
          }
        }
        const elapsedReal = getTaskElapsed(tTask);
        const hasStartAfter = (tTask.startAfter !== null && tTask.startAfter !== undefined && !isNaN(tTask.startAfter));
        const startAfterTag = hasStartAfter
          ? ` <span class="tag" style="background:rgba(245,158,11,0.12);color:#b45309;border-color:rgba(245,158,11,0.35);font-weight:600;font-family:'IBM Plex Mono',monospace;" title="${t('summary.startAfterTooltip', { time: fmt(tTask.startAfter) })}">⏰ ${fmt(tTask.startAfter)}+</span>`
          : '';
        const isAutoMove = (!tTask.isRecurring && tTask.autoMoveToToday);
        const autoMoveTag = isAutoMove
          ? ` <span class="tag tag-automove" title="${t('summary.autoMoveTooltip')}">${t('summary.autoMoveTag')}</span>`
          : '';
        const transferBtnLabel = isAutoMove ? t('summary.btnMove') : t('summary.btnCopy');
        const transferBtnTitle = isAutoMove ? t('summary.btnMoveTitle') : t('summary.btnCopyTitle');
        const statusLabel = tTask.status === 'paused' ? t('task.statusPaused') : (tTask.status === 'running' ? t('task.statusRunning') : t('task.statusPending'));
        return `
        <div class="summary-row">
          <div class="row-top"><span>${escapeHtml(tTask.title)}${startAfterTag}${autoMoveTag}</span><span class="dur">${fmtDur(tTask.planned)} plan. · <span class="task-duration-clickable" title="${t('summary.adjustTimeTooltip')}" onclick="app.openTimePopover('${escapeAttr(tTask.id)}', event)">${t('summary.elapsedDone', { time: elapsedReal > 0 ? fmtDur(elapsedReal) : '0m' })}</span> · ${statusLabel}</span></div>
          ${rangeHtml}
          <div style="margin-top:6px">
            <button class="btn small secondary" onclick="app.openCopyTaskModal('${escapeAttr(tTask.id)}')" title="${transferBtnTitle}">${transferBtnLabel}</button>
          </div>
        </div>
      `; }).join("") : `<div class="empty">${t('summary.emptyPending')}</div>`;
    }
  }

  return { renderBoard, renderSummary, resetBoardScroll };
}

export default TodayTasksBoardView;
