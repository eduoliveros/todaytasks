/* js/undo.js — Sistema de historial Deshacer / Rehacer (Undo / Redo) */
import { wrapState } from './state.js';
import { t } from './i18n.js';

export function formatActionDescription(desc) {
  if (!desc) return '';
  if (typeof desc === 'object' && desc !== null && desc.key) {
    return t(desc.key, desc.params || {});
  }
  if (typeof desc === 'string') {
    const mAdd = desc.match(/^Añadir tarea "(.*)"$/);
    if (mAdd) return t('actions.taskAdded', { title: mAdd[1] });
    const mAddRec = desc.match(/^Añadir tarea recurrente "(.*)"$/);
    if (mAddRec) return t('actions.taskAddedRecurring', { title: mAddRec[1] });
    const mDel = desc.match(/^Eliminar tarea "(.*)"$/);
    if (mDel) return t('actions.taskDeleted', { title: mDel[1] });
    const mComp = desc.match(/^Completar tarea "(.*)"$/);
    if (mComp) return t('actions.taskCompleted', { title: mComp[1] });
    const mRest = desc.match(/^Restaurar tarea "(.*)"$/);
    if (mRest) return t('actions.taskRestored', { title: mRest[1] });
    const mEdit = desc.match(/^Editar tarea "(.*)"$/);
    if (mEdit) return t('actions.taskEdited', { title: mEdit[1] });
    const mFeat = desc.match(/^Destacar tarea "(.*)"$/);
    if (mFeat) return t('actions.taskFeatured', { title: mFeat[1] });
    const mUnfeat = desc.match(/^Quitar destacado de "(.*)"$/);
    if (mUnfeat) return t('actions.taskUnfeatured', { title: mUnfeat[1] });
    if (desc === 'Reordenar tareas') return t('actions.tasksReordered');
    const mMeetAdd = desc.match(/^Añadir reunión "(.*)"$/);
    if (mMeetAdd) return t('actions.meetingAdded', { title: mMeetAdd[1] });
    const mMeetDel = desc.match(/^Eliminar reunión "(.*)"$/);
    if (mMeetDel) return t('actions.meetingDeleted', { title: mMeetDel[1] });
    const mMeetEdit = desc.match(/^Editar reunión "(.*)"$/);
    if (mMeetEdit) return t('actions.meetingEdited', { title: mMeetEdit[1] });
  }
  return String(desc);
}

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
      if (showToast) showToast(t("undo.noActions"));
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
        const descText = formatActionDescription(entry.description);
        showToast(descText ? t("undo.undoneAction", { action: descText }) : t("undo.undone"));
      }
    } finally {
      isPerformingUndoRedo = false;
    }
    return true;
  }

  function redo() {
    if (redoStack.length === 0) {
      if (showToast) showToast(t("undo.noRedoActions"));
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
        const descText = formatActionDescription(entry.description);
        showToast(descText ? t("undo.redoneAction", { action: descText }) : t("undo.redone"));
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
