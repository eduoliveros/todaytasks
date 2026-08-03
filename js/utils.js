window.TodayTasksUtils = {
  nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  },

  fmt(mins) {
    mins = Math.max(0, Math.round(mins));
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  },

  fmtDur(mins) {
    mins = Math.max(0, Math.round(mins));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return h + "h " + (m > 0 ? m + "min" : "");
    return mins + " min";
  },

  fmtRemaining(plannedEndMin, nowMin) {
    const diff = plannedEndMin - nowMin;
    const { fmtDur } = window.TodayTasksUtils;
    if (diff >= 0) return { text: "quedan " + fmtDur(diff), overrun: false };
    return { text: "excedida " + fmtDur(-diff), overrun: true };
  },

  timeToMinutes(str) {
    if (!str) return null;
    const [h, m] = str.split(":").map(Number);
    return h * 60 + m;
  },

  getTodayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  formatDateFriendly(dateStr) {
    if (!dateStr) return "";
    const today = window.TodayTasksUtils.getTodayStr();
    if (dateStr === today) return "Hoy";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const daysWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${daysWeek[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
  },

  addDays(dateStr, days) {
    const parts = dateStr.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  diffDays(dateStr1, dateStr2) {
    const p1 = dateStr1.split("-").map(Number);
    const p2 = dateStr2.split("-").map(Number);
    const d1 = Date.UTC(p1[0], p1[1] - 1, p1[2]);
    const d2 = Date.UTC(p2[0], p2[1] - 1, p2[2]);
    return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
  }
};


