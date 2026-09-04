/* app/history-metrics.js — Prompts y gestión interactiva de métricas históricas con i18n */
import { t } from '../i18n.js';
import { getTodayStr, parseDuration, formatDurationInput } from '../utils.js';

export function TodayTasksHistoryMetrics(ctx) {
  const { getState, getActionsModule } = ctx;

  const getActions = () => (typeof getActionsModule === 'function' ? getActionsModule() : ctx.actionsModule);

  const parseVal = (str) => {
    if (str === null || str === undefined) return 0;
    const parsed = parseDuration(str);
    return Math.max(0, Math.round(parsed !== null && !isNaN(parsed) ? parsed : (parseInt(str, 10) || 0)));
  };

  function promptAddHistoryMetric() {
    if (typeof window === "undefined" || !window.prompt) return;
    const dateStr = window.prompt(t('history.metricPromptDate'), getTodayStr());
    if (!dateStr) return;

    const mStr = window.prompt(t('history.metricPromptMeetings'), "0m");
    if (mStr === null) return;
    const cStr = window.prompt(t('history.metricPromptCompleted'), "0m");
    if (cStr === null) return;
    const wStr = window.prompt(t('history.metricPromptWorked'), "0m");
    if (wStr === null) return;
    const nwStr = window.prompt(t('history.metricPromptNotWorked'), "0m");
    if (nwStr === null) return;
    const iStr = window.prompt(t('history.metricPromptInterruptions'), "0m");
    if (iStr === null) return;

    const actions = getActions();
    if (actions && actions.saveHistoryMetric) {
      actions.saveHistoryMetric(dateStr.trim(), {
        meetingsTime: parseVal(mStr),
        completedTasksTime: parseVal(cStr),
        uncompletedTasksWorkedTime: parseVal(wStr),
        uncompletedTasksNotWorkedTime: parseVal(nwStr),
        interruptionsTime: parseVal(iStr)
      });
    }
  }

  function editHistoryMetricPrompt(dateStr) {
    if (typeof window === "undefined" || !window.prompt) return;
    const state = typeof getState === 'function' ? getState() : {};
    const envKey = state.activeEnv || "work";
    const env = (state.environments && state.environments[envKey]) || {};
    const existing = (env.history || []).find(h => h.date === dateStr) || {};

    const mStr = window.prompt(`[${dateStr}] ${t('history.metricPromptMeetings')}`, formatDurationInput(existing.meetingsTime));
    if (mStr === null) return;
    const cStr = window.prompt(`[${dateStr}] ${t('history.metricPromptCompleted')}`, formatDurationInput(existing.completedTasksTime));
    if (cStr === null) return;
    const wStr = window.prompt(`[${dateStr}] ${t('history.metricPromptWorked')}`, formatDurationInput(existing.uncompletedTasksWorkedTime));
    if (wStr === null) return;
    const nwStr = window.prompt(`[${dateStr}] ${t('history.metricPromptNotWorked')}`, formatDurationInput(existing.uncompletedTasksNotWorkedTime));
    if (nwStr === null) return;
    const iStr = window.prompt(`[${dateStr}] ${t('history.metricPromptInterruptions')}`, formatDurationInput(existing.interruptionsTime));
    if (iStr === null) return;

    const actions = getActions();
    if (actions && actions.saveHistoryMetric) {
      actions.saveHistoryMetric(dateStr, {
        meetingsTime: parseVal(mStr),
        completedTasksTime: parseVal(cStr),
        uncompletedTasksWorkedTime: parseVal(wStr),
        uncompletedTasksNotWorkedTime: parseVal(nwStr),
        interruptionsTime: parseVal(iStr)
      });
    }
  }

  return {
    promptAddHistoryMetric,
    editHistoryMetricPrompt
  };
}

export default TodayTasksHistoryMetrics;
