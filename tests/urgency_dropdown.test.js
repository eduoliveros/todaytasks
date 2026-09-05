import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodayTasksUrgencyDropdown, getUrgencyMap } from '../js/app/urgency-dropdown.js';
import { setLocale } from '../js/i18n.js';

describe('TodayTasksUrgencyDropdown (js/app/urgency-dropdown.js)', () => {
  let mockActions;
  let state;
  let urgencyMod;

  beforeEach(() => {
    setLocale('es');
    document.body.innerHTML = `
      <div id="urgencyDropdownOverlay" style="display:none;"></div>
      <div id="urgencyDropdownMenu" style="display:none;">
        <div class="urgency-option-item" data-urgency="today">Hoy</div>
        <div class="urgency-option-item" data-urgency="days">Días</div>
        <div class="urgency-option-item" data-urgency="week">Semana</div>
        <div class="urgency-option-item" data-urgency="later">Más adelante</div>
      </div>
      <input type="hidden" id="taskUrgencySelect" value="days" />
      <button id="formUrgencyPill" class="urgency-pill-btn">
        <span id="formUrgencyIcon">🔵</span>
        <span id="formUrgencyLabel">Días</span>
      </button>
      <input type="hidden" id="isFeaturedTaskCheckbox" value="false" />
      <button id="formFeaturedStarBtn" title="Marcar como destacada">☆</button>
    `;

    state = {
      tasks: [
        { id: 'task-1', title: 'Tarea 1', urgency: 'today', featured: false, status: 'pending' },
        { id: 'task-2', title: 'Tarea 2', urgency: 'days', featured: true, status: 'pending' }
      ]
    };

    mockActions = {
      setTaskUrgency: vi.fn(),
      updateTaskEditField: vi.fn(),
      setTaskFeatured: vi.fn(),
      toggleTaskFeatured: vi.fn(),
      showFeaturedLimitModal: vi.fn()
    };

    urgencyMod = TodayTasksUrgencyDropdown({
      getState: () => state,
      getActionsModule: () => mockActions,
      getTaskEdit: () => null
    });
  });

  it('getUrgencyMap returns localized labels according to active language', () => {
    setLocale('es');
    const esMap = getUrgencyMap();
    expect(esMap.today.label).toBe('Hoy');
    expect(esMap.days.label).toBe('Días');
    expect(esMap.week.label).toBe('Semana');
    expect(esMap.later.label).toBe('Más adelante');

    setLocale('en');
    const enMap = getUrgencyMap();
    expect(enMap.today.label).toBe('Today');
    expect(enMap.days.label).toBe('Days');
    expect(enMap.week.label).toBe('Week');
    expect(enMap.later.label).toBe('Later');

    setLocale('es');
  });

  it('openUrgencyDropdown opens the menu, highlights current task urgency and positions it', () => {
    const btn = document.createElement('button');
    btn.getBoundingClientRect = () => ({ left: 100, top: 200, bottom: 230, width: 80, height: 30 });

    urgencyMod.openUrgencyDropdown('task-1', { currentTarget: btn });

    const menu = document.getElementById('urgencyDropdownMenu');
    const overlay = document.getElementById('urgencyDropdownOverlay');
    expect(menu.style.display).toBe('block');
    expect(overlay.style.display).toBe('block');

    const todayOpt = menu.querySelector('[data-urgency="today"]');
    const daysOpt = menu.querySelector('[data-urgency="days"]');
    expect(todayOpt.classList.contains('active')).toBe(true);
    expect(daysOpt.classList.contains('active')).toBe(false);
  });

  it('selectTaskUrgency updates task urgency through actionsModule in card mode', () => {
    urgencyMod.currentUrgencyTaskId = 'task-1';
    urgencyMod.selectTaskUrgency('week');

    expect(mockActions.setTaskUrgency).toHaveBeenCalledWith('task-1', 'week');
    expect(document.getElementById('urgencyDropdownMenu').style.display).toBe('none');
  });

  it('openFormUrgencyDropdown activates form mode and selectTaskUrgency updates form pill', () => {
    urgencyMod.openFormUrgencyDropdown();
    expect(urgencyMod._formUrgencyMode).toBe(true);

    urgencyMod.selectTaskUrgency('later');
    expect(document.getElementById('taskUrgencySelect').value).toBe('later');
    expect(document.getElementById('formUrgencyIcon').textContent).toBe('⚪');
    expect(document.getElementById('formUrgencyLabel').textContent).toBe('Más adelante');
  });

  it('toggleFormFeatured toggles the star and hidden checkbox in form mode', () => {
    const starBtn = document.getElementById('formFeaturedStarBtn');
    const hiddenInput = document.getElementById('isFeaturedTaskCheckbox');

    urgencyMod.toggleFormFeatured();
    expect(hiddenInput.value).toBe('true');
    expect(starBtn.textContent).toBe('⭐');
    expect(starBtn.classList.contains('is-featured')).toBe(true);

    urgencyMod.toggleFormFeatured();
    expect(hiddenInput.value).toBe('false');
    expect(starBtn.textContent).toBe('☆');
    expect(starBtn.classList.contains('is-featured')).toBe(false);
  });

  it('openEditUrgencyDropdown enables selecting urgency for editing/adding and updates taskEdit and edit pill', () => {
    let taskEdit = { id: '__new__', urgency: 'days' };
    const pill = document.createElement('button');
    pill.id = 'edit-urgency-pill-__new__';
    pill.className = 'urgency-pill-btn urgency-btn-days';
    pill.innerHTML = '<span>🔵</span> <span>Días</span> <span class="urgency-pill-chevron">▾</span>';
    pill.getBoundingClientRect = () => ({ left: 100, top: 200, bottom: 230, width: 80, height: 30 });
    document.body.appendChild(pill);

    urgencyMod = TodayTasksUrgencyDropdown({
      getState: () => state,
      getActionsModule: () => mockActions,
      getTaskEdit: () => taskEdit
    });

    urgencyMod.openEditUrgencyDropdown('__new__', { currentTarget: pill });

    urgencyMod.selectTaskUrgency('today');

    expect(mockActions.updateTaskEditField).toHaveBeenCalledWith('urgency', 'today');
    expect(pill.className).toContain('urgency-btn-today');
    expect(pill.textContent).toContain('Hoy');
  });

  it('selectTaskUrgency updates the pill inside triage edit modal even when an inline pill exists in DOM with the same id', () => {
    let taskEdit = { id: 'task-1', urgency: 'days' };

    // Inline element in task list (created first in DOM by tasks view)
    const inlinePill = document.createElement('button');
    inlinePill.id = 'edit-urgency-pill-task-1';
    inlinePill.className = 'urgency-pill-btn urgency-btn-days';
    inlinePill.innerHTML = '<span>🔵</span> <span>Días</span>';
    document.body.appendChild(inlinePill);

    // Modal element in triage edit modal (created second in DOM by triage view)
    const modalBox = document.createElement('div');
    modalBox.className = 'modal-box triage-edit-modal-box';
    const modalPill = document.createElement('button');
    modalPill.id = 'edit-urgency-pill-task-1';
    modalPill.className = 'urgency-pill-btn urgency-btn-days';
    modalPill.innerHTML = '<span>🔵</span> <span>Días</span>';
    modalBox.appendChild(modalPill);
    document.body.appendChild(modalBox);

    urgencyMod = TodayTasksUrgencyDropdown({
      getState: () => state,
      getActionsModule: () => mockActions,
      getTaskEdit: () => taskEdit
    });

    urgencyMod.openEditUrgencyDropdown('task-1', { currentTarget: modalPill });
    urgencyMod.selectTaskUrgency('week');

    // Both the modal pill and any inline pill must be updated
    expect(modalPill.className).toContain('urgency-btn-week');
    expect(modalPill.textContent).toContain('Semana');
  });
});

