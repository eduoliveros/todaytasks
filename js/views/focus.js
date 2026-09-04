/* views/focus.js — Vistas de pantalla completa: interrupción y foco de tarea */
import { nowMinutes, fmt, fmtDur, getTaskElapsed } from '../utils.js';
import { escapeHtml, escapeAttr, renderNotesMarkdown } from '../ui.js';
import { t } from '../i18n.js';

export function TodayTasksFocusView(ctx){
  const { getState, getCurrentView, getFocusTaskId, fmtMMSS, RING_R, RING_C } = ctx;

  function renderInterruptionView(){
    if (typeof document === "undefined") return;
    const container = document.getElementById('view-interruption');
    if(!container) return;

    const state = getState();
    if(!state.activeInterruption){
      if (typeof window !== "undefined") window.location.hash = '#/';
      return;
    }

    if(!state.activeInterruption.startEpoch){
      state.activeInterruption.startEpoch = Date.now() - Math.max(0, nowMinutes() - state.activeInterruption.start) * 60000;
    }

    const existingTimeEl = container.querySelector('.interruption-time-value');
    if(existingTimeEl){
      existingTimeEl.textContent = fmtMMSS(state.activeInterruption.startEpoch);
      return;
    }

    const timerDisplay = fmtMMSS(state.activeInterruption.startEpoch);

    container.innerHTML = `
      <div class="interruption-view">
        <div class="interruption-card">
          <div class="interruption-badge">${t('focus.interruptionBadge')}</div>

          <div class="interruption-input-group">
            <input type="text"
                   id="interruptionTitleInput"
                   class="interruption-input"
                   value="${escapeAttr(state.activeInterruption.title || '')}"
                   placeholder="${escapeAttr(t('focus.interruptionPlaceholder'))}"
                   oninput="app.updateInterruptionTitle(this.value)"
                   autocomplete="off">
          </div>

          <div class="interruption-timer-box">
            <div class="interruption-time-label">${t('focus.elapsedTime')}</div>
            <div class="interruption-time-value">${timerDisplay}</div>
            <div class="interruption-start-meta">${t('focus.interruptionStartedAt', { time: fmt(state.activeInterruption.start) })}</div>
          </div>

          <div style="display:flex;gap:12px;width:100%;">
            <button class="btn done interruption-finish-btn" style="flex:2;" onclick="app.completeInterruption()">${t('focus.btnFinishInterruption')}</button>
            <button class="btn secondary" style="flex:1;border-radius:12px;font-weight:600;" onclick="app.cancelInterruption()" title="${escapeAttr(t('focus.btnCancelInterruptionTooltip'))}">${t('focus.btnCancelInterruption')}</button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const input = document.getElementById('interruptionTitleInput');
      if(input) input.focus();
    }, 50);
  }

  function renderTaskFocusView(){
    if (typeof document === "undefined") return;
    const container = document.getElementById('view-task') || document.getElementById('view-focus');
    if(!container) return;

    const taskId = getFocusTaskId ? getFocusTaskId() : (ctx.getFocusTaskId ? ctx.getFocusTaskId() : null);
    if(taskId === null || taskId === undefined){
      if (typeof window !== "undefined") window.location.hash = '#/';
      return;
    }

    const state = getState ? getState() : {};
    const task = (state.tasks || []).find(x => String(x.id) === String(taskId));
    if(!task){
      if (typeof window !== "undefined") window.location.hash = '#/';
      return;
    }

    const now = (ctx && ctx.nowMinutes) ? (typeof ctx.nowMinutes === 'function' ? ctx.nowMinutes() : ctx.nowMinutes) : nowMinutes();
    const elapsed = getTaskElapsed(task, now);
    const planned = task.planned || 1;
    const isCompleted = task.status === 'completed';
    const isOverrun = !isCompleted && elapsed > planned;
    const remaining = Math.max(0, planned - elapsed);
    const overrunMinutes = isOverrun ? (elapsed - planned) : 0;

    const radius = 100;
    const circumference = +(2 * Math.PI * radius).toFixed(2);
    const fraction = isCompleted ? 1 : Math.min(1, elapsed / planned);
    const dashOffset = +(circumference * (1 - fraction)).toFixed(2);

    let ringClass = '';
    if(task.status === 'paused') ringClass += ' state-paused';
    if(isCompleted) ringClass += ' state-completed';
    if(isOverrun) ringClass += ' state-overrun';

    let plannedEnd = null;
    if(task.status === 'running' && task.runningStart !== null && task.runningStart !== undefined){
      plannedEnd = task.runningStart + Math.max(0, task.planned - (task.elapsedBefore || 0));
    }

    /* Reuniones: cálculo de próxima reunión, reunión en curso y marca de corte en el arco */
    const meetings = (state.meetings || []).filter(m => m && typeof m.start === 'number' && typeof m.end === 'number');
    const ongoingMeeting = meetings.find(m => m.start <= now && m.end > now);
    const nextMeeting = meetings.find(m => m.start > now);
    const timeToMeeting = nextMeeting ? Math.max(0, nextMeeting.start - now) : null;

    const isCutoff = !isCompleted && nextMeeting && (timeToMeeting < remaining);

    let meetingSvgElements = '';
    if(isCutoff && planned > 0){
      const fractionAtMeeting = Math.min(1, Math.max(0, (elapsed + timeToMeeting) / planned));
      const angle = -Math.PI / 2 + (fractionAtMeeting * 2 * Math.PI);
      const dotX = +(120 + radius * Math.cos(angle)).toFixed(2);
      const dotY = +(120 + radius * Math.sin(angle)).toFixed(2);
      const notchX1 = +(120 + (radius - 9) * Math.cos(angle)).toFixed(2);
      const notchY1 = +(120 + (radius - 9) * Math.sin(angle)).toFixed(2);
      const notchX2 = +(120 + (radius + 9) * Math.cos(angle)).toFixed(2);
      const notchY2 = +(120 + (radius + 9) * Math.sin(angle)).toFixed(2);

      meetingSvgElements = `
        <line class="ring-meeting-notch"
              x1="${notchX1}" y1="${notchY1}"
              x2="${notchX2}" y2="${notchY2}"
              title="${escapeAttr(t('focus.meetingCutoffSvgTitle', { title: nextMeeting.title, time: fmt(nextMeeting.start) }))}" />
        <circle class="ring-meeting-dot"
                cx="${dotX}" cy="${dotY}" r="4.5">
          <title>${escapeAttr(t('focus.meetingDotSvgTitle', { title: nextMeeting.title, time: fmt(nextMeeting.start) }))}</title>
        </circle>
      `;
    }

    let meetingBadgeHtml = '';
    if(ongoingMeeting){
      meetingBadgeHtml = `
        <div class="focus-meeting-badge ongoing" title="${escapeAttr(t('focus.meetingOngoingTooltip', { time: fmt(ongoingMeeting.end) }))}">
          <span class="badge-icon">🔴</span>
          <span class="badge-text">${t('focus.meetingOngoingBadge', { title: escapeHtml(ongoingMeeting.title), time: fmt(ongoingMeeting.end) })}</span>
        </div>
      `;
    } else if(nextMeeting && (isCutoff || timeToMeeting <= 60)){
      if(isCutoff || timeToMeeting <= 10){
        meetingBadgeHtml = `
          <div class="focus-meeting-badge warning" title="${escapeAttr(t('focus.meetingNextTooltip', { time: fmt(nextMeeting.start), title: nextMeeting.title }))}">
            <span class="badge-icon">⚠️</span>
            <span class="badge-text">${t('focus.meetingNextWarning', { time: fmtDur(timeToMeeting), title: escapeHtml(nextMeeting.title) })}</span>
          </div>
        `;
      } else {
        meetingBadgeHtml = `
          <div class="focus-meeting-badge normal" title="${escapeAttr(t('focus.meetingNextTooltip', { time: fmt(nextMeeting.start), title: nextMeeting.title }))}">
            <span class="badge-icon">📅</span>
            <span class="badge-text">${t('focus.meetingNextNormal', { time: fmt(nextMeeting.start), inTime: fmtDur(timeToMeeting), title: escapeHtml(nextMeeting.title) })}</span>
          </div>
        `;
      }
    }

    let ringMainText = '';
    let ringLabelText = '';
    if(isCompleted){
      ringMainText = t('focus.ringCompletedMain');
      ringLabelText = t('focus.ringCompletedLabel', { time: fmtDur(elapsed) });
    } else if(isOverrun){
      ringMainText = `+${fmtDur(overrunMinutes)}`;
      ringLabelText = t('focus.ringExtraTime');
    } else {
      ringMainText = fmtDur(remaining);
      ringLabelText = t('focus.ringRemaining');
    }

    container.innerHTML = `
      <div class="focus-view">
        <div class="focus-header">
          <a href="#/" class="btn secondary small focus-back" title="${escapeAttr(t('focus.btnBackTooltip'))}">${t('focus.btnBack')}</a>
          <button class="btn secondary small pip-toggle-btn" onclick="app.togglePiP()" title="${escapeAttr(t('focus.btnPipTooltip'))}">
            <span>🗖</span> <span class="pip-btn-label">${t('focus.btnPipLabel')}</span>
          </button>
        </div>

        <h2 class="focus-task-name">${escapeHtml(task.title)}</h2>

        <div class="focus-ring-wrap">
          <svg class="focus-ring" viewBox="0 0 240 240">
            <circle class="ring-track" cx="120" cy="120" r="${radius}" fill="none" stroke-width="12"/>
            <circle class="ring-progress ${ringClass}"
                    cx="120" cy="120" r="${radius}"
                    fill="none" stroke-width="12"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${dashOffset}"/>
            ${meetingSvgElements}
          </svg>
          <div class="focus-ring-center">
            <div class="ring-main-time ${isOverrun ? 'overrun-text' : ''}">
              ${ringMainText}
            </div>
            <div class="ring-label">
              ${ringLabelText}
            </div>
            ${meetingBadgeHtml}
          </div>
        </div>

        <div class="focus-meta">
          <div class="focus-meta-item">
            <span class="meta-label">${t('focus.metaPlanned')}</span>
            <span class="meta-value">${fmtDur(task.planned)}</span>
          </div>
          <div class="focus-meta-item">
            <span class="meta-label">${t('focus.metaElapsed')}</span>
            <span class="meta-value task-duration-clickable" title="${escapeAttr(t('focus.metaElapsedTooltip'))}" onclick="app.openTimePopover('${escapeAttr(task.id)}', event)">${fmtDur(elapsed)}</span>
          </div>
          ${plannedEnd !== null ? `
          <div class="focus-meta-item">
            <span class="meta-label">${t('focus.metaEstimatedEnd')}</span>
            <span class="meta-value">${fmt(plannedEnd)}</span>
          </div>` : ''}
          ${ongoingMeeting ? `
          <div class="focus-meta-item">
            <span class="meta-label">${t('focus.metaOngoingMeeting')}</span>
            <span class="meta-value warning-text" title="${escapeAttr(ongoingMeeting.title)}">${escapeHtml(ongoingMeeting.title)} (hasta ${fmt(ongoingMeeting.end)})</span>
          </div>` : ''}
          ${nextMeeting && !ongoingMeeting ? `
          <div class="focus-meta-item">
            <span class="meta-label">${t('focus.metaNextMeeting')}</span>
            <span class="meta-value ${isCutoff ? 'warning-text' : ''}" title="${escapeAttr(nextMeeting.title)}">
              ${fmt(nextMeeting.start)} (${fmtDur(timeToMeeting)}) · ${escapeHtml(nextMeeting.title)}
            </span>
          </div>` : ''}
        </div>

        ${(task.notes && task.notes.trim()) ? `
        <div class="focus-notes-card">
          <div class="focus-notes-header">
            <span class="focus-notes-title">${t('focus.notesTitle')}</span>
          </div>
          <div class="task-note-content">
            ${renderNotesMarkdown(task.notes)}
          </div>
        </div>` : ''}

        <div class="focus-actions">
          ${task.status === 'running' ? `
            <button class="btn pause" onclick="app.pauseTask('${escapeAttr(task.id)}')">${t('focus.btnPause')}</button>
            <button class="btn done" onclick="app.completeTask('${escapeAttr(task.id)}')">${t('focus.btnComplete')}</button>
          ` : task.status === 'paused' ? `
            <button class="btn run" onclick="app.resumeTask('${escapeAttr(task.id)}')">${t('focus.btnResume')}</button>
            <button class="btn done" onclick="app.completeTask('${escapeAttr(task.id)}')">${t('focus.btnComplete')}</button>
          ` : isCompleted ? `
            <button class="btn secondary" onclick="app.openTimePopover('${escapeAttr(task.id)}', event)">${t('focus.btnAdjustTime')}</button>
            <button class="btn secondary" onclick="app.uncompleteTask('${escapeAttr(task.id)}')">${t('focus.btnReopenTask')}</button>
            <a href="#/" class="btn done" style="text-decoration:none;">${t('focus.btnBackToBoard')}</a>
          ` : `
            <button class="btn run" onclick="app.startTask('${escapeAttr(task.id)}')">${t('focus.btnStart')}</button>
            <button class="btn done" onclick="app.completeTask('${escapeAttr(task.id)}')">${t('focus.btnComplete')}</button>
          `}
        </div>

        <span class="focus-updated">${t('focus.updatedAt', { time: fmt(now) })}</span>
      </div>
    `;
  }

  return { renderInterruptionView, renderTaskFocusView };
}

export default TodayTasksFocusView;
