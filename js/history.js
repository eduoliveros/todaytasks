(function () {
  "use strict";

  const { getTodayStr, formatDateFriendly, diffDays, fmtDur } = window.TodayTasksUtils;
  // TodayTasksUi is loaded after this file, so access lazily
  function escapeHtml(s) { return window.TodayTasksUi.escapeHtml(s); }
  function escapeAttr(s) { return window.TodayTasksUi.escapeAttr(s); }

  // Active series toggles for the chart
  let seriesToggles = {
    effectiveTime: true,
    meetingsTime: true,
    completedTasksTime: true,
    uncompletedTasksWorkedTime: true,
    uncompletedTasksNotWorkedTime: false,
    interruptionsTime: true
  };

  const SERIES_CONFIG = {
    effectiveTime: { label: "Tiempo Efectivo", color: "#3b82f6", strokeWidth: 3 },
    meetingsTime: { label: "Reuniones", color: "#8b5cf6", strokeWidth: 2 },
    completedTasksTime: { label: "Tareas Completadas", color: "#10b981", strokeWidth: 2 },
    uncompletedTasksWorkedTime: { label: "Trabajado en Pendientes", color: "#f59e0b", strokeWidth: 2 },
    uncompletedTasksNotWorkedTime: { label: "No Trabajado en Pendientes", color: "#9ca3af", strokeWidth: 1.5, dashed: true },
    interruptionsTime: { label: "Interrupciones", color: "#ef4444", strokeWidth: 2 }
  };

  function computeMetricsFromDay(dayData) {
    if (!dayData) {
      return {
        meetingsTime: 0,
        completedTasksTime: 0,
        uncompletedTasksWorkedTime: 0,
        uncompletedTasksNotWorkedTime: 0,
        interruptionsTime: 0,
        effectiveTime: 0
      };
    }

    const meetings = dayData.meetings || [];
    const tasks = dayData.tasks || [];
    const interruptions = dayData.interruptions || [];

    const meetingsTime = window.TodayTasksUtils.computeOccupiedMeetingTime(meetings);
    const completedTasksTime = tasks
      .filter(t => t.status === "completed")
      .reduce((sum, t) => sum + (t.actualDuration || t.planned || 0), 0);

    const uncompletedTasksWorkedTime = tasks
      .filter(t => t.status !== "completed")
      .reduce((sum, t) => sum + (t.elapsedBefore || 0), 0);

    const uncompletedTasksNotWorkedTime = tasks
      .filter(t => t.status !== "completed")
      .reduce((sum, t) => {
        const worked = t.elapsedBefore || 0;
        const remaining = Math.max(0, (t.planned || 0) - worked);
        return sum + remaining;
      }, 0);

    const interruptionsTime = interruptions.reduce((sum, i) => sum + (i.duration || 0), 0);
    const effectiveTime = meetingsTime + completedTasksTime + uncompletedTasksWorkedTime;

    return {
      meetingsTime,
      completedTasksTime,
      uncompletedTasksWorkedTime,
      uncompletedTasksNotWorkedTime,
      interruptionsTime,
      effectiveTime
    };
  }

  function snapshotAndPrune(state) {
    if (!state || !state.environments) return;
    const today = getTodayStr();

    ["work", "personal"].forEach(envKey => {
      const env = state.environments[envKey];
      if (!env) return;

      if (!env.days) env.days = {};
      if (!Array.isArray(env.history)) env.history = [];

      const historyMap = new Map();
      env.history.forEach(item => {
        if (item && item.date) {
          historyMap.set(item.date, { ...item });
        }
      });

      // Update history entries for all available days in days object
      Object.keys(env.days).forEach(dateStr => {
        const metrics = computeMetricsFromDay(env.days[dateStr]);
        historyMap.set(dateStr, {
          date: dateStr,
          meetingsTime: metrics.meetingsTime,
          completedTasksTime: metrics.completedTasksTime,
          uncompletedTasksWorkedTime: metrics.uncompletedTasksWorkedTime,
          uncompletedTasksNotWorkedTime: metrics.uncompletedTasksNotWorkedTime,
          interruptionsTime: metrics.interruptionsTime,
          effectiveTime: metrics.meetingsTime + metrics.completedTasksTime + metrics.uncompletedTasksWorkedTime
        });
      });

      // Always snapshot current day dynamically into history
      if (env.days[today]) {
        const todayMetrics = computeMetricsFromDay(env.days[today]);
        historyMap.set(today, { date: today, ...todayMetrics });
      }

      // Convert historyMap back to array, sorted by date ascending
      let historyArray = Array.from(historyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Limit history to last 40 days
      if (historyArray.length > 40) {
        historyArray = historyArray.slice(historyArray.length - 40);
      }
      env.history = historyArray;

      // Prune detailed days older than 10 days from today
      Object.keys(env.days).forEach(dateStr => {
        const diff = diffDays(today, dateStr);
        if (diff > 10) {
          delete env.days[dateStr];
        }
      });
    });
  }

  function saveHistoryMetric(state, dateStr, metrics) {
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey];
    if (!env) return;

    if (!Array.isArray(env.history)) env.history = [];
    let entry = env.history.find(h => h.date === dateStr);

    const meetingsTime = Math.max(0, parseInt(metrics.meetingsTime, 10) || 0);
    const completedTasksTime = Math.max(0, parseInt(metrics.completedTasksTime, 10) || 0);
    const uncompletedTasksWorkedTime = Math.max(0, parseInt(metrics.uncompletedTasksWorkedTime, 10) || 0);
    const uncompletedTasksNotWorkedTime = Math.max(0, parseInt(metrics.uncompletedTasksNotWorkedTime, 10) || 0);
    const interruptionsTime = Math.max(0, parseInt(metrics.interruptionsTime, 10) || 0);
    const effectiveTime = meetingsTime + completedTasksTime + uncompletedTasksWorkedTime;

    const updatedEntry = {
      date: dateStr,
      meetingsTime,
      completedTasksTime,
      uncompletedTasksWorkedTime,
      uncompletedTasksNotWorkedTime,
      interruptionsTime,
      effectiveTime
    };

    if (entry) {
      Object.assign(entry, updatedEntry);
    } else {
      env.history.push(updatedEntry);
    }

    env.history.sort((a, b) => a.date.localeCompare(b.date));
    if (env.history.length > 40) {
      env.history = env.history.slice(env.history.length - 40);
    }
  }

  function deleteHistoryMetric(state, dateStr) {
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey];
    if (!env || !Array.isArray(env.history)) return;
    env.history = env.history.filter(h => h.date !== dateStr);
  }

  function renderChart(historyArray) {
    if (!historyArray || historyArray.length === 0) {
      return `
        <div class="history-chart-empty">
          <p>No hay datos registrados en el histórico aún. Los datos se registrarán automáticamente a medida que uses la aplicación o añadas medidas manualmente abajo.</p>
        </div>
      `;
    }

    const width = 800;
    const height = 300;
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Determine max value for Y scale
    let maxVal = 60; // min 1 hour default
    historyArray.forEach(item => {
      Object.keys(SERIES_CONFIG).forEach(key => {
        if (seriesToggles[key] && typeof item[key] === "number") {
          if (item[key] > maxVal) maxVal = item[key];
        }
      });
    });
    maxVal = Math.ceil(maxVal / 30) * 30; // Round up to nearest 30 mins

    const getX = (idx) => {
      if (historyArray.length <= 1) return padding.left + chartW / 2;
      return padding.left + (idx / (historyArray.length - 1)) * chartW;
    };

    const getY = (val) => {
      return padding.top + chartH - (val / maxVal) * chartH;
    };

    // Horizontal Y grid lines
    const yStep = maxVal <= 180 ? 30 : maxVal <= 480 ? 60 : 120;
    let gridLines = "";
    for (let v = 0; v <= maxVal; v += yStep) {
      const y = getY(v);
      gridLines += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3" opacity="0.6"/>
        <text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${fmtDur(v)}</text>
      `;
    }

    // X axis labels
    const labelStep = Math.max(1, Math.ceil(historyArray.length / 8));
    let xLabels = "";
    historyArray.forEach((item, idx) => {
      if (idx % labelStep === 0 || idx === historyArray.length - 1) {
        const x = getX(idx);
        const parts = item.date.split("-");
        const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;
        xLabels += `
          <text x="${x}" y="${height - 10}" font-size="11" fill="var(--text-muted)" text-anchor="middle">${dateLabel}</text>
        `;
      }
    });

    // Render paths and dots for active series
    let seriesSvg = "";
    let dataPointsSvg = "";

    Object.keys(SERIES_CONFIG).forEach(seriesKey => {
      if (!seriesToggles[seriesKey]) return;
      const conf = SERIES_CONFIG[seriesKey];

      const points = historyArray.map((item, idx) => {
        const val = item[seriesKey] || 0;
        return { x: getX(idx), y: getY(val), val, date: item.date };
      });

      if (points.length > 0) {
        const pathD = points.reduce((acc, pt, i) => {
          return `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        }, "");

        const strokeDash = conf.dashed ? 'stroke-dasharray="4,4"' : "";
        seriesSvg += `<path d="${pathD}" fill="none" stroke="${conf.color}" stroke-width="${conf.strokeWidth}" ${strokeDash} stroke-linejoin="round" stroke-linecap="round"/>`;

        // Points
        points.forEach(pt => {
          dataPointsSvg += `
            <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4" fill="${conf.color}" stroke="#fff" stroke-width="1.5">
              <title>${conf.label} (${pt.date}): ${fmtDur(pt.val)}</title>
            </circle>
          `;
        });
      }
    });

    return `
      <div class="history-chart-wrapper">
        <svg viewBox="0 0 ${width} ${height}" class="history-svg-chart">
          ${gridLines}
          ${seriesSvg}
          ${dataPointsSvg}
          ${xLabels}
        </svg>
      </div>
    `;
  }

  function renderHistoryView(ctx) {
    const container = document.getElementById("view-history");
    if (!container) return;

    const state = ctx.getState();
    const envKey = state.activeEnv || "work";
    const env = state.environments[envKey] || {};
    const historyList = env.history || [];

    // Toggles HTML
    const togglesHtml = Object.keys(SERIES_CONFIG).map(key => {
      const conf = SERIES_CONFIG[key];
      const active = seriesToggles[key];
      return `
        <button class="series-pill ${active ? "active" : ""}"
                style="--series-color:${conf.color};"
                onclick="app.toggleHistorySeries('${key}')">
          <span class="series-dot" style="background:${conf.color}"></span>
          ${conf.label}
        </button>
      `;
    }).join("");

    // Calculate overall stats for 40-day summary cards
    const totalDays = historyList.length;
    const totalEffective = historyList.reduce((s, h) => s + (h.effectiveTime || 0), 0);
    const totalMeetings = historyList.reduce((s, h) => s + (h.meetingsTime || 0), 0);
    const totalCompleted = historyList.reduce((s, h) => s + (h.completedTasksTime || 0), 0);
    const totalInterruptions = historyList.reduce((s, h) => s + (h.interruptionsTime || 0), 0);

    const avgEffective = totalDays > 0 ? Math.round(totalEffective / totalDays) : 0;

    // Table rows of history
    const sortedHistory = [...historyList].sort((a, b) => b.date.localeCompare(a.date));
    const tableRowsHtml = sortedHistory.length > 0 ? sortedHistory.map(h => `
      <tr>
        <td><strong>${escapeHtml(h.date)}</strong> <span class="meta">(${formatDateFriendly(h.date)})</span></td>
        <td class="num-cell" style="color:var(--primary);font-weight:700;">${fmtDur(h.effectiveTime || 0)}</td>
        <td class="num-cell">${fmtDur(h.meetingsTime || 0)}</td>
        <td class="num-cell">${fmtDur(h.completedTasksTime || 0)}</td>
        <td class="num-cell">${fmtDur(h.uncompletedTasksWorkedTime || 0)}</td>
        <td class="num-cell" style="color:var(--text-muted)">${fmtDur(h.uncompletedTasksNotWorkedTime || 0)}</td>
        <td class="num-cell" style="color:var(--danger)">${fmtDur(h.interruptionsTime || 0)}</td>
        <td class="actions-cell">
          <button class="icon-btn" title="Editar medidas de este día" onclick="app.editHistoryMetricPrompt('${h.date}')">✎</button>
          <button class="icon-btn" title="Eliminar registro" onclick="app.deleteHistoryMetric('${h.date}')">✕</button>
        </td>
      </tr>
    `).join("") : `<tr><td colspan="8" class="empty">No hay registros almacenados.</td></tr>`;

    container.innerHTML = `
      <div class="history-view-layout">
        <div class="history-view-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <a href="#/" class="btn secondary">← Volver al Tablero</a>
            <h2>Histórico y Evolución (${envKey === "work" ? "Trabajo 💼" : "Personal 🏠"})</h2>
          </div>
          <button class="btn secondary" onclick="app.promptAddHistoryMetric()">+ Añadir/Editar Medida Manual</button>
        </div>

        <div class="history-summary-cards">
          <div class="history-card">
            <span class="card-label">Días registrados</span>
            <span class="card-value">${totalDays} / 40 días</span>
          </div>
          <div class="history-card">
            <span class="card-label">Media Tiempo Efectivo/día</span>
            <span class="card-value" style="color:#3b82f6">${fmtDur(avgEffective)}</span>
          </div>
          <div class="history-card">
            <span class="card-label">Total Reuniones</span>
            <span class="card-value" style="color:#8b5cf6">${fmtDur(totalMeetings)}</span>
          </div>
          <div class="history-card">
            <span class="card-label">Total Tareas Completadas</span>
            <span class="card-value" style="color:#10b981">${fmtDur(totalCompleted)}</span>
          </div>
          <div class="history-card">
            <span class="card-label">Total Interrupciones</span>
            <span class="card-value" style="color:#ef4444">${fmtDur(totalInterruptions)}</span>
          </div>
        </div>

        <div class="panel history-chart-panel">
          <div class="chart-header">
            <h3>Evolución de los últimos 40 días</h3>
            <div class="series-toggles">${togglesHtml}</div>
          </div>
          ${renderChart(historyList)}
        </div>

        <div class="panel history-table-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3>Detalle de Mediciones por Día</h3>
            <span class="meta">Las métricas se guardan hasta 40 días; el desglose detallado de tareas por 10 días.</span>
          </div>

          <div class="table-responsive">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th class="num-cell">Tiempo Efectivo</th>
                  <th class="num-cell">Reuniones</th>
                  <th class="num-cell">Completadas</th>
                  <th class="num-cell">Trabajado No Compl.</th>
                  <th class="num-cell">No Trabajado No Compl.</th>
                  <th class="num-cell">Interrupciones</th>
                  <th class="actions-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function toggleSeries(seriesKey) {
    if (seriesToggles[seriesKey] !== undefined) {
      seriesToggles[seriesKey] = !seriesToggles[seriesKey];
    }
  }

  window.TodayTasksHistory = {
    computeMetricsFromDay,
    snapshotAndPrune,
    saveHistoryMetric,
    deleteHistoryMetric,
    renderHistoryView,
    toggleSeries
  };
})();
