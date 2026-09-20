import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Vista Móvil Compacta - Fase 1 (Tarjetas de Tareas en Tablero Principal)', () => {
  let layoutCss;

  beforeAll(() => {
    const layoutPath = path.resolve(__dirname, '../css/layout.css');
    layoutCss = fs.readFileSync(layoutPath, 'utf-8');
  });

  it('layout.css contiene media query max-width 640px para modo compacto móvil', () => {
    expect(layoutCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{/i);
  });

  it('oculta la barra de acciones inferiores (.task-actions) en tareas no en edición', () => {
    expect(layoutCss).toMatch(/\.task-item:not\(\.editing\)[^{}]*\.task-actions[^{}]*\{[^}]*display:\s*none/i);
  });

  it('oculta la fila de horario y pills (.time-range) y los metadatos (.meta) en modo compacto', () => {
    expect(layoutCss).toMatch(/\.task-item:not\(\.editing\)[^{}]*\.time-range[^{}]*\{[^}]*display:\s*none/i);
    expect(layoutCss).toMatch(/\.task-item:not\(\.editing\)[^{}]*\.meta[^{}]*\{[^}]*display:\s*none/i);
  });

  it('oculta los botones de icono de la derecha de la tarjeta (.icon-btn) en modo compacto', () => {
    expect(layoutCss).toMatch(/\.task-item:not\(\.editing\)[^{}]*\.icon-btn[^{}]*\{[^}]*display:\s*none/i);
  });

  it('mantiene la edición visible (.task-item.editing .task-actions)', () => {
    expect(layoutCss).toMatch(/\.task-item\.editing\s+\.task-actions\s*\{[^}]*display:\s*flex/i);
  });

  it('aplica cursor pointer y truncado de texto al título en modo compacto', () => {
    expect(layoutCss).toMatch(/\.task-item:not\(\.editing\)\s*\{[^}]*cursor:\s*pointer/i);
    expect(layoutCss).toMatch(/\.task-item:not\(\.editing\)\s+\.title\s*\{[^}]*text-overflow:\s*ellipsis/i);
  });
});
