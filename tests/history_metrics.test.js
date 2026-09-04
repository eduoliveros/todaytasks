import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodayTasksHistoryMetrics } from '../js/app/history-metrics.js';
import { setLocale, t } from '../js/i18n.js';

describe('TodayTasksHistoryMetrics (js/app/history-metrics.js)', () => {
  let mockActions;
  let state;
  let metricsMod;

  beforeEach(() => {
    setLocale('es');
    state = {
      activeEnv: 'work',
      environments: {
        work: {
          history: [
            {
              date: '2026-08-30',
              meetingsTime: 45,
              completedTasksTime: 120,
              uncompletedTasksWorkedTime: 30,
              uncompletedTasksNotWorkedTime: 15,
              interruptionsTime: 10
            }
          ]
        }
      }
    };

    mockActions = {
      saveHistoryMetric: vi.fn()
    };

    metricsMod = TodayTasksHistoryMetrics({
      getState: () => state,
      getActionsModule: () => mockActions
    });
  });

  it('promptAddHistoryMetric prompts user sequentially using translated strings and saves metric', () => {
    const promptAnswers = [
      '2026-08-31', // date
      '30',         // meetings
      '90',         // completed
      '20',         // worked
      '10',         // unworked
      '15'          // interruptions
    ];
    let promptIndex = 0;
    const promptQuestions = [];

    vi.stubGlobal('prompt', vi.fn((msg, def) => {
      promptQuestions.push(msg);
      return promptAnswers[promptIndex++];
    }));

    metricsMod.promptAddHistoryMetric();

    expect(promptQuestions[0]).toBe(t('history.metricPromptDate'));
    expect(promptQuestions[1]).toBe(t('history.metricPromptMeetings'));
    expect(promptQuestions[2]).toBe(t('history.metricPromptCompleted'));
    expect(promptQuestions[3]).toBe(t('history.metricPromptWorked'));
    expect(promptQuestions[4]).toBe(t('history.metricPromptNotWorked'));
    expect(promptQuestions[5]).toBe(t('history.metricPromptInterruptions'));

    expect(mockActions.saveHistoryMetric).toHaveBeenCalledWith('2026-08-31', {
      meetingsTime: 30,
      completedTasksTime: 90,
      uncompletedTasksWorkedTime: 20,
      uncompletedTasksNotWorkedTime: 10,
      interruptionsTime: 15
    });

    vi.unstubAllGlobals();
  });

  it('promptAddHistoryMetric cancels without saving when user cancels date prompt', () => {
    vi.stubGlobal('prompt', vi.fn(() => null));

    metricsMod.promptAddHistoryMetric();
    expect(mockActions.saveHistoryMetric).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('editHistoryMetricPrompt pre-populates existing metrics with human readable format and parses inputs', () => {
    const promptAnswers = ['1h 30m', '2h 10m', '35m', '10m', '12m'];
    let idx = 0;
    const promptDefaults = [];

    vi.stubGlobal('prompt', vi.fn((msg, def) => {
      promptDefaults.push(def);
      return promptAnswers[idx++];
    }));

    metricsMod.editHistoryMetricPrompt('2026-08-30');

    expect(promptDefaults).toEqual(['45m', '2h', '30m', '15m', '10m']);
    expect(mockActions.saveHistoryMetric).toHaveBeenCalledWith('2026-08-30', {
      meetingsTime: 90,
      completedTasksTime: 130,
      uncompletedTasksWorkedTime: 35,
      uncompletedTasksNotWorkedTime: 10,
      interruptionsTime: 12
    });

    vi.unstubAllGlobals();
  });

  it('supports English prompts when locale is set to en', () => {
    setLocale('en');
    let capturedQuestion = '';
    vi.stubGlobal('prompt', vi.fn((msg) => {
      capturedQuestion = msg;
      return null;
    }));

    metricsMod.promptAddHistoryMetric();
    expect(capturedQuestion).toBe('Enter date in YYYY-MM-DD format:');

    setLocale('es');
    vi.unstubAllGlobals();
  });
});
