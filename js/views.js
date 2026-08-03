(function(){
  "use strict";

  const { nowMinutes, fmt, fmtDur, fmtRemaining } = window.TodayTasksUtils;
  const { escapeHtml, escapeAttr } = window.TodayTasksUi;

  window.TodayTasksViews = function(ctx){
    const {
      getState, getMeetingEdit, getTaskEdit, getCurrentView, getFocusTaskId,
      computeSchedule, fmtMMSS, RING_R, RING_C
    } = ctx;

    function renderClock(){
      document.getElementById("clockDisplay").textContent = fmt(nowMinutes());
    }

    function renderHeaderStats(){
      const el = document.getElementById("headerStats");
      if(!el) return;
      const state = getState();
      const meetingsTotal = state.meetings.reduce((s,m) => s + (m.end - m.start), 0);
      const activeTasks = state.tasks.filter(t => t.status !== "completed");
      const tasksTotal = activeTasks.reduce((s,t) => s + t.planned, 0);
      const completedTotal = state.tasks
        .filter(t => t.status === "completed")
        .reduce((s,t) => s + (t.actualDuration||0), 0);
      const intTotal = (state.interruptions||[]).reduce((s,i) => s + (i.duration||0), 0);

      el.innerHTML = `
        <span class="stat-chip stat-meeting"><span class="stat-icon">🗓</span>Reuniones <span class="stat-value">${fmtDur(meetingsTotal)}</span></span>
        <span class="stat-chip stat-task"><span class="stat-icon">🗒</span>Tareas por hacer <span class="stat-value">${fmtDur(tasksTotal)}</span></span>
        <span class="stat-chip"><span class="stat-icon">✓</span>Completado hoy <span class="stat-value">${fmtDur(completedTotal)}</span></span>
        ${intTotal > 0 ? `<span class="stat-chip"><span class="stat-icon">⚡</span>Interrupciones <span class="stat-value" style="color:var(--danger)">${fmtDur(intTotal)}</span></span>` : ''}
      `;
    }

    function renderTaskProgressBar(){
      const container = document.getElementById("taskProgressContainer");
      if(!container) return;

      const state = getState();
      const tasks = state.tasks;
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === "completed").length;
      const running = tasks.filter(t => t.status === "running").length;
      const paused = tasks.filter(t => t.status !== "completed" && t.status !== "running" && (t.status === "paused" || (t.elapsedBefore || 0) > 0)).length;
      const unstarted = tasks.filter(t => t.status === "pending" && (!t.elapsedBefore || t.elapsedBefore === 0)).length;

      if(total === 0){
        container.innerHTML = `
          <div class="progress-banner">
            <div class="progress-header">
              <div class="progress-header-left">
                <span class="progress-title">Progreso de tareas</span>
                <div class="progress-legend">
                  <span class="legend-item leg-completed"><span class="dot"></span> 0 completadas</span>
                  <span class="legend-item leg-running"><span class="dot"></span> 0 en ejecución</span>
                  <span class="legend-item leg-paused"><span class="dot"></span> 0 en pausa</span>
                  <span class="legend-item leg-pending"><span class="dot"></span> 0 sin iniciar</span>
                </div>
              </div>
              <span class="progress-total-badge">Total: <strong>0</strong> tareas</span>
            </div>
            <div class="progress-track empty-track">
              <span class="empty-track-text">No hay tareas creadas todavía</span>
            </div>
          </div>
        `;
        return;
      }

      const pctCompleted = (completed / total) * 100;
      const pctRunning = (running / total) * 100;
      const pctPaused = (paused / total) * 100;
      const pctUnstarted = (unstarted / total) * 100;

      const compLabel = completed > 0 ? (pctCompleted >= 10 ? `${completed} completada${completed!==1?'s':''}` : `${completed}`) : '';
      const runLabel = running > 0 ? (pctRunning >= 10 ? `${running} en curso` : `${running}`) : '';
      const pauseLabel = paused > 0 ? (pctPaused >= 10 ? `${paused} en pausa` : `${paused}`) : '';
      const unstartedLabel = unstarted > 0 ? (pctUnstarted >= 10 ? `${unstarted} sin iniciar` : `${unstarted}`) : '';

      container.innerHTML = `
        <div class="progress-banner">
          <div class="progress-header">
            <div class="progress-header-left">
              <span class="progress-title">Progreso de tareas</span>
              <div class="progress-legend">
                <span class="legend-item leg-completed"><span class="dot"></span> ${completed} completada${completed!==1?'s':''}</span>
                <span class="legend-item leg-running"><span class="dot"></span> ${running} en ejecución</span>
                <span class="legend-item leg-paused"><span class="dot"></span> ${paused} en pausa</span>
                <span class="legend-item leg-pending"><span class="dot"></span> ${unstarted} sin iniciar</span>
              </div>
            </div>
            <span class="progress-total-badge">Total: <strong>${total}</strong> tarea${total!==1?'s':''}</span>
          </div>
          <div class="progress-track">
            <div class="progress-seg seg-completed" style="width: ${pctCompleted}%" title="${completed} completada${completed!==1?'s':''} (${Math.round(pctCompleted)}%)">
              ${compLabel ? `<span class="seg-label">${compLabel}</span>` : ''}
            </div>
            <div class="progress-seg seg-running" style="width: ${pctRunning}%" title="${running} en ejecución (${Math.round(pctRunning)}%)">
              ${runLabel ? `<span class="seg-label">${runLabel}</span>` : ''}
            </div>
            <div class="progress-seg seg-paused" style="width: ${pctPaused}%" title="${paused} en pausa (${Math.round(pctPaused)}%)">
              ${pauseLabel ? `<span class="seg-label">${pauseLabel}</span>` : ''}
            </div>
            <div class="progress-seg seg-pending" style="width: ${pctUnstarted}%" title="${unstarted} sin iniciar (${Math.round(pctUnstarted)}%)">
              ${unstartedLabel ? `<span class="seg-label">${unstartedLabel}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    function renderMeetings(){
      const el = document.getElementById("meetingsList");
      const state = getState();
      const meetingEdit = getMeetingEdit();
      if(state.meetings.length === 0){
        el.innerHTML = '<div class="empty">Aún no hay reuniones.</div>';
        return;
      }
      el.innerHTML = state.meetings.map(m => {
        if(meetingEdit && meetingEdit.id === m.id){
          return `
        <div class="item editing">
          <div class="row">
            <input type="text" value="${escapeAttr(meetingEdit.title)}" oninput="app.updateMeetingEditField('title', this.value)" placeholder="Título de la reunión">
          </div>
          <div class="row">
            <input type="time" value="${escapeAttr(meetingEdit.start)}" style="flex:1" oninput="app.updateMeetingEditField('start', this.value)">
            <input type="time" value="${escapeAttr(meetingEdit.end)}" style="flex:1" oninput="app.updateMeetingEditField('end', this.value)">
          </div>
          <div class="task-actions">
            <button class="btn small done" onclick="app.saveEditMeeting(${m.id})">Guardar</button>
            <button class="btn small secondary" onclick="app.cancelEditMeeting()">Cancelar</button>
          </div>
        </div>`;
        }
        return `
        <div class="item">
          <div class="top">
            <div>
              <div class="title">${escapeHtml(m.title)}</div>
              <div class="time-range tr-meeting"><span class="tag">Inicio</span>${fmt(m.start)}<span class="arrow">→</span><span class="tag">Fin</span>${fmt(m.end)}</div>
              <div class="meta">colchón hasta ${fmt(m.end+10)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:2px;">
              <button class="icon-btn" title="Editar" onclick="app.startEditMeeting(${m.id})">✎</button>
              <button class="icon-btn" title="Eliminar" onclick="app.deleteMeeting(${m.id})">✕</button>
            </div>
          </div>
        </div>`;
      }).join("");
    }

    function renderTasks(schedule){
      const el = document.getElementById("tasksList");
      const state = getState();
      const taskEdit = getTaskEdit();
      const active = state.tasks.filter(t => t.status !== "completed")
                                 .sort((a,b)=>{
                                   if(a.status==="running") return -1;
                                   if(b.status==="running") return 1;
                                   return a.order-b.order;
                                 });
      if(active.length === 0){
        el.innerHTML = '<div class="empty">Aún no hay tareas.</div>';
        return;
      }

      el.innerHTML = active.map(t => {
        if(taskEdit && taskEdit.id === t.id){
          return `
          <div class="item task-item editing">
            <div class="row">
              <input type="text" value="${escapeAttr(taskEdit.title)}" oninput="app.updateTaskEditField('title', this.value)" placeholder="Título de la tarea">
            </div>
            <div class="row">
              <input type="number" min="1" value="${escapeAttr(taskEdit.duration)}" style="width:100px" oninput="app.updateTaskEditField('duration', this.value)" placeholder="Minutos">
            </div>
            <div class="task-actions">
              <button class="btn small done" onclick="app.saveEditTask(${t.id})">Guardar</button>
              <button class="btn small secondary" onclick="app.cancelEditTask()">Cancelar</button>
            </div>
          </div>`;
        }
        const segs = schedule.segmentsByTask[t.id] || [];
        const isOverflow = schedule.overflowIds.has(t.id);
        const label = t.status === "running" ? "en ejecución"
                    : t.status === "paused" ? "en pausa"
                    : "pendiente";
        const badgeClass = t.status;

        let startTag, startVal, endTag, endVal, trClass, splitNote = "", remainingChip = "";
        if(t.status === "running"){
          const plannedEnd = t.runningStart + (t.planned - (t.elapsedBefore||0));
          startTag = "Inicio real"; startVal = fmt(t.runningStart);
          endTag = "Fin previsto"; endVal = fmt(plannedEnd);
          trClass = "tr-running";
          const rem = fmtRemaining(plannedEnd, nowMinutes());
          remainingChip = `<span class="remaining-chip${rem.overrun?" overrun":""}">${rem.text}</span>`;
        } else if(segs.length){
          startTag = "Inicio est."; startVal = fmt(segs[0].start);
          endTag = "Fin est."; endVal = fmt(segs[segs.length-1].end);
          trClass = t.status === "paused" ? "tr-paused" : "tr-pending";
          if(segs.length > 1){
            splitNote = '<div class="meta">se divide en: ' + segs.map(s => fmt(s.start)+"–"+fmt(s.end)).join(", ") + " (por reuniones en medio)</div>";
          }
        } else {
          startTag = null;
        }

        const draggableAttrs = t.status !== "running"
          ? `draggable="true" ondragstart="app.taskDragStart(event, ${t.id})" ondragover="app.taskDragOver(event)" ondragleave="app.taskDragLeave(event)" ondrop="app.taskDrop(event, ${t.id})" ondragend="app.taskDragEnd(event)"`
          : "";

        return `
          <div class="item task-item state-${t.status}" ${draggableAttrs}>
            <div class="top">
              <div style="display:flex;gap:8px;">
                ${t.status!=="running" ? `<span class="drag-handle" title="Arrastrar para reordenar" onmousedown="app.armTaskDrag()">⠿</span>` : ""}
                <div>
                  <div class="title">${escapeHtml(t.title)}</div>
                  <div class="meta">${fmtDur(t.planned)} planificados${(t.elapsedBefore||0)>0 ? ` · ${fmtDur(t.elapsedBefore)} realizados` : ''}</div>
                  ${startTag ? `<div class="time-range ${trClass}"><span class="tag">${startTag}</span>${startVal}<span class="arrow">→</span><span class="tag">${endTag}</span>${endVal}${remainingChip ? " "+remainingChip : ""}</div>` : '<div class="meta" style="color:var(--danger)">sin hueco antes del fin de jornada</div>'}
                  ${splitNote}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="badge ${badgeClass}">${label}</span>
                <button class="icon-btn" title="Editar" onclick="app.startEditTask(${t.id})">✎</button>
                ${t.status!=="running" ? `<button class="icon-btn" title="Eliminar" onclick="app.deleteTask(${t.id})">✕</button>` : ""}
              </div>
            </div>
            ${isOverflow ? '<div class="meta" style="color:var(--danger)">⚠ no cabe antes del fin de jornada</div>' : ""}
            <div class="task-actions">
              ${t.status==="pending" ? `
                <button class="btn small run" onclick="app.startTask(${t.id})">▶ Iniciar</button>
                <div class="order-controls">
                  <button class="icon-btn" title="Subir" onclick="app.moveTask(${t.id},-1)">▲</button>
                  <button class="icon-btn" title="Bajar" onclick="app.moveTask(${t.id},1)">▼</button>
                </div>
              ` : ""}
              ${t.status==="running" ? `
                <a href="#/task/${t.id}" class="btn small secondary focus-link" title="Abrir vista de foco (Tecla 'F')">◎ Foco [F]</a>
                <button class="btn small pause" onclick="app.pauseTask(${t.id})">⏸ Pausar</button>
                <button class="btn small done" onclick="app.completeTask(${t.id})">✓ Completar</button>
              ` : ""}
              ${t.status==="paused" ? `
                <button class="btn small run" onclick="app.resumeTask(${t.id})">▶ Reanudar</button>
                <button class="btn small done" onclick="app.completeTask(${t.id})">✓ Completar</button>
                <div class="order-controls">
                  <button class="icon-btn" title="Subir" onclick="app.moveTask(${t.id},-1)">▲</button>
                  <button class="icon-btn" title="Bajar" onclick="app.moveTask(${t.id},1)">▼</button>
                </div>
              ` : ""}
            </div>
          </div>
        `;
      }).join("");
    }

    function renderBoard(schedule){
      const el = document.getElementById("boardContent");
      const state = getState();
      const now = schedule.now;
      const viewStart = schedule.viewStart;
      const workEnd = state.workEnd;

      const titleEl = document.getElementById("boardTitle");
      const badgeEl = document.getElementById("boardNow");
      if(titleEl){
        titleEl.textContent = state.planningMode
          ? "Plan completo · desde el inicio de jornada"
          : "Desde ahora hasta el fin de jornada";
      }
      if(badgeEl){
        badgeEl.textContent = state.planningMode
          ? "inicio " + fmt(state.workStart)
          : "ahora " + fmt(now);
      }

      const events = [];
      for(const m of state.meetings){
        if(m.end + 10 <= viewStart) continue;
        events.push({start:Math.max(m.start, viewStart-1440), end:m.end, kind:"meeting", label:m.title});
        events.push({start:m.end, end:m.end+10, kind:"buffer", label:m.title});
      }
      for(const t of state.tasks){
        if(t.status === "completed") continue;
        const segs = schedule.segmentsByTask[t.id] || [];
        for(const s of segs){
          events.push({start:s.start, end:s.end, kind:"task-"+t.status, label:t.title});
        }
      }
      events.sort((a,b)=>a.start-b.start);
      const visible = events.filter(e => e.end > viewStart && e.start < workEnd);

      if(!state.planningMode && now >= workEnd){
        el.innerHTML = '<div class="board-empty">La jornada laboral ha terminado. Consulta el resumen abajo.</div>';
        return;
      }

      if(visible.length === 0){
        el.innerHTML = '<div class="board-empty">No hay reuniones ni tareas programadas hasta el fin de jornada (' + fmt(workEnd) + ').</div>';
        return;
      }

      let html = '<div class="track">';
      for(const e of visible){
        const start = Math.max(e.start, viewStart);
        const kindClass = e.kind === "meeting" ? "slot-meeting"
                         : e.kind === "buffer" ? "slot-buffer"
                         : "slot-task " + e.kind.replace("task-","");
        const label = e.kind === "meeting" ? "🗓 " + escapeHtml(e.label)
                    : e.kind === "buffer" ? "colchón · " + escapeHtml(e.label)
                    : escapeHtml(e.label) + (e.kind==="task-running" ? " (en curso)" : "");
        html += `
          <div class="slot ${kindClass}">
            <span class="time-label">${fmt(start)}<span class="sep">–</span>${fmt(e.end)}</span>
            <span>${label}</span>
            <span class="dur">${fmtDur(e.end-start)}</span>
          </div>`;
      }
      html += `<div class="slot" style="opacity:.6;border:1px dashed var(--board-line);background:none;">
          <span class="time-label">${fmt(workEnd)}</span>
          <span>fin de jornada</span>
        </div>`;
      html += '</div>';

      if(schedule.overflowIds.size > 0){
        html += `<div class="overflow-note">⚠ ${schedule.overflowIds.size} tarea(s) no caben antes del fin de jornada con el orden actual.</div>`;
      }

      el.innerHTML = html;
    }

    function renderSummary(schedule){
      const state = getState();
      const meetings = [...state.meetings].sort((a,b)=>a.start-b.start);
      const completed = state.tasks.filter(t=>t.status==="completed").sort((a,b)=>a.completedAt-b.completedAt);
      const pending = state.tasks.filter(t=>t.status!=="completed").sort((a,b)=>a.order-b.order);

      const meetingsEl = document.getElementById("meetingsSummaryList");
      meetingsEl.innerHTML = meetings.length ? meetings.map(m => `
        <div class="summary-row">
          <div class="row-top"><span>${escapeHtml(m.title)}</span></div>
          <div class="time-range tr-meeting"><span class="tag">Inicio</span>${fmt(m.start)}<span class="arrow">→</span><span class="tag">Fin</span>${fmt(m.end)}</div>
        </div>
      `).join("") : '<div class="empty">Ninguna todavía.</div>';

      const interruptions = [...(state.interruptions || [])].sort((a,b) => a.start - b.start);

      const completedEl = document.getElementById("completedList");
      const completedRows = completed.map(t => {
        const realStart = t.completedAt - t.actualDuration;
        return `
        <div class="summary-row">
          <div class="row-top"><span>${escapeHtml(t.title)}</span><span class="dur">${fmtDur(t.actualDuration)} (plan. ${fmtDur(t.planned)})</span></div>
          <div class="time-range tr-running"><span class="tag">Inicio</span>${fmt(realStart)}<span class="arrow">→</span><span class="tag">Fin</span>${fmt(t.completedAt)}</div>
          <div style="margin-top:6px">
            <button class="btn small secondary" onclick="app.uncompleteTask(${t.id})" title="Deshacer completado y volver a pendiente">↩ Reabrir</button>
          </div>
        </div>`;
      });

      const interruptionRows = interruptions.map(i => `
        <div class="summary-row summary-row-interruption">
          <div class="row-top">
            <span>⚡ ${escapeHtml(i.title)}</span>
            <span class="dur" style="color:var(--danger)">${fmtDur(i.duration)}</span>
          </div>
          <div class="time-range" style="background:#FEF2F0;border-color:#F1C4BC;">
            <span class="tag" style="color:var(--danger)">Inicio</span>${fmt(i.start)}
            <span class="arrow">→</span>
            <span class="tag" style="color:var(--danger)">Fin</span>${fmt(i.end)}
          </div>
        </div>`);

      const allCompleted = [...completedRows, ...interruptionRows];
      completedEl.innerHTML = allCompleted.length
        ? allCompleted.join('')
        : '<div class="empty">Ninguna todavía.</div>';

      const pendingEl = document.getElementById("pendingList");
      pendingEl.innerHTML = pending.length ? pending.map(t => {
        let rangeHtml;
        if(t.status === "running"){
          const plannedEnd = t.runningStart + (t.planned - (t.elapsedBefore||0));
          const rem = fmtRemaining(plannedEnd, nowMinutes());
          const chip = `<span class="remaining-chip${rem.overrun?" overrun":""}">${rem.text}</span>`;
          rangeHtml = `<div class="time-range tr-running"><span class="tag">Inicio real</span>${fmt(t.runningStart)}<span class="arrow">→</span><span class="tag">Fin previsto</span>${fmt(plannedEnd)} ${chip}</div>`;
        } else {
          const segs = (schedule && schedule.segmentsByTask[t.id]) || [];
          if(segs.length){
            const trClass = t.status === "paused" ? "tr-paused" : "tr-pending";
            rangeHtml = `<div class="time-range ${trClass}"><span class="tag">Inicio est.</span>${fmt(segs[0].start)}<span class="arrow">→</span><span class="tag">Fin est.</span>${fmt(segs[segs.length-1].end)}</div>`;
          } else {
            rangeHtml = `<div class="meta" style="color:var(--danger)">sin hueco antes del fin de jornada</div>`;
          }
        }
        return `
        <div class="summary-row">
          <div class="row-top"><span>${escapeHtml(t.title)}</span><span class="dur">${fmtDur(t.planned)}${(t.elapsedBefore||0)>0 ? ` (${fmtDur(t.elapsedBefore)} realizados)` : ''} · ${t.status === 'paused' ? 'en pausa' : t.status}</span></div>
          ${rangeHtml}
        </div>
      `; }).join("") : '<div class="empty">Todo completado.</div>';
    }

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
      const t = state.tasks.find(t => t.id === focusTaskId);
      if(!t || t.status === 'completed'){
        window.location.hash = '#/';
        return;
      }

      const now = nowMinutes();
      let elapsed = t.elapsedBefore || 0;
      if(t.status === 'running' && t.runningStart !== null){
        elapsed += Math.max(0, now - t.runningStart);
      }
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
              <div class="ring-main-time${overrun ? ' overrun-text' : ''}">${timeDisplay}</div>
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
              <span class="meta-value">${fmtDur(elapsed)}</span>
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

    function renderEnvSwitcher(){
      const state = getState();
      const activeEnv = state.activeEnv || 'work';
      const workBtn = document.getElementById("envBtnWork");
      const personalBtn = document.getElementById("envBtnPersonal");

      if(workBtn){
        workBtn.classList.toggle("active", activeEnv === "work");
      }
      if(personalBtn){
        personalBtn.classList.toggle("active", activeEnv === "personal");
      }
    }

    function syncFormInputsFromState(){
      const state = getState();
      const ws = document.getElementById("workStartInput");
      const we = document.getElementById("workEndInput");
      const ni = document.getElementById("notifyIntervalInput");
      if(ws) ws.value = fmt(state.workStart);
      if(we) we.value = fmt(state.workEnd);
      if(ni) ni.value = state.notifyIntervalMin;
      refreshPlanningModeBtn();
      renderEnvSwitcher();
    }

    function refreshPlanningModeBtn(){
      const btn = document.getElementById("planningModeBtn");
      if(!btn) return;
      const state = getState();
      btn.classList.toggle("active", state.planningMode);
      btn.textContent = state.planningMode ? "🗺 Planificación: ON" : "🗺 Modo planificación";
    }

    function renderAll(){
      renderClock();
      renderEnvSwitcher();
      renderHeaderStats();
      renderTaskProgressBar();
      const schedule = computeSchedule();
      renderMeetings();
      renderTasks(schedule);
      renderBoard(schedule);
      renderSummary(schedule);
    }

    function smartRender(){
      const currentView = getCurrentView();
      if(currentView === 'interruption'){
        renderInterruptionView();
      } else if(currentView === 'task'){
        renderTaskFocusView();
      } else {
        renderAll();
      }
    }

    return {
      renderClock, renderEnvSwitcher, renderHeaderStats, renderTaskProgressBar, renderMeetings, renderTasks,
      renderBoard, renderSummary, renderInterruptionView, renderTaskFocusView,
      syncFormInputsFromState, refreshPlanningModeBtn, renderAll, smartRender
    };
  };
})();
