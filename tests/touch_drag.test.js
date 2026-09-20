import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTouchDragEngine, wasRecentTouchDrag } from '../js/app/touch-drag.js';

describe('touch-drag engine — supresión de click sintético (wasRecentTouchDrag)', () => {
  let engine;
  let onDrop;

  beforeEach(() => {
    document.body.innerHTML = `
      <div class="row" data-task-id="a">A</div>
      <div class="row" data-task-id="b">B</div>
    `;
    onDrop = vi.fn();
    engine = createTouchDragEngine({
      rowSelector: '.row',
      handleSelector: '.handle',
      onDragStart: () => {},
      onDrop
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('wasRecentTouchDrag es false antes de cualquier gesto', () => {
    expect(wasRecentTouchDrag()).toBe(false);
  });

  it('un long-press + arrastre marca wasRecentTouchDrag como true temporalmente', () => {
    vi.useFakeTimers();
    const rowA = document.querySelector('.row[data-task-id="a"]');
    const rowB = document.querySelector('.row[data-task-id="b"]');

    engine.handleTouchStart('a', {
      touches: [{ clientX: 10, clientY: 10 }],
      target: rowA,
      currentTarget: rowA
    });
    vi.advanceTimersByTime(420);
    // Aún arrastrando (sin soltar): todavía no se considera "reciente"
    expect(wasRecentTouchDrag()).toBe(false);

    document.elementFromPoint = vi.fn().mockReturnValue(rowB);
    engine.handleTouchMove({
      touches: [{ clientX: 10, clientY: 50 }],
      cancelable: true,
      preventDefault: vi.fn()
    });
    engine.handleTouchEnd({ cancelable: true, preventDefault: vi.fn() });

    expect(onDrop).toHaveBeenCalledWith('a', 'b', null);
    expect(wasRecentTouchDrag()).toBe(true);

    vi.advanceTimersByTime(401);
    expect(wasRecentTouchDrag()).toBe(false);
  });
});
