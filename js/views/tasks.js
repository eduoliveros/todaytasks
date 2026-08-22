/* views/tasks.js — Renderizado de la lista de tareas activas */
import { nowMinutes, fmt, fmtDur, fmtRemaining, getTaskElapsed } from '../utils.js';
import { escapeHtml, escapeAttr } from '../ui.js';

export function TodayTasksTasksView(ctx){
  const { getState, getTaskEdit } = ctx;

  function renderTasks(schedule){
    if (typeof document === "undefined") return;
    const el = document.getElementById("tasksList");
    if (!el) return;
    const state = getState();
    const taskEdit = getTaskEdit();
    const active = (state.tasks || []).filter(t => t.status !== "completed")
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
        const isRecurring = t.isRecurring || !!taskEdit.ruleId;
        return `
        <div class="item task-item editing">
          <div class="row">
            <input type="text" value="${escapeAttr(taskEdit.title)}" oninput="app.updateTaskEditField('title', this.value)" placeholder="Título de la tarea">
          </div>
          <div class="row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
            <label style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">Planificado (min):<br><input type="number" min="1" value="${escapeAttr(taskEdit.duration)}" style="width:110px;margin-top:4px;" oninput="app.updateTaskEditField('duration', this.value)"></label>
            <label style="font-size:0.82rem;color:var(--text-muted);font-weight:500;">Consumido (min):<br><input type="number" min="0" value="${escapeAttr(taskEdit.actual||0)}" style="width:110px;margin-top:4px;" oninput="app.updateTaskEditField('actual', this.value)"></label>
          </div>
          ${!isRecurring ? `
          <div style="margin-bottom:8px;">
            <label style="font-size:0.82rem;display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:var(--ink);">
              <input type="checkbox" ${taskEdit.autoMoveToToday ? 'checked' : ''} onchange="app.updateTaskEditField('autoMoveToToday', this.checked)"> Auto-mover si no se completa a hoy
            </label>
          </div>` : ''}
          <div class="task-actions">
            <button class="btn small done" onclick="app.saveEditTask(${t.id})">Guardar</button>
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
           ondragstart="app.taskDragStart(event, ${t.id})"
           ondragover="app.taskDragOver(event)"
           ondragleave="app.taskDragLeave(event)"
           ondrop="app.taskDrop(event, ${t.id})"
           ondragend="app.taskDragEnd(event)"`
        : '';
      const dragHandle = isDraggable
        ? `<span class="drag-handle" title="Arrastra para reordenar" onmousedown="app.armTaskDrag()">⠿</span>`
        : '';
      const recurringTag = t.isRecurring ? `<span class="tag" style="margin-left:4px;background:rgba(16,185,129,0.1);color:#059669;border-color:rgba(16,185,129,0.25);" title="Tarea recurrente diaria/semanal">🔁 Recurrente</span>` : '';
      const autoMoveTag = (!t.isRecurring && t.autoMoveToToday) ? `<span class="tag tag-automove" title="Se trasladará automáticamente a hoy si no se completa">⏩ Pasar a hoy</span>` : '';

      return `
        <div class="item task-item ${t.status}" ${dragAttrs}>
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
              <button class="icon-btn" title="Copiar a otro día" onclick="app.openCopyTaskModal(${t.id})">📋</button>
              <button class="icon-btn" title="Editar" onclick="app.startEditTask(${t.id})">✎</button>
              <button class="icon-btn" title="Eliminar" onclick="app.deleteTask(${t.id})">✕</button>
            </div>
          </div>
          <div class="task-actions">
            ${t.status==="pending" ? `
              <button class="btn small run" onclick="app.startTask(${t.id})">▶ Iniciar</button>
              <button class="btn small done" onclick="app.completeTask(${t.id})">✓ Completar</button>
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

  return { renderTasks };
}

export default TodayTasksTasksView;
