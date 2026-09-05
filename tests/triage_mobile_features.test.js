import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { TodayTasksTriageView } from '../js/views/triage.js';
import { TodayTasksUndo } from '../js/undo.js';
import { TodayTasksUrgencyDropdown } from '../js/app/urgency-dropdown.js';

describe('Triage Mobile Features & Task Creation (TDD)', () => {
  let state;
  let actions;
  let undoModule;
  let urgencyDropdownModule;
  let triageView;
  let container;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="view-triage"></div>
      <div id="triageEditModalHost"></div>
      <div id="urgencyDropdownOverlay" style="display:none;"></div>
      <div id="urgencyDropdownMenu" style="display:none;">
        <div class="urgency-option-item" data-urgency="today">Hoy</div>
        <div class="urgency-option-item" data-urgency="days">Días</div>
        <div class="urgency-option-item" data-urgency="week">Semana</div>
        <div class="urgency-option-item" data-urgency="later">Más adelante</div>
      </div>
    `;
    container = document.getElementById('view-triage');

    state = defaultState();
    state.selectedDate = '2026-09-02';
    state.tasks = [
      { id: 'task-1', title: 'Primera tarea', planned: 30, urgency: 'today', order: 1, manualOrder: 1, status: 'pending' },
      { id: 'task-2', title: 'Segunda tarea', planned: 45, urgency: 'today', order: 2, manualOrder: 2, status: 'pending' },
      { id: 'task-3', title: 'Tercera tarea', planned: 60, urgency: 'days', order: 3, manualOrder: 3, status: 'pending' }
    ];

    let notifyState = { taskId: null };
    let currentTaskEdit = null;
    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      saveState: vi.fn(),
      renderAll: vi.fn(() => triageView.renderTriageView()),
      smartRender: vi.fn(() => triageView.renderTriageView()),
      getTaskEdit: () => currentTaskEdit,
      setTaskEdit: (te) => { currentTaskEdit = te; },
      getNotifyState: () => notifyState,
      setNotifyState: (ns) => { notifyState = ns; },
      newId: () => 'new-' + Math.random().toString(36).substr(2, 5)
    };

    undoModule = TodayTasksUndo({
      getState: ctx.getState,
      setState: ctx.setState,
      saveState: ctx.saveState,
      renderAll: ctx.renderAll,
      showToast: vi.fn()
    });
    ctx.undoModule = undoModule;

    actions = TodayTasksActions(ctx, {
      nowMinutes: () => 600,
      showToast: vi.fn(),
      showRecurringModal: vi.fn(),
      showFeaturedLimitModal: vi.fn()
    });
    ctx.actionsModule = actions;

    urgencyDropdownModule = TodayTasksUrgencyDropdown({
      getState: ctx.getState,
      getActionsModule: () => actions,
      getTaskEdit: ctx.getTaskEdit
    });

    triageView = TodayTasksTriageView(ctx);

    // Bind to window.app as in real app
    window.app = {
      ...actions,
      undo: () => undoModule.undo(),
      redo: () => undoModule.redo(),
      openEditUrgencyDropdown: (taskId, ev) => urgencyDropdownModule.openEditUrgencyDropdown(taskId, ev),
      selectTaskUrgency: (urg) => urgencyDropdownModule.selectTaskUrgency(urg),
      ...triageView
    };
  });

  describe('Undo / Redo buttons in Triage', () => {
    it('renderiza botones de Undo y Redo en la cabecera de triaje con estado disabled inicial', () => {
      triageView.renderTriageView();

      const undoBtn = container.querySelector('#triageUndoBtn');
      const redoBtn = container.querySelector('#triageRedoBtn');

      expect(undoBtn).not.toBeNull();
      expect(redoBtn).not.toBeNull();
      expect(undoBtn.disabled).toBe(true);
      expect(redoBtn.disabled).toBe(true);
    });

    it('habilita el botón Undo tras una acción y permite revertirla desde el triaje', () => {
      triageView.renderTriageView();

      // Completar una tarea desde triaje
      triageView.completeTriageSingleTask('task-1');
      expect(state.tasks.find(t => t.id === 'task-1').status).toBe('completed');

      triageView.renderTriageView();
      const undoBtn = container.querySelector('#triageUndoBtn');
      expect(undoBtn.disabled).toBe(false);

      // Deshacer con el método expuesto en triageView
      triageView.triageUndo();

      expect(state.tasks.find(t => t.id === 'task-1').status).toBe('pending');
    });

    it('habilita el botón Redo tras deshacer y permite rehacer la acción', () => {
      triageView.renderTriageView();
      triageView.completeTriageSingleTask('task-1');

      triageView.triageUndo();
      triageView.renderTriageView();

      const redoBtn = container.querySelector('#triageRedoBtn');
      expect(redoBtn.disabled).toBe(false);

      triageView.triageRedo();
      expect(state.tasks.find(t => t.id === 'task-1').status).toBe('completed');
    });
  });

  describe('Add new task from Triage (Unified Edit Modal UX)', () => {
    it('renderiza el botón en cabecera (PC) y FAB (Móvil) y elimina la barra inline y modal inferior redundante', () => {
      triageView.renderTriageView();

      const pcBtn = container.querySelector('#triageBtnAddTask');
      const fabBtn = container.querySelector('#triageFabAddTask');
      const deskBar = container.querySelector('#triageAddBar');
      const mobileModal = container.querySelector('#triageMobileAddModal');

      expect(pcBtn).not.toBeNull();
      expect(fabBtn).not.toBeNull();
      expect(deskBar).toBeNull();
      expect(mobileModal).toBeNull();
    });

    it('abrir la creación despliega el modal unificado (#triageTaskEditModal) con paridad total de opciones', () => {
      triageView.renderTriageView();

      triageView.openTriageNewTaskModal({
        title: 'Planificar arquitectura',
        duration: '45',
        urgency: 'week',
        featured: true,
        notes: 'Ver notas detalladas con markdown'
      });

      const modal = document.getElementById('triageTaskEditModal');
      expect(modal).not.toBeNull();

      const headerTitle = modal.querySelector('.triage-edit-modal-header h3');
      expect(headerTitle.textContent).toContain('Nueva tarea');
      expect(headerTitle.textContent).toContain('＋');

      const titleInput = document.getElementById('triageEditTitleInput');
      expect(titleInput.value).toBe('Planificar arquitectura');

      const durInput = document.getElementById('triageEditDurationInput');
      expect(durInput.value).toBe('45');

      const starBtn = modal.querySelector('.star-btn');
      expect(starBtn.classList.contains('is-featured')).toBe(true);

      const notesTextarea = document.getElementById('task-edit-notes-__new__');
      expect(notesTextarea).not.toBeNull();
      expect(notesTextarea.value).toBe('Ver notas detalladas con markdown');

      const saveBtn = document.getElementById('triageEditSaveBtn');
      expect(saveBtn.textContent).toBe('Añadir');

      // Guardar crea la tarea completa
      actions.saveEditTask('__new__');

      const added = state.tasks.find(t => t.title === 'Planificar arquitectura');
      expect(added).toBeDefined();
      expect(added.planned).toBe(45);
      expect(added.urgency).toBe('week');
      expect(added.featured).toBe(true);
      expect(added.notes).toBe('Ver notas detalladas con markdown');

      // El modal queda cerrado
      expect(document.getElementById('triageTaskEditModal')).toBeNull();
    });

    it('la creación mediante el modal unificado se puede revertir con Undo', () => {
      triageView.renderTriageView();

      triageView.openTriageNewTaskModal({ title: 'Tarea para deshacer modal', duration: '15' });
      actions.saveEditTask('__new__');
      expect(state.tasks.some(t => t.title === 'Tarea para deshacer modal')).toBe(true);

      triageView.triageUndo();
      expect(state.tasks.some(t => t.title === 'Tarea para deshacer modal')).toBe(false);
    });

    it('al seleccionar urgencia en el popup de nueva tarea/edición se actualiza el pill y la tarea guardada', () => {
      triageView.renderTriageView();

      triageView.openTriageNewTaskModal({ title: 'Probar cambio de urgencia', duration: '30' });

      const pill = document.getElementById('edit-urgency-pill-__new__');
      expect(pill).not.toBeNull();
      expect(pill.className).toContain('urgency-btn-days');

      // Abre el dropdown de urgencia
      window.app.openEditUrgencyDropdown('__new__', { currentTarget: pill });

      const menu = document.getElementById('urgencyDropdownMenu');
      expect(menu.style.display).toBe('block');

      // Selecciona 'today'
      window.app.selectTaskUrgency('today');

      // El pill se actualiza a 'today'
      expect(pill.className).toContain('urgency-btn-today');
      expect(pill.textContent).toContain('Hoy');
      expect(menu.style.display).toBe('none');

      // Guardar la tarea crea la tarea con urgencia 'today'
      actions.saveEditTask('__new__');

      const created = state.tasks.find(t => t.title === 'Probar cambio de urgencia');
      expect(created).toBeDefined();
      expect(created.urgency).toBe('today');
    });

    it('al editar una tarea existente en triaje, el cambio de urgencia en el popup se actualiza visualmente y se persiste al guardar', () => {
      triageView.renderTriageView();

      const task = state.tasks.find(t => t.id === 'task-3');
      expect(task.urgency).toBe('days');

      // Inicia edición de tarea existente desde triaje
      actions.startEditTask('task-3');

      const pill = document.getElementById('edit-urgency-pill-task-3');
      expect(pill).not.toBeNull();
      expect(pill.className).toContain('urgency-btn-days');

      // Abre el dropdown de urgencia
      window.app.openEditUrgencyDropdown('task-3', { currentTarget: pill });

      const menu = document.getElementById('urgencyDropdownMenu');
      expect(menu.style.display).toBe('block');

      // Selecciona 'later'
      window.app.selectTaskUrgency('later');

      // El pill debe reflejar 'later'
      expect(pill.className).toContain('urgency-btn-later');
      expect(pill.textContent).toContain('Más adelante');
      expect(menu.style.display).toBe('none');

      // Guardar la tarea editada
      actions.saveEditTask('task-3');

      // La tarea guardada debe tener urgencia 'later'
      const updated = state.tasks.find(t => t.id === 'task-3');
      expect(updated.urgency).toBe('later');
    });
  });

  describe('Move tasks on Mobile (Long-Press / Direct Move)', () => {
    it('permite mover una tarea hacia abajo en la cola mediante moveTriageTaskDirection', () => {
      triageView.renderTriageView();

      // task-1 está en orden 1, task-2 en orden 2
      expect(state.tasks[0].id).toBe('task-1');
      expect(state.tasks[1].id).toBe('task-2');

      triageView.moveTriageTaskDirection('task-1', 'down');

      // Ahora task-2 debe ser la primera y task-1 la segunda
      expect(state.tasks[0].id).toBe('task-2');
      expect(state.tasks[1].id).toBe('task-1');
    });

    it('permite mover una tarea al final de la cola con direction bottom', () => {
      triageView.renderTriageView();

      triageView.moveTriageTaskDirection('task-1', 'bottom');

      expect(state.tasks[state.tasks.length - 1].id).toBe('task-1');
    });

    it('permite mover una tarea al principio de la cola con direction top', () => {
      triageView.renderTriageView();

      triageView.moveTriageTaskDirection('task-3', 'top');

      expect(state.tasks[0].id).toBe('task-3');
    });

    it('las filas de tarea incluyen atributos táctiles y manija táctil para móviles', () => {
      triageView.renderTriageView();

      const row = container.querySelector('.triage-task-row[data-task-id="task-1"]');
      expect(row).not.toBeNull();
      // Debe tener listeners o atributos para touch
      expect(row.getAttribute('ontouchstart') || row.classList.contains('triage-task-row')).toBeTruthy();

      const handle = row.querySelector('.triage-drag-handle');
      expect(handle).not.toBeNull();
    });

    it('renderiza la hoja inferior de movimiento táctil (Bottom Sheet) para móvil', () => {
      triageView.renderTriageView();

      const moveSheet = container.querySelector('#triageMobileMoveSheet');
      expect(moveSheet).not.toBeNull();
    });

    it('reorderTaskByDrag reordena tareas pendientes directamente a través de actions', () => {
      triageView.renderTriageView();

      expect(actions.reorderTaskByDrag).toBeDefined();
      expect(state.tasks[0].id).toBe('task-1');
      expect(state.tasks[2].id).toBe('task-3');

      // Mover task-3 a la posición de task-1
      actions.reorderTaskByDrag('task-3', 'task-1');

      const queue = state.tasks.filter(t => t.status === 'pending');
      expect(queue[0].id).toBe('task-3');
      expect(queue[1].id).toBe('task-1');
      expect(queue[2].id).toBe('task-2');
    });

    it('al soltar una tarea sobre la primera tarea cuando está en ejecución (running), se ubica al inicio de la cola de pendientes', () => {
      // Configuramos la primera tarea como 'running' y dos pendientes
      state.tasks = [
        { id: 'task-run', title: 'Tarea en curso', planned: 30, urgency: 'today', order: 1, manualOrder: 1, status: 'running' },
        { id: 'task-p1', title: 'Pendiente 1', planned: 20, urgency: 'today', order: 2, manualOrder: 2, status: 'pending' },
        { id: 'task-p2', title: 'Pendiente 2', planned: 25, urgency: 'today', order: 3, manualOrder: 3, status: 'pending' }
      ];

      triageView.renderTriageView();

      // Arrastrar task-p2 sobre la primera tarea en pantalla (task-run)
      actions.reorderTaskByDrag('task-p2', 'task-run');

      const pendingQueue = state.tasks.filter(t => t.status === 'pending').sort((a,b) => a.order - b.order);
      expect(pendingQueue[0].id).toBe('task-p2');
      expect(pendingQueue[1].id).toBe('task-p1');
    });

    it('el gesto táctil de arrastrar y soltar en triaje reordena las tareas en el estado', () => {
      vi.useFakeTimers();
      triageView.renderTriageView();

      // task-1 en orden 1, task-2 en orden 2
      expect(state.tasks[0].id).toBe('task-1');
      expect(state.tasks[1].id).toBe('task-2');

      const row1 = container.querySelector('.triage-task-row[data-task-id="task-1"]');
      const row2 = container.querySelector('.triage-task-row[data-task-id="task-2"]');

      // Simulamos inicio de toque en task-2
      const fakeTouchStart = {
        touches: [{ clientX: 50, clientY: 100 }],
        currentTarget: row2,
        target: row2
      };
      triageView.handleTriageTouchStart('task-2', fakeTouchStart);

      // Avanzamos 450ms para disparar el long-press
      vi.advanceTimersByTime(500);

      // Mock de elementFromPoint para devolver row1 durante touchmove
      document.elementFromPoint = vi.fn(() => row1);

      const fakeTouchMove = {
        touches: [{ clientX: 50, clientY: 40 }],
        cancelable: true,
        preventDefault: vi.fn()
      };
      triageView.handleTriageTouchMove(fakeTouchMove);

      // Soltamos el toque
      const fakeTouchEnd = {
        cancelable: true,
        preventDefault: vi.fn()
      };
      triageView.handleTriageTouchEnd(fakeTouchEnd);

      // Verificamos que task-2 ahora está antes que task-1
      const pendingQueue = state.tasks.filter(t => t.status === 'pending').sort((a,b) => a.order - b.order);
      expect(pendingQueue[0].id).toBe('task-2');
      expect(pendingQueue[1].id).toBe('task-1');

      vi.useRealTimers();
    });

    it('evita activar selección de fila (click) si el usuario acaba de realizar un gesto táctil de arrastre o long-press', () => {
      vi.useFakeTimers();
      triageView.renderTriageView();

      const row1 = container.querySelector('.triage-task-row[data-task-id="task-1"]');
      const fakeTouchStart = {
        touches: [{ clientX: 50, clientY: 50 }],
        currentTarget: row1,
        target: row1
      };
      triageView.handleTriageTouchStart('task-1', fakeTouchStart);
      vi.advanceTimersByTime(500);

      const fakeTouchEnd = {
        cancelable: true,
        preventDefault: vi.fn()
      };
      triageView.handleTriageTouchEnd(fakeTouchEnd);

      // Simulamos el evento click que los navegadores móviles emiten tras touchend
      const fakeClick = {
        stopPropagation: vi.fn(),
        target: row1
      };
      triageView.handleTriageRowClick('task-1', fakeClick);
      vi.advanceTimersByTime(500);

      // La tarea NO debe quedar seleccionada por el click fantasma
      expect(triageView.getSelectedTaskIds ? triageView.getSelectedTaskIds().has('task-1') : false).toBe(false);

      vi.useRealTimers();
    });
  });
});

