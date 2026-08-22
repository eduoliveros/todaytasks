import { getTodayStr, getScheduleForDate, matchesRecurrenceRule } from './utils.js';
import { snapshotAndPrune } from './history.js';

function getToday() {
  return getTodayStr();
}

export function defaultDayState(envKey) {
  return {
    meetings: [],
    tasks: [],
    interruptions: [],
    planningMode: false
  };
}

export function defaultEnvState(envKey) {
  const today = getToday();
  const isPersonal = envKey === "personal";
  return {
    name: isPersonal ? "Personal" : "Trabajo",
    weeklySchedule: null,
    days: {
      [today]: defaultDayState(envKey)
    },
    history: [],
    recurringMeetings: [],
    recurringTasks: [],
    activeInterruption: null
  };
}

export function defaultState() {
  const today = getToday();
  const raw = {
    activeEnv: "work",
    selectedDate: today,
    environments: {
      work: defaultEnvState("work"),
      personal: defaultEnvState("personal")
    },
    notifyIntervalMin: 10,
    notifyEnabled: true,
    autoBreakEnabled: true,
    autoBreakIntervalMin: 60,
    autoBreakDurationMin: 10,
    themeMode: "auto",
    nextId: 1
  };
  return wrapState(raw);
}

export function wrapState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    rawState = {};
  }

  const today = getToday();

  if (typeof rawState.selectedDate !== "string" || !rawState.selectedDate) {
    rawState.selectedDate = today;
  }

  if (typeof rawState.activeEnv !== "string" || !["work", "personal"].includes(rawState.activeEnv)) {
    rawState.activeEnv = "work";
  }

  if (!rawState.environments || typeof rawState.environments !== "object") {
    // Legacy migration from single environment without days map
    const workEnv = defaultEnvState("work");
    workEnv.days[today] = {
      workStart: typeof rawState.workStart === "number" ? rawState.workStart : 9 * 60,
      workEnd: typeof rawState.workEnd === "number" ? rawState.workEnd : 18 * 60,
      meetings: Array.isArray(rawState.meetings) ? rawState.meetings : [],
      tasks: Array.isArray(rawState.tasks) ? rawState.tasks : [],
      interruptions: Array.isArray(rawState.interruptions) ? rawState.interruptions : [],
      planningMode: typeof rawState.planningMode === "boolean" ? rawState.planningMode : false
    };
    workEnv.activeInterruption = rawState.activeInterruption || null;

    rawState.environments = {
      work: workEnv,
      personal: defaultEnvState("personal")
    };

    delete rawState.workStart;
    delete rawState.workEnd;
    delete rawState.meetings;
    delete rawState.tasks;
    delete rawState.interruptions;
    delete rawState.activeInterruption;
    delete rawState.planningMode;
  } else {
    ["work", "personal"].forEach(key => {
      if (!rawState.environments[key] || typeof rawState.environments[key] !== "object") {
        rawState.environments[key] = defaultEnvState(key);
      } else {
        const env = rawState.environments[key];

        // Legacy migration if env has top-level meetings/tasks instead of days map
        if (!env.days || typeof env.days !== "object") {
          const dayData = {
            workStart: typeof env.workStart === "number" ? env.workStart : (key === "personal" ? 18 * 60 : 9 * 60),
            workEnd: typeof env.workEnd === "number" ? env.workEnd : (key === "personal" ? 23 * 60 : 18 * 60),
            meetings: Array.isArray(env.meetings) ? env.meetings : [],
            tasks: Array.isArray(env.tasks) ? env.tasks : [],
            interruptions: Array.isArray(env.interruptions) ? env.interruptions : [],
            planningMode: typeof env.planningMode === "boolean" ? env.planningMode : false
          };
          env.days = { [today]: dayData };

          delete env.workStart;
          delete env.workEnd;
          delete env.meetings;
          delete env.tasks;
          delete env.interruptions;
          delete env.planningMode;
        }

        if (!Array.isArray(env.history)) env.history = [];
        if (!Array.isArray(env.recurringMeetings)) env.recurringMeetings = [];
        if (!Array.isArray(env.recurringTasks)) env.recurringTasks = [];
        if (env.activeInterruption === undefined) env.activeInterruption = null;
        if (!("weeklySchedule" in env)) env.weeklySchedule = null;

        // Ensure each day in env.days is guarded
        Object.keys(env.days).forEach(d => {
          const dayObj = env.days[d];
          if (!dayObj || typeof dayObj !== "object") {
            env.days[d] = defaultDayState(key);
          } else {
            if (!Array.isArray(dayObj.meetings)) dayObj.meetings = [];
            if (!Array.isArray(dayObj.tasks)) dayObj.tasks = [];
            if (!Array.isArray(dayObj.interruptions)) dayObj.interruptions = [];
            if (typeof dayObj.planningMode !== "boolean") dayObj.planningMode = false;
          }
        });
      }
    });
  }

  if (typeof rawState.notifyIntervalMin !== "number" || rawState.notifyIntervalMin <= 0) {
    rawState.notifyIntervalMin = 10;
  }
  if (typeof rawState.notifyEnabled !== "boolean") {
    rawState.notifyEnabled = true;
  }
  if (typeof rawState.autoBreakEnabled !== "boolean") {
    rawState.autoBreakEnabled = true;
  }
  if (typeof rawState.autoBreakIntervalMin !== "number" || rawState.autoBreakIntervalMin <= 0) {
    rawState.autoBreakIntervalMin = 60;
  }
  if (typeof rawState.autoBreakDurationMin !== "number" || rawState.autoBreakDurationMin <= 0) {
    rawState.autoBreakDurationMin = 10;
  }
  if (!["auto", "light", "dark"].includes(rawState.themeMode)) {
    rawState.themeMode = "auto";
  }
  if (typeof rawState.nextId !== "number" || rawState.nextId < 1) {
    rawState.nextId = 1;
  }

  // Dynamic non-enumerable getters/setters for active env and selected date day properties
  function getActiveDayObj() {
    const envKey = rawState.activeEnv || "work";
    const env = rawState.environments[envKey] || rawState.environments.work;
    const dateStr = rawState.selectedDate || today;
    if (!env.days[dateStr]) {
      env.days[dateStr] = defaultDayState(envKey);
    }
    return env.days[dateStr];
  }

  function getActiveEnvObj() {
    const envKey = rawState.activeEnv || "work";
    return rawState.environments[envKey] || rawState.environments.work;
  }

  function getEffectiveMeetings() {
    const dayObj = getActiveDayObj();
    const envObj = getActiveEnvObj();
    const dateStr = rawState.selectedDate || today;

    const singleMeetings = Array.isArray(dayObj.meetings) ? dayObj.meetings : [];
    const recurringRules = Array.isArray(envObj.recurringMeetings) ? envObj.recurringMeetings : [];

    const hydratedRecurring = [];
    recurringRules.forEach(rule => {
      const match = matchesRecurrenceRule(rule, dateStr);
      if (match) {
        hydratedRecurring.push(match);
      }
    });

    const combined = [...singleMeetings, ...hydratedRecurring];
    combined.sort((a, b) => a.start - b.start);
    return combined;
  }

  ["workStart", "workEnd"].forEach(prop => {
    if (!Object.prototype.hasOwnProperty.call(rawState, prop)) {
      Object.defineProperty(rawState, prop, {
        get() {
          const dayObj = getActiveDayObj();
          if (dayObj.hasCustomHours && dayObj[prop] !== undefined) {
            return dayObj[prop];
          }
          const envKey = rawState.activeEnv || "work";
          const dateStr = rawState.selectedDate || today;
          const sched = getScheduleForDate(rawState, envKey, dateStr);
          if (sched) {
            return prop === "workStart" ? sched.start : sched.end;
          }
          return dayObj[prop] !== undefined ? dayObj[prop] : null;
        },
        set(val) {
          const dayObj = getActiveDayObj();
          if (val !== null && val !== undefined && val !== "") {
            dayObj.hasCustomHours = true;
            dayObj[prop] = val;
          } else {
            dayObj.hasCustomHours = false;
            delete dayObj[prop];
          }
        },
        enumerable: false,
        configurable: true
      });
    }
  });

  ["tasks", "interruptions", "planningMode"].forEach(prop => {
    if (!Object.prototype.hasOwnProperty.call(rawState, prop)) {
      Object.defineProperty(rawState, prop, {
        get() {
          return getActiveDayObj()[prop];
        },
        set(val) {
          getActiveDayObj()[prop] = val;
        },
        enumerable: false,
        configurable: true
      });
    }
  });

  Object.defineProperty(rawState, "meetings", {
    get() {
      return getEffectiveMeetings();
    },
    set(val) {
      getActiveDayObj().meetings = val;
    },
    enumerable: false,
    configurable: true
  });

  const envPropNames = ["activeInterruption", "history", "recurringMeetings", "recurringTasks"];
  envPropNames.forEach(prop => {
    if (!Object.prototype.hasOwnProperty.call(rawState, prop)) {
      Object.defineProperty(rawState, prop, {
        get() {
          return getActiveEnvObj()[prop];
        },
        set(val) {
          getActiveEnvObj()[prop] = val;
        },
        enumerable: false,
        configurable: true
      });
    }
  });

  if (snapshotAndPrune) {
    snapshotAndPrune(rawState);
  }

  return rawState;
}

export function loadState(storageKey) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return wrapState(parsed);
  } catch (e) {
    console.error("No se pudo leer el estado guardado", e);
    return defaultState();
  }
}

export const TodayTasksState = { defaultState, wrapState, loadState, defaultDayState, defaultEnvState };

export default TodayTasksState;

