/* actions/meetings.js — Acciones de reuniones (CRUD y recurrencia) */
(function(){
  "use strict";

  window._TodayTasksMeetings = function(ctx, helpers){
    const {
      getState, getMeetingEdit, setMeetingEdit,
      saveState, newId, renderAll
    } = ctx;
    const { fmt, timeToMinutes, showToast, showRecurringModal } = helpers;

    function normalizeMeetingId(id) {
      if (typeof id === 'string' && !id.startsWith('rec_')) {
        const n = parseInt(id, 10);
        return isNaN(n) ? id : n;
      }
      return id;
    }

    function deleteMeetingInstance(ruleId, dateStr) {
      const state = getState();
      const rule = (state.recurringMeetings || []).find(r => r.id === ruleId);
      if (rule) {
        if (!rule.exceptions) rule.exceptions = {};
        rule.exceptions[dateStr] = { type: "cancelled" };
        if (getMeetingEdit() && getMeetingEdit().id === ruleId) setMeetingEdit(null);
        saveState();
        renderAll();
        showToast(`Ocurrencia del ${dateStr} eliminada ✕`);
      }
    }

    function deleteMeetingSeries(ruleId) {
      const state = getState();
      if (Array.isArray(state.recurringMeetings)) {
        state.recurringMeetings = state.recurringMeetings.filter(r => r.id !== ruleId);
      }
      if (getMeetingEdit() && getMeetingEdit().id === ruleId) setMeetingEdit(null);
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
          startDate: state.selectedDate || window.TodayTasksUtils.getTodayStr(),
          endDate: recurringData.endDate || null,
          exceptions: {}
        });
        showToast(`Reunión recurrente "${title}" añadida 🔁`);
      } else {
        const envKey = state.activeEnv || "work";
        const env = state.environments[envKey] || state.environments.work;
        const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
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
      const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
      const target = state.meetings.find(m => m.id === id);

      if (target && target.isRecurring) {
        const ruleId = target.ruleId || id;
        showRecurringModal(
          `Eliminar "${target.title}" 🔁`,
          `¿Deseas eliminar solo la reunión del día ${dateStr} o eliminar toda la serie recurrente?`,
          () => deleteMeetingInstance(ruleId, dateStr),
          () => deleteMeetingSeries(ruleId)
        );
        return;
      }

      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      const dayObj = env.days && env.days[dateStr];
      if (dayObj && Array.isArray(dayObj.meetings)) {
        dayObj.meetings = dayObj.meetings.filter(m => m.id !== id);
      }
      if (getMeetingEdit() && getMeetingEdit().id === id) setMeetingEdit(null);
      saveState();
      renderAll();
    }

    function startEditMeeting(id){
      id = normalizeMeetingId(id);
      const state = getState();
      const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
      const m = state.meetings.find(m=>m.id===id);
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
            const rule = m.rule || (state.recurringMeetings || []).find(r => r.id === ruleId);
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

      setMeetingEdit({id, mode: "single", title:m.title, start:fmt(m.start), end:fmt(m.end)});
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
      if(!meetingEdit || meetingEdit.id !== id) return;
      const state = getState();
      const title = (meetingEdit.title||"").trim();
      const start = timeToMinutes(meetingEdit.start);
      const end = timeToMinutes(meetingEdit.end);
      if(!title || start === null || end === null || end <= start){
        alert("Revisa el título y que la hora de fin sea posterior a la de inicio.");
        return;
      }

      if (meetingEdit.mode === "instance") {
        const rule = (state.recurringMeetings || []).find(r => r.id === meetingEdit.ruleId);
        if (rule) {
          if (!rule.exceptions) rule.exceptions = {};
          rule.exceptions[meetingEdit.dateStr] = { type: "modified", title, start, end };
        }
      } else if (meetingEdit.mode === "series") {
        const rule = (state.recurringMeetings || []).find(r => r.id === meetingEdit.ruleId);
        if (rule) {
          rule.title = title;
          rule.start = start;
          rule.end = end;
        }
      } else {
        const dateStr = state.selectedDate || window.TodayTasksUtils.getTodayStr();
        const envKey = state.activeEnv || "work";
        const env = state.environments[envKey] || state.environments.work;
        const dayObj = env.days && env.days[dateStr];
        if (dayObj && Array.isArray(dayObj.meetings)) {
          const m = dayObj.meetings.find(m => m.id === id);
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
  };
})();
