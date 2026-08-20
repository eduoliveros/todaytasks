/* app/weekly-schedule.js — Horario semanal (modal y lógica de derivación) */
export function TodayTasksWeeklySchedule(appCtx){
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
    if (typeof document === "undefined") return;
    const container = document.getElementById('weeklyScheduleRows');
    if (!container) return;
    const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    let html = '';
    for (let d = 1; d <= 7; d++) {
      const slot = schedule[d];
      const isFree = slot === null;
      const startVal = (!isFree && slot) ? fmt(slot.start) : '09:00';
      const endVal = (!isFree && slot) ? fmt(slot.end) : '18:00';
      html += `
        <div class="weekly-schedule-row${isFree ? ' is-free' : ''}" data-day="${d}">
          <span class="weekly-day-name">${DAY_NAMES[d]}</span>
          <div class="weekly-time-inputs">
            <input type="time" class="weekly-time-input weekly-start" value="${startVal}" ${isFree ? 'disabled' : ''}>
            <span class="weekly-time-sep">→</span>
            <input type="time" class="weekly-time-input weekly-end" value="${endVal}" ${isFree ? 'disabled' : ''}>
          </div>
          <label class="weekly-free-label">
            <input type="checkbox" class="weekly-free-check" ${isFree ? 'checked' : ''}>
            Día libre
          </label>
        </div>
      `;
    }
    container.innerHTML = html;
    container.querySelectorAll('.weekly-free-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const row = e.target.closest('.weekly-schedule-row');
        const isChecked = e.target.checked;
        row.classList.toggle('is-free', isChecked);
        row.querySelectorAll('.weekly-time-input').forEach(inp => { inp.disabled = isChecked; });
      });
    });
  }

  function readWeeklyScheduleFromModal(envKey) {
    if (typeof document === "undefined") return null;
    const container = document.getElementById('weeklyScheduleRows');
    if (!container) return null;
    const result = {};
    const rows = container.querySelectorAll('.weekly-schedule-row');
    for (const row of rows) {
      const d = parseInt(row.getAttribute('data-day'), 10);
      const isFree = row.querySelector('.weekly-free-check').checked;
      if (isFree) {
        result[d] = null;
      } else {
        const sVal = row.querySelector('.weekly-start').value;
        const eVal = row.querySelector('.weekly-end').value;
        const startMin = timeToMinutes(sVal);
        const endMin = timeToMinutes(eVal);
        if (startMin === null || endMin === null || startMin >= endMin) {
          const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
          showToast(`⚠️ Horario inválido para el ${DAY_NAMES[d]}: la hora de inicio debe ser anterior a la de fin.`);
          return null;
        }
        result[d] = { start: startMin, end: endMin };
      }
    }
    return result;
  }

  function openWeeklyScheduleModal() {
    if (typeof document === "undefined") return;
    const state = getState();
    const envKey = state.activeEnv;
    const modal = document.getElementById('weeklyScheduleModal');
    if (!modal) return;
    const titleEl = document.getElementById('weeklyScheduleModalTitle');
    const badgeEl = document.getElementById('weeklyScheduleEnvBadge');
    if (titleEl) titleEl.textContent = 'Horario semanal';
    if (badgeEl) {
      badgeEl.textContent = envKey === 'work' ? '💼 Trabajo' : '🏠 Personal';
      badgeEl.className = 'weekly-env-badge ' + envKey;
    }
    const schedule = getOrDeriveWeeklySchedule(envKey);
    renderWeeklyScheduleRows(schedule);
    modal.style.display = 'flex';
  }

  function closeWeeklyScheduleModal() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById('weeklyScheduleModal');
    if (modal) modal.style.display = 'none';
  }

  if (typeof document !== "undefined") {
    const openWeeklyScheduleBtnEl = document.getElementById('openWeeklyScheduleBtn');
    if (openWeeklyScheduleBtnEl) {
      openWeeklyScheduleBtnEl.addEventListener('click', openWeeklyScheduleModal);
    }

    const closeWeeklyScheduleBtnEl = document.getElementById('closeWeeklyScheduleBtn');
    if (closeWeeklyScheduleBtnEl) {
      closeWeeklyScheduleBtnEl.addEventListener('click', closeWeeklyScheduleModal);
    }

    const weeklyScheduleModalEl = document.getElementById('weeklyScheduleModal');
    if (weeklyScheduleModalEl) {
      weeklyScheduleModalEl.addEventListener('click', (e) => {
        if (e.target === weeklyScheduleModalEl) closeWeeklyScheduleModal();
      });
    }

    const saveWeeklyScheduleBtnEl = document.getElementById('saveWeeklyScheduleBtn');
    if (saveWeeklyScheduleBtnEl) {
      saveWeeklyScheduleBtnEl.addEventListener('click', () => {
        const state = getState();
        const envKey = state.activeEnv;
        const newSched = readWeeklyScheduleFromModal(envKey);
        if (!newSched) return;
        state.environments[envKey].weeklySchedule = newSched;
        if (envKey === 'work') syncPersonalFromWork();
        saveState();
        if(viewsModule) {
          viewsModule.syncFormInputsFromState();
          viewsModule.renderAll();
        }
        closeWeeklyScheduleModal();
        showToast('📅 Horario semanal guardado');
      });
    }
  }

  return { derivePersonalFromWork, syncPersonalFromWork, getOrDeriveWeeklySchedule, openWeeklyScheduleModal, closeWeeklyScheduleModal };
}

if (typeof window !== "undefined") {
  window._TodayTasksWeeklySchedule = TodayTasksWeeklySchedule;
  window.TodayTasksWeeklySchedule = TodayTasksWeeklySchedule;
}

export default TodayTasksWeeklySchedule;
