/* actions/execution.js — Ejecución de tareas e interrupciones */
import { MAX_FEATURED_TASKS, sortTasksByPriority } from '../utils.js';

export function TodayTasksExecution(ctx, helpers){
  const {
    getState, setNotifyState, getNotifyState,
    saveState, newId, renderAll, smartRender
  } = ctx;
  const { nowMinutes, fmtDur, showToast } = helpers;

  /* ---------------- Task execution controls ---------------- */
  function getElapsedFromRunning(task){
    if(!task || task.status !== "running") return 0;
    if(task.runningStartEpoch){
      return Math.max(0, (Date.now() - task.runningStartEpoch) / 60000);
    }
    if(task.runningStart !== null && task.runningStart !== undefined){
      const currentNow = nowMinutes();
      const diff = currentNow >= task.runningStart ? (currentNow - task.runningStart) : (1440 - task.runningStart + currentNow);
      return Math.max(0, diff);
    }
    return 0;
  }

  function startTask(id){
    const state = getState();
    const targetTask = state.tasks.find(t => String(t.id) === String(id));
    if(!targetTask) return;

    if(targetTask.status === "completed"){
      const activeFeatured = (state.tasks || []).filter(t2 => String(t2.id) !== String(id) && t2.status !== "completed" && t2.featured).length;
      if (targetTask.featured && activeFeatured >= MAX_FEATURED_TASKS) {
        targetTask.featured = false;
      }
      const savedElapsed = targetTask.actualDuration ?? targetTask.elapsedBefore ?? 0;
      targetTask.status = "pending";
      targetTask.completedAt = null;
      targetTask.elapsedBefore = savedElapsed;
      targetTask.actualDuration = null;
      targetTask.runningStart = null;
      targetTask.runningStartEpoch = null;
    }

    const runningTask = state.tasks.find(t => t.status === "running");

    if(runningTask && String(runningTask.id) !== String(id)){
      const elapsed = getElapsedFromRunning(runningTask);
      runningTask.elapsedBefore = (runningTask.elapsedBefore||0) + Math.max(0, elapsed);
      runningTask.runningStart = null;
      runningTask.runningStartEpoch = null;
      runningTask.status = "paused";
    }

    const activeQueue = state.tasks
      .filter(t => t.status !== "completed")
      .sort((a,b) => a.order - b.order);

    const otherTasks = activeQueue.filter(t => String(t.id) !== String(targetTask.id) && (!runningTask || String(t.id) !== String(runningTask.id)));

    const newOrder = [targetTask];
    if(runningTask && String(runningTask.id) !== String(targetTask.id)){
      newOrder.push(runningTask);
    }
    newOrder.push(...otherTasks);

    newOrder.forEach((t, idx) => {
      t.order = idx + 1;
    });

    targetTask.status = "running";
    targetTask.runningStart = nowMinutes();
    targetTask.runningStartEpoch = Date.now();
    const plannedEnd = targetTask.runningStart + (targetTask.planned - (targetTask.elapsedBefore||0));
    setNotifyState({taskId: targetTask.id, lastNotifiedAt: nowMinutes(), timeEndNotified: nowMinutes() >= plannedEnd});
    saveState();
    smartRender ? smartRender() : renderAll();

    if (typeof document !== "undefined" && typeof window !== "undefined") {
      const targetEl = document.querySelector(`#tasksList .task-item[data-task-id="${id}"]`) ||
                       document.querySelector("#tasksList .task-item") ||
                       document.getElementById("tasksList");
      if (targetEl && typeof targetEl.getBoundingClientRect === "function") {
        const rect = targetEl.getBoundingClientRect();
        const scrollOffset = 60; // Margen superior para ver un poco por encima de la tarea
        const currentScrollY = (typeof window.scrollY !== "undefined") ? window.scrollY : (document.documentElement ? document.documentElement.scrollTop : 0);
        const targetScrollY = Math.max(0, currentScrollY + rect.top - scrollOffset);
        if (typeof window.scrollTo === "function") {
          window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
        }
      }
    }
  }

  function pauseTask(id){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t || t.status !== "running") return;
    const elapsed = getElapsedFromRunning(t);
    t.elapsedBefore = (t.elapsedBefore||0) + Math.max(0, elapsed);
    t.runningStart = null;
    t.runningStartEpoch = null;
    t.status = "paused";
    if(getNotifyState() && String(getNotifyState().taskId) === String(id)) {
      setNotifyState({taskId:null, lastNotifiedAt:null, timeEndNotified:false});
    }
    saveState();
    smartRender ? smartRender() : renderAll();
  }

  function resumeTask(id){
    startTask(id);
  }

  function completeTask(id){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t) return;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Completar tarea "${t.title}"`);
    }

    let actual = t.elapsedBefore || 0;
    if(t.status === "running"){
      actual += getElapsedFromRunning(t);
    } else if(t.status === "completed"){
      actual = t.actualDuration ?? t.elapsedBefore ?? 0;
    }
    actual = Math.round(actual * 10) / 10;
    t.status = "completed";
    t.completedAt = nowMinutes();
    t.actualDuration = actual;
    t.elapsedBefore = actual;
    t.runningStart = null;
    t.runningStartEpoch = null;
    if(getNotifyState() && String(getNotifyState().taskId) === String(id)) {
      setNotifyState({taskId:null, lastNotifiedAt:null, timeEndNotified:false});
    }
    saveState();
    if (showToast) {
      showToast(`Tarea "${t.title}" completada.`, {
        label: "Deshacer",
        onClick: () => { if (ctx.undoModule && ctx.undoModule.undo) ctx.undoModule.undo(); }
      });
    }
    if(ctx.getCurrentView && ctx.getCurrentView() === 'task' && ctx.getFocusTaskId && String(ctx.getFocusTaskId()) === String(id)){
      if (typeof window !== "undefined") window.location.hash = '#/';
    } else {
      smartRender ? smartRender() : renderAll();
    }
  }

  function completeTasks(ids){
    if (!Array.isArray(ids) || ids.length === 0) return;
    const state = getState();
    const targetDateStr = state.selectedDate || getTodayStr();
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
    const dayObj = env && env.days ? env.days[targetDateStr] : null;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(ids.length === 1 ? 'Completar tarea' : `Completar ${ids.length} tareas`);
    }

    let completedCount = 0;
    const now = nowMinutes();

    ids.forEach(id => {
      let t = (state.tasks || []).find(x => String(x.id) === String(id));
      if (!t && dayObj && Array.isArray(dayObj.tasks)) {
        t = dayObj.tasks.find(x => String(x.id) === String(id));
      }
      if (!t || t.status === "completed") return;

      let actual = t.elapsedBefore || 0;
      if(t.status === "running"){
        actual += getElapsedFromRunning(t);
      }
      actual = Math.round(actual * 10) / 10;
      t.status = "completed";
      t.completedAt = now;
      t.actualDuration = actual;
      t.elapsedBefore = actual;
      t.runningStart = null;
      t.runningStartEpoch = null;
      if(getNotifyState() && String(getNotifyState().taskId) === String(id)) {
        setNotifyState({taskId:null, lastNotifiedAt:null, timeEndNotified:false});
      }
      completedCount++;
    });

    if (completedCount === 0) return;

    saveState();
    if (showToast) {
      const msg = completedCount === 1 ? '1 tarea completada.' : `${completedCount} tareas completadas.`;
      showToast(`✓ ${msg}`, {
        label: "Deshacer",
        onClick: () => { if (ctx.undoModule && ctx.undoModule.undo) ctx.undoModule.undo(); }
      });
    }

    smartRender ? smartRender() : renderAll();
  }

  function uncompleteTask(id){
    const state = getState();
    const t = state.tasks.find(t => String(t.id) === String(id));
    if(!t || t.status !== "completed") return;

    if (ctx.undoModule && ctx.undoModule.pushSnapshot) {
      ctx.undoModule.pushSnapshot(`Restaurar tarea "${t.title}"`);
    }

    const activeFeatured = (state.tasks || []).filter(t2 => String(t2.id) !== String(id) && t2.status !== "completed" && t2.featured).length;
    if (t.featured && activeFeatured >= MAX_FEATURED_TASKS) {
      t.featured = false;
    }

    const maxOrder = state.tasks.filter(t2=>t2.status!=="completed").reduce((m,t2)=>Math.max(m,t2.order),0);
    const savedElapsed = t.actualDuration ?? t.elapsedBefore ?? 0;
    t.status = savedElapsed > 0 ? "paused" : "pending";
    t.completedAt = null;
    t.elapsedBefore = savedElapsed;
    t.actualDuration = null;
    t.runningStart = null;
    t.runningStartEpoch = null;
    t.order = maxOrder + 1;
    state.tasks = sortTasksByPriority(state.tasks);
    saveState();
    smartRender ? smartRender() : renderAll();
    showToast(`"${t.title}" se ha devuelto a ${t.status === "paused" ? "en pausa" : "pendientes"}.`);
  }

  /* ---------------- Interruptions ---------------- */
  let interruptionTitleTimer = null;

  function startInterruption(){
    if(interruptionTitleTimer){
      clearTimeout(interruptionTitleTimer);
      interruptionTitleTimer = null;
    }
    const state = getState();
    const running = state.tasks.find(t => t.status === "running");
    if(running){
      pauseTask(running.id);
    }
    state.activeInterruption = {
      id: newId(),
      title: "",
      start: nowMinutes(),
      startEpoch: Date.now()
    };
    saveState();

    if (typeof document !== "undefined") {
      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";
    }

    if(typeof window !== "undefined" && window.location.hash !== '#/interruption'){
      window.location.hash = '#/interruption';
    } else {
      smartRender ? smartRender() : renderAll();
    }
  }

  function updateInterruptionTitle(val){
    const state = getState();
    if(state.activeInterruption){
      state.activeInterruption.title = val;
      if(interruptionTitleTimer){
        clearTimeout(interruptionTitleTimer);
      }
      interruptionTitleTimer = setTimeout(() => {
        saveState();
        interruptionTitleTimer = null;
      }, 2000);
    }
  }

  function completeInterruption(){
    if(interruptionTitleTimer){
      clearTimeout(interruptionTitleTimer);
      interruptionTitleTimer = null;
    }
    const state = getState();
    if(!state.activeInterruption) return;
    const now = nowMinutes();
    const start = state.activeInterruption.start;
    const duration = Math.max(0, now - start);
    const title = (state.activeInterruption.title || "").trim() || "Interrupción";

    if(!Array.isArray(state.interruptions)){
      state.interruptions = [];
    }
    state.interruptions.push({
      id: state.activeInterruption.id,
      title,
      start,
      end: now,
      duration
    });

    state.activeInterruption = null;
    saveState();

    if (typeof document !== "undefined") {
      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";
    }

    showToast(`Interrupción "${title}" finalizada (${fmtDur(duration)}).`);
    if(typeof window !== "undefined") window.location.hash = '#/';
  }

  function cancelInterruption(){
    if(interruptionTitleTimer){
      clearTimeout(interruptionTitleTimer);
      interruptionTitleTimer = null;
    }
    const state = getState();
    if(!state.activeInterruption && (ctx.getCurrentView ? ctx.getCurrentView() !== 'interruption' : true)) return;
    state.activeInterruption = null;
    saveState();

    if (typeof document !== "undefined") {
      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";
    }

    showToast("Interrupción cancelada.");
    if(typeof window !== "undefined") window.location.hash = '#/';
  }

  return {
    startTask, pauseTask, resumeTask, completeTask, completeTasks, uncompleteTask,
    startInterruption, updateInterruptionTitle, completeInterruption, cancelInterruption
  };
}

export default TodayTasksExecution;

