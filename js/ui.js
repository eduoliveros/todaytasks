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
export function showToast(message) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("visible"); }, 4000);
}

export const TodayTasksUi = { escapeHtml, escapeAttr, showToast };

export default TodayTasksUi;


