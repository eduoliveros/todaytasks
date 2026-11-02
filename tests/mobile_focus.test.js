import { describe, it, expect, beforeEach } from 'vitest';
import { TodayTasksTaskDetailSheet } from '../js/app/task-detail-sheet.js';
import { defaultState } from '../js/state.js';
import fs from 'fs';
import path from 'path';

describe('Acceso a Modo Focus en Móvil (Combo 1 + 2)', () => {
  let state;
  let detailSheet;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="taskDetailSheet" class="task-detail-bottom-modal" style="display:none;">
        <div class="task-detail-bottom-card">
          <div class="task-detail-sheet-header">
            <h3 id="taskDetailSheetTitle"></h3>
            <button type="button" class="close-modal-btn" onclick="app.closeTaskDetailSheet()">&times;</button>
          </div>
          <div id="taskDetailSheetMeta"></div>
          <div id="taskDetailSheetNotes" style="display:none;"></div>
          <div id="taskDetailSheetDeps" style="display:none;"></div>
          <div id="taskDetailSheetActions" class="task-detail-actions-grid"></div>
          <div id="taskDetailSheetPosition" class="task-detail-section" style="display:none;"></div>
          <div id="taskDetailSheetReschedule" class="task-detail-section" style="display:none;"></div>
        </div>
      </div>
    `;

    state = defaultState();
    window.location.hash = '';

    window.app = {
      taskDetailSheetAction: (act) => detailSheet.handleAction(act)
    };

    const ctx = {
      getState: () => state
    };

    detailSheet = TodayTasksTaskDetailSheet(ctx);
  });

  it('el Bottom Sheet incluye el botón de Modo Enfoque en tareas en ejecución (running)', () => {
    state.tasks = [
      { id: 't-run-1', title: 'Tarea en marcha', planned: 30, status: 'running', runningStart: 500 }
    ];

    detailSheet.openTaskDetailSheet('t-run-1');
    const actionsEl = document.getElementById('taskDetailSheetActions');
    expect(actionsEl.innerHTML).toContain('task-detail-btn-focus');
    expect(actionsEl.innerHTML).toContain("app.taskDetailSheetAction('focus')");
  });

  it('el Bottom Sheet incluye el botón de Modo Enfoque en tareas pausadas (paused)', () => {
    state.tasks = [
      { id: 't-pause-1', title: 'Tarea pausada', planned: 30, status: 'paused' }
    ];

    detailSheet.openTaskDetailSheet('t-pause-1');
    const actionsEl = document.getElementById('taskDetailSheetActions');
    expect(actionsEl.innerHTML).toContain('task-detail-btn-focus');
    expect(actionsEl.innerHTML).toContain("app.taskDetailSheetAction('focus')");
  });

  it('ejecutar la acción focus cierra el Bottom Sheet y navega a #/task/:id', () => {
    state.tasks = [
      { id: 't-run-2', title: 'Tarea para enfocar', planned: 25, status: 'running', runningStart: 520 }
    ];

    detailSheet.openTaskDetailSheet('t-run-2');
    const sheet = document.getElementById('taskDetailSheet');
    expect(sheet.style.display).toBe('flex');

    detailSheet.handleAction('focus');

    expect(sheet.style.display).toBe('none');
    expect(window.location.hash).toBe('#/task/t-run-2');
  });

  it('layout.css define estilos para el botón directo compacto (.task-compact-focus-btn) y el botón de bottom sheet (.task-detail-btn-focus)', () => {
    const layoutPath = path.resolve(__dirname, '../css/layout.css');
    const css = fs.readFileSync(layoutPath, 'utf-8');

    expect(css).toMatch(/\.task-compact-focus-btn\s*\{[^}]*display:\s*none/i);
    expect(css).toMatch(/\.task-item\.running\s+\.task-compact-focus-btn\s*\{[^}]*display:\s*inline-flex/i);
    expect(css).toMatch(/\.task-detail-btn-focus\s*\{[^}]*grid-column:\s*span\s*2/i);
  });
});
