import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Modal de ayuda de atajos de teclado', () => {
  beforeAll(async () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    document.documentElement.innerHTML = html;
    window.alert = vi.fn();
    await import('../js/app.js');
  });

  beforeEach(() => {
    const modal = document.getElementById('shortcutsModal');
    if (modal) modal.style.display = 'none';
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  });

  it('el modal de atajos está inicialmente oculto', () => {
    const modal = document.getElementById('shortcutsModal');
    expect(modal.style.display).not.toBe('flex');
  });

  it('al hacer clic en el botón ? de la cabecera, se muestra el modal de atajos', () => {
    const helpBtn = document.getElementById('helpBtn');
    const modal = document.getElementById('shortcutsModal');

    helpBtn.click();
    expect(modal.style.display).toBe('flex');
  });

  it('al pulsar la tecla ?, se abre y se cierra el modal de atajos', () => {
    const modal = document.getElementById('shortcutsModal');

    // Abrir con '?'
    const openEvent = new KeyboardEvent('keydown', { key: '?', bubbles: true });
    window.dispatchEvent(openEvent);
    expect(modal.style.display).toBe('flex');

    // Cerrar con '?' nuevamente
    const closeEvent = new KeyboardEvent('keydown', { key: '?', bubbles: true });
    window.dispatchEvent(closeEvent);
    expect(modal.style.display).toBe('none');
  });

  it('al pulsar Esc con el modal abierto, este se cierra', () => {
    const modal = document.getElementById('shortcutsModal');
    modal.style.display = 'flex';

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    window.dispatchEvent(escEvent);

    expect(modal.style.display).toBe('none');
  });

  it('al hacer clic en el botón de cerrar (&times;), se cierra el modal', () => {
    const modal = document.getElementById('shortcutsModal');
    const closeBtn = document.getElementById('closeShortcutsBtn');

    modal.style.display = 'flex';
    closeBtn.click();

    expect(modal.style.display).toBe('none');
  });

  it('no abre el modal de atajos si la tecla ? se pulsa dentro de un input', () => {
    const modal = document.getElementById('shortcutsModal');
    const input = document.getElementById('taskTitle');
    input.focus();

    const event = new KeyboardEvent('keydown', { key: '?', bubbles: true });
    window.dispatchEvent(event);

    expect(modal.style.display).not.toBe('flex');
  });

  it('el modal contiene la ayuda del atajo "P" para el modo planificación', () => {
    const modal = document.getElementById('shortcutsModal');
    const keys = Array.from(modal.querySelectorAll('.shortcut-key')).map(el => el.textContent);
    expect(keys).toContain('P');

    const descRows = Array.from(modal.querySelectorAll('.shortcut-row'));
    const pRow = descRows.find(r => r.querySelector('.shortcut-key')?.textContent === 'P');
    expect(pRow).toBeDefined();
    expect(pRow.textContent).toContain('planificación');
  });
});
