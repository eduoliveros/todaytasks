import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksWeeklySchedule } from '../js/app/weekly-schedule.js';
import { setLocale } from '../js/i18n.js';

function buildDOM() {
  document.body.innerHTML = `
    <button id="weeklyScheduleBtn">Horario semanal</button>
    <div id="weeklyScheduleModal" style="display:none">
      <div class="modal-box">
        <h3 id="weeklyScheduleTitle">Horario semanal</h3>
        <span id="weeklyScheduleEnvBadge"></span>
        <button id="closeWeeklyScheduleBtn">x</button>
        <div id="weeklyScheduleRows"></div>
        <button id="saveWeeklyScheduleBtn">Guardar</button>
        <button id="cancelWeeklyScheduleBtn">Cancelar</button>
      </div>
    </div>
  `;
}

describe('Horario Semanal - Internacionalización (i18n)', () => {
  let state;
  let lastToast = null;

  function buildCtx(customState) {
    return {
      getState: () => customState,
      saveState: () => {},
      viewsModule: null,
      fmt: (m) => {
        if (m == null) return '';
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        return hh + ':' + mm;
      },
      timeToMinutes: (s) => {
        if (!s) return null;
        const [h, m] = s.split(':').map(Number);
        return h * 60 + m;
      },
      showToast: (msg) => { lastToast = msg; }
    };
  }

  beforeEach(() => {
    buildDOM();
    lastToast = null;
    setLocale('es');
    state = defaultState();
    state.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 },
      2: { start: 540, end: 1020 },
      3: { start: 540, end: 1020 },
      4: { start: 540, end: 1020 },
      5: { start: 540, end: 900 },
      6: null,
      7: null
    };
  });

  it('renderiza nombres de días, etiquetas de día libre y toasts en español por defecto', () => {
    TodayTasksWeeklySchedule(buildCtx(state));
    document.getElementById('weeklyScheduleBtn').click();

    const rows = document.querySelectorAll('.weekly-schedule-row');
    expect(rows[0].querySelector('.weekly-day-name').textContent).toBe('Lunes');
    expect(rows[4].querySelector('.weekly-day-name').textContent).toBe('Viernes');
    expect(rows[6].querySelector('.weekly-day-name').textContent).toBe('Domingo');
    expect(rows[0].querySelector('.weekly-free-label').textContent).toContain('Día libre');
    expect(document.getElementById('weeklyScheduleEnvBadge').textContent).toContain('Trabajo');

    // Guardar exitoso
    document.getElementById('saveWeeklyScheduleBtn').click();
    expect(lastToast).toBe('📅 Horario semanal guardado');
  });

  it('renderiza nombres de días, etiquetas de día libre y toasts en inglés cuando el locale es en', () => {
    setLocale('en');
    TodayTasksWeeklySchedule(buildCtx(state));
    document.getElementById('weeklyScheduleBtn').click();

    const rows = document.querySelectorAll('.weekly-schedule-row');
    expect(rows[0].querySelector('.weekly-day-name').textContent).toBe('Monday');
    expect(rows[4].querySelector('.weekly-day-name').textContent).toBe('Friday');
    expect(rows[6].querySelector('.weekly-day-name').textContent).toBe('Sunday');
    expect(rows[0].querySelector('.weekly-free-label').textContent).toContain('Day off');
    expect(document.getElementById('weeklyScheduleEnvBadge').textContent).toContain('Work');

    // Guardar exitoso
    document.getElementById('saveWeeklyScheduleBtn').click();
    expect(lastToast).toBe('📅 Weekly schedule saved');
    setLocale('es');
  });
});
