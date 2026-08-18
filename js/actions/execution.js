/* actions/execution.js — Ejecución de tareas e interrupciones */
(function(){
  "use strict";

  window._TodayTasksExecution = function(ctx, helpers){
    const {
      getState, setNotifyState, getNotifyState,
      saveState, newId, renderAll, smartRender
    } = ctx;
    const { nowMinutes, fmtDur, showToast } = helpers;

    /* ---------------- Task execution controls ---------------- */
    function startTask(id){
      const state = getState();
      const targetTask = state.tasks.find(t=>t.id===id);
      if(!targetTask || targetTask.status==="completed") return;

      const runningTask = state.tasks.find(t=>t.status==="running");

      if(runningTask && runningTask.id !== id){
        const elapsed = nowMinutes() - runningTask.runningStart;
        runningTask.elapsedBefore = (runningTask.elapsedBefore||0) + Math.max(0, elapsed);
        runningTask.runningStart = null;
        runningTask.status = "paused";
      }

      const activeQueue = state.tasks
        .filter(t => t.status !== "completed")
        .sort((a,b) => a.order - b.order);

      const otherTasks = activeQueue.filter(t => t.id !== targetTask.id && (!runningTask || t.id !== runningTask.id));

      const newOrder = [targetTask];
      if(runningTask && runningTask.id !== targetTask.id){
        newOrder.push(runningTask);
      }
      newOrder.push(...otherTasks);

      newOrder.forEach((t, idx) => {
        t.order = idx + 1;
      });

      targetTask.status = "running";
      targetTask.runningStart = nowMinutes();
      const plannedEnd = targetTask.runningStart + (targetTask.planned - (targetTask.elapsedBefore||0));
      setNotifyState({taskId: targetTask.id, lastNotifiedAt: nowMinutes(), timeEndNotified: nowMinutes() >= plannedEnd});
      saveState();
      smartRender();
    }

    function pauseTask(id){
      const state = getState();
      const t = state.tasks.find(t=>t.id===id);
      if(!t || t.status!=="running") return;
      const elapsed = nowMinutes() - t.runningStart;
      t.elapsedBefore = (t.elapsedBefore||0) + Math.max(0, elapsed);
      t.runningStart = null;
      t.status = "paused";
      if(getNotifyState().taskId === id) setNotifyState({taskId:null, lastNotifiedAt:null, timeEndNotified:false});
      saveState();
      smartRender();
    }

    function resumeTask(id){
      startTask(id);
    }

    function completeTask(id){
      const state = getState();
      const t = state.tasks.find(t=>t.id===id);
      if(!t) return;
      let actual = t.elapsedBefore || 0;
      if(t.status === "running" && t.runningStart !== null){
        actual += Math.max(0, nowMinutes() - t.runningStart);
      }
      t.status = "completed";
      t.completedAt = nowMinutes();
      t.actualDuration = actual;
      t.elapsedBefore = actual;
      t.runningStart = null;
      if(getNotifyState().taskId === id) setNotifyState({taskId:null, lastNotifiedAt:null, timeEndNotified:false});
      saveState();
      if(ctx.getCurrentView() === 'task' && ctx.getFocusTaskId() === id){
        window.location.hash = '#/';
      } else {
        smartRender();
      }
    }

    function uncompleteTask(id){
      const state = getState();
      const t = state.tasks.find(t=>t.id===id);
      if(!t || t.status !== "completed") return;
      const maxOrder = state.tasks.filter(t2=>t2.status!=="completed").reduce((m,t2)=>Math.max(m,t2.order),0);
      const savedElapsed = t.actualDuration ?? t.elapsedBefore ?? 0;
      t.status = savedElapsed > 0 ? "paused" : "pending";
      t.completedAt = null;
      t.elapsedBefore = savedElapsed;
      t.actualDuration = null;
      t.runningStart = null;
      t.order = maxOrder + 1;
      saveState();
      renderAll();
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

      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";

      if(window.location.hash !== '#/interruption'){
        window.location.hash = '#/interruption';
      } else {
        smartRender();
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

      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";

      showToast(`Interrupción "${title}" finalizada (${fmtDur(duration)}).`);
      window.location.hash = '#/';
    }

    function cancelInterruption(){
      if(interruptionTitleTimer){
        clearTimeout(interruptionTitleTimer);
        interruptionTitleTimer = null;
      }
      const state = getState();
      if(!state.activeInterruption && ctx.getCurrentView() !== 'interruption') return;
      state.activeInterruption = null;
      saveState();

      const container = document.getElementById('view-interruption');
      if(container) container.innerHTML = "";

      showToast("Interrupción cancelada.");
      window.location.hash = '#/';
    }

    return {
      startTask, pauseTask, resumeTask, completeTask, uncompleteTask,
      startInterruption, updateInterruptionTitle, completeInterruption, cancelInterruption
    };
  };
})();
