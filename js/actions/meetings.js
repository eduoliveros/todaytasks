/* actions/meetings.js — Acciones de reuniones (CRUD y recurrencia) */
import { getTodayStr } from '../utils.js';

export function TodayTasksMeetings(ctx, helpers) {
  const {
    getState, getMeetingEdit, setMeetingEdit,
    saveState, newId, renderAll
  } = ctx;
  const { fmt, timeToMinutes, showToast, showRecurringModal } = helpers;

  function normalizeMeetingId(id) {
    if (typeof id === 'string' && /^\d+$/.test(id)) {
      const n = parseInt(id, 10);
      return isNaN(n) ? id : n;
    }
    return id;
  }

  function deleteMeetingInstance(ruleId, dateStr) {
    const state = getState();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    const rule = (state.recurringMeetings || []).find(r => String(r.id) === String(ruleId));
    if (rule) {
      if (!rule.exceptions) rule.exceptions = {};
      rule.exceptions[dateStr] = { type: "cancelled" };
      const dayObj = env.days && env.days[dateStr];
      if (dayObj && Array.isArray(dayObj.meetings)) {
        if (!Array.isArray(dayObj._deletedIds)) dayObj._deletedIds = [];
        dayObj.meetings.forEach(m => {
          if (String(m.ruleId || m.id) === String(ruleId) && m.id != null && !dayObj._deletedIds.includes(String(m.id))) {
            dayObj._deletedIds.push(String(m.id));
          }
        });
        dayObj.meetings = dayObj.meetings.filter(m => String(m.ruleId || m.id) !== String(ruleId));
      }
      if (getMeetingEdit() && String(getMeetingEdit().id) === String(ruleId)) setMeetingEdit(null);
      saveState();
      renderAll();
      showToast(`Ocurrencia del ${dateStr} eliminada ✕`);
    }
  }

  function deleteMeetingSeries(ruleId) {
    const state = getState();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    if (Array.isArray(state.recurringMeetings)) {
      state.recurringMeetings = state.recurringMeetings.filter(r => String(r.id) !== String(ruleId));
    }
    if (!Array.isArray(env._deletedRecurringIds)) env._deletedRecurringIds = [];
    if (!env._deletedRecurringIds.includes(String(ruleId))) {
      env._deletedRecurringIds.push(String(ruleId));
    }
    Object.values(env.days || {}).forEach(dayObj => {
      if (Array.isArray(dayObj.meetings)) {
        if (!Array.isArray(dayObj._deletedIds)) dayObj._deletedIds = [];
        dayObj.meetings.forEach(m => {
          if (String(m.ruleId || m.id) === String(ruleId) && m.id != null && !dayObj._deletedIds.includes(String(m.id))) {
            dayObj._deletedIds.push(String(m.id));
          }
        });
        dayObj.meetings = dayObj.meetings.filter(m => String(m.ruleId || m.id) !== String(ruleId));
      }
    });
    if (getMeetingEdit() && String(getMeetingEdit().id) === String(ruleId)) setMeetingEdit(null);
    saveState();
    renderAll();
    showToast(`Serie recurrente eliminada ✕`);
  }

  function addMeeting(title, startStr, endStr, recurringData){
    const state = getState();
    const start = timeToMinutes(startStr);
    const end = timeToMinutes(endStr);
    if(!title || start === null || end === null || end <= start){
      alert("Revisa el título y que la hora de fin sea posterior a la de inicio.");
      return;
    }

    if (recurringData && recurringData.isRecurring) {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Añadir reunión recurrente "${title}"`);
      if (!Array.isArray(state.recurringMeetings)) {
        state.recurringMeetings = [];
      }
      state.recurringMeetings.push({
        id: "rec_" + newId(),
        title,
        start,
        end,
        freq: recurringData.freq || "weekly",
        interval: recurringData.interval || 1,
        daysOfWeek: recurringData.daysOfWeek || [1],
        startDate: state.selectedDate || getTodayStr(),
        endDate: recurringData.endDate || null,
        exceptions: {}
      });
      showToast(`Reunión recurrente "${title}" añadida 🔁`);
    } else {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Añadir reunión "${title}"`);
      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      const dateStr = state.selectedDate || getTodayStr();
      if (!env.days[dateStr]) {
        env.days[dateStr] = { meetings: [], tasks: [], interruptions: [], planningMode: false };
      }
      if (!Array.isArray(env.days[dateStr].meetings)) env.days[dateStr].meetings = [];
      env.days[dateStr].meetings.push({id:newId(), title, start, end});
      env.days[dateStr].meetings.sort((a,b)=>a.start-b.start);
    }

    saveState();
    renderAll();
  }

  function deleteMeeting(id){
    id = normalizeMeetingId(id);
    const state = getState();
    const dateStr = state.selectedDate || getTodayStr();
    const target = state.meetings.find(m => String(m.id) === String(id));

    if (target && target.isRecurring) {
      const ruleId = target.ruleId || id;
      showRecurringModal(
        `Eliminar "${target.title}" 🔁`,
        `¿Deseas eliminar solo la reunión del día ${dateStr} o eliminar toda la serie recurrente?`,
        () => {
          if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Eliminar ocurrencia de reunión "${target.title}"`);
          deleteMeetingInstance(ruleId, dateStr);
        },
        () => {
          if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Eliminar serie de reuniones "${target.title}"`);
          deleteMeetingSeries(ruleId);
        }
      );
      return;
    }

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Eliminar reunión "${target ? target.title : ''}"`);
    }

    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    const dayObj = env.days && env.days[dateStr];
    if (dayObj) {
      if (!Array.isArray(dayObj._deletedIds)) dayObj._deletedIds = [];
      if (!dayObj._deletedIds.includes(String(id))) {
        dayObj._deletedIds.push(String(id));
      }
      if (Array.isArray(dayObj.meetings)) {
        dayObj.meetings = dayObj.meetings.filter(m => String(m.id) !== String(id));
      }
    }
    if (getMeetingEdit() && String(getMeetingEdit().id) === String(id)) setMeetingEdit(null);
    saveState();
    renderAll();
    if (showToast) {
      showToast(`Reunión "${target ? target.title : ''}" eliminada.`, {
        label: "Deshacer",
        onClick: () => { if (ctx.undoModule && ctx.undoModule.undo) ctx.undoModule.undo(); }
      });
    }
  }

  function startEditMeeting(id){
    id = normalizeMeetingId(id);
    const state = getState();
    const dateStr = state.selectedDate || getTodayStr();
    const m = state.meetings.find(m => String(m.id) === String(id));
    if(!m) return;

    if (m.isRecurring) {
      const ruleId = m.ruleId || id;
      showRecurringModal(
        `Editar "${m.title}" 🔁`,
        `¿Deseas editar solo la reunión del día ${dateStr} o editar las propiedades de toda la serie recurrente?`,
        () => {
          setMeetingEdit({
            id: m.id,
            ruleId,
            mode: "instance",
            dateStr,
            title: m.title,
            start: fmt(m.start),
            end: fmt(m.end)
          });
          renderAll();
        },
        () => {
          const rule = m.rule || (state.recurringMeetings || []).find(r => String(r.id) === String(ruleId));
          setMeetingEdit({
            id: m.id,
            ruleId,
            mode: "series",
            dateStr,
            title: rule ? rule.title : m.title,
            start: rule ? fmt(rule.start) : fmt(m.start),
            end: rule ? fmt(rule.end) : fmt(m.end)
          });
          renderAll();
        }
      );
      return;
    }

    setMeetingEdit({id: m.id, mode: "single", title:m.title, start:fmt(m.start), end:fmt(m.end)});
    renderAll();
  }

  function updateMeetingEditField(field, value){
    const meetingEdit = getMeetingEdit();
    if(meetingEdit) meetingEdit[field] = value;
  }

  function cancelEditMeeting(){
    setMeetingEdit(null);
    renderAll();
  }

  function saveEditMeeting(id){
    id = normalizeMeetingId(id);
    const meetingEdit = getMeetingEdit();
    if(!meetingEdit || String(meetingEdit.id) !== String(id)) return;
    const state = getState();
    const title = (meetingEdit.title||"").trim();
    const start = timeToMinutes(meetingEdit.start);
    const end = timeToMinutes(meetingEdit.end);
    if(!title || start === null || end === null || end <= start){
      alert("Revisa el título y que la hora de fin sea posterior a la de inicio.");
      return;
    }

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Editar reunión "${title}"`);
    }

    if (meetingEdit.mode === "instance") {
      const rule = (state.recurringMeetings || []).find(r => String(r.id) === String(meetingEdit.ruleId));
      if (rule) {
        if (!rule.exceptions) rule.exceptions = {};
        rule.exceptions[meetingEdit.dateStr] = { type: "modified", title, start, end };
      }
    } else if (meetingEdit.mode === "series") {
      const rule = (state.recurringMeetings || []).find(r => String(r.id) === String(meetingEdit.ruleId));
      if (rule) {
        rule.title = title;
        rule.start = start;
        rule.end = end;
      }
    } else {
      const dateStr = state.selectedDate || getTodayStr();
      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      const dayObj = env.days && env.days[dateStr];
      if (dayObj && Array.isArray(dayObj.meetings)) {
        const m = dayObj.meetings.find(m => String(m.id) === String(id));
        if (m) {
          m.title = title;
          m.start = start;
          m.end = end;
          dayObj.meetings.sort((a,b)=>a.start-b.start);
        }
      }
    }

    setMeetingEdit(null);
    saveState();
    renderAll();
  }

  return {
    addMeeting, deleteMeeting, startEditMeeting,
    updateMeetingEditField, cancelEditMeeting, saveEditMeeting
  };
}

export default TodayTasksMeetings;

