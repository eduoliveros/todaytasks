import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { TodayTasksTriageView } from '../js/views/triage.js';
import { TodayTasksForms } from '../js/app/forms.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';
import { attachTagAutocomplete } from '../js/app/tag-autocomplete.js';

describe('Task Editing Tag & Mention Autocomplete', () => {
  let state;
  let actions;
  let triageView;
  let forms;
  let tasksView;
  let currentView = 'triage';

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-main">
        <input type="text" id="taskTitle" />
        <input type="text" id="taskTime" />
        <textarea id="taskNotesInput"></textarea>
        <button id="taskAddBtn"></button>
        <div id="tasksList"></div>
        <div id="completedTaskList"></div>
      </div>
      <div id="view-triage" style="display:none;"></div>
      <div id="triageEditModalHost"></div>
      <div id="floatingBatchBar"></div>
      <div id="toast"></div>
    `;

    state = defaultState();
    state.activeEnv = 'work';
    state.selectedDate = '2026-09-09';
    const sampleTasks = [
      { id: 1, title: 'Tarea inicial #backend @carlos', duration: 30, planned: 30, urgency: 'today', status: 'pending', starred: false, notes: 'Detalle con #importante @ana' }
    ];
    state.tasks = sampleTasks;
    state.environments.work.days['2026-09-09'] = {
      tasks: sampleTasks,
      meetings: []
    };

    let idCounter = 10;
    let taskEdit = null;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => taskEdit,
      setTaskEdit: (te) => { taskEdit = te; },
      getNotifyState: () => ({ taskId: null }),
      setNotifyState: () => {},
      saveState: () => {},
      newId: () => idCounter++,
      getCurrentView: () => currentView,
      getFocusTaskId: () => null,
      renderAll: () => {
        if (currentView === 'triage') {
          if (triageView) triageView.renderTriageView();
        } else {
          if (tasksView) tasksView.renderTasks();
        }
      },
      smartRender: () => {
        if (currentView === 'triage') {
          if (triageView) triageView.renderTriageView();
        } else {
          if (tasksView) tasksView.renderTasks();
        }
      },
      actionsModule: null,
      undoModule: { pushSnapshot: () => {}, undo: () => {} }
    };

    actions = TodayTasksActions(ctx);
    ctx.actionsModule = actions;

    triageView = TodayTasksTriageView(ctx);
    forms = TodayTasksForms(ctx);
    tasksView = TodayTasksTasksView(ctx);

    const appObj = {
      ...actions,
      ...triageView,
      attachTagAutocompleteToEl: (el) => {
        if (!el || el._hasTagAutocomplete) return;
        el._hasTagAutocomplete = true;
        attachTagAutocomplete(el, { getState: () => state });
      }
    };
    global.app = appObj;
    window.app = appObj;
    globalThis.app = appObj;
    if (document.defaultView) document.defaultView.app = appObj;
  });

  it('asigna z-index 200000 al dropdown de autocompletado para quedar por encima de modales', () => {
    const input = document.getElementById('taskTitle');
    attachTagAutocomplete(input, { getState: () => state });

    input.value = 'Nueva tarea #';
    input.setSelectionRange(13, 13);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const dropdown = document.querySelector('.tag-autocomplete-dropdown');
    expect(dropdown).not.toBeNull();
    expect(dropdown.style.zIndex).toBe('200000');
  });

  it('activa autocompletado en el textarea de notas del formulario principal (#taskNotesInput)', () => {
    const notesInput = document.getElementById('taskNotesInput');
    expect(notesInput).not.toBeNull();

    notesInput.value = 'Nota con #';
    notesInput.setSelectionRange(10, 10);
    notesInput.dispatchEvent(new Event('input', { bubbles: true }));

    const dropdown = document.querySelector('.tag-autocomplete-dropdown');
    expect(dropdown).not.toBeNull();
    expect(dropdown.textContent).toContain('backend');
    expect(dropdown.textContent).toContain('importante');
  });

  it('activa autocompletado en título y notas del modal de edición de triaje', async () => {
    currentView = 'triage';
    triageView.renderTriageView();

    // Abrir modal de edición en triaje para la tarea 1
    triageView.handleTriageRowDblClick(1, { target: document.createElement('div'), stopPropagation: () => {} });

    const modal = document.getElementById('triageTaskEditModal');
    expect(modal).not.toBeNull();

    // Esperar a que el setTimeout de renderTriageView ejecute attachTagAutocompleteToEl
    await new Promise(resolve => setTimeout(resolve, 60));

    const titleInput = document.getElementById('triageEditTitleInput');
    const notesInput = document.getElementById('task-edit-notes-1');
    expect(titleInput).not.toBeNull();
    expect(notesInput).not.toBeNull();

    // Probar autocompletado en el título del modal
    titleInput.value = 'Modificando @';
    titleInput.setSelectionRange(13, 13);
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));

    let dropdown = document.querySelector('.tag-autocomplete-dropdown');
    expect(dropdown).not.toBeNull();
    expect(dropdown.textContent).toContain('ana');
    expect(dropdown.textContent).toContain('carlos');

    // Cerrar / resetear dropdown
    titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    // Probar autocompletado en las notas del modal
    notesInput.value = 'Añadiendo tag #';
    notesInput.setSelectionRange(15, 15);
    notesInput.dispatchEvent(new Event('input', { bubbles: true }));

    const dropdowns = document.querySelectorAll('.tag-autocomplete-dropdown');
    const openDropdown = Array.from(dropdowns).find(d => d.style.display !== 'none');
    expect(openDropdown).not.toBeUndefined();
    expect(openDropdown.textContent).toContain('backend');
  });

  it('activa autocompletado en las notas de edición inline en la vista principal', async () => {
    currentView = 'main';
    const task = state.tasks[0];
    actions.startEditTask(task.id);

    tasksView.renderTasks();

    // Esperar a que el setTimeout de renderTasks ejecute attachTagAutocompleteToEl
    await new Promise(resolve => setTimeout(resolve, 30));

    const inlineNotes = document.getElementById(`task-edit-notes-${task.id}`);
    expect(inlineNotes).not.toBeNull();

    inlineNotes.value = 'Texto editado #';
    inlineNotes.setSelectionRange(15, 15);
    inlineNotes.dispatchEvent(new Event('input', { bubbles: true }));

    const dropdown = document.querySelector('.tag-autocomplete-dropdown');
    expect(dropdown).not.toBeNull();
    expect(dropdown.textContent).toContain('backend');
  });
});
