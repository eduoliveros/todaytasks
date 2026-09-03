import { describe, it, expect } from 'vitest';
import { computeDayDeviation, getTaskElapsed } from '../js/utils.js';

describe('computeDayDeviation (Modelo Híbrido Realista)', () => {
  it('ignora entradas no válidas y retorna estructura inicial en ceros', () => {
    const defaultRes = { deviationMin: 0, realMin: 0, plannedMin: 0, evaluatedCount: 0 };
    expect(computeDayDeviation(null)).toEqual(defaultRes);
    expect(computeDayDeviation(undefined)).toEqual(defaultRes);
    expect(computeDayDeviation({})).toEqual(defaultRes);
    expect(computeDayDeviation([])).toEqual(defaultRes);
  });

  it('ignora tareas pendientes sin tiempo consumido', () => {
    const tasks = [
      { status: 'pending', planned: 30, elapsedBefore: 0 },
      { status: 'pending', planned: 60, elapsedBefore: 0 }
    ];
    const r = computeDayDeviation(tasks);
    expect(r.evaluatedCount).toBe(0);
    expect(r.realMin).toBe(0);
    expect(r.plannedMin).toBe(0);
    expect(r.deviationMin).toBe(0);
  });

  it('NO genera falso adelanto cuando una tarea en curso lleva menos tiempo del planificado', () => {
    // Tarea de 60m que lleva 10m ejecutados:
    // Con la fórmula previa fallaba calculando 10 - 60 = -50m.
    // Con el modelo híbrido no debe aportar falso ahorro: evaluatedCount=0, dev=0.
    const running = { status: 'running', planned: 60, elapsedBefore: 10, runningStart: null };
    const r = computeDayDeviation([running], () => 0);
    expect(r.evaluatedCount).toBe(0);
    expect(r.realMin).toBe(0);
    expect(r.plannedMin).toBe(0);
    expect(r.deviationMin).toBe(0);
  });

  it('detecta y suma el sobrecoste en vivo cuando una tarea en curso supera su duración planificada', () => {
    // Tarea de 30m que lleva 45m consumidos (10m antes + 35m de reloj en vivo):
    // Debe aportar +15m de desviación y ser contabilizada.
    const running = { status: 'running', planned: 30, elapsedBefore: 10, runningStart: 100, runningStartEpoch: null };
    const r = computeDayDeviation([running], () => 135); // diff = 35m, total elapsed = 45m
    expect(r.evaluatedCount).toBe(1);
    expect(r.realMin).toBe(45);
    expect(r.plannedMin).toBe(30);
    expect(r.deviationMin).toBe(15);
  });

  it('calcula correctamente la desviación de tareas completadas (ahorro y retraso)', () => {
    const tasks = [
      { status: 'completed', planned: 60, actualDuration: 45, elapsedBefore: 0 }, // -15m ahorro
      { status: 'completed', planned: 30, actualDuration: 40, elapsedBefore: 0 }  // +10m retraso
    ];
    const r = computeDayDeviation(tasks);
    expect(r.evaluatedCount).toBe(2);
    expect(r.realMin).toBe(85);
    expect(r.plannedMin).toBe(90);
    expect(r.deviationMin).toBe(-5);
  });

  it('calcula con exactitud escenarios mixtos (completadas + en curso sobrepasada + en curso normal)', () => {
    const tasks = [
      { status: 'completed', planned: 40, actualDuration: 30 }, // completada: real 30, plan 40 (-10)
      { status: 'completed', planned: 30, actualDuration: 48 }, // completada: real 48, plan 30 (+18)
      { status: 'running', planned: 20, elapsedBefore: 35, runningStart: null }, // en curso sobrepasada: real 35, plan 20 (+15)
      { status: 'running', planned: 60, elapsedBefore: 15, runningStart: null }, // en curso dentro de margen: ignorada (0)
      { status: 'pending', planned: 45 } // pendiente: ignorada (0)
    ];
    const r = computeDayDeviation(tasks, () => 0);
    expect(r.evaluatedCount).toBe(3);
    expect(r.realMin).toBe(30 + 48 + 35); // 113
    expect(r.plannedMin).toBe(40 + 30 + 20); // 90
    expect(r.deviationMin).toBe(23); // 113 - 90 = +23
  });

  it('redondea a un solo decimal los minutos', () => {
    const tasks = [
      { status: 'completed', planned: 45, actualDuration: 33.33 }
    ];
    const r = computeDayDeviation(tasks);
    expect(r.realMin).toBe(33.3);
    expect(r.plannedMin).toBe(45);
    expect(r.deviationMin).toBe(-11.7);
  });
});

describe('getTaskElapsed (dependencia de computeDayDeviation)', () => {
  it('retorna 0 para entrada nula', () => {
    expect(getTaskElapsed(null)).toBe(0);
  });
});
