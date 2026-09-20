/* app/touch-drag.js — Motor reutilizable de drag & drop táctil (long-press) para tareas.
   Encapsula el state machine de pulsación prolongada y arrastre usado en triaje y tablero,
   delegando en callbacks las acciones específicas de cada vista. */

let lastTouchDragEndAt = 0;

// Indica si acaba de finalizar un gesto táctil de arrastre/long-press (útil para que
// otros módulos supriman el click sintético posterior sin acoplarse al motor).
export function wasRecentTouchDrag(withinMs = 400) {
  return (Date.now() - lastTouchDragEndAt) <= withinMs;
}

export function createTouchDragEngine(options = {}) {
  const {
    rowSelector = '.triage-task-row',
    handleSelector = '.triage-drag-handle',
    shouldIgnoreStart = null,
    isDraggable = null,
    getSelectedIds = null,
    onDragStart = null,
    onDrop = null,
    onLongPressNotDraggable = null,
    isDropTargetAllowed = null,
    holdDelay = 420,
    handleHoldDelay = 60,
    longPressNotDraggableDelay = 450,
    vibrateMs = 45
  } = options;

  let touchHoldTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchSourceTaskId = null;
  let touchSourceRowEl = null;
  let isTouchDragging = false;
  let currentTouchOverTaskId = null;
  let didLongPressTrigger = false;
  let touchDragJustEnded = false;
  let touchDragJustEndedTimer = null;

  function vibrate() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(vibrateMs); } catch (e) {}
    }
  }

  function clearHoldTimer() {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }
  }

  function cleanupClasses() {
    if (touchSourceRowEl) {
      touchSourceRowEl.classList.remove('long-press-active', 'dragging');
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll(`${rowSelector}.drag-over, ${rowSelector}.drag-forbidden, ${rowSelector}.long-press-active, ${rowSelector}.dragging`)
        .forEach(el => el.classList.remove('drag-over', 'drag-forbidden', 'long-press-active', 'dragging'));
    }
  }

  function resetState() {
    touchSourceTaskId = null;
    touchSourceRowEl = null;
    isTouchDragging = false;
    currentTouchOverTaskId = null;
    didLongPressTrigger = false;
  }

  function handleTouchStart(taskId, event) {
    if (!event || !event.touches || event.touches.length === 0) return;
    if (shouldIgnoreStart && shouldIgnoreStart(event)) return;

    const draggable = isDraggable ? !!isDraggable(taskId) : true;

    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchSourceTaskId = String(taskId);
    didLongPressTrigger = false;
    isTouchDragging = false;
    currentTouchOverTaskId = null;

    const row = event.currentTarget || (event.target && typeof event.target.closest === 'function' ? event.target.closest(rowSelector) : null);
    touchSourceRowEl = row;

    clearHoldTimer();

    const isHandle = !!(event.target && typeof event.target.closest === 'function' && event.target.closest(handleSelector));

    if (!draggable) {
      // Tarea no arrastrable (p. ej. en ejecución): pulsación larga informativa sin arrastre
      if (onLongPressNotDraggable) {
        touchHoldTimer = setTimeout(() => {
          touchHoldTimer = null;
          didLongPressTrigger = true;
          vibrate();
          onLongPressNotDraggable(taskId, event);
        }, longPressNotDraggableDelay);
      }
      return;
    }

    // Manija: arrastre inmediato (60ms). Cuerpo: requiere pulsación prolongada (~420ms).
    const delay = isHandle ? handleHoldDelay : holdDelay;

    touchHoldTimer = setTimeout(() => {
      touchHoldTimer = null;
      didLongPressTrigger = true;
      isTouchDragging = true;
      vibrate();

      const selectedIds = getSelectedIds ? getSelectedIds(taskId) : null;
      if (onDragStart) onDragStart(taskId, touchSourceRowEl, selectedIds);
    }, delay);
  }

  function handleTouchMove(event) {
    if (!event || !event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    if (!isTouchDragging) {
      // Si el usuario desplaza antes de completar el long-press, cancelamos el arrastre
      if (dx > 10 || dy > 10) {
        clearHoldTimer();
      }
      return;
    }

    if (event.cancelable && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    if (typeof document !== 'undefined' && document.elementFromPoint) {
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const overRow = targetEl ? targetEl.closest(rowSelector) : null;
      const overTaskId = overRow ? overRow.getAttribute('data-task-id') : null;

      document.querySelectorAll(`${rowSelector}.drag-over, ${rowSelector}.drag-forbidden`).forEach(el => {
        if (el !== overRow) el.classList.remove('drag-over', 'drag-forbidden');
      });

      if (overRow && overTaskId && overTaskId !== touchSourceTaskId) {
        const allowed = isDropTargetAllowed ? isDropTargetAllowed(touchSourceTaskId, overTaskId) : true;
        if (!allowed) {
          overRow.classList.add('drag-forbidden');
          overRow.classList.remove('drag-over');
        } else {
          overRow.classList.add('drag-over');
          overRow.classList.remove('drag-forbidden');
        }
        currentTouchOverTaskId = overTaskId;
      } else {
        currentTouchOverTaskId = null;
      }
    }
  }

  function handleTouchEnd(event) {
    clearHoldTimer();

    const wasLongPress = didLongPressTrigger;
    const wasDragging = isTouchDragging;
    const sourceId = touchSourceTaskId;
    const targetId = currentTouchOverTaskId;
    const selectedIds = getSelectedIds ? getSelectedIds(sourceId) : null;

    cleanupClasses();
    resetState();

    // Evitar que el navegador emita un click sintético tras soltar el gesto
    if (wasLongPress || wasDragging) {
      touchDragJustEnded = true;
      lastTouchDragEndAt = Date.now();
      if (touchDragJustEndedTimer) clearTimeout(touchDragJustEndedTimer);
      touchDragJustEndedTimer = setTimeout(() => {
        touchDragJustEnded = false;
        touchDragJustEndedTimer = null;
      }, 400);
      if (event && event.cancelable && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    }

    if ((wasLongPress || wasDragging) && sourceId) {
      if (targetId && (targetId !== sourceId || (wasDragging && selectedIds && selectedIds.has(String(targetId)) && selectedIds.size > 1))) {
        if (onDrop) onDrop(sourceId, targetId, selectedIds);
      } else if (wasLongPress && !wasDragging && onLongPressNotDraggable) {
        onLongPressNotDraggable(sourceId, event);
      }
    }
  }

  function handleTouchCancel() {
    clearHoldTimer();
    cleanupClasses();
    resetState();
  }

  function wasJustDragged() {
    return touchDragJustEnded;
  }

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    wasJustDragged
  };
}

export default createTouchDragEngine;
