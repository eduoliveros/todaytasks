import { describe, it, expect } from 'vitest';
import { getNextWorkingDays } from '../js/utils.js';

describe('Triage Utils & Working Days calculation', () => {
  it('calcula los próximos 7 días laborables saltándose fines de semana por defecto en trabajo', () => {
    // 2026-09-02 es Miércoles (dow = 3)
    const startDate = '2026-09-02';
    const nextDays = getNextWorkingDays(startDate, 7, { activeEnv: 'work', environments: { work: {} } }, 'work');

    expect(nextDays).toHaveLength(7);
    // Día 1: Jueves 03/09 (Mañana)
    expect(nextDays[0].date).toBe('2026-09-03');
    expect(nextDays[0].shortChip).toBe('J 3');
    expect(nextDays[0].label).toContain('Mañana');

    // Día 2: Viernes 04/09
    expect(nextDays[1].date).toBe('2026-09-04');
    expect(nextDays[1].shortChip).toBe('V 4');

    // Sábado 05/09 y Domingo 06/09 se deben saltar!
    // Día 3: Lunes 07/09
    expect(nextDays[2].date).toBe('2026-09-07');
    expect(nextDays[2].shortChip).toBe('L 7');

    // Día 4: Martes 08/09
    expect(nextDays[3].date).toBe('2026-09-08');
    expect(nextDays[3].shortChip).toBe('M 8');

    // Día 5: Miércoles 09/09
    expect(nextDays[4].date).toBe('2026-09-09');
    expect(nextDays[4].shortChip).toBe('X 9');

    // Día 6: Jueves 10/09
    expect(nextDays[5].date).toBe('2026-09-10');
    expect(nextDays[5].shortChip).toBe('J 10');

    // Día 7: Viernes 11/09
    expect(nextDays[6].date).toBe('2026-09-11');
    expect(nextDays[6].shortChip).toBe('V 11');
  });

  it('respeta días libres personalizados configurados en weeklySchedule', () => {
    // Miércoles 2026-09-02. Supongamos que los viernes (dow=5) también son libres (null)
    const customState = {
      activeEnv: 'work',
      environments: {
        work: {
          weeklySchedule: {
            1: { start: 540, end: 1080 },
            2: { start: 540, end: 1080 },
            3: { start: 540, end: 1080 },
            4: { start: 540, end: 1080 },
            5: null, // Viernes libre
            6: null, // Sábado libre
            7: null  // Domingo libre
          }
        }
      }
    };

    const nextDays = getNextWorkingDays('2026-09-02', 5, customState, 'work');
    expect(nextDays).toHaveLength(5);
    // Día 1: Jueves 03/09
    expect(nextDays[0].date).toBe('2026-09-03');
    // Viernes 04, Sábado 05 y Domingo 06 son libres!
    // Día 2: Lunes 07/09
    expect(nextDays[1].date).toBe('2026-09-07');
    // Día 3: Martes 08/09
    expect(nextDays[2].date).toBe('2026-09-08');
    // Día 4: Miércoles 09/09
    expect(nextDays[3].date).toBe('2026-09-09');
    // Día 5: Jueves 10/09
    expect(nextDays[4].date).toBe('2026-09-10');
  });

  it('devuelve array vacío si la fecha es inválida o count es 0', () => {
    expect(getNextWorkingDays('', 5)).toEqual([]);
    expect(getNextWorkingDays(null, 5)).toEqual([]);
    expect(getNextWorkingDays('2026-09-02', 0)).toEqual([]);
  });
});

import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';

describe('Triage Batch Actions', () => {
  let actions;
  let state;
  let snapshots = [];

  beforeEach(() => {
    snapshots = [];
    state = defaultState();
    let idCounter = 1;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => null,
      setTaskEdit: () => {},
      setNotifyState: () => {},
      getNotifyState: () => ({ taskId: null }),
      saveState: () => {},
      newId: () => idCounter++,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {},
      undoModule: {
        pushSnapshot: (desc) => { snapshots.push(desc); }
      }
    };

    actions = TodayTasksActions(ctx);
  });

  it('mueve múltiples tareas a otra fecha en bloque preservando orden y registrando undo', () => {
    state.selectedDate = '2026-09-01';
    actions.addTask('Tarea A', '15');
    actions.addTask('Tarea B', '30');
    actions.addTask('Tarea C', '45');

    const idsToMove = [state.tasks[0].id, state.tasks[2].id];
    const targetDate = '2026-09-15';

    const movedCount = actions.moveTasksToDate(idsToMove, targetDate);
    expect(movedCount).toBe(2);

    // En el día origen solo queda Tarea B
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].title).toBe('Tarea B');

    // En el día destino están Tarea A y Tarea C
    const env = state.environments[state.activeEnv];
    expect(env.days[targetDate].tasks).toHaveLength(2);
    expect(env.days[targetDate].tasks[0].title).toBe('Tarea A');
    expect(env.days[targetDate].tasks[1].title).toBe('Tarea C');

    // Se registró instantánea de undo
    expect(snapshots.some(s => s.includes('Mover 2 tareas'))).toBe(true);
  });

  it('cambia la urgencia de múltiples tareas en bloque y registra undo', () => {
    actions.addTask('Tarea 1', '15', false, null, true, 'days');
    actions.addTask('Tarea 2', '30', false, null, true, 'days');

    const ids = [state.tasks[0].id, state.tasks[1].id];
    actions.setTasksUrgency(ids, 'today');

    expect(state.tasks[0].urgency).toBe('today');
    expect(state.tasks[1].urgency).toBe('today');
    expect(snapshots.some(s => s.includes('Cambiar urgencia de 2 tareas'))).toBe(true);
  });

  it('destaca múltiples tareas respetando el límite máximo de 5 destacadas', () => {
    for (let i = 1; i <= 6; i++) {
      actions.addTask(`Tarea ${i}`, '15', false, null, true, 'today', false);
    }

    const allIds = state.tasks.map(t => t.id);
    actions.setTasksFeatured(allIds, true);

    const featuredCount = state.tasks.filter(t => t.featured).length;
    expect(featuredCount).toBe(5); // Máximo 5
    expect(snapshots.some(s => s.includes('Destacar 5 tareas'))).toBe(true);

    // Quitar destacado en bloque
    actions.setTasksFeatured(allIds, false);
    expect(state.tasks.filter(t => t.featured).length).toBe(0);
    expect(snapshots.some(s => s.includes('Quitar destacado'))).toBe(true);
  });

  it('elimina múltiples tareas en bloque y guarda lápidas _deletedIds para cloud sync', () => {
    actions.addTask('Tarea X', '20');
    actions.addTask('Tarea Y', '20');
    actions.addTask('Tarea Z', '20');

    const idsToDelete = [state.tasks[0].id, state.tasks[1].id];
    const deletedCount = actions.deleteTasks(idsToDelete);

    expect(deletedCount).toBe(2);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].title).toBe('Tarea Z');

    const env = state.environments[state.activeEnv];
    const day = env.days[state.selectedDate];
    expect(day._deletedIds).toEqual(expect.arrayContaining(idsToDelete.map(String)));
  });
});

import { TodayTasksTriageView } from '../js/views/triage.js';
import TodayTasksTasksView from '../js/views/tasks.js';
import { TodayTasksShortcuts } from '../js/app/shortcuts.js';
import { TodayTasksRouter } from '../js/router.js';

describe('TodayTasksTriageView (UI & Sorting & Selection)', () => {
  let triageView;
  let state;
  let actions;
  let taskEdit;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-main"></div>
      <div id="view-triage" style="display:none;"></div>
      <div id="triageEditModalHost"></div>
      <div id="floatingBatchBar"></div>
      <div id="toast"></div>
      <div id="recurringModal" style="display:none;">
        <h3 id="recurringModalTitle"></h3>
        <p id="recurringModalDesc"></p>
        <button id="recModalBtnInstance"></button>
        <button id="recModalBtnSeries"></button>
        <button id="recModalBtnCancel"></button>
      </div>
      <div class="urgency-dropdown-overlay" id="urgencyDropdownOverlay" style="display:none;"></div>
      <div class="urgency-dropdown-menu" id="urgencyDropdownMenu" style="display:none;">
        <div class="urgency-option-item" data-urgency="today">Hoy</div>
        <div class="urgency-option-item" data-urgency="days">Días</div>
        <div class="urgency-option-item" data-urgency="week">Semana</div>
        <div class="urgency-option-item" data-urgency="later">Más adelante</div>
      </div>
    `;

    state = defaultState();
    let idCounter = 1;

    taskEdit = null;
    let triageViewInstance = null;

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
      getCurrentView: () => 'triage',
      getFocusTaskId: () => null,
      renderAll: () => { if (triageViewInstance) triageViewInstance.renderTriageView(); },
      smartRender: () => { if (triageViewInstance) triageViewInstance.renderTriageView(); },
      actionsModule: null,
      undoModule: { pushSnapshot: () => {}, undo: () => {} }
    };

    actions = TodayTasksActions(ctx);
    ctx.actionsModule = actions;

    triageView = TodayTasksTriageView(ctx);
    triageViewInstance = triageView;
    const appObj = {
      ...triageView,
      ...actions,
      openEditUrgencyDropdown: function(taskId, event) {
        this._editUrgencyTaskId = taskId;
        const menu = document.getElementById('urgencyDropdownMenu');
        const overlay = document.getElementById('urgencyDropdownOverlay');
        if (menu) menu.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
      },
      selectTaskUrgency: function(urgency) {
        if (this._editUrgencyTaskId) {
          actions.updateTaskEditField('urgency', urgency);
          this._editUrgencyTaskId = null;
        }
        const menu = document.getElementById('urgencyDropdownMenu');
        const overlay = document.getElementById('urgencyDropdownOverlay');
        if (menu) menu.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
      }
    };
    window.app = appObj;
    if (document.defaultView) document.defaultView.app = appObj;
    globalThis.app = appObj;
  });

  it('renderiza la vista de triaje sin recuadro azul de ayuda y con el mismo orden que en la página principal, incluyendo manija de arrastre (puntitos)', () => {
    // Añadimos tareas con distintas duraciones en 'today'
    actions.addTask('Larga', '60', false, null, true, 'today');
    actions.addTask('Corta', '10', false, null, true, 'today');
    actions.addTask('Media', '30', false, null, true, 'today');

    triageView.renderTriageView();

    const container = document.getElementById('view-triage');
    expect(container.innerHTML).toContain('Triaje Rápido');
    // Verificamos que NO exista el cuadro azul de instrucciones
    expect(container.innerHTML).not.toContain('triage-help-box');
    expect(container.innerHTML).not.toContain('Instrucciones rápidas');

    // Comprobamos que dentro del grupo 'today', el orden sea idéntico al de la pantalla principal ('Larga' -> 'Corta' -> 'Media')
    const taskTitles = Array.from(container.querySelectorAll('#triage-group-today .triage-task-title'))
      .map(el => el.textContent.trim());
    expect(taskTitles).toEqual(['Larga', 'Corta', 'Media']);

    // Comprobamos que cada fila tenga la manija de arrastre (puntitos ⠿)
    const dragHandles = container.querySelectorAll('.triage-task-row .drag-handle');
    expect(dragHandles.length).toBe(3);
    expect(dragHandles[0].textContent).toContain('⠿');

    // Comprobamos que cada fila sea draggable
    const rows = container.querySelectorAll('.triage-task-row');
    expect(rows[0].getAttribute('draggable')).toBe('true');

    // Comprobamos que cada fila tenga sus 5 botones rápidos de días laborables
    const quickDaysButtons = container.querySelectorAll('.triage-task-row .triage-quick-day-btn');
    expect(quickDaysButtons.length).toBeGreaterThanOrEqual(15); // 3 tareas * 5 botones
  });

  it('permite reordenar manualmente las tareas con drag & drop y la ordenación manual tiene prioridad', () => {
    actions.addTask('Tarea Primera', '15', false, null, true, 'today');
    actions.addTask('Tarea Segunda', '20', false, null, true, 'today');
    actions.addTask('Tarea Tercera', '25', false, null, true, 'today');

    const id1 = state.tasks[0].id;
    const id2 = state.tasks[1].id;
    const id3 = state.tasks[2].id;

    triageView.renderTriageView();

    let container = document.getElementById('view-triage');
    let titles = Array.from(container.querySelectorAll('#triage-group-today .triage-task-title')).map(el => el.textContent.trim());
    expect(titles).toEqual(['Tarea Primera', 'Tarea Segunda', 'Tarea Tercera']);

    // Simulamos arrastrar 'Tarea Tercera' a la primera posición (sobre 'Tarea Primera')
    actions.armTaskDrag();
    const mockDragStartEvent = {
      preventDefault: () => {},
      dataTransfer: { effectAllowed: '', setData: () => {} },
      currentTarget: container.querySelector(`[data-task-id="${id3}"]`)
    };
    actions.taskDragStart(mockDragStartEvent, id3);

    const mockDropEvent = {
      preventDefault: () => {},
      dataTransfer: { dropEffect: '' },
      currentTarget: container.querySelector(`[data-task-id="${id1}"]`)
    };
    actions.taskDrop(mockDropEvent, id1);
    actions.taskDragEnd({});

    // Verificamos que el nuevo orden manual en triaje se refleje inmediatamente
    container = document.getElementById('view-triage');
    titles = Array.from(container.querySelectorAll('#triage-group-today .triage-task-title')).map(el => el.textContent.trim());
    expect(titles).toEqual(['Tarea Tercera', 'Tarea Primera', 'Tarea Segunda']);
  });

  it('permite seleccionar tareas individuales y muestra la barra flotante con el contador', () => {
    actions.addTask('Tarea 1', '15', false, null, true, 'today');
    actions.addTask('Tarea 2', '20', false, null, true, 'today');

    triageView.renderTriageView();

    // Al inicio no hay nada seleccionado
    let floatingBar = document.getElementById('triageFloatingBar');
    expect(floatingBar.classList.contains('visible')).toBe(false);

    // Seleccionamos la primera tarea
    triageView.toggleTriageTaskSelect(state.tasks[0].id);

    floatingBar = document.getElementById('triageFloatingBar');
    expect(floatingBar.classList.contains('visible')).toBe(true);
    expect(floatingBar.textContent).toContain('1 tarea seleccionada');

    // Deseleccionar
    triageView.clearTriageSelection();
    floatingBar = document.getElementById('triageFloatingBar');
    expect(floatingBar.classList.contains('visible')).toBe(false);
  });

  it('cambia entre modos de ordenación (viabilidad, duración, destacadas)', () => {
    actions.addTask('Tarea A', '10', false, null, true, 'today');
    actions.addTask('Tarea B', '50', false, null, true, 'today');

    triageView.setTriageSortMode('duration');
    let container = document.getElementById('view-triage');
    expect(container.textContent).toContain('Quick Wins (≤ 15 min)');
    expect(container.textContent).toContain('Largas (> 45 min)');

    triageView.setTriageSortMode('viability');
    container = document.getElementById('view-triage');
    expect(container.textContent).toContain('Caben dentro del horario de hoy');

    triageView.setTriageSortMode('featured');
    container = document.getElementById('view-triage');
    expect(container.textContent).toContain('Tareas Destacadas');
    expect(container.textContent).toContain('Otras tareas en cola');
  });

  it('en la vista de viabilidad hoy, las tareas que desbordan la jornada laboral aparecen en el segundo bloque (overflow)', () => {
    // Configuramos jornada de 09:00 (540) a 18:00 (1080) -> 9 horas (540 minutos)
    state.workStart = 540;
    state.workEnd = 1080;
    state.planningMode = true; // Simulación desde el inicio de jornada

    // Tarea que cabe holgadamente (300 min: 09:00 a 14:00)
    actions.addTask('Tarea Dentro', '300', false, null, true, 'today');
    // Tarea que excede el fin de jornada (300 min: 14:00 a 19:00 > 18:00)
    actions.addTask('Tarea Desborda', '300', false, null, true, 'today');

    triageView.setTriageSortMode('viability');

    const container = document.getElementById('view-triage');
    expect(container).not.toBeNull();

    // Comprobamos el bloque 1 (Caben)
    const fitsGroup = container.querySelector('#triage-group-fits');
    expect(fitsGroup).not.toBeNull();
    const fitsTitles = Array.from(fitsGroup.querySelectorAll('.triage-task-title')).map(el => el.textContent.trim());
    expect(fitsTitles).toEqual(['Tarea Dentro']);

    // Comprobamos el bloque 2 (Desbordan / Overflow)
    const overflowGroup = container.querySelector('#triage-group-overflow');
    expect(overflowGroup).not.toBeNull();
    const overflowTitles = Array.from(overflowGroup.querySelectorAll('.triage-task-title')).map(el => el.textContent.trim());
    expect(overflowTitles).toEqual(['Tarea Desborda']);

    // La tarea que desborda tiene el indicador visual de desborde
    expect(overflowGroup.innerHTML).toContain('triage-overflow-tag');
  });

  it('permite plegar y desplegar grupos', () => {
    actions.addTask('Tarea 1', '15', false, null, true, 'today');
    triageView.renderTriageView();

    const todayGroup = document.getElementById('triage-group-today');
    expect(todayGroup.classList.contains('collapsed')).toBe(false);

    // Plegar grupo today
    triageView.toggleTriageGroup('today');
    const todayGroupAfter = document.getElementById('triage-group-today');
    expect(todayGroupAfter.classList.contains('collapsed')).toBe(true);
  });

  it('al pulsar dos veces (doble clic) sobre una tarea en triaje abre el modal de edición de tarea', () => {
    actions.addTask('Tarea Para Editar', '25', false, null, true, 'today');
    const task = state.tasks[0];

    triageView.renderTriageView();

    const row = document.querySelector(`[data-task-id="${task.id}"]`);
    expect(row).not.toBeNull();
    expect(row.getAttribute('ondblclick')).toContain('handleTriageRowDblClick');

    // Disparamos doble clic en la fila de la tarea
    triageView.handleTriageRowDblClick(task.id, { stopPropagation: () => {}, target: row });

    // Verificamos que se haya renderizado el modal de edición de triaje
    const modal = document.getElementById('triageTaskEditModal');
    expect(modal).not.toBeNull();
    expect(modal.style.display).toBe('flex');

    const titleInput = document.getElementById('triageEditTitleInput');
    expect(titleInput).not.toBeNull();
    expect(titleInput.value).toBe('Tarea Para Editar');

    // Modificamos el título y guardamos
    actions.updateTaskEditField('title', 'Tarea Editada Triaje');
    actions.saveEditTask(task.id);

    expect(state.tasks[0].title).toBe('Tarea Editada Triaje');
    expect(document.getElementById('triageTaskEditModal')).toBeNull();
  });

  it('permite cancelar la edición de una tarea cerrando el modal', () => {
    actions.addTask('Tarea Cancelar', '15', false, null, true, 'today');
    const task = state.tasks[0];

    triageView.renderTriageView();
    const row = document.querySelector(`[data-task-id="${task.id}"]`);

    triageView.handleTriageRowDblClick(task.id, { stopPropagation: () => {}, target: row });
    expect(document.getElementById('triageTaskEditModal')).not.toBeNull();

    // Cancelamos la edición
    actions.cancelEditTask();
    expect(document.getElementById('triageTaskEditModal')).toBeNull();
    expect(state.tasks[0].title).toBe('Tarea Cancelar');
  });

  it('al hacer dos clics consecutivos en la fila (handleTriageRowClick x 2), detecta doble clic y abre la edición sin marcarla', () => {
    actions.addTask('Tarea Doble Clic Rapido', '20', false, null, true, 'today');
    const task = state.tasks[0];

    triageView.renderTriageView();
    const row = document.querySelector(`[data-task-id="${task.id}"]`);

    // Clic 1
    triageView.handleTriageRowClick(task.id, { stopPropagation: () => {}, target: row });
    // En este momento, no se ha seleccionado todavía (espera ventana de 250ms)
    expect(document.getElementById('triageFloatingBar').classList.contains('visible')).toBe(false);

    // Clic 2 inmediato (dentro de los 250ms)
    triageView.handleTriageRowClick(task.id, { stopPropagation: () => {}, target: row });

    // Debe abrir el modal de edición directamente
    const modal = document.getElementById('triageTaskEditModal');
    expect(modal).not.toBeNull();
    // La tarea NO debe quedar seleccionada en la barra flotante
    expect(document.getElementById('triageFloatingBar').classList.contains('visible')).toBe(false);
  });

  it('en la vista principal, renderTaskItem incluye ondblclick para iniciar edición', () => {
    const tasksV = TodayTasksTasksView({
      getState: () => state,
      getTaskEdit: () => null,
      getTaskElapsed: () => 0,
      formatDuration: () => '15m',
      computeSchedule: () => ({})
    });
    const task = { id: 'test-1', title: 'Tarea Principal', status: 'pending', planned: 15 };
    const html = tasksV.renderTaskItem(task, {}, null);
    expect(html).toContain('ondblclick="app.startEditTask(\'test-1\')"');
  });

  it('muestra las tareas recurrentes marcadas en la vista de triaje con clase is-recurring y botón tag', () => {
    // Tarea normal
    actions.addTask('Tarea Normal', '20', false, null, true, 'today');
    // Tarea recurrente
    const recTask = {
      id: 99,
      title: 'Daily Standup Recurrente',
      planned: 15,
      urgency: 'today',
      status: 'pending',
      isRecurring: true,
      ruleId: 'rule-daily-1'
    };
    state.tasks.push(recTask);

    triageView.renderTriageView();

    const normalRow = document.querySelector('[data-task-id="1"]');
    expect(normalRow).not.toBeNull();
    expect(normalRow.classList.contains('is-recurring')).toBe(false);
    expect(normalRow.querySelector('.triage-recurring-btn')).toBeNull();

    const recRow = document.querySelector('[data-task-id="99"]');
    expect(recRow).not.toBeNull();
    expect(recRow.classList.contains('is-recurring')).toBe(true);

    const recBtn = recRow.querySelector('.triage-recurring-btn');
    expect(recBtn).not.toBeNull();
    const iconMatches = (recBtn.textContent.match(/🔁/g) || []).length;
    expect(iconMatches).toBe(1);
    expect(recBtn.textContent).toContain('Recurrente');
    expect(recBtn.getAttribute('onclick')).toContain("app.openRecurringInfoPopover('99', event, 'task')");
  });

  it('el botón de regreso en la vista de triaje muestra el atajo en formato [X]', () => {
    triageView.renderTriageView();
    const backBtn = document.querySelector('.triage-btn-back');
    expect(backBtn).not.toBeNull();
    expect(backBtn.textContent.trim()).toBe('← Tablero [X]');
  });

  it('las acciones directas en triaje (estrella, urgencia, mover fecha) tienen efecto real sobre las tareas', () => {
    actions.addTask('Tarea Para Acciones', '25', false, null, true, 'today');
    const task = state.tasks[0];

    triageView.renderTriageView();

    // 1. Destacar tarea
    triageView.toggleTriageTaskStar(task.id, { stopPropagation: () => {} });
    expect(state.tasks[0].featured).toBe(true);

    // 2. Cambiar urgencia a "week"
    const mockBtn = document.createElement('button');
    mockBtn.getBoundingClientRect = () => ({ bottom: 50, left: 100 });
    triageView.openTriageSingleUrgency(task.id, { stopPropagation: () => {}, target: mockBtn, currentTarget: mockBtn });
    triageView.applyTriageSingleUrgency('week');
    expect(state.tasks[0].urgency).toBe('week');

    // 3. Mover tarea a otra fecha
    triageView.moveTriageTaskToDate(task.id, '2026-09-15', '15 sep', { stopPropagation: () => {} });
    // Al moverse a otra fecha, ya no está en las tareas de hoy
    expect(state.tasks.find(t => String(t.id) === String(task.id))).toBeUndefined();
    // Y está en el día destino
    const env = state.environments[state.activeEnv || 'work'];
    expect(env.days['2026-09-15'].tasks.some(t => String(t.id) === String(task.id))).toBe(true);
  });

  it('al borrar una tarea recurrente en triaje sólo se borra esa ocurrencia puntual sin eliminar la serie', () => {
    const env = state.environments[state.activeEnv || 'work'];
    const rule = { id: 'rule-daily-standup', title: 'Daily Standup', freq: 'daily', interval: 1, startDate: '2026-09-01' };
    env.recurringTasks = [rule];

    const todayStr = state.selectedDate || '2026-09-02';
    if (!env.days[todayStr]) env.days[todayStr] = { tasks: [], meetings: [] };

    const recTask = {
      id: 'rec-task-1',
      title: 'Daily Standup',
      planned: 15,
      urgency: 'today',
      status: 'pending',
      isRecurring: true,
      ruleId: 'rule-daily-standup'
    };
    state.tasks.push(recTask);
    env.days[todayStr].tasks.push(recTask);

    triageView.renderTriageView();

    // Ejecutamos el borrado directo desde el triaje
    triageView.deleteTriageSingleTask('rec-task-1', { stopPropagation: () => {} });

    // Se muestra el modal de recurrencia preguntando si borrar ocurrencia o serie
    const recModal = document.getElementById('recurringModal');
    expect(recModal).not.toBeNull();
    expect(recModal.style.display).toBe('flex');
    expect(document.getElementById('recurringModalTitle').textContent).toContain('Daily Standup');

    // Pulsamos "Solo esta ocurrencia"
    document.getElementById('recModalBtnInstance').click();

    // La ocurrencia se eliminó de state.tasks y del día
    expect(state.tasks.some(t => t.id === 'rec-task-1')).toBe(false);
    expect(env.days[todayStr].tasks.some(t => t.id === 'rec-task-1')).toBe(false);

    // Se registró la excepción de cancelación en la regla para este día
    expect(rule.exceptions[todayStr]).toEqual({ type: 'cancelled' });

    // La serie general NO fue eliminada
    expect(env.recurringTasks.some(r => r.id === 'rule-daily-standup')).toBe(true);
  });

  it('al borrar una tarea recurrente en triaje se puede eliminar toda la serie completa', () => {
    const env = state.environments[state.activeEnv || 'work'];
    const rule = { id: 'rule-series-standup', title: 'Serie Standup', freq: 'daily', interval: 1, startDate: '2026-09-01' };
    env.recurringTasks = [rule];

    const todayStr = state.selectedDate || '2026-09-02';
    if (!env.days[todayStr]) env.days[todayStr] = { tasks: [], meetings: [] };

    const recTask = {
      id: 'rec-task-series-1',
      title: 'Serie Standup',
      planned: 15,
      urgency: 'today',
      status: 'pending',
      isRecurring: true,
      ruleId: 'rule-series-standup'
    };
    state.tasks.push(recTask);
    env.days[todayStr].tasks.push(recTask);

    triageView.renderTriageView();

    // Borrado desde triaje
    triageView.deleteTriageSingleTask('rec-task-series-1', { stopPropagation: () => {} });

    // Pulsamos "Toda la serie recurrente"
    document.getElementById('recModalBtnSeries').click();

    // La regla de la serie completa fue eliminada
    expect(env.recurringTasks.some(r => r.id === 'rule-series-standup')).toBe(false);
    expect(state.tasks.some(t => t.id === 'rec-task-series-1')).toBe(false);
  });

  it('al hacer doble clic/tap sobre una tarea recurrente en triaje se pregunta si editar la ocurrencia o la serie', () => {
    const recTask = {
      id: 'rec-task-edit',
      title: 'Revisión Diaria Recurrente',
      planned: 20,
      urgency: 'today',
      status: 'pending',
      isRecurring: true,
      ruleId: 'rule-rev-1'
    };
    state.tasks.push(recTask);

    triageView.renderTriageView();

    const row = document.querySelector('[data-task-id="rec-task-edit"]');
    expect(row).not.toBeNull();

    // Doble clic en la fila de la tarea recurrente
    triageView.handleTriageRowDblClick('rec-task-edit', { stopPropagation: () => {}, target: row });

    // Se muestra el modal de recurrencia preguntando si editar la ocurrencia o la serie
    const recModal = document.getElementById('recurringModal');
    expect(recModal).not.toBeNull();
    expect(recModal.style.display).toBe('flex');
    expect(document.getElementById('recurringModalTitle').textContent).toContain('Revisión Diaria Recurrente');

    // Al seleccionar "Solo esta ocurrencia"
    const btnInstance = document.getElementById('recModalBtnInstance');
    btnInstance.click();

    // El modal de edición de triaje debe estar abierto en modo 'instance'
    const modal = document.getElementById('triageTaskEditModal');
    expect(modal).not.toBeNull();
    expect(modal.style.display).toBe('flex');

    const titleInput = document.getElementById('triageEditTitleInput');
    expect(titleInput).not.toBeNull();
    expect(titleInput.value).toBe('Revisión Diaria Recurrente');

    // Comprobamos que el modo sea 'instance'
    expect(taskEdit.mode).toBe('instance');
  });

  it('se actualiza cuando se cambia de fecha en la pestaña Tiempo mostrando las tareas del nuevo día', () => {
    // Tarea del día actual (hoy)
    actions.addTask('Tarea de Hoy', '30', false, null, true, 'today');

    // Tarea de otro día (fecha futura)
    const futureDate = '2026-09-10';
    const env = state.environments[state.activeEnv || 'work'];
    env.days[futureDate] = {
      tasks: [
        { id: 'task-future-1', title: 'Tarea del Futuro 10 Sep', planned: 45, urgency: 'today', status: 'pending' }
      ],
      meetings: []
    };

    // Renderizamos triaje inicialmente (día actual)
    triageView.renderTriageView();
    expect(document.querySelector('[data-task-id="1"]')).not.toBeNull();
    expect(document.querySelector('[data-task-id="task-future-1"]')).toBeNull();
    expect(document.querySelector('.triage-subtitle').textContent).toContain(state.selectedDate);

    // Cambiamos el día en la pestaña Tiempo usando actions.selectDate
    actions.selectDate(futureDate);

    // Comprobamos que el triaje se ha actualizado con la nueva fecha y sus tareas con planningMode OFF
    state.planningMode = false;
    triageView.renderTriageView();
    expect(state.selectedDate).toBe(futureDate);
    expect(document.querySelector('[data-task-id="task-future-1"]')).not.toBeNull();
    expect(document.querySelector('[data-task-id="1"]')).toBeNull();
    expect(document.querySelector('.triage-subtitle').textContent).toContain(futureDate);
    expect(document.querySelector('.triage-title-row').textContent).toContain('1 tarea');

    // Comprobamos que con planningMode ON también muestra las tareas de esa fecha seleccionada
    state.planningMode = true;
    triageView.renderTriageView();
    expect(document.querySelector('[data-task-id="task-future-1"]')).not.toBeNull();
    expect(document.querySelector('[data-task-id="1"]')).toBeNull();
    expect(document.querySelector('.triage-subtitle').textContent).toContain(futureDate);
  });

  it('en el modal de edición de tarea de triaje, se pueden abrir las opciones de urgencia y seleccionar un nuevo nivel', () => {
    actions.addTask('Tarea Urgencia Modal', '30', false, null, true, 'today');
    const task = state.tasks[0];

    triageView.renderTriageView();

    // Abrimos edición por doble clic
    triageView.handleTriageRowDblClick(task.id, { stopPropagation: () => {}, target: document.querySelector(`[data-task-id="${task.id}"]`) });

    const modal = document.getElementById('triageTaskEditModal');
    expect(modal).not.toBeNull();

    // Buscamos el botón de urgencia dentro del modal
    const urgencyPill = document.getElementById(`edit-urgency-pill-${task.id}`);
    expect(urgencyPill).not.toBeNull();

    // Abrimos las opciones de urgencia
    window.app.openEditUrgencyDropdown(task.id, { currentTarget: urgencyPill });

    // El menú de urgencia debe estar visible con las opciones disponibles
    const menu = document.getElementById('urgencyDropdownMenu');
    expect(menu).not.toBeNull();
    expect(menu.style.display).toBe('block');
    expect(menu.textContent).toContain('Hoy');
    expect(menu.textContent).toContain('Días');
    expect(menu.textContent).toContain('Semana');
    expect(menu.textContent).toContain('Más adelante');

    // Seleccionamos "week"
    window.app.selectTaskUrgency('week');

    // Se actualizó taskEdit.urgency y se cerró el menú
    expect(taskEdit.urgency).toBe('week');
    expect(menu.style.display).toBe('none');

    // Guardamos la tarea
    actions.saveEditTask(task.id);
    expect(state.tasks[0].urgency).toBe('week');
  });

  it('el popover de cambio de urgencia individual en triaje no desborda la pantalla y se posiciona hacia arriba si está cerca del fondo', () => {
    actions.addTask('Tarea Urgencia Posición', '30', false, null, true, 'today');
    const task = state.tasks[0];
    triageView.renderTriageView();

    const popover = document.getElementById('triageSingleUrgencyPopover');
    expect(popover).not.toBeNull();

    // Caso 1: Botón en la parte superior/media de la pantalla
    const btnMiddle = document.createElement('button');
    btnMiddle.getBoundingClientRect = () => ({ top: 100, bottom: 130, left: 50, right: 120, width: 70, height: 30 });
    window.innerHeight = 800;
    window.innerWidth = 1200;

    triageView.openTriageSingleUrgency(task.id, { stopPropagation: () => {}, target: btnMiddle, currentTarget: btnMiddle });
    expect(popover.style.display).toBe('block');
    expect(parseInt(popover.style.top, 10)).toBe(134); // 130 + 4
    expect(parseInt(popover.style.left, 10)).toBe(50);

    // Caso 2: Botón muy abajo en la pantalla (desbordaría por el fondo, debe colocarse arriba)
    const btnBottom = document.createElement('button');
    btnBottom.getBoundingClientRect = () => ({ top: 700, bottom: 730, left: 50, right: 120, width: 70, height: 30 });

    triageView.openTriageSingleUrgency(task.id, { stopPropagation: () => {}, target: btnBottom, currentTarget: btnBottom });
    const topPos = parseInt(popover.style.top, 10);
    // Debe haberse posicionado hacia arriba del botón (por encima de 700)
    expect(topPos).toBeLessThan(700);
    // Y el popover completo debe quedar dentro de la ventana
    expect(topPos + 175).toBeLessThanOrEqual(window.innerHeight);
    expect(topPos).toBeGreaterThanOrEqual(10);
  });

  it('permite completar una tarea individual directamente desde triaje', () => {
    actions.addTask('Tarea para completar', '25', false, null, true, 'today');
    const task = state.tasks[0];
    triageView.renderTriageView();

    const container = document.getElementById('view-triage');
    expect(container.innerHTML).toContain('Tarea para completar');

    // Pulsamos el botón de completar de la fila
    triageView.completeTriageSingleTask(task.id, { stopPropagation: () => {} });

    // La tarea pasa a estar completada y desaparece del triaje de tareas activas
    expect(task.status).toBe('completed');
    expect(task.completedAt).not.toBeNull();
    const updatedContainer = document.getElementById('view-triage');
    expect(updatedContainer.innerHTML).not.toContain('Tarea para completar');
  });

  it('permite completar múltiples tareas seleccionadas por lote en triaje', () => {
    actions.addTask('Tarea Batch 1', '15', false, null, true, 'today');
    actions.addTask('Tarea Batch 2', '30', false, null, true, 'today');
    actions.addTask('Tarea Batch 3', '45', false, null, true, 'today');

    const id1 = state.tasks[0].id;
    const id2 = state.tasks[1].id;
    const id3 = state.tasks[2].id;

    triageView.renderTriageView();

    // Seleccionamos la 1 y la 2
    triageView.toggleTriageTaskSelect(id1);
    triageView.toggleTriageTaskSelect(id2);

    // Ejecutamos completar por lote
    triageView.executeTriageBatchComplete();

    // Las tareas 1 y 2 quedan completadas
    expect(state.tasks.find(t => t.id === id1).status).toBe('completed');
    expect(state.tasks.find(t => t.id === id2).status).toBe('completed');
    // La tarea 3 sigue pendiente
    expect(state.tasks.find(t => t.id === id3).status).toBe('pending');

    // En triaje solo permanece la Tarea Batch 3
    const container = document.getElementById('view-triage');
    expect(container.innerHTML).not.toContain('Tarea Batch 1');
    expect(container.innerHTML).not.toContain('Tarea Batch 2');
    expect(container.innerHTML).toContain('Tarea Batch 3');
  });

  it('renderiza el botón de Orden automático en la cabecera de triaje y permite restablecer el orden', () => {
    actions.addTask('Later Task', '30', false, null, true, 'later');
    actions.addTask('Today Task', '30', false, null, true, 'today');

    // Forzar un orden manual donde 'later' está primera
    state.tasks[0].manualOrder = 1;
    state.tasks[0].order = 1;
    state.tasks[1].manualOrder = 2;
    state.tasks[1].order = 2;

    triageView.renderTriageView();
    const btn = document.getElementById('triageAutoOrderBtn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Orden automático');

    // Ejecutamos la acción de orden automático de triaje
    triageView.applyAutoOrder();

    // Las anclas deben haberse eliminado y la tarea 'today' debe ser la primera
    expect(state.tasks.every(t => t.manualOrder === null)).toBe(true);
    expect(state.tasks[0].urgency).toBe('today');
    expect(state.tasks[1].urgency).toBe('later');
  });
});

describe('Triage Keyboard Shortcut X', () => {
  it('alterna hacia #/triage y vuelve a #/ al pulsar la tecla X', () => {
    window.location.hash = '#/';
    let currentHash = '#/';

    const ctx = {
      getState: () => ({ activeInterruption: null }),
      actionsModule: {},
      routerModule: {
        getCurrentView: () => (window.location.hash === '#/triage' ? 'triage' : 'main')
      },
      undoModule: { undo: () => {}, redo: () => {} }
    };

    TodayTasksShortcuts(ctx);

    // Pulsamos X desde la vista principal
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(window.location.hash).toBe('#/triage');

    // Pulsamos X de nuevo estando en #/triage
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'X' }));
    expect(window.location.hash).toBe('#/');
  });
});


