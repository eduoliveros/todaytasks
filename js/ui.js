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

export const TodayTasksUi = { escapeHtml, escapeAttr, renderNotesMarkdown, showToast, scrollToElement };

export default TodayTasksUi;



