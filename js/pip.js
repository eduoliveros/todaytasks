/* js/pip.js — Módulo Document Picture-in-Picture (PiP) para TodayTasks */
import { nowMinutes, fmt, fmtDur, getTaskElapsed } from './utils.js';
import { escapeHtml, escapeAttr } from './ui.js';
import { t } from './i18n.js';

export function TodayTasksPiP(ctx) {
  const { getState, saveState, actionsModule, showToast, fmtMMSS } = ctx;

  let pipWindow = null;
  let tickTimer = null;

  function isSupported() {
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  }

  function isOpen() {
    return pipWindow !== null && !pipWindow.closed;
  }

  function syncTheme() {
    if (!isOpen()) return;
    try {
      const isDark = (typeof document !== 'undefined') && document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        pipWindow.document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        pipWindow.document.documentElement.removeAttribute('data-theme');
      }
    } catch (e) {
      console.warn('Error syncing theme to PiP:', e);
    }
  }

  function copyStylesToPiP(pipDoc) {
    if (!pipDoc || !pipDoc.head) return;

    // 1. Fuentes de Google
    const preconnect = pipDoc.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = 'https://fonts.googleapis.com';
    pipDoc.head.appendChild(preconnect);

    const fontLink = pipDoc.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap';
    pipDoc.head.appendChild(fontLink);

    // 2. Clonar estilos del documento principal
    if (typeof document !== 'undefined') {
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
        try {
          pipDoc.head.appendChild(node.cloneNode(true));
        } catch (err) {
          console.warn('Error cloning stylesheet to PiP:', err);
        }
      });
    }

    // 3. Asegurar enlace a css/pip.css si no estuviera cargado
    const hasPipCss = Array.from(pipDoc.querySelectorAll('link')).some(l => l.href && l.href.includes('pip.css'));
    if (!hasPipCss) {
      const pipLink = pipDoc.createElement('link');
      pipLink.rel = 'stylesheet';
      pipLink.href = 'css/pip.css';
      pipDoc.head.appendChild(pipLink);
    }
  }

  function cleanup() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    pipWindow = null;
    updateAppPipButtons();
  }

  function closePiP() {
    if (isOpen()) {
      try {
        pipWindow.close();
      } catch (e) {
        console.warn('Error closing PiP window:', e);
      }
    }
    cleanup();
  }

  async function openPiP() {
    if (!isSupported()) {
      if (showToast) {
        showToast(t('pip.unsupportedToast'));
      }
      return false;
    }

    if (isOpen()) {
      try {
        pipWindow.focus();
      } catch (e) {}
      return true;
    }

    try {
      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 370,
        height: 195,
        disallowReturnToOpener: false
      });

      const pipDoc = pipWindow.document;
      pipDoc.title = t('pip.windowTitle');
      pipDoc.body.className = 'pip-window-body';

      copyStylesToPiP(pipDoc);
      syncTheme();

      pipWindow.addEventListener('pagehide', () => {
        cleanup();
        if (ctx.renderAll) ctx.renderAll();
      });

      // Atajos de teclado dentro de la ventana PiP
      pipWindow.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'Escape') {
          e.preventDefault();
          focusMainWindow();
          closePiP();
          if (ctx.renderAll) ctx.renderAll();
        }
      });

      // Render inicial
      render();

      // Bucle de actualización en vivo (cada 1 segundo)
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = setInterval(updateLiveClock, 1000);

      updateAppPipButtons();
      return true;
    } catch (err) {
      console.error('Error al abrir Document Picture-in-Picture:', err);
      cleanup();
      return false;
    }
  }

  async function togglePiP() {
    if (isOpen()) {
      closePiP();
      if (ctx.renderAll) ctx.renderAll();
      return false;
    } else {
      return await openPiP();
    }
  }

  function updateAppPipButtons() {
    if (typeof document === 'undefined') return;
    const isPiPActive = isOpen();
    document.querySelectorAll('.pip-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', isPiPActive);
      const label = btn.querySelector('.pip-btn-label');
      if (label) {
        label.textContent = isPiPActive ? t('pip.btnToggleClose') : t('pip.btnToggleOpen');
      }
    });
  }

  function focusMainWindow() {
    if (typeof window !== 'undefined' && typeof window.focus === 'function') {
      window.focus();
    }
  }

  /* ---------------- Renderizado y Lógica del Widget ---------------- */

  function render() {
    if (!isOpen()) return;
    const pipDoc = pipWindow.document;
    if (!pipDoc || !pipDoc.body) return;

    const state = getState ? getState() : {};
    const now = nowMinutes();

    // 1. Caso: Interrupción activa
    if (state.activeInterruption) {
      renderInterruptionMode(state.activeInterruption);
      return;
    }

    // 2. Buscar tarea activa (en marcha o pausada)
    const runningTask = (state.tasks || []).find(t => t.status === 'running');
    const pausedTask = !runningTask ? (state.tasks || []).find(t => t.status === 'paused') : null;
    const activeTask = runningTask || pausedTask;

    if (activeTask) {
      renderTaskActiveMode(activeTask, state, now);
    } else {
      renderIdleMode(state);
    }
  }

  function renderInterruptionMode(activeInt) {
    const pipDoc = pipWindow.document;
    const startEpoch = activeInt.startEpoch || (Date.now() - Math.max(0, nowMinutes() - activeInt.start) * 60000);
    const timeDisplay = fmtMMSS ? fmtMMSS(startEpoch) : '00:00';

    pipDoc.body.innerHTML = `
      <div class="pip-container">
        <div class="pip-header">
          <div class="pip-header-status">
            <span class="pip-status-dot interruption"></span>
            <span class="pip-status-text" style="color:var(--pip-danger);">${t('pip.statusInterruption')}</span>
          </div>
          <div class="pip-header-actions">
            <button class="pip-icon-btn" id="pipFocusAppBtn" title="${escapeAttr(t('pip.focusAppTooltip'))}">↗ App</button>
            <button class="pip-icon-btn close" id="pipCloseBtn" title="${escapeAttr(t('pip.closeTooltip'))}">✕</button>
          </div>
        </div>

        <div class="pip-body">
          <div class="pip-interruption-box">
            <div>
              <div style="font-size:11px;color:var(--pip-text-soft);">${t('pip.elapsedTime')}</div>
              <div class="pip-interruption-clock" id="pipLiveInterruptionClock">${timeDisplay}</div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(180,72,58,0.2);color:var(--pip-danger);font-weight:600;">${t('pip.pausedBadge')}</span>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:2fr 1fr;gap:6px;">
            <button class="pip-btn done" id="pipFinishIntBtn">${t('pip.btnFinish')}</button>
            <button class="pip-btn secondary" id="pipCancelIntBtn">${t('pip.btnDiscard')}</button>
          </div>
        </div>
      </div>
    `;

    bindHeaderEvents(pipDoc);
    const finishBtn = pipDoc.getElementById('pipFinishIntBtn');
    if (finishBtn) finishBtn.onclick = () => {
      if (actionsModule && actionsModule.completeInterruption) actionsModule.completeInterruption();
    };
    const cancelBtn = pipDoc.getElementById('pipCancelIntBtn');
    if (cancelBtn) cancelBtn.onclick = () => {
      if (actionsModule && actionsModule.cancelInterruption) actionsModule.cancelInterruption();
    };
  }

  function renderTaskActiveMode(task, state, now) {
    const pipDoc = pipWindow.document;
    const isRunning = task.status === 'running';
    const elapsed = getTaskElapsed(task, now);
    const planned = task.planned || 1;
    const isOverrun = elapsed > planned;
    const remainingMin = Math.max(0, planned - elapsed);
    const overrunMin = isOverrun ? (elapsed - planned) : 0;

    // Cálculo de segundos precisos
    let remainingSec = 0;
    let overrunSec = 0;
    if (isRunning && task.runningStartEpoch) {
      const totalElapsedSec = (task.elapsedBefore || 0) * 60 + Math.max(0, (Date.now() - task.runningStartEpoch) / 1000);
      const plannedSec = planned * 60;
      if (totalElapsedSec > plannedSec) {
        overrunSec = totalElapsedSec - plannedSec;
      } else {
        remainingSec = plannedSec - totalElapsedSec;
      }
    } else {
      if (isOverrun) {
        overrunSec = overrunMin * 60;
      } else {
        remainingSec = remainingMin * 60;
      }
    }

    const clockDisplay = isOverrun
      ? '+' + formatSecToMMSS(overrunSec)
      : formatSecToMMSS(remainingSec);

    const progressPct = isOverrun
      ? 100
      : Math.min(100, Math.max(0, Math.round((elapsed / planned) * 100)));

    // Detección de reuniones próximas / corte
    const meetings = (state.meetings || []).filter(m => m && typeof m.start === 'number' && typeof m.end === 'number');
    const ongoingMeeting = meetings.find(m => m.start <= now && m.end > now);
    const nextMeeting = !ongoingMeeting ? meetings.find(m => m.start > now) : null;
    const timeToMeetingMin = nextMeeting ? Math.max(0, nextMeeting.start - now) : null;
    const timeToMeetingSec = timeToMeetingMin !== null ? Math.max(0, timeToMeetingMin * 60 - ((Date.now() / 1000) % 60)) : null;

    const isCutoff = nextMeeting && (timeToMeetingMin < remainingMin);
    const isUrgentMeeting = nextMeeting && timeToMeetingMin <= 5;

    let meetingBannerHtml = '';
    if (ongoingMeeting) {
      meetingBannerHtml = `
        <div class="pip-meeting-banner urgent" title="${escapeAttr(t('pip.ongoingMeetingTooltip', { time: fmt(ongoingMeeting.end) }))}">
          <div class="pip-meeting-title-wrap">
            <span>🔴</span>
            <span><strong>${escapeHtml(ongoingMeeting.title)}</strong> ${t('pip.until', { time: fmt(ongoingMeeting.end) })}</span>
          </div>
        </div>
      `;
    } else if (nextMeeting && (isCutoff || timeToMeetingMin <= 30)) {
      meetingBannerHtml = `
        <div class="pip-meeting-banner ${isUrgentMeeting ? 'urgent' : ''}" title="${escapeAttr(t('pip.nextMeetingTooltip', { time: fmt(nextMeeting.start) }))}">
          <div class="pip-meeting-title-wrap">
            <span>${isUrgentMeeting ? '⚠️' : '📅'}</span>
            <span>${fmt(nextMeeting.start)} · <strong>${escapeHtml(nextMeeting.title)}</strong></span>
          </div>
          <div class="pip-meeting-countdown-pill" id="pipMeetingCountdownPill">
            <span style="font-size:9.5px;opacity:0.8;">${t('pip.inCountdown')}</span>
            <span id="pipLiveMeetingTimer">${formatSecToMMSS(timeToMeetingSec !== null ? timeToMeetingSec : timeToMeetingMin * 60)}</span>
          </div>
        </div>
      `;
    }

    // Muesca de corte en la barra de progreso
    let notchHtml = '';
    if (isCutoff && planned > 0) {
      const cutoffPct = Math.min(96, Math.max(4, Math.round(((elapsed + timeToMeetingMin) / planned) * 100)));
      notchHtml = `
        <div class="pip-progress-notch" style="left:${cutoffPct}%;" title="${escapeAttr(t('pip.cutoffTooltip', { title: nextMeeting.title, time: fmt(nextMeeting.start) }))}">
          <div class="pip-notch-caret">▼</div>
          <div class="pip-notch-bar"></div>
        </div>
      `;
    }

    const urgencyLabels = {
      today: { icon: '🟠', label: t('urgency.today'), bg: 'rgba(249,115,22,0.15)', text: '#FB923C' },
      days: { icon: '🔵', label: t('urgency.days'), bg: 'rgba(59,130,246,0.12)', text: '#60A5FA' },
      week: { icon: '🟣', label: t('urgency.week'), bg: 'rgba(168,85,247,0.12)', text: '#C084FC' },
      later: { icon: '⚪', label: t('urgency.later'), bg: 'rgba(156,163,175,0.12)', text: '#9CA3AF' }
    };
    const urgency = urgencyLabels[task.urgency || 'days'] || urgencyLabels.days;

    const timerLabel = isOverrun ? t('pip.labelExtraTime') : (isRunning ? t('pip.labelRemaining') : t('pip.labelPaused'));
    const timerMeta = isOverrun ? t('pip.metaOverrun') : t('pip.metaPlan', { time: fmtDur(planned) });

    pipDoc.body.innerHTML = `
      <div class="pip-container">
        <div class="pip-header">
          <div class="pip-header-status">
            <span class="pip-status-dot ${isRunning ? (isOverrun ? 'overrun' : 'running') : 'paused'}"></span>
            <span class="pip-status-text">${isRunning ? (isOverrun ? t('pip.statusOverrun') : t('pip.statusRunning')) : t('pip.statusPaused')}</span>
          </div>
          <div class="pip-header-actions">
            <button class="pip-icon-btn" id="pipFocusAppBtn" title="${escapeAttr(t('pip.focusAppMainTooltip'))}">↗ App</button>
            <button class="pip-icon-btn close" id="pipCloseBtn" title="${escapeAttr(t('pip.closeWidgetTooltip'))}">✕</button>
          </div>
        </div>

        <div class="pip-body">
          <div class="pip-task-title-row">
            <h3 class="pip-task-title" title="${escapeAttr(task.title)}">${escapeHtml(task.title)}</h3>
            <span class="pip-task-badge" style="background:${urgency.bg};color:${urgency.text};">${urgency.icon} ${urgency.label}</span>
          </div>

          ${meetingBannerHtml}

          <div class="pip-timer-card">
            <div class="pip-timer-header">
              <div class="pip-timer-left">
                <span class="pip-timer-clock ${isOverrun ? 'overrun' : (isRunning ? '' : 'paused')}" id="pipLiveTaskClock">${clockDisplay}</span>
                <span class="pip-timer-label ${isOverrun ? 'overrun' : ''}" id="pipLiveTaskLabel">${timerLabel}</span>
              </div>
              <span class="pip-timer-meta ${isOverrun ? 'overrun' : ''}">${timerMeta}</span>
            </div>

            <div class="pip-progress-track">
              <div class="pip-progress-fill ${isOverrun ? 'overrun' : (isRunning ? '' : 'paused')}" id="pipLiveProgressFill" style="width:${progressPct}%;"></div>
              ${notchHtml}
            </div>
          </div>

          <div class="pip-actions-row">
            ${isRunning ? `
              <button class="pip-btn pause" id="pipPauseBtn">${t('pip.btnPause')}</button>
            ` : `
              <button class="pip-btn play" id="pipResumeBtn">${t('pip.btnResume')}</button>
            `}
            <button class="pip-btn done" id="pipCompleteBtn">${t('pip.btnDone')}</button>
            <button class="pip-btn danger" id="pipInterruptBtn">${t('pip.btnInterrupt')}</button>
          </div>
        </div>
      </div>
    `;

    bindHeaderEvents(pipDoc);

    const pauseBtn = pipDoc.getElementById('pipPauseBtn');
    if (pauseBtn) pauseBtn.onclick = () => {
      if (actionsModule && actionsModule.pauseTask) actionsModule.pauseTask(task.id);
    };

    const resumeBtn = pipDoc.getElementById('pipResumeBtn');
    if (resumeBtn) resumeBtn.onclick = () => {
      if (actionsModule && actionsModule.resumeTask) actionsModule.resumeTask(task.id);
    };

    const completeBtn = pipDoc.getElementById('pipCompleteBtn');
    if (completeBtn) completeBtn.onclick = () => {
      if (actionsModule && actionsModule.completeTask) actionsModule.completeTask(task.id);
    };

    const interruptBtn = pipDoc.getElementById('pipInterruptBtn');
    if (interruptBtn) interruptBtn.onclick = () => {
      if (actionsModule && actionsModule.startInterruption) actionsModule.startInterruption();
    };
  }

  function renderIdleMode(state) {
    const pipDoc = pipWindow.document;
    const pendingTasks = (state.tasks || []).filter(task => task.status !== 'completed');
    const nextTask = pendingTasks.length > 0 ? pendingTasks[0] : null;

    pipDoc.body.innerHTML = `
      <div class="pip-container">
        <div class="pip-header">
          <div class="pip-header-status">
            <span class="pip-status-dot idle"></span>
            <span class="pip-status-text">${t('pip.statusIdle')}</span>
          </div>
          <div class="pip-header-actions">
            <button class="pip-icon-btn" id="pipFocusAppBtn" title="${escapeAttr(t('pip.focusAppMainTooltip'))}">↗ App</button>
            <button class="pip-icon-btn close" id="pipCloseBtn" title="${escapeAttr(t('pip.closeWidgetTooltip'))}">✕</button>
          </div>
        </div>

        <div class="pip-body" style="text-align:center;">
          ${nextTask ? `
            <div style="font-size:11px;color:var(--pip-text-soft);">${t('pip.nextTaskInQueue')}</div>
            <div style="font-weight:600;font-size:13px;color:var(--pip-text);margin:3px 0 8px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeAttr(nextTask.title)}">
              "${escapeHtml(nextTask.title)}"
            </div>
            <button class="pip-btn play" id="pipStartNextBtn" style="width:100%;padding:7px;font-size:12px;">
              ${t('pip.btnStartTask', { time: fmtDur(nextTask.planned || 25) })}
            </button>
          ` : `
            <div style="color:var(--pip-text-soft);font-size:12px;margin-bottom:8px;">${t('pip.noPendingTasks')}</div>
            <button class="pip-btn secondary" id="pipFocusAppBtn2" style="width:100%;">
              ${t('pip.btnOpenMainBoard')}
            </button>
          `}
        </div>
      </div>
    `;

    bindHeaderEvents(pipDoc);

    const startNextBtn = pipDoc.getElementById('pipStartNextBtn');
    if (startNextBtn && nextTask) {
      startNextBtn.onclick = () => {
        if (actionsModule && actionsModule.startTask) actionsModule.startTask(nextTask.id);
      };
    }

    const focusBtn2 = pipDoc.getElementById('pipFocusAppBtn2');
    if (focusBtn2) {
      focusBtn2.onclick = focusMainWindow;
    }
  }

  function bindHeaderEvents(pipDoc) {
    const focusBtn = pipDoc.getElementById('pipFocusAppBtn');
    if (focusBtn) focusBtn.onclick = focusMainWindow;

    const closeBtn = pipDoc.getElementById('pipCloseBtn');
    if (closeBtn) closeBtn.onclick = closePiP;
  }

  /* ---------------- Actualización en Vivo (Segundero) ---------------- */

  function updateLiveClock() {
    if (!isOpen()) return;
    const pipDoc = pipWindow.document;
    if (!pipDoc) return;

    const state = getState ? getState() : {};

    // 1. Si hay interrupción en curso
    if (state.activeInterruption) {
      const clockEl = pipDoc.getElementById('pipLiveInterruptionClock');
      if (clockEl) {
        const startEpoch = state.activeInterruption.startEpoch || (Date.now() - Math.max(0, nowMinutes() - state.activeInterruption.start) * 60000);
        clockEl.textContent = fmtMMSS ? fmtMMSS(startEpoch) : '00:00';
      }
      return;
    }

    // 2. Si hay tarea en curso
    const runningTask = (state.tasks || []).filter(t => t.status === 'running')[0];
    if (runningTask && runningTask.runningStartEpoch) {
      const plannedSec = (runningTask.planned || 1) * 60;
      const totalElapsedSec = (runningTask.elapsedBefore || 0) * 60 + Math.max(0, (Date.now() - runningTask.runningStartEpoch) / 1000);
      const isOverrun = totalElapsedSec > plannedSec;

      const clockEl = pipDoc.getElementById('pipLiveTaskClock');
      const labelEl = pipDoc.getElementById('pipLiveTaskLabel');
      const fillEl = pipDoc.getElementById('pipLiveProgressFill');

      if (clockEl) {
        if (isOverrun) {
          const extraSec = totalElapsedSec - plannedSec;
          clockEl.textContent = '+' + formatSecToMMSS(extraSec);
          clockEl.className = 'pip-timer-clock overrun';
          if (labelEl) {
            labelEl.textContent = t('pip.labelExtraTime');
            labelEl.className = 'pip-timer-label overrun';
          }
          if (fillEl) {
            fillEl.style.width = '100%';
            fillEl.className = 'pip-progress-fill overrun';
          }
        } else {
          const remSec = plannedSec - totalElapsedSec;
          clockEl.textContent = formatSecToMMSS(remSec);
          clockEl.className = 'pip-timer-clock';
          if (labelEl) {
            labelEl.textContent = t('pip.labelRemaining');
            labelEl.className = 'pip-timer-label';
          }
          if (fillEl) {
            const pct = Math.min(100, Math.max(0, Math.round((totalElapsedSec / plannedSec) * 100)));
            fillEl.style.width = pct + '%';
            fillEl.className = 'pip-progress-fill';
          }
        }
      }

      // Actualizar cuenta regresiva de reunión
      const now = nowMinutes();
      const meetings = (state.meetings || []).filter(m => m && typeof m.start === 'number' && typeof m.end === 'number');
      const nextMeeting = meetings.find(m => m.start > now);
      if (nextMeeting) {
        const meetingClockEl = pipDoc.getElementById('pipLiveMeetingTimer');
        if (meetingClockEl) {
          const secToMeet = Math.max(0, (nextMeeting.start - now) * 60 - Math.floor((Date.now() / 1000) % 60));
          meetingClockEl.textContent = formatSecToMMSS(secToMeet);
        }
      }
    }
  }

  function formatSecToMMSS(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const m = Math.floor(s / 60);
    const remS = s % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return String(h).padStart(2, '0') + ':' + String(remM).padStart(2, '0') + ':' + String(remS).padStart(2, '0');
    }
    return String(m).padStart(2, '0') + ':' + String(remS).padStart(2, '0');
  }

  return {
    isSupported,
    isOpen,
    openPiP,
    closePiP,
    togglePiP,
    render,
    syncTheme,
    updateAppPipButtons
  };
}

export default TodayTasksPiP;
