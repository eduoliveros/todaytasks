/* views/meetings.js — Renderizado de la lista de reuniones */
import { fmt } from '../utils.js';
import { escapeHtml, escapeAttr } from '../ui.js';

export function TodayTasksMeetingsView(ctx){
  const { getState, getMeetingEdit } = ctx;

  function renderMeetings(){
    if (typeof document === "undefined") return;
    const el = document.getElementById("meetingsList");
    if (!el) return;
    const state = getState();
    const meetingEdit = getMeetingEdit();
    if((state.meetings || []).length === 0){
      el.innerHTML = '<div class="empty">Aún no hay reuniones.</div>';
      return;
    }
    el.innerHTML = state.meetings.map(m => {
      if(meetingEdit && meetingEdit.id === m.id){
        const modeLabel = meetingEdit.mode === "instance" ? " (Solo esta ocurrencia)" : (meetingEdit.mode === "series" ? " (Toda la serie)" : "");
        return `
      <div class="item editing" id="meeting-item-${escapeAttr(m.id)}">
        <div class="row" style="font-size:0.8rem;color:#4F46E5;font-weight:600;margin-bottom:4px;">
          Editando reunión${modeLabel}
        </div>
        <div class="row">
          <input type="text" value="${escapeAttr(meetingEdit.title)}" oninput="app.updateMeetingEditField('title', this.value)" placeholder="Título de la reunión">
        </div>
        <div class="row">
          <input type="time" value="${escapeAttr(meetingEdit.start)}" style="flex:1" oninput="app.updateMeetingEditField('start', this.value)">
          <input type="time" value="${escapeAttr(meetingEdit.end)}" style="flex:1" oninput="app.updateMeetingEditField('end', this.value)">
        </div>
        <div class="task-actions">
          <button class="btn small done" onclick="app.saveEditMeeting('${escapeAttr(m.id)}')">Guardar</button>
          <button class="btn small secondary" onclick="app.cancelEditMeeting()">Cancelar</button>
        </div>
      </div>`;
      }
      const recurringTag = m.isRecurring ? `<span class="tag" style="margin-left:4px;background:rgba(16,185,129,0.1);color:#059669;border-color:rgba(16,185,129,0.25);" title="Reunión recurrente${m.isModifiedInstance ? ' (Ocurrencia modificada)' : ' (Serie)'}">🔁 Recurrente${m.isModifiedInstance ? ' ✎' : ''}</span>` : '';
      return `
      <div class="item" id="meeting-item-${escapeAttr(m.id)}">
        <div class="top">
          <div>
            <div class="title">${escapeHtml(m.title)}</div>
            <div class="time-range tr-meeting">
              <span class="tag">Inicio</span>${fmt(m.start)}<span class="arrow">→</span><span class="tag">Fin</span>${fmt(m.end)}
              ${recurringTag}
              <span class="tag" style="margin-left:4px;background:rgba(79,70,229,0.08);color:#4F46E5;border-color:rgba(79,70,229,0.2);" title="Avisos: 2 min antes (${fmt(m.start-2)}) y a la hora (${fmt(m.start)})">🔔 2m y a la hora</span>
            </div>
            <div class="meta">colchón hasta ${fmt(m.end+10)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:2px;">
            <button class="icon-btn" title="Editar" onclick="app.startEditMeeting('${escapeAttr(m.id)}')">✎</button>
            <button class="icon-btn" title="Eliminar" onclick="app.deleteMeeting('${escapeAttr(m.id)}')">✕</button>
          </div>
        </div>
      </div>`;
    }).join("");
  }

  return { renderMeetings };
}

export default TodayTasksMeetingsView;

