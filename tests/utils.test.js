import { describe, it, expect } from 'vitest';
import * as utils from '../js/utils.js';

describe('TodayTasksUtils (ES Module)', () => {
  it('exporta correctamente las funciones de utilidad', () => {
    expect(utils.nowMinutes).toBeDefined();
    expect(utils.fmt).toBeDefined();
    expect(utils.fmtDur).toBeDefined();
    expect(utils.timeToMinutes).toBeDefined();
    expect(utils.getTodayStr).toBeDefined();
    expect(utils.getDayOfWeek).toBeDefined();
    expect(utils.addDays).toBeDefined();
    expect(utils.diffDays).toBeDefined();
    expect(utils.computeOccupiedMeetingTime).toBeDefined();
  });

  describe('timeToMinutes & fmt', () => {
    it('convierte cadenas "HH:MM" a minutos correctamente', () => {
      expect(utils.timeToMinutes('09:30')).toBe(570);
      expect(utils.timeToMinutes('00:00')).toBe(0);
      expect(utils.timeToMinutes('18:45')).toBe(1125);
      expect(utils.timeToMinutes(null)).toBeNull();
      expect(utils.timeToMinutes('')).toBeNull();
    });

    it('formatea minutos a cadena "HH:MM"', () => {
      expect(utils.fmt(570)).toBe('09:30');
      expect(utils.fmt(0)).toBe('00:00');
      expect(utils.fmt(1125)).toBe('18:45');
      expect(utils.fmt(-10)).toBe('00:00');
    });
  });

  describe('parseDuration', () => {
    it('parsea números directos y cadenas numéricas en minutos', () => {
      expect(utils.parseDuration(45)).toBe(45);
      expect(utils.parseDuration('45')).toBe(45);
      expect(utils.parseDuration('  90  ')).toBe(90);
      expect(utils.parseDuration('120')).toBe(120);
      expect(utils.parseDuration(0)).toBe(0);
      expect(utils.parseDuration('-10')).toBe(-10);
    });

    it('parsea formatos combinados de horas y minutos ("1h 30m", "1h30m", "1h 30min", etc.)', () => {
      expect(utils.parseDuration('1h 30m')).toBe(90);
      expect(utils.parseDuration('1h30m')).toBe(90);
      expect(utils.parseDuration('1h 30min')).toBe(90);
      expect(utils.parseDuration('1h 30 mins')).toBe(90);
      expect(utils.parseDuration('1h 30 minutos')).toBe(90);
      expect(utils.parseDuration('1 hora 30 minutos')).toBe(90);
      expect(utils.parseDuration('1hr 30m')).toBe(90);
      expect(utils.parseDuration('1H 30M')).toBe(90);
      expect(utils.parseDuration('2h 15m')).toBe(135);
      expect(utils.parseDuration('1h 30')).toBe(90);
    });

    it('parsea formatos con solo horas ("1h", "2h", "1.5h", "1,5h", "0.5h")', () => {
      expect(utils.parseDuration('1h')).toBe(60);
      expect(utils.parseDuration('2h')).toBe(120);
      expect(utils.parseDuration('2 horas')).toBe(120);
      expect(utils.parseDuration('1.5h')).toBe(90);
      expect(utils.parseDuration('1,5h')).toBe(90);
      expect(utils.parseDuration('0.5h')).toBe(30);
      expect(utils.parseDuration('0,5 h')).toBe(30);
      expect(utils.parseDuration('2hrs')).toBe(120);
    });

    it('parsea formatos con solo minutos ("30m", "45min", "45 minutos")', () => {
      expect(utils.parseDuration('30m')).toBe(30);
      expect(utils.parseDuration('45min')).toBe(45);
      expect(utils.parseDuration('45 min')).toBe(45);
      expect(utils.parseDuration('45 minutos')).toBe(45);
      expect(utils.parseDuration('90m')).toBe(90);
    });

    it('parsea formatos de reloj HH:MM ("1:30", "0:45")', () => {
      expect(utils.parseDuration('1:30')).toBe(90);
      expect(utils.parseDuration('0:45')).toBe(45);
      expect(utils.parseDuration('02:00')).toBe(120);
    });

    it('retorna null para cadenas vacías o valores inválidos', () => {
      expect(utils.parseDuration('')).toBeNull();
      expect(utils.parseDuration('   ')).toBeNull();
      expect(utils.parseDuration(null)).toBeNull();
      expect(utils.parseDuration(undefined)).toBeNull();
      expect(utils.parseDuration('invalido')).toBeNull();
      expect(utils.parseDuration('---')).toBeNull();
    });
  });

  describe('fmtDur', () => {
    it('formatea duraciones en formato legible', () => {
      expect(utils.fmtDur(30)).toBe('30 min');
      expect(utils.fmtDur(60)).toBe('1h ');
      expect(utils.fmtDur(90)).toBe('1h 30min');
      expect(utils.fmtDur(125)).toBe('2h 5min');
    });
  });

  describe('fmtRemaining', () => {
    it('calcula correctamente el tiempo restante sin overrun', () => {
      const res = utils.fmtRemaining(600, 540); // queda 60 min
      expect(res.overrun).toBe(false);
      expect(res.text).toBe('quedan 1h ');
    });

    it('identifica y formatea el tiempo excedido (overrun)', () => {
      const res = utils.fmtRemaining(540, 560); // 20 min tarde
      expect(res.overrun).toBe(true);
      expect(res.text).toBe('excedida 20 min');
    });
  });

  describe('Operaciones con fechas (addDays, diffDays, getDayOfWeek)', () => {
    it('añade días a una fecha', () => {
      expect(utils.addDays('2026-08-05', 1)).toBe('2026-08-06');
      expect(utils.addDays('2026-08-31', 1)).toBe('2026-09-01');
    });

    it('calcula diferencia en días entre dos fechas', () => {
      expect(utils.diffDays('2026-08-10', '2026-08-05')).toBe(5);
      expect(utils.diffDays('2026-08-05', '2026-08-10')).toBe(-5);
    });

    it('devuelve el día de la semana (1=Lunes ... 7=Domingo)', () => {
      // 2026-08-05 es Miércoles (3)
      expect(utils.getDayOfWeek('2026-08-05')).toBe(3);
      // 2026-08-09 es Domingo (7)
      expect(utils.getDayOfWeek('2026-08-09')).toBe(7);
    });
  });

  describe('Reglas de recurrencia (matchesRecurrenceRule)', () => {
    it('coincide correctamente con regla semanal', () => {
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
      const meetings = [
        { id: 1, title: 'Reunión A', start: 600, end: 660 }, // 10:00 - 11:00
        { id: 2, title: 'Reunión B', start: 600, end: 660 }  // 10:00 - 11:00
      ];
      expect(utils.computeOccupiedMeetingTime(meetings)).toBe(60);
    });

    it('combina correctamente reuniones parcialmente solapadas', () => {
      const meetings = [
        { id: 1, title: 'Reunión 1', start: 600, end: 690 }, // 10:00 - 11:30 (90 min)
        { id: 2, title: 'Reunión 2', start: 660, end: 720 }  // 11:00 - 12:00 (60 min)
      ];
      // Ocupan de 10:00 a 12:00 = 120 minutos (2h), no 150 min
      expect(utils.computeOccupiedMeetingTime(meetings)).toBe(120);
    });

    it('suma correctamente reuniones disjuntas y maneja reuniones completamente contenidas', () => {
      const meetings = [
        { id: 1, title: 'Grande', start: 600, end: 720 },  // 10:00 - 12:00
        { id: 2, title: 'Dentro', start: 630, end: 660 },  // 10:30 - 11:00
        { id: 3, title: 'Tarde', start: 800, end: 860 }   // 13:20 - 14:20 (60 min)
      ];
      // Ocupan [600, 720] (120 min) + [800, 860] (60 min) = 180 min (3h)
      expect(utils.computeOccupiedMeetingTime(meetings)).toBe(180);
    });
  });

  describe('Búsqueda inteligente (normalizeSearchText & matchesSearchQuery)', () => {
    it('normalizeSearchText elimina acentos, convierte a minúsculas y recorta espacios', () => {
      expect(utils.normalizeSearchText('  Árbol Éxito Índice Ópera Único  ')).toBe('arbol exito indice opera unico');
      expect(utils.normalizeSearchText('DISEÑO Gráfico')).toBe('diseno grafico');
      expect(utils.normalizeSearchText('')).toBe('');
      expect(utils.normalizeSearchText(null)).toBe('');
      expect(utils.normalizeSearchText(undefined)).toBe('');
    });

    it('matchesSearchQuery devuelve true con query vacío o solo espacios', () => {
      expect(utils.matchesSearchQuery('Revisar API', '')).toBe(true);
      expect(utils.matchesSearchQuery('Revisar API', '   ')).toBe(true);
      expect(utils.matchesSearchQuery('Revisar API', null)).toBe(true);
      expect(utils.matchesSearchQuery('Revisar API', undefined)).toBe(true);
    });

    it('matchesSearchQuery encuentra palabras individuales ignorando mayúsculas y acentos', () => {
      expect(utils.matchesSearchQuery('Revisión de la API', 'revision')).toBe(true);
      expect(utils.matchesSearchQuery('Revisión de la API', 'REVISION')).toBe(true);
      expect(utils.matchesSearchQuery('Revisión de la API', 'api')).toBe(true);
      expect(utils.matchesSearchQuery('Revisión de la API', 'API')).toBe(true);
    });

    it('matchesSearchQuery busca múltiples tokens en cualquier orden (multi-token)', () => {
      const title = 'Revisar la API de facturación mensual';
      expect(utils.matchesSearchQuery(title, 'api facturacion')).toBe(true);
      expect(utils.matchesSearchQuery(title, 'facturacion api')).toBe(true);
      expect(utils.matchesSearchQuery(title, 'mensual api revisar')).toBe(true);
      expect(utils.matchesSearchQuery(title, 'revisar mensual')).toBe(true);
    });

    it('matchesSearchQuery busca dentro de las palabras (substrings no completos)', () => {
      const title = 'Comprar en el supermercado';
      expect(utils.matchesSearchQuery(title, 'merca comp')).toBe(true);
      expect(utils.matchesSearchQuery(title, 'permercado')).toBe(true);
      expect(utils.matchesSearchQuery(title, 'super')).toBe(true);
    });

    it('matchesSearchQuery devuelve false si alguno de los tokens no coincide', () => {
      const title = 'Revisar la API de facturación mensual';
      expect(utils.matchesSearchQuery(title, 'api pagos')).toBe(false);
      expect(utils.matchesSearchQuery(title, 'revisar inexistente')).toBe(false);
    });

    it('matchesSearchQuery maneja texto destino nulo o no string', () => {
      expect(utils.matchesSearchQuery(null, 'test')).toBe(false);
      expect(utils.matchesSearchQuery(undefined, 'test')).toBe(false);
    });
  });
});


