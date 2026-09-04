import { t } from './i18n.js';

export function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Renderiza texto en formato Markdown ligero a HTML seguro:
 * - Sanitiza primero con escapeHtml (seguridad estricta anti-XSS).
 * - Enlaces explícitos [Texto](https://...) y URLs directas https://... -> <a target="_blank" rel="noopener noreferrer">.
 * - Negrita (**texto** o __texto__) -> <strong>.
 * - Cursiva (*texto* o _texto_) -> <em>.
 * - Saltos de línea -> <br>.
 */
export function renderNotesMarkdown(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  // 1. Sanitizar primero contra cualquier inyección HTML
  let safe = escapeHtml(rawText);

  // 2. Negrita (**texto** o __texto__)
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // 3. Cursiva (*texto* o _texto_)
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  safe = safe.replace(/(^|[\s(])_([^_]+)_(?=[\s).,;!?]|$)/g, "$1<em>$2</em>");

  // 4. Enlaces Markdown explícitos: [Texto](http[s]://...)
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="task-note-link">${label}</a>`;
  });

  // 5. URLs directas (que no formen ya parte de un atributo href)
  safe = safe.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_match, prefix, url) => {
    return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="task-note-link">${url}</a>`;
  });

  // 6. Saltos de línea
  safe = safe.replace(/\r\n|\r|\n/g, "<br>");

  return safe;
}

let toastTimer = null;
export function showToast(message, action = null) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("toast");
  if (!el) return;

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  el.innerHTML = "";
  if (!action) {
    el.textContent = message;
  } else {
    const textSpan = document.createElement("span");
    textSpan.className = "toast-msg";
    textSpan.textContent = message;
    el.appendChild(textSpan);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action-btn";
    btn.textContent = action.label || t("action.undo");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      el.classList.remove("visible");
      if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      if (typeof action.onClick === "function") {
        action.onClick();
      }
    });
    el.appendChild(btn);
  }

  el.classList.add("visible");
  toastTimer = setTimeout(() => {
    el.classList.remove("visible");
    toastTimer = null;
  }, 4000);
}

export function scrollToElement(elementId) {
  if (typeof document === "undefined" || !elementId) return false;
  const el = document.getElementById(elementId);
  if (!el) return false;

  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (_e) {
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView();
    }
  }

  el.classList.remove("highlight-pulse");
  // Trigger DOM reflow to restart animation reliably
  void el.offsetWidth;
  el.classList.add("highlight-pulse");

  setTimeout(() => {
    el.classList.remove("highlight-pulse");
  }, 1300);

  return true;
}

/**
 * Posiciona un popover flotante (position: fixed) relativo a un elemento objetivo o centrado en viewport.
 * - Calcula coordenadas left/top y aplica bounds checking contra los bordes de la ventana.
 * - Si no cabe por debajo y hay espacio suficiente por arriba, invierte la posición (vertical flip).
 * - Aplica directamente los estilos al popover si se pasa, y devuelve { left, top, flipped }.
 *
 * @param {Element|Event|null} target Elemento de anclaje, Event o null (fallback centro).
 * @param {HTMLElement|null} popover Elemento del popover (opcional, para aplicar styles y medir offsetWidth/Height).
 * @param {Object} [options] Opciones de configuración
 * @param {number} [options.width] Ancho estimado del popover en px (por defecto mide popover.offsetWidth o 220).
 * @param {number} [options.height] Alto estimado del popover en px (por defecto mide popover.offsetHeight o 140).
 * @param {number} [options.gap=6] Separación en px entre el ancla y el popover.
 * @param {number} [options.margin=10] Margen mínimo respecto a los bordes de la ventana.
 * @returns {{ left: number, top: number, flipped: boolean }}
 */
export function positionPopover(target, popover, options = {}) {
  const win = typeof window !== 'undefined' ? window : { innerWidth: 1024, innerHeight: 768 };
  const popWidth = options.width || (popover && popover.offsetWidth) || 220;
  const popHeight = options.height || (popover && popover.offsetHeight) || 140;
  const gap = options.gap != null ? options.gap : 6;
  const margin = options.margin != null ? options.margin : 10;

  // Extraer el elemento DOM real si se pasó un evento
  let anchorEl = null;
  if (target) {
    if (target.currentTarget && typeof target.currentTarget.getBoundingClientRect === 'function') {
      anchorEl = target.currentTarget;
    } else if (target.target && typeof target.target.getBoundingClientRect === 'function') {
      anchorEl = target.target;
    } else if (typeof target.getBoundingClientRect === 'function') {
      anchorEl = target;
    }
  }

  // Fallback inicial: centrado en la ventana
  let left = Math.max(margin, (win.innerWidth - popWidth) / 2);
  let top = Math.max(margin, (win.innerHeight - popHeight) / 2);
  let flipped = false;

  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const hasValidRect = rect && (rect.width > 0 || rect.height > 0 || rect.top !== 0 || rect.left !== 0);
    if (hasValidRect) {
      left = rect.left;
      top = rect.bottom + gap;

      // Inversión vertical hacia arriba si desborda por abajo y cabe arriba
      if (top + popHeight > win.innerHeight - margin && rect.top > popHeight + gap) {
        top = Math.max(margin, rect.top - popHeight - gap);
        flipped = true;
      }

      // Clamping horizontal dentro del viewport
      if (left + popWidth > win.innerWidth - margin) {
        left = win.innerWidth - popWidth - margin;
      }
      if (left < margin) {
        left = margin;
      }
    }
  }

  left = Math.round(left);
  top = Math.round(top);

  if (popover && popover.style) {
    popover.style.position = 'fixed';
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  return { left, top, flipped };
}

export const TodayTasksUi = { escapeHtml, escapeAttr, renderNotesMarkdown, showToast, scrollToElement, positionPopover };

export default TodayTasksUi;



