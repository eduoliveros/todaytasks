import { describe, it, expect } from 'vitest';
import { formatRecurrenceRule } from '../js/utils.js';

describe('Recurrence Rule Formatting & Popover (formatRecurrenceRule)', () => {
  it('formatea correctamente una regla diaria estándar (intervalo 1, sin fecha fin)', () => {
    const rule = {
      id: 'rec_task_1',
      title: 'Daily Standup',
      freq: 'daily',
      interval: 1,
      startDate: '2026-08-01',
      endDate: null
    };

    const formatted = formatRecurrenceRule(rule);
    expect(formatted).toBeDefined();
    expect(formatted.freqText).toBe('Diaria');
    expect(formatted.intervalText).toBe('Cada día');
    expect(formatted.daysText).toBe('Todos los días');
    expect(formatted.daysShortText).toBe('Diario');
    expect(formatted.dateRangeText).toBe('Desde 2026-08-01 · Indefinida');
    expect(formatted.summaryText).toBe('Diaria');
  });

  it('formatea correctamente una regla diaria con intervalo mayor a 1 y fecha fin', () => {
    const rule = {
      id: 'rec_task_2',
      title: 'Revisión periódica',
      freq: 'daily',
      interval: 3,
      startDate: '2026-08-01',
      endDate: '2026-12-31'
    };

    const formatted = formatRecurrenceRule(rule);
    expect(formatted.freqText).toBe('Diaria');
    expect(formatted.intervalText).toBe('Cada 3 días');
    expect(formatted.daysText).toBe('Cada 3 días');
    expect(formatted.dateRangeText).toBe('Desde 2026-08-01 · Hasta 2026-12-31');
    expect(formatted.summaryText).toBe('Cada 3 días');
  });

  it('formatea correctamente una regla semanal con múltiples días (L, X, V)', () => {
    const rule = {
      id: 'rec_task_3',
      title: 'Métricas de equipo',
      freq: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5],
      startDate: '2026-08-10',
      endDate: null
    };

    const formatted = formatRecurrenceRule(rule);
    expect(formatted).toBeDefined();
    expect(formatted.freqText).toBe('Semanal');
    expect(formatted.intervalText).toBe('Cada semana');
    expect(formatted.daysText).toBe('Lunes, Miércoles, Viernes');
    expect(formatted.daysShortText).toBe('Lun, Mié, Vie');
    expect(formatted.summaryText).toBe('Semanal (L, X, V)');
  });

  it('formatea correctamente una regla semanal con intervalo quincenal (cada 2 semanas los martes)', () => {
    const rule = {
      id: 'rec_task_4',
      title: 'Reporte de costes',
      freq: 'weekly',
      interval: 2,
      daysOfWeek: [2],
      startDate: '2026-08-01',
      endDate: '2026-10-31'
    };

    const formatted = formatRecurrenceRule(rule);
    expect(formatted.freqText).toBe('Semanal');
    expect(formatted.intervalText).toBe('Cada 2 semanas');
    expect(formatted.daysText).toBe('Martes');
    expect(formatted.daysShortText).toBe('Mar');
    expect(formatted.summaryText).toBe('Cada 2 semanas (Mar)');
  });

  it('soporta días no ordenados y los formatea en orden cronológico (1 a 7)', () => {
    const rule = {
      id: 'rec_task_5',
      title: 'Guardias',
      freq: 'weekly',
      interval: 1,
      daysOfWeek: [5, 1, 3], // Vie, Lun, Mié
      startDate: '2026-08-01'
    };

    const formatted = formatRecurrenceRule(rule);
    expect(formatted.daysText).toBe('Lunes, Miércoles, Viernes');
    expect(formatted.daysShortText).toBe('Lun, Mié, Vie');
  });

  it('maneja con seguridad reglas nulas, indefinidas o malformadas', () => {
    const emptyResult = formatRecurrenceRule(null);
    expect(emptyResult).toBeDefined();
    expect(emptyResult.freqText).toBe('Recurrente');
    expect(emptyResult.daysText).toBe('—');
    expect(emptyResult.summaryText).toBe('Recurrente');

    const invalidFreq = formatRecurrenceRule({ freq: 'unknown' });
    expect(invalidFreq.freqText).toBe('Recurrente');
  });
});

import { TodayTasksTasksView } from '../js/views/tasks.js';
import { TodayTasksMeetingsView } from '../js/views/meetings.js';
import { defaultState } from '../js/state.js';

describe('Recurrence Tag & Popover View Integration', () => {
  it('renderTaskItem genera un botón interactivo .recurring-tag-btn con tooltip dinámico para tareas recurrentes', () => {
    const state = defaultState();
    const env = state.environments[state.activeEnv];
    env.recurringTasks = [{
      id: 'rec_task_100',
      title: 'Sync Semanal',
      freq: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3],
      startDate: '2026-08-01',
      endDate: null
    }];

    const task = {
      id: 'task_1',
      title: 'Sync Semanal',
      planned: 30,
      order: 1,
      status: 'pending',
      isRecurring: true,
      ruleId: 'rec_task_100'
    };

    const ctx = {
      getState: () => state,
      getTaskEdit: () => null
    };

    const tasksView = TodayTasksTasksView(ctx);
    const html = tasksView.renderTaskItem(task, null, null);

    expect(html).toContain('recurring-tag-btn');
    expect(html).toContain('openRecurringInfoPopover');
    expect(html).toContain('Semanal (L, X)');
  });

  it('renderMeetings genera un botón interactivo .recurring-tag-btn para reuniones periódicas', () => {
    const state = defaultState();
    const env = state.environments[state.activeEnv];
    env.recurringMeetings = [{
      id: 'rec_meet_200',
      title: 'Daily Meeting',
      freq: 'daily',
      interval: 1,
      start: 600,
      end: 630,
      startDate: '2026-08-01',
      endDate: null
    }];

    state.meetings = [{
      id: 'meet_1',
      title: 'Daily Meeting',
      start: 600,
      end: 630,
      isRecurring: true,
      ruleId: 'rec_meet_200'
    }];

    // Mock DOM
    document.body.innerHTML = '<div id="meetingsList"></div>';

    const ctx = {
      getState: () => state,
      getMeetingEdit: () => null,
      nowMinutes: () => 500,
      getTodayStr: () => '2026-08-31'
    };

    const meetingsView = TodayTasksMeetingsView(ctx);
    meetingsView.renderMeetings();

    const listEl = document.getElementById('meetingsList');
    expect(listEl.innerHTML).toContain('recurring-tag-btn');
    expect(listEl.innerHTML).toContain("openRecurringInfoPopover('meet_1', event, 'meeting')");
    expect(listEl.innerHTML).toContain('Diaria');
  });
});
