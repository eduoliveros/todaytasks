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
  }
};

