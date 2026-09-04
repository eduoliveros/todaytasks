import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultState } from '../js/state.js';
import { getTodayStr, addDays } from '../js/utils.js';
import { TodayTasksCommandPalette } from '../js/app/command-palette.js';
import { TodayTasksShortcuts } from '../js/app/shortcuts.js';

describe('Command Palette - Buscador Global de Tareas', () => {
  let state;
  let actionsModule;
  let routerModule;
  let palette;
  const today = getTodayStr();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="globalSearchModal" style="display:none;">
        <input type="text" id="globalSearchInput">
        <button class="global-search-chip" data-filter="all">Todo</button>
        <button class="global-search-chip" data-filter="pending">Pendientes</button>
        <button class="global-search-chip" data-filter="completed">Completadas</button>
        <button class="global-search-chip" data-filter="recurring">Recurrentes</button>
        <button id="globalSearchEnvChip"><span id="globalSearchEnvLabel"></span></button>
        <div id="globalSearchResultsList"></div>
      </div>
      <div id="tasksList"></div>
    `;

    state = defaultState();
    state.environments.work.days[today] = {
      tasks: [
        { id: 't_today_1', title: 'Tarea de hoy pendiente', planned: 30, status: 'pending', order: 1, urgency: 'today' },
        { id: 't_today_2', title: 'Tarea de hoy completada', planned: 20, status: 'completed', order: 2, urgency: 'days' }
      ],
      meetings: []
    };
    state.environments.work.days[tomorrow] = {
      tasks: [
        { id: 't_tom_1', title: 'Tarea futura para mañana', planned: 45, status: 'pending', order: 1, urgency: 'week' }
      ],
      meetings: []
    };
    state.environments.work.days[yesterday] = {
      tasks: [
        { id: 't_yest_1', title: 'Tarea pasada de ayer', planned: 50, actualDuration: 50, status: 'completed', order: 1, urgency: 'days' }
      ],
      meetings: []
    };

    actionsModule = {
      selectDate: vi.fn(),
      moveTaskToDate: vi.fn(),
      uncompleteTask: vi.fn(),
      completeTask: vi.fn()
    };

    routerModule = {
      getCurrentView: vi.fn(() => 'main')
    };

    const ctx = {
      getState: () => state,
      getActionsModule: () => actionsModule,
      getRouterModule: () => routerModule,
      getViewsModule: () => ({})
    };

    palette = TodayTasksCommandPalette(ctx);
    window.app = {
      openCommandPalette: palette.openCommandPalette,
      closeCommandPalette: palette.closeCommandPalette,
      commandPaletteGoTo: palette.goToTask,
      commandPaletteMoveToToday: palette.moveTaskToToday,
      commandPaletteOnItemClick: palette.onItemClick
    };
  });

  it('abre el modal y renderiza los resultados iniciales', () => {
    palette.openCommandPalette('');
    expect(palette.isCommandPaletteOpen()).toBe(true);

    const modal = document.getElementById('globalSearchModal');
    expect(modal.style.display).toBe('flex');

    const resultsList = document.getElementById('globalSearchResultsList');
    expect(resultsList.innerHTML).toContain('Tarea de hoy pendiente');
    expect(resultsList.innerHTML).toContain('Tarea futura para mañana');
    expect(resultsList.innerHTML).toContain('Tarea pasada de ayer');
  });

  it('cierra el modal al invocar closeCommandPalette()', () => {
    palette.openCommandPalette('');
    expect(palette.isCommandPaletteOpen()).toBe(true);

    palette.closeCommandPalette();
    expect(palette.isCommandPaletteOpen()).toBe(false);

    const modal = document.getElementById('globalSearchModal');
    expect(modal.style.display).toBe('none');
  });

  it('filtra tareas al escribir en el input de búsqueda', () => {
    palette.openCommandPalette('');
    const input = document.getElementById('globalSearchInput');
    input.value = 'futura';
    palette.renderResults();

    const resultsList = document.getElementById('globalSearchResultsList');
    expect(resultsList.innerHTML).toContain('Tarea futura para mañana');
    expect(resultsList.innerHTML).not.toContain('Tarea de hoy pendiente');
    expect(resultsList.innerHTML).not.toContain('Tarea pasada de ayer');
  });

  it('filtra por chips de estado: solo pendientes o solo completadas', () => {
    palette.openCommandPalette('');
    palette.setFilter('completed');

    const resultsList = document.getElementById('globalSearchResultsList');
    expect(resultsList.innerHTML).toContain('Tarea de hoy completada');
    expect(resultsList.innerHTML).toContain('Tarea pasada de ayer');
    expect(resultsList.innerHTML).not.toContain('Tarea de hoy pendiente');
    expect(resultsList.innerHTML).not.toContain('Tarea futura para mañana');
  });

  it('permite alternar búsqueda entre entorno activo y ambos entornos', () => {
    state.environments.personal.days[today] = {
      tasks: [
        { id: 't_pers_1', title: 'Comprar frutas en supermercado', planned: 20, status: 'pending', order: 1 }
      ],
      meetings: []
    };

    palette.openCommandPalette('frutas');
    let resultsList = document.getElementById('globalSearchResultsList');
    expect(resultsList.innerHTML).not.toContain('Comprar frutas');

    // Cambiar a ambos entornos
    palette.toggleEnvFilter();
    resultsList = document.getElementById('globalSearchResultsList');
    expect(resultsList.innerHTML).toContain('Comprar frutas');
  });

  it('navegar a una tarea de otra fecha cambia la fecha y cierra la paleta', () => {
    palette.openCommandPalette('');
    palette.goToTask('t_tom_1', tomorrow);

    expect(palette.isCommandPaletteOpen()).toBe(false);
    expect(actionsModule.selectDate).toHaveBeenCalledWith(tomorrow);
  });

  it('trasladar tarea a hoy invoca moveTaskToDate() y uncompleteTask si estaba completada', () => {
    palette.openCommandPalette('');
    palette.moveTaskToToday('t_yest_1', true);

    expect(actionsModule.moveTaskToDate).toHaveBeenCalledWith('t_yest_1', today);
    expect(actionsModule.uncompleteTask).toHaveBeenCalledWith('t_yest_1');
  });

  it('el atajo de teclado Ctrl+K abre la Command Palette', () => {
    TodayTasksShortcuts({
      getState: () => state,
      actionsModule,
      routerModule,
      viewsModule: {}
    });

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);

    expect(palette.isCommandPaletteOpen()).toBe(true);
  });

  it('la tecla Escape cierra la Command Palette cuando está abierta', () => {
    palette.openCommandPalette('');
    expect(palette.isCommandPaletteOpen()).toBe(true);

    TodayTasksShortcuts({
      getState: () => state,
      actionsModule,
      routerModule,
      viewsModule: {}
    });

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);

    expect(palette.isCommandPaletteOpen()).toBe(false);
  });
});
