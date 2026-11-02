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
    expect(pRow.textContent.toLowerCase()).toMatch(/planificación|planning/);
  });

  it('el modal contiene la ayuda del atajo "R" y "M" para nueva reunión', () => {
    const modal = document.getElementById('shortcutsModal');
    const keys = Array.from(modal.querySelectorAll('.shortcut-key')).map(el => el.textContent.trim());
    expect(keys).toContain('R');
    expect(keys).toContain('M');

    const descRows = Array.from(modal.querySelectorAll('.shortcut-row'));
    const meetingRow = descRows.find(r => Array.from(r.querySelectorAll('.shortcut-key')).some(k => k.textContent.trim() === 'M'));
    expect(meetingRow).toBeDefined();
    expect(meetingRow.textContent.toLowerCase()).toMatch(/reunión|meeting/);
  });

  it('el modal contiene la ayuda del atajo "Ctrl+K" para el buscador global', () => {
    const modal = document.getElementById('shortcutsModal');
    const descRows = Array.from(modal.querySelectorAll('.shortcut-row'));
    const kRow = descRows.find(r => Array.from(r.querySelectorAll('.shortcut-key')).some(k => k.textContent.trim() === 'K'));
    expect(kRow).toBeDefined();
    expect(kRow.textContent.toLowerCase()).toMatch(/buscador|global|search/);
  });
  it("muestra por defecto la pestaña de atajos de teclado al abrir el modal", () => {
    const helpBtn = document.getElementById("helpBtn");
    const shortcutsBody = document.getElementById("shortcutsHelpTabBody");
    const colorsBody = document.getElementById("colorsHelpTabBody");
    const shortcutsBtn = document.getElementById("helpTabShortcutsBtn");
    const colorsBtn = document.getElementById("helpTabColorsBtn");

    helpBtn.click();
    expect(shortcutsBody.style.display).toBe("flex");
    expect(colorsBody.style.display).toBe("none");
    expect(shortcutsBtn.classList.contains("active")).toBe(true);
    expect(colorsBtn.classList.contains("active")).toBe(false);
  });

  it("permite alternar entre la pestaña de atajos y la de código de colores", () => {
    const helpBtn = document.getElementById("helpBtn");
    const shortcutsBody = document.getElementById("shortcutsHelpTabBody");
    const colorsBody = document.getElementById("colorsHelpTabBody");
    const shortcutsBtn = document.getElementById("helpTabShortcutsBtn");
    const colorsBtn = document.getElementById("helpTabColorsBtn");

    helpBtn.click();

    // Cambiar a la pestaña de colores
    colorsBtn.click();
    expect(shortcutsBody.style.display).toBe("none");
    expect(colorsBody.style.display).toBe("flex");
    expect(colorsBtn.classList.contains("active")).toBe(true);
    expect(shortcutsBtn.classList.contains("active")).toBe(false);

    // Contiene los elementos descriptivos de colores de la lista de tareas
    const colorItems = colorsBody.querySelectorAll(".help-color-item");
    expect(colorItems.length).toBeGreaterThanOrEqual(7);

    // Volver a la pestaña de atajos
    shortcutsBtn.click();
    expect(shortcutsBody.style.display).toBe("flex");
    expect(colorsBody.style.display).toBe("none");
    expect(shortcutsBtn.classList.contains("active")).toBe(true);
  });

  it("vuelve a mostrar la pestaña de atajos si se abre tras haber estado en la pestaña de colores", () => {
    const helpBtn = document.getElementById("helpBtn");
    const closeBtn = document.getElementById("closeShortcutsBtn");
    const shortcutsBody = document.getElementById("shortcutsHelpTabBody");
    const colorsBody = document.getElementById("colorsHelpTabBody");
    const colorsBtn = document.getElementById("helpTabColorsBtn");

    helpBtn.click();
    colorsBtn.click();
    expect(colorsBody.style.display).toBe("flex");

    closeBtn.click();

    helpBtn.click();
    expect(shortcutsBody.style.display).toBe("flex");
    expect(colorsBody.style.display).toBe("none");
  });
});
