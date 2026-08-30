import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { TodayTasksActions } from '../js/actions.js';
import * as utils from '../js/utils.js';

const { getTodayStr, addDays, getTaskElapsed } = utils;

describe('TodayTasksActions - Tareas', () => {
  let actions;
  let state;
  let taskEdit = null;
  let notifyState = { taskId: null };
  let idCounter = 1;

  beforeEach(() => {
    window.alert = vi.fn();

    state = defaultState();
    idCounter = 1;
    taskEdit = null;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => null,
      setMeetingEdit: () => {},
      getTaskEdit: () => taskEdit,
      setTaskEdit: (t) => { taskEdit = t; },
      setNotifyState: (n) => { notifyState = n; },
      getNotifyState: () => notifyState,
      saveState: () => {},
      newId: () => idCounter++,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {}
    };

    actions = TodayTasksActions(ctx);
  });

  describe('Creación de tareas', () => {
    it('añade una tarea con duración especificada en minutos numéricos', () => {
      actions.addTask('Diseñar interfaz', '45');
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0]).toMatchObject({
        title: 'Diseñar interfaz',
        planned: 45,
        status: 'pending',
        order: 1
      });
    });

    it('añade una tarea con duración en formato horas y minutos ("1h 30m", "1h", "45m", "1.5h")', () => {
      actions.addTask('Reunión arquitectura', '1h 30m');
      actions.addTask('Planificación', '2h');
      actions.addTask('Code review', '45m');
      actions.addTask('Testing', '1.5h');

      expect(state.tasks).toHaveLength(4);
      expect(state.tasks[0].planned).toBe(90);
      expect(state.tasks[1].planned).toBe(120);
      expect(state.tasks[2].planned).toBe(45);
      expect(state.tasks[3].planned).toBe(90);
    });

    it('asigna duración por defecto (30 min) si no se especifica duración válida', () => {
      actions.addTask('Revisar correo', '');
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].planned).toBe(30);
    });

    it('muestra alerta si se intenta añadir tarea sin título', () => {
      actions.addTask('', '30');
      expect(window.alert).toHaveBeenCalledWith('Indica un título para la tarea.');
      expect(state.tasks).toHaveLength(0);
    });

    it('añade una tarea con hora mínima de inicio (startAfter)', () => {
      actions.addTask('Tarea con Hora', '30', false, null, true, 'days', false, '16:00');
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].startAfter).toBe(960);
    });

    it('añade una tarea recurrente con hora mínima de inicio (startAfter)', () => {
      const recData = { isRecurring: true, freq: 'daily', interval: 1, daysOfWeek: [1, 2, 3] };
      actions.addTask('Tarea Recurrente con Hora', '45', false, recData, true, 'days', false, '10:30');
      expect(state.recurringTasks).toHaveLength(1);
      expect(state.recurringTasks[0].startAfter).toBe(630);
    });
  });

  describe('Edición de tareas', () => {
    it('inicia, modifica y guarda la edición de una tarea', () => {
      actions.addTask('Tarea Original', '30');
      const taskId = state.tasks[0].id;

      actions.startEditTask(taskId);
      expect(taskEdit).toMatchObject({
        id: taskId,
        title: 'Tarea Original',
        duration: '30'
      });

      actions.updateTaskEditField('title', 'Tarea Modificada');
      actions.updateTaskEditField('duration', '60');
      actions.saveEditTask(taskId);

      expect(state.tasks[0].title).toBe('Tarea Modificada');
      expect(state.tasks[0].planned).toBe(60);
      expect(taskEdit).toBeNull();
    });

    it('modifica y guarda la duración usando formatos como "1h 45m"', () => {
      actions.addTask('Tarea Original', '30');
      const taskId = state.tasks[0].id;

      actions.startEditTask(taskId);
      actions.updateTaskEditField('duration', '1h 45m');
      actions.saveEditTask(taskId);

      expect(state.tasks[0].planned).toBe(105);
      expect(taskEdit).toBeNull();
    });

    it('cancela la edición de una tarea sin aplicar cambios', () => {
      actions.addTask('Tarea Intacta', '30');
      const taskId = state.tasks[0].id;

      actions.startEditTask(taskId);
      actions.updateTaskEditField('title', 'Intento Cambiar');
      actions.cancelEditTask();

      expect(state.tasks[0].title).toBe('Tarea Intacta');
      expect(taskEdit).toBeNull();
    });

    it('modifica y guarda la hora de inicio mínima (startAfter) en la edición de tarea', () => {
      actions.addTask('Tarea Con Hora', '30');
      const taskId = state.tasks[0].id;

      actions.startEditTask(taskId);
      expect(taskEdit.startAfter).toBe('');

      actions.updateTaskEditField('startAfter', '15:30');
      actions.saveEditTask(taskId);

      expect(state.tasks[0].startAfter).toBe(930); // 15*60 + 30 = 930 min

      // Comprobar que al volver a editar se carga el formato HH:MM
      actions.startEditTask(taskId);
      expect(taskEdit.startAfter).toBe('15:30');

      // Comprobar que al vaciar el campo se borra la restricción
      actions.updateTaskEditField('startAfter', '');
      actions.saveEditTask(taskId);
      expect(state.tasks[0].startAfter).toBeNull();
    });

    it('establece y elimina startAfter directamente mediante setTaskStartAfter', () => {
      actions.addTask('Tarea Popover', '45');
      const taskId = state.tasks[0].id;

      actions.setTaskStartAfter(taskId, '16:00');
      expect(state.tasks[0].startAfter).toBe(960);

      actions.setTaskStartAfter(taskId, null);
      expect(state.tasks[0].startAfter).toBeNull();

      actions.setTaskStartAfter(taskId, 600); // 10:00
      expect(state.tasks[0].startAfter).toBe(600);
    });

    it('al cambiar startAfter en una tarea recurrente mediante setTaskStartAfter se actualiza la regla y todas las instancias en todos los días', () => {
      const recData = { isRecurring: true, freq: 'daily', interval: 1, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] };
      actions.addTask('Daily Standup', '15', false, recData, true, 'days', false, '09:30');

      const env = state.environments[state.activeEnv || 'work'];
      const rule = env.recurringTasks[0];
      expect(rule.startAfter).toBe(570); // 09:30

      // Crear instancias simuladas en dos días distintos
      env.days['2026-08-30'] = { tasks: [{ id: 101, ruleId: rule.id, title: 'Daily Standup', startAfter: 570 }] };
      env.days['2026-08-31'] = { tasks: [{ id: 102, ruleId: rule.id, title: 'Daily Standup', startAfter: 570 }] };
      state.tasks = env.days['2026-08-30'].tasks;

      // Cambiar hora en la tarea de hoy a las 11:00 (660 min)
      actions.setTaskStartAfter(101, '11:00');

      // Comprobar que se actualizó la tarea actual
      expect(state.tasks[0].startAfter).toBe(660);
      // Comprobar que se actualizó la regla de la serie
      expect(rule.startAfter).toBe(660);
      // Comprobar que se actualizó la instancia del día de mañana
      expect(env.days['2026-08-31'].tasks[0].startAfter).toBe(660);
    });

    it('al editar una tarea recurrente en modo series se propaga startAfter a la regla y todas las instancias', () => {
      const recData = { isRecurring: true, freq: 'daily', interval: 1, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] };
      actions.addTask('Sync Equipo', '30', false, recData, true, 'days', false, '10:00');

      const env = state.environments[state.activeEnv || 'work'];
      const rule = env.recurringTasks[0];

      env.days['2026-08-30'] = { tasks: [{ id: 201, ruleId: rule.id, title: 'Sync Equipo', planned: 30, startAfter: 600 }] };
      env.days['2026-08-31'] = { tasks: [{ id: 202, ruleId: rule.id, title: 'Sync Equipo', planned: 30, startAfter: 600 }] };
      state.tasks = env.days['2026-08-30'].tasks;

      // Simular edición en modo series
      taskEdit = {
        id: 201,
        ruleId: rule.id,
        mode: 'series',
        title: 'Sync Equipo Refactor',
        duration: '45',
        actual: '0',
        startAfter: '14:30'
      };

      actions.saveEditTask(201);

      expect(rule.startAfter).toBe(870); // 14:30
      expect(rule.title).toBe('Sync Equipo Refactor');
      expect(env.days['2026-08-30'].tasks[0].startAfter).toBe(870);
      expect(env.days['2026-08-31'].tasks[0].startAfter).toBe(870);
    });
  });

  describe('Reordenación de tareas', () => {
    it('mueve una tarea arriba o abajo en la lista', () => {
      actions.addTask('Primera', '30');
      actions.addTask('Segunda', '30');

      const id1 = state.tasks[0].id;
      const id2 = state.tasks[1].id;

      expect(state.tasks.find(t => t.id === id1).order).toBe(1);
      expect(state.tasks.find(t => t.id === id2).order).toBe(2);

      // Mover 'Segunda' hacia arriba (dir = -1)
      actions.moveTask(id2, -1);

      expect(state.tasks.find(t => t.id === id2).order).toBe(1);
      expect(state.tasks.find(t => t.id === id1).order).toBe(2);
    });

    it('añade una tarea al inicio (arriba) si se indica toTop = true', () => {
      actions.addTask('Primera', '30');
      actions.addTask('Segunda', '30');
      actions.addTask('Tercera al inicio', '30', true);

      expect(state.tasks).toHaveLength(3);
      const t3 = state.tasks.find(t => t.title === 'Tercera al inicio');
      const t1 = state.tasks.find(t => t.title === 'Primera');
      const t2 = state.tasks.find(t => t.title === 'Segunda');

      expect(t3.order).toBe(1);
      expect(t1.order).toBe(2);
      expect(t2.order).toBe(3);
    });

    it('ajusta el scroll con window.scrollBy para mantener el cursor sobre la flecha pulsada', () => {
      window.scrollBy = vi.fn();
      actions.addTask('Primera', '30');
      actions.addTask('Segunda', '30');
      const id2 = state.tasks[1].id;

      // Crear elementos DOM simulados
      document.body.innerHTML = `
        <div id="tasksList">
          <div class="task-item" data-task-id="${id2}">
            <div class="order-controls">
              <button class="icon-btn" title="Subir" data-action="move-up" data-task-id="${id2}">▲</button>
            </div>
          </div>
        </div>
      `;

      const btn = document.querySelector(`button[data-task-id="${id2}"]`);
      let callCount = 0;
      btn.getBoundingClientRect = vi.fn(() => {
        callCount++;
        // Primera llamada (antes de render): top = 500
        // Segunda llamada (después de render): top = 420 (subió 80px)
        return { top: callCount === 1 ? 500 : 420, left: 200, bottom: 530, right: 230, width: 30, height: 30 };
      });

      actions.moveTask(id2, -1);

      expect(window.scrollBy).toHaveBeenCalledWith(expect.objectContaining({
        top: -80,
        left: 0,
        behavior: 'instant'
      }));
    });
  });

  describe('Ciclo de vida de ejecución de tareas', () => {
    it('desplaza el scroll un poco por encima de la tarea al iniciarla', () => {
      window.scrollTo = vi.fn();
      window.scrollY = 400;

      actions.addTask('Tarea en cola', '30');
      const taskId = state.tasks[0].id;

      document.body.innerHTML = `
        <div id="tasksList">
          <div class="task-item" data-task-id="${taskId}"></div>
        </div>
      `;
      const taskEl = document.querySelector(`[data-task-id="${taskId}"]`);
      taskEl.getBoundingClientRect = vi.fn(() => ({
        top: 200,
        left: 50,
        bottom: 280,
        right: 350,
        width: 300,
        height: 80
      }));

      actions.startTask(taskId);

      // currentScrollY (400) + rect.top (200) - offset (60) = 540
      expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({
        top: 540,
        behavior: 'smooth'
      }));
    });

    it('inicia, pausa, reanuda y completa una tarea', () => {
      actions.addTask('Tarea en ejecucion', '30');
      const taskId = state.tasks[0].id;

      // Iniciar
      actions.startTask(taskId);
      expect(state.tasks[0].status).toBe('running');
      expect(state.tasks[0].runningStart).not.toBeNull();

      // Pausar
      actions.pauseTask(taskId);
      expect(state.tasks[0].status).toBe('paused');
      expect(state.tasks[0].runningStart).toBeNull();

      // Reanudar (startTask)
      actions.resumeTask(taskId);
      expect(state.tasks[0].status).toBe('running');

      // Completar
      actions.completeTask(taskId);
      expect(state.tasks[0].status).toBe('completed');
      expect(state.tasks[0].completedAt).toBeDefined();

      // Des-completar
      actions.uncompleteTask(taskId);
      expect(state.tasks[0].status).toBe('pending');
    });

    it('funciona correctamente con IDs de tipo string o alfanumérico', () => {
      state.tasks = [
        { id: 'rec_task_294', title: 'Tarea recurrente', planned: 30, status: 'pending', runningStart: null, elapsedBefore: 0, order: 1 }
      ];

      actions.startTask('rec_task_294');
      expect(state.tasks[0].status).toBe('running');
      expect(state.tasks[0].runningStart).not.toBeNull();

      actions.pauseTask('rec_task_294');
      expect(state.tasks[0].status).toBe('paused');

      actions.resumeTask('rec_task_294');
      expect(state.tasks[0].status).toBe('running');

      actions.completeTask('rec_task_294');
      expect(state.tasks[0].status).toBe('completed');

      actions.uncompleteTask('rec_task_294');
      expect(state.tasks[0].status).toBe('pending');
    });

    it('permite iniciar directamente una tarea completada reabriéndola y poniéndola en marcha', () => {
      state.tasks = [
        { id: 294, title: 'Tarea completada', planned: 30, status: 'completed', actualDuration: 20, completedAt: 600, order: 1 }
      ];

      actions.startTask(294);
      expect(state.tasks[0].status).toBe('running');
      expect(state.tasks[0].runningStart).not.toBeNull();
      expect(state.tasks[0].elapsedBefore).toBe(20);
    });
  });


  describe('Eliminación de tareas', () => {
    it('elimina una tarea existente de la lista', () => {
      actions.addTask('Tarea a borrar', '30');
      const taskId = state.tasks[0].id;

      actions.deleteTask(taskId);
      expect(state.tasks).toHaveLength(0);
    });
  });

  describe('Navegación de fechas (changeDateByDays)', () => {
    it('avanza y retrocede días correctamente', () => {
      const today = getTodayStr();
      state.selectedDate = today;

      // Retroceder 1 día
      actions.changeDateByDays(-1);
      const expectedPrev = addDays(today, -1);
      expect(state.selectedDate).toBe(expectedPrev);

      // Avanzar 2 días
      actions.changeDateByDays(2);
      const expectedNext = addDays(today, 1);
      expect(state.selectedDate).toBe(expectedNext);
    });
  });

  describe('Tareas recurrentes', () => {
    it('crea una regla recurrente y la materializa en el día actual', () => {
      const today = getTodayStr();
      state.selectedDate = today;

      // Force daily recurrence to ensure today matches
      actions.addTask('Daily standup', '15', false, {
        isRecurring: true,
        freq: 'daily',
        interval: 1,
        daysOfWeek: [],
        endDate: null
      });

      // Rule created in env
      expect(state.recurringTasks).toHaveLength(1);
      expect(state.recurringTasks[0].title).toBe('Daily standup');
      expect(state.recurringTasks[0].planned).toBe(15);

      // Materialized in today's tasks
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].ruleId).toBe(state.recurringTasks[0].id);
      expect(state.tasks[0].isRecurring).toBe(true);
    });

    it('no materializa duplicados si ya existe la tarea en el día', () => {
      const today = getTodayStr();
      state.selectedDate = today;

      actions.addTask('Standup', '10', false, {
        isRecurring: true, freq: 'daily', interval: 1, daysOfWeek: [], endDate: null
      });

      // Call materialize again explicitly — should not duplicate
      actions.materializeRecurringTasks();

      expect(state.tasks).toHaveLength(1);
    });

    it('no materializa si existe excepción cancelled para esa fecha', () => {
      const today = getTodayStr();
      state.selectedDate = today;

      actions.addTask('Cancelable', '20', false, {
        isRecurring: true, freq: 'daily', interval: 1, daysOfWeek: [], endDate: null
      });

      const ruleId = state.recurringTasks[0].id;
      const materializedId = state.tasks[0].id;

      // Delete instance (adds cancelled exception and removes from tasks)
      // We need to simulate deleteRecurringTaskInstance by using deleteTask which will show modal
      // Instead, directly test the state manipulation:
      const envKey = state.activeEnv || 'work';
      const env = state.environments[envKey];
      const rule = env.recurringTasks[0];
      rule.exceptions[today] = { type: 'cancelled' };
      env.days[today].tasks = env.days[today].tasks.filter(t => t.ruleId !== ruleId);

      // Now try to materialize again — should not re-add due to cancelled exception
      actions.materializeRecurringTasks();

      expect(state.tasks).toHaveLength(0);
    });

    it('al editar la serie se actualiza el título en la regla', () => {
      const today = getTodayStr();
      state.selectedDate = today;

      actions.addTask('Revisión semanal', '60', false, {
        isRecurring: true, freq: 'daily', interval: 1, daysOfWeek: [], endDate: null
      });

      const taskId = state.tasks[0].id;
      const ruleId = state.recurringTasks[0].id;

      // Set taskEdit in series mode (simulating user clicked "Toda la serie")
      taskEdit = { id: taskId, ruleId, mode: 'series', title: 'Nueva revisión', duration: '45' };

      actions.saveEditTask(taskId);

      // Rule updated
      expect(state.recurringTasks[0].title).toBe('Nueva revisión');
      expect(state.recurringTasks[0].planned).toBe(45);

      // Current materialized task also updated
      expect(state.tasks[0].title).toBe('Nueva revisión');
      expect(state.tasks[0].planned).toBe(45);
    });

    it('al eliminar toda la serie se borra la regla y todas las instancias', () => {
      const today = getTodayStr();
      state.selectedDate = today;

      actions.addTask('Tarea serie', '30', false, {
        isRecurring: true, freq: 'daily', interval: 1, daysOfWeek: [], endDate: null
      });

      const ruleId = state.recurringTasks[0].id;

      // Simulate deleteRecurringTaskSeries directly via the state
      const envKey = state.activeEnv || 'work';
      const env = state.environments[envKey];
      env.recurringTasks = env.recurringTasks.filter(r => r.id !== ruleId);
      Object.values(env.days || {}).forEach(dayObj => {
        if (Array.isArray(dayObj.tasks)) {
          dayObj.tasks = dayObj.tasks.filter(t => t.ruleId !== ruleId);
        }
      });

      expect(state.recurringTasks).toHaveLength(0);
      expect(state.tasks).toHaveLength(0);
    });
  });

  describe('Actualización de tiempo transcurrido / real (Opción A y Opción C)', () => {
    it('actualiza el tiempo transcurrido en una tarea parada (pendiente o en pausa)', () => {
      actions.addTask('Tarea Parada', '30');
      const taskId = state.tasks[0].id;

      actions.startEditTask(taskId);
      expect(taskEdit.actual).toBe('0');

      actions.updateTaskEditField('actual', '15');
      actions.saveEditTask(taskId);

      expect(state.tasks[0].elapsedBefore).toBe(15);
      expect(getTaskElapsed(state.tasks[0])).toBe(15);
    });

    it('actualiza el tiempo transcurrido en una tarea en ejecución reiniciando runningStart para evitar acumulados erróneos', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1, 8, 20, 0)); // 08:20 = 500 min

      actions.addTask('Tarea En Ejecución', '40');
      const taskId = state.tasks[0].id;

      // Start task at minute 500
      actions.startTask(taskId);
      expect(state.tasks[0].status).toBe('running');
      expect(state.tasks[0].runningStart).toBe(500);

      // Fast forward 7 minutes (minute 507) -> elapsed is 7
      vi.setSystemTime(new Date(2026, 0, 1, 8, 27, 0)); // 08:27 = 507 min
      expect(getTaskElapsed(state.tasks[0])).toBe(7);

      // User updates elapsed time to 10 min via fast update (popover or edit)
      actions.updateTaskTimeFast(taskId, '10');

      // Verify elapsedBefore is 10 and runningStart is reset to current minute (507)
      expect(state.tasks[0].elapsedBefore).toBe(10);
      expect(state.tasks[0].runningStart).toBe(507);

      // Total elapsed immediately after update must be 10 (NOT 17!)
      expect(getTaskElapsed(state.tasks[0])).toBe(10);

      vi.useRealTimers();
    });

    it('redondea valores con flotantes largos a máximo 1 decimal', () => {
      actions.addTask('Tarea Flotante', '30');
      const taskId = state.tasks[0].id;

      actions.updateTaskTimeFast(taskId, '7.5499999999999545');

      expect(state.tasks[0].elapsedBefore).toBe(7.5);
      expect(getTaskElapsed(state.tasks[0])).toBe(7.5);
    });

    it('permite actualizar tiempo consumido rápido usando formatos como "1h 10m"', () => {
      actions.addTask('Tarea Larga', '120');
      const taskId = state.tasks[0].id;

      actions.updateTaskTimeFast(taskId, '1h 10m');

      expect(state.tasks[0].elapsedBefore).toBe(70);
      expect(getTaskElapsed(state.tasks[0])).toBe(70);
    });

    it('actualiza correctamente el tiempo en una tarea completada', () => {
      actions.addTask('Tarea Completada', '30');
      const taskId = state.tasks[0].id;

      actions.startTask(taskId);
      actions.completeTask(taskId);

      expect(state.tasks[0].status).toBe('completed');

      actions.updateTaskTimeFast(taskId, '25');

      expect(state.tasks[0].actualDuration).toBe(25);
      expect(getTaskElapsed(state.tasks[0])).toBe(25);
    });
  });
});

