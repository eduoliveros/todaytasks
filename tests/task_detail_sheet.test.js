import { describe, it, expect, beforeEach } from 'vitest';
import { TodayTasksTaskDetailSheet } from '../js/app/task-detail-sheet.js';
import { defaultState } from '../js/state.js';
import fs from 'fs';
import path from 'path';

describe('Task Detail Bottom Sheet - Móvil (Fase 2)', () => {
  let state;
  let detailSheet;
  let startedTask = null;
  let completedTask = null;
  let pausedTask = null;
  let editedTask = null;
  let deletedTask = null;

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
    startedTask = null;
    completedTask = null;
    pausedTask = null;
    editedTask = null;
    deletedTask = null;

    window.app = {
      startTask: (id) => { startedTask = id; },
      completeTask: (id) => { completedTask = id; },
      pauseTask: (id) => { pausedTask = id; },
      resumeTask: (id) => { startedTask = id; },
      startEditTask: (id) => { editedTask = id; },
      deleteTask: (id) => { deletedTask = id; },
      copyTaskReference: (id) => {},
      toggleTaskFeatured: (id) => {}
    };

    const ctx = {
      getState: () => state
    };

    detailSheet = TodayTasksTaskDetailSheet(ctx);
  });

  it('abre el bottom sheet con la información completa de la tarea', () => {
    state.tasks = [
      {
        id: 't-1',
        displayId: 'W-1',
        title: 'Revisar PR #frontend',
        planned: 45,
        elapsedBefore: 15,
        status: 'pending',
        urgency: 'today',
        notes: '**Importante**: revisar tests'
      }
    ];

    detailSheet.openTaskDetailSheet('t-1');

    const sheet = document.getElementById('taskDetailSheet');
    expect(sheet.style.display).toBe('flex');

    const titleEl = document.getElementById('taskDetailSheetTitle');
    expect(titleEl.textContent).toContain('W-1');
    expect(titleEl.textContent).toContain('Revisar PR');

    const metaEl = document.getElementById('taskDetailSheetMeta');
    expect(metaEl.textContent).toContain('Hoy');
    expect(metaEl.textContent).toContain('45 min');
    expect(metaEl.textContent).toContain('15 min');

    const notesEl = document.getElementById('taskDetailSheetNotes');
    expect(notesEl.style.display).toBe('block');
    expect(notesEl.innerHTML).toContain('<strong>Importante</strong>');

    const actionsEl = document.getElementById('taskDetailSheetActions');
    expect(actionsEl.innerHTML).toContain('app.taskDetailSheetAction(\'start\')');
    expect(actionsEl.innerHTML).toContain('app.taskDetailSheetAction(\'complete\')');
    expect(actionsEl.innerHTML).toContain('app.taskDetailSheetAction(\'edit\')');
    expect(actionsEl.innerHTML).toContain('app.taskDetailSheetAction(\'delete\')');
  });

  it('ejecuta la acción "start" y cierra el bottom sheet', () => {
    state.tasks = [
      { id: 't-2', displayId: 'W-2', title: 'Tarea para iniciar', planned: 30, status: 'pending' }
    ];

    detailSheet.openTaskDetailSheet('t-2');
    expect(detailSheet.getActiveTaskId()).toBe('t-2');

    detailSheet.handleAction('start');

    expect(startedTask).toBe('t-2');
    expect(detailSheet.getActiveTaskId()).toBeNull();
    const sheet = document.getElementById('taskDetailSheet');
    expect(sheet.style.display).toBe('none');
  });

  it('renderiza botón pausar en tarea en curso y reanudar en tarea pausada', () => {
    state.tasks = [
      { id: 't-running', displayId: 'W-3', title: 'Corriendo', planned: 30, status: 'running', runningStart: 600 }
    ];

    detailSheet.openTaskDetailSheet('t-running');
    let actionsEl = document.getElementById('taskDetailSheetActions');
    expect(actionsEl.innerHTML).toContain('app.taskDetailSheetAction(\'pause\')');

    state.tasks = [
      { id: 't-paused', displayId: 'W-4', title: 'Pausada', planned: 30, status: 'paused' }
    ];

    detailSheet.openTaskDetailSheet('t-paused');
    actionsEl = document.getElementById('taskDetailSheetActions');
    expect(actionsEl.innerHTML).toContain('app.taskDetailSheetAction(\'resume\')');
  });

  it('permite cerrar el bottom sheet manualmente', () => {
    state.tasks = [
      { id: 't-5', title: 'Cerrar sheet', planned: 20, status: 'pending' }
    ];

    detailSheet.openTaskDetailSheet('t-5');
    const sheet = document.getElementById('taskDetailSheet');
    expect(sheet.style.display).toBe('flex');

    detailSheet.closeTaskDetailSheet();
    expect(sheet.style.display).toBe('none');
    expect(detailSheet.getActiveTaskId()).toBeNull();
  });

  it('no muestra el badge "Pendiente" al lado de la urgencia en tareas pendientes', () => {
    state.tasks = [
      { id: 't-pending', title: 'Tarea normal', planned: 30, status: 'pending', urgency: 'days' }
    ];

    detailSheet.openTaskDetailSheet('t-pending');
    const metaEl = document.getElementById('taskDetailSheetMeta');

    // No debe contener el texto ni badge de Pendiente
    expect(metaEl.querySelector('.status-badge')).toBeNull();
    expect(metaEl.textContent).not.toContain('Pendiente');
  });

  it('muestra el badge de estado cuando la tarea está en marcha o pausada o completada', () => {
    state.tasks = [
      { id: 't-run', title: 'Tarea en curso', planned: 30, status: 'running', runningStart: 600, urgency: 'today' },
      { id: 't-done', title: 'Tarea completada', planned: 20, status: 'completed', completedAt: 630, urgency: 'week' }
    ];

    detailSheet.openTaskDetailSheet('t-run');
    let metaEl = document.getElementById('taskDetailSheetMeta');
    let badge = metaEl.querySelector('.status-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('en curso');

    detailSheet.openTaskDetailSheet('t-done');
    metaEl = document.getElementById('taskDetailSheetMeta');
    badge = metaEl.querySelector('.status-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Completada');
  });

  it('renderiza la píldora de urgencia como botón interactivo con dropdown y chevron', () => {
    state.tasks = [
      { id: 't-urg', title: 'Tarea urgente', planned: 30, status: 'pending', urgency: 'today' }
    ];

    detailSheet.openTaskDetailSheet('t-urg');
    const metaEl = document.getElementById('taskDetailSheetMeta');
    const urgencyBtn = metaEl.querySelector('button.urgency-pill-btn');

    expect(urgencyBtn).not.toBeNull();
    expect(urgencyBtn.getAttribute('onclick')).toContain("app.openUrgencyDropdown('t-urg', event)");
    expect(urgencyBtn.querySelector('.urgency-pill-chevron')).not.toBeNull();
    expect(urgencyBtn.querySelector('.urgency-pill-chevron').textContent).toBe('▾');
    expect(urgencyBtn.textContent).toContain('Hoy');
  });

  it('actualiza la píldora de urgencia al refrescar el bottom sheet abierto con refreshIfOpen', () => {
    state.tasks = [
      { id: 't-refresh', title: 'Cambiar urgencia', planned: 30, status: 'pending', urgency: 'days' }
    ];

    detailSheet.openTaskDetailSheet('t-refresh');
    let metaEl = document.getElementById('taskDetailSheetMeta');
    let urgencyBtn = metaEl.querySelector('button.urgency-pill-btn');
    expect(urgencyBtn.textContent).toContain('Días');

    // Cambiar urgencia en estado y refrescar
    state.tasks[0].urgency = 'today';
    detailSheet.refreshIfOpen();

    metaEl = document.getElementById('taskDetailSheetMeta');
    urgencyBtn = metaEl.querySelector('button.urgency-pill-btn');
    expect(urgencyBtn.textContent).toContain('Hoy');
  });

  it('css/layout.css define touch-action: manipulation en la tarjeta y botones de posición para evitar zoom', () => {
    const cssPath = path.resolve(__dirname, '../css/layout.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('.task-detail-bottom-card');
    expect(cssContent).toContain('.task-detail-position-grid');
    expect(cssContent).toContain('.task-detail-grid-btn');
    expect(cssContent).toMatch(/\.task-detail-grid-btn[\s\S]*?touch-action:\s*manipulation/);
    expect(cssContent).toMatch(/\.task-detail-bottom-card[\s\S]*?touch-action:\s*manipulation/);
  });

  it('preserva los elementos DOM de los botones de posición al mover de forma sucesiva sin recrear el HTML', () => {
    state.tasks = [
      { id: 't-move-1', title: 'Tarea a reordenar', planned: 30, status: 'pending', urgency: 'today' },
      { id: 't-move-2', title: 'Otra tarea', planned: 30, status: 'pending', urgency: 'today' }
    ];

    window.app.moveTaskDirectly = (id, dir) => {
      // Simula intercambio y llamada a refresh
      const temp = state.tasks[0];
      state.tasks[0] = state.tasks[1];
      state.tasks[1] = temp;
      detailSheet.refreshIfOpen();
    };

    detailSheet.openTaskDetailSheet('t-move-1');
    const positionEl = document.getElementById('taskDetailSheetPosition');
    const upBtnBefore = positionEl.querySelectorAll('.task-detail-grid-btn')[1];
    expect(upBtnBefore).not.toBeUndefined();
    expect(upBtnBefore.textContent).toContain('Subir en la cola');
    expect(upBtnBefore.getAttribute('ondblclick')).toBe('event.preventDefault()');

    // Ejecutar movimiento rápido hacia arriba
    detailSheet.handleMove('up');

    const upBtnAfter = positionEl.querySelectorAll('.task-detail-grid-btn')[1];
    // Debe ser exactamente la misma instancia del elemento DOM para evitar romper el flujo táctil del navegador
    expect(upBtnAfter).toBe(upBtnBefore);
  });
});
