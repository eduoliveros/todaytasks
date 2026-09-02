/* actions/tasks.js — Acciones de tareas (CRUD, edición, recurrencia, prioridades) */
import {
  getTodayStr, matchesRecurrenceRule, getTaskElapsed, parseDuration,
  DEFAULT_URGENCY, MAX_FEATURED_TASKS, sortTasksByPriority, URGENCY_LEVELS,
  fmt, timeToMinutes
} from '../utils.js';

export function TodayTasksTasks(ctx, helpers){
  const {
    getState, getTaskEdit, setTaskEdit,
    saveState, newId, renderAll, smartRender
  } = ctx;
  const { nowMinutes, showToast, showRecurringModal, showFeaturedLimitModal } = helpers;

  const DEFAULT_TASK_DURATION = 30;

  function deleteRecurringTaskInstance(ruleId, dateStr) {
    const state = getState();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    const rule = (env.recurringTasks || []).find(r => r.id === ruleId);
    if (rule) {
      if (!rule.exceptions) rule.exceptions = {};
      rule.exceptions[dateStr] = { type: "cancelled" };
    }
    const dayObj = env.days && env.days[dateStr];
    if (dayObj && Array.isArray(dayObj.tasks)) {
      if (!Array.isArray(dayObj._deletedIds)) dayObj._deletedIds = [];
      dayObj.tasks.forEach(t => {
        if (t.ruleId === ruleId && t.id != null && !dayObj._deletedIds.includes(String(t.id))) {
          dayObj._deletedIds.push(String(t.id));
        }
      });
      dayObj.tasks = dayObj.tasks.filter(t => t.ruleId !== ruleId);
    }
    if (state.tasks && Array.isArray(state.tasks)) {
      state.tasks = state.tasks.filter(t => t.ruleId !== ruleId);
    }
    saveState();
    renderAll();
  }

  function deleteRecurringTaskSeries(ruleId) {
    const state = getState();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    if (Array.isArray(env.recurringTasks)) {
      env.recurringTasks = env.recurringTasks.filter(r => String(r.id) !== String(ruleId));
    }
    if (!Array.isArray(env._deletedRecurringIds)) env._deletedRecurringIds = [];
    if (!env._deletedRecurringIds.includes(String(ruleId))) {
      env._deletedRecurringIds.push(String(ruleId));
    }
    Object.values(env.days || {}).forEach(dayObj => {
      if (Array.isArray(dayObj.tasks)) {
        if (!Array.isArray(dayObj._deletedIds)) dayObj._deletedIds = [];
        dayObj.tasks.forEach(t => {
          if (String(t.ruleId) === String(ruleId) && t.id != null && !dayObj._deletedIds.includes(String(t.id))) {
            dayObj._deletedIds.push(String(t.id));
          }
        });
        dayObj.tasks = dayObj.tasks.filter(t => String(t.ruleId) !== String(ruleId));
      }
    });
    saveState();
    renderAll();
  }

  function materializeRecurringTasks() {
    const state = getState();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    const dateStr = state.selectedDate || getTodayStr();
    const recurringTaskRules = Array.isArray(env.recurringTasks) ? env.recurringTasks : [];
    if (recurringTaskRules.length === 0) return false;

    if (!env.days[dateStr]) {
      env.days[dateStr] = { meetings: [], tasks: [], interruptions: [], planningMode: false };
    }
    const dayObj = env.days[dateStr];
    if (!Array.isArray(dayObj.tasks)) dayObj.tasks = [];

    let changed = false;
    recurringTaskRules.forEach(rule => {
      const matches = matchesRecurrenceRule(rule, dateStr);
      if (!matches) return;

      if (rule.exceptions && rule.exceptions[dateStr] && rule.exceptions[dateStr].type === "cancelled") return;

      const alreadyExists = dayObj.tasks.some(t => t.ruleId === rule.id);
      if (alreadyExists) return;

      const maxOrder = dayObj.tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
      dayObj.tasks.push({
        id: newId(),
        title: rule.title,
        notes: rule.notes || "",
        planned: rule.planned,
        order: maxOrder + 1,
        status: "pending",
        runningStart: null,
        elapsedBefore: 0,
        completedAt: null,
        actualDuration: null,
        ruleId: rule.id,
        isRecurring: true,
        urgency: rule.urgency || DEFAULT_URGENCY,
        featured: !!rule.featured,
        startAfter: rule.startAfter ?? null
      });
      changed = true;
    });
    return changed;
  }

  function addTask(title, durationStr, toTop = false, recurringData = null, autoMoveToToday = true, urgency = DEFAULT_URGENCY, featured = false, startAfter = null, notes = ""){
    if(!title){
      alert("Indica un título para la tarea.");
      return;
    }
    const state = getState();
    const parsed = parseDuration(durationStr);
    let planned = (parsed !== null && parsed > 0) ? Math.round(parsed) : null;
    if(!planned || planned <= 0){
      planned = DEFAULT_TASK_DURATION;
      showToast(`No indicaste duración: "${title}" se ha añadido con ${DEFAULT_TASK_DURATION} minutos por defecto.`);
    }

    const cleanUrgency = (typeof urgency === "string" && ["today", "days", "week", "later"].includes(urgency))
      ? urgency
      : DEFAULT_URGENCY;
    let cleanFeatured = !!featured;

    let cleanStartAfter = null;
    if (typeof startAfter === "number" && !isNaN(startAfter) && startAfter >= 0 && startAfter < 1440) {
      cleanStartAfter = Math.round(startAfter);
    } else if (typeof startAfter === "string" && startAfter.trim()) {
      const parsedSA = timeToMinutes(startAfter.trim());
      if (parsedSA !== null && !isNaN(parsedSA) && parsedSA >= 0 && parsedSA < 1440) {
        cleanStartAfter = parsedSA;
      }
    }

    const cleanNotes = (typeof notes === "string") ? notes : (notes ? String(notes) : "");

    // Verificar límite de 5 destacadas activas en el día
    if (cleanFeatured) {
      const currentFeaturedCount = (state.tasks || []).filter(t => t.status !== 'completed' && t.featured).length;
      if (currentFeaturedCount >= MAX_FEATURED_TASKS) {
        cleanFeatured = false;
        showToast(`Límite alcanzado (${MAX_FEATURED_TASKS} destacadas). La tarea se creó como normal.`);
      }
    }

    if (recurringData && recurringData.isRecurring) {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Añadir tarea recurrente "${title}"`);
      if (!Array.isArray(state.recurringTasks)) {
        state.recurringTasks = [];
      }
      const ruleId = "rec_task_" + newId();
      state.recurringTasks.push({
        id: ruleId,
        title,
        notes: cleanNotes || (recurringData && recurringData.notes ? recurringData.notes : ""),
        planned,
        freq: recurringData.freq || "weekly",
        interval: recurringData.interval || 1,
        daysOfWeek: recurringData.daysOfWeek || [1],
        startDate: state.selectedDate || getTodayStr(),
        endDate: recurringData.endDate || null,
        exceptions: {},
        urgency: cleanUrgency,
        featured: cleanFeatured,
        startAfter: cleanStartAfter ?? (recurringData.startAfter ?? null)
      });
      materializeRecurringTasks();
      showToast(`Tarea recurrente "${title}" añadida 🔁`);
    } else {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Añadir tarea "${title}"`);
      let newOrder;
      if (toTop) {
        state.tasks.forEach(t => {
          t.order = (t.order || 0) + 1;
        });
        newOrder = 1;
      } else {
        const maxOrder = state.tasks.reduce((m,t)=>Math.max(m,t.order), 0);
        newOrder = maxOrder + 1;
      }
      state.tasks.push({
        id: newId(),
        title,
        notes: cleanNotes,
        planned,
        order: newOrder,
        status: "pending",
        runningStart: null,
        elapsedBefore: 0,
        completedAt: null,
        actualDuration: null,
        autoMoveToToday: !!autoMoveToToday,
        urgency: cleanUrgency,
        featured: cleanFeatured,
        startAfter: cleanStartAfter
      });

      // Reordenar automáticamente respetando la prioridad
      state.tasks = sortTasksByPriority(state.tasks);
    }
    saveState();
    renderAll();
  }

  function setTaskUrgency(id, urgency){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t) return;
    if(!["today", "days", "week", "later"].includes(urgency)) return;
    if(t.urgency === urgency) return;

    const urgencyInfo = URGENCY_LEVELS[urgency] || URGENCY_LEVELS[DEFAULT_URGENCY];
    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Cambiar urgencia de "${t.title}" a "${urgencyInfo.label}"`);
    }

    t.urgency = urgency;
    state.tasks = sortTasksByPriority(state.tasks);
    saveState();
    smartRender ? smartRender() : renderAll();
    if (showToast) {
      showToast(`Urgencia de "${t.title}" cambiada a ${urgencyInfo.label} ${urgencyInfo.icon}`);
    }
  }

  function setTasksUrgency(ids, urgency){
    if (!Array.isArray(ids) || ids.length === 0) return;
    if (!["today", "days", "week", "later"].includes(urgency)) return;
    const state = getState();
    const idsSet = new Set(ids.map(String));
    const targetTasks = (state.tasks || []).filter(t => idsSet.has(String(t.id)));
    if (targetTasks.length === 0) return;

    const urgencyInfo = URGENCY_LEVELS[urgency] || URGENCY_LEVELS[DEFAULT_URGENCY];
    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      const label = targetTasks.length === 1
        ? `Cambiar urgencia de "${targetTasks[0].title}" a "${urgencyInfo.label}"`
        : `Cambiar urgencia de ${targetTasks.length} tareas a "${urgencyInfo.label}"`;
      ctx.undoModule.pushSnapshot(label);
    }

    targetTasks.forEach(t => {
      t.urgency = urgency;
    });
    state.tasks = sortTasksByPriority(state.tasks);
    saveState();
    smartRender ? smartRender() : renderAll();
    if (showToast) {
      const toastLabel = targetTasks.length === 1
        ? `Urgencia de "${targetTasks[0].title}" cambiada a ${urgencyInfo.label} ${urgencyInfo.icon}`
        : `Urgencia de ${targetTasks.length} tareas cambiada a ${urgencyInfo.label} ${urgencyInfo.icon}`;
      showToast(toastLabel);
    }
  }

  function setTaskFeatured(id, featured){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t) return false;
    const shouldFeature = !!featured;
    if(t.featured === shouldFeature) return true;

    if(shouldFeature){
      const currentFeatured = (state.tasks || []).filter(task => String(task.id) !== String(id) && task.status !== 'completed' && task.featured);
      if(currentFeatured.length >= MAX_FEATURED_TASKS){
        if(showFeaturedLimitModal){
          showFeaturedLimitModal(id, (unfeatureId) => resolveFeaturedLimit(id, unfeatureId));
        } else {
          showToast(`Límite máximo alcanzado: solo puedes tener ${MAX_FEATURED_TASKS} tareas destacadas.`);
        }
        return false;
      }

      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(`Destacar tarea "${t.title}"`);
      }
      t.featured = true;
      state.tasks = sortTasksByPriority(state.tasks);
      saveState();
      smartRender ? smartRender() : renderAll();
      if (showToast) {
        showToast(`Tarea "${t.title}" marcada como destacada ⭐`);
      }
      return true;
    } else {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(`Quitar destacado de "${t.title}"`);
      }
      t.featured = false;
      state.tasks = sortTasksByPriority(state.tasks);
      saveState();
      smartRender ? smartRender() : renderAll();
      if (showToast) {
        showToast(`Destacado quitado de "${t.title}"`);
      }
      return true;
    }
  }

  function setTasksFeatured(ids, featured){
    if (!Array.isArray(ids) || ids.length === 0) return;
    const state = getState();
    const idsSet = new Set(ids.map(String));
    const targetTasks = (state.tasks || []).filter(t => idsSet.has(String(t.id)));
    if (targetTasks.length === 0) return;

    const shouldFeature = !!featured;
    if (shouldFeature) {
      const currentFeaturedIds = new Set((state.tasks || [])
        .filter(t => t.status !== 'completed' && t.featured)
        .map(t => String(t.id)));
      let availableSlots = MAX_FEATURED_TASKS - currentFeaturedIds.size;
      const toFeature = [];
      for (const t of targetTasks) {
        if (!currentFeaturedIds.has(String(t.id))) {
          if (availableSlots > 0) {
            toFeature.push(t);
            availableSlots--;
          }
        }
      }
      if (toFeature.length === 0 && targetTasks.length > 0) {
        if (showToast) showToast(`Límite máximo alcanzado: ya tienes ${MAX_FEATURED_TASKS} tareas destacadas.`);
        return;
      }
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(`Destacar ${toFeature.length} tareas`);
      }
      toFeature.forEach(t => { t.featured = true; });
      state.tasks = sortTasksByPriority(state.tasks);
      saveState();
      smartRender ? smartRender() : renderAll();
      if (showToast) showToast(`${toFeature.length} tarea(s) destacadas ⭐`);
    } else {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(`Quitar destacado de ${targetTasks.length} tareas`);
      }
      targetTasks.forEach(t => { t.featured = false; });
      state.tasks = sortTasksByPriority(state.tasks);
      saveState();
      smartRender ? smartRender() : renderAll();
      if (showToast) showToast(`Destacado quitado de ${targetTasks.length} tarea(s)`);
    }
  }

  function toggleTaskFeatured(id){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t) return;
    setTaskFeatured(id, !t.featured);
  }

  function resolveFeaturedLimit(targetTaskId, unfeatureTaskId){
    const state = getState();
    const targetTask = state.tasks.find(t => String(t.id) === String(targetTaskId));
    const unfeatureTask = state.tasks.find(t => String(t.id) === String(unfeatureTaskId));
    if(!targetTask || !unfeatureTask) return;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Destacar "${targetTask.title}" en lugar de "${unfeatureTask.title}"`);
    }

    unfeatureTask.featured = false;
    targetTask.featured = true;
    state.tasks = sortTasksByPriority(state.tasks);
    saveState();
    smartRender ? smartRender() : renderAll();
    if (showToast) {
      showToast(`⭐ "${targetTask.title}" destacada (se quitó el destacado de "${unfeatureTask.title}")`);
    }
  }

  function deleteTask(id){
    const state = getState();
    let t = (state.tasks || []).find(t => String(t.id) === String(id));
    let foundDayStr = null;
    const envKey = state.activeEnv || "work";
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;

    if (!t && env && env.days) {
      for (const [d, dayData] of Object.entries(env.days)) {
        if (dayData && Array.isArray(dayData.tasks)) {
          const found = dayData.tasks.find(x => String(x.id) === String(id));
          if (found) {
            t = found;
            foundDayStr = d;
            break;
          }
        }
      }
    }

    if (t && t.ruleId) {
      const ruleId = t.ruleId;
      const dateStr = state.selectedDate || getTodayStr();
      showRecurringModal(
        `Eliminar "${t.title}" 🔁`,
        `¿Deseas eliminar solo la tarea del día ${dateStr} o eliminar toda la serie recurrente?`,
        () => {
          if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Eliminar ocurrencia "${t.title}"`);
          deleteRecurringTaskInstance(ruleId, dateStr);
        },
        () => {
          if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Eliminar serie "${t.title}"`);
          deleteRecurringTaskSeries(ruleId);
        }
      );
      return;
    }

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Eliminar tarea "${t ? t.title : ''}"`);
    }

    const dateStr = state.selectedDate || getTodayStr();
    const dayObj = env && env.days && env.days[dateStr];
    if (dayObj) {
      if (!Array.isArray(dayObj._deletedIds)) dayObj._deletedIds = [];
      if (!dayObj._deletedIds.includes(String(id))) {
        dayObj._deletedIds.push(String(id));
      }
    }
    if (foundDayStr && env.days && env.days[foundDayStr]) {
      env.days[foundDayStr].tasks = (env.days[foundDayStr].tasks || []).filter(t => String(t.id) !== String(id));
      if (!Array.isArray(env.days[foundDayStr]._deletedIds)) env.days[foundDayStr]._deletedIds = [];
      if (!env.days[foundDayStr]._deletedIds.includes(String(id))) {
        env.days[foundDayStr]._deletedIds.push(String(id));
      }
    }

    state.tasks = state.tasks.filter(t => String(t.id) !== String(id));
    if(getTaskEdit() && String(getTaskEdit().id) === String(id)) setTaskEdit(null);
    saveState();
    renderAll();
    if (showToast) {
      showToast(`Tarea "${t ? t.title : ''}" eliminada.`, {
        label: "Deshacer",
        onClick: () => { if (ctx.undoModule && ctx.undoModule.undo) ctx.undoModule.undo(); }
      });
    }
  }

  function deleteTasks(ids){
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const state = getState();
    const idsSet = new Set(ids.map(String));
    const tasksToDelete = (state.tasks || []).filter(t => idsSet.has(String(t.id)));
    if (tasksToDelete.length === 0) return 0;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      const label = tasksToDelete.length === 1
        ? `Eliminar tarea "${tasksToDelete[0].title}"`
        : `Eliminar ${tasksToDelete.length} tareas`;
      ctx.undoModule.pushSnapshot(label);
    }

    const envKey = state.activeEnv || "work";
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
    const dateStr = state.selectedDate || getTodayStr();
    const dayObj = env && env.days && env.days[dateStr];
    if (dayObj) {
      if (!Array.isArray(dayObj._deletedIds)) dayObj._deletedIds = [];
      tasksToDelete.forEach(t => {
        if (!dayObj._deletedIds.includes(String(t.id))) {
          dayObj._deletedIds.push(String(t.id));
        }
      });
    }

    state.tasks = state.tasks.filter(t => !idsSet.has(String(t.id)));
    if (getTaskEdit() && idsSet.has(String(getTaskEdit().id))) setTaskEdit(null);

    saveState();
    smartRender ? smartRender() : renderAll();
    if (showToast) {
      const toastMsg = tasksToDelete.length === 1
        ? `Tarea "${tasksToDelete[0].title}" eliminada.`
        : `${tasksToDelete.length} tareas eliminadas.`;
      showToast(toastMsg, {
        label: "Deshacer",
        onClick: () => { if (ctx.undoModule && ctx.undoModule.undo) ctx.undoModule.undo(); }
      });
    }
    return tasksToDelete.length;
  }

  function startEditTask(id, options = {}){
    const state = getState();
    let t = (state.tasks || []).find(t => String(t.id) === String(id));
    if (!t) {
      const envKey = state.activeEnv || "work";
      const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
      if (env && env.days) {
        for (const d of Object.keys(env.days)) {
          if (env.days[d] && Array.isArray(env.days[d].tasks)) {
            const found = env.days[d].tasks.find(x => String(x.id) === String(id));
            if (found) { t = found; break; }
          }
        }
      }
    }
    if(!t) return;

    if (t.ruleId) {
      const ruleId = t.ruleId;
      const dateStr = state.selectedDate || getTodayStr();
      if (options && options.instanceOnly) {
        const actual = getTaskElapsed(t);
        setTaskEdit({
          id, ruleId, mode: "instance", title: t.title, duration: String(t.planned), actual: String(actual),
          notes: t.notes || "",
          urgency: t.urgency || DEFAULT_URGENCY, featured: !!t.featured,
          startAfter: (t.startAfter !== null && t.startAfter !== undefined) ? fmt(t.startAfter) : ""
        });
        renderAll();
        return;
      }
      showRecurringModal(
        `Editar "${t.title}" 🔁`,
        `¿Deseas editar solo la tarea del día ${dateStr} o editar todas las futuras ocurrencias de la serie?`,
        () => {
          const actual = getTaskElapsed(t);
          setTaskEdit({
            id, ruleId, mode: "instance", title: t.title, duration: String(t.planned), actual: String(actual),
            notes: t.notes || "",
            urgency: t.urgency || DEFAULT_URGENCY, featured: !!t.featured,
            startAfter: (t.startAfter !== null && t.startAfter !== undefined) ? fmt(t.startAfter) : ""
          });
          renderAll();
        },
        () => {
          const actual = getTaskElapsed(t);
          setTaskEdit({
            id, ruleId, mode: "series", title: t.title, duration: String(t.planned), actual: String(actual),
            notes: t.notes || "",
            urgency: t.urgency || DEFAULT_URGENCY, featured: !!t.featured,
            startAfter: (t.startAfter !== null && t.startAfter !== undefined) ? fmt(t.startAfter) : ""
          });
          renderAll();
        }
      );
      return;
    }

    const actual = getTaskElapsed(t);
    setTaskEdit({
      id, title: t.title, duration: String(t.planned), actual: String(actual),
      notes: t.notes || "",
      autoMoveToToday: !!t.autoMoveToToday,
      urgency: t.urgency || DEFAULT_URGENCY,
      featured: !!t.featured,
      startAfter: (t.startAfter !== null && t.startAfter !== undefined) ? fmt(t.startAfter) : ""
    });
    renderAll();
  }

  function updateTaskEditField(field, value){
    const taskEdit = getTaskEdit();
    if(taskEdit) taskEdit[field] = value;
  }

  function cancelEditTask(){
    setTaskEdit(null);
    renderAll();
  }

  function saveEditTask(id){
    const taskEdit = getTaskEdit();
    if(!taskEdit || String(taskEdit.id) !== String(id)) return;
    const state = getState();
    let t = (state.tasks || []).find(t => String(t.id) === String(id));
    if (!t) {
      const envKey = state.activeEnv || "work";
      const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
      if (env && env.days) {
        for (const d of Object.keys(env.days)) {
          if (env.days[d] && Array.isArray(env.days[d].tasks)) {
            const found = env.days[d].tasks.find(x => String(x.id) === String(id));
            if (found) { t = found; break; }
          }
        }
      }
    }
    if(!t) return;
    const title = (taskEdit.title||"").trim();
    const parsedPlanned = parseDuration(taskEdit.duration);
    const planned = (parsedPlanned !== null && parsedPlanned > 0) ? Math.round(parsedPlanned) : null;
    const parsedActual = parseDuration(taskEdit.actual);
    const actual = parsedActual !== null ? Math.round(parsedActual * 10) / 10 : Math.round(parseFloat(taskEdit.actual) * 10) / 10;
    if(!title || !planned || planned <= 0){
      alert("Indica un título y una duración en minutos o formato horas/minutos mayor que 0 (ej. 30 o 1h 30m).");
      return;
    }

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Editar tarea "${t.title}"`);
    }

    if(!isNaN(actual) && actual >= 0) {
      if(t.status === "completed") {
        t.actualDuration = actual;
      } else {
        t.elapsedBefore = actual;
        if (t.status === "running") {
          t.runningStart = nowMinutes();
          t.runningStartEpoch = Date.now();
        }
      }
    }

    if (taskEdit.notes !== undefined) {
      t.notes = typeof taskEdit.notes === "string" ? taskEdit.notes : String(taskEdit.notes || "");
    }

    if (taskEdit.autoMoveToToday !== undefined) {
      t.autoMoveToToday = !!taskEdit.autoMoveToToday;
    }

    if (taskEdit.urgency && ["today", "days", "week", "later"].includes(taskEdit.urgency)) {
      t.urgency = taskEdit.urgency;
    }

    if (taskEdit.startAfter !== undefined) {
      if (typeof taskEdit.startAfter === "string" && taskEdit.startAfter.trim()) {
        const parsed = timeToMinutes(taskEdit.startAfter.trim());
        t.startAfter = (parsed !== null && !isNaN(parsed)) ? parsed : null;
      } else if (typeof taskEdit.startAfter === "number" && !isNaN(taskEdit.startAfter)) {
        t.startAfter = taskEdit.startAfter;
      } else {
        t.startAfter = null;
      }
    }

    if (taskEdit.featured !== undefined) {
      const wantFeatured = !!taskEdit.featured;
      if (wantFeatured && !t.featured) {
        const currentFeatured = (state.tasks || []).filter(task => String(task.id) !== String(id) && task.status !== 'completed' && task.featured);
        if (currentFeatured.length >= MAX_FEATURED_TASKS) {
          if (showFeaturedLimitModal) {
            showFeaturedLimitModal(id, (unfeatureId) => resolveFeaturedLimit(id, unfeatureId));
          } else {
            showToast(`Límite alcanzado (${MAX_FEATURED_TASKS} destacadas).`);
          }
        } else {
          t.featured = true;
        }
      } else {
        t.featured = wantFeatured;
      }
    }

    if (taskEdit.mode === "series" && taskEdit.ruleId) {
      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      const rule = (env.recurringTasks || []).find(r => String(r.id) === String(taskEdit.ruleId));
      let seriesStartAfter = undefined;
      if (taskEdit.startAfter !== undefined) {
        if (typeof taskEdit.startAfter === "string" && taskEdit.startAfter.trim()) {
          const parsed = timeToMinutes(taskEdit.startAfter.trim());
          seriesStartAfter = (parsed !== null && !isNaN(parsed)) ? parsed : null;
        } else if (typeof taskEdit.startAfter === "number" && !isNaN(taskEdit.startAfter)) {
          seriesStartAfter = taskEdit.startAfter;
        } else {
          seriesStartAfter = null;
        }
      }
      if (rule) {
        rule.title = title;
        rule.planned = planned;
        if (taskEdit.notes !== undefined) rule.notes = t.notes;
        if (taskEdit.urgency) rule.urgency = taskEdit.urgency;
        if (taskEdit.featured !== undefined) rule.featured = !!taskEdit.featured;
        if (seriesStartAfter !== undefined) rule.startAfter = seriesStartAfter;
      }
      Object.values(env.days || {}).forEach(dayObj => {
        if (Array.isArray(dayObj.tasks)) {
          dayObj.tasks.forEach(dt => {
            if (String(dt.ruleId) === String(taskEdit.ruleId)) {
              dt.title = title;
              dt.planned = planned;
              if (taskEdit.notes !== undefined) dt.notes = t.notes;
              if (taskEdit.urgency) dt.urgency = taskEdit.urgency;
              if (taskEdit.featured !== undefined) dt.featured = !!taskEdit.featured;
              if (seriesStartAfter !== undefined) dt.startAfter = seriesStartAfter;
            }
          });
        }
      });
    }

    t.title = title; t.planned = planned;
    setTaskEdit(null);
    state.tasks = sortTasksByPriority(state.tasks);
    saveState();
    smartRender ? smartRender() : renderAll();
  }

  function updateTaskTimeFast(id, actualMin) {
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t) return;
    const parsed = parseDuration(actualMin);
    const actual = parsed !== null ? Math.round(parsed * 10) / 10 : Math.round(parseFloat(actualMin) * 10) / 10;
    if(!isNaN(actual) && actual >= 0) {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
        ctx.undoModule.pushSnapshot(`Modificar tiempo consumido "${t.title}"`);
      }
      if(t.status === "completed") {
        t.actualDuration = actual;
        t.elapsedBefore = actual;
      } else {
        t.elapsedBefore = actual;
        if (t.status === "running") {
          t.runningStart = nowMinutes();
          t.runningStartEpoch = Date.now();
        }
      }
      saveState();
      smartRender ? smartRender() : renderAll();
    }
  }

  function moveTask(id, dir, event){
    const state = getState();
    const list = state.tasks.filter(t=>t.status==="pending"||t.status==="paused")
                             .sort((a,b)=>a.order-b.order);
    const idx = list.findIndex(t => String(t.id) === String(id));
    const swapIdx = idx + dir;
    if(idx<0 || swapIdx<0 || swapIdx>=list.length) return;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot('Reordenar tarea');
    }

    let beforeRect = null;
    if (typeof document !== "undefined") {
      const btn = (event && event.currentTarget) ||
                  document.querySelector(`#tasksList button[data-task-id="${id}"][data-action="${dir === -1 ? 'move-up' : 'move-down'}"]`) ||
                  document.querySelector(`#tasksList .task-item[data-task-id="${id}"] .order-controls button[title="${dir === -1 ? 'Subir' : 'Bajar'}"]`);
      if (btn && typeof btn.getBoundingClientRect === "function") {
        beforeRect = btn.getBoundingClientRect();
      }
    }

    const a = list[idx], b = list[swapIdx];
    const tmp = a.order; a.order = b.order; b.order = tmp;
    saveState();
    renderAll();

    if (beforeRect && typeof document !== "undefined" && typeof window !== "undefined") {
      const newBtn = document.querySelector(`#tasksList button[data-task-id="${id}"][data-action="${dir === -1 ? 'move-up' : 'move-down'}"]`) ||
                     document.querySelector(`#tasksList .task-item[data-task-id="${id}"] .order-controls button[title="${dir === -1 ? 'Subir' : 'Bajar'}"]`);
      if (newBtn && typeof newBtn.getBoundingClientRect === "function") {
        const afterRect = newBtn.getBoundingClientRect();
        const deltaY = afterRect.top - beforeRect.top;
        const deltaX = afterRect.left - beforeRect.left;
        if ((deltaY !== 0 || deltaX !== 0) && typeof window.scrollBy === "function") {
          window.scrollBy({ top: deltaY, left: deltaX, behavior: 'instant' });
        }
      }
    }
  }

  function setTaskStartAfter(id, startAfterVal){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t) return;

    let cleanStartAfter = null;
    if (typeof startAfterVal === "number" && !isNaN(startAfterVal) && startAfterVal >= 0 && startAfterVal < 1440) {
      cleanStartAfter = Math.round(startAfterVal);
    } else if (typeof startAfterVal === "string" && startAfterVal.trim()) {
      const parsed = timeToMinutes(startAfterVal.trim());
      if (parsed !== null && !isNaN(parsed) && parsed >= 0 && parsed < 1440) {
        cleanStartAfter = parsed;
      }
    }

    if (t.startAfter === cleanStartAfter) return;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      const desc = cleanStartAfter !== null
        ? `Fijar hora de inicio de "${t.title}" a las ${fmt(cleanStartAfter)}`
        : `Quitar hora de inicio de "${t.title}"`;
      ctx.undoModule.pushSnapshot(desc);
    }

    t.startAfter = cleanStartAfter;

    // Si es una tarea recurrente, actualizar la regla general y todas las ocurrencias en todos los días
    if (t.ruleId) {
      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      const rule = (env.recurringTasks || []).find(r => String(r.id) === String(t.ruleId));
      if (rule) {
        rule.startAfter = cleanStartAfter;
      }
      Object.values(env.days || {}).forEach(dayObj => {
        if (Array.isArray(dayObj.tasks)) {
          dayObj.tasks.forEach(dt => {
            if (String(dt.ruleId) === String(t.ruleId)) {
              dt.startAfter = cleanStartAfter;
            }
          });
        }
      });
    }

    saveState();
    smartRender ? smartRender() : renderAll();
    if (showToast) {
      const extraMsg = t.ruleId ? ' (actualizada en toda la serie 🔁)' : '';
      if (cleanStartAfter !== null) {
        showToast(`"${t.title}" programada a partir de las ${fmt(cleanStartAfter)} ⏰${extraMsg}`);
      } else {
        showToast(`Restricción horaria eliminada de "${t.title}"${extraMsg}`);
      }
    }
  }

  return {
    materializeRecurringTasks,
    addTask, deleteTask, deleteRecurringTaskInstance, startEditTask, updateTaskEditField,
    cancelEditTask, saveEditTask, updateTaskTimeFast, moveTask,
    setTaskUrgency, setTasksUrgency, setTaskFeatured, setTasksFeatured, toggleTaskFeatured, resolveFeaturedLimit,
    setTaskStartAfter, deleteTasks
  };
}

export default TodayTasksTasks;

