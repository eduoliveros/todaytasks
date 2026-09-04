import { describe, it, expect, beforeEach } from 'vitest';
import { defaultState } from '../js/state.js';
import { searchAllTasks, getTodayStr, addDays } from '../js/utils.js';

describe('Global Task Search - Motor de Búsqueda Multidía (searchAllTasks)', () => {
  let state;
  const today = getTodayStr();
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 5);

  beforeEach(() => {
    state = defaultState();
    const workEnv = state.environments.work;

    // Configurar tareas en varios días
    workEnv.days[today] = {
      tasks: [
        { id: 'task_today_1', title: 'Diseño de interfaz de usuario', planned: 30, status: 'running', order: 1, urgency: 'today', featured: true },
        { id: 'task_today_2', title: 'Revisión con el equipo de producto', planned: 45, status: 'pending', order: 2, urgency: 'days', featured: false }
      ],
      meetings: []
    };

    workEnv.days[yesterday] = {
      tasks: [
        { id: 'task_yest_1', title: 'Facturación mensual agosto', planned: 60, actualDuration: 55, status: 'completed', order: 1, urgency: 'days', featured: false }
      ],
      meetings: []
    };

    workEnv.days[twoDaysAgo] = {
      tasks: [
        { id: 'task_past_2', title: 'Configurar servidor nginx', planned: 40, actualDuration: 40, status: 'completed', order: 1, urgency: 'later', featured: false }
      ],
      meetings: []
    };

    workEnv.days[tomorrow] = {
      tasks: [
        { id: 'task_tom_1', title: 'Llamada de seguimiento con cliente', planned: 20, status: 'pending', order: 1, urgency: 'week', featured: false }
      ],
      meetings: []
    };

    workEnv.days[nextWeek] = {
      tasks: [
        { id: 'task_next_1', title: 'Auditoría de seguridad dependencias', planned: 90, status: 'pending', order: 1, urgency: 'later', featured: false }
      ],
      meetings: []
    };

    // Tarea recurrente en la plantilla maestra
    workEnv.recurringTasks = [
      { id: 'rec_task_1', title: 'Sincronización diaria Standup', planned: 15, urgency: 'today', featured: false }
    ];

    // Tarea en entorno Personal
    state.environments.personal.days[today] = {
      tasks: [
        { id: 'task_pers_1', title: 'Hacer la compra semanal supermercado', planned: 45, status: 'pending', order: 1, urgency: 'today', featured: false }
      ],
      meetings: []
    };
  });

  it('devuelve todas las tareas de todos los días y reglas recurrentes sin filtro de búsqueda', () => {
    const results = searchAllTasks(state, '', { envKey: 'work' });
    expect(results.length).toBe(7);

    const todayGroup = results.filter(r => r.group === 'today');
    const upcomingGroup = results.filter(r => r.group === 'upcoming');
    const pastGroup = results.filter(r => r.group === 'past');
    const recurringGroup = results.filter(r => r.group === 'recurring');

    expect(todayGroup.length).toBe(2);
    expect(upcomingGroup.length).toBe(2);
    expect(pastGroup.length).toBe(2);
    expect(recurringGroup.length).toBe(1);
  });

  it('ordena por grupos: hoy (running primero), luego futuros ascendentes, luego pasados descendentes, luego recurrentes', () => {
    const results = searchAllTasks(state, '', { envKey: 'work' });
    const groups = results.map(r => r.group);

    expect(groups[0]).toBe('today');
    expect(groups[1]).toBe('today');
    expect(results[0].status).toBe('running');

    expect(groups[2]).toBe('upcoming');
    expect(results[2].dateStr).toBe(tomorrow);
    expect(groups[3]).toBe('upcoming');
    expect(results[3].dateStr).toBe(nextWeek);

    expect(groups[4]).toBe('past');
    expect(results[4].dateStr).toBe(yesterday);
    expect(groups[5]).toBe('past');
    expect(results[5].dateStr).toBe(twoDaysAgo);

    expect(groups[6]).toBe('recurring');
    expect(results[6].id).toBe('rec_task_1');
  });

  it('encuentra tareas por palabras clave ignorando acentos y mayúsculas en cualquier día', () => {
    const resFact = searchAllTasks(state, 'facturacion', { envKey: 'work' });
    expect(resFact.length).toBe(1);
    expect(resFact[0].id).toBe('task_yest_1');
    expect(resFact[0].dateStr).toBe(yesterday);

    const resDis = searchAllTasks(state, 'interfaz diseno', { envKey: 'work' });
    expect(resDis.length).toBe(1);
    expect(resDis[0].id).toBe('task_today_1');
  });

  it('permite filtrar por estado: pendientes vs completadas', () => {
    const pendingRes = searchAllTasks(state, '', { envKey: 'work', filter: 'pending' });
    expect(pendingRes.every(r => r.status !== 'completed')).toBe(true);

    const completedRes = searchAllTasks(state, '', { envKey: 'work', filter: 'completed' });
    expect(completedRes.length).toBe(2);
    expect(completedRes.every(r => r.status === 'completed')).toBe(true);
    expect(completedRes.map(r => r.id)).toContain('task_yest_1');
    expect(completedRes.map(r => r.id)).toContain('task_past_2');
  });

  it('permite filtrar por tareas recurrentes únicamente', () => {
    const recRes = searchAllTasks(state, '', { envKey: 'work', filter: 'recurring' });
    expect(recRes.length).toBe(1);
    expect(recRes[0].id).toBe('rec_task_1');
    expect(recRes[0].isRecurring).toBe(true);
  });

  it('soporta búsqueda en ambos entornos (work y personal) cuando bothEnvs es true', () => {
    const resWorkOnly = searchAllTasks(state, 'compra', { envKey: 'work', bothEnvs: false });
    expect(resWorkOnly.length).toBe(0);

    const resBoth = searchAllTasks(state, 'compra', { envKey: 'work', bothEnvs: true });
    expect(resBoth.length).toBe(1);
    expect(resBoth[0].id).toBe('task_pers_1');
    expect(resBoth[0].envKey).toBe('personal');
  });

  it('permite buscar tareas por fecha relativa o día de la semana', () => {
    const resAyer = searchAllTasks(state, 'ayer', { envKey: 'work' });
    expect(resAyer.length).toBe(1);
    expect(resAyer[0].id).toBe('task_yest_1');

    const resManana = searchAllTasks(state, 'manana', { envKey: 'work' });
    expect(resManana.length).toBe(1);
    expect(resManana[0].id).toBe('task_tom_1');
  });
});
