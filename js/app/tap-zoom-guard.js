/* app/tap-zoom-guard.js — Suprime el zoom por doble-tap en botones de acción táctiles */
const SCOPE_SELECTOR = [
  '.task-detail-grid-btn',
  '.triage-move-grid-btn',
  '.task-detail-btn',
  '.task-detail-date-chip',
  '.task-detail-quick-day-btn',
  '.triage-move-date-chip'
].join(', ');

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;

export function installTapZoomGuard(scopeSelector = SCOPE_SELECTOR) {
  if (typeof document === 'undefined') return;

  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  document.addEventListener('touchend', (event) => {
    const target = event.target;
    const btn = target && typeof target.closest === 'function' ? target.closest(scopeSelector) : null;

    if (!btn) {
      lastTapTime = 0;
      return;
    }

    if (!event.changedTouches || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const now = Date.now();
    const elapsed = now - lastTapTime;
    const dist = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);
    const isDoubleTap = elapsed <= DOUBLE_TAP_MS && dist <= DOUBLE_TAP_PX;

    lastTapTime = now;
    lastTapX = touch.clientX;
    lastTapY = touch.clientY;

    if (isDoubleTap) {
      event.preventDefault();
      if (typeof btn.click === 'function') btn.click();
    }
  }, { passive: false });
}
