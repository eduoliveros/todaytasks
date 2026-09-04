import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState, wrapState } from '../js/state.js';
import { renderHistoryView, renderChart } from '../js/history.js';
import { setLocale } from '../js/i18n.js';

describe('History View - Internacionalización (i18n)', () => {
  let state;

  beforeEach(() => {
    document.body.innerHTML = `<div id="view-history"></div>`;
    setLocale('es');
    state = wrapState(defaultState());
    state.environments.work.history = [
      {
        date: '2026-09-01',
        effectiveTime: 180,
        meetingsTime: 60,
        completedTasksTime: 90,
        uncompletedTasksWorkedTime: 30,
        uncompletedTasksNotWorkedTime: 15,
        interruptionsTime: 10
      }
    ];
  });

  it('renderiza cabeceras, tarjetas, tabla y series en español por defecto', () => {
    renderHistoryView({ getState: () => state });
    const container = document.getElementById('view-history');

    expect(container.textContent).toContain('← Volver al Tablero');
    expect(container.textContent).toContain('Histórico y Evolución');
    expect(container.textContent).toContain('+ Añadir/Editar Medida Manual');
    expect(container.textContent).toContain('Días registrados');
    expect(container.textContent).toContain('Media Tiempo Efectivo/día');
    expect(container.textContent).toContain('Total Reuniones');
    expect(container.textContent).toContain('Evolución de los últimos 40 días');
    expect(container.textContent).toContain('Detalle de Mediciones por Día');
    expect(container.textContent).toContain('Tiempo Efectivo');
    expect(container.textContent).toContain('Reuniones');
    expect(container.textContent).toContain('Interrupciones');
  });

  it('renderiza cabeceras, tarjetas, tabla y series en inglés cuando el locale es en', () => {
    setLocale('en');
    renderHistoryView({ getState: () => state });
    const container = document.getElementById('view-history');

    expect(container.textContent).toContain('← Back to Board');
    expect(container.textContent).toContain('History and Trends');
    expect(container.textContent).toContain('+ Add/Edit Manual Entry');
    expect(container.textContent).toContain('Recorded days');
    expect(container.textContent).toContain('Avg Effective Time/day');
    expect(container.textContent).toContain('Total Meetings');
    expect(container.textContent).toContain('Trend over the last 40 days');
    expect(container.textContent).toContain('Daily Measurements Breakdown');
    expect(container.textContent).toContain('Effective Time');
    expect(container.textContent).toContain('Meetings');
    expect(container.textContent).toContain('Interruptions');
    setLocale('es');
  });

  it('renderiza el estado vacío del gráfico en inglés', () => {
    setLocale('en');
    const chartHtml = renderChart([]);
    expect(chartHtml).toContain('No history data recorded yet');
    setLocale('es');
  });
});
