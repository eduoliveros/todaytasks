import { describe, it, expect, beforeEach } from 'vitest';
import * as stateModule from '../js/state.js';
import { TodayTasksState, defaultState, wrapState, loadState } from '../js/state.js';

describe('TodayTasksState (ES Module & Global bridge)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exporta correctamente tanto funciones nombradas como objeto consolidado y window.TodayTasksState', () => {
    expect(TodayTasksState).toBeDefined();
    expect(defaultState).toBeDefined();
    expect(window.TodayTasksState).toBeDefined();
    expect(window.TodayTasksState.defaultState).toBe(defaultState);
  });

  describe('defaultState & wrapState', () => {
    it('crea una estructura de estado por defecto válida', () => {
      const state = defaultState();
      state.selectedDate = '2026-08-17'; // Lunes
      expect(state.activeEnv).toBe('work');
      expect(state.environments.work).toBeDefined();
      expect(state.environments.personal).toBeDefined();
      expect(state.workStart).toBe(9 * 60); // 09:00 para Trabajo
      expect(state.workEnd).toBe(18 * 60);  // 18:00 para Trabajo
      expect(Array.isArray(state.tasks)).toBe(true);
      expect(Array.isArray(state.meetings)).toBe(true);
    });

    it('cambia valores según el ambiente activo (work vs personal)', () => {
      const state = defaultState();
      state.selectedDate = '2026-08-17'; // Lunes
      
      // Entorno de trabajo por defecto (09:00 - 18:00)
      expect(state.workStart).toBe(540);
      expect(state.workEnd).toBe(1080);

      // Cambiar a personal
      state.activeEnv = 'personal';
      expect(state.workStart).toBe(1080); // 18:00 para Personal
      expect(state.workEnd).toBe(1380);  // 23:00 para Personal
    });

    it('migra estados antiguos/incompletos de forma segura', () => {
      const stateIncompleto = wrapState({
        themeMode: 'dark'
      });

      expect(stateIncompleto.activeEnv).toBe('work');
      expect(stateIncompleto.themeMode).toBe('dark');
      expect(stateIncompleto.notifyIntervalMin).toBe(10);
      expect(stateIncompleto.nextId).toBe(1);
    });
  });

  describe('loadState & localStorage', () => {
    it('retorna defaultState si localStorage está vacío', () => {
      const state = loadState('todaytasks_test_key');
      expect(state).toBeDefined();
      expect(state.activeEnv).toBe('work');
    });

    it('carga y envuelve correctamente datos guardados en localStorage', () => {
      const sampleData = {
        activeEnv: 'personal',
        themeMode: 'light',
        nextId: 5
      };
      localStorage.setItem('todaytasks_test_key', JSON.stringify(sampleData));

      const state = loadState('todaytasks_test_key');
      expect(state.activeEnv).toBe('personal');
      expect(state.themeMode).toBe('light');
      expect(state.nextId).toBe(5);
    });
  });
});

