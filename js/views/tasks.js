/* views/tasks.js — Renderizado de la lista de tareas activas */
(function(){
  "use strict";

  window._TodayTasksTasksView = function(ctx){
    const { getState, getTaskEdit } = ctx;
    const { nowMinutes, fmt, fmtDur, fmtRemaining } = window.TodayTasksUtils;
    const { escapeHtml, escapeAttr } = window.TodayTasksUi;

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
        const elapsedReal = window.TodayTasksUtils.getTaskElapsed(t);
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

        const autoMoveTag = (!t.isRecurring && t.autoMoveToToday)
          ? ' <span class="tag tag-automove" title="Se trasladará automáticamente a hoy si no se completa">⏩ Pasar a hoy</span>'
          : '';

        return `
          <div class="item task-item state-${t.status}" ${draggableAttrs}>
            <div class="top">
              <div style="display:flex;gap:8px;">
                ${t.status!=="running" ? `<span class="drag-handle" title="Arrastrar para reordenar" onmousedown="app.armTaskDrag()">⠿</span>` : ""}
                <div>
                  <div class="title">${escapeHtml(t.title)}${t.isRecurring ? ' <span class="tag tag-recurring" title="Tarea recurrente">🔁</span>' : ''}${autoMoveTag}</div>
                  <div class="meta">${fmtDur(t.planned)} planificados · <span class="task-duration-clickable" title="Clic para ajustar tiempo consumido" onclick="app.openTimePopover('${escapeAttr(t.id)}', event)">${elapsedReal > 0 ? fmtDur(elapsedReal) : '0m'} realizados</span></div>
                  ${startTag ? `<div class="time-range ${trClass}"><span class="tag">${startTag}</span>${startVal}<span class="arrow">→</span><span class="tag">${endTag}</span>${endVal}${remainingChip ? " "+remainingChip : ""}</div>` : '<div class="meta" style="color:var(--danger)">sin hueco antes del fin de jornada</div>'}
                  ${splitNote}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="badge ${badgeClass}">${label}</span>
                <button class="icon-btn" title="Copiar a otra fecha" onclick="app.openCopyTaskModal(${t.id})">📋</button>
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

    return { renderTasks };
  };
})();
