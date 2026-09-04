import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState, wrapState } from '../js/state.js';
import { TodayTasksTriageView } from '../js/views/triage.js';
import { setLocale } from '../js/i18n.js';

describe('Triage View - Internacionalización (i18n)', () => {
  let state;
  let triageView;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-triage"></div>
      <div id="triageEditModalHost"></div>
    `;
    setLocale('es');
    state = wrapState(defaultState());
    state.tasks = [
      { id: 't1', title: 'Task 1', planned: 20, urgency: 'today', status: 'pending', featured: true },
      { id: 't2', title: 'Task 2', planned: 45, urgency: 'days', status: 'pending' },
      { id: 't3', title: 'Task 3', planned: 90, urgency: 'later', status: 'pending' }
    ];

    triageView = TodayTasksTriageView({
      getState: () => state,
      saveState: () => {},
      renderAll: () => {},
      smartRender: () => {},
      actionsModule: {},
      getTaskEdit: () => null,
      nowMinutes: () => 600,
      computeSchedule: () => ({ overflowIds: new Set() })
    });
  });

  it('renderiza la cabecera, grupos y botones de triaje en español por defecto', () => {
    triageView.renderTriageView();
    const container = document.getElementById('view-triage');

    expect(container.textContent).toContain('← Tablero [X]');
    expect(container.textContent).toContain('⚡ Triaje Rápido');
    expect(container.textContent).toContain('🎯 Urgencia');
    expect(container.textContent).toContain('⏱️ Viabilidad hoy');
    expect(container.textContent).toContain('⏳ Duración');
    expect(container.textContent).toContain('⭐ Destacadas');
    expect(container.textContent).toContain('▸ Plegar todo');
    expect(container.textContent).toContain('▾ Desplegar todo');
    expect(container.textContent).toContain('⚡ Orden automático');
    expect(container.textContent).toContain('Hoy');
    expect(container.textContent).toContain('Próximos días');
  });

  it('renderiza la cabecera, grupos y botones de triaje en inglés cuando el locale es en', () => {
    setLocale('en');
    triageView.renderTriageView();
    const container = document.getElementById('view-triage');

    expect(container.textContent).toContain('← Board [X]');
    expect(container.textContent).toContain('⚡ Quick Triage');
    expect(container.textContent).toContain('🎯 Urgency');
    expect(container.textContent).toContain("⏱️ Today's viability");
    expect(container.textContent).toContain('⏳ Duration');
    expect(container.textContent).toContain('⭐ Featured');
    expect(container.textContent).toContain('▸ Collapse all');
    expect(container.textContent).toContain('▾ Expand all');
    expect(container.textContent).toContain('⚡ Auto-order');
    expect(container.textContent).toContain('Today');
    expect(container.textContent).toContain('Next few days');
    setLocale('es');
  });

  it('renderiza los estados vacíos y barras flotantes en inglés', () => {
    state.tasks = [];
    setLocale('en');
    triageView.renderTriageView();
    const container = document.getElementById('view-triage');

    expect(container.textContent).toContain('No pending tasks for this day!');
    expect(container.textContent).toContain('Back to board');
    setLocale('es');
  });

  it('renderiza el indicador de tarea recurrente con un solo icono y texto localizado', () => {
    state.tasks = [
      { id: 't-rec', title: 'Recurring Task', planned: 20, urgency: 'today', status: 'pending', ruleId: 10 }
    ];

    setLocale('es');
    triageView.renderTriageView();
    let recBtn = document.querySelector('.triage-recurring-btn');
    expect(recBtn).not.toBeNull();
    let icons = (recBtn.textContent.match(/🔁/g) || []).length;
    expect(icons).toBe(1);
    expect(recBtn.querySelector('.triage-recurring-label').textContent.trim()).toBe('Recurrente');

    setLocale('en');
    triageView.renderTriageView();
    recBtn = document.querySelector('.triage-recurring-btn');
    expect(recBtn).not.toBeNull();
    icons = (recBtn.textContent.match(/🔁/g) || []).length;
    expect(icons).toBe(1);
    expect(recBtn.querySelector('.triage-recurring-label').textContent.trim()).toBe('Recurring');

    setLocale('es');
  });
});
