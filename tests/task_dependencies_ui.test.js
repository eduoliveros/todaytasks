import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { TodayTasksForms } from '../js/app/forms.js';
import { TodayTasksDependencies } from '../js/app/dependencies.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';
import { TodayTasksTriageView } from '../js/views/triage.js';
import { TodayTasksShortcuts } from '../js/app/shortcuts.js';

describe('Task Dependencies UI & Views (Parity in Main Form and Triage)', () => {
  let state;
  let actions;
  let dependenciesModule;
  let formsModule;
  let tasksView;
  let triageView;
  let currentTaskEdit = null;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="taskAdvancedIndicators">
        <span id="formAutoMoveBadge" style="display:none;"></span>
        <span id="formRecurringBadge" style="display:none;"></span>
        <span id="formDependenciesBadge" style="display:none;">🔒</span>
        <span id="formNotesBadge" style="display:none;"></span>
        <span id="formStartAfterBadge" style="display:none;"></span>
      </div>
      <div id="taskAdvancedOptionsWrap">
        <div id="autoMoveTaskOptionWrap">
          <input type="checkbox" id="isAutoMoveTaskCheckbox" checked>
        </div>
        <input type="checkbox" id="isRecurringTaskCheckbox">
        <div id="recurringTaskFormOptions" style="display:none;"></div>
        <input type="time" id="taskStartAfterInput">
        <textarea id="taskNotesInput"></textarea>
        <div class="task-form-dependencies-row">
          <button type="button" id="btnAddFormDependency">＋ Añadir dependencia...</button>
          <div id="formTaskDependenciesList"></div>
        </div>
      </div>
      <input type="text" id="taskTitle">
      <input type="text" id="taskDuration" value="30">
      <input type="hidden" id="taskUrgencySelect" value="days">
      <input type="hidden" id="isFeaturedTaskCheckbox" value="false">
      <button id="addTaskBtn">Añadir</button>

      <div id="tasksList"></div>
      <div id="view-triage"></div>
      <div id="triageEditModalHost"></div>

      <!-- Modales de dependencias -->
      <div id="dependencySelectorModal" style="display:none;">
        <input type="text" id="dependencySelectorSearchInput">
        <div id="dependencySelectorList"></div>
      </div>
      <div id="blockedTaskConfirmModal" style="display:none;">
        <div id="blockedConfirmDetails"></div>
        <button id="btnJumpToBlockingTask"></button>
        <button id="btnForceStartBlockedTask"></button>
        <button id="btnCancelBlockedStart"></button>
      </div>
    `;

    state = defaultState();
    state.activeEnv = 'work';
    state.selectedDate = '2026-09-02';

    // Dos tareas en today
    const task1 = {
      id: 'task-1',
      displayId: 'W-1',
      title: 'Crear maqueta',
      planned: 30,
      status: 'pending',
      order: 1,
      urgency: 'days',
      dependsOn: []
    };
    const task2 = {
      id: 'task-2',
      displayId: 'W-2',
      title: 'Programar componentes',
      planned: 60,
      status: 'pending',
      order: 2,
      urgency: 'days',
      dependsOn: ['task-1'] // Depende de task-1
    };
    state.environments.work.days['2026-09-02'] = {
      tasks: [task1, task2],
      meetings: []
    };
    state.tasks = [task1, task2];

    currentTaskEdit = null;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      saveState: vi.fn(),
      renderAll: vi.fn(() => {
        if (tasksView) tasksView.renderTasks({ overflowIds: new Set(), segmentsByTask: {} });
        if (triageView) triageView.renderTriageView();
      }),
      smartRender: vi.fn(() => {
        if (tasksView) tasksView.renderTasks({ overflowIds: new Set(), segmentsByTask: {} });
        if (triageView) triageView.renderTriageView();
      }),
      getTaskEdit: () => currentTaskEdit,
      setTaskEdit: (te) => { currentTaskEdit = te; },
      newId: () => 'task-' + Math.random().toString(36).substr(2, 6)
    };

    actions = TodayTasksActions(ctx, {
      nowMinutes: () => 540,
      showToast: vi.fn(),
      showRecurringModal: vi.fn(),
      showFeaturedLimitModal: vi.fn()
    });
    ctx.actionsModule = actions;

    dependenciesModule = TodayTasksDependencies({
      getState: ctx.getState,
      actionsModule: actions,
      showToast: vi.fn(),
      renderAll: ctx.renderAll,
      getTaskEdit: ctx.getTaskEdit,
      goToTask: vi.fn(),
      updateTaskAdvancedIndicators: () => formsModule && formsModule.updateTaskAdvancedIndicators()
    });
    ctx.dependenciesModule = dependenciesModule;

    formsModule = TodayTasksForms({
      getState: ctx.getState,
      actionsModule: actions,
      showToast: vi.fn(),
      fmt: (m) => String(m),
      timeToMinutes: () => 0,
      dependenciesModule,
      renderAll: ctx.renderAll,
      renderTasks: ctx.renderAll
    });
    ctx.formsModule = formsModule;

    tasksView = TodayTasksTasksView(ctx);
    triageView = TodayTasksTriageView(ctx);

    window.app = {
      openDependencySelector: dependenciesModule.openDependencySelector,
      closeDependencySelector: dependenciesModule.closeDependencySelector,
      selectDependency: dependenciesModule.selectDependency,
      addFormDependency: dependenciesModule.addFormDependency,
      removeFormDependency: dependenciesModule.removeFormDependency,
      removeEditTaskDependency: actions.removeEditTaskDependency,
      addEditTaskDependency: actions.addEditTaskDependency,
      startEditTask: actions.startEditTask,
      saveEditTask: actions.saveEditTask,
      cancelEditTask: actions.cancelEditTask,
      goToTask: vi.fn(),
      startTask: actions.startTask
    };

    TodayTasksShortcuts(ctx);
  });

  describe('1. Main Task Form Dependencies', () => {
    it('añade y elimina dependencias en el formulario de creación', () => {
      dependenciesModule.addFormDependency('task-1');
      expect(dependenciesModule.getFormDependencies()).toEqual(['task-1']);

      const badge = document.getElementById('formDependenciesBadge');
      expect(badge.style.display).toBe('inline-flex');

      const chip = document.querySelector('.dep-chip[data-dep-id="task-1"]');
      expect(chip).not.toBeNull();
      expect(chip.textContent).toContain('W-1');
      expect(chip.textContent).toContain('Crear maqueta');

      // Eliminar
      dependenciesModule.removeFormDependency('task-1');
      expect(dependenciesModule.getFormDependencies()).toEqual([]);
      expect(badge.style.display).toBe('none');
      expect(document.querySelector('.dep-chip')).toBeNull();
    });

    it('al enviar el formulario (handleTaskSubmit) pasa dependsOn a addTask y limpia el estado del formulario', () => {
      dependenciesModule.addFormDependency('task-1');
      document.getElementById('taskTitle').value = 'Nueva tarea dependiente';

      const addTaskSpy = vi.spyOn(actions, 'addTask');
      formsModule.handleTaskSubmit(false);

      expect(addTaskSpy).toHaveBeenCalledWith(
        'Nueva tarea dependiente',
        '30',
        false,
        null,
        true,
        'days',
        false,
        "",
        '',
        ['task-1']
      );

      expect(dependenciesModule.getFormDependencies()).toEqual([]);
      expect(document.getElementById('formDependenciesBadge').style.display).toBe('none');
    });
  });

  describe('2. Main Board Task Card Dependencies Rendering', () => {
    it('renderiza la tarea bloqueada con clase .is-blocked, badge 🔒 y candado en el botón de inicio', () => {
      tasksView.renderTasks({ overflowIds: new Set(), segmentsByTask: {} });

      const itemTask2 = document.getElementById('task-item-task-2');
      expect(itemTask2).not.toBeNull();
      expect(itemTask2.classList.contains('is-blocked')).toBe(true);

      const depBadge = itemTask2.querySelector('.task-dep-badge.blocked');
      expect(depBadge).not.toBeNull();
      expect(depBadge.textContent).toContain('W-1');

      const runBtn = itemTask2.querySelector('.btn.run');
      expect(runBtn.classList.contains('is-blocked')).toBe(true);
      expect(runBtn.textContent).toContain('🔒');
    });

    it('renderiza badge 🔓 en la tarea cuando su predecesora ha sido completada', () => {
      // Completamos task-1
      state.environments.work.days['2026-09-02'].tasks[0].status = 'completed';

      tasksView.renderTasks({ overflowIds: new Set(), segmentsByTask: {} });

      const itemTask2 = document.getElementById('task-item-task-2');
      expect(itemTask2.classList.contains('is-blocked')).toBe(false);

      const unlockedBadge = itemTask2.querySelector('.task-dep-badge.unlocked');
      expect(unlockedBadge).not.toBeNull();
      expect(unlockedBadge.textContent).toContain('W-1');
      expect(unlockedBadge.textContent).toContain('✓');
    });

    it('renderiza badge ⚡ en la tarea que bloquea a otras tareas', () => {
      tasksView.renderTasks({ overflowIds: new Set(), segmentsByTask: {} });

      const itemTask1 = document.getElementById('task-item-task-1');
      const blockingBadge = itemTask1.querySelector('.task-dep-badge.blocking');
      expect(blockingBadge).not.toBeNull();
      expect(blockingBadge.textContent).toContain('W-2');
    });

    it('en modo edición en el tablero principal muestra la fila de dependencias con chips', () => {
      actions.startEditTask('task-2');
      tasksView.renderTasks({ overflowIds: new Set(), segmentsByTask: {} });

      const editItem = document.getElementById('task-item-task-2');
      const depsRow = editItem.querySelector('.task-form-dependencies-row');
      expect(depsRow).not.toBeNull();

      const chip = editItem.querySelector('.dep-chip[data-dep-id="task-1"]');
      expect(chip).not.toBeNull();
      expect(chip.textContent).toContain('W-1');

      // Eliminar dependencia en edición
      actions.removeEditTaskDependency('task-1');
      expect(currentTaskEdit.dependsOn).toEqual([]);
    });
  });

  describe('3. Triage View Parity for Dependencies', () => {
    it('en la lista de triaje la tarea bloqueada tiene .is-blocked y el badge de bloqueo', () => {
      triageView.renderTriageView();

      const triageRow = document.querySelector('.triage-task-row[data-task-id="task-2"]');
      expect(triageRow).not.toBeNull();
      expect(triageRow.classList.contains('is-blocked')).toBe(true);

      const depBadge = triageRow.querySelector('.task-dep-badge.blocked');
      expect(depBadge).not.toBeNull();
      expect(depBadge.textContent).toContain('W-1');
    });

    it('en la lista de triaje la tarea destacada recibe .featured-task y la bloqueada .is-blocked', () => {
      state.environments.work.days['2026-09-02'].tasks[0].featured = true;
      triageView.renderTriageView();

      const rowTask1 = document.querySelector('.triage-task-row[data-task-id="task-1"]');
      const rowTask2 = document.querySelector('.triage-task-row[data-task-id="task-2"]');
      expect(rowTask1.classList.contains('featured-task')).toBe(true);
      expect(rowTask1.classList.contains('is-blocked')).toBe(false);
      expect(rowTask2.classList.contains('is-blocked')).toBe(true);
    });

    it('en el modal de edición de triaje (#triageTaskEditModal) renderiza la sección de dependencias', () => {
      actions.startEditTask('task-2');
      triageView.renderTriageView();

      const modal = document.getElementById('triageTaskEditModal');
      expect(modal).not.toBeNull();

      const depsList = modal.querySelector('#triageTaskDependenciesList');
      expect(depsList).not.toBeNull();
      expect(depsList.querySelector('.dep-chip[data-dep-id="task-1"]')).not.toBeNull();
    });

    it('en la creación de nueva tarea en triaje (__new__) tiene paridad total y permite añadir dependencias', () => {
      actions.startNewTask();
      triageView.renderTriageView();

      const modal = document.getElementById('triageTaskEditModal');
      expect(modal).not.toBeNull();

      const depsRow = modal.querySelector('.task-form-dependencies-row');
      expect(depsRow).not.toBeNull();

      // Añadimos dependencia a la nueva tarea en triaje
      actions.addEditTaskDependency('task-1');
      expect(currentTaskEdit.dependsOn).toEqual(['task-1']);

      triageView.renderTriageView();
      const updatedDepsList = document.getElementById('triageTaskDependenciesList');
      expect(updatedDepsList.querySelector('.dep-chip[data-dep-id="task-1"]')).not.toBeNull();
    });
  });

  describe('4. Selector Modal & Cycle Prevention', () => {
    it('el selector modal excluye a la propia tarea y detecta dependencias circulares', () => {
      // Intentamos añadir dependencia para task-1
      dependenciesModule.openDependencySelector('task-1', 'task-edit');
      expect(document.getElementById('dependencySelectorModal').style.display).toBe('flex');

      // task-2 depende de task-1. Si task-1 intentara depender de task-2, sería circular!
      const listEl = document.getElementById('dependencySelectorList');
      const itemTask2 = listEl.querySelector('.dependency-selector-item.selected');
      expect(itemTask2).not.toBeNull();
      expect(itemTask2.title.toLowerCase()).toContain('circular');

      // Y task-1 no debe aparecer en la lista de candidatos
      expect(listEl.querySelector('[data-dep-id="task-1"]')).toBeNull();
    });

    it('seleccionar un candidato añade la dependencia según el contexto fuente', () => {
      dependenciesModule.openDependencySelector(null, 'form');
      dependenciesModule.selectDependency('task-1');

      expect(dependenciesModule.getFormDependencies()).toEqual(['task-1']);
      expect(document.getElementById('dependencySelectorModal').style.display).toBe('none');
    });
  });

  describe('5. Blocked Task Execution Confirmation', () => {
    it('al iniciar una tarea bloqueada se invoca el modal de confirmación con opciones', () => {
      let forceStartCalled = false;
      dependenciesModule.confirmBlockedTaskStart(
        state.environments.work.days['2026-09-02'].tasks[1],
        () => { forceStartCalled = true; }
      );

      const modal = document.getElementById('blockedTaskConfirmModal');
      expect(modal.style.display).toBe('flex');

      const details = document.getElementById('blockedConfirmDetails');
      expect(details.textContent).toContain('W-1');
      expect(details.textContent).toContain('Crear maqueta');

      // Forzar inicio
      dependenciesModule.forceStartBlockedTask();
      expect(forceStartCalled).toBe(true);
      expect(modal.style.display).toBe('none');
    });
  });

  describe('6. Modal Stacking & Z-Index in Triage', () => {
    it('el modal de selección de dependencias y el de confirmación tienen z-index superior a triageTaskEditModal (100000)', () => {
      const cssContent = fs.readFileSync(path.resolve(__dirname, '../css/modals.css'), 'utf-8');
      const htmlContent = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

      // Debe estar configurado en css/modals.css con z-index > 100000
      expect(cssContent).toMatch(/#dependencySelectorModal[^{]*\{[^}]*z-index:\s*(1000[1-9]\d|100[1-9]\d{2})/);
      expect(cssContent).toMatch(/#blockedTaskConfirmModal[^{]*\{[^}]*z-index:\s*(1000[1-9]\d|100[1-9]\d{2})/);

      // Y en index.html con z-index > 100000
      expect(htmlContent).toMatch(/id="dependencySelectorModal"[^>]*z-index:\s*1000[1-9]\d/);
    });

    it('al pulsar Escape o clic en el backdrop con dependencySelectorModal abierto sobre triageTaskEditModal, solo se cierra el selector y el modal de triaje permanece abierto', () => {
      // Abrimos el modal de triaje
      currentTaskEdit = {
        id: '__new__',
        isNew: true,
        title: 'Tarea en triaje',
        duration: '30',
        urgency: 'days',
        dependsOn: []
      };
      triageView.renderTriageView();
      const triageModal = document.getElementById('triageTaskEditModal');
      expect(triageModal).not.toBeNull();

      // Abrir selector de dependencias desde triaje
      dependenciesModule.openDependencySelector('__new__', 'triage');
      const depModal = document.getElementById('dependencySelectorModal');
      expect(depModal.style.display).toBe('flex');

      // Simular tecla Escape
      const escEvt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      window.dispatchEvent(escEvt);

      // El selector de dependencias debe haberse cerrado
      expect(depModal.style.display).toBe('none');
      // Pero el modal de triaje NO debe haberse cancelado ni cerrado
      expect(currentTaskEdit).not.toBeNull();
      expect(document.getElementById('triageTaskEditModal')).not.toBeNull();

      // Abrir selector de dependencias otra vez
      dependenciesModule.openDependencySelector('__new__', 'triage');
      expect(depModal.style.display).toBe('flex');

      // Simular clic en el backdrop (el propio elemento depModal)
      depModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(depModal.style.display).toBe('none');
      expect(currentTaskEdit).not.toBeNull();
      expect(document.getElementById('triageTaskEditModal')).not.toBeNull();
    });
  });
});
