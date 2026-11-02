import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksWeeklySchedule } from '../js/app/weekly-schedule.js';

function buildDOM() {
  document.body.innerHTML = `
    <button id="weeklyScheduleBtn">Horario semanal</button>
    <div id="weeklyScheduleModal" style="display:none">
      <div class="modal-box">
        <h3 id="weeklyScheduleTitle">Horario semanal</h3>
        <span id="weeklyScheduleEnvBadge"></span>
        <button id="closeWeeklyScheduleBtn">x</button>
        <div id="weeklySchedulePresets"></div>
        <div id="weeklyScheduleRows"></div>
        <button id="saveWeeklyScheduleBtn">Guardar</button>
        <button id="cancelWeeklyScheduleBtn">Cancelar</button>
      </div>
    </div>
  `;
}

function buildCtx(state) {
  return {
    getState: () => state,
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
    showToast: () => {},
  };
}

describe('Horario semanal - modal apertura/cierre y adaptacion movil', () => {
  let state;

  beforeEach(() => {
    buildDOM();
    state = defaultState();
    state.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 },
      2: { start: 540, end: 1020 },
      3: { start: 540, end: 1020 },
      4: { start: 540, end: 1020 },
      5: { start: 540, end: 900 },
      6: null,
      7: null,
    };
    TodayTasksWeeklySchedule(buildCtx(state));
  });

  it('el modal esta oculto al inicio', () => {
    const modal = document.getElementById('weeklyScheduleModal');
    expect(modal.style.display).toBe('none');
  });

  it('pulsar el boton Horario semanal abre el modal', () => {
    document.getElementById('weeklyScheduleBtn').click();
    const modal = document.getElementById('weeklyScheduleModal');
    expect(modal.style.display).toBe('flex');
  });

  it('el modal renderiza las 7 filas de dias al abrirse', () => {
    document.getElementById('weeklyScheduleBtn').click();
    const rows = document.querySelectorAll('.weekly-schedule-row');
    expect(rows.length).toBe(7);
  });

  it('el boton x cierra el modal', () => {
    document.getElementById('weeklyScheduleBtn').click();
    document.getElementById('closeWeeklyScheduleBtn').click();
    expect(document.getElementById('weeklyScheduleModal').style.display).toBe('none');
  });

  it('el boton Cancelar cierra el modal', () => {
    document.getElementById('weeklyScheduleBtn').click();
    document.getElementById('cancelWeeklyScheduleBtn').click();
    expect(document.getElementById('weeklyScheduleModal').style.display).toBe('none');
  });

  it('clic en el overlay cierra el modal', () => {
    document.getElementById('weeklyScheduleBtn').click();
    const modal = document.getElementById('weeklyScheduleModal');
    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.style.display).toBe('none');
  });

  it('renderiza presets rapidos segun el ambiente activo', () => {
    state.activeEnv = 'work';
    document.getElementById('weeklyScheduleBtn').click();
    const presets = document.querySelectorAll('.weekly-preset-btn');
    expect(presets.length).toBe(3);
    const presetsAttr = Array.from(presets).map(p => p.dataset.preset);
    expect(presetsAttr).toContain('work-standard');
    expect(presetsAttr).toContain('work-intensive');
    expect(presetsAttr).toContain('work-vacation');
  });

  it('en ambiente personal renderiza el preset de Verano (L-D 9-23 y Trabajo libre)', () => {
    state.activeEnv = 'personal';
    document.getElementById('weeklyScheduleBtn').click();
    const summerBtn = document.querySelector('[data-preset="personal-summer"]');
    expect(summerBtn).not.toBeNull();
    expect(summerBtn.classList.contains('highlight')).toBe(true);
  });

  it('aplicar el preset de Verano en personal configura L-D 09:00 a 23:00 y al guardar pone trabajo todo libre', () => {
    state.activeEnv = 'personal';
    document.getElementById('weeklyScheduleBtn').click();
    const summerBtn = document.querySelector('[data-preset="personal-summer"]');
    summerBtn.click();

    const rows = document.querySelectorAll('.weekly-schedule-row');
    rows.forEach(r => {
      expect(r.querySelector('.weekly-free-check').checked).toBe(false);
      expect(r.querySelector('.weekly-start').value).toBe('09:00');
      expect(r.querySelector('.weekly-end').value).toBe('23:00');
    });

    document.getElementById('saveWeeklyScheduleBtn').click();

    // Personal debe tener 9:00 a 23:00 toda la semana
    for (let d = 1; d <= 7; d++) {
      expect(state.environments.personal.weeklySchedule[d]).toEqual({ start: 540, end: 1380 });
    }

    // Trabajo debe quedar todo como libre
    for (let d = 1; d <= 7; d++) {
      expect(state.environments.work.weeklySchedule[d]).toBeNull();
    }
  });

  it('aplicar preset de jornada intensiva en trabajo configura L-V 08:00 a 15:00 y fines de semana libres', () => {
    state.activeEnv = 'work';
    document.getElementById('weeklyScheduleBtn').click();
    const intensiveBtn = document.querySelector('[data-preset="work-intensive"]');
    intensiveBtn.click();

    const rows = document.querySelectorAll('.weekly-schedule-row');
    // Lunes a Viernes
    for (let i = 0; i < 5; i++) {
      expect(rows[i].querySelector('.weekly-free-check').checked).toBe(false);
      expect(rows[i].querySelector('.weekly-start').value).toBe('08:00');
      expect(rows[i].querySelector('.weekly-end').value).toBe('15:00');
    }
    // Sábado y Domingo
    expect(rows[5].querySelector('.weekly-free-check').checked).toBe(true);
    expect(rows[6].querySelector('.weekly-free-check').checked).toBe(true);

    document.getElementById('saveWeeklyScheduleBtn').click();
    for (let d = 1; d <= 5; d++) {
      expect(state.environments.work.weeklySchedule[d]).toEqual({ start: 480, end: 900 });
    }
    expect(state.environments.work.weeklySchedule[6]).toBeNull();
    expect(state.environments.work.weeklySchedule[7]).toBeNull();
  });
});
