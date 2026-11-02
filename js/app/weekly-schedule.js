/* app/weekly-schedule.js — Horario semanal (modal, lógica de derivación y presets móviles) */
import { t } from '../i18n.js';

export function TodayTasksWeeklySchedule(appCtx){
  // appCtx: { getState, saveState, viewsModule, fmt, timeToMinutes, showToast }
  const { getState, saveState, viewsModule, fmt, timeToMinutes, showToast } = appCtx;

  function getDayName(d) {
    const dayNames = t.days();
    // En t.days(), índice 0 es Domingo y 1..6 es Lunes..Sábado
    const dayIndex = d === 7 ? 0 : d;
    return (Array.isArray(dayNames) && dayNames[dayIndex]) ? dayNames[dayIndex] : '';
  }

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

  function applyPreset(presetKey) {
    const modal = document.getElementById('weeklyScheduleModal');
    if (modal) {
      if (presetKey === 'personal-summer') {
        modal.dataset.syncWorkAllFree = 'true';
      } else {
        delete modal.dataset.syncWorkAllFree;
      }
    }

    const newSched = {};
    if (presetKey === 'work-standard') {
      for (let d = 1; d <= 5; d++) newSched[d] = { start: 9 * 60, end: 18 * 60 };
      newSched[6] = null;
      newSched[7] = null;
    } else if (presetKey === 'work-intensive') {
      for (let d = 1; d <= 5; d++) newSched[d] = { start: 8 * 60, end: 15 * 60 };
      newSched[6] = null;
      newSched[7] = null;
    } else if (presetKey === 'work-vacation') {
      for (let d = 1; d <= 7; d++) newSched[d] = null;
    } else if (presetKey === 'personal-summer') {
      for (let d = 1; d <= 7; d++) newSched[d] = { start: 9 * 60, end: 23 * 60 };
    } else if (presetKey === 'personal-afterwork') {
      for (let d = 1; d <= 5; d++) newSched[d] = { start: 18 * 60, end: 23 * 60 };
      newSched[6] = { start: 9 * 60, end: 23 * 60 };
      newSched[7] = { start: 9 * 60, end: 23 * 60 };
    } else if (presetKey === 'personal-nights') {
      for (let d = 1; d <= 7; d++) newSched[d] = { start: 20 * 60, end: 23 * 60 };
    }

    renderWeeklyScheduleRows(newSched);

    const presetsContainer = document.getElementById('weeklySchedulePresets');
    if (presetsContainer) {
      presetsContainer.querySelectorAll('.weekly-preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === presetKey);
      });
    }
  }

  function renderWeeklySchedulePresets(envKey) {
    if (typeof document === "undefined") return;
    const presetsContainer = document.getElementById('weeklySchedulePresets');
    if (!presetsContainer) return;

    let presetsHtml = `
      <div class="weekly-presets-header">
        <span>${t('weeklySchedule.presetsTitle')}</span>
      </div>
      <div class="weekly-presets-list">
    `;

    if (envKey === 'personal') {
      presetsHtml += `
        <button type="button" class="weekly-preset-btn highlight" data-preset="personal-summer">
          ${t('weeklySchedule.presetPersonalSummer')}
        </button>
        <button type="button" class="weekly-preset-btn" data-preset="personal-afterwork">
          ${t('weeklySchedule.presetPersonalAfterwork')}
        </button>
        <button type="button" class="weekly-preset-btn" data-preset="personal-nights">
          ${t('weeklySchedule.presetPersonalNights')}
        </button>
      `;
    } else {
      presetsHtml += `
        <button type="button" class="weekly-preset-btn highlight" data-preset="work-standard">
          ${t('weeklySchedule.presetWorkStandard')}
        </button>
        <button type="button" class="weekly-preset-btn" data-preset="work-intensive">
          ${t('weeklySchedule.presetWorkIntensive')}
        </button>
        <button type="button" class="weekly-preset-btn" data-preset="work-vacation">
          ${t('weeklySchedule.presetWorkVacation')}
        </button>
      `;
    }

    presetsHtml += `</div>`;
    presetsContainer.innerHTML = presetsHtml;

    presetsContainer.querySelectorAll('.weekly-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyPreset(btn.dataset.preset);
      });
    });
  }

  function renderWeeklyScheduleRows(schedule) {
    if (typeof document === "undefined") return;
    const container = document.getElementById('weeklyScheduleRows');
    if (!container) return;
    let html = '';
    for (let d = 1; d <= 7; d++) {
      const slot = schedule[d];
      const isFree = slot === null;
      const startVal = (!isFree && slot) ? fmt(slot.start) : '09:00';
      const endVal = (!isFree && slot) ? fmt(slot.end) : '18:00';
      html += `
        <div class="weekly-schedule-row${isFree ? ' is-free' : ''}" data-day="${d}">
          <div class="weekly-schedule-row-header">
            <span class="weekly-day-name ws-day-name">${getDayName(d)}</span>
            <label class="weekly-free-label ws-free-label">
              <input type="checkbox" class="weekly-free-check" ${isFree ? 'checked' : ''}>
              <span>${t('weeklySchedule.dayOffLabel')}</span>
            </label>
          </div>
          <div class="weekly-time-inputs ws-times">
            <div class="weekly-time-field">
              <span class="weekly-field-label">${t('weeklySchedule.startTime')}</span>
              <input type="time" class="weekly-time-input weekly-start" value="${startVal}" ${isFree ? 'disabled' : ''}>
            </div>
            <span class="weekly-time-sep ws-sep">→</span>
            <div class="weekly-time-field">
              <span class="weekly-field-label">${t('weeklySchedule.endTime')}</span>
              <input type="time" class="weekly-time-input weekly-end" value="${endVal}" ${isFree ? 'disabled' : ''}>
            </div>
          </div>
          <div class="weekly-free-badge${isFree ? '' : ' hidden'}">
            ${t('weeklySchedule.dayOffNotice')}
          </div>
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
        const badge = row.querySelector('.weekly-free-badge');
        if (badge) badge.classList.toggle('hidden', !isChecked);
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
          showToast(t('weeklySchedule.invalidRangeToast', { day: getDayName(d) }));
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
    delete modal.dataset.syncWorkAllFree;
    const titleEl = document.getElementById('weeklyScheduleTitle');
    const badgeEl = document.getElementById('weeklyScheduleEnvBadge');
    if (titleEl) titleEl.textContent = t('modal.weeklyScheduleTitle');
    if (badgeEl) {
      badgeEl.textContent = envKey === 'work' ? `💼 ${t('env.work')}` : `🏠 ${t('env.personal')}`;
      badgeEl.className = 'weekly-env-badge ' + envKey;
    }
    renderWeeklySchedulePresets(envKey);
    const schedule = getOrDeriveWeeklySchedule(envKey);
    renderWeeklyScheduleRows(schedule);
    modal.style.display = 'flex';
  }

  function closeWeeklyScheduleModal() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById('weeklyScheduleModal');
    if (modal) {
      delete modal.dataset.syncWorkAllFree;
      modal.style.display = 'none';
    }
  }

  if (typeof document !== "undefined") {
    // Botón "📅 Horario semanal" en la cabecera (panel configuración)
    const openWeeklyScheduleBtnEl = document.getElementById('weeklyScheduleBtn');
    if (openWeeklyScheduleBtnEl) {
      openWeeklyScheduleBtnEl.addEventListener('click', openWeeklyScheduleModal);
    }

    // Botón × (cerrar) del modal
    const closeWeeklyScheduleBtnEl = document.getElementById('closeWeeklyScheduleBtn');
    if (closeWeeklyScheduleBtnEl) {
      closeWeeklyScheduleBtnEl.addEventListener('click', closeWeeklyScheduleModal);
    }

    // Botón "Cancelar" del modal
    const cancelWeeklyScheduleBtnEl = document.getElementById('cancelWeeklyScheduleBtn');
    if (cancelWeeklyScheduleBtnEl) {
      cancelWeeklyScheduleBtnEl.addEventListener('click', closeWeeklyScheduleModal);
    }

    // Clic en el overlay para cerrar
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

        const modal = document.getElementById('weeklyScheduleModal');
        const isSummerSync = modal && modal.dataset.syncWorkAllFree === 'true';

        if (isSummerSync) {
          state.environments.work.weeklySchedule = {
            1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null
          };
          delete modal.dataset.syncWorkAllFree;
        } else if (envKey === 'work') {
          syncPersonalFromWork();
        }

        saveState();
        if (viewsModule) {
          viewsModule.syncFormInputsFromState();
          viewsModule.renderAll();
        }
        closeWeeklyScheduleModal();

        if (isSummerSync) {
          showToast(t('weeklySchedule.presetSummerSavedToast'));
        } else {
          showToast(t('weeklySchedule.savedToast'));
        }
      });
    }
  }

  return {
    derivePersonalFromWork,
    syncPersonalFromWork,
    getOrDeriveWeeklySchedule,
    openWeeklyScheduleModal,
    closeWeeklyScheduleModal,
    applyPreset,
    renderWeeklySchedulePresets,
    renderWeeklyScheduleRows
  };
}

export default TodayTasksWeeklySchedule;
