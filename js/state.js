(function () {
  function defaultEnvState(envKey) {
    if (envKey === "personal") {
      return {
        name: "Personal",
        workStart: 18 * 60, // 18:00
        workEnd: 23 * 60,   // 23:00
        meetings: [],
        tasks: [],
        interruptions: [],
        activeInterruption: null,
        planningMode: false
      };
    }
    return {
      name: "Trabajo",
      workStart: 9 * 60,  // 09:00
      workEnd: 18 * 60,   // 18:00
      meetings: [],
      tasks: [],
      interruptions: [],
      activeInterruption: null,
      planningMode: false
    };
  }

  function defaultState() {
    const raw = {
      activeEnv: "work",
      environments: {
        work: defaultEnvState("work"),
        personal: defaultEnvState("personal")
      },
      notifyIntervalMin: 10,
      notifyEnabled: true,
      nextId: 1
    };
    return wrapState(raw);
  }

  function wrapState(rawState) {
    if (!rawState || typeof rawState !== "object") {
      rawState = {};
    }

    if (typeof rawState.activeEnv !== "string" || !["work", "personal"].includes(rawState.activeEnv)) {
      rawState.activeEnv = "work";
    }

    if (!rawState.environments || typeof rawState.environments !== "object") {
      // Legacy migration from single-environment shape
      const workEnv = {
        name: "Trabajo",
        workStart: typeof rawState.workStart === "number" ? rawState.workStart : 9 * 60,
        workEnd: typeof rawState.workEnd === "number" ? rawState.workEnd : 18 * 60,
        meetings: Array.isArray(rawState.meetings) ? rawState.meetings : [],
        tasks: Array.isArray(rawState.tasks) ? rawState.tasks : [],
        interruptions: Array.isArray(rawState.interruptions) ? rawState.interruptions : [],
        activeInterruption: rawState.activeInterruption || null,
        planningMode: typeof rawState.planningMode === "boolean" ? rawState.planningMode : false
      };

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
      // Ensure work and personal exist with guards
      ["work", "personal"].forEach(key => {
        if (!rawState.environments[key] || typeof rawState.environments[key] !== "object") {
          rawState.environments[key] = defaultEnvState(key);
        } else {
          const env = rawState.environments[key];
          if (typeof env.workStart !== "number") env.workStart = key === "personal" ? 18 * 60 : 9 * 60;
          if (typeof env.workEnd !== "number") env.workEnd = key === "personal" ? 23 * 60 : 18 * 60;
          if (!Array.isArray(env.meetings)) env.meetings = [];
          if (!Array.isArray(env.tasks)) env.tasks = [];
          if (!Array.isArray(env.interruptions)) env.interruptions = [];
          if (env.activeInterruption === undefined) env.activeInterruption = null;
          if (typeof env.planningMode !== "boolean") env.planningMode = false;
        }
      });
    }

    if (typeof rawState.notifyIntervalMin !== "number" || rawState.notifyIntervalMin <= 0) {
      rawState.notifyIntervalMin = 10;
    }
    if (typeof rawState.notifyEnabled !== "boolean") {
      rawState.notifyEnabled = true;
    }
    if (typeof rawState.nextId !== "number" || rawState.nextId < 1) {
      rawState.nextId = 1;
    }

    // Attach dynamic non-enumerable getters/setters for active environment properties
    const envPropNames = ["workStart", "workEnd", "meetings", "tasks", "interruptions", "activeInterruption", "planningMode"];
    envPropNames.forEach(prop => {
      if (!Object.prototype.hasOwnProperty.call(rawState, prop)) {
        Object.defineProperty(rawState, prop, {
          get() {
            const envKey = rawState.activeEnv || "work";
            const env = rawState.environments[envKey] || rawState.environments.work;
            return env[prop];
          },
          set(val) {
            const envKey = rawState.activeEnv || "work";
            const env = rawState.environments[envKey] || rawState.environments.work;
            env[prop] = val;
          },
          enumerable: false,
          configurable: true
        });
      }
    });

    return rawState;
  }

  function loadState(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return wrapState(parsed);
    } catch (e) {
      console.error("No se pudo leer el estado guardado", e);
      return defaultState();
    }
  }

  window.TodayTasksState = { defaultState, wrapState, loadState };
})();
