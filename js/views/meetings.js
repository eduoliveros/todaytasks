/* views/meetings.js — Renderizado de la lista de reuniones */
import { fmt, nowMinutes, getTodayStr, formatRecurrenceRule } from '../utils.js';
import { escapeHtml, escapeAttr } from '../ui.js';
import { t } from '../i18n.js';

export function TodayTasksMeetingsView(ctx){
  const { getState, getMeetingEdit } = ctx;

  function renderMeetings(){
    if (typeof document === "undefined") return;
    const el = document.getElementById("meetingsList");
    if (!el) return;
    const state = getState();
    const meetingEdit = getMeetingEdit();
    if((state.meetings || []).length === 0){
      el.innerHTML = `<div class="empty">${t('meetings.empty')}</div>`;
      return;
    }
    const currentNow = typeof ctx.nowMinutes === "function" ? ctx.nowMinutes() : nowMinutes();
    const todayStr = typeof ctx.getTodayStr === "function" ? ctx.getTodayStr() : getTodayStr();
    const selectedDate = state.selectedDate || todayStr;
    const isPastDate = selectedDate < todayStr;
    const isFutureDate = selectedDate > todayStr;

    el.innerHTML = state.meetings.map(m => {
      const isPast = !isFutureDate && (isPastDate || (selectedDate === todayStr && m.end <= currentNow));
      const pastClass = isPast ? " past" : "";

      if(meetingEdit && String(meetingEdit.id) === String(m.id)){
        const modeLabel = meetingEdit.mode === "instance" ? t('meetings.editModeInstance') : (meetingEdit.mode === "series" ? t('meetings.editModeSeries') : "");
        return `
      <div class="item editing${pastClass}" id="meeting-item-${escapeAttr(m.id)}">
        <div class="row" style="font-size:0.8rem;color:#4F46E5;font-weight:600;margin-bottom:4px;">
          ${t('meetings.editingMeeting')}${modeLabel}
        </div>
        <div class="row">
          <input type="text" value="${escapeAttr(meetingEdit.title)}" oninput="app.updateMeetingEditField('title', this.value)" placeholder="${escapeAttr(t('meetings.inputTitlePlaceholder'))}">
        </div>
        <div class="row">
          <input type="time" value="${escapeAttr(meetingEdit.start)}" style="flex:1" oninput="app.updateMeetingEditField('start', this.value)">
          <input type="time" value="${escapeAttr(meetingEdit.end)}" style="flex:1" oninput="app.updateMeetingEditField('end', this.value)">
        </div>
        <div class="task-actions">
          <button class="btn small done" onclick="app.saveEditMeeting('${escapeAttr(m.id)}')">${t('action.save')}</button>
          <button class="btn small secondary" onclick="app.cancelEditMeeting()">${t('action.cancel')}</button>
        </div>
      </div>`;
      }
      let recurringTag = '';
      if (m.isRecurring) {
        let ruleTooltip = m.isModifiedInstance ? t('meetings.recurringTagModifiedTooltip') : t('meetings.recurringTagSeriesTooltip');
        if (m.ruleId) {
          const envKey = state.activeEnv || 'work';
          const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
          const rule = env && Array.isArray(env.recurringMeetings) ? env.recurringMeetings.find(r => String(r.id) === String(m.ruleId)) : null;
          if (rule) {
            const formatted = formatRecurrenceRule(rule);
            ruleTooltip = t('meetings.recurringRuleTooltip', {
              summary: formatted.summaryText,
              range: formatted.dateRangeText,
              mod: m.isModifiedInstance ? t('meetings.modifiedToday') : ''
            });
          }
        }
        recurringTag = `<button type="button" class="tag recurring-tag-btn" onclick="app.openRecurringInfoPopover('${escapeAttr(m.id)}', event, 'meeting')" title="${escapeAttr(ruleTooltip)}" aria-label="${escapeAttr(t('meetings.recurringTagAria'))}">${t('meetings.recurringTagLabel')}${m.isModifiedInstance ? ' ✎' : ''}</button>`;
      }
      return `
      <div class="item${pastClass}" id="meeting-item-${escapeAttr(m.id)}">
        <div class="top">
          <div>
            <div class="title">${escapeHtml(m.title)}</div>
            <div class="time-range tr-meeting">
              <span class="tag">${t('summary.tagStart')}</span>${fmt(m.start)}<span class="arrow">→</span><span class="tag">${t('summary.tagEnd')}</span>${fmt(m.end)}
              ${recurringTag}
              <span class="tag" style="margin-left:4px;background:rgba(79,70,229,0.08);color:#4F46E5;border-color:rgba(79,70,229,0.2);" title="${escapeAttr(t('meetings.alertsTooltip', { before: fmt(m.start-2), onTime: fmt(m.start) }))}">${t('meetings.alertsTag')}</span>
            </div>
            <div class="meta">${t('meetings.bufferUntil', { time: fmt(m.end+10) })}</div>
          </div>
          <div style="display:flex;align-items:center;gap:2px;">
            <button class="icon-btn" title="${escapeAttr(t('action.edit'))}" onclick="app.startEditMeeting('${escapeAttr(m.id)}')">✎</button>
            <button class="icon-btn" title="${escapeAttr(t('action.delete'))}" onclick="app.deleteMeeting('${escapeAttr(m.id)}')">✕</button>
          </div>
        </div>
      </div>`;
    }).join("");
  }

  return { renderMeetings };
}

export default TodayTasksMeetingsView;
