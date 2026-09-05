/* app/command-palette.js — Buscador Global de Tareas estilo Command Palette (Ctrl+K) */
import {
  searchAllTasks, getTodayStr, formatDateFriendly, diffDays, fmtDur,
  URGENCY_LEVELS, DEFAULT_URGENCY
} from '../utils.js';
import { escapeHtml, escapeAttr, showToast } from '../ui.js';
import { t } from '../i18n.js';
import { attachTagAutocomplete } from './tag-autocomplete.js';

export function TodayTasksCommandPalette(ctx) {
  const { getState, getActionsModule, getRouterModule, getViewsModule } = ctx;

  let isOpen = false;
  let currentFilter = 'all'; // 'all' | 'pending' | 'completed' | 'recurring'
  let currentEnvFilter = 'active'; // 'active' | 'both'
  let currentResults = [];
  let selectedIndex = -1;
  let tagAutocompleteInstance = null;

  function isCommandPaletteOpen() {
    return isOpen;
  }

  function openCommandPalette(initialQuery = '') {
    const modal = document.getElementById('globalSearchModal');
    const input = document.getElementById('globalSearchInput');
    if (!modal || !input) return;

    if (!tagAutocompleteInstance) {
      tagAutocompleteInstance = attachTagAutocomplete(input, {
        getState,
        getEnv: () => (currentEnvFilter === 'both' ? 'both' : null),
        onSelect: () => {
          selectedIndex = 0;
          renderResults();
        }
      });
    } else {
      tagAutocompleteInstance.close();
    }

    isOpen = true;
    modal.style.display = 'flex';
    input.value = typeof initialQuery === 'string' ? initialQuery : '';
    selectedIndex = -1;

    updateFilterChipsUI();
    renderResults();

    setTimeout(() => {
      input.focus();
      input.select();
    }, 40);
  }

  function closeCommandPalette() {
    const modal = document.getElementById('globalSearchModal');
    if (!modal) return;
    if (tagAutocompleteInstance) {
      tagAutocompleteInstance.close();
    }
    isOpen = false;
    modal.style.display = 'none';
    selectedIndex = -1;
  }

  function setFilter(filter) {
    if (!['all', 'pending', 'completed', 'recurring'].includes(filter)) return;
    currentFilter = filter;
    selectedIndex = -1;
    updateFilterChipsUI();
    renderResults();
  }

  function toggleEnvFilter() {
    currentEnvFilter = currentEnvFilter === 'active' ? 'both' : 'active';
    selectedIndex = -1;
    updateFilterChipsUI();
    renderResults();
    const state = typeof getState === 'function' ? getState() : {};
    const activeEnv = state.activeEnv || 'work';
    const envLabel = activeEnv === 'work' ? t('env.work') : t('env.personal');
    if (currentEnvFilter === 'both') {
      showToast(t('globalSearch.envBoth'));
    } else {
      showToast(t('globalSearch.envActiveOnly', { env: envLabel }));
    }
  }

  function updateFilterChipsUI() {
    const modal = document.getElementById('globalSearchModal');
    if (!modal) return;

    modal.querySelectorAll('.global-search-chip[data-filter]').forEach(chip => {
      const f = chip.dataset.filter;
      chip.classList.toggle('active', f === currentFilter);
    });

    const envLabelEl = document.getElementById('globalSearchEnvLabel');
    if (envLabelEl) {
      const state = typeof getState === 'function' ? getState() : {};
      const activeEnv = state.activeEnv || 'work';
      const envName = activeEnv === 'work' ? `${t('env.work')} 💼` : `${t('env.personal')} 🏠`;
      if (currentEnvFilter === 'both') {
        envLabelEl.textContent = `🌐 ${t('globalSearch.envBoth')}`;
      } else {
        envLabelEl.textContent = envName;
      }
    }
  }

  function getGroupHeading(group, dateStr) {
    const today = getTodayStr();
    if (group === 'today') {
      return t('globalSearch.groupToday', { date: formatDateFriendly(today) });
    }
    if (group === 'upcoming') {
      return t('globalSearch.groupUpcoming');
    }
    if (group === 'past') {
      return t('globalSearch.groupPast');
    }
    if (group === 'recurring') {
      return t('globalSearch.groupRecurring');
    }
    return '';
  }

  function renderResults() {
    const listEl = document.getElementById('globalSearchResultsList');
    const input = document.getElementById('globalSearchInput');
    if (!listEl) return;

    const query = input ? input.value : '';
    const state = typeof getState === 'function' ? getState() : {};
    const activeEnv = state.activeEnv || 'work';

    currentResults = searchAllTasks(state, query, {
      envKey: activeEnv,
      filter: currentFilter,
      bothEnvs: currentEnvFilter === 'both'
    });

    if (currentResults.length === 0) {
      listEl.innerHTML = `
        <div class="global-search-empty">
          <span class="global-search-empty-icon">🔍</span>
          <p>${t('globalSearch.noResults', { query: escapeHtml(query || '') })}</p>
        </div>
      `;
      selectedIndex = -1;
      return;
    }

    // Si el índice seleccionado queda fuera de rango, restablecer a 0
    if (selectedIndex < 0 || selectedIndex >= currentResults.length) {
      selectedIndex = 0;
    }

    const today = getTodayStr();
    let html = '';
    let currentGroup = null;

    currentResults.forEach((item, idx) => {
      // Encabezado de grupo
      if (item.group !== currentGroup) {
        currentGroup = item.group;
        html += `
          <div class="global-search-group-header">
            <span>${escapeHtml(getGroupHeading(item.group, item.dateStr))}</span>
          </div>
        `;
      }

      const isSelected = idx === selectedIndex;
      const urgencyConf = URGENCY_LEVELS[item.urgency] || URGENCY_LEVELS[DEFAULT_URGENCY];
      const urgencyLabel = urgencyConf ? urgencyConf.label : item.urgency;
      const urgencyIcon = urgencyConf ? urgencyConf.icon : '🔵';

      // Etiqueta de fecha relativa o absoluta
      let dateBadgeHtml = '';
      if (item.dateStr) {
        const diff = item.diff;
        let dateText = '';
        if (diff === 0) {
          dateText = t('date.today');
        } else if (diff === 1) {
          dateText = t('date.yesterday') || 'Ayer';
        } else if (diff === -1) {
          dateText = t('date.tomorrow') || 'Mañana';
        } else {
          dateText = formatDateFriendly(item.dateStr);
        }
        dateBadgeHtml = `<span class="global-search-date-badge">${escapeHtml(dateText)}</span>`;
      }

      // Icono de estado
      let statusIcon = '⚪';
      if (item.status === 'running') statusIcon = '⏳';
      else if (item.status === 'paused') statusIcon = '⏸';
      else if (item.status === 'completed') statusIcon = '✓';
      else if (item.isTemplateRule) statusIcon = '🔁';

      // Botones de acción rápida
      let actionsHtml = '';
      if (item.isTemplateRule) {
        actionsHtml = `
          <button type="button" class="btn-search-action" onclick="app.openRecurringRuleEdit('${escapeAttr(item.id)}', event)">
            ${escapeHtml(t('globalSearch.actionEditSeries'))}
          </button>
        `;
      } else if (item.group === 'today') {
        actionsHtml = `
          <button type="button" class="btn-search-action primary" onclick="app.commandPaletteGoTo('${escapeAttr(item.id)}', '${escapeAttr(item.dateStr)}', event)">
            ${escapeHtml(t('globalSearch.actionGoTo'))}
          </button>
        `;
      } else {
        // Tarea de otro día (pasado o futuro)
        const isCompleted = item.status === 'completed';
        const moveLabel = isCompleted ? t('globalSearch.actionReopenToday') : t('globalSearch.actionMoveToday');
        actionsHtml = `
          <button type="button" class="btn-search-action" onclick="app.commandPaletteMoveToToday('${escapeAttr(item.id)}', ${isCompleted}, event)">
            ${escapeHtml(moveLabel)}
          </button>
          <button type="button" class="btn-search-action primary" onclick="app.commandPaletteGoTo('${escapeAttr(item.id)}', '${escapeAttr(item.dateStr)}', event)">
            ${escapeHtml(t('globalSearch.actionGoTo'))}
          </button>
        `;
      }

      // Insignia de entorno si busca en ambos
      let envBadgeHtml = '';
      if (currentEnvFilter === 'both') {
        const isWork = item.envKey === 'work';
        envBadgeHtml = `<span class="global-search-env-badge" title="${isWork ? t('env.work') : t('env.personal')}">${isWork ? '💼' : '🏠'}</span>`;
      }

      html += `
        <div class="global-search-item ${isSelected ? 'selected' : ''} ${item.status === 'completed' ? 'item-completed' : ''}"
             data-index="${idx}"
             data-task-id="${escapeAttr(item.id)}"
             data-date="${escapeAttr(item.dateStr || '')}"
             onclick="app.commandPaletteOnItemClick(${idx}, event)">
          <div class="global-search-item-info">
            <span class="global-search-status-dot status-${item.status}">${statusIcon}</span>
            ${item.displayId ? `<span class="task-id-badge task-id-badge-sm">${escapeHtml(item.displayId)}</span>` : ''}
            <span class="global-search-item-title ${item.status === 'completed' ? 'line-through' : ''}">${escapeHtml(item.title)}</span>
            <span class="global-search-urgency-badge urgency-${item.urgency}">
              ${urgencyIcon} ${escapeHtml(urgencyLabel)}
            </span>
            ${item.featured ? '<span class="star-icon" title="Destacada">⭐</span>' : ''}
            ${item.isRecurring ? '<span class="rec-icon" title="Recurrente">🔁</span>' : ''}
            ${envBadgeHtml}
            ${dateBadgeHtml}
            <span class="global-search-item-duration">${fmtDur(item.planned)}</span>
          </div>
          <div class="global-search-item-actions">
            ${actionsHtml}
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    // Asegurar que el elemento seleccionado sea visible
    const selectedEl = listEl.querySelector(`.global-search-item[data-index="${selectedIndex}"]`);
    if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectPreviousItem() {
    if (currentResults.length === 0) return;
    selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
    updateSelectionDOM();
  }

  function selectNextItem() {
    if (currentResults.length === 0) return;
    selectedIndex = (selectedIndex + 1) % currentResults.length;
    updateSelectionDOM();
  }

  function updateSelectionDOM() {
    const listEl = document.getElementById('globalSearchResultsList');
    if (!listEl) return;
    listEl.querySelectorAll('.global-search-item').forEach(el => {
      const idx = Number(el.dataset.index);
      el.classList.toggle('selected', idx === selectedIndex);
      if (idx === selectedIndex && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function executeSelectedItem() {
    if (selectedIndex < 0 || selectedIndex >= currentResults.length) return;
    const item = currentResults[selectedIndex];
    if (!item) return;

    if (item.isTemplateRule) {
      openRecurringRuleEdit(item.id);
    } else {
      goToTask(item.id, item.dateStr);
    }
  }

  function goToTask(taskId, dateStr) {
    const state = typeof getState === 'function' ? getState() : {};
    const today = getTodayStr();
    const targetDate = dateStr || today;

    closeCommandPalette();

    // Si estamos en una vista secundaria (triaje, histórico, etc.), regresar a main
    if (window.location.hash && window.location.hash !== '#/') {
      window.location.hash = '#/';
    }

    // Si la fecha seleccionada es distinta a la de la tarea, cambiar de fecha
    const actions = typeof getActionsModule === 'function' ? getActionsModule() : null;
    if (actions && actions.selectDate && state.selectedDate !== targetDate) {
      actions.selectDate(targetDate);
    }

    // Resaltar suavemente la tarea en la vista
    setTimeout(() => {
      const el = document.querySelector(`#tasksList [data-task-id="${taskId}"]`) ||
                 document.getElementById(`task_${taskId}`) ||
                 document.querySelector(`[data-task-id="${taskId}"]`);
      if (el) {
        if (typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (el.classList && typeof el.classList.add === 'function') {
          el.classList.add('task-focus-pulse');
          setTimeout(() => {
            if (el.classList && typeof el.classList.remove === 'function') {
              el.classList.remove('task-focus-pulse');
            }
          }, 2200);
        }
      }
    }, 120);
  }

  function moveTaskToToday(taskId, isCompleted, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    const actions = typeof getActionsModule === 'function' ? getActionsModule() : null;
    const today = getTodayStr();
    if (!actions) return;

    if (actions.moveTaskToDate) {
      actions.moveTaskToDate(taskId, today);
    }
    if (isCompleted && actions.uncompleteTask) {
      actions.uncompleteTask(taskId);
    }

    showToast(t('tasks.movedToTodaySuccess') || 'Tarea trasladada a la jornada de Hoy');
    renderResults();
  }

  function openRecurringRuleEdit(ruleId, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    closeCommandPalette();

    // Abrir popover de edición de regla periódica
    const actions = typeof getActionsModule === 'function' ? getActionsModule() : null;
    if (window.app && window.app.openRecurringInfoPopover) {
      window.app.openRecurringInfoPopover(ruleId, null, 'task');
      if (window.app.toggleEditRecurrenceInPopover) {
        window.app.toggleEditRecurrenceInPopover(true);
      }
    }
  }

  /* ---------------- Inicialización de eventos del DOM ---------------- */
  function init() {
    if (typeof document === 'undefined') return;

    const modal = document.getElementById('globalSearchModal');
    const input = document.getElementById('globalSearchInput');
    if (!modal) return;

    // Cierre al hacer clic en el backdrop
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeCommandPalette();
      }
    });

    // Control de teclado y autocompletado en el input
    if (input) {
      if (!tagAutocompleteInstance) {
        tagAutocompleteInstance = attachTagAutocomplete(input, {
          getState,
          getEnv: () => (currentEnvFilter === 'both' ? 'both' : null),
          onSelect: () => {
            selectedIndex = 0;
            renderResults();
          }
        });
      }

      input.addEventListener('input', () => {
        selectedIndex = 0;
        renderResults();
      });

      input.addEventListener('keydown', (e) => {
        if (e.defaultPrevented) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeCommandPalette();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectNextItem();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectPreviousItem();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          executeSelectedItem();
        } else if (e.key === 'Tab') {
          // Tab para ciclar entre filtros
          e.preventDefault();
          const filters = ['all', 'pending', 'completed', 'recurring'];
          const nextIdx = (filters.indexOf(currentFilter) + (e.shiftKey ? -1 : 1) + filters.length) % filters.length;
          setFilter(filters[nextIdx]);
        }
      });
    }

    // Botones de filtro
    modal.querySelectorAll('.global-search-chip[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        setFilter(btn.dataset.filter);
        if (input) input.focus();
      });
    });

    // Botón de entorno
    const envChip = document.getElementById('globalSearchEnvChip');
    if (envChip) {
      envChip.addEventListener('click', () => {
        toggleEnvFilter();
        if (input) input.focus();
      });
    }
  }

  // Inicializar listeners al cargar
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    openCommandPalette,
    closeCommandPalette,
    isCommandPaletteOpen,
    setFilter,
    toggleEnvFilter,
    renderResults,
    goToTask,
    moveTaskToToday,
    openRecurringRuleEdit,
    onItemClick: (idx, event) => {
      if (event && event.target && event.target.closest('.btn-search-action')) return;
      selectedIndex = idx;
      executeSelectedItem();
    }
  };
}

export default TodayTasksCommandPalette;
