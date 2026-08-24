/* views/focus.js — Vistas de pantalla completa: interrupción y foco de tarea */
import { nowMinutes, fmt, fmtDur, getTaskElapsed } from '../utils.js';
import { escapeHtml, escapeAttr } from '../ui.js';

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
          <div class="interruption-badge">⚡ Interrupción en curso</div>

          <div class="interruption-input-group">
            <input type="text"
                   id="interruptionTitleInput"
                   class="interruption-input"
                   value="${escapeAttr(state.activeInterruption.title || '')}"
                   placeholder="Motivo (ej: llamada, duda, reunión improvisada...)"
                   oninput="app.updateInterruptionTitle(this.value)"
                   autocomplete="off">
          </div>

          <div class="interruption-timer-box">
            <div class="interruption-time-label">Tiempo transcurrido</div>
            <div class="interruption-time-value">${timerDisplay}</div>
            <div class="interruption-start-meta">Iniciada a las ${fmt(state.activeInterruption.start)}</div>
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
    const container = document.getElementById('view-task') || document.getElementById('view-focus');
    if(!container) return;

    const taskId = getFocusTaskId ? getFocusTaskId() : (ctx.getFocusTaskId ? ctx.getFocusTaskId() : null);
    if(taskId === null || taskId === undefined){
      if (typeof window !== "undefined") window.location.hash = '#/';
      return;
    }

    const state = getState ? getState() : {};
    const t = (state.tasks || []).find(x => String(x.id) === String(taskId));
    if(!t){
      if (typeof window !== "undefined") window.location.hash = '#/';
      return;
    }

    const now = nowMinutes();
    const elapsed = getTaskElapsed(t);
    const planned = t.planned || 1;
    const isCompleted = t.status === 'completed';
    const isOverrun = !isCompleted && elapsed > planned;
    const remaining = Math.max(0, planned - elapsed);
    const overrunMinutes = isOverrun ? (elapsed - planned) : 0;

    const radius = 100;
    const circumference = +(2 * Math.PI * radius).toFixed(2);
    const fraction = isCompleted ? 1 : Math.min(1, elapsed / planned);
    const dashOffset = +(circumference * (1 - fraction)).toFixed(2);

    let ringClass = '';
    if(t.status === 'paused') ringClass += ' state-paused';
    if(isCompleted) ringClass += ' state-completed';
    if(isOverrun) ringClass += ' state-overrun';

    let plannedEnd = null;
    if(t.status === 'running' && t.runningStart !== null && t.runningStart !== undefined){
      plannedEnd = t.runningStart + Math.max(0, t.planned - (t.elapsedBefore || 0));
    }

    let ringMainText = '';
    let ringLabelText = '';
    if(isCompleted){
      ringMainText = 'Completada';
      ringLabelText = `${fmtDur(elapsed)} dedicados`;
    } else if(isOverrun){
      ringMainText = `+${fmtDur(overrunMinutes)}`;
      ringLabelText = 'tiempo extra';
    } else {
      ringMainText = fmtDur(remaining);
      ringLabelText = 'restante';
    }

    container.innerHTML = `
      <div class="focus-view">
        <div class="focus-header">
          <a href="#/" class="btn secondary small focus-back" title="Volver al tablero (Esc)">← Volver al tablero</a>
        </div>

        <h2 class="focus-task-name">${escapeHtml(t.title)}</h2>

        <div class="focus-ring-wrap">
          <svg class="focus-ring" viewBox="0 0 240 240">
            <circle class="ring-track" cx="120" cy="120" r="${radius}" fill="none" stroke-width="12"/>
            <circle class="ring-progress ${ringClass}"
                    cx="120" cy="120" r="${radius}"
                    fill="none" stroke-width="12"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${dashOffset}"/>
          </svg>
          <div class="focus-ring-center">
            <div class="ring-main-time ${isOverrun ? 'overrun-text' : ''}">
              ${ringMainText}
            </div>
            <div class="ring-label">
              ${ringLabelText}
            </div>
          </div>
        </div>

        <div class="focus-meta">
          <div class="focus-meta-item">
            <span class="meta-label">Planificado</span>
            <span class="meta-value">${fmtDur(t.planned)}</span>
          </div>
          <div class="focus-meta-item">
            <span class="meta-label">Transcurrido</span>
            <span class="meta-value task-duration-clickable" title="Clic para ajustar tiempo transcurrido" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)">${fmtDur(elapsed)}</span>
          </div>
          ${plannedEnd !== null ? `
          <div class="focus-meta-item">
            <span class="meta-label">Fin previsto</span>
            <span class="meta-value">${fmt(plannedEnd)}</span>
          </div>` : ''}
        </div>

        <div class="focus-actions">
          ${t.status === 'running' ? `
            <button class="btn pause" onclick="app.pauseTask('${escapeAttr(t.id)}')">⏸ Pausar</button>
            <button class="btn done" onclick="app.completeTask('${escapeAttr(t.id)}')">✓ Completar</button>
          ` : t.status === 'paused' ? `
            <button class="btn run" onclick="app.resumeTask('${escapeAttr(t.id)}')">▶ Reanudar</button>
            <button class="btn done" onclick="app.completeTask('${escapeAttr(t.id)}')">✓ Completar</button>
          ` : isCompleted ? `
            <button class="btn secondary" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)">⏱ Ajustar tiempo</button>
            <button class="btn secondary" onclick="app.uncompleteTask('${escapeAttr(t.id)}')">↩ Reabrir tarea</button>
            <a href="#/" class="btn done" style="text-decoration:none;">✓ Volver al tablero</a>
          ` : `
            <button class="btn run" onclick="app.startTask('${escapeAttr(t.id)}')">▶ Iniciar</button>
            <button class="btn done" onclick="app.completeTask('${escapeAttr(t.id)}')">✓ Completar</button>
          `}
        </div>

        <span class="focus-updated">Actualizado: ${fmt(now)}</span>
      </div>
    `;
  }


  return { renderInterruptionView, renderTaskFocusView };
}

export default TodayTasksFocusView;
