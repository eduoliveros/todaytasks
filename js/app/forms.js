/* app/forms.js — Formularios de reuniones y tareas, menú de posición */
export function TodayTasksForms(appCtx){
  const { getState, actionsModule, showToast, fmt, timeToMinutes } = appCtx;

  if (typeof document !== "undefined") {
    /* Meeting start → auto-fill end (+30 min) */
    const meetingStartEl = document.getElementById("meetingStart");
    if (meetingStartEl) {
      meetingStartEl.addEventListener("change", (e)=>{
        const endInput = document.getElementById("meetingEnd");
        if(endInput && endInput.value) return;
        const start = timeToMinutes(e.target.value);
        if(start === null) return;
        if(endInput) endInput.value = fmt(start + 30);
      });
    }

    /* Recurring checkbox toggles */
    const isRecurringCb = document.getElementById("isRecurringCheckbox");
    if (isRecurringCb) {
      isRecurringCb.addEventListener("change", (e) => {
        const opts = document.getElementById("recurringFormOptions");
        if (opts) opts.style.display = e.target.checked ? "block" : "none";
      });
    }

    const isRecurringTaskCb = document.getElementById("isRecurringTaskCheckbox");
    if (isRecurringTaskCb) {
      isRecurringTaskCb.addEventListener("change", (e) => {
        const opts = document.getElementById("recurringTaskFormOptions");
        if (opts) opts.style.display = e.target.checked ? "block" : "none";
        const autoMoveWrap = document.getElementById("autoMoveTaskOptionWrap");
        if (autoMoveWrap) autoMoveWrap.style.display = e.target.checked ? "none" : "block";
      });
    }

    const recFreqEl = document.getElementById("recFreq");
    if (recFreqEl) {
      recFreqEl.addEventListener("change", (e) => {
        const daysWrap = document.getElementById("recDaysWrap");
        if (daysWrap) daysWrap.style.display = e.target.value === "daily" ? "none" : "block";
      });
    }

    const recTaskFreqEl = document.getElementById("recTaskFreq");
    if (recTaskFreqEl) {
      recTaskFreqEl.addEventListener("change", (e) => {
        const daysWrap = document.getElementById("recTaskDaysWrap");
        if (daysWrap) daysWrap.style.display = e.target.value === "daily" ? "none" : "block";
      });
    }
  }

  /* Meeting submit */
  function handleMeetingSubmit(){
    if (typeof document === "undefined") return;
    const titleEl = document.getElementById("meetingTitle");
    if (!titleEl) return;
    const title = titleEl.value.trim();
    const start = document.getElementById("meetingStart").value;
    const end = document.getElementById("meetingEnd").value;
    if(!title){
      showToast("Escribe un título para la reunión.");
      titleEl.focus();
      return;
    }

    const isRecurringCb = document.getElementById("isRecurringCheckbox");
    let recurringData = null;
    if (isRecurringCb && isRecurringCb.checked) {
      const freq = document.getElementById("recFreq").value;
      const interval = parseInt(document.getElementById("recInterval").value, 10) || 1;
      const dayCbs = document.querySelectorAll(".rec-day-cb:checked");
      const daysOfWeek = Array.from(dayCbs).map(cb => parseInt(cb.value, 10));
      const endDate = document.getElementById("recEndDate").value || null;
      recurringData = { isRecurring: true, freq, interval, daysOfWeek, endDate };
    }

    actionsModule.addMeeting(title, start, end, recurringData);
    titleEl.value = "";
    document.getElementById("meetingStart").value = "";
    document.getElementById("meetingEnd").value = "";
    if (isRecurringCb) {
      isRecurringCb.checked = false;
      const opts = document.getElementById("recurringFormOptions");
      if (opts) opts.style.display = "none";
    }
    titleEl.focus();
  }

  /* Task submit */
  function handleTaskSubmit(toTop = false){
    if (typeof document === "undefined") return;
    const titleEl = document.getElementById("taskTitle");
    if (!titleEl) return;
    const title = titleEl.value.trim();
    const dur = document.getElementById("taskDuration").value;
    if(!title){
      showToast("Escribe un título para la tarea.");
      titleEl.focus();
      return;
    }

    let recurringData = null;
    let autoMoveToToday = false;
    const recurringTaskCb = document.getElementById("isRecurringTaskCheckbox");
    const autoMoveCb = document.getElementById("isAutoMoveTaskCheckbox");
    if (recurringTaskCb && recurringTaskCb.checked) {
      const freq = document.getElementById("recTaskFreq").value;
      const interval = parseInt(document.getElementById("recTaskInterval").value, 10) || 1;
      const dayCbs = document.querySelectorAll(".rec-task-day-cb:checked");
      const daysOfWeek = Array.from(dayCbs).map(cb => parseInt(cb.value, 10));
      const endDate = document.getElementById("recTaskEndDate").value || null;
      recurringData = { isRecurring: true, freq, interval, daysOfWeek, endDate };
    } else {
      autoMoveToToday = !!(autoMoveCb && autoMoveCb.checked);
    }

    actionsModule.addTask(title, dur, toTop, recurringData, autoMoveToToday);
    titleEl.value = "";
    document.getElementById("taskDuration").value = "";
    if (autoMoveCb) autoMoveCb.checked = false;
    if (recurringTaskCb) {
      recurringTaskCb.checked = false;
      const opts = document.getElementById("recurringTaskFormOptions");
      if (opts) opts.style.display = "none";
      const autoMoveWrap = document.getElementById("autoMoveTaskOptionWrap");
      if (autoMoveWrap) autoMoveWrap.style.display = "block";
    }
    titleEl.focus();
  }

  if (typeof document !== "undefined") {
    const addMeetingBtn = document.getElementById("addMeetingBtn");
    if (addMeetingBtn) addMeetingBtn.addEventListener("click", handleMeetingSubmit);

    /* Long-press add task button */
    const addTaskBtn = document.getElementById("addTaskBtn");
    let longPressTimeout = null;
    let isLongPress = false;

    if (addTaskBtn) {
      addTaskBtn.addEventListener("mousedown", (e) => {
        if(e.button !== 0) return;
        isLongPress = false;
        longPressTimeout = setTimeout(() => {
          isLongPress = true;
          openTaskPositionMenu(addTaskBtn);
        }, 500);
      });

      addTaskBtn.addEventListener("mouseup", () => {
        clearTimeout(longPressTimeout);
      });

      addTaskBtn.addEventListener("mouseleave", () => {
        clearTimeout(longPressTimeout);
      });

      addTaskBtn.addEventListener("click", (e) => {
        if(isLongPress) {
          e.preventDefault();
          e.stopPropagation();
          isLongPress = false;
          return;
        }
        handleTaskSubmit(false);
      });

      addTaskBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openTaskPositionMenu(addTaskBtn);
      });
    }

    /* Position menu popup */
    function openTaskPositionMenu(anchorEl){
      const existing = document.getElementById("taskPositionMenu");
      if(existing) existing.remove();

      const menu = document.createElement("div");
      menu.id = "taskPositionMenu";
      menu.className = "task-position-menu";
      menu.innerHTML = `
        <div class="pos-option" data-top="true">
          <span class="pos-icon">▲</span>
          <div>
            <strong>Añadir arriba del todo</strong>
            <small>Prioridad máxima, primera de la lista</small>
          </div>
        </div>
        <div class="pos-option" data-top="false">
          <span class="pos-icon">▼</span>
          <div>
            <strong>Añadir abajo del todo</strong>
            <small>Al final de la cola (por defecto)</small>
          </div>
        </div>
      `;

      document.body.appendChild(menu);

      const rect = anchorEl.getBoundingClientRect();
      menu.style.position = "fixed";
      menu.style.bottom = (window.innerHeight - rect.top + 6) + "px";
      menu.style.right = (window.innerWidth - rect.right) + "px";

      menu.querySelectorAll(".pos-option").forEach(opt => {
        opt.addEventListener("click", () => {
          const toTop = opt.getAttribute("data-top") === "true";
          menu.remove();
          handleTaskSubmit(toTop);
        });
      });

      setTimeout(() => {
        const clickOutside = (e) => {
          if(!menu.contains(e.target) && e.target !== anchorEl){
            menu.remove();
            document.removeEventListener("click", clickOutside);
          }
        };
        document.addEventListener("click", clickOutside);
      }, 50);
    }

    /* Enter key listeners for meeting and task inputs */
    ["meetingTitle", "meetingStart", "meetingEnd"].forEach(id => {
      const el = document.getElementById(id);
      if(el){
        el.addEventListener("keydown", (e) => {
          if(e.key === "Enter"){
            e.preventDefault();
            handleMeetingSubmit();
          }
        });
      }
    });

    ["taskTitle", "taskDuration"].forEach(id => {
      const el = document.getElementById(id);
      if(el){
        el.addEventListener("keydown", (e) => {
          if(e.key === "Enter"){
            e.preventDefault();
            handleTaskSubmit(e.shiftKey);
          }
        });
      }
    });
  }

  return { handleMeetingSubmit, handleTaskSubmit };
}

if (typeof window !== "undefined") {
  window._TodayTasksForms = TodayTasksForms;
  window.TodayTasksForms = TodayTasksForms;
}

export default TodayTasksForms;
