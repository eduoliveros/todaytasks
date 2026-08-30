export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function getTaskElapsed(t, nowVal) {
  if (!t) return 0;
  if (t.status === "completed") return Math.round((t.actualDuration ?? t.elapsedBefore ?? 0) * 10) / 10;
  let elapsed = t.elapsedBefore || 0;
  if (t.status === "running" && t.runningStart !== null && t.runningStart !== undefined) {
    if (nowVal !== undefined && nowVal !== null) {
      const currentNow = typeof nowVal === "function" ? nowVal() : nowVal;
      const diff = currentNow >= t.runningStart ? (currentNow - t.runningStart) : (1440 - t.runningStart + currentNow);
      elapsed += Math.max(0, diff);
    } else if (t.runningStartEpoch) {
      elapsed += Math.max(0, (Date.now() - t.runningStartEpoch) / 60000);
    } else {
      const currentNow = nowMinutes();
      const diff = currentNow >= t.runningStart ? (currentNow - t.runningStart) : (1440 - t.runningStart + currentNow);
      elapsed += Math.max(0, diff);
    }
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

export function parseDuration(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    return isNaN(val) ? null : val;
  }
  if (typeof val !== "string") return null;

  let s = val.trim().toLowerCase();
  if (!s) return null;

  // Reemplazar comas por puntos para números decimales (ej. 1,5h -> 1.5h)
  s = s.replace(',', '.');

  // Si es un número puro (ej. "45", "90", "1.5")
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
  }

  // Formato reloj HH:MM (ej. "1:30", "02:15")
  const hhmmMatch = s.match(/^(\d+):(\d{1,2})$/);
  if (hhmmMatch) {
    const hours = parseInt(hhmmMatch[1], 10);
    const mins = parseInt(hhmmMatch[2], 10);
    return hours * 60 + mins;
  }

  let totalMinutes = 0;
  let matched = false;

  // Horas: "1h", "1.5h", "1 hr", "1 hrs", "1 hora", "1 horas" (soporta "1h30m", "1h 30m", etc.)
  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:horas?|hrs?|h)(?=[^a-z]|$)/);
  if (hourMatch) {
    totalMinutes += parseFloat(hourMatch[1]) * 60;
    matched = true;
  }

  // Minutos: "30m", "30min", "30mins", "30 minuto", "30 minutos"
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:minutos?|mins?|m)(?=[^a-z]|$)/);
  if (minMatch) {
    totalMinutes += parseFloat(minMatch[1]);
    matched = true;
  }

  // Si solo especificó horas y un número sin unidad después (ej. "1h 30", "1h30")
  if (hourMatch && !minMatch) {
    const remainingAfterHour = s.slice(hourMatch.index + hourMatch[0].length).trim();
    const trailingMinMatch = remainingAfterHour.match(/^(\d+(?:\.\d+)?)$/);
    if (trailingMinMatch) {
      totalMinutes += parseFloat(trailingMinMatch[1]);
      matched = true;
    }
  }

  if (matched) {
    return Math.round(totalMinutes * 10) / 10;
  }

  return null;
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

export function normalizeSearchText(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesSearchQuery(text, query) {
  if (!query || typeof query !== "string") return true;
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (!text || typeof text !== "string") return false;
  const normalizedText = normalizeSearchText(text);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return tokens.every(token => normalizedText.includes(token));
}

export function getTaskSearchableText(task) {
  if (!task) return "";
  const parts = [];
  if (task.title) parts.push(task.title);

  // Urgencia (Hoy, Días, Semana, Más adelante)
  const urgency = task.urgency || DEFAULT_URGENCY;
  if (urgency === 'today') {
    parts.push('hoy today');
  } else if (urgency === 'days') {
    parts.push('dias dia días days');
  } else if (urgency === 'week') {
    parts.push('semana week');
  } else if (urgency === 'later') {
    parts.push('mas adelante más adelante adelante later');
  }
  if (URGENCY_LEVELS[urgency] && URGENCY_LEVELS[urgency].label) {
    parts.push(URGENCY_LEVELS[urgency].label);
  }

  // Destacada
  if (task.featured) {
    parts.push('destacada destacadas destacado destacados estrella star featured ⭐');
  }

  // Atributos adicionales
  if (task.isRecurring) {
    parts.push('recurrente recurring');
  }
  if (task.autoMoveToToday) {
    parts.push('pasar a hoy automove');
  }
  if (task.notes) {
    parts.push(task.notes);
  }

  return parts.join(" ");
}

export function matchesTaskSearch(task, query) {
  if (!query || typeof query !== "string") return true;
  if (!task) return false;
  const searchableText = getTaskSearchableText(task);
  return matchesSearchQuery(searchableText, query);
}

export const URGENCY_LEVELS = {
  today: { id: 'today', label: 'Hoy', shortLabel: 'Hoy', order: 1, icon: '🟠', color: '#F97316', bg: 'rgba(249, 115, 22, 0.12)' },
  days:  { id: 'days',  label: 'Días', shortLabel: 'Días', order: 2, icon: '🔵', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  week:  { id: 'week',  label: 'Semana', shortLabel: 'Semana', order: 3, icon: '🟣', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  later: { id: 'later', label: 'Más adelante', shortLabel: 'Más adelante', order: 4, icon: '⚪', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)' }
};

export const DEFAULT_URGENCY = 'days';
export const MAX_FEATURED_TASKS = 5;

export function getUrgencyWeight(urgency) {
  if (!urgency || !URGENCY_LEVELS[urgency]) return URGENCY_LEVELS[DEFAULT_URGENCY].order;
  return URGENCY_LEVELS[urgency].order;
}

export function compareTasksByPriority(a, b) {
  // Tarea en ejecución siempre va primera
  if (a.status === "running" && b.status !== "running") return -1;
  if (b.status === "running" && a.status !== "running") return 1;

  // 1. Urgencia (ascendente: Hoy(1) > Días(2) > Semana(3) > Más adelante(4))
  const uA = getUrgencyWeight(a.urgency);
  const uB = getUrgencyWeight(b.urgency);
  if (uA !== uB) return uA - uB;

  // 2. Destacado (true antes que false dentro del mismo grupo de urgencia)
  const fA = a.featured ? 1 : 0;
  const fB = b.featured ? 1 : 0;
  if (fA !== fB) return fB - fA;

  // 3. Orden manual / relativo
  return (a.order || 0) - (b.order || 0);
}

export function sortTasksByPriority(tasks) {
  if (!Array.isArray(tasks)) return [];
  const sorted = [...tasks].sort(compareTasksByPriority);
  sorted.forEach((t, i) => {
    t.order = i + 1;
  });
  return sorted;
}

export const TodayTasksUtils = {
  nowMinutes,
  getTaskElapsed,
  fmt,
  fmtDur,
  fmtRemaining,
  timeToMinutes,
  parseDuration,
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
  computeOccupiedMeetingTime,
  normalizeSearchText,
  matchesSearchQuery,
  getTaskSearchableText,
  matchesTaskSearch,
  URGENCY_LEVELS,
  DEFAULT_URGENCY,
  MAX_FEATURED_TASKS,
  getUrgencyWeight,
  compareTasksByPriority,
  sortTasksByPriority
};

export default TodayTasksUtils;




