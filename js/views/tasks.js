/* views/tasks.js — Renderizado de la lista de tareas activas */
import { nowMinutes, fmt, fmtDur, fmtRemaining, getTaskElapsed, getTodayStr, matchesSearchQuery } from '../utils.js';
import { escapeHtml, escapeAttr } from '../ui.js';

export function TodayTasksTasksView(ctx){
  const { getState, getTaskEdit } = ctx;

  function renderTaskItem(t, schedule, taskEdit){
    if(taskEdit && String(taskEdit.id) === String(t.id)){
      const isRecurring = t.isRecurring || !!taskEdit.ruleId;
      return `
      <div class="item task-item editing" id="task-item-${escapeAttr(t.id)}">
        <div class="row">
          <input type="text" value="${escapeAttr(taskEdit.title)}" oninput="app.updateTaskEditField('title', this.value)" placeholder="Título de la tarea">
        </div>
        <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
          <label style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">Planificado:<br><input type="text" value="${escapeAttr(taskEdit.duration)}" placeholder="ej. 30, 1h 30m" style="width:110px;margin-top:4px;" oninput="app.updateTaskEditField('duration', this.value)"></label>
          <label style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">Consumido:<br><input type="text" value="${escapeAttr(taskEdit.actual||0)}" placeholder="ej. 15, 1h" style="width:110px;margin-top:4px;" oninput="app.updateTaskEditField('actual', this.value)"></label>
        </div>
        ${!isRecurring ? `
        <div style="margin-bottom:8px;">
          <label style="font-size:0.82rem;display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:var(--ink);">
            <input type="checkbox" ${taskEdit.autoMoveToToday ? 'checked' : ''} onchange="app.updateTaskEditField('autoMoveToToday', this.checked)"> Auto-mover si no se completa a hoy
          </label>
        </div>` : ''}
        <div class="task-actions">
          <button class="btn small done" onclick="app.saveEditTask('${escapeAttr(t.id)}')">Guardar</button>
          <button class="btn small secondary" onclick="app.cancelEditTask()">Cancelar</button>
        </div>
      </div>`;
    }
    const elapsedReal = getTaskElapsed(t);
    const segs = (schedule && schedule.segmentsByTask && schedule.segmentsByTask[t.id]) ? schedule.segmentsByTask[t.id] : [];
    const isOverflow = (schedule && schedule.overflowIds) ? schedule.overflowIds.has(t.id) : false;
    const label = t.status === "running" ? "en ejecución"
                : t.status === "paused" ? "en pausa"
                : "pendiente";
    const badgeClass = t.status;

    let startTag, startVal, endTag, endVal, trClass, splitNote = "", remainingChip = "";
    if(t.status === "running"){
      const plannedEnd = t.runningStart + (t.planned - (t.elapsedBefore||0));
      startTag = "Inicio real"; startVal = fmt(t.runningStart);
      endTag = "Fin prev."; endVal = fmt(plannedEnd);
      trClass = "tr-running";
      const rem = fmtRemaining(plannedEnd, nowMinutes());
      remainingChip = `<span class="remaining-chip ${rem.overrun ? 'overrun' : ''}">${escapeHtml(rem.text)}</span>`;
    } else if(segs.length > 0){
      startTag = "Inicio prev."; startVal = fmt(segs[0].start);
      endTag = "Fin prev."; endVal = fmt(segs[segs.length-1].end);
      trClass = "tr-pending";
      if(segs.length > 1){
        const parts = segs.map(s => `${fmt(s.start)}-${fmt(s.end)}`).join(", ");
        splitNote = `<div class="meta" style="color:#B45309">Dividida por reuniones: ${parts}</div>`;
      }
    } else {
      startTag = "Inicio prev."; startVal = "—";
      endTag = "Fin prev."; endVal = "—";
      trClass = "tr-pending";
    }

    const isDraggable = (t.status === "pending" || t.status === "paused");
    const dragAttrs = isDraggable
      ? `draggable="true"
         ondragstart="app.taskDragStart(event, '${escapeAttr(t.id)}')"
         ondragover="app.taskDragOver(event)"
         ondragleave="app.taskDragLeave(event)"
         ondrop="app.taskDrop(event, '${escapeAttr(t.id)}')"
         ondragend="app.taskDragEnd(event)"`
      : '';
    const dragHandle = isDraggable
      ? `<span class="drag-handle" title="Arrastra para reordenar" onmousedown="app.armTaskDrag()">⠿</span>`
      : '';
    const recurringTag = t.isRecurring ? `<span class="tag" style="margin-left:4px;background:rgba(16,185,129,0.1);color:#059669;border-color:rgba(16,185,129,0.25);" title="Tarea recurrente diaria/semanal">🔁 Recurrente</span>` : '';
    const autoMoveTag = (!t.isRecurring && t.autoMoveToToday) ? `<span class="tag tag-automove" title="Se trasladará automáticamente a hoy si no se completa">⏩ Pasar a hoy</span>` : '';

    return `
      <div class="item task-item ${t.status}" id="task-item-${escapeAttr(t.id)}" data-task-id="${escapeAttr(t.id)}" ${dragAttrs}>
        <div class="top">
          <div style="display:flex;align-items:flex-start;gap:6px;flex:1;min-width:0;">
            ${dragHandle}
            <div style="flex:1;min-width:0;">
              <div class="title">${escapeHtml(t.title)}</div>
              <div class="time-range ${trClass}">
                <span class="tag">${startTag}</span>${startVal}<span class="arrow">→</span><span class="tag">${endTag}</span>${endVal}
                ${remainingChip}
                ${recurringTag}
                ${autoMoveTag}
              </div>
              <div class="meta">
                Planificado: ${fmtDur(t.planned)} · Consumido: <span class="task-duration-clickable" title="Clic para ajustar tiempo consumido" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)">${fmtDur(elapsedReal)}</span>
                <span class="status-badge ${badgeClass}">${label}</span>
                ${isOverflow ? '<span class="overflow-badge">⚠ No cabe en la jornada</span>' : ''}
              </div>
              ${splitNote}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:2px;">
            ${!t.isRecurring && t.autoMoveToToday ? `
              <button class="icon-btn" title="Mover a otro día" onclick="app.openCopyTaskModal('${escapeAttr(t.id)}')">➡️</button>
            ` : `
              <button class="icon-btn" title="Copiar a otro día" onclick="app.openCopyTaskModal('${escapeAttr(t.id)}')">📋</button>
            `}
            <button class="icon-btn" title="Editar" onclick="app.startEditTask('${escapeAttr(t.id)}')">✎</button>
            <button class="icon-btn" title="Eliminar" onclick="app.deleteTask('${escapeAttr(t.id)}')">✕</button>
          </div>
        </div>
        <div class="task-actions">
          ${t.status==="pending" ? `
            <button class="btn small run" onclick="app.startTask('${escapeAttr(t.id)}')">▶ Iniciar</button>
            <button class="btn small done" onclick="app.completeTask('${escapeAttr(t.id)}')">✓ Completar</button>
            <div class="order-controls">
              <button class="icon-btn" title="Subir" data-action="move-up" data-task-id="${escapeAttr(t.id)}" onclick="app.moveTask('${escapeAttr(t.id)}',-1,event)">▲</button>
              <button class="icon-btn" title="Bajar" data-action="move-down" data-task-id="${escapeAttr(t.id)}" onclick="app.moveTask('${escapeAttr(t.id)}',1,event)">▼</button>
            </div>
          ` : ""}
          ${t.status==="running" ? `
            <a href="#/task/${escapeAttr(t.id)}" class="btn small secondary focus-link" title="Abrir vista de foco (Tecla 'F')">◎ Foco [F]</a>
            <button class="btn small pause" onclick="app.pauseTask('${escapeAttr(t.id)}')">⏸ Pausar</button>
            <button class="btn small done" onclick="app.completeTask('${escapeAttr(t.id)}')">✓ Completar</button>
          ` : ""}
          ${t.status==="paused" ? `
            <button class="btn small run" onclick="app.resumeTask('${escapeAttr(t.id)}')">▶ Reanudar</button>
            <button class="btn small done" onclick="app.completeTask('${escapeAttr(t.id)}')">✓ Completar</button>
            <div class="order-controls">
              <button class="icon-btn" title="Subir" data-action="move-up" data-task-id="${escapeAttr(t.id)}" onclick="app.moveTask('${escapeAttr(t.id)}',-1,event)">▲</button>
              <button class="icon-btn" title="Bajar" data-action="move-down" data-task-id="${escapeAttr(t.id)}" onclick="app.moveTask('${escapeAttr(t.id)}',1,event)">▼</button>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  function renderCompletedSearchItem(t){
    const realStart = (t.completedAt !== null && t.completedAt !== undefined && t.actualDuration !== null) ? (t.completedAt - t.actualDuration) : null;
    const recurringTag = t.isRecurring ? `<span class="tag" style="margin-left:4px;background:rgba(16,185,129,0.1);color:#059669;border-color:rgba(16,185,129,0.25);" title="Tarea recurrente diaria/semanal">🔁 Recurrente</span>` : '';
    return `
      <div class="item task-item completed-search-item" id="task-item-${escapeAttr(t.id)}" data-task-id="${escapeAttr(t.id)}">
        <div class="top">
          <div style="flex:1;min-width:0;">
            <div class="title completed-title">${escapeHtml(t.title)}</div>
            <div class="time-range tr-meeting">
              <span class="tag">Completada</span>
              ${t.completedAt !== null && t.completedAt !== undefined ? fmt(t.completedAt) : ''}
              ${realStart !== null ? `<span class="arrow">·</span> <span class="tag">Duración real</span> ${fmtDur(t.actualDuration)}` : ''}
              ${recurringTag}
            </div>
            <div class="meta">
              Planificado: ${fmtDur(t.planned)} · Real: <span class="task-duration-clickable" title="Clic para ajustar tiempo consumido" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)">${fmtDur(t.actualDuration ?? t.planned)}</span>
              <span class="status-badge completed">✓ completada</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:2px;">
            <button class="icon-btn" title="Copiar a otro día" onclick="app.openCopyTaskModal('${escapeAttr(t.id)}')">📋</button>
            <button class="icon-btn" title="Eliminar" onclick="app.deleteTask('${escapeAttr(t.id)}')">✕</button>
          </div>
        </div>
        <div class="task-actions" style="margin-top:6px;display:flex;gap:6px;">
          <button class="btn small secondary" onclick="app.uncompleteTask('${escapeAttr(t.id)}')" title="Deshacer completado y volver a pendiente">↩ Reabrir</button>
          <button class="btn small secondary" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)" title="Ajustar tiempo consumido">⏱ Ajustar tiempo</button>
        </div>
      </div>
    `;
  }

  function renderTasks(schedule){
    if (typeof document === "undefined") return;
    const el = document.getElementById("tasksList");
    if (!el) return;
    const state = getState();
    const today = getTodayStr();
    const isFuture = !!(state.selectedDate && state.selectedDate > today);
    const bannerEl = document.getElementById("tasksAutoMoveBanner");

    if (bannerEl) {
      if (isFuture) {
        let pendingCount = 0;
        if (ctx.countPendingAutoMoveTasks) {
          pendingCount = ctx.countPendingAutoMoveTasks(state.selectedDate);
        } else {
          const envKey = state.activeEnv || "work";
          const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
          if (env && env.days) {
            const pastDates = Object.keys(env.days).filter(d => d < state.selectedDate);
            pastDates.forEach(d => {
              const dayObj = env.days[d];
              if (dayObj && Array.isArray(dayObj.tasks)) {
                dayObj.tasks.forEach(t => {
                  if (t.status !== "completed" && t.autoMoveToToday) pendingCount++;
                });
              }
            });
          }
        }

        if (pendingCount > 0) {
          const countText = pendingCount === 1 ? '1 tarea automática' : `${pendingCount} tareas automáticas`;
          bannerEl.innerHTML = `
            <div class="automove-banner">
              <span class="automove-banner-text">Hay <strong>${countText}</strong> de días anteriores.</span>
              <button class="btn-bring" onclick="app.rolloverPendingTasksToSelectedDate()" title="Mover las tareas automáticas pendientes a este día">⏩ Traer a este día</button>
            </div>`;
          bannerEl.style.display = "block";
        } else {
          bannerEl.innerHTML = "";
          bannerEl.style.display = "none";
        }
      } else {
        bannerEl.innerHTML = "";
        bannerEl.style.display = "none";
      }
    }

    const taskEdit = getTaskEdit();
    const searchQuery = (ctx.getTaskSearchQuery ? ctx.getTaskSearchQuery() : "").trim();

    const active = (state.tasks || []).filter(t => t.status !== "completed")
                               .sort((a,b)=>{
                                 if(a.status==="running") return -1;
                                 if(b.status==="running") return 1;
                                 return a.order-b.order;
                               });

    if(!searchQuery){
      if(active.length === 0){
        el.innerHTML = '<div class="empty">Aún no hay tareas.</div>';
        return;
      }
      el.innerHTML = active.map(t => renderTaskItem(t, schedule, taskEdit)).join("");
      return;
    }

    // Búsqueda inteligente activa
    const matchingActive = active.filter(t => matchesSearchQuery(t.title, searchQuery));
    const matchingCompleted = (state.tasks || [])
      .filter(t => t.status === "completed" && matchesSearchQuery(t.title, searchQuery))
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    if(matchingActive.length === 0 && matchingCompleted.length === 0){
      el.innerHTML = `
        <div class="search-results-info">
          <span>Búsqueda: <strong>"${escapeHtml(searchQuery)}"</strong></span>
          <button class="search-clear-link" onclick="app.clearTaskSearch()">✕ Limpiar filtro</button>
        </div>
        <div class="empty">No se encontraron tareas que coincidan con "${escapeHtml(searchQuery)}".</div>
      `;
      return;
    }

    let html = `
      <div class="search-results-info">
        <span>Resultados para <strong>"${escapeHtml(searchQuery)}"</strong> (${matchingActive.length} activas, ${matchingCompleted.length} completadas)</span>
        <button class="search-clear-link" onclick="app.clearTaskSearch()">✕ Limpiar filtro</button>
      </div>
    `;

    // Sección de tareas activas
    html += `
      <div class="search-section-heading active-heading">
        <span>⚡ Tareas activas (${matchingActive.length})</span>
      </div>
    `;
    if(matchingActive.length > 0){
      html += matchingActive.map(t => renderTaskItem(t, schedule, taskEdit)).join("");
    } else {
      html += `<div class="empty empty-subtle">Sin tareas activas que coincidan.</div>`;
    }

    // Sección de tareas completadas
    html += `
      <div class="search-section-heading completed-heading">
        <span>✓ Tareas completadas (${matchingCompleted.length})</span>
      </div>
    `;
    if(matchingCompleted.length > 0){
      html += matchingCompleted.map(t => renderCompletedSearchItem(t)).join("");
    } else {
      html += `<div class="empty empty-subtle">Sin tareas completadas que coincidan.</div>`;
    }

    el.innerHTML = html;
  }

  return { renderTasks, renderTaskItem, renderCompletedSearchItem };
}

export default TodayTasksTasksView;
