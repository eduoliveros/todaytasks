import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TodayTasksActions - Reuniones (Simples y Recurrentes)', () => {
  let actions;
  let state;
  let meetingEdit = null;
  let idCounter = 1;

  beforeEach(async () => {
    window.TodayTasksUi = { showToast: () => {}, renderAll: () => {} };
    window.alert = vi.fn();

    await import('../js/utils.js');
    await import('../js/state.js');
    await import('../js/actions.js');

    state = window.TodayTasksState.defaultState();
    idCounter = 1;
    meetingEdit = null;

    const ctx = {
      getState: () => state,
      setState: (s) => { state = s; },
      getMeetingEdit: () => meetingEdit,
      setMeetingEdit: (m) => { meetingEdit = m; },
      getTaskEdit: () => null,
      setTaskEdit: () => {},
      setNotifyState: () => {},
      getNotifyState: () => ({ taskId: null }),
      saveState: () => {},
      newId: () => idCounter++,
      getCurrentView: () => 'main',
      getFocusTaskId: () => null,
      renderAll: () => {},
      smartRender: () => {}
    };

    actions = window.TodayTasksActions(ctx);
  });

  describe('Reuniones Puntuales (Simples)', () => {
    it('añade una reunión puntual', () => {
      actions.addMeeting('Sincro Equipo', '10:00', '11:00');
      expect(state.meetings).toHaveLength(1);
      expect(state.meetings[0]).toMatchObject({
        title: 'Sincro Equipo',
        start: 600, // 10:00
        end: 660    // 11:00
      });
    });

    it('valida que la hora de fin sea posterior a la de inicio', () => {
      actions.addMeeting('Error Horario', '11:00', '10:00');
      expect(window.alert).toHaveBeenCalled();
      expect(state.meetings).toHaveLength(0);
    });

    it('edita y guarda una reunión puntual', () => {
      actions.addMeeting('Original', '10:00', '10:30');
      const mId = state.meetings[0].id;

      actions.startEditMeeting(mId);
      expect(meetingEdit).toMatchObject({
        id: mId,
        mode: 'single',
        title: 'Original'
      });

      actions.updateMeetingEditField('title', 'Reunión Modificada');
      actions.updateMeetingEditField('end', '11:00');
      actions.saveEditMeeting(mId);

      expect(state.meetings[0].title).toBe('Reunión Modificada');
      expect(state.meetings[0].end).toBe(660);
      expect(meetingEdit).toBeNull();
    });

    it('elimina una reunión puntual', () => {
      actions.addMeeting('Para borrar', '09:00', '09:30');
      const mId = state.meetings[0].id;

      actions.deleteMeeting(mId);
      expect(state.meetings).toHaveLength(0);
    });
  });

  describe('Reuniones Recurrentes - Tipos de Frecuencia', () => {
    it('crea una reunión recurrente diaria (daily)', () => {
      actions.addMeeting('Standup Diaria', '09:15', '09:30', {
        isRecurring: true,
        freq: 'daily',
        interval: 1
      });

      expect(state.recurringMeetings).toHaveLength(1);
      const rule = state.recurringMeetings[0];
      expect(rule).toMatchObject({
        title: 'Standup Diaria',
        freq: 'daily',
        interval: 1,
        start: 555,
        end: 570
      });

      // Debe aparecer en las reuniones del día actual
      expect(state.meetings).toHaveLength(1);
      expect(state.meetings[0].title).toBe('Standup Diaria');
      expect(state.meetings[0].isRecurring).toBe(true);
    });

    it('crea una reunión recurrente semanal (weekly) en días específicos', () => {
      state.selectedDate = '2026-08-05'; // Miércoles
      actions.addMeeting('Reunión Lunes y Miércoles', '11:00', '12:00', {
        isRecurring: true,
        freq: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3] // Lunes (1) y Miércoles (3)
      });

      expect(state.recurringMeetings).toHaveLength(1);

      // Simular prueba en un Miércoles ("2026-08-05")
      state.selectedDate = '2026-08-05'; // Miércoles
      expect(state.meetings).toHaveLength(1);

      // Simular prueba en un Jueves ("2026-08-06") -> No debe aparecer
      state.selectedDate = '2026-08-06'; // Jueves
      expect(state.meetings).toHaveLength(0);
    });

    it('crea una reunión recurrente cada N semanas (custom_weeks)', () => {
      state.selectedDate = '2026-08-05';
      actions.addMeeting('Sprint Review Bisemanal', '16:00', '17:00', {
        isRecurring: true,
        freq: 'custom_weeks',
        interval: 2,
        daysOfWeek: [3] // Miércoles
      });

      // Primera semana (2026-08-05 - Miércoles de inicio) -> Sí aparece
      state.selectedDate = '2026-08-05';
      expect(state.meetings).toHaveLength(1);

      // Siguiente semana (2026-08-12 - Miércoles +1 semana) -> No aparece por intervalo 2
      state.selectedDate = '2026-08-12';
      expect(state.meetings).toHaveLength(0);

      // Dos semanas después (2026-08-19 - Miércoles +2 semanas) -> Vuelve a aparecer
      state.selectedDate = '2026-08-19';
      expect(state.meetings).toHaveLength(1);
    });
  });

  describe('Reuniones Recurrentes - Manejo de Excepciones y Modificaciones', () => {
    beforeEach(() => {
      // Crear una reunión diaria de base a partir del 2026-08-05
      state.selectedDate = '2026-08-05';
      actions.addMeeting('Checkin Diario', '09:00', '09:30', {
        isRecurring: true,
        freq: 'daily',
        interval: 1
      });
    });

    it('cancela solo una ocurrencia puntual (excepción cancelled)', () => {
      const recId = state.meetings[0].id;
      const ruleId = state.meetings[0].ruleId || recId;

      // Simular modal seleccionando cancelar solo la ocurrencia del día "2026-08-05"
      const dateStr = '2026-08-05';
      state.selectedDate = dateStr;

      // Simular acción de cancelar ocurrencia directamente
      const rule = state.recurringMeetings.find(r => r.id === ruleId);
      rule.exceptions[dateStr] = { type: 'cancelled' };

      // En el día 2026-08-05 ya no debe aparecer
      expect(state.meetings).toHaveLength(0);

      // En el día 2026-08-06 debe seguir apareciendo
      state.selectedDate = '2026-08-06';
      expect(state.meetings).toHaveLength(1);
    });

    it('modifica solo una ocurrencia puntual (excepción modified)', () => {
      const recId = state.meetings[0].id;
      const ruleId = state.meetings[0].ruleId || recId;
      const dateStr = '2026-08-05';

      // Configurar edición en modo 'instance' (solo una ocurrencia)
      meetingEdit = {
        id: recId,
        ruleId: ruleId,
        mode: 'instance',
        dateStr: dateStr,
        title: 'Checkin Diario (Especial)',
        start: '10:00',
        end: '10:30'
      };

      actions.saveEditMeeting(recId);

      // El día 2026-08-05 tiene el título y horario modificado
      state.selectedDate = '2026-08-05';
      expect(state.meetings[0].title).toBe('Checkin Diario (Especial)');
      expect(state.meetings[0].start).toBe(600); // 10:00

      // El día 2026-08-06 conserva el título y horario original
      state.selectedDate = '2026-08-06';
      expect(state.meetings[0].title).toBe('Checkin Diario');
      expect(state.meetings[0].start).toBe(540); // 09:00
    });

    it('modifica toda la serie recurrente (mode: series)', () => {
      const recId = state.meetings[0].id;
      const ruleId = state.meetings[0].ruleId || recId;

      meetingEdit = {
        id: recId,
        ruleId: ruleId,
        mode: 'series',
        dateStr: '2026-08-05',
        title: 'Nuevo Título Serie',
        start: '12:00',
        end: '12:30'
      };

      actions.saveEditMeeting(recId);

      // Se aplica a todos los días
      state.selectedDate = '2026-08-05';
      expect(state.meetings[0].title).toBe('Nuevo Título Serie');

      state.selectedDate = '2026-08-10';
      expect(state.meetings[0].title).toBe('Nuevo Título Serie');
    });
  });
});
