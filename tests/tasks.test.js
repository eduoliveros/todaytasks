import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TodayTasksActions - Tareas', () => {
  let actions;
  let state;
  let taskEdit = null;
  let notifyState = { taskId: null };
  let idCounter = 1;

  beforeEach(async () => {
    window.TodayTasksUi = { showToast: () => {}, renderAll: () => {} };
    window.alert = vi.fn();

    await import('../js/utils.js');
    await import('../js/state.js');
    await import('../js/actions.js');

    state = window.TodayTasksState.defaultState();
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

    actions = window.TodayTasksActions(ctx);
  });

  describe('Creación de tareas', () => {
    it('añade una tarea con duración especificada', () => {
      actions.addTask('Diseñar interfaz', '45');
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0]).toMatchObject({
        title: 'Diseñar interfaz',
        planned: 45,
        status: 'pending',
        order: 1
      });
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

    it('cancela la edición de una tarea sin aplicar cambios', () => {
      actions.addTask('Tarea Intacta', '30');
      const taskId = state.tasks[0].id;

      actions.startEditTask(taskId);
      actions.updateTaskEditField('title', 'Intento Cambiar');
      actions.cancelEditTask();

      expect(state.tasks[0].title).toBe('Tarea Intacta');
      expect(taskEdit).toBeNull();
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
  });

  describe('Ciclo de vida de ejecución de tareas', () => {
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
      const today = window.TodayTasksUtils.getTodayStr();
      state.selectedDate = today;

      // Retroceder 1 día
      actions.changeDateByDays(-1);
      const expectedPrev = window.TodayTasksUtils.addDays(today, -1);
      expect(state.selectedDate).toBe(expectedPrev);

      // Avanzar 2 días
      actions.changeDateByDays(2);
      const expectedNext = window.TodayTasksUtils.addDays(today, 1);
      expect(state.selectedDate).toBe(expectedNext);
    });
  });
});
