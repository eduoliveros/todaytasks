import { describe, it, expect, beforeEach } from 'vitest';
import { positionPopover } from '../js/ui.js';

describe('positionPopover helper (js/ui.js)', () => {
  let popoverEl;

  beforeEach(() => {
    // Definir dimensiones de viewport mock en jsdom
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

    popoverEl = document.createElement('div');
    document.body.appendChild(popoverEl);
  });

  it('centers popover in viewport when target is null or missing', () => {
    const pos = positionPopover(null, popoverEl, { width: 200, height: 100 });
    expect(pos.left).toBe((1024 - 200) / 2);
    expect(pos.top).toBe((768 - 100) / 2);
    expect(pos.flipped).toBe(false);
    expect(popoverEl.style.left).toBe(`${pos.left}px`);
    expect(popoverEl.style.top).toBe(`${pos.top}px`);
    expect(popoverEl.style.position).toBe('fixed');
  });

  it('positions popover right below anchor element by default', () => {
    const anchor = document.createElement('button');
    anchor.getBoundingClientRect = () => ({
      left: 150,
      top: 100,
      right: 250,
      bottom: 130,
      width: 100,
      height: 30
    });

    const pos = positionPopover(anchor, popoverEl, { width: 220, height: 120, gap: 6 });
    expect(pos.left).toBe(150);
    expect(pos.top).toBe(130 + 6);
    expect(pos.flipped).toBe(false);
  });

  it('clamps left coordinate to prevent overflowing right viewport edge', () => {
    const anchor = document.createElement('button');
    anchor.getBoundingClientRect = () => ({
      left: 950,
      top: 100,
      right: 1000,
      bottom: 130,
      width: 50,
      height: 30
    });

    // width 200 + left 950 = 1150 > 1024 - 10 (1014)
    const pos = positionPopover(anchor, popoverEl, { width: 200, height: 100, margin: 10 });
    expect(pos.left).toBe(1024 - 200 - 10); // 814
    expect(pos.left + 200).toBeLessThanOrEqual(1024 - 10);
  });

  it('clamps left coordinate to prevent overflowing left viewport edge', () => {
    const anchor = document.createElement('button');
    anchor.getBoundingClientRect = () => ({
      left: 2,
      top: 100,
      right: 20,
      bottom: 130,
      width: 18,
      height: 30
    });

    const pos = positionPopover(anchor, popoverEl, { width: 200, height: 100, margin: 10 });
    expect(pos.left).toBe(10);
  });

  it('flips vertically upward when overflowing bottom viewport edge', () => {
    const anchor = document.createElement('button');
    anchor.getBoundingClientRect = () => ({
      left: 200,
      top: 700,
      right: 300,
      bottom: 730,
      width: 100,
      height: 30
    });

    // bottom 730 + gap 6 + height 120 = 856 > 768 - 10 (758)
    // Should flip upward: top = rect.top - height - gap = 700 - 120 - 6 = 574
    const pos = positionPopover(anchor, popoverEl, { width: 220, height: 120, gap: 6, margin: 10 });
    expect(pos.flipped).toBe(true);
    expect(pos.top).toBe(700 - 120 - 6);
  });

  it('extracts anchor element from Event object', () => {
    const button = document.createElement('button');
    button.getBoundingClientRect = () => ({
      left: 100,
      top: 200,
      right: 180,
      bottom: 230,
      width: 80,
      height: 30
    });

    const mockEvent = { currentTarget: button };
    const pos = positionPopover(mockEvent, popoverEl, { width: 200, height: 100, gap: 4 });
    expect(pos.left).toBe(100);
    expect(pos.top).toBe(234);
  });
});
