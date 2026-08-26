import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Header responsivo en móvil (Opción A)', () => {
  let cssContent;
  let htmlContent;

  beforeAll(() => {
    const stylesPath = path.resolve(__dirname, '../css/styles.css');
    const headerPath = path.resolve(__dirname, '../css/header.css');
    const rawStyles = fs.readFileSync(stylesPath, 'utf-8');
    cssContent = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, 'utf-8') : rawStyles;
    htmlContent = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    document.documentElement.innerHTML = htmlContent;
  });

  it('el DOM contiene topbar-title-row con brand y header-tabs', () => {
    const titleRow = document.querySelector('.topbar-title-row');
    expect(titleRow).not.toBeNull();

    const brand = titleRow.querySelector('.brand');
    const headerTabs = titleRow.querySelector('.header-tabs');
    expect(brand).not.toBeNull();
    expect(headerTabs).not.toBeNull();

    const tabs = headerTabs.querySelectorAll('.header-tab');
    expect(tabs.length).toBe(3);
  });

  it('el archivo CSS contiene reglas media query para apilar topbar-title-row en pantallas pequeñas', () => {
    expect(cssContent).toMatch(/@media[^{]*max-width[^{]*\)\s*\{[\s\S]*?\.topbar-title-row\s*\{[\s\S]*?flex-direction:\s*column/i);
  });

  it('el archivo CSS contiene reglas para que header-tabs ocupe el ancho completo y distribuya las pestañas', () => {
    expect(cssContent).toMatch(/@media[^{]*max-width[^{]*\)\s*\{[\s\S]*?\.header-tabs\s*\{[\s\S]*?width:\s*100%/i);
    expect(cssContent).toMatch(/@media[^{]*max-width[^{]*\)\s*\{[\s\S]*?\.header-tab\s*\{[\s\S]*?flex:\s*1/i);
  });
});
