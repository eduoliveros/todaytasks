import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { escapeHtml, escapeAttr, showToast, scrollToElement, TodayTasksUi } from '../js/ui.js';

describe('UI Helpers (js/ui.js)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="toast"></div>
      <div id="targetCard">Item Card</div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports helper functions and TodayTasksUi namespace', () => {
    expect(typeof escapeHtml).toBe('function');
    expect(typeof escapeAttr).toBe('function');
    expect(typeof showToast).toBe('function');
    expect(typeof scrollToElement).toBe('function');
    expect(TodayTasksUi.escapeHtml).toBe(escapeHtml);
  });

  it('sanitizes strings properly with escapeHtml', () => {
    const raw = '<script>alert("xss")</script> & "quotes"';
    const escaped = escapeHtml(raw);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('sanitizes attributes properly with escapeAttr', () => {
    const raw = 'Title "with quotes" & <brackets>';
    const escaped = escapeAttr(raw);
    expect(escaped).toBe('Title &quot;with quotes&quot; &amp; &lt;brackets&gt;');
  });

  it('shows toast with message and auto-hides after timeout', () => {
    const toastEl = document.getElementById('toast');
    expect(toastEl.classList.contains('visible')).toBe(false);

    showToast('Tarea creada con éxito');
    expect(toastEl.textContent).toBe('Tarea creada con éxito');
    expect(toastEl.classList.contains('visible')).toBe(true);

    // Fast-forward 4000ms
    vi.advanceTimersByTime(4000);
    expect(toastEl.classList.contains('visible')).toBe(false);
  });

  it('applies pulse highlight animation and triggers scroll in scrollToElement', () => {
    const el = document.getElementById('targetCard');
    el.scrollIntoView = vi.fn();

    const result = scrollToElement('targetCard');
    expect(result).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.classList.contains('highlight-pulse')).toBe(true);

    // After 1300ms, pulse class is removed
    vi.advanceTimersByTime(1300);
    expect(el.classList.contains('highlight-pulse')).toBe(false);
  });

  it('returns false in scrollToElement when element is not found', () => {
    const result = scrollToElement('nonExistentId');
    expect(result).toBe(false);
  });

  it('localiza el botón de acción por defecto en showToast (Deshacer / Undo)', async () => {
    const { setLocale } = await import('../js/i18n.js');
    const toastEl = document.getElementById('toast');

    setLocale('es');
    showToast('Prueba', { onClick: vi.fn() });
    expect(toastEl.querySelector('.toast-action-btn').textContent).toBe('Deshacer');

    setLocale('en');
    showToast('Test', { onClick: vi.fn() });
    expect(toastEl.querySelector('.toast-action-btn').textContent).toBe('Undo');

    setLocale('es');
  });
});
