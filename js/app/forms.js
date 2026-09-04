/* app/forms.js — Formularios de reuniones y tareas, menú de posición y notas markdown */
import { t } from '../i18n.js';
import { renderNotesMarkdown } from '../ui.js';

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
        updateTaskAdvancedIndicators();
      });
    }

    const isAutoMoveTaskCb = document.getElementById("isAutoMoveTaskCheckbox");
    if (isAutoMoveTaskCb) {
      isAutoMoveTaskCb.addEventListener("change", () => {
        updateTaskAdvancedIndicators();
      });
    }

    /* Recurrence frequency changes: toggle days of week visibility and unit label */
    const recFreqEl = document.getElementById("recFreq");
    if (recFreqEl) {
      recFreqEl.addEventListener("change", (e) => {
        const daysWrap = document.getElementById("recDaysWrap");
        const unitLabel = document.getElementById("recMeetingIntervalUnit");
        if (daysWrap) daysWrap.style.display = e.target.value === "daily" ? "none" : "block";
        if (unitLabel) unitLabel.textContent = e.target.value === "daily" ? t("recurrence.unitDays") : t("recurrence.unitWeeks");
      });
    }

    const recTaskFreqEl = document.getElementById("recTaskFreq");
    if (recTaskFreqEl) {
      recTaskFreqEl.addEventListener("change", (e) => {
        const daysWrap = document.getElementById("recTaskDaysWrap");
        const unitLabel = document.getElementById("recTaskIntervalUnit");
        if (daysWrap) daysWrap.style.display = e.target.value === "daily" ? "none" : "block";
        if (unitLabel) unitLabel.textContent = e.target.value === "daily" ? t("recurrence.unitDays") : t("recurrence.unitWeeks");
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
    const startAfterEl = document.getElementById("taskStartAfterInput");
    const startAfter = startAfterEl ? startAfterEl.value : null;
    const urgencyEl = document.getElementById("taskUrgencySelect");
    const urgency = urgencyEl ? urgencyEl.value : "days";
    const featuredEl = document.getElementById("isFeaturedTaskCheckbox");
    // featuredEl is now a hidden input with value "true"/"false"
    const featured = featuredEl ? featuredEl.value === 'true' : false;
    const notesEl = document.getElementById("taskNotesInput");
    const notes = notesEl ? notesEl.value : "";

    if (recurringTaskCb && recurringTaskCb.checked) {
      const freq = document.getElementById("recTaskFreq").value;
      const interval = parseInt(document.getElementById("recTaskInterval").value, 10) || 1;
      const dayCbs = document.querySelectorAll(".rec-task-day-cb:checked");
      const daysOfWeek = Array.from(dayCbs).map(cb => parseInt(cb.value, 10));
      const endDate = document.getElementById("recTaskEndDate").value || null;
      recurringData = { isRecurring: true, freq, interval, daysOfWeek, endDate, urgency, featured, startAfter, notes };
    } else {
      autoMoveToToday = autoMoveCb ? autoMoveCb.checked : true;
    }

    actionsModule.addTask(title, dur, toTop, recurringData, autoMoveToToday, urgency, featured, startAfter, notes);
    titleEl.value = "";
    document.getElementById("taskDuration").value = "";
    if (notesEl) notesEl.value = "";
    if (autoMoveCb) autoMoveCb.checked = true;

    // Reset startAfter
    if (startAfterEl) startAfterEl.value = "";
    const summaryBadge = document.getElementById("formStartAfterBadge");
    if (summaryBadge) summaryBadge.style.display = "none";

    // Reset urgency pill to "Días"
    if (urgencyEl) urgencyEl.value = "days";
    const pill = document.getElementById("formUrgencyPill");
    const iconEl = document.getElementById("formUrgencyIcon");
    const labelEl = document.getElementById("formUrgencyLabel");
    if (pill) { pill.className = "urgency-pill-btn urgency-btn-days"; }
    if (iconEl) iconEl.textContent = "🔵";
    if (labelEl) labelEl.textContent = "Días";

    // Reset star button
    if (featuredEl) featuredEl.value = "false";
    const starBtn = document.getElementById("formFeaturedStarBtn");
    if (starBtn) { starBtn.textContent = "☆"; starBtn.classList.remove("is-featured"); starBtn.title = "Marcar como destacada (máx. 5 al día)"; }

    if (recurringTaskCb) {
      recurringTaskCb.checked = false;
      const opts = document.getElementById("recurringTaskFormOptions");
      if (opts) opts.style.display = "none";
      const autoMoveWrap = document.getElementById("autoMoveTaskOptionWrap");
      if (autoMoveWrap) autoMoveWrap.style.display = "block";
    }

    updateTaskAdvancedIndicators();
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

  function updateTaskAdvancedIndicators() {
    if (typeof document === "undefined") return;
    const autoMoveCb = document.getElementById('isAutoMoveTaskCheckbox');
    const recCb = document.getElementById('isRecurringTaskCheckbox');
    const startAfterInput = document.getElementById('taskStartAfterInput');
    const notesInput = document.getElementById('taskNotesInput');

    const autoMoveBadge = document.getElementById('formAutoMoveBadge');
    const recBadge = document.getElementById('formRecurringBadge');
    const startAfterBadge = document.getElementById('formStartAfterBadge');
    const notesBadge = document.getElementById('formNotesBadge');

    if (autoMoveBadge) {
      autoMoveBadge.style.display = (autoMoveCb && autoMoveCb.checked && (!recCb || !recCb.checked)) ? 'inline-flex' : 'none';
    }
    if (recBadge) {
      recBadge.style.display = (recCb && recCb.checked) ? 'inline-flex' : 'none';
    }
    if (startAfterBadge) {
      const val = startAfterInput ? startAfterInput.value.trim() : '';
      if (val) {
        startAfterBadge.textContent = val + '+';
        startAfterBadge.style.display = 'inline-flex';
      } else {
        startAfterBadge.style.display = 'none';
      }
    }
    if (notesBadge) {
      const val = notesInput ? notesInput.value.trim() : '';
      notesBadge.style.display = val ? 'inline-flex' : 'none';
    }
  }

  function insertFormNotesFormat(prefix, suffix) {
    if (typeof document === "undefined") return;
    const textarea = document.getElementById('taskNotesInput');
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const val = textarea.value || '';
    const selected = val.substring(start, end) || 'texto';
    textarea.value = val.substring(0, start) + prefix + selected + suffix + val.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    updateTaskAdvancedIndicators();
  }

  function insertFormNotesLink() {
    if (typeof document === "undefined") return;
    const textarea = document.getElementById('taskNotesInput');
    if (!textarea) return;
    const url = (typeof window !== "undefined" && window.prompt) ? window.prompt('Introduce la URL (ej: https://...):', 'https://') : 'https://';
    if (!url) return;
    const title = (typeof window !== "undefined" && window.prompt) ? (window.prompt('Texto del enlace (opcional):', 'Enlace') || 'Enlace') : 'Enlace';
    const start = textarea.selectionStart || 0;
    const val = textarea.value || '';
    const linkMd = `[${title}](${url})`;
    textarea.value = val.substring(0, start) + linkMd + val.substring(start);
    textarea.focus();
    updateTaskAdvancedIndicators();
  }

  function insertEditNotesFormat(taskId, prefix, suffix) {
    if (typeof document === "undefined") return;
    const textarea = document.getElementById(`task-edit-notes-${taskId}`);
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const val = textarea.value || '';
    const selected = val.substring(start, end) || 'texto';
    textarea.value = val.substring(0, start) + prefix + selected + suffix + val.substring(end);
    if (actionsModule && actionsModule.updateTaskEditField) {
      actionsModule.updateTaskEditField('notes', textarea.value);
    }
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  }

  function insertEditNotesLink(taskId) {
    if (typeof document === "undefined") return;
    const textarea = document.getElementById(`task-edit-notes-${taskId}`);
    if (!textarea) return;
    const url = (typeof window !== "undefined" && window.prompt) ? window.prompt('Introduce la URL (ej: https://...):', 'https://') : 'https://';
    if (!url) return;
    const title = (typeof window !== "undefined" && window.prompt) ? (window.prompt('Texto del enlace (opcional):', 'Enlace') || 'Enlace') : 'Enlace';
    const start = textarea.selectionStart || 0;
    const val = textarea.value || '';
    const linkMd = `[${title}](${url})`;
    textarea.value = val.substring(0, start) + linkMd + val.substring(start);
    if (actionsModule && actionsModule.updateTaskEditField) {
      actionsModule.updateTaskEditField('notes', textarea.value);
    }
    textarea.focus();
  }

  function toggleEditNotesPreview(taskId) {
    if (typeof document === "undefined") return;
    const textarea = document.getElementById(`task-edit-notes-${taskId}`);
    const preview = document.getElementById(`task-edit-notes-preview-${taskId}`);
    const btn = document.getElementById(`btn-preview-edit-${taskId}`);
    if (!textarea || !preview) return;
    const isHidden = preview.style.display === 'none';
    if (isHidden) {
      preview.innerHTML = renderNotesMarkdown(textarea.value || '');
      preview.style.display = 'block';
      textarea.style.display = 'none';
      if (btn) btn.textContent = '✏️';
    } else {
      preview.style.display = 'none';
      textarea.style.display = 'block';
      if (btn) btn.textContent = '👁️';
    }
  }

  function onFormStartAfterChange(val) {
    updateTaskAdvancedIndicators();
  }

  function clearFormStartAfterDirect() {
    if (typeof document === "undefined") return;
    const input = document.getElementById('taskStartAfterInput');
    if (input) {
      input.value = '';
      input.focus();
    }
    updateTaskAdvancedIndicators();
  }

  function toggleTaskAdvancedOptions() {
    if (typeof document === "undefined") return;
    const wrap = document.getElementById('taskAdvancedOptionsWrap');
    const btn = document.getElementById('taskAdvancedToggleBtn');
    const chevron = document.getElementById('taskAdvancedChevron');
    if (!wrap) return;
    const isOpen = wrap.style.display === 'block';
    wrap.style.display = isOpen ? 'none' : 'block';
    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  }

  return {
    handleMeetingSubmit,
    handleTaskSubmit,
    updateTaskAdvancedIndicators,
    insertFormNotesFormat,
    insertFormNotesLink,
    insertEditNotesFormat,
    insertEditNotesLink,
    toggleEditNotesPreview,
    onFormStartAfterChange,
    clearFormStartAfterDirect,
    toggleTaskAdvancedOptions
  };
}

export default TodayTasksForms;
