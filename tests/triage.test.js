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
    actions.addTask('Tarea A', '15');
    actions.addTask('Tarea B', '30');
    actions.addTask('Tarea C', '45');

    const idsToMove = [state.tasks[0].id, state.tasks[2].id];
    const targetDate = '2026-09-04';

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
import { TodayTasksShortcuts } from '../js/app/shortcuts.js';
import { TodayTasksRouter } from '../js/router.js';

describe('TodayTasksTriageView (UI & Sorting & Selection)', () => {
  let triageView;
  let state;
  let actions;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="view-main"></div>
      <div id="view-triage" style="display:none;"></div>
      <div id="floatingBatchBar"></div>
    `;

    state = defaultState();
    let idCounter = 1;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => null,
      setTaskEdit: () => {},
      getNotifyState: () => ({ taskId: null }),
      setNotifyState: () => {},
      saveState: () => {},
      newId: () => idCounter++,
      getCurrentView: () => 'triage',
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {},
      actionsModule: null,
      undoModule: { pushSnapshot: () => {} }
    };

    actions = TodayTasksActions(ctx);
    ctx.actionsModule = actions;

    triageView = TodayTasksTriageView(ctx);
    window.app = { ...triageView, ...actions };
  });

  it('renderiza la vista de triaje sin recuadro azul de ayuda y con orden ascendente de duración', () => {
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

    // Comprobamos que dentro del grupo 'today', el orden sea Corta (10m) -> Media (30m) -> Larga (60m)
    const taskTitles = Array.from(container.querySelectorAll('#triage-group-today .triage-task-title'))
      .map(el => el.textContent.trim());
    expect(taskTitles).toEqual(['Corta', 'Media', 'Larga']);

    // Comprobamos que cada fila tenga sus 5 botones rápidos de días laborables
    const quickDaysButtons = container.querySelectorAll('.triage-task-row .triage-quick-day-btn');
    expect(quickDaysButtons.length).toBeGreaterThanOrEqual(15); // 3 tareas * 5 botones
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

    triageView.setTriageSortMode('featured');
    container = document.getElementById('view-triage');
    expect(container.textContent).toContain('Tareas Destacadas');
    expect(container.textContent).toContain('Otras tareas en cola');
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


