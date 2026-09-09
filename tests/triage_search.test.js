import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import { TodayTasksShortcuts } from '../js/app/shortcuts.js';
import { TodayTasksViews } from '../js/views.js';

describe('Triage Search Feature', () => {
  let triageView;
  let state;
  let actions;
  let viewsCoordinator;
  let shortcuts;
  let currentView = 'triage';

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-main">
        <input type="text" id="taskSearchInput" />
        <button id="taskSearchClearBtn" style="display:none;"></button>
      </div>
      <div id="view-triage" style="display:block;"></div>
      <div id="triageEditModalHost"></div>
      <div id="floatingBatchBar"></div>
      <div id="toast"></div>
      <div id="shortcutsModal" style="display:none;"></div>
    `;

    state = defaultState();
    state.activeEnv = 'work';
    state.selectedDate = '2026-09-09';
    const sampleTasks = [
      { id: 1, title: 'Diseñar arquitectura #frontend @diego', duration: 30, planned: 30, urgency: 'today', status: 'pending', featured: true, notes: 'Detalles técnicos' },
      { id: 2, title: 'Revisión backend #api @ana', duration: 45, planned: 45, urgency: 'days', status: 'pending', featured: false, notes: '' },
      { id: 3, title: 'Documentar despliegue #devops', duration: 20, planned: 20, urgency: 'week', status: 'completed', completedAt: 1788277200000, featured: false, notes: '' },
      { id: 4, title: 'Bug en autenticación #frontend @ana', duration: 15, planned: 15, urgency: 'today', status: 'completed', completedAt: 1788277300000, featured: true, notes: '' },
      { id: 5, title: 'Investigar nuevas métricas #analytics', duration: 60, planned: 60, urgency: 'later', status: 'pending', featured: false, notes: 'Métricas Q3' }
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
        if (viewsCoordinator) viewsCoordinator.renderAll();
      },
      smartRender: () => {
        if (viewsCoordinator) viewsCoordinator.smartRender();
      },
      actionsModule: null,
      viewsModule: null,
      routerModule: {
        getCurrentView: () => currentView,
        getFocusTaskId: () => null
      },
      undoModule: { pushSnapshot: () => {}, undo: () => {}, redo: () => {}, canUndo: () => false, canRedo: () => false }
    };

    actions = TodayTasksActions(ctx);
    ctx.actionsModule = actions;

    viewsCoordinator = TodayTasksViews(ctx);
    ctx.viewsModule = viewsCoordinator;
    triageView = viewsCoordinator;

    shortcuts = TodayTasksShortcuts(ctx);

    const appObj = {
      ...viewsCoordinator,
      ...actions,
      filterByTag: function(tag, event) {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        const isTriage = currentView === 'triage';
        const cleanTag = String(tag).replace(/^#+/, '').trim();
        if (isTriage) {
          const currentQuery = (viewsCoordinator.getTriageSearchQuery ? viewsCoordinator.getTriageSearchQuery() : '').trim();
          if (currentQuery === `#${cleanTag}`) {
            viewsCoordinator.clearTriageSearch();
          } else {
            viewsCoordinator.setTriageSearchQuery(`#${cleanTag}`);
          }
          return;
        }
      },
      filterByMention: function(mention, event) {
        if (event) {
          if (typeof event.stopPropagation === 'function') event.stopPropagation();
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        const isTriage = currentView === 'triage';
        const cleanMention = String(mention).replace(/^@+/, '').trim();
        if (isTriage) {
          const currentQuery = (viewsCoordinator.getTriageSearchQuery ? viewsCoordinator.getTriageSearchQuery() : '').trim();
          if (currentQuery.toLowerCase() === `@${cleanMention.toLowerCase()}`) {
            viewsCoordinator.clearTriageSearch();
          } else {
            viewsCoordinator.setTriageSearchQuery(`@${cleanMention}`);
          }
          return;
        }
      }
    };
    window.app = appObj;
    globalThis.app = appObj;
  });

  it('renderiza la barra de búsqueda en la vista de triaje con input y botón de limpiar', () => {
    triageView.renderTriageView();

    const searchBar = document.getElementById('triageSearchBar');
    expect(searchBar).not.toBeNull();

    const searchInput = document.getElementById('triageSearchInput');
    expect(searchInput).not.toBeNull();
    expect(searchInput.placeholder).toContain('Buscar');

    const clearBtn = document.getElementById('triageSearchClearBtn');
    expect(clearBtn).not.toBeNull();
    expect(clearBtn.style.display).toBe('none');
  });

  it('filtra tareas activas por texto en el título', () => {
    triageView.renderTriageView();
    expect(document.querySelectorAll('.triage-tasks-list .triage-task-row').length).toBe(3); // 3 pendientes (1, 2, 5)

    triageView.setTriageSearchQuery('backend');
    expect(triageView.getTriageSearchQuery()).toBe('backend');

    const rows = document.querySelectorAll('.triage-tasks-list .triage-task-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Revisión backend');
  });

  it('filtra tareas activas por tag (#frontend)', () => {
    triageView.renderTriageView();
    triageView.setTriageSearchQuery('#frontend');

    const activeRows = document.querySelectorAll('.triage-tasks-list .triage-task-row');
    expect(activeRows.length).toBe(1);
    expect(activeRows[0].textContent).toContain('Diseñar arquitectura');
  });

  it('filtra tareas activas por mención (@ana)', () => {
    triageView.renderTriageView();
    triageView.setTriageSearchQuery('@ana');

    const activeRows = document.querySelectorAll('.triage-tasks-list .triage-task-row');
    expect(activeRows.length).toBe(1);
    expect(activeRows[0].textContent).toContain('Revisión backend');
  });

  it('filtra tareas por filtro de urgencia (hoy)', () => {
    triageView.renderTriageView();
    triageView.setTriageSearchQuery('hoy');

    const activeRows = document.querySelectorAll('.triage-tasks-list .triage-task-row');
    expect(activeRows.length).toBe(1);
    expect(activeRows[0].textContent).toContain('Diseñar arquitectura');
  });

  it('filtra tareas destacadas con estrella / star', () => {
    triageView.renderTriageView();
    triageView.setTriageSearchQuery('star');

    const activeRows = document.querySelectorAll('.triage-tasks-list .triage-task-row');
    expect(activeRows.length).toBe(1);
    expect(activeRows[0].textContent).toContain('Diseñar arquitectura');
  });

  it('muestra sección de tareas completadas que coinciden con la búsqueda con acción de desmarcar', () => {
    triageView.renderTriageView();
    triageView.setTriageSearchQuery('#frontend');

    // 1 activa (#1) y 1 completada (#4) tienen #frontend
    const completedList = document.querySelector('.triage-completed-list');
    expect(completedList).not.toBeNull();

    const completedRows = document.querySelectorAll('.triage-completed-item');
    expect(completedRows.length).toBe(1);
    expect(completedRows[0].textContent).toContain('Bug en autenticación');

    // El botón para reabrir la tarea completada debe llamar a app.uncompleteTask
    const uncompleteBtn = completedRows[0].querySelector('button[onclick*="uncompleteTask"]');
    expect(uncompleteBtn).not.toBeNull();
  });

  it('muestra banner con el conteo de resultados cuando hay búsqueda activa', () => {
    triageView.renderTriageView();
    triageView.setTriageSearchQuery('frontend');

    const banner = document.querySelector('.search-results-info');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('1 activa');
    expect(banner.textContent).toContain('1 completada');
  });

  it('permite limpiar la búsqueda con el botón ✕ y restablece todas las tareas', () => {
    triageView.renderTriageView();
    triageView.setTriageSearchQuery('arquitectura');
    expect(document.querySelectorAll('.triage-tasks-list .triage-task-row').length).toBe(1);

    const clearBtn = document.getElementById('triageSearchClearBtn');
    expect(clearBtn.style.display).not.toBe('none');

    clearBtn.click();
    expect(triageView.getTriageSearchQuery()).toBe('');
    expect(document.querySelectorAll('.triage-tasks-list .triage-task-row').length).toBe(3);
    expect(clearBtn.style.display).toBe('none');
  });

  it('permite limpiar la búsqueda pulsando Escape en el input', () => {
    triageView.renderTriageView();
    triageView.setTriageSearchQuery('backend');
    expect(document.querySelectorAll('.triage-tasks-list .triage-task-row').length).toBe(1);

    const searchInput = document.getElementById('triageSearchInput');
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    searchInput.dispatchEvent(escEvent);

    expect(triageView.getTriageSearchQuery()).toBe('');
    expect(document.querySelectorAll('.triage-tasks-list .triage-task-row').length).toBe(3);
  });

  it('permite filtrar mediante app.filterByTag y desfiltrar haciendo clic de nuevo', () => {
    triageView.renderTriageView();
    window.app.filterByTag('frontend');
    expect(triageView.getTriageSearchQuery()).toBe('#frontend');
    expect(document.querySelectorAll('.triage-tasks-list .triage-task-row').length).toBe(1);

    // Toggle off
    window.app.filterByTag('frontend');
    expect(triageView.getTriageSearchQuery()).toBe('');
    expect(document.querySelectorAll('.triage-tasks-list .triage-task-row').length).toBe(3);
  });

  it('el atajo / enfoca el input de búsqueda de triaje cuando la vista actual es triage', () => {
    triageView.renderTriageView();
    const searchInput = document.getElementById('triageSearchInput');
    let focused = false;
    searchInput.focus = () => { focused = true; };

    const slashEvent = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    window.dispatchEvent(slashEvent);

    expect(focused).toBe(true);
  });
});
