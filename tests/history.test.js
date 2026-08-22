import { describe, it, expect } from 'vitest';
import * as history from '../js/history.js';
import { computeMetricsFromDay, snapshotAndPrune, saveHistoryMetric, deleteHistoryMetric } from '../js/history.js';
import { defaultState } from '../js/state.js';
import { addDays, getTodayStr } from '../js/utils.js';

describe('TodayTasksHistory - Histórico y Métricas (ES Module)', () => {
  it('exporta correctamente las funciones del módulo de histórico', () => {
    expect(computeMetricsFromDay).toBeDefined();
    expect(snapshotAndPrune).toBeDefined();
    expect(saveHistoryMetric).toBeDefined();
    expect(deleteHistoryMetric).toBeDefined();
  });

  describe('computeMetricsFromDay', () => {
    it('calcula métricas de tiempo correctamente a partir de los datos del día', () => {
      const dayData = {
        meetings: [
          { start: 600, end: 660 } // 60 min de reunión
        ],
        tasks: [
          { status: 'completed', actualDuration: 45 },
          { status: 'completed', planned: 30 }, // fallback si no hay actualDuration
          { status: 'pending', elapsedBefore: 15, planned: 40 } // trabajado 15, no trabajado 25
        ],
        interruptions: [
          { duration: 10 }
        ]
      };

      const metrics = computeMetricsFromDay(dayData);

      expect(metrics.meetingsTime).toBe(60);
      expect(metrics.completedTasksTime).toBe(75); // 45 + 30
      expect(metrics.uncompletedTasksWorkedTime).toBe(15);
      expect(metrics.uncompletedTasksNotWorkedTime).toBe(25);
      expect(metrics.interruptionsTime).toBe(10);
      expect(metrics.effectiveTime).toBe(60 + 75 + 15); // 150 min
    });

    it('calcula el tiempo de reuniones en el histórico usando el tiempo real ocupado (no la suma si se solapan)', () => {
      const dayData = {
        meetings: [
          { start: 600, end: 660 }, // 10:00 - 11:00 (60 min)
          { start: 600, end: 660 }  // 10:00 - 11:00 (60 min solapados)
        ],
        tasks: [],
        interruptions: []
      };

      const metrics = computeMetricsFromDay(dayData);

      // Debe calcular 60 min ocupados, no 120 min
      expect(metrics.meetingsTime).toBe(60);
      expect(metrics.effectiveTime).toBe(60);
    });

    it('devuelve valores en 0 para días vacíos o nulos', () => {
      const metrics = computeMetricsFromDay(null);
      expect(metrics.meetingsTime).toBe(0);
      expect(metrics.effectiveTime).toBe(0);
    });
  });

  describe('snapshotAndPrune', () => {
    it('genera una captura histórica y limita los registros a los últimos 40 días', () => {
      const state = defaultState();
      const env = state.environments.work;

      // Crear 45 entradas antiguas en el historial
      env.history = [];
      for (let i = 1; i <= 45; i++) {
        const dayNum = String(i).padStart(2, '0');
        env.history.push({
          date: `2026-06-${dayNum}`,
          effectiveTime: 120
        });
      }

      snapshotAndPrune(state);

      // Debe podar a máximo 40 días
      expect(env.history.length).toBe(40);
    });

    it('poda el detalle de días de tareas/reuniones de hace más de 10 días', () => {
      const state = defaultState();
      const todayStr = getTodayStr();
      const env = state.environments.work;

      const dateRecent = addDays(todayStr, -5);
      const dateOld = addDays(todayStr, -12);

      env.days[dateRecent] = { meetings: [], tasks: [] };
      env.days[dateOld] = { meetings: [], tasks: [] };

      snapshotAndPrune(state);

      expect(env.days[dateRecent]).toBeDefined();
      expect(env.days[dateOld]).toBeUndefined(); // Se eliminó por antigüedad > 10 días
    });
  });

  describe('saveHistoryMetric & deleteHistoryMetric', () => {
    it('guarda o actualiza una medida manual en el historial', () => {
      const state = defaultState();
      const testDate = '2026-08-01';

      saveHistoryMetric(state, testDate, {
        meetingsTime: 60,
        completedTasksTime: 120,
        uncompletedTasksWorkedTime: 30,
        uncompletedTasksNotWorkedTime: 0,
        interruptionsTime: 15
      });

      const env = state.environments.work;
      const entry = env.history.find(h => h.date === testDate);

      expect(entry).toBeDefined();
      expect(entry.meetingsTime).toBe(60);
      expect(entry.completedTasksTime).toBe(120);
      expect(entry.effectiveTime).toBe(60 + 120 + 30); // 210 min
    });

    it('elimina un registro del historial', () => {
      const state = defaultState();
      const testDate = '2026-08-01';

      saveHistoryMetric(state, testDate, {
        meetingsTime: 60,
        completedTasksTime: 60
      });

      deleteHistoryMetric(state, testDate);

      const env = state.environments.work;
      const entry = env.history.find(h => h.date === testDate);
      expect(entry).toBeUndefined();
    });
  });
});

