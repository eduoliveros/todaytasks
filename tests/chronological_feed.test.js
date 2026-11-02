import { describe, it, expect, beforeEach } from 'vitest';
import { buildChronologicalFeed, computeSchedule } from '../js/scheduler.js';
import { TodayTasksTasksView } from '../js/views/tasks.js';

describe('Chronological Feed & Timeline View (Opción D)', () => {
  let state;

  beforeEach(() => {
    state = {
      workStart: 540, // 09:00
      workEnd: 1080,  // 18:00
      autoBreakEnabled: true,
      autoBreakIntervalMin: 60,
      autoBreakDurationMin: 10,
      taskSortMode: 'chronological',
      tasks: [],
      meetings: []
    };
  });

  describe('buildChronologicalFeed (Motor de proyección cronológica)', () => {
    it('debe ordenar tareas y reuniones en la misma secuencia matemática que el calendar', () => {
      state.tasks = [
        { id: 't1', title: 'Tarea 1', planned: 60, status: 'pending', order: 1 }
      ];
      state.meetings = [
        { id: 'm1', title: 'Reunión Daily', start: 600, end: 630 } // 10:00 - 10:30
      ];

      // Schedule calculado: t1 de 540 a 600 (09:00 a 10:00), m1 bloquea de 600 a 630 (+ buffer 630 a 640)
      const schedule = computeSchedule(state, 540);
      const feed = buildChronologicalFeed(state, schedule);

      expect(feed.length).toBeGreaterThanOrEqual(2);
      expect(feed[0].type).toBe('task');
      expect(feed[0].task.id).toBe('t1');
      expect(feed[0].start).toBe(540);
      expect(feed[0].end).toBe(600);

      expect(feed[1].type).toBe('meeting');
      expect(feed[1].meeting.id).toBe('m1');
      expect(feed[1].start).toBe(600);
      expect(feed[1].end).toBe(630);
    });

    it('desdobla una tarea dividida por una reunión en múltiples partes (Parte 1, Reunión, Buffer, Parte 2)', () => {
      // Tarea de 90 min iniciada a las 09:30 (570) con reunión a las 10:30 (630 - 660)
      state.tasks = [
        { id: 't-long', title: 'Tarea Larga', planned: 90, status: 'pending', order: 1 }
      ];
      state.meetings = [
        { id: 'm-mid', title: 'Reunión Media Mañana', start: 630, end: 660 } // 10:30 - 11:00
      ];

      // workStart 600 (10:00). Tarea requiere 90 min:
      // Tramo 1: 600 a 630 (30 min)
      // Reunión: 630 a 660 (30 min) + buffer 660 a 670 (10 min)
      // Tramo 2: 670 a 730 (60 min restantes)
      state.workStart = 600;
      const schedule = computeSchedule(state, 600);
      const feed = buildChronologicalFeed(state, schedule);

      const taskParts = feed.filter(f => f.type === 'task');
      expect(taskParts.length).toBe(2);

      // Parte 1 antes de reunión
      expect(taskParts[0].partIndex).toBe(0);
      expect(taskParts[0].totalParts).toBe(2);
      expect(taskParts[0].start).toBe(600);
      expect(taskParts[0].end).toBe(630);

      // Reunión en medio
      const meetingItem = feed.find(f => f.type === 'meeting');
      expect(meetingItem).toBeDefined();
      expect(meetingItem.start).toBe(630);
      expect(meetingItem.end).toBe(660);

      // Parte 2 después de reunión y buffer
      expect(taskParts[1].partIndex).toBe(1);
      expect(taskParts[1].totalParts).toBe(2);
      expect(taskParts[1].start).toBe(670);
      expect(taskParts[1].end).toBe(730);

      // Comprobar orden secuencial exacto
      const sequenceTypes = feed.map(f => f.type);
      expect(sequenceTypes).toEqual(['task', 'meeting', 'buffer', 'task']);
    });
  });

  describe('Renderizado DOM de la vista cronológica integrada', () => {
    let container;
    let tasksView;

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="tasksList"></div>
        <div id="tasksAutoMoveBanner"></div>
        <button id="taskSortPriorityBtn"></button>
        <button id="taskSortChronoBtn"></button>
      `;
      container = document.getElementById('tasksList');

      const ctx = {
        getState: () => state,
        getTaskEdit: () => null,
        getMeetingEdit: () => null,
        getTaskSearchQuery: () => '',
        nowMinutes: () => 540,
        getTodayStr: () => '2026-11-02'
      };
      tasksView = TodayTasksTasksView(ctx);
    });

    it('en modo cronológico renderiza un contenedor .chrono-timeline-feed con tareas y reuniones intercaladas', () => {
      state.taskSortMode = 'chronological';
      state.tasks = [
        { id: 't1', title: 'Tarea Diseño', planned: 30, status: 'pending', order: 1 }
      ];
      state.meetings = [
        { id: 'm1', title: 'Reunión Sprint', start: 570, end: 600 }
      ];

      const schedule = {
        segmentsByTask: {
          't1': [{ start: 540, end: 570 }]
        },
        overflowIds: new Set(),
        breaks: []
      };

      tasksView.renderTasks(schedule);

      const timelineFeed = container.querySelector('.chrono-timeline-feed');
      expect(timelineFeed).not.toBeNull();

      const taskCards = container.querySelectorAll('.task-item');
      expect(taskCards.length).toBe(1);
      expect(taskCards[0].textContent).toContain('Tarea Diseño');

      const meetingCards = container.querySelectorAll('.chrono-meeting-item');
      expect(meetingCards.length).toBe(1);
      expect(meetingCards[0].textContent).toContain('Reunión Sprint');
    });

    it('en tareas divididas renderiza las insignias de parte [Parte 1/2] y [Parte 2/2] con horas correspondientes', () => {
      state.taskSortMode = 'chronological';
      state.tasks = [
        { id: 't-split', title: 'Tarea Dividida', planned: 90, status: 'pending', order: 1 }
      ];
      state.meetings = [
        { id: 'm1', title: 'Reunión', start: 600, end: 630 }
      ];

      const schedule = {
        segmentsByTask: {
          't-split': [
            { start: 540, end: 600 },
            { start: 640, end: 670 }
          ]
        },
        overflowIds: new Set(),
        breaks: []
      };

      tasksView.renderTasks(schedule);

      const taskCards = container.querySelectorAll('.task-item');
      expect(taskCards.length).toBe(2);

      const partBadges = container.querySelectorAll('.task-part-badge');
      expect(partBadges.length).toBe(2);
      expect(partBadges[0].textContent).toContain('1/2');
      expect(partBadges[1].textContent).toContain('2/2');
    });
  });
});
