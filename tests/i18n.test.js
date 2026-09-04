import { describe, it, expect, beforeEach } from 'vitest';
import {
  t,
  tPlural,
  getLocale,
  setLocale,
  detectInitialLanguage,
  translateDOM,
  registerDictionary
} from '../js/i18n.js';

describe('i18n module (js/i18n.js)', () => {
  beforeEach(() => {
    setLocale('es');
  });

  describe('Locale detection and switching', () => {
    it('detects language based on navigator.language', () => {
      const originalNav = global.navigator;

      // Spanish locale
      global.navigator = { language: 'es-ES' };
      expect(detectInitialLanguage()).toBe('es');

      // English / other locale
      global.navigator = { language: 'en-US' };
      expect(detectInitialLanguage()).toBe('en');

      global.navigator = { language: 'fr-FR' };
      expect(detectInitialLanguage()).toBe('en');

      global.navigator = originalNav;
    });

    it('gets and sets current locale and updates document.documentElement lang', () => {
      setLocale('en');
      expect(getLocale()).toBe('en');
      if (typeof document !== 'undefined') {
        expect(document.documentElement.getAttribute('lang')).toBe('en');
      }

      setLocale('es');
      expect(getLocale()).toBe('es');
      if (typeof document !== 'undefined') {
        expect(document.documentElement.getAttribute('lang')).toBe('es');
      }
    });
  });

  describe('Translation with t() and interpolation', () => {
    it('translates static keys in Spanish', () => {
      setLocale('es');
      expect(t('action.save')).toBe('Guardar');
      expect(t('action.cancel')).toBe('Cancelar');
      expect(t('config.title')).toBe('Configuración');
    });

    it('translates static keys in English', () => {
      setLocale('en');
      expect(t('action.save')).toBe('Save');
      expect(t('action.cancel')).toBe('Cancel');
      expect(t('config.title')).toBe('Settings');
    });

    it('interpolates parameters with {param} syntax', () => {
      setLocale('es');
      expect(t('task.completed', { title: 'Comprar pan' })).toBe('Tarea "Comprar pan" completada.');

      setLocale('en');
      expect(t('task.completed', { title: 'Buy bread' })).toBe('Task "Buy bread" completed.');
    });

    it('falls back to Spanish when key is missing in English', () => {
      registerDictionary('es', {
        'test.only_in_es': 'Solo en español: {val}'
      });

      setLocale('en');
      expect(t('test.only_in_es', { val: '123' })).toBe('Solo en español: 123');
    });

    it('returns the key itself if not found in any dictionary', () => {
      expect(t('non.existent.key')).toBe('non.existent.key');
    });
  });

  describe('Pluralization', () => {
    it('handles singular and plural in Spanish', () => {
      setLocale('es');
      expect(t('task.count', { count: 1 })).toBe('1 tarea');
      expect(t('task.count', { count: 5 })).toBe('5 tareas');
      expect(t('task.count', 1)).toBe('1 tarea');
      expect(t('task.count', 0)).toBe('0 tareas');
      expect(tPlural('task.count', 3)).toBe('3 tareas');
    });

    it('handles singular and plural in English', () => {
      setLocale('en');
      expect(t('task.count', { count: 1 })).toBe('1 task');
      expect(t('task.count', { count: 5 })).toBe('5 tasks');
      expect(tPlural('task.count', 2)).toBe('2 tasks');
    });
  });

  describe('DOM Translation with translateDOM()', () => {
    it('translates textContent, innerHTML, placeholder, title, and aria-label', () => {
      document.body.innerHTML = `
        <div id="container">
          <span id="txt" data-i18n="action.save">Antiguo</span>
          <div id="html" data-i18n-html="config.title">Antiguo HTML</div>
          <input id="inp" data-i18n-placeholder="action.save" placeholder="Antiguo">
          <button id="btn" data-i18n-title="action.delete" data-i18n-aria="action.close" title="Antiguo">✕</button>
        </div>
      `;

      setLocale('en');
      translateDOM(document.getElementById('container'));

      expect(document.getElementById('txt').textContent).toBe('Save');
      expect(document.getElementById('html').innerHTML).toBe('Settings');
      expect(document.getElementById('inp').getAttribute('placeholder')).toBe('Save');
      expect(document.getElementById('btn').getAttribute('title')).toBe('Delete');
      expect(document.getElementById('btn').getAttribute('aria-label')).toBe('Close');

      setLocale('es');
      translateDOM(document.getElementById('container'));

      expect(document.getElementById('txt').textContent).toBe('Guardar');
      expect(document.getElementById('html').innerHTML).toBe('Configuración');
      expect(document.getElementById('inp').getAttribute('placeholder')).toBe('Guardar');
      expect(document.getElementById('btn').getAttribute('title')).toBe('Eliminar');
      expect(document.getElementById('btn').getAttribute('aria-label')).toBe('Cerrar');
    });

    it('updates document.title and recurrence day buttons', () => {
      document.body.innerHTML = `
        <div id="daysWrap">
          <button type="button" class="rec-pop-day-btn" data-day="3">X</button>
        </div>
      `;

      setLocale('en');
      translateDOM();

      expect(document.title).toBe('TodayTasks · Planner');
      expect(document.querySelector('.rec-pop-day-btn[data-day="3"]').textContent).toBe('W');
      expect(document.querySelector('.rec-pop-day-btn[data-day="3"]').getAttribute('title')).toBe('Wednesday');

      setLocale('es');
      translateDOM();

      expect(document.title).toBe('TodayTasks · Planificador');
      expect(document.querySelector('.rec-pop-day-btn[data-day="3"]').textContent).toBe('X');
      expect(document.querySelector('.rec-pop-day-btn[data-day="3"]').getAttribute('title')).toBe('Miércoles');
    });
  });

  describe('Helper methods', () => {
    it('returns localized day names, letters, and months', () => {
      setLocale('es');
      expect(t.days()[1]).toBe('Lunes');
      expect(t.dayLetters()[3]).toBe('X'); // Miércoles en español

      setLocale('en');
      expect(t.days()[1]).toBe('Monday');
      expect(t.dayLetters()[3]).toBe('W'); // Wednesday en inglés
    });
  });

  describe('Dynamic buttons localized via Dashboard', () => {
    it('localizes refreshPlanningModeBtn and refreshAutoBreakBtn in Spanish and English', async () => {
      const { TodayTasksDashboard } = await import('../js/views/dashboard.js');
      document.body.innerHTML = `
        <button id="planningModeBtn"></button>
        <button id="autoBreakBtn"></button>
      `;

      let state = { planningMode: false, autoBreakEnabled: true };
      const dash = TodayTasksDashboard({ getState: () => state, computeSchedule: () => ({}) });

      setLocale('es');
      dash.refreshPlanningModeBtn();
      dash.refreshAutoBreakBtn();
      expect(document.getElementById('planningModeBtn').textContent).toBe('🗺 Modo planificación');
      expect(document.getElementById('autoBreakBtn').textContent).toBe('☕ Auto descansos: ON');

      state.planningMode = true;
      state.autoBreakEnabled = false;
      dash.refreshPlanningModeBtn();
      dash.refreshAutoBreakBtn();
      expect(document.getElementById('planningModeBtn').textContent).toBe('🗺 Planificación: ON');
      expect(document.getElementById('autoBreakBtn').textContent).toBe('☕ Auto descansos: OFF');

      setLocale('en');
      dash.refreshPlanningModeBtn();
      dash.refreshAutoBreakBtn();
      expect(document.getElementById('planningModeBtn').textContent).toBe('🗺 Planning: ON');
      expect(document.getElementById('autoBreakBtn').textContent).toBe('☕ Auto breaks: OFF');

      state.planningMode = false;
      dash.refreshPlanningModeBtn();
      expect(document.getElementById('planningModeBtn').textContent).toBe('🗺 Planning mode');
    });
  });
});
