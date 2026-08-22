export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function getTaskElapsed(t) {
  if (!t) return 0;
  if (t.status === "completed") return Math.round((t.actualDuration || 0) * 10) / 10;
  let elapsed = t.elapsedBefore || 0;
  if (t.status === "running" && t.runningStart !== null) {
    const currentNow = nowMinutes();
    elapsed += Math.max(0, currentNow - t.runningStart);
  }
  return Math.round(elapsed * 10) / 10;
}

export function fmt(mins) {
  if (mins === null || mins === undefined || isNaN(mins) || typeof mins !== "number") return "";
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

export function fmtDur(mins) {
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return h + "h " + (m > 0 ? m + "min" : "");
  return mins + " min";
}

export function fmtRemaining(plannedEndMin, nowMin) {
  const diff = plannedEndMin - nowMin;
  if (diff >= 0) return { text: "quedan " + fmtDur(diff), overrun: false };
  return { text: "excedida " + fmtDur(-diff), overrun: true };
}

export function timeToMinutes(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

export function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateFriendly(dateStr) {
  if (!dateStr) return "";
  const today = getTodayStr();
  if (dateStr === today) return "Hoy";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const daysWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${daysWeek[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export function addDays(dateStr, days) {
  const parts = dateStr.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function diffDays(dateStr1, dateStr2) {
  const p1 = dateStr1.split("-").map(Number);
  const p2 = dateStr2.split("-").map(Number);
  const d1 = Date.UTC(p1[0], p1[1] - 1, p1[2]);
  const d2 = Date.UTC(p2[0], p2[1] - 1, p2[2]);
  return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
}

export function getDayOfWeek(dateStr) {
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay();
  return day === 0 ? 7 : day; // 1=Lunes ... 7=Domingo
}

export function getDayAbbr(dateStr) {
  if (!dateStr) return "";
  const dow = getDayOfWeek(dateStr);
  return ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][dow] || "";
}

export function getScheduleForDate(state, envKey, dateStr) {
  if (!dateStr) return { start: 9 * 60, end: 18 * 60, isFreeDay: false };
  const envKeyToUse = envKey || (state && state.activeEnv) || "work";
  const env = state && state.environments ? (state.environments[envKeyToUse] || state.environments.work) : null;
  const dow = getDayOfWeek(dateStr);

  if (env && env.weeklySchedule) {
    const rule = env.weeklySchedule[dow];
    if (rule === null) {
      return { start: null, end: null, isFreeDay: true };
    }
    if (rule && typeof rule.start === "number" && typeof rule.end === "number") {
      return { start: rule.start, end: rule.end, isFreeDay: false };
    }
  }

  const isPersonal = envKeyToUse === "personal";
  if (isPersonal) {
    if (dow >= 1 && dow <= 5) {
      return { start: 18 * 60, end: 23 * 60, isFreeDay: false };
    } else {
      return { start: 9 * 60, end: 23 * 60, isFreeDay: false };
    }
  } else {
    if (dow >= 1 && dow <= 5) {
      return { start: 9 * 60, end: 18 * 60, isFreeDay: false };
    } else {
      return { start: null, end: null, isFreeDay: true };
    }
  }
}

export function getStartOfWeekMonday(dateStr) {
  const parts = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d;
}

export function diffWeeks(dateStr1, dateStr2) {
  const mon1 = getStartOfWeekMonday(dateStr1);
  const mon2 = getStartOfWeekMonday(dateStr2);
  const diffMs = mon1.getTime() - mon2.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));
}

export function matchesRecurrenceRule(rule, dateStr) {
  if (!rule || !rule.startDate || dateStr < rule.startDate) return null;
  if (rule.endDate && dateStr > rule.endDate) return null;

  if (rule.exceptions && rule.exceptions[dateStr]) {
    const exc = rule.exceptions[dateStr];
    if (exc.type === "cancelled") return null;
    if (exc.type === "modified") {
      return {
        id: rule.id,
        title: exc.title || rule.title,
        start: exc.start !== undefined ? exc.start : rule.start,
        end: exc.end !== undefined ? exc.end : rule.end,
        isRecurring: true,
        isModifiedInstance: true,
        ruleId: rule.id,
        rule
      };
    }
  }

  const interval = rule.interval || 1;

  if (rule.freq === "daily") {
    const dDiff = diffDays(dateStr, rule.startDate);
    if (dDiff < 0 || dDiff % interval !== 0) return null;
  } else if (rule.freq === "weekly" || rule.freq === "custom_weeks") {
    const dow = getDayOfWeek(dateStr);
    if (!Array.isArray(rule.daysOfWeek) || !rule.daysOfWeek.includes(dow)) return null;
    const wDiff = diffWeeks(dateStr, rule.startDate);
    if (wDiff < 0 || wDiff % interval !== 0) return null;
  } else {
    return null;
  }

  return {
    id: rule.id,
    title: rule.title,
    start: rule.start,
    end: rule.end,
    isRecurring: true,
    isModifiedInstance: false,
    ruleId: rule.id,
    rule
  };
}

export function computeOccupiedMeetingTime(meetings) {
  if (!Array.isArray(meetings) || meetings.length === 0) return 0;
  const sorted = meetings
    .filter(m => m && typeof m.start === "number" && typeof m.end === "number" && m.end > m.start)
    .map(m => ({ start: m.start, end: m.end }))
    .sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return 0;

  const merged = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start <= prev.end) {
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }

  return merged.reduce((total, iv) => total + (iv.end - iv.start), 0);
}

export const TodayTasksUtils = {
  nowMinutes,
  getTaskElapsed,
  fmt,
  fmtDur,
  fmtRemaining,
  timeToMinutes,
  getTodayStr,
  formatDateFriendly,
  addDays,
  diffDays,
  getDayOfWeek,
  getDayAbbr,
  getScheduleForDate,
  getStartOfWeekMonday,
  diffWeeks,
  matchesRecurrenceRule,
  computeOccupiedMeetingTime
};

export default TodayTasksUtils;




