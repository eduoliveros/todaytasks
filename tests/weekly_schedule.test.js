import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { fmt } from '../js/utils.js';

describe('Weekly Schedule and Day Navigation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('actualiza inicio y fin de jornada según el día de la semana', () => {
    const state = defaultState();

    // Configurar weeklySchedule: L-J: 9-17 (540-1020), V: 9-15 (540-900), S-D: libre (null)
    state.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 },
      2: { start: 540, end: 1020 },
      3: { start: 540, end: 1020 },
      4: { start: 540, end: 1020 },
      5: { start: 540, end: 900 },
      6: null,
      7: null
    };

    // Lunes (2026-08-10)
    state.selectedDate = '2026-08-10';
    expect(state.workStart).toBe(540);
    expect(state.workEnd).toBe(1020);
    expect(fmt(state.workStart)).toBe('09:00');
    expect(fmt(state.workEnd)).toBe('17:00');

    // Viernes (2026-08-14)
    state.selectedDate = '2026-08-14';
    expect(state.workStart).toBe(540);
    expect(state.workEnd).toBe(900);
    expect(fmt(state.workStart)).toBe('09:00');
    expect(fmt(state.workEnd)).toBe('15:00');

    // Sábado (2026-08-15, día libre)
    state.selectedDate = '2026-08-15';
    expect(state.workStart).toBeNull();
    expect(state.workEnd).toBeNull();
    expect(fmt(state.workStart)).toBe('');
    expect(fmt(state.workEnd)).toBe('');
  });

  it('respeta la anulación (override) manual de horas en un día concreto', () => {
    const state = defaultState();
    state.environments.work.weeklySchedule = {
      1: { start: 540, end: 1020 },
      5: { start: 540, end: 900 }
    };

    // Viernes (2026-08-14) por defecto 9-15
    state.selectedDate = '2026-08-14';
    expect(state.workEnd).toBe(900);

    // Usuario modifica el fin de jornada para este viernes específico a las 16:00 (960)
    state.workEnd = 960;
    expect(state.workEnd).toBe(960);
    expect(fmt(state.workEnd)).toBe('16:00');

    // Al cambiar de fecha y volver a otro viernes (2026-08-21), éste mantiene el horario de la plantilla semanal (15:00)
    state.selectedDate = '2026-08-21';
    expect(state.workEnd).toBe(900);
    expect(fmt(state.workEnd)).toBe('15:00');
  });

  it('despeja cualquier valor al poner nulo o vacío en día libre', () => {
    const state = defaultState();
    state.selectedDate = '2026-08-16'; // Domingo (día libre por defecto)

    expect(state.workStart).toBeNull();
    expect(state.workEnd).toBeNull();
    expect(fmt(state.workStart)).toBe('');
    expect(fmt(state.workEnd)).toBe('');
  });
});
