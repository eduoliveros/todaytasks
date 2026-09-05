/* app/urgency-dropdown.js — Selector de urgencia estilo Linear y opciones de destacado */
import { t } from '../i18n.js';
import { positionPopover } from '../ui.js';

export function getUrgencyMap() {
  return {
    today: { icon: '🟠', label: t('urgency.today'), cls: 'urgency-btn-today' },
    days: { icon: '🔵', label: t('urgency.days'), cls: 'urgency-btn-days' },
    week: { icon: '🟣', label: t('urgency.week'), cls: 'urgency-btn-week' },
    later: { icon: '⚪', label: t('urgency.later'), cls: 'urgency-btn-later' }
  };
}

export function TodayTasksUrgencyDropdown(ctx) {
  const { getState, getActionsModule } = ctx;
  let currentUrgencyTaskId = null;
  let _formUrgencyMode = false;
  let _editUrgencyTaskId = null;

  function openUrgencyDropdown(taskId, event) {
    try {
      if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      currentUrgencyTaskId = taskId;
      _formUrgencyMode = false;
      _editUrgencyTaskId = null;
      const dropdown = document.getElementById('urgencyDropdownMenu');
      const overlay = document.getElementById('urgencyDropdownOverlay');
      if (!dropdown) return;

      const currentState = typeof getState === 'function' ? getState() : {};
      const task = (currentState.tasks || []).find(x => String(x.id) === String(taskId));
      const currentUrgency = task ? (task.urgency || "days") : "days";

      // Highlight selected urgency item in menu
      dropdown.querySelectorAll('.urgency-option-item').forEach(item => {
        const val = item.dataset.urgency;
        item.classList.toggle('active', val === currentUrgency);
      });

      if (overlay) overlay.style.display = 'block';
      dropdown.style.display = 'block';

      positionPopover(event, dropdown, { width: 170, height: 180, gap: 4 });
    } catch (err) {
      console.error("Error in openUrgencyDropdown:", err);
    }
  }

  function openFormUrgencyDropdown(event) {
    try {
      if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      _formUrgencyMode = true;
      currentUrgencyTaskId = null;
      _editUrgencyTaskId = null;
      const dropdown = document.getElementById('urgencyDropdownMenu');
      const overlay = document.getElementById('urgencyDropdownOverlay');
      if (!dropdown) return;

      const currentUrgency = (document.getElementById('taskUrgencySelect') || {}).value || 'days';
      dropdown.querySelectorAll('.urgency-option-item').forEach(item => {
        item.classList.toggle('active', item.dataset.urgency === currentUrgency);
      });

      if (overlay) overlay.style.display = 'block';
      dropdown.style.display = 'block';

      positionPopover(event, dropdown, { width: 170, height: 180, gap: 4 });
    } catch (err) {
      console.error("Error in openFormUrgencyDropdown:", err);
    }
  }

  function selectTaskUrgency(urgency) {
    const actionsModule = typeof getActionsModule === 'function' ? getActionsModule() : ctx.actionsModule;
    const urgencyMap = getUrgencyMap();
    const info = urgencyMap[urgency] || urgencyMap.days;

    if (_formUrgencyMode) {
      _formUrgencyMode = false;
      const hiddenInput = document.getElementById('taskUrgencySelect');
      if (hiddenInput) hiddenInput.value = urgency;
      const pill = document.getElementById('formUrgencyPill');
      const iconEl = document.getElementById('formUrgencyIcon');
      const labelEl = document.getElementById('formUrgencyLabel');
      if (pill) {
        pill.className = `urgency-pill-btn ${info.cls}`;
        pill.setAttribute('aria-label', `Urgencia ${info.label}`);
      }
      if (iconEl) iconEl.textContent = info.icon;
      if (labelEl) labelEl.textContent = info.label;
    } else if (_editUrgencyTaskId) {
      const editId = _editUrgencyTaskId;
      _editUrgencyTaskId = null;
      if (actionsModule && actionsModule.updateTaskEditField) {
        actionsModule.updateTaskEditField('urgency', urgency);
      }
      if (typeof ctx.getTaskEdit === 'function') {
        const te = ctx.getTaskEdit();
        if (te) te.urgency = urgency;
      }
      const pills = [
        ...document.querySelectorAll(`#triage-edit-urgency-pill-${editId}`),
        ...document.querySelectorAll(`#edit-urgency-pill-${editId}`),
        ...document.querySelectorAll('#triageTaskEditModal .urgency-pill-btn'),
        ...document.querySelectorAll('.triage-edit-modal-box .urgency-pill-btn')
      ];
      const uniquePills = Array.from(new Set(pills));
      if (uniquePills.length === 0) {
        const fallback = document.querySelector('.modal-box .urgency-pill-btn');
        if (fallback) uniquePills.push(fallback);
      }
      uniquePills.forEach(pill => {
        pill.className = `urgency-pill-btn ${info.cls}`;
        pill.setAttribute('aria-label', `Urgencia ${info.label}`);
        pill.title = t('tasks.editUrgencyTooltip', { label: info.label }) || `Urgencia: ${info.label}`;
        pill.innerHTML = `<span>${info.icon}</span> <span>${info.label}</span> <span class="urgency-pill-chevron">▾</span>`;
      });
    } else if (currentUrgencyTaskId) {
      if (actionsModule && actionsModule.setTaskUrgency) {
        actionsModule.setTaskUrgency(currentUrgencyTaskId, urgency);
      }
    }
    closeUrgencyDropdown();
  }

  function closeUrgencyDropdown() {
    const dropdown = document.getElementById('urgencyDropdownMenu');
    const overlay = document.getElementById('urgencyDropdownOverlay');
    if (dropdown) dropdown.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    currentUrgencyTaskId = null;
    _formUrgencyMode = false;
    _editUrgencyTaskId = null;
  }

  function toggleFormFeatured(event) {
    try {
      if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      const actionsModule = typeof getActionsModule === 'function' ? getActionsModule() : ctx.actionsModule;
      const hiddenInput = document.getElementById('isFeaturedTaskCheckbox');
      const starBtn = document.getElementById('formFeaturedStarBtn');
      const currentVal = hiddenInput ? hiddenInput.value === 'true' : false;
      const newVal = !currentVal;

      if (newVal) {
        const currentState = typeof getState === 'function' ? getState() : {};
        const featuredCount = (currentState.tasks || []).filter(t => t.status !== 'completed' && t.featured).length;
        if (featuredCount >= 5) {
          if (actionsModule && actionsModule.showFeaturedLimitModal) {
            actionsModule.showFeaturedLimitModal(null, (unfeatureId) => {
              actionsModule.setTaskFeatured(unfeatureId, false);
              if (hiddenInput) hiddenInput.value = 'true';
              if (starBtn) {
                starBtn.textContent = '⭐';
                starBtn.classList.add('is-featured');
                starBtn.title = 'Quitar destacado';
              }
            });
          }
          return;
        }
      }

      if (hiddenInput) hiddenInput.value = String(newVal);
      if (starBtn) {
        starBtn.textContent = newVal ? '⭐' : '☆';
        starBtn.classList.toggle('is-featured', newVal);
        starBtn.title = newVal ? 'Quitar destacado' : 'Marcar como destacada (máx. 5 al día)';
      }
    } catch (err) {
      console.error("Error in toggleFormFeatured:", err);
    }
  }

  function openEditUrgencyDropdown(taskId, event) {
    try {
      if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      openUrgencyDropdown('__edit__', event);
      _editUrgencyTaskId = taskId;
      currentUrgencyTaskId = null;
      _formUrgencyMode = false;
      const dropdown = document.getElementById('urgencyDropdownMenu');
      if (dropdown) {
        const taskEdit = typeof ctx.getTaskEdit === 'function' ? ctx.getTaskEdit() : null;
        const currentState = typeof getState === 'function' ? getState() : {};
        const currentUrgency = (taskEdit && taskEdit.urgency) || (currentState.tasks || []).find(x => String(x.id) === String(taskId))?.urgency || 'days';
        dropdown.querySelectorAll('.urgency-option-item').forEach(item => {
          item.classList.toggle('active', item.dataset.urgency === currentUrgency);
        });
      }
    } catch (err) {
      console.error("Error in openEditUrgencyDropdown:", err);
    }
  }

  function toggleEditFeatured(taskId, event) {
    try {
      if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
      }
      const taskEdit = typeof ctx.getTaskEdit === 'function' ? ctx.getTaskEdit() : null;
      const actionsModule = typeof getActionsModule === 'function' ? getActionsModule() : ctx.actionsModule;
      if (taskEdit) {
        taskEdit.featured = !taskEdit.featured;
        const starBtn = (event && (event.currentTarget || event.target)) || document.querySelector(`#task-item-${taskId} .star-btn`) || document.querySelector(`.triage-edit-modal-box .star-btn`);
        if (starBtn) {
          starBtn.classList.toggle('is-featured', taskEdit.featured);
          starBtn.textContent = taskEdit.featured ? '⭐' : '☆';
          starBtn.title = taskEdit.featured ? 'Quitar destacado' : 'Marcar como destacada (máx. 5 al día)';
        }
      } else if (actionsModule && actionsModule.toggleTaskFeatured) {
        actionsModule.toggleTaskFeatured(taskId);
      }
    } catch (err) {
      console.error("Error in toggleEditFeatured:", err);
    }
  }

  return {
    openUrgencyDropdown,
    openFormUrgencyDropdown,
    openEditUrgencyDropdown,
    selectTaskUrgency,
    closeUrgencyDropdown,
    toggleFormFeatured,
    toggleEditFeatured,
    getUrgencyMap,
    get currentUrgencyTaskId() { return currentUrgencyTaskId; },
    set currentUrgencyTaskId(v) { currentUrgencyTaskId = v; },
    get _formUrgencyMode() { return _formUrgencyMode; },
    set _formUrgencyMode(v) { _formUrgencyMode = v; },
    get _editUrgencyTaskId() { return _editUrgencyTaskId; },
    set _editUrgencyTaskId(v) { _editUrgencyTaskId = v; }
  };
}

export default TodayTasksUrgencyDropdown;
