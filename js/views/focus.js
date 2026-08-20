/* views/focus.js — Vistas de pantalla completa: interrupción y foco de tarea */
import { nowMinutes, fmt, fmtDur } from '../utils.js';
import { escapeHtml, escapeAttr } from '../ui.js';

export function TodayTasksFocusView(ctx){
  const { getState, getCurrentView, getFocusTaskId, fmtMMSS, RING_R, RING_C } = ctx;

  const _nowMinutes = () => (window.TodayTasksUtils && window.TodayTasksUtils.nowMinutes) ? window.TodayTasksUtils.nowMinutes() : nowMinutes();
  const _fmt = (min) => (window.TodayTasksUtils && window.TodayTasksUtils.fmt) ? window.TodayTasksUtils.fmt(min) : fmt(min);
  const _fmtDur = (min) => (window.TodayTasksUtils && window.TodayTasksUtils.fmtDur) ? window.TodayTasksUtils.fmtDur(min) : fmtDur(min);
  const _escapeHtml = (str) => (window.TodayTasksUi && window.TodayTasksUi.escapeHtml) ? window.TodayTasksUi.escapeHtml(str) : escapeHtml(str);
  const _escapeAttr = (str) => (window.TodayTasksUi && window.TodayTasksUi.escapeAttr) ? window.TodayTasksUi.escapeAttr(str) : escapeAttr(str);

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
      state.activeInterruption.startEpoch = Date.now() - Math.max(0, _nowMinutes() - state.activeInterruption.start) * 60000;
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
          <div class="interruption-badge">⚡ Interrupción en curso</div>

          <div class="interruption-input-group">
            <input type="text"
                   id="interruptionTitleInput"
                   class="interruption-input"
                   value="${_escapeAttr(state.activeInterruption.title || '')}"
                   placeholder="Motivo (ej: llamada, duda, reunión improvisada...)"
                   oninput="app.updateInterruptionTitle(this.value)"
                   autocomplete="off">
          </div>

          <div class="interruption-timer-box">
            <div class="interruption-time-label">Tiempo transcurrido</div>
            <div class="interruption-time-value">${timerDisplay}</div>
            <div class="interruption-start-meta">Iniciada a las ${_fmt(state.activeInterruption.start)}</div>
          </div>

          <div style="display:flex;gap:12px;width:100%;">
            <button class="btn done interruption-finish-btn" style="flex:2;" onclick="app.completeInterruption()">✓ Finalizar interrupción</button>
            <button class="btn secondary" style="flex:1;border-radius:12px;font-weight:600;" onclick="app.cancelInterruption()" title="Cancelar interrupción sin guardar (Esc)">✕ Cancelar (Esc)</button>
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
    const container = document.getElementById('view-focus');
    if(!container) return;

    const taskId = getFocusTaskId();
    if(taskId === null){
      if (typeof window !== "undefined") window.location.hash = '#/';
      return;
    }

    const state = getState();
    const t = (state.tasks || []).find(x => x.id === taskId);
    if(!t){
      if (typeof window !== "undefined") window.location.hash = '#/';
      return;
    }

    const now = _nowMinutes();
    let elapsed = t.elapsedBefore || 0;
    if(t.status === 'running' && t.runningStart !== null && t.runningStart !== undefined){
      elapsed += Math.max(0, now - t.runningStart);
    }
    const planned = t.planned || 1;
    const isOverrun = elapsed > planned;
    const remaining = Math.max(0, planned - elapsed);
    const overrunMinutes = isOverrun ? (elapsed - planned) : 0;

    const fraction = Math.min(1, elapsed / planned);
    const dashOffset = RING_C * (1 - fraction);

    let ringClass = 'progress-ring-fill';
    if(t.status === 'paused') ringClass += ' paused';
    if(isOverrun) ringClass += ' overrun';

    let plannedEnd = null;
    if(t.status === 'running' && t.runningStart !== null && t.runningStart !== undefined){
      plannedEnd = t.runningStart + Math.max(0, t.planned - (t.elapsedBefore || 0));
    }

    container.innerHTML = `
      <div class="focus-view">
        <button class="focus-back-btn" onclick="window.location.hash='#/'" title="Volver al tablero (Esc)">← Volver al tablero</button>

        <div class="focus-title">${_escapeHtml(t.title)}</div>

        <div class="focus-ring-container">
          <svg class="focus-ring-svg" viewBox="0 0 240 240">
            <circle class="progress-ring-bg" cx="120" cy="120" r="${RING_R}"/>
            <circle class="${ringClass}"
                    cx="120" cy="120" r="${RING_R}"
                    stroke-dasharray="${RING_C}"
                    stroke-dashoffset="${dashOffset}"/>
          </svg>
          <div class="focus-ring-center">
            <div class="focus-time-display ${isOverrun ? 'overrun' : ''}">
              ${isOverrun ? `+${_fmtDur(overrunMinutes)}` : _fmtDur(remaining)}
            </div>
            <div class="focus-ring-label ${isOverrun ? 'overrun' : ''}">
              ${isOverrun ? 'tiempo extra' : 'restante'}
            </div>
          </div>
        </div>

        <div class="focus-meta-grid">
          <div class="focus-meta-item">
            <span class="meta-label">Planificado</span>
            <span class="meta-value">${_fmtDur(t.planned)}</span>
          </div>
          <div class="focus-meta-item">
            <span class="meta-label">Transcurrido</span>
            <span class="meta-value task-duration-clickable" title="Clic para ajustar tiempo transcurrido" onclick="app.openTimePopover('${_escapeAttr(t.id)}', event)">${_fmtDur(elapsed)}</span>
          </div>
          ${plannedEnd !== null ? `
          <div class="focus-meta-item">
            <span class="meta-label">Fin previsto</span>
            <span class="meta-value">${_fmt(plannedEnd)}</span>
          </div>` : ''}
        </div>

        <div class="focus-actions">
          ${t.status === 'running' ? `
            <button class="btn pause" onclick="app.pauseTask(${t.id})">⏸ Pausar</button>
            <button class="btn done" onclick="app.completeTask(${t.id})">✓ Completar</button>
          ` : t.status === 'paused' ? `
            <button class="btn run" onclick="app.resumeTask(${t.id})">▶ Reanudar</button>
            <button class="btn done" onclick="app.completeTask(${t.id})">✓ Completar</button>
          ` : `
            <button class="btn run" onclick="app.startTask(${t.id})">▶ Iniciar</button>
            <button class="btn done" onclick="app.completeTask(${t.id})">✓ Completar</button>
          `}
        </div>

        <span class="focus-updated">Actualizado: ${_fmt(now)}</span>
      </div>
    `;
  }

  return { renderInterruptionView, renderTaskFocusView };
}

if (typeof window !== "undefined") {
  window._TodayTasksFocusView = TodayTasksFocusView;
}

export default TodayTasksFocusView;
