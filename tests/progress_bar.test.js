import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksViews } from '../js/views.js';

describe('Task Progress Bar - Dashboard Header', () => {
  let state;
  let views;

  beforeEach(() => {
    document.body.innerHTML = '<div id="taskProgressContainer"></div>';
    state = defaultState();
    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      getTaskEdit: () => null,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      computeSchedule: () => null,
      fmtMMSS: () => '',
      RING_R: 80,
      RING_C: 502
    };
    views = TodayTasksViews(ctx);
  });

  it('renderiza barra vacia con clases de diseno correctas cuando no hay tareas', () => {
    state.tasks = [];
    views.renderTaskProgressBar();

    const container = document.getElementById('taskProgressContainer');
    expect(container.querySelector('.progress-banner')).not.toBeNull();
    expect(container.querySelector('.progress-track.empty-track')).not.toBeNull();
    expect(container.querySelector('.empty-track-text').textContent).toContain('No hay tareas creadas');
    expect(container.querySelector('.progress-total-badge').textContent).toContain('0');
    expect(container.querySelectorAll('.legend-item.leg-completed .dot')).toHaveLength(1);
    expect(container.querySelectorAll('.legend-item.leg-running .dot')).toHaveLength(1);
    expect(container.querySelectorAll('.legend-item.leg-paused .dot')).toHaveLength(1);
    expect(container.querySelectorAll('.legend-item.leg-pending .dot')).toHaveLength(1);
  });

  it('renderiza segmentos de progreso proporcionales y leyenda con clases de estilo', () => {
    state.tasks = [
      { id: 1, title: 'T1', planned: 30, status: 'completed', actualDuration: 30 },
      { id: 2, title: 'T2', planned: 30, status: 'running', runningStart: 540 },
      { id: 3, title: 'T3', planned: 30, status: 'paused', elapsedBefore: 15 },
      { id: 4, title: 'T4', planned: 30, status: 'pending', elapsedBefore: 0 }
    ];
    views.renderTaskProgressBar();

    const container = document.getElementById('taskProgressContainer');
    expect(container.querySelector('.progress-track')).not.toBeNull();
    expect(container.querySelector('.progress-seg.seg-completed')).not.toBeNull();
    expect(container.querySelector('.progress-seg.seg-running')).not.toBeNull();
    expect(container.querySelector('.progress-seg.seg-paused')).not.toBeNull();
    expect(container.querySelector('.progress-seg.seg-pending')).not.toBeNull();
    expect(container.querySelector('.progress-total-badge').textContent).toContain('4');
  });
});
