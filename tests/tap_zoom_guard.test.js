import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installTapZoomGuard } from '../js/app/tap-zoom-guard.js';

describe('tap-zoom-guard — supresión de zoom por doble-tap', () => {
  let listener;
  let listenerOptions;

  function makeEvent(btn, x, y) {
    const preventDefault = vi.fn();
    return {
      target: btn,
      changedTouches: [{ clientX: x, clientY: y }],
      preventDefault
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    listener = null;
    listenerOptions = null;
    vi.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => {
      if (type === 'touchend') {
        listener = fn;
        listenerOptions = opts;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('instala un listener touchend con passive:false', () => {
    installTapZoomGuard();
    expect(listener).toBeInstanceOf(Function);
    expect(listenerOptions).toEqual({ passive: false });
  });

  it('cancela el zoom y re-dispara click ante un doble-tap en un botón del scope', () => {
    document.body.innerHTML = '<button type="button" class="task-detail-grid-btn"></button>';
    const btn = document.querySelector('.task-detail-grid-btn');
    const clickSpy = vi.fn();
    btn.onclick = clickSpy;

    installTapZoomGuard();

    const first = makeEvent(btn, 100, 100);
    listener(first);
    expect(first.preventDefault).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    const second = makeEvent(btn, 102, 101);
    listener(second);
    expect(second.preventDefault).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('no interviene en un toque único (sin doble-tap)', () => {
    document.body.innerHTML = '<button type="button" class="task-detail-btn"></button>';
    const btn = document.querySelector('.task-detail-btn');
    installTapZoomGuard();

    const event = makeEvent(btn, 50, 50);
    listener(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('no interviene si los toques están separados más de 300ms', () => {
    document.body.innerHTML = '<button type="button" class="task-detail-grid-btn"></button>';
    const btn = document.querySelector('.task-detail-grid-btn');
    const clickSpy = vi.fn();
    btn.onclick = clickSpy;
    installTapZoomGuard();

    listener(makeEvent(btn, 100, 100));
    vi.advanceTimersByTime(400);
    const second = makeEvent(btn, 100, 100);
    listener(second);

    expect(second.preventDefault).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('un toque fuera del scope reinicia la detección', () => {
    document.body.innerHTML = `
      <button type="button" class="task-detail-grid-btn"></button>
      <div class="otro"></div>
    `;
    const btn = document.querySelector('.task-detail-grid-btn');
    const fuera = document.querySelector('.otro');
    installTapZoomGuard();

    listener(makeEvent(fuera, 100, 100));
    vi.advanceTimersByTime(100);
    const segundo = makeEvent(btn, 100, 100);
    listener(segundo);

    expect(segundo.preventDefault).not.toHaveBeenCalled();
  });
});
