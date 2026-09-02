/* views/triage.js — Vista de Triaje Rápido (#/triage) */
import {
  nowMinutes, fmt, fmtDur, getTaskElapsed, getTodayStr, formatDateFriendly,
  getDayOfWeek, getNextWorkingDays, URGENCY_LEVELS, DEFAULT_URGENCY, MAX_FEATURED_TASKS
} from '../utils.js';
import { escapeHtml, escapeAttr, showToast } from '../ui.js';
import { computeSchedule } from '../scheduler.js';

export function TodayTasksTriageView(ctx) {
  const { getState, saveState, renderAll, smartRender, actionsModule } = ctx;

  let currentSort = 'urgency'; // 'urgency' | 'viability' | 'duration' | 'featured'
  const collapsedGroups = new Set(['days', 'week', 'later']); // por defecto 'today' abierto, resto plegados
  const selectedTaskIds = new Set();
  let activeSingleUrgencyTaskId = null;

  function getTargetDateStr() {
    const state = getState();
    if (state.planningMode && state.selectedDate) {
      return state.selectedDate;
    }
    return getTodayStr();
  }

  function getActiveTasks(targetDateStr) {
    const state = getState();
    const envKey = state.activeEnv || 'work';
    const env = state.environments ? (state.environments[envKey] || state.environments.work) : null;
    const dayObj = env && env.days ? env.days[targetDateStr] : null;

    let tasksList = [];
    if (dayObj && Array.isArray(dayObj.tasks)) {
      tasksList = dayObj.tasks;
    } else if (targetDateStr === state.selectedDate && Array.isArray(state.tasks)) {
      tasksList = state.tasks;
    }

    return tasksList.filter(t => t.status !== 'completed');
  }

  function formatShortDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function getGroups(activeTasks, targetDateStr) {
    const state = getState();
    const schedule = computeSchedule({ ...state, tasks: activeTasks, selectedDate: targetDateStr }, nowMinutes());
    const overflowIds = schedule && schedule.overflowIds ? schedule.overflowIds : new Set();

    if (currentSort === 'urgency') {
      const groups = [
        { id: 'today', title: 'Hoy', icon: '🟠', tasks: [] },
        { id: 'days', title: 'Próximos días', icon: '🔵', tasks: [] },
        { id: 'week', title: 'Esta semana', icon: '🟣', tasks: [] },
        { id: 'later', title: 'Más adelante', icon: '⚪', tasks: [] }
      ];
      activeTasks.forEach(t => {
        const u = t.urgency || DEFAULT_URGENCY;
        const g = groups.find(x => x.id === u) || groups[1];
        g.tasks.push({ ...t, overflow: overflowIds.has(t.id) });
      });
      // Ordenar dentro de cada grupo de MENOR a MAYOR duración
      groups.forEach(g => g.tasks.sort((a, b) => (a.planned || 0) - (b.planned || 0)));
      return groups;
    }

    if (currentSort === 'viability') {
      const groups = [
        { id: 'fits', title: 'Caben dentro del horario de hoy', icon: '✅', tasks: [] },
        { id: 'overflow', title: 'Desbordan la jornada (Overflow)', icon: '⚠️', tasks: [] }
      ];
      activeTasks.forEach(t => {
        const isOverflow = overflowIds.has(t.id);
        if (!isOverflow) {
          groups[0].tasks.push({ ...t, overflow: false });
        } else {
          groups[1].tasks.push({ ...t, overflow: true });
        }
      });
      groups.forEach(g => g.tasks.sort((a, b) => (a.planned || 0) - (b.planned || 0)));
      return groups;
    }

    if (currentSort === 'duration') {
      const groups = [
        { id: 'quick', title: 'Quick Wins (≤ 15 min)', icon: '⚡', tasks: [] },
        { id: 'medium', title: 'Medias (20 a 45 min)', icon: '⏳', tasks: [] },
        { id: 'long', title: 'Largas (> 45 min)', icon: '🏋️', tasks: [] }
      ];
      activeTasks.forEach(t => {
        const dur = t.planned || 0;
        const item = { ...t, overflow: overflowIds.has(t.id) };
        if (dur <= 15) groups[0].tasks.push(item);
        else if (dur <= 45) groups[1].tasks.push(item);
        else groups[2].tasks.push(item);
      });
      groups.forEach(g => g.tasks.sort((a, b) => (a.planned || 0) - (b.planned || 0)));
      return groups;
    }

    if (currentSort === 'featured') {
      const groups = [
        { id: 'feat', title: 'Tareas Destacadas (⭐ Top 5)', icon: '⭐', tasks: [] },
        { id: 'unfeat', title: 'Otras tareas en cola', icon: '📋', tasks: [] }
      ];
      activeTasks.forEach(t => {
        const item = { ...t, overflow: overflowIds.has(t.id) };
        if (t.featured) groups[0].tasks.push(item);
        else groups[1].tasks.push(item);
      });
      groups.forEach(g => g.tasks.sort((a, b) => (a.planned || 0) - (b.planned || 0)));
      return groups;
    }

    return [];
  }

  function setTriageSortMode(mode) {
    if (!['urgency', 'viability', 'duration', 'featured'].includes(mode)) return;
    currentSort = mode;
    // Si cambia de modo, reiniciar colapsos según sentido común
    collapsedGroups.clear();
    if (mode === 'urgency') {
      collapsedGroups.add('days');
      collapsedGroups.add('week');
      collapsedGroups.add('later');
    } else if (mode === 'duration') {
      collapsedGroups.add('long');
    } else if (mode === 'featured') {
      collapsedGroups.add('unfeat');
    }
    renderTriageView();
  }

  function toggleTriageGroup(groupId) {
    if (collapsedGroups.has(groupId)) {
      collapsedGroups.delete(groupId);
    } else {
      collapsedGroups.add(groupId);
    }
    renderTriageView();
  }

  function toggleAllTriageGroups(open) {
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const groups = getGroups(activeTasks, targetDateStr);
    if (open) {
      collapsedGroups.clear();
    } else {
      groups.forEach(g => collapsedGroups.add(g.id));
    }
    renderTriageView();
  }

  function handleTriageRowClick(taskId, event) {
    if (!event) return;
    // Si el clic vino de un botón o checkbox interactivo, no conmutar selección de fila
    if (event.target.closest('button') || event.target.closest('input[type="checkbox"]')) {
      return;
    }
    toggleTriageTaskSelect(taskId);
  }

  function toggleTriageTaskSelect(taskId, event) {
    if (event) event.stopPropagation();
    const strId = String(taskId);
    if (selectedTaskIds.has(strId)) {
      selectedTaskIds.delete(strId);
    } else {
      selectedTaskIds.add(strId);
    }
    renderTriageView();
  }

  function toggleTriageGroupSelect(groupId, event) {
    if (event) event.stopPropagation();
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const groups = getGroups(activeTasks, targetDateStr);
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const allSelected = group.tasks.length > 0 && group.tasks.every(t => selectedTaskIds.has(String(t.id)));
    group.tasks.forEach(t => {
      const strId = String(t.id);
      if (allSelected) selectedTaskIds.delete(strId);
      else selectedTaskIds.add(strId);
    });
    renderTriageView();
  }

  function clearTriageSelection() {
    selectedTaskIds.clear();
    renderTriageView();
  }

  // ACCIONES DIRECTAS POR FILA
  function toggleTriageTaskStar(taskId, event) {
    if (event) event.stopPropagation();
    const state = getState();
    const t = (state.tasks || []).find(x => String(x.id) === String(taskId));
    if (!t) return;
    if (actionsModule && actionsModule.toggleTaskFeatured) {
      actionsModule.toggleTaskFeatured(taskId);
    }
    renderTriageView();
  }

  function moveTriageTaskToDate(taskId, targetDateStr, friendlyLabel, event) {
    if (event) event.stopPropagation();
    if (!targetDateStr) return;
    if (actionsModule && actionsModule.moveTaskToDate) {
      actionsModule.moveTaskToDate(taskId, targetDateStr);
    }
    selectedTaskIds.delete(String(taskId));
    renderTriageView();
  }

  function deleteTriageSingleTask(taskId, event) {
    if (event) event.stopPropagation();
    const state = getState();
    const t = (state.tasks || []).find(x => String(x.id) === String(taskId));
    const title = t ? t.title : 'la tarea';
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar "${title}"?`)) {
      return;
    }
    if (actionsModule && actionsModule.deleteTask) {
      actionsModule.deleteTask(taskId);
    }
    selectedTaskIds.delete(String(taskId));
    renderTriageView();
  }

  function openTriageSingleUrgency(taskId, event) {
    if (event) event.stopPropagation();
    activeSingleUrgencyTaskId = String(taskId);
    const popover = document.getElementById('triageSingleUrgencyPopover');
    if (!popover) return;
    const btn = event.currentTarget || event.target;
    const rect = btn.getBoundingClientRect();
    popover.style.top = `${rect.bottom + (window.scrollY || 0) + 4}px`;
    popover.style.left = `${Math.min(rect.left + (window.scrollX || 0), window.innerWidth - 180)}px`;
    popover.style.display = 'block';
  }

  function applyTriageSingleUrgency(urgency) {
    if (!activeSingleUrgencyTaskId) return;
    if (actionsModule && actionsModule.setTaskUrgency) {
      actionsModule.setTaskUrgency(activeSingleUrgencyTaskId, urgency);
    }
    closeTriagePopovers();
    renderTriageView();
  }

  function closeTriagePopovers() {
    activeSingleUrgencyTaskId = null;
    const popover = document.getElementById('triageSingleUrgencyPopover');
    if (popover) popover.style.display = 'none';
    const moveDropdown = document.getElementById('triageMoveDropdown');
    if (moveDropdown) moveDropdown.style.display = 'none';
    const batchUrgencyDropdown = document.getElementById('triageBatchUrgencyDropdown');
    if (batchUrgencyDropdown) batchUrgencyDropdown.style.display = 'none';
  }

  // ACCIONES EN LOTE
  function executeTriageMoveSelectedDate(targetDateStr) {
    if (selectedTaskIds.size === 0 || !targetDateStr) return;
    const ids = Array.from(selectedTaskIds);
    if (actionsModule && actionsModule.moveTasksToDate) {
      actionsModule.moveTasksToDate(ids, targetDateStr);
    }
    selectedTaskIds.clear();
    closeTriagePopovers();
    renderTriageView();
  }

  function executeTriageBatchUrgency(urgency) {
    if (selectedTaskIds.size === 0 || !urgency) return;
    const ids = Array.from(selectedTaskIds);
    if (actionsModule && actionsModule.setTasksUrgency) {
      actionsModule.setTasksUrgency(ids, urgency);
    }
    selectedTaskIds.clear();
    closeTriagePopovers();
    renderTriageView();
  }

  function executeTriageBatchStar(enable) {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    if (actionsModule && actionsModule.setTasksFeatured) {
      actionsModule.setTasksFeatured(ids, enable);
    }
    renderTriageView();
  }

  function executeTriageBatchDelete() {
    if (selectedTaskIds.size === 0) return;
    const count = selectedTaskIds.size;
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar las ${count} tareas seleccionadas?`)) {
      return;
    }
    const ids = Array.from(selectedTaskIds);
    if (actionsModule && actionsModule.deleteTasks) {
      actionsModule.deleteTasks(ids);
    }
    selectedTaskIds.clear();
    renderTriageView();
  }

  function toggleTriageDropdown(dropdownId, event) {
    if (event) event.stopPropagation();
    const el = document.getElementById(dropdownId);
    if (!el) return;
    const isVisible = el.style.display === 'block';
    closeTriagePopovers();
    if (!isVisible) {
      el.style.display = 'block';
    }
  }

  function renderTriageView() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('view-triage');
    if (!container) return;

    const state = getState();
    const targetDateStr = getTargetDateStr();
    const activeTasks = getActiveTasks(targetDateStr);
    const groups = getGroups(activeTasks, targetDateStr);

    const next7Days = getNextWorkingDays(targetDateStr, 7, state, state.activeEnv || 'work');
    const quick5Days = next7Days.slice(0, 5);

    const totalMinutes = activeTasks.reduce((sum, t) => sum + (t.planned || 0), 0);
    const friendlyDate = formatDateFriendly ? formatDateFriendly(targetDateStr) : targetDateStr;
    const selectedCount = selectedTaskIds.size;

    const sortButtons = [
      { id: 'urgency', label: '🎯 Urgencia' },
      { id: 'viability', label: '⏱️ Viabilidad hoy' },
      { id: 'duration', label: '⏳ Duración' },
      { id: 'featured', label: '⭐ Destacadas' }
    ];

    let html = `
      <div class="triage-view-inner">
        <!-- TOP BAR -->
        <header class="triage-header">
          <div class="triage-header-left">
            <button class="btn secondary small triage-btn-back" onclick="if(window.location.hash==='#/triage') window.location.hash='#/'; else if(app.showView) app.showView('main');" title="Volver al tablero (Esc o X)">
              <span>← Tablero</span>
              <kbd class="triage-kbd">X</kbd>
            </button>
            <div>
              <div class="triage-title-row">
                <h1 class="triage-title">⚡ Triaje Rápido</h1>
                <span class="triage-badge-count">${activeTasks.length} ${activeTasks.length === 1 ? 'tarea' : 'tareas acumuladas'}</span>
              </div>
              <p class="triage-subtitle">
                Tareas de <strong>${escapeHtml(friendlyDate)}</strong> (${escapeHtml(targetDateStr)}) · Estimación total: <strong>${formatShortDuration(totalMinutes)}</strong>
              </p>
            </div>
          </div>

          <div class="triage-header-right">
            <div class="triage-sort-selector">
              <span class="triage-sort-label">Ordenar:</span>
              ${sortButtons.map(b => `
                <button class="triage-sort-btn ${currentSort === b.id ? 'active' : ''}" onclick="app.setTriageSortMode('${b.id}')">
                  ${b.label}
                </button>
              `).join('')}
            </div>

            <div class="triage-collapse-tools">
              <button class="btn secondary small" onclick="app.toggleAllTriageGroups(false)" title="Plegar todos los grupos">▸ Plegar todo</button>
              <button class="btn secondary small" onclick="app.toggleAllTriageGroups(true)" title="Desplegar todos los grupos">▾ Desplegar todo</button>
            </div>
          </div>
        </header>

        <!-- GRUPOS DE TAREAS -->
        <main class="triage-groups-container">
    `;

    if (activeTasks.length === 0) {
      html += `
        <div class="triage-empty-state">
          <span class="triage-empty-icon">🎉</span>
          <h3>¡No hay tareas pendientes en este día!</h3>
          <p>La cola de tareas para ${escapeHtml(friendlyDate)} está completamente despejada.</p>
          <button class="btn primary small" onclick="window.location.hash='#/'">Volver al tablero</button>
        </div>
      `;
    } else {
      groups.forEach(g => {
        const groupDuration = g.tasks.reduce((sum, t) => sum + (t.planned || 0), 0);
        const isCollapsed = collapsedGroups.has(g.id);
        const allSelected = g.tasks.length > 0 && g.tasks.every(t => selectedTaskIds.has(String(t.id)));
        const someSelected = g.tasks.some(t => selectedTaskIds.has(String(t.id))) && !allSelected;

        html += `
          <div class="triage-group-card ${isCollapsed ? 'collapsed' : ''}" id="triage-group-${escapeAttr(g.id)}">
            <!-- CABECERA DE GRUPO: [▾ Plegar] [ ] Checkbox Icono Título ... -->
            <div class="triage-group-header" onclick="app.toggleTriageGroup('${escapeAttr(g.id)}')">
              <div class="triage-group-header-left">
                <button type="button" class="triage-chevron-btn" title="${isCollapsed ? 'Desplegar grupo' : 'Plegar grupo'}">
                  ▾
                </button>
                <input type="checkbox" class="triage-group-cb" ${allSelected ? 'checked' : ''} ${someSelected ? 'data-indeterminate="true"' : ''} onclick="app.toggleTriageGroupSelect('${escapeAttr(g.id)}', event)" title="Seleccionar todas las tareas del grupo">
                <span class="triage-group-icon">${g.icon}</span>
                <span class="triage-group-title">${escapeHtml(g.title)}</span>
                <span class="triage-group-badge">${g.tasks.length} ${g.tasks.length === 1 ? 'tarea' : 'tareas'}</span>
              </div>
              <div class="triage-group-header-right">
                <span class="triage-group-duration">⏱️ ${formatShortDuration(groupDuration)}</span>
              </div>
            </div>

            <!-- CONTENIDO PLEGABLE DEL GRUPO -->
            <div class="triage-group-body" style="${isCollapsed ? 'display:none;' : ''}">
              ${g.tasks.length === 0 ? `
                <div class="triage-group-empty">Sin tareas en este grupo.</div>
              ` : `
                <div class="triage-tasks-list">
                  ${g.tasks.map(t => {
                    const isSelected = selectedTaskIds.has(String(t.id));
                    const urgencyKey = t.urgency || DEFAULT_URGENCY;
                    const uInfo = URGENCY_LEVELS[urgencyKey] || URGENCY_LEVELS[DEFAULT_URGENCY];

                    return `
                      <div class="triage-task-row ${isSelected ? 'selected' : ''}" data-task-id="${escapeAttr(t.id)}" onclick="app.handleTriageRowClick('${escapeAttr(t.id)}', event)">
                        <!-- LADO IZQUIERDO: CHECKBOX, ESTRELLA, NOMBRE + DURACIÓN (EN 1 LÍNEA) -->
                        <div class="triage-task-left">
                          <input type="checkbox" class="triage-task-cb" ${isSelected ? 'checked' : ''} onclick="app.toggleTriageTaskSelect('${escapeAttr(t.id)}', event)">
                          <button type="button" class="triage-star-btn ${t.featured ? 'is-featured' : ''}" onclick="app.toggleTriageTaskStar('${escapeAttr(t.id)}', event)" title="${t.featured ? 'Quitar destacada' : 'Marcar destacada (máx 5)'}">
                            ${t.featured ? '⭐' : '☆'}
                          </button>
                          <span class="triage-task-title ${t.overflow ? 'is-overflow' : ''}" title="${escapeAttr(t.title)}">
                            ${escapeHtml(t.title)}
                          </span>
                          <span class="triage-task-duration" title="Duración estimada">${formatShortDuration(t.planned || 0)}</span>
                          ${t.overflow ? '<span class="triage-overflow-tag" title="Esta tarea desborda el fin de jornada laboral">⚠️ Desborda</span>' : ''}
                        </div>

                        <!-- LADO DERECHO: ACCIONES DIRECTAS EN LA MISMA LÍNEA -->
                        <div class="triage-task-right">
                          <!-- BOTÓN URGENCIA CON MENU -->
                          <button type="button" class="triage-urgency-btn urgency-btn-${escapeAttr(urgencyKey)}" onclick="app.openTriageSingleUrgency('${escapeAttr(t.id)}', event)" title="Urgencia: ${escapeAttr(uInfo.label)} (clic para cambiar)">
                            <span>${uInfo.icon}</span>
                            <span class="triage-urgency-text">${escapeHtml(uInfo.label)}</span>
                            <span class="triage-chevron-mini">▾</span>
                          </button>

                          <!-- 5 BOTONES RÁPIDOS DE FECHA LABORABLE -->
                          <div class="triage-quick-days-wrap">
                            ${quick5Days.map(d => `
                              <button type="button" class="triage-quick-day-btn" onclick="app.moveTriageTaskToDate('${escapeAttr(t.id)}', '${escapeAttr(d.date)}', '${escapeAttr(d.label)}', event)" title="Mover a ${escapeAttr(d.label)} (${escapeAttr(d.date)})">
                                ${escapeHtml(d.shortChip)}
                              </button>
                            `).join('')}
                          </div>

                          <!-- BOTÓN BORRAR -->
                          <button type="button" class="triage-delete-btn" onclick="app.deleteTriageSingleTask('${escapeAttr(t.id)}', event)" title="Eliminar tarea">
                            🗑️
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>
        `;
      });
    }

    html += `
        </main>

        <!-- BARRA FLOTANTE DE ACCIONES POR LOTE -->
        <div class="triage-floating-bar ${selectedCount > 0 ? 'visible' : ''}" id="triageFloatingBar">
          <div class="triage-floating-left">
            <span class="triage-selected-badge">${selectedCount}</span>
            <span class="triage-selected-text"><strong>${selectedCount}</strong> ${selectedCount === 1 ? 'tarea seleccionada' : 'tareas seleccionadas'}</span>
            <button type="button" class="triage-link-btn" onclick="app.clearTriageSelection()">Deseleccionar</button>
          </div>

          <div class="triage-floating-actions">
            <!-- BOTÓN MOVER A FECHA (7 DÍAS LABORABLES) -->
            <div class="triage-dropdown-anchor">
              <button type="button" class="btn primary small" onclick="app.toggleTriageDropdown('triageMoveDropdown', event)">
                <span>📅 Mover a fecha</span>
                <span class="triage-chevron-mini">▾</span>
              </button>
              <div class="triage-floating-dropdown" id="triageMoveDropdown" style="display:none;">
                <div class="triage-dropdown-title">Próximos 7 días laborables</div>
                <div class="triage-dropdown-list">
                  ${next7Days.map(d => `
                    <button type="button" class="triage-dropdown-item" onclick="app.executeTriageMoveSelectedDate('${escapeAttr(d.date)}')">
                      <span>${escapeHtml(d.label)}</span>
                      <span class="triage-date-sub">${escapeHtml(d.date)}</span>
                    </button>
                  `).join('')}
                </div>
                <div class="triage-dropdown-custom-row">
                  <label class="triage-custom-date-label">Otra fecha:</label>
                  <input type="date" class="triage-custom-date-input" onchange="if(this.value) app.executeTriageMoveSelectedDate(this.value)">
                </div>
              </div>
            </div>

            <!-- BOTÓN URGENCIA POR LOTE -->
            <div class="triage-dropdown-anchor">
              <button type="button" class="btn secondary small" onclick="app.toggleTriageDropdown('triageBatchUrgencyDropdown', event)">
                <span>🎯 Urgencia</span>
                <span class="triage-chevron-mini">▾</span>
              </button>
              <div class="triage-floating-dropdown" id="triageBatchUrgencyDropdown" style="display:none;min-width:160px;">
                <div class="triage-dropdown-title">Cambiar urgencia</div>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('today')">
                  <span>🟠</span> <strong>Hoy</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('days')">
                  <span>🔵</span> <strong>Próximos días</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('week')">
                  <span>🟣</span> <strong>Esta semana</strong>
                </button>
                <button type="button" class="triage-dropdown-item" onclick="app.executeTriageBatchUrgency('later')">
                  <span>⚪</span> <strong>Más adelante</strong>
                </button>
              </div>
            </div>

            <!-- BOTONES DESTACAR Y ELIMINAR POR LOTE -->
            <button type="button" class="btn secondary small" onclick="app.executeTriageBatchStar(true)" title="Marcar seleccionadas con estrella">
              ⭐ Destacar
            </button>
            <button type="button" class="btn secondary small" onclick="app.executeTriageBatchStar(false)" title="Quitar destacado a seleccionadas">
              ☆ Quitar
            </button>
            <button type="button" class="btn danger small" onclick="app.executeTriageBatchDelete()" title="Eliminar tareas seleccionadas">
              🗑️ Borrar
            </button>
          </div>
        </div>

        <!-- POPOVER FLOTANTE PARA CAMBIO INDIVIDUAL DE URGENCIA -->
        <div id="triageSingleUrgencyPopover" class="triage-single-urgency-popover" style="display:none;">
          <div class="triage-dropdown-title">Cambiar urgencia</div>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('today')">
            <span>🟠</span> <strong>Hoy</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('days')">
            <span>🔵</span> <strong>Próximos días</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('week')">
            <span>🟣</span> <strong>Esta semana</strong>
          </button>
          <button type="button" class="triage-dropdown-item" onclick="app.applyTriageSingleUrgency('later')">
            <span>⚪</span> <strong>Más adelante</strong>
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Restaurar estado indeterminate de checkboxes de grupo
    container.querySelectorAll('.triage-group-cb[data-indeterminate="true"]').forEach(cb => {
      cb.indeterminate = true;
    });
  }

  // Listener global para cerrar menús al hacer clic fuera
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#triageMoveDropdown') &&
          !e.target.closest('#triageBatchUrgencyDropdown') &&
          !e.target.closest('#triageSingleUrgencyPopover') &&
          !e.target.closest('.triage-urgency-btn') &&
          !e.target.closest('.triage-dropdown-anchor')) {
        closeTriagePopovers();
      }
    });
  }

  return {
    renderTriageView,
    setTriageSortMode,
    toggleTriageGroup,
    toggleAllTriageGroups,
    handleTriageRowClick,
    toggleTriageTaskSelect,
    toggleTriageGroupSelect,
    clearTriageSelection,
    toggleTriageTaskStar,
    moveTriageTaskToDate,
    deleteTriageSingleTask,
    openTriageSingleUrgency,
    applyTriageSingleUrgency,
    closeTriagePopovers,
    executeTriageMoveSelectedDate,
    executeTriageBatchUrgency,
    executeTriageBatchStar,
    executeTriageBatchDelete,
    toggleTriageDropdown,
    getTargetDateStr
  };
}

export default TodayTasksTriageView;
