/**
 * export-csv.js — Módulo de exportación de tareas abiertas a CSV compatible con Excel.
 *
 * Genera un archivo .csv con:
 *   - BOM UTF-8 (\uFEFF) para detección automática de codificación en Excel (tildes y eñes)
 *   - Separador `;` (estándar europeo/latinoamericano)
 *   - Cabeceras y valores localizados según el idioma activo (state.language)
 *   - Escape RFC 4180 (campos con `;`, `"`, `\n` entre comillas dobles)
 *   - Mitigación de CSV Formula Injection (`=`, `+`, `-`, `@`)
 *
 * Fuentes exportadas:
 *   1. Tareas con estado pending/running/paused de env.days (todos los días retenidos)
 *   2. Reglas maestras de tareas recurrentes activas (env.recurringTasks)
 */

import { getTaskElapsed, getTodayStr } from '../utils.js';
import { t } from '../i18n.js';

/**
 * Escapa un valor de celda según RFC 4180 con protección contra formula injection.
 * @param {*} value
 * @returns {string}
 */
export function csvField(value) {
  let str = value == null ? '' : String(value);

  // Mitigación de CSV Formula Injection en Excel:
  // Si comienza por =, +, -, @, anteponer apóstrofe para forzar tratamiento como texto plano.
  if (/^[=+@\-]/.test(str)) {
    str = "'" + str;
  }

  // Escape RFC 4180: si contiene delimitador, comillas o saltos de línea, envolver entre comillas.
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Traduce el nivel de urgencia al idioma activo con prefijo numérico (1-4)
 * para permitir una ordenación natural por prioridad en hojas de cálculo.
 * @param {string} urgency
 * @returns {string}
 */
export function localizeUrgency(urgency) {
  const map = {
    today: `1-${t('urgency.today')}`,
    days:  `2-${t('urgency.days')}`,
    week:  `3-${t('urgency.week')}`,
    later: `4-${t('urgency.later')}`
  };
  return map[urgency] || `2-${t('urgency.days')}`;
}

/**
 * Construye la cadena del patrón de recurrencia para una regla.
 * Formato: `freq:interval` o `freq:interval:days` (ej. `weekly:1:1,3,5`)
 * @param {Object} rule
 * @returns {string}
 */
function buildRecurrencePattern(rule) {
  if (!rule || !rule.freq) return '';
  const freq = rule.freq;
  const interval = rule.interval || 1;
  if (freq === 'daily') {
    return `daily:${interval}`;
  }
  if (freq === 'weekly' || freq === 'custom_weeks') {
    const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek.join(',') : '';
    return `weekly:${interval}:${days}`;
  }
  return `${freq}:${interval}`;
}

/**
 * Genera y descarga un CSV con todas las tareas abiertas del entorno activo.
 * @param {Object} state — Estado global de la aplicación (resultado de wrapState)
 */
export function exportOpenTasksCSV(state) {
  if (!state || !state.environments) return;

  const envKey = state.activeEnv || 'work';
  const env = state.environments[envKey];
  if (!env) return;

  const today = getTodayStr();

  // --- 1. Mapa id -> displayId para resolver dependencias ---
  const depMap = new Map();
  if (env.days && typeof env.days === 'object') {
    for (const dayObj of Object.values(env.days)) {
      if (dayObj && Array.isArray(dayObj.tasks)) {
        for (const task of dayObj.tasks) {
          if (task && task.id) {
            depMap.set(String(task.id), task.displayId || task.id);
          }
        }
      }
    }
  }

  // --- 2. Cabeceras localizadas ---
  const headers = [
    t('export.colId'),
    t('export.colType'),
    t('export.colTitle'),
    t('export.colStatus'),
    t('export.colUrgency'),
    t('export.colFeatured'),
    t('export.colPlanned'),
    t('export.colElapsed'),
    t('export.colRemaining'),
    t('export.colDependencies'),
    t('export.colEnv'),
    t('export.colDate'),
    t('export.colRecurring'),
    t('export.colPattern'),
    t('export.colTags'),
    t('export.colMentions'),
    t('export.colNotes'),
  ];

  const rows = [];

  // --- 3. Tareas abiertas de env.days ---
  if (env.days && typeof env.days === 'object') {
    const sortedDates = Object.keys(env.days).sort();
    for (const dateStr of sortedDates) {
      const dayObj = env.days[dateStr];
      if (!dayObj || !Array.isArray(dayObj.tasks)) continue;

      for (const task of dayObj.tasks) {
        if (!task) continue;
        if (task.status === 'completed') continue; // solo abiertas

        const elapsed = Math.round(getTaskElapsed(task) * 10) / 10;
        const planned = typeof task.planned === 'number' ? task.planned : 0;
        const remaining = Math.max(0, Math.round((planned - elapsed) * 10) / 10);

        const deps = Array.isArray(task.dependsOn) && task.dependsOn.length > 0
          ? task.dependsOn.map(id => depMap.get(String(id)) || id).join(', ')
          : '';

        const envName = t(envKey === 'work' ? 'export.envWork' : 'export.envPersonal');
        const pattern = task.ruleId
          ? buildRecurrencePattern(
              Array.isArray(env.recurringTasks)
                ? env.recurringTasks.find(r => r && r.id === task.ruleId)
                : null
            )
          : '';

        let statusKey = 'export.statusPending';
        if (task.status === 'running') statusKey = 'export.statusRunning';
        else if (task.status === 'paused')  statusKey = 'export.statusPaused';

        rows.push([
          csvField(task.displayId || task.id),
          csvField(t('export.typeTask')),
          csvField(task.title),
          csvField(t(statusKey)),
          csvField(localizeUrgency(task.urgency)),
          csvField(task.featured ? t('export.yes') : t('export.no')),
          csvField(planned),
          csvField(elapsed),
          csvField(remaining),
          csvField(deps),
          csvField(envName),
          csvField(dateStr),
          csvField(task.isRecurring ? t('export.yes') : t('export.no')),
          csvField(pattern),
          csvField((task.tags || []).join(', ')),
          csvField((task.mentions || []).join(', ')),
          csvField(task.notes || ''),
        ]);
      }
    }
  }

  // --- 4. Reglas de tareas recurrentes activas ---
  if (Array.isArray(env.recurringTasks)) {
    for (const rule of env.recurringTasks) {
      if (!rule) continue;
      // Excluir reglas con endDate pasada
      if (rule.endDate && rule.endDate < today) continue;

      const pattern = buildRecurrencePattern(rule);
      const envName = t(envKey === 'work' ? 'export.envWork' : 'export.envPersonal');

      rows.push([
        csvField(rule.id),
        csvField(t('export.typeRule')),
        csvField(rule.title),
        csvField(t('export.statusRecurring')),
        csvField(localizeUrgency(rule.urgency)),
        csvField(rule.featured ? t('export.yes') : t('export.no')),
        csvField(typeof rule.planned === 'number' ? rule.planned : 0),
        csvField(0), // elapsed: n/a para reglas
        csvField(typeof rule.planned === 'number' ? rule.planned : 0), // remaining = planned para reglas
        csvField(''), // dependencias: n/a
        csvField(envName),
        csvField(t('export.dateRecurring')),
        csvField(t('export.yes')),
        csvField(pattern),
        csvField((rule.tags || []).join(', ')),
        csvField((rule.mentions || []).join(', ')),
        csvField(rule.notes || ''),
      ]);
    }
  }

  // --- 5. Construir contenido CSV ---
  const sep = ';';
  const headerLine = headers.join(sep);
  const dataLines = rows.map(row => row.join(sep));
  const csvContent = [headerLine, ...dataLines].join('\r\n');

  // BOM UTF-8 + contenido
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });

  // --- 6. Nombre de archivo localizado ---
  const envSlug = t(envKey === 'work' ? 'export.envWork' : 'export.envPersonal');
  const filenameTpl = t('export.filename'); // ej. 'tareas-abiertas-{env}-{date}.csv'
  const filename = filenameTpl
    .replace('{env}', envSlug)
    .replace('{date}', today);

  // --- 7. Descargar ---
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
