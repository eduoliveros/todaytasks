import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CSS Modularization Architecture', () => {
  const cssDir = path.resolve(process.cwd(), 'css');
  const stylesPath = path.join(cssDir, 'styles.css');
  const expectedModules = [
    'base.css',
    'header.css',
    'layout.css',
    'calendar.css',
    'focus.css',
    'interruption.css',
    'history.css',
    'modals.css',
    'theme-dark.css'
  ];

  it('ensures styles.css exists and contains @import for all 9 modular files', () => {
    expect(fs.existsSync(stylesPath)).toBe(true);
    const stylesContent = fs.readFileSync(stylesPath, 'utf8');

    expectedModules.forEach(mod => {
      expect(stylesContent).toContain(`@import './${mod}';`);
    });
  });

  it('verifies that each modular CSS file exists and has non-empty content', () => {
    expectedModules.forEach(mod => {
      const filePath = path.join(cssDir, mod);
      expect(fs.existsSync(filePath), `Missing module: ${mod}`).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8').trim();
      expect(content.length).toBeGreaterThan(50);
    });
  });

  it('verifies base.css contains root CSS variables and basic reset', () => {
    const content = fs.readFileSync(path.join(cssDir, 'base.css'), 'utf8');
    expect(content).toContain(':root');
    expect(content).toContain('--bg:');
    expect(content).toContain('--panel:');
    expect(content).toContain('--accent-running:');
  });

  it('verifies theme-dark.css contains dark theme overrides', () => {
    const content = fs.readFileSync(path.join(cssDir, 'theme-dark.css'), 'utf8');
    expect(content).toContain('[data-theme="dark"]');
    expect(content).toContain('--bg: #121418;');
  });

  it('ensures all modular CSS files have balanced braces', () => {
    expectedModules.forEach(mod => {
      const content = fs.readFileSync(path.join(cssDir, mod), 'utf8');
      // Strip comments and string literals for brace check
      const stripped = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, '');

      let openCount = (stripped.match(/\{/g) || []).length;
      let closeCount = (stripped.match(/\}/g) || []).length;
      expect(openCount, `Unbalanced braces in ${mod}`).toBe(closeCount);
    });
  });

  it('verifies index.html links to css/styles.css', () => {
    const htmlPath = path.resolve(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toMatch(/<link\s+rel="stylesheet"\s+href="css\/styles\.css(\?v=[^"]+)?"/);
  });
});
