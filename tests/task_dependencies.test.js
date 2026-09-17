import { describe, it, expect } from 'vitest';
import {
  findTaskInEnvironment,
  isTaskBlocked,
  getTaskBlockingDetails,
  getTasksBlockedBy,
  checkCircularDependency,
  getTodayStr
} from '../js/utils.js';
import { wrapState } from '../js/state.js';

describe('Task Dependencies and Graph Utilities', () => {
  function createTestEnv() {
    return {
      name: 'Trabajo',
      nextTaskSeq: 10,
      days: {
        '2026-09-06': {
          tasks: [
            { id: 't1', displayId: 'W-1', title: 'Tarea 1', status: 'pending', dependsOn: [] },
            { id: 't2', displayId: 'W-2', title: 'Tarea 2', status: 'pending', dependsOn: ['t1'] },
            { id: 't3', displayId: 'W-3', title: 'Tarea 3', status: 'completed', dependsOn: [] }
          ]
        },
        '2026-09-07': {
          tasks: [
            { id: 't4', displayId: 'W-4', title: 'Tarea 4 Futura', status: 'pending', dependsOn: ['t2'] }
          ]
        }
      }
    };
  }

  it('findTaskInEnvironment finds tasks across different days', () => {
    const env = createTestEnv();
    const res1 = findTaskInEnvironment(env, 't1');
    expect(res1).not.toBeNull();
    expect(res1.task.id).toBe('t1');
    expect(res1.dateStr).toBe('2026-09-06');

    const res4 = findTaskInEnvironment(env, 't4');
    expect(res4).not.toBeNull();
    expect(res4.task.id).toBe('t4');
    expect(res4.dateStr).toBe('2026-09-07');

    expect(findTaskInEnvironment(env, 'non-existent')).toBeNull();
  });

  it('isTaskBlocked correctly identifies blocked and unblocked tasks', () => {
    const env = createTestEnv();
    const t1 = env.days['2026-09-06'].tasks[0];
    const t2 = env.days['2026-09-06'].tasks[1]; // depends on t1 (pending)
    const t3 = env.days['2026-09-06'].tasks[2];

    expect(isTaskBlocked(t1, env)).toBe(false);
    expect(isTaskBlocked(t2, env)).toBe(true);
    expect(isTaskBlocked(t3, env)).toBe(false);

    // When t1 is completed, t2 should be unblocked
    t1.status = 'completed';
    expect(isTaskBlocked(t2, env)).toBe(false);

    // If t1 is reset to pending, t2 is blocked again
    t1.status = 'pending';
    expect(isTaskBlocked(t2, env)).toBe(true);
  });

  it('getTaskBlockingDetails returns details of tasks that block this task', () => {
    const env = createTestEnv();
    const t2 = env.days['2026-09-06'].tasks[1]; // depends on t1
    const details = getTaskBlockingDetails(t2, env);

    expect(details.length).toBe(1);
    expect(details[0].id).toBe('t1');
    expect(details[0].displayId).toBe('W-1');
    expect(details[0].status).toBe('pending');
    expect(details[0].isCompleted).toBe(false);
  });

  it('getTasksBlockedBy returns tasks that depend on a given task', () => {
    const env = createTestEnv();
    const blockedByT1 = getTasksBlockedBy('t1', env);
    expect(blockedByT1.length).toBe(1);
    expect(blockedByT1[0].id).toBe('t2');
    expect(blockedByT1[0].displayId).toBe('W-2');

    const blockedByT2 = getTasksBlockedBy('t2', env);
    expect(blockedByT2.length).toBe(1);
    expect(blockedByT2[0].id).toBe('t4');
    expect(blockedByT2[0].dateStr).toBe('2026-09-07');
  });

  describe('checkCircularDependency', () => {
    it('detects direct self-dependency (A -> A)', () => {
      const env = createTestEnv();
      expect(checkCircularDependency('t1', 't1', env)).toBe(true);
    });

    it('detects 2-node cycle (A -> B -> A)', () => {
      const env = createTestEnv();
      // t2 already depends on t1. Making t1 depend on t2 must be detected as cycle!
      expect(checkCircularDependency('t1', 't2', env)).toBe(true);
      // But making t4 depend on t1 is allowed (t1 -> t2 -> t4)
      expect(checkCircularDependency('t4', 't1', env)).toBe(false);
    });

    it('detects multi-node cycle (A -> B -> C -> A)', () => {
      const env = createTestEnv();
      // t1 is base. t2 depends on t1. t4 depends on t2.
      // Trying to make t1 depend on t4 should create cycle t1 -> t4 -> t2 -> t1
      expect(checkCircularDependency('t1', 't4', env)).toBe(true);
    });

    it('allows valid dependencies with branching', () => {
      const env = createTestEnv();
      // Making a new task t5 depend on t1 and t2 is completely valid
      env.days['2026-09-06'].tasks.push({
        id: 't5', displayId: 'W-5', title: 'Tarea 5', status: 'pending', dependsOn: ['t1']
      });
      expect(checkCircularDependency('t5', 't2', env)).toBe(false);
    });
  });

  describe('wrapState normalization of dependsOn', () => {
    it('normalizes dependsOn to array and removes self-references and invalid values', () => {
      const today = getTodayStr();
      const raw = {
        activeEnv: 'work',
        selectedDate: today,
        environments: {
          work: {
            name: 'Trabajo',
            days: {
              [today]: {
                tasks: [
                  { id: 't1', title: 'T1', dependsOn: 'invalid' },
                  { id: 't2', title: 'T2', dependsOn: ['t2', 't1', null, 123, ''] }
                ]
              }
            }
          },
          personal: { days: {} }
        }
      };

      const wrapped = wrapState(raw);
      const tasks = wrapped.environments.work.days[today].tasks;
      expect(Array.isArray(tasks[0].dependsOn)).toBe(true);
      expect(tasks[0].dependsOn).toEqual([]);

      expect(tasks[1].dependsOn).toEqual(['t1']);
    });
  });
});
