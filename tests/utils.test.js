import { describe, it, expect, beforeEach } from 'vitest';

describe('TodayTasksUtils', () => {
  beforeEach(async () => {
    // Cargar el script js/utils.js en el contexto de jsdom
    await import('../js/utils.js');
  });

  describe('timeToMinutes & fmt', () => {
    it('convierte cadenas "HH:MM" a minutos correctamente', () => {
      const utils = window.TodayTasksUtils;
      expect(utils.timeToMinutes('09:30')).toBe(570);
      expect(utils.timeToMinutes('00:00')).toBe(0);
      expect(utils.timeToMinutes('18:45')).toBe(1125);
      expect(utils.timeToMinutes(null)).toBeNull();
      expect(utils.timeToMinutes('')).toBeNull();
    });

    it('formatea minutos a cadena "HH:MM"', () => {
      const utils = window.TodayTasksUtils;
      expect(utils.fmt(570)).toBe('09:30');
      expect(utils.fmt(0)).toBe('00:00');
      expect(utils.fmt(1125)).toBe('18:45');
      expect(utils.fmt(-10)).toBe('00:00');
    });
  });

  describe('fmtDur', () => {
    it('formatea duraciones en formato legible', () => {
      const utils = window.TodayTasksUtils;
      expect(utils.fmtDur(30)).toBe('30 min');
      expect(utils.fmtDur(60)).toBe('1h ');
      expect(utils.fmtDur(90)).toBe('1h 30min');
      expect(utils.fmtDur(125)).toBe('2h 5min');
    });
  });

  describe('fmtRemaining', () => {
    it('calcula correctamente el tiempo restante sin overrun', () => {
      const utils = window.TodayTasksUtils;
      const res = utils.fmtRemaining(600, 540); // queda 60 min
      expect(res.overrun).toBe(false);
      expect(res.text).toBe('quedan 1h ');
    });

    it('identifica y formatea el tiempo excedido (overrun)', () => {
      const utils = window.TodayTasksUtils;
      const res = utils.fmtRemaining(540, 560); // 20 min tarde
      expect(res.overrun).toBe(true);
      expect(res.text).toBe('excedida 20 min');
    });
  });

  describe('Operaciones con fechas (addDays, diffDays, getDayOfWeek)', () => {
    it('añade días a una fecha', () => {
      const utils = window.TodayTasksUtils;
      expect(utils.addDays('2026-08-05', 1)).toBe('2026-08-06');
      expect(utils.addDays('2026-08-31', 1)).toBe('2026-09-01');
    });

    it('calcula diferencia en días entre dos fechas', () => {
      const utils = window.TodayTasksUtils;
      expect(utils.diffDays('2026-08-10', '2026-08-05')).toBe(5);
      expect(utils.diffDays('2026-08-05', '2026-08-10')).toBe(-5);
    });

    it('devuelve el día de la semana (1=Lunes ... 7=Domingo)', () => {
      const utils = window.TodayTasksUtils;
      // 2026-08-05 es Miércoles (3)
      expect(utils.getDayOfWeek('2026-08-05')).toBe(3);
      // 2026-08-09 es Domingo (7)
      expect(utils.getDayOfWeek('2026-08-09')).toBe(7);
    });
  });

  describe('Reglas de recurrencia (matchesRecurrenceRule)', () => {
    it('coincide correctamente con regla semanal', () => {
      const utils = window.TodayTasksUtils;
      const rule = {
        id: 'rec-1',
        title: 'Reunión Semanal',
        start: 600,
        end: 630,
        freq: 'weekly',
        interval: 1,
        daysOfWeek: [3], // Miércoles
        startDate: '2026-08-05'
      };

      // Miércoles 2026-08-05 coincide
      const match = utils.matchesRecurrenceRule(rule, '2026-08-05');
      expect(match).not.toBeNull();
      expect(match.title).toBe('Reunión Semanal');

      // Jueves 2026-08-06 no coincide (no es día 3)
      const noMatch = utils.matchesRecurrenceRule(rule, '2026-08-06');
      expect(noMatch).toBeNull();
    });
  });
});
