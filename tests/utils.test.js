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

  describe('Cálculo de espacio del día ocupado por reuniones (computeOccupiedMeetingTime)', () => {
    it('calcula 1h (60 min) cuando hay dos reuniones solapadas de 10:00 a 11:00 en lugar de sumar 2h', () => {
      const utils = window.TodayTasksUtils;
      const meetings = [
        { id: 1, title: 'Reunión A', start: 600, end: 660 }, // 10:00 - 11:00
        { id: 2, title: 'Reunión B', start: 600, end: 660 }  // 10:00 - 11:00
      ];
      expect(utils.computeOccupiedMeetingTime(meetings)).toBe(60);
    });

    it('combina correctamente reuniones parcialmente solapadas', () => {
      const utils = window.TodayTasksUtils;
      const meetings = [
        { id: 1, title: 'Reunión 1', start: 600, end: 690 }, // 10:00 - 11:30 (90 min)
        { id: 2, title: 'Reunión 2', start: 660, end: 720 }  // 11:00 - 12:00 (60 min)
      ];
      // Ocupan de 10:00 a 12:00 = 120 minutos (2h), no 150 min
      expect(utils.computeOccupiedMeetingTime(meetings)).toBe(120);
    });

    it('suma correctamente reuniones disjuntas y maneja reuniones completamente contenidas', () => {
      const utils = window.TodayTasksUtils;
      const meetings = [
        { id: 1, title: 'Grande', start: 600, end: 720 },  // 10:00 - 12:00
        { id: 2, title: 'Dentro', start: 630, end: 660 },  // 10:30 - 11:00
        { id: 3, title: 'Tarde', start: 800, end: 860 }   // 13:20 - 14:20 (60 min)
      ];
      // Ocupan [600, 720] (120 min) + [800, 860] (60 min) = 180 min (3h)
      expect(utils.computeOccupiedMeetingTime(meetings)).toBe(180);
    });
  });
});
