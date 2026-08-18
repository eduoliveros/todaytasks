/* views/focus.js — Vistas de pantalla completa: interrupción y foco de tarea */
(function(){
  "use strict";

  window._TodayTasksFocusView = function(ctx){
    const { getState, getCurrentView, getFocusTaskId, fmtMMSS, RING_R, RING_C } = ctx;
    const { nowMinutes, fmt, fmtDur } = window.TodayTasksUtils;
    const { escapeHtml, escapeAttr } = window.TodayTasksUi;

    function renderInterruptionView(){
      const container = document.getElementById('view-interruption');
      if(!container) return;

      const state = getState();
      if(!state.activeInterruption){
        window.location.hash = '#/';
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
        if(input){ input.focus(); }
      }, 50);
    }

    function renderTaskFocusView(){
      const container = document.getElementById('view-task');
      if(!container) return;
      const state = getState();
      const focusTaskId = getFocusTaskId();
      const t = state.tasks.find(t => String(t.id) === String(focusTaskId));
      if(!t || t.status === 'completed'){
        window.location.hash = '#/';
        return;
      }

      const now = nowMinutes();
      const elapsed = window.TodayTasksUtils.getTaskElapsed(t);
      const remaining = t.planned - elapsed;
      const overrun = remaining < 0;
      const pct = Math.min(elapsed / t.planned, 1);
      const dashOffset = +(RING_C * (1 - pct)).toFixed(2);
      const plannedEnd = t.runningStart !== null
        ? t.runningStart + (t.planned - (t.elapsedBefore || 0))
        : null;

      const ringClass = t.status === 'paused' ? 'state-paused' : (overrun ? 'state-overrun' : '');
      const timeDisplay = overrun ? fmtDur(-remaining) : fmtDur(remaining);
      const labelText  = overrun ? '⚠️ excedida' : t.status === 'paused' ? 'en pausa' : (t.status === 'pending' ? 'sin iniciar' : 'restantes');

      container.innerHTML = `
        <div class="focus-view">
          <div class="focus-header">
            <a href="#/" class="btn secondary focus-back">← Inicio</a>
            <span class="badge ${t.status}">${t.status === 'running' ? 'en ejecución' : (t.status === 'paused' ? 'en pausa' : 'pendiente')}</span>
          </div>

          <h2 class="focus-task-name">${escapeHtml(t.title)}</h2>

          <div class="focus-ring-wrap">
            <svg class="focus-ring" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <circle class="ring-track" cx="100" cy="100" r="${RING_R}" stroke-width="16" fill="none"/>
              <circle class="ring-progress ${ringClass}"
                      cx="100" cy="100" r="${RING_R}"
                      stroke-width="16" fill="none"
                      stroke-dasharray="${RING_C}"
                      stroke-dashoffset="${dashOffset}"
                      transform="rotate(-90 100 100)"/>
            </svg>
            <div class="focus-ring-center">
              <div class="ring-main-time${overrun ? ' overrun-text' : ''}" style="cursor:pointer;" title="Clic para ajustar tiempo consumido" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)">${timeDisplay}</div>
              <div class="ring-label">${labelText}</div>
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

          <span class="focus-updated">Actualizado: ${fmt(now)}</span>
        </div>
      `;
    }

    return { renderInterruptionView, renderTaskFocusView };
  };
})();
