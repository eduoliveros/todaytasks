import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { TodayTasksTriageView } from '../js/views/triage.js';
import { TodayTasksTaskDetailSheet } from '../js/app/task-detail-sheet.js';
import { getTodayStr } from '../js/utils.js';
import fs from 'fs';
import path from 'path';

describe('Triage Mobile Compact View & Detail Sheet Integration (Fase 3)', () => {
  let state;
  let actions;
  let triageView;
  let detailSheetModule;
  let container;
  let openedDetailTaskId = null;
  let movedDirection = null;
  let rescheduledDate = null;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-triage"></div>
      <div id="triageEditModalHost"></div>
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
    container = document.getElementById('view-triage');

    state = defaultState();
    state.selectedDate = getTodayStr();
    state.tasks = [
      { id: 'task-1', title: 'Primera tarea de triaje', planned: 30, urgency: 'today', order: 1, manualOrder: 1, status: 'pending' },
      { id: 'task-2', title: 'Segunda tarea de triaje', planned: 45, urgency: 'today', order: 2, manualOrder: 2, status: 'pending' },
      { id: 'task-3', title: 'Tercera tarea de triaje', planned: 60, urgency: 'days', order: 3, manualOrder: 3, status: 'running' }
    ];

    openedDetailTaskId = null;
    movedDirection = null;
    rescheduledDate = null;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      saveState: vi.fn(),
      renderAll: vi.fn(() => triageView.renderTriageView()),
      smartRender: vi.fn(() => triageView.renderTriageView()),
      getTaskEdit: () => null,
      setTaskEdit: vi.fn(),
      newId: () => 'new-id'
    };

    actions = TodayTasksActions(ctx, {
      nowMinutes: () => 600,
      showToast: vi.fn()
    });
    ctx.actionsModule = actions;

    detailSheetModule = TodayTasksTaskDetailSheet(ctx);
    ctx.taskDetailSheetModule = detailSheetModule;

    triageView = TodayTasksTriageView(ctx);

    window.app = {
      ...actions,
      ...triageView,
      openTaskDetailSheet: (id) => {
        openedDetailTaskId = id;
        detailSheetModule.openTaskDetailSheet(id);
      },
      closeTaskDetailSheet: () => detailSheetModule.closeTaskDetailSheet(),
      taskDetailSheetAction: (act) => detailSheetModule.handleAction(act),
      taskDetailSheetMove: (dir) => {
        movedDirection = dir;
        detailSheetModule.handleMove(dir);
      },
      taskDetailSheetReschedule: (date) => {
        rescheduledDate = date;
        detailSheetModule.handleReschedule(date);
      },
      moveTaskDirectly: vi.fn((id, dir) => { movedDirection = dir; }),
      moveTaskToDate: vi.fn((id, d) => { rescheduledDate = d; })
    };
  });

  describe('Interacción de filas en móvil vs desktop', () => {
    it('en móvil (<= 640px), hacer tap en la fila NO marca/selecciona la tarea, sino que abre el bottom sheet de detalle', () => {
      // Mock de viewport móvil
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 640px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      triageView.renderTriageView();

      const row = container.querySelector('.triage-task-row[data-task-id="task-1"]');
      const titleEl = row.querySelector('.triage-task-title');

      // Simulamos clic en el texto/cuerpo de la tarea
      const fakeEvent = {
        stopPropagation: vi.fn(),
        target: titleEl,
        currentTarget: row
      };

      triageView.handleTriageRowClick('task-1', fakeEvent);

      // La tarea NO debe ser marcada/seleccionada
      expect(triageView.getSelectedTaskIds().has('task-1')).toBe(false);

      // Debe haber abierto el Bottom Sheet de detalle
      expect(openedDetailTaskId).toBe('task-1');
      const sheet = document.getElementById('taskDetailSheet');
      expect(sheet.style.display).toBe('flex');
    });

    it('en móvil (<= 640px), hacer tap en el checkbox .triage-task-cb SÍ marca y desmarca la tarea', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 640px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      triageView.renderTriageView();

      expect(triageView.getSelectedTaskIds().has('task-1')).toBe(false);

      // Pulsar el checkbox explícito
      triageView.toggleTriageTaskSelect('task-1');
      expect(triageView.getSelectedTaskIds().has('task-1')).toBe(true);

      // Volver a pulsar desmarca
      triageView.toggleTriageTaskSelect('task-1');
      expect(triageView.getSelectedTaskIds().has('task-1')).toBe(false);
    });

    it('en móvil (<= 640px), pulsar el área táctil extendida alrededor del checkbox (.triage-cb-wrap) NO abre el bottom sheet y está protegida', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 640px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      triageView.renderTriageView();

      const row = container.querySelector('.triage-task-row[data-task-id="task-1"]');
      const wrap = row.querySelector('.triage-cb-wrap');
      expect(wrap).not.toBeNull();
      expect(wrap.querySelector('.triage-task-cb')).not.toBeNull();

      // Simulamos clic en el wrapper del checkbox (área extendida alrededor)
      const fakeEvent = {
        stopPropagation: vi.fn(),
        target: wrap,
        currentTarget: row
      };

      triageView.handleTriageRowClick('task-1', fakeEvent);

      // NO debe haber abierto el Bottom Sheet de detalle al tocar el área del checkbox
      expect(openedDetailTaskId).toBeNull();
      const sheet = document.getElementById('taskDetailSheet');
      expect(sheet.style.display).toBe('none');
    });

    it('en desktop (> 640px), pulsar la fila mantiene el comportamiento original de selección tras temporizador', () => {
      vi.useFakeTimers();

      // Mock de viewport desktop
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      triageView.renderTriageView();

      const row = container.querySelector('.triage-task-row[data-task-id="task-1"]');
      const fakeEvent = {
        stopPropagation: vi.fn(),
        target: row,
        currentTarget: row
      };

      triageView.handleTriageRowClick('task-1', fakeEvent);

      // Antes del timer no está seleccionada
      expect(triageView.getSelectedTaskIds().has('task-1')).toBe(false);

      // Avanzamos el timer de 400ms de selección desktop
      vi.advanceTimersByTime(450);

      // En desktop, la tarea sí queda seleccionada
      expect(triageView.getSelectedTaskIds().has('task-1')).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Secciones de Posición y Reprogramar en Bottom Sheet', () => {
    it('muestra controles de posición para tareas pendientes y permite mover arriba/abajo/inicio/fin', () => {
      detailSheetModule.openTaskDetailSheet('task-1');

      const posSection = document.getElementById('taskDetailSheetPosition');
      expect(posSection.style.display).toBe('block');

      const buttons = posSection.querySelectorAll('.task-detail-grid-btn');
      expect(buttons.length).toBe(4);

      // Los botones no tienen segundo emoji redundante antes del texto
      expect(buttons[0].textContent).toBe('⤒ Al principio del día');
      expect(buttons[1].textContent).toBe('▲ Subir en la cola');
      expect(buttons[2].textContent).toBe('▼ Bajar en la cola');
      expect(buttons[3].textContent).toBe('⤓ Al final de la jornada');

      // Ejecutar movimiento
      detailSheetModule.handleMove('up');
      expect(window.app.moveTaskDirectly).toHaveBeenCalledWith('task-1', 'up');
    });

    it('muestra aviso de tarea en ejecución cuando la tarea está en estado running', () => {
      detailSheetModule.openTaskDetailSheet('task-3');

      const posSection = document.getElementById('taskDetailSheetPosition');
      expect(posSection.style.display).toBe('block');
      expect(posSection.querySelector('.task-detail-running-notice')).not.toBeNull();
      // No debe mostrar botones de movimiento libre mientras corre
      expect(posSection.querySelectorAll('.task-detail-grid-btn').length).toBe(0);
    });

    it('muestra la versión compacta de 5 días hábiles laborables en el bottom sheet (igual que en desktop) y permite mover de fecha', () => {
      detailSheetModule.openTaskDetailSheet('task-1');

      const reschedSection = document.getElementById('taskDetailSheetReschedule');
      expect(reschedSection.style.display).toBe('block');

      const chips = reschedSection.querySelectorAll('.task-detail-date-chip');
      expect(chips.length).toBe(5);

      // Cada botón usa el formato compacto como en desktop (ej. "L 21")
      chips.forEach(chip => {
        expect(chip.textContent.trim()).toMatch(/^[A-Z]\s+\d+$/i);
      });

      // Reprogramar tarea
      const targetDate = '2026-09-25';
      detailSheetModule.handleReschedule(targetDate);

      expect(window.app.moveTaskToDate).toHaveBeenCalledWith('task-1', targetDate);
      // El sheet se cierra al reprogramar
      expect(document.getElementById('taskDetailSheet').style.display).toBe('none');
    });
  });

  describe('Reglas CSS de compactación para triaje', () => {
    it('css/triage.css oculta en móvil (max-width: 640px) todo salvo checkbox, ID y título', () => {
      const cssPath = path.resolve(__dirname, '../css/triage.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).toContain('@media (max-width: 640px)');
      expect(cssContent).toContain('.triage-task-right');
      expect(cssContent).toContain('.triage-task-duration');
      expect(cssContent).toContain('.task-dep-badge');
      expect(cssContent).toContain('.triage-drag-handle');
      expect(cssContent).toContain('.triage-star-btn');
      expect(cssContent).toContain('.triage-task-time');
      expect(cssContent).toContain('.triage-task-cb');
      expect(cssContent).toContain('.triage-cb-wrap');
      expect(cssContent).toContain('.task-id-badge');
      expect(cssContent).toContain('.triage-task-title');
    });

    it('añade la clase has-floating-bar al contenedor al seleccionar tareas para evitar que la barra tape las últimas tareas', () => {
      triageView.renderTriageView();
      expect(container.classList.contains('has-floating-bar')).toBe(false);

      const inner = container.querySelector('.triage-view-inner');
      expect(inner.classList.contains('has-floating-bar')).toBe(false);

      // Seleccionar una tarea
      triageView.toggleTriageTaskSelect('task-1');
      expect(container.classList.contains('has-floating-bar')).toBe(true);
      expect(inner.classList.contains('has-floating-bar')).toBe(true);

      // Deseleccionar
      triageView.clearTriageSelection();
      expect(container.classList.contains('has-floating-bar')).toBe(false);
      expect(inner.classList.contains('has-floating-bar')).toBe(false);
    });

    it('css/triage.css define padding-bottom extendido cuando la barra flotante está visible', () => {
      const cssPath = path.resolve(__dirname, '../css/triage.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).toContain('#view-triage.has-floating-bar');
      expect(cssContent).toContain('#view-triage:has(.triage-floating-bar.visible)');
      expect(cssContent).toContain('padding-bottom: 210px');
      expect(cssContent).toContain('padding-bottom: 230px');
    });

    it('los botones de navegación de triaje (#triageViewBtn y .triage-btn-back) tienen estilos de alta visibilidad primaria', () => {
      const cssPath = path.resolve(__dirname, '../css/triage.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).toContain('#triageViewBtn');
      expect(cssContent).toContain('.triage-btn-back');
      expect(cssContent).toContain('var(--primary, #4F46E5)');

      triageView.renderTriageView();
      const backBtn = container.querySelector('.triage-btn-back');
      expect(backBtn).not.toBeNull();
      expect(backBtn.classList.contains('primary')).toBe(true);
    });

    it('css/triage.css oculta el contador de tareas del título y de las cabeceras de grupo en móvil', () => {
      const cssPath = path.resolve(__dirname, '../css/triage.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      // Extraer bloques @media (max-width: 640px)
      const mobileMediaMatches = cssContent.match(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\n\}/g);
      expect(mobileMediaMatches).not.toBeNull();
      const combinedRules = mobileMediaMatches.join('\n');
      expect(combinedRules).toContain('.triage-badge-count');
      expect(combinedRules).toContain('.triage-group-badge');
    });
  });
});
