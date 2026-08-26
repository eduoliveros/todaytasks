/* actions/tasks.js — Acciones de tareas (CRUD, edición, recurrencia) */
import { getTodayStr, matchesRecurrenceRule, getTaskElapsed, parseDuration } from '../utils.js';

export function TodayTasksTasks(ctx, helpers){
  const {
    getState, getTaskEdit, setTaskEdit,
    saveState, newId, renderAll, smartRender
  } = ctx;
  const { nowMinutes, showToast, showRecurringModal } = helpers;

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
      dayObj.tasks = dayObj.tasks.filter(t => t.ruleId !== ruleId);
    }
    saveState();
    renderAll();
  }

  function deleteRecurringTaskSeries(ruleId) {
    const state = getState();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || state.environments.work;
    if (Array.isArray(env.recurringTasks)) {
      env.recurringTasks = env.recurringTasks.filter(r => r.id !== ruleId);
    }
    Object.values(env.days || {}).forEach(dayObj => {
      if (Array.isArray(dayObj.tasks)) {
        dayObj.tasks = dayObj.tasks.filter(t => t.ruleId !== ruleId);
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
        planned: rule.planned,
        order: maxOrder + 1,
        status: "pending",
        runningStart: null,
        elapsedBefore: 0,
        completedAt: null,
        actualDuration: null,
        ruleId: rule.id,
        isRecurring: true
      });
      changed = true;
    });
    return changed;
  }

  function addTask(title, durationStr, toTop = false, recurringData = null, autoMoveToToday = true){
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

    if (recurringData && recurringData.isRecurring) {
      if (ctx.undoModule && ctx.undoModule.pushSnapshot) ctx.undoModule.pushSnapshot(`Añadir tarea recurrente "${title}"`);
      if (!Array.isArray(state.recurringTasks)) {
        state.recurringTasks = [];
      }
      const ruleId = "rec_task_" + newId();
      state.recurringTasks.push({
        id: ruleId,
        title,
        planned,
        freq: recurringData.freq || "weekly",
        interval: recurringData.interval || 1,
        daysOfWeek: recurringData.daysOfWeek || [1],
        startDate: state.selectedDate || getTodayStr(),
        endDate: recurringData.endDate || null,
        exceptions: {}
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
        id:newId(), title, planned, order:newOrder,
        status:"pending", runningStart:null, elapsedBefore:0,
        completedAt:null, actualDuration:null,
        autoMoveToToday: !!autoMoveToToday
      });
    }
    saveState();
    renderAll();
  }

  function deleteTask(id){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));

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

  function startEditTask(id){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t) return;

    if (t.ruleId) {
      const ruleId = t.ruleId;
      const dateStr = state.selectedDate || getTodayStr();
      showRecurringModal(
        `Editar "${t.title}" 🔁`,
        `¿Deseas editar solo la tarea del día ${dateStr} o editar todas las futuras ocurrencias de la serie?`,
        () => {
          const actual = getTaskElapsed(t);
          setTaskEdit({ id, ruleId, mode: "instance", title: t.title, duration: String(t.planned), actual: String(actual) });
          renderAll();
        },
        () => {
          const actual = getTaskElapsed(t);
          setTaskEdit({ id, ruleId, mode: "series", title: t.title, duration: String(t.planned), actual: String(actual) });
          renderAll();
        }
      );
      return;
    }

    const actual = getTaskElapsed(t);
    setTaskEdit({id, title:t.title, duration:String(t.planned), actual:String(actual), autoMoveToToday: !!t.autoMoveToToday});
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
    const t = state.tasks.find(t => String(t.id) === String(id));
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

    if (taskEdit.autoMoveToToday !== undefined) {
      t.autoMoveToToday = !!taskEdit.autoMoveToToday;
    }

    if (taskEdit.mode === "series" && taskEdit.ruleId) {
      const envKey = state.activeEnv || "work";
      const env = state.environments[envKey] || state.environments.work;
      const rule = (env.recurringTasks || []).find(r => String(r.id) === String(taskEdit.ruleId));
      if (rule) {
        rule.title = title;
        rule.planned = planned;
      }
    }

    t.title = title; t.planned = planned;
    setTaskEdit(null);
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

  return {
    materializeRecurringTasks,
    addTask, deleteTask, startEditTask, updateTaskEditField,
    cancelEditTask, saveEditTask, updateTaskTimeFast, moveTask
  };
}

export default TodayTasksTasks;

