import { describe, it, expect } from 'vitest';
import { TodayTasksMeetings } from '../js/actions/meetings.js';
import { TodayTasksTasks } from '../js/actions/tasks.js';
import { TodayTasksExecution } from '../js/actions/execution.js';
import { TodayTasksCloud } from '../js/cloud.js';
import { defaultState, wrapState } from '../js/state.js';

describe('Robust ID generation with crypto.randomUUID() & UUID support', () => {
  it('generates valid RFC 4122 v4 UUID format strings', () => {
    const uuid = crypto.randomUUID();
    expect(uuid).toBeTypeOf('string');
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidV4Regex);
  });

  it('generates 1000 distinct UUIDs without collision', () => {
    const set = new Set();
    for (let i = 0; i < 1000; i++) {
      set.add(crypto.randomUUID());
    }
    expect(set.size).toBe(1000);
  });

  it('allows adding, editing and deleting meetings with UUID strings (even those starting with digits)', () => {
    let state = defaultState();
    let meetingEdit = null;
    let saved = false;

    // A UUID starting with digit 3 followed by letters
    const sampleUuid = '3f2b4c5d-7e8f-4a1b-9c2d-3e4f5a6b7c8d';

    const ctx = {
      getState: () => state,
      getMeetingEdit: () => meetingEdit,
      setMeetingEdit: (v) => { meetingEdit = v; },
      saveState: () => { saved = true; },
      newId: () => sampleUuid,
      renderAll: () => {}
    };

    const helpers = {
      fmt: (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`,
      timeToMinutes: (str) => {
        if (!str) return null;
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
      },
      showToast: () => {},
      showRecurringModal: () => {}
    };

    const meetingsActions = TodayTasksMeetings(ctx, helpers);

    // 1. Add meeting
    meetingsActions.addMeeting('Daily Standup', '09:00', '09:30');
    expect(state.meetings.length).toBe(1);
    expect(state.meetings[0].id).toBe(sampleUuid);

    // 2. Start edit meeting using UUID as string
    meetingsActions.startEditMeeting(sampleUuid);
    expect(meetingEdit).not.toBeNull();
    expect(meetingEdit.id).toBe(sampleUuid);
    expect(meetingEdit.title).toBe('Daily Standup');

    // 3. Update field and save edit
    meetingsActions.updateMeetingEditField('title', 'Daily Standup Renovado');
    meetingsActions.saveEditMeeting(sampleUuid);
    expect(state.meetings[0].title).toBe('Daily Standup Renovado');
    expect(state.meetings[0].id).toBe(sampleUuid);

    // 4. Delete meeting with UUID
    meetingsActions.deleteMeeting(sampleUuid);
    expect(state.meetings.length).toBe(0);
  });

  it('allows adding, editing and completing tasks with UUID strings', () => {
    let state = defaultState();
    let taskEdit = null;

    const taskUuid = '7d1a2b3c-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

    const ctx = {
      getState: () => state,
      getTaskEdit: () => taskEdit,
      setTaskEdit: (v) => { taskEdit = v; },
      saveState: () => {},
      newId: () => taskUuid,
      renderAll: () => {},
      smartRender: () => {}
    };

    const helpers = {
      nowMinutes: () => 600,
      showToast: () => {},
      showRecurringModal: () => {}
    };

    const taskActions = TodayTasksTasks(ctx, helpers);
    taskActions.addTask('Refactorizar código', '45m');

    expect(state.tasks.length).toBe(1);
    expect(state.tasks[0].id).toBe(taskUuid);
    expect(state.tasks[0].planned).toBe(45);

    // Edit task
    taskActions.startEditTask(taskUuid);
    expect(taskEdit).not.toBeNull();
    expect(taskEdit.id).toBe(taskUuid);

    taskActions.updateTaskEditField('title', 'Refactorizar módulos');
    taskActions.saveEditTask(taskUuid);
    expect(state.tasks[0].title).toBe('Refactorizar módulos');

    // Execute task with UUID
    let notifyState = {};
    const execCtx = {
      ...ctx,
      getNotifyState: () => notifyState,
      setNotifyState: (v) => { notifyState = v; }
    };
    const execHelpers = {
      nowMinutes: () => 610,
      fmtDur: (m) => `${m}m`,
      showToast: () => {}
    };
    const execActions = TodayTasksExecution(execCtx, execHelpers);

    execActions.startTask(taskUuid);
    expect(state.tasks[0].status).toBe('running');

    execActions.completeTask(taskUuid);
    expect(state.tasks[0].status).toBe('completed');
  });

  it('merges states with UUID IDs in cloud merge without corrupting nextId or data', () => {
    const ctx = {
      getState: () => defaultState(),
      setState: () => {},
      setMeetingEdit: () => {},
      setTaskEdit: () => {},
      saveState: () => {},
      STORAGE_KEY: 'test_key',
      syncFormInputsFromState: () => {},
      renderAll: () => {}
    };

    const cloud = TodayTasksCloud(ctx);

    const localState = {
      activeEnv: 'work',
      selectedDate: '2026-08-26',
      nextId: 10,
      environments: {
        work: {
          name: 'Trabajo',
          days: {
            '2026-08-26': {
              tasks: [{ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', title: 'Tarea Local', planned: 30, order: 1, status: 'pending' }],
              meetings: [{ id: 'f1e2d3c4-b5a6-4987-8765-43210fedcba9', title: 'Reunión Local', start: 600, end: 630 }],
              interruptions: []
            }
          },
          history: [],
          recurringMeetings: [],
          recurringTasks: []
        },
        personal: { name: 'Personal', days: {}, history: [], recurringMeetings: [], recurringTasks: [] }
      }
    };

    const remoteState = {
      activeEnv: 'work',
      selectedDate: '2026-08-26',
      nextId: 12,
      environments: {
        work: {
          name: 'Trabajo',
          days: {
            '2026-08-26': {
              tasks: [{ id: '98765432-10fe-4dcba-9876-543210fedcba', title: 'Tarea Remota', planned: 60, order: 1, status: 'pending' }],
              meetings: [],
              interruptions: []
            }
          },
          history: [],
          recurringMeetings: [],
          recurringTasks: []
        },
        personal: { name: 'Personal', days: {}, history: [], recurringMeetings: [], recurringTasks: [] }
      }
    };

    const merged = cloud.mergeStates(localState, remoteState);
    expect(merged.environments.work.days['2026-08-26'].tasks.length).toBe(2);
    expect(merged.environments.work.days['2026-08-26'].meetings.length).toBe(1);
    expect(merged.environments.work.days['2026-08-26'].meetings[0].id).toBe('f1e2d3c4-b5a6-4987-8765-43210fedcba9');
    expect(typeof merged.nextId).toBe('number');
    expect(merged.nextId).toBeGreaterThanOrEqual(12);
  });
});
