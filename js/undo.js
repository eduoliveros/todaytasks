/* js/undo.js — Sistema de historial Deshacer / Rehacer (Undo / Redo) */
import { wrapState } from './state.js';

export function TodayTasksUndo(ctx) {
  const { getState, setState, saveState, renderAll, showToast } = ctx;
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 25;
  let isPerformingUndoRedo = false;

  function pushSnapshot(description = '') {
    if (isPerformingUndoRedo) return;
    const currentState = JSON.parse(JSON.stringify(getState ? getState() : {}));
    undoStack.push({ state: currentState, description, timestamp: Date.now() });
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }
    // Limpiar la pila de rehacer tras una nueva acción del usuario
    redoStack.length = 0;
  }

  function undo() {
    if (undoStack.length === 0) {
      if (showToast) showToast("No hay acciones para deshacer.");
      return false;
    }
    const current = JSON.parse(JSON.stringify(getState ? getState() : {}));
    const entry = undoStack.pop();
    redoStack.push({ state: current, description: entry.description, timestamp: Date.now() });

    isPerformingUndoRedo = true;
    try {
      const restored = wrapState(entry.state);
      if (setState) setState(restored);
      if (saveState) saveState();
      if (renderAll) renderAll();
      if (showToast) {
        showToast(entry.description ? `Deshecho: ${entry.description}` : "Acción deshecha.");
      }
    } finally {
      isPerformingUndoRedo = false;
    }
    return true;
  }

  function redo() {
    if (redoStack.length === 0) {
      if (showToast) showToast("No hay acciones para rehacer.");
      return false;
    }
    const current = JSON.parse(JSON.stringify(getState ? getState() : {}));
    const entry = redoStack.pop();
    undoStack.push({ state: current, description: entry.description, timestamp: Date.now() });

    isPerformingUndoRedo = true;
    try {
      const restored = wrapState(entry.state);
      if (setState) setState(restored);
      if (saveState) saveState();
      if (renderAll) renderAll();
      if (showToast) {
        showToast(entry.description ? `Rehecho: ${entry.description}` : "Acción rehecha.");
      }
    } finally {
      isPerformingUndoRedo = false;
    }
    return true;
  }

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clearHistory: () => { undoStack.length = 0; redoStack.length = 0; }
  };
}

export default TodayTasksUndo;
