/* app/weekly-schedule.js — Horario semanal (modal y lógica de derivación) */
(function(){
  "use strict";

  window._TodayTasksWeeklySchedule = function(appCtx){
    // appCtx: { getState, saveState, viewsModule, fmt, timeToMinutes, showToast }
    const { getState, saveState, viewsModule, fmt, timeToMinutes, showToast } = appCtx;

    function derivePersonalFromWork() {
      const state = getState();
      const workSched = state.environments.work.weeklySchedule;
      const derived = {};
      for (let d = 1; d <= 7; d++) {
        const ws = workSched ? workSched[d] : { start: 9*60, end: 18*60 };
        if (ws === null) {
          derived[d] = { start: 9*60, end: 23*60, derived: true };
        } else if (ws === undefined) {
          derived[d] = { start: 18*60, end: 23*60, derived: true };
        } else {
          derived[d] = { start: ws.end, end: 23*60, derived: true };
        }
      }
      return derived;
    }

    function syncPersonalFromWork() {
      const state = getState();
      const personalEnv = state.environments.personal;
      if (!personalEnv.weeklySchedule) {
        personalEnv.weeklySchedule = derivePersonalFromWork();
        return;
      }
      for (let d = 1; d <= 7; d++) {
        const slot = personalEnv.weeklySchedule[d];
        if (slot && slot.derived) {
          const workSched = state.environments.work.weeklySchedule;
          const ws = workSched ? workSched[d] : { start: 9*60, end: 18*60 };
          if (ws === null) {
            personalEnv.weeklySchedule[d] = { start: 9*60, end: 23*60, derived: true };
          } else if (ws === undefined) {
            personalEnv.weeklySchedule[d] = { start: 18*60, end: 23*60, derived: true };
          } else {
            personalEnv.weeklySchedule[d] = { start: ws.end, end: 23*60, derived: true };
          }
        }
      }
    }

    function getOrDeriveWeeklySchedule(envKey) {
      const state = getState();
      const env = state.environments[envKey];
      if (env.weeklySchedule) return Object.assign({}, env.weeklySchedule);
      if (envKey === 'personal') return derivePersonalFromWork();
      return { 1:{start:9*60,end:18*60}, 2:{start:9*60,end:18*60}, 3:{start:9*60,end:18*60},
               4:{start:9*60,end:18*60}, 5:{start:9*60,end:18*60}, 6:null, 7:null };
    }

    function renderWeeklyScheduleRows(schedule) {
      const container = document.getElementById('weeklyScheduleRows');
      if (!container) return;
      const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      let html = '';
      for (let d = 1; d <= 7; d++) {
        const slot = schedule[d];
        const isFree = slot === null;
        const startVal = isFree ? '' : fmt(slot.start);
        const endVal   = isFree ? '' : fmt(slot.end);
        html += `
          <div class="weekly-schedule-row${isFree ? ' is-free-day' : ''}" data-dow="${d}">
            <span class="ws-day-name">${dayNames[d]}</span>
            <label class="ws-free-label">
              <input type="checkbox" class="ws-free-cb" data-dow="${d}"${isFree ? ' checked' : ''}>
              Libre
            </label>
            <div class="ws-times${isFree ? ' ws-times-hidden' : ''}">
              <input type="time" class="ws-start" data-dow="${d}" value="${startVal}" aria-label="Inicio ${dayNames[d]}">
              <span class="ws-sep">→</span>
              <input type="time" class="ws-end" data-dow="${d}" value="${endVal}" aria-label="Fin ${dayNames[d]}">
            </div>
          </div>`;
      }
      container.innerHTML = html;

      container.querySelectorAll('.ws-free-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          const row = cb.closest('.weekly-schedule-row');
          const times = row.querySelector('.ws-times');
          row.classList.toggle('is-free-day', cb.checked);
          times.classList.toggle('ws-times-hidden', cb.checked);
        });
      });
    }

    function readWeeklyScheduleFromModal(envKey) {
      const state = getState();
      const container = document.getElementById('weeklyScheduleRows');
      if (!container) return null;
      const oldSched = state.environments[envKey].weeklySchedule || {};
      const result = {};
      for (let d = 1; d <= 7; d++) {
        const cb = container.querySelector(`.ws-free-cb[data-dow="${d}"]`);
        if (cb && cb.checked) {
          result[d] = null;
        } else {
          const startEl = container.querySelector(`.ws-start[data-dow="${d}"]`);
          const endEl   = container.querySelector(`.ws-end[data-dow="${d}"]`);
          const startV  = timeToMinutes(startEl ? startEl.value : '');
          const endV    = timeToMinutes(endEl   ? endEl.value   : '');
          if (startV !== null && endV !== null) {
            const oldSlot = oldSched[d];
            const wasDerived = oldSlot && oldSlot.derived &&
              oldSlot.start === startV && oldSlot.end === endV;
            result[d] = { start: startV, end: endV, ...(wasDerived ? { derived: true } : {}) };
          } else {
            result[d] = { start: 9*60, end: 18*60 };
          }
        }
      }
      return result;
    }

    function openWeeklyScheduleModal() {
      const state = getState();
      const envKey = state.activeEnv;
      const envName = envKey === 'work' ? '💼 Trabajo' : '🏠 Personal';
      const titleEl = document.getElementById('weeklyScheduleTitle');
      if (titleEl) titleEl.textContent = '📅 Horario semanal — ' + envName;
      const schedule = getOrDeriveWeeklySchedule(envKey);
      renderWeeklyScheduleRows(schedule);
      const modal = document.getElementById('weeklyScheduleModal');
      if (modal) modal.style.display = 'flex';
    }

    function closeWeeklyScheduleModal() {
      const modal = document.getElementById('weeklyScheduleModal');
      if (modal) modal.style.display = 'none';
    }

    /* Wire buttons */
    const weeklyScheduleBtnEl = document.getElementById('weeklyScheduleBtn');
    if (weeklyScheduleBtnEl) weeklyScheduleBtnEl.addEventListener('click', openWeeklyScheduleModal);

    const closeWeeklyScheduleBtnEl = document.getElementById('closeWeeklyScheduleBtn');
    if (closeWeeklyScheduleBtnEl) closeWeeklyScheduleBtnEl.addEventListener('click', closeWeeklyScheduleModal);

    const cancelWeeklyScheduleBtnEl = document.getElementById('cancelWeeklyScheduleBtn');
    if (cancelWeeklyScheduleBtnEl) cancelWeeklyScheduleBtnEl.addEventListener('click', closeWeeklyScheduleModal);

    const saveWeeklyScheduleBtnEl = document.getElementById('saveWeeklyScheduleBtn');
    if (saveWeeklyScheduleBtnEl) {
      saveWeeklyScheduleBtnEl.addEventListener('click', () => {
        const state = getState();
        const envKey = state.activeEnv;
        const newSched = readWeeklyScheduleFromModal(envKey);
        if (!newSched) { closeWeeklyScheduleModal(); return; }
        state.environments[envKey].weeklySchedule = newSched;

        if (envKey === 'work') {
          syncPersonalFromWork();
        }

        const envObj = state.environments[envKey];
        if (envObj && envObj.days) {
          Object.keys(envObj.days).forEach(d => {
            if (!envObj.days[d].hasCustomHours) {
              delete envObj.days[d].workStart;
              delete envObj.days[d].workEnd;
            }
          });
        }

        saveState();
        if(viewsModule) {
          viewsModule.syncFormInputsFromState();
          viewsModule.renderAll();
        }
        closeWeeklyScheduleModal();
        showToast('📅 Horario semanal guardado');
      });
    }

    return { derivePersonalFromWork, syncPersonalFromWork, getOrDeriveWeeklySchedule, openWeeklyScheduleModal, closeWeeklyScheduleModal };
  };
})();
