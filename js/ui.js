export function escapeHtml(str) {
  if (typeof document === "undefined") return String(str == null ? "" : str);
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

export function escapeAttr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
    btn.textContent = action.label || "Deshacer";
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

export const TodayTasksUi = { escapeHtml, escapeAttr, showToast, scrollToElement };

export default TodayTasksUi;



