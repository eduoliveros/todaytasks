(function () {
  function defaultState(){
    return {
      workStart: 9*60, // minutes since midnight
      workEnd: 18*60,  // minutes since midnight
      meetings: [],   // {id, title, start, end}
      tasks: [],      // {id,title,planned,order,status,runningStart,elapsedBefore,completedAt,actualDuration}
      interruptions: [], // {id, title, start, end, duration}
      activeInterruption: null, // {id, title, start}
      notifyIntervalMin: 10,
      planningMode: false,
      nextId: 1
    };
  }

  function loadState(storageKey){
    try{
      const raw = localStorage.getItem(storageKey);
      if(!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // basic shape guard
      if(typeof parsed.workEnd !== "number" || !Array.isArray(parsed.meetings) || !Array.isArray(parsed.tasks)){
        return defaultState();
      }
      if(!Array.isArray(parsed.interruptions)){
        parsed.interruptions = [];
      }
      if(parsed.activeInterruption === undefined){
        parsed.activeInterruption = null;
      }
      if(typeof parsed.notifyIntervalMin !== "number" || parsed.notifyIntervalMin <= 0){
        parsed.notifyIntervalMin = 10;
      }
      if(typeof parsed.workStart !== "number"){
        parsed.workStart = 9*60;
      }
      if(typeof parsed.planningMode !== "boolean"){
        parsed.planningMode = false;
      }
      return parsed;
    }catch(e){
      console.error("No se pudo leer el estado guardado", e);
      return defaultState();
    }
  }

  window.TodayTasksState = { defaultState, loadState };
})();

