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

    /* Task search input & clear button listeners */
    const taskSearchInputEl = document.getElementById("taskSearchInput");
    const taskSearchClearBtnEl = document.getElementById("taskSearchClearBtn");

    if (taskSearchInputEl) {
      taskSearchInputEl.addEventListener("input", (e) => {
        const val = e.target.value;
        if (taskSearchClearBtnEl) {
          taskSearchClearBtnEl.style.display = val ? "block" : "none";
        }
        if (appCtx.setTaskSearchQuery) {
          appCtx.setTaskSearchQuery(val);
        }
        if (appCtx.renderTasks) {
          appCtx.renderTasks();
        } else if (appCtx.renderAll) {
          appCtx.renderAll();
        }
      });

      taskSearchInputEl.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          taskSearchInputEl.value = "";
          if (taskSearchClearBtnEl) taskSearchClearBtnEl.style.display = "none";
          if (appCtx.setTaskSearchQuery) appCtx.setTaskSearchQuery("");
          if (appCtx.renderTasks) appCtx.renderTasks();
          taskSearchInputEl.blur();
        }
      });
    }

    if (taskSearchClearBtnEl) {
      taskSearchClearBtnEl.addEventListener("click", () => {
        if (taskSearchInputEl) {
          taskSearchInputEl.value = "";
          taskSearchInputEl.focus();
        }
        taskSearchClearBtnEl.style.display = "none";
        if (appCtx.setTaskSearchQuery) {
          appCtx.setTaskSearchQuery("");
        }
        if (appCtx.renderTasks) {
          appCtx.renderTasks();
        } else if (appCtx.renderAll) {
          appCtx.renderAll();
        }
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
    let autoMoveToToday = true;
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
      autoMoveToToday = autoMoveCb ? autoMoveCb.checked : true;
    }

    actionsModule.addTask(title, dur, toTop, recurringData, autoMoveToToday);
    titleEl.value = "";
    document.getElementById("taskDuration").value = "";
    if (autoMoveCb) autoMoveCb.checked = true;
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

    function startHolding(e) {
      if (e.type === "mousedown" && e.button !== 0) return;
      isLongPress = false;
      if (addTaskBtn) addTaskBtn.classList.add("btn-holding");
      longPressTimeout = setTimeout(() => {
        isLongPress = true;
        showInsertPositionMenu();
        cancelHolding();
      }, 600);
    }

    function cancelHolding() {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
      if (addTaskBtn) addTaskBtn.classList.remove("btn-holding");
    }

    if (addTaskBtn) {
      addTaskBtn.addEventListener("mousedown", startHolding);
      addTaskBtn.addEventListener("touchstart", startHolding, { passive: true });
      addTaskBtn.addEventListener("mouseup", cancelHolding);
      addTaskBtn.addEventListener("mouseleave", cancelHolding);
      addTaskBtn.addEventListener("touchend", cancelHolding);
      addTaskBtn.addEventListener("touchcancel", cancelHolding);

      addTaskBtn.addEventListener("click", (e) => {
        if (isLongPress) {
          e.preventDefault();
          e.stopPropagation();
          isLongPress = false;
          return;
        }
        handleTaskSubmit(false);
      });

      addTaskBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showInsertPositionMenu();
      });
    }

    /* Position menu popup */
    function showInsertPositionMenu(){
      const existing = document.getElementById("addTaskPositionMenu");
      if (existing) existing.remove();

      const titleEl = document.getElementById("taskTitle");
      const title = titleEl ? titleEl.value.trim() : "";
      if(!title){
        showToast("Escribe un título para la tarea.");
        if (titleEl) titleEl.focus();
        return;
      }

      const menu = document.createElement("div");
      menu.id = "addTaskPositionMenu";
      menu.className = "task-context-menu";

      const optionTop = document.createElement("div");
      optionTop.className = "task-menu-item";
      optionTop.innerHTML = "<span>⬆️</span> <span>Añadir al inicio (arriba)</span>";
      optionTop.addEventListener("click", () => {
        handleTaskSubmit(true);
        menu.remove();
      });

      const optionBottom = document.createElement("div");
      optionBottom.className = "task-menu-item";
      optionBottom.innerHTML = "<span>⬇️</span> <span>Añadir al final (abajo)</span>";
      optionBottom.addEventListener("click", () => {
        handleTaskSubmit(false);
        menu.remove();
      });

      menu.appendChild(optionTop);
      menu.appendChild(optionBottom);
      document.body.appendChild(menu);

      if (addTaskBtn) {
        const rect = addTaskBtn.getBoundingClientRect();
        menu.style.position = "absolute";
        menu.style.top = `${rect.bottom + window.scrollY + 6}px`;

        const menuWidth = 200;
        let leftPos = rect.right + window.scrollX - menuWidth;
        if (leftPos < 10) leftPos = 10;
        if (leftPos + menuWidth > window.innerWidth - 10) {
          leftPos = Math.max(10, window.innerWidth - menuWidth - 10);
        }
        menu.style.left = `${leftPos}px`;
      }

      setTimeout(() => {
        const clickOutside = (ev) => {
          if (!menu.contains(ev.target) && ev.target !== addTaskBtn) {
            menu.remove();
            document.removeEventListener("click", clickOutside);
            document.removeEventListener("touchstart", clickOutside);
          }
        };
        document.addEventListener("click", clickOutside);
        document.addEventListener("touchstart", clickOutside);
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

export default TodayTasksForms;
