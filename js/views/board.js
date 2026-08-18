/* views/board.js — Tablero visual (timeline) y resumen del día */
(function(){
  "use strict";

  window._TodayTasksBoardView = function(ctx){
    const { getState } = ctx;
    const { nowMinutes, fmt, fmtDur, fmtRemaining } = window.TodayTasksUtils;
    const { escapeHtml, escapeAttr } = window.TodayTasksUi;

    function renderBoard(schedule){
      const el = document.getElementById("boardContent");
      const state = getState();
      const now = schedule.now;
      const viewStart = schedule.viewStart;
      const workEnd = state.workEnd;
      const today = window.TodayTasksUtils.getTodayStr();
      const isToday = !state.selectedDate || state.selectedDate === today;

      const titleEl = document.getElementById("boardTitle");
      const badgeEl = document.getElementById("boardNow");
      if(titleEl){
        if(!isToday){
          titleEl.textContent = `Planificación para el ${window.TodayTasksUtils.formatDateFriendly(state.selectedDate)} (${state.selectedDate})`;
        } else {
          titleEl.textContent = state.planningMode
            ? "Plan completo · desde el inicio de jornada"
            : "Desde ahora hasta el fin de jornada";
        }
      }
      if(badgeEl){
        badgeEl.textContent = state.planningMode
          ? "inicio " + fmt(state.workStart)
          : (isToday ? "ahora " + fmt(now) : state.selectedDate);
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
      const workEndLimit = state.workEnd !== null && state.workEnd !== undefined ? state.workEnd : 24 * 60;
      const visible = events.filter(e => e.end >= viewStart && e.start < workEndLimit);
      visible.sort((a,b) => a.start - b.start || a.end - b.end);

      if(!state.planningMode && state.workEnd !== null && state.workEnd !== undefined && now >= state.workEnd){
        el.innerHTML = '<div class="board-empty">La jornada laboral ha terminado. Consulta el resumen abajo.</div>';
        return;
      }

      if(visible.length === 0){
        const emptyMsg = state.workEnd !== null && state.workEnd !== undefined
          ? 'No hay reuniones ni tareas programadas hasta el fin de jornada (' + fmt(state.workEnd) + ').'
          : 'No hay reuniones ni tareas programadas hoy (día libre).';
        el.innerHTML = '<div class="board-empty">' + escapeHtml(emptyMsg) + '</div>';
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
      if (state.workEnd !== null && state.workEnd !== undefined) {
        html += `<div class="slot" style="opacity:.6;border:1px dashed var(--board-line);background:none;">
            <span class="time-label">${fmt(state.workEnd)}</span>
            <span>fin de jornada</span>
          </div>`;
      }
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
      const pending = state.tasks.filter(t=>t.status!=="completed").sort((a,b)=>{
        if(a.status === "running") return -1;
        if(b.status === "running") return 1;
        return a.order - b.order;
      });

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
          <div class="row-top"><span>${escapeHtml(t.title)}</span><div style="text-align:right"><span class="dur task-duration-clickable" title="Clic para ajustar tiempo consumido" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)">${fmtDur(t.actualDuration)} reales</span> <span class="dur" style="opacity:0.75">(plan. ${fmtDur(t.planned)})</span></div></div>
          <div class="time-range tr-running"><span class="tag">Inicio</span>${fmt(realStart)}<span class="arrow">→</span><span class="tag">Fin</span>${fmt(t.completedAt)}</div>
          <div style="margin-top:6px;display:flex;gap:6px;">
            <button class="btn small secondary" onclick="app.uncompleteTask(${t.id})" title="Deshacer completado y volver a pendiente">↩ Reabrir</button>
            <button class="btn small secondary" onclick="app.openCopyTaskModal(${t.id})" title="Copiar esta tarea a otra fecha">📋 Copiar a...</button>
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
            <span class="tag">Inicio</span>${fmt(i.start)}
            <span class="arrow">→</span>
            <span class="tag">Fin</span>${fmt(i.end)}
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
        const elapsedReal = window.TodayTasksUtils.getTaskElapsed(t);
        const autoMoveTag = (!t.isRecurring && t.autoMoveToToday)
          ? ' <span class="tag tag-automove" title="Se trasladará a hoy si no se completa">⏩ Pasar a hoy</span>'
          : '';
        return `
        <div class="summary-row">
          <div class="row-top"><span>${escapeHtml(t.title)}${autoMoveTag}</span><span class="dur">${fmtDur(t.planned)} plan. · <span class="task-duration-clickable" title="Clic para ajustar tiempo consumido" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)">${elapsedReal > 0 ? fmtDur(elapsedReal) : '0m'} realizados</span> · ${t.status === 'paused' ? 'en pausa' : t.status}</span></div>
          ${rangeHtml}
          <div style="margin-top:6px">
            <button class="btn small secondary" onclick="app.openCopyTaskModal(${t.id})" title="Copiar esta tarea a otra fecha">📋 Copiar a...</button>
          </div>
        </div>
      `; }).join("") : '<div class="empty">Todo completado.</div>';
    }

    return { renderBoard, renderSummary };
  };
})();
