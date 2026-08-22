import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksWeeklySchedule } from '../js/app/weekly-schedule.js';

function buildDOM() {
  document.body.innerHTML = `
    <button id="weeklyScheduleBtn">Horario semanal</button>
    <div id="weeklyScheduleModal" style="display:none">
      <div class="modal-box">
        <h3 id="weeklyScheduleTitle">Horario semanal</h3>
        <button id="closeWeeklyScheduleBtn">x</button>
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

describe('Horario semanal - modal apertura/cierre', () => {
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
});

