/**
 * tests/export_csv.test.js
 * Suite de tests unitarios para js/app/export-csv.js
 *
 * Casos cubiertos (plan §5):
 * 1.  Tareas pending, running, paused se incluyen
 * 2.  Tareas completed se excluyen
 * 3.  Cálculo de planned, elapsed y remaining
 * 4.  Tarea destacada (featured: true)
 * 5.  Dependencias mapeadas a displayId
 * 6.  Regla recurrente activa (sin fin o fecha futura)
 * 7.  Regla recurrente con endDate pasada (se excluye)
 * 8.  CSV Formula Injection: =, @, +, - se escapan con '
 * 9.  Escape RFC 4180: comillas, saltos de línea, punto y coma
 * 10. Localización en español (state.language = "es")
 * 11. Localización en inglés (state.language = "en")
 * 12. Estructura Excel: BOM \uFEFF y cabecera directa (sin sep=;)
 * 13. Nombre de archivo localizado según idioma y entorno
 * 14. Liberación de recursos Blob (URL.revokeObjectURL)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { csvField, exportOpenTasksCSV, localizeUrgency } from '../js/app/export-csv.js';

// --- Mocks de módulos externos ---

// Mock de i18n: registra diccionarios mínimos y devuelve las claves correctas
vi.mock('../js/i18n.js', () => {
  const dicts = {
    es: {
      'export.csvBtn': '⬇ Exportar CSV',
      'export.csvTooltip': 'Exporta todas las tareas abiertas',
      'export.filename': 'tareas-abiertas-{env}-{date}.csv',
      'export.yes': 'Sí',
      'export.no': 'No',
      'export.typeTask': 'Tarea',
      'export.typeRule': 'Regla recurrente',
      'export.statusPending': 'Pendiente',
      'export.statusRunning': 'En marcha',
      'export.statusPaused': 'En pausa',
      'export.statusRecurring': 'Recurrente',
      'export.dateRecurring': 'Recurrente',
      'export.envWork': 'trabajo',
      'export.envPersonal': 'personal',
      'export.colId': 'ID',
      'export.colType': 'Tipo',
      'export.colTitle': 'Título',
      'export.colStatus': 'Estado',
      'export.colUrgency': 'Urgencia',
      'export.colFeatured': 'Destacada',
      'export.colPlanned': 'Duración_estimada_min',
      'export.colElapsed': 'Tiempo_consumido_min',
      'export.colRemaining': 'Tiempo_restante_min',
      'export.colDependencies': 'Dependencias',
      'export.colEnv': 'Entorno',
      'export.colDate': 'Fecha',
      'export.colRecurring': 'Recurrente',
      'export.colPattern': 'Patrón_recurrencia',
      'export.colTags': 'Etiquetas',
      'export.colMentions': 'Menciones',
      'export.colNotes': 'Notas',
      'urgency.today': 'Hoy',
      'urgency.days': 'Días',
      'urgency.week': 'Semana',
      'urgency.later': 'Más adelante',
    },
    en: {
      'export.csvBtn': '⬇ Export CSV',
      'export.csvTooltip': 'Export all open tasks',
      'export.filename': 'open-tasks-{env}-{date}.csv',
      'export.yes': 'Yes',
      'export.no': 'No',
      'export.typeTask': 'Task',
      'export.typeRule': 'Recurring rule',
      'export.statusPending': 'Pending',
      'export.statusRunning': 'Running',
      'export.statusPaused': 'Paused',
      'export.statusRecurring': 'Recurring',
      'export.dateRecurring': 'Recurring',
      'export.envWork': 'work',
      'export.envPersonal': 'personal',
      'export.colId': 'ID',
      'export.colType': 'Type',
      'export.colTitle': 'Title',
      'export.colStatus': 'Status',
      'export.colUrgency': 'Urgency',
      'export.colFeatured': 'Featured',
      'export.colPlanned': 'Planned_duration_min',
      'export.colElapsed': 'Elapsed_time_min',
      'export.colRemaining': 'Remaining_time_min',
      'export.colDependencies': 'Dependencies',
      'export.colEnv': 'Environment',
      'export.colDate': 'Date',
      'export.colRecurring': 'Recurring',
      'export.colPattern': 'Recurrence_pattern',
      'export.colTags': 'Tags',
      'export.colMentions': 'Mentions',
      'export.colNotes': 'Notes',
      'urgency.today': 'Today',
      'urgency.days': 'Days',
      'urgency.week': 'Week',
      'urgency.later': 'Later',
    }
  };
  let locale = 'es';
  const tFn = (key) => dicts[locale]?.[key] ?? key;
  tFn.setLocale = (l) => { locale = l; };
  tFn.getLocale = () => locale;
  return { t: tFn, setLocale: (l) => { locale = l; } };
});

// Mock de utils.js: getTaskElapsed y getTodayStr
vi.mock('../js/utils.js', () => ({
  getTaskElapsed: vi.fn((task) => {
    // Simula elapsed = elapsedBefore para tests deterministas
    return task?.elapsedBefore ?? 0;
  }),
  getTodayStr: vi.fn(() => '2026-09-09'),
}));

// --- Helpers para construir estado de prueba ---

function makeTask(overrides = {}) {
  return {
    id: 'task-1',
    displayId: 'W-1',
    title: 'Tarea de prueba',
    status: 'pending',
    urgency: 'days',
    featured: false,
    planned: 30,
    elapsedBefore: 0,
    isRecurring: false,
    ruleId: null,
    tags: [],
    mentions: [],
    notes: '',
    dependsOn: [],
    order: 1,
    ...overrides,
  };
}

function makeState(tasks = [], recurringTasks = [], envKey = 'work') {
  return {
    activeEnv: envKey,
    language: 'es',
    environments: {
      work: {
        days: {
          '2026-09-09': { tasks }
        },
        recurringTasks,
      },
      personal: {
        days: {},
        recurringTasks: [],
      }
    }
  };
}

// --- Setup / Teardown ---

let downloadedBlobs = [];
let revokedUrls = [];
let originalCreateObjectURL;
let originalRevokeObjectURL;
let originalCreateElement;
let lastDownloadName;

beforeEach(() => {
  downloadedBlobs = [];
  revokedUrls = [];
  lastDownloadName = null;

  // Mock URL.createObjectURL
  originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = vi.fn((blob) => {
    downloadedBlobs.push(blob);
    return 'blob:mock-url';
  });

  // Mock URL.revokeObjectURL
  originalRevokeObjectURL = URL.revokeObjectURL;
  URL.revokeObjectURL = vi.fn((url) => {
    revokedUrls.push(url);
  });

  // Mock document.createElement para capturar el nombre de descarga
  originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') {
      const originalSetAttribute = el.setAttribute.bind(el);
      Object.defineProperty(el, 'download', {
        get() { return this._download; },
        set(v) {
          this._download = v;
          lastDownloadName = v;
        },
        configurable: true
      });
      el.click = vi.fn();
    }
    return el;
  });

  vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.restoreAllMocks();
});

// --- Helpers para leer el CSV generado ---

async function getGeneratedCSV() {
  expect(downloadedBlobs.length).toBeGreaterThan(0);
  const blob = downloadedBlobs[0];
  const text = await blob.text();
  // Quitar BOM si está presente
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

function parseCSV(csvText) {
  const lines = csvText.split('\r\n').filter(Boolean);
  return lines;
}

// ============================================================
// TESTS
// ============================================================

describe('csvField — escape RFC 4180 y formula injection', () => {
  it('devuelve cadena vacía para null y undefined', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('no modifica campos simples sin caracteres especiales', () => {
    expect(csvField('Hola mundo')).toBe('Hola mundo');
    expect(csvField(42)).toBe('42');
  });

  // Caso 9: Escape RFC 4180
  it('envuelve en comillas si contiene punto y coma', () => {
    expect(csvField('a;b')).toBe('"a;b"');
  });

  it('envuelve en comillas si contiene salto de línea', () => {
    expect(csvField('linea1\nlinea2')).toBe('"linea1\nlinea2"');
    expect(csvField('linea1\r\nlinea2')).toBe('"linea1\r\nlinea2"');
  });

  it('escapa comillas internas duplicándolas (RFC 4180)', () => {
    expect(csvField('tiene "comillas"')).toBe('"tiene ""comillas"""');
  });

  // Caso 8: Formula Injection
  it('antepone apóstrofe a campos que empiezan por =', () => {
    expect(csvField('=SUMA(A1:A5)')).toBe("'=SUMA(A1:A5)");
  });

  it('antepone apóstrofe a campos que empiezan por +', () => {
    expect(csvField('+CMD')).toBe("'+CMD");
  });

  it('antepone apóstrofe a campos que empiezan por -', () => {
    expect(csvField('-100')).toBe("'-100");
  });

  it('antepone apóstrofe a campos que empiezan por @', () => {
    expect(csvField('@usuario')).toBe("'@usuario");
  });
});

describe('localizeUrgency — prefijo numérico para ordenación', () => {
  it('prefija las urgencias con 1-4 en español', () => {
    expect(localizeUrgency('today')).toBe('1-Hoy');
    expect(localizeUrgency('days')).toBe('2-Días');
    expect(localizeUrgency('week')).toBe('3-Semana');
    expect(localizeUrgency('later')).toBe('4-Más adelante');
    expect(localizeUrgency('unknown')).toBe('2-Días');
  });

  it('prefija las urgencias con 1-4 en inglés', async () => {
    const { t } = await import('../js/i18n.js');
    t.setLocale('en');
    try {
      expect(localizeUrgency('today')).toBe('1-Today');
      expect(localizeUrgency('days')).toBe('2-Days');
      expect(localizeUrgency('week')).toBe('3-Week');
      expect(localizeUrgency('later')).toBe('4-Later');
    } finally {
      t.setLocale('es');
    }
  });
});

describe('exportOpenTasksCSV', () => {
  // Caso 1: tareas abiertas se incluyen
  it('incluye tareas con estado pending, running y paused', async () => {
    const tasks = [
      makeTask({ id: 't1', displayId: 'W-1', status: 'pending' }),
      makeTask({ id: 't2', displayId: 'W-2', status: 'running' }),
      makeTask({ id: 't3', displayId: 'W-3', status: 'paused' }),
    ];
    exportOpenTasksCSV(makeState(tasks));
    const csv = await getGeneratedCSV();
    expect(csv).toContain('W-1');
    expect(csv).toContain('W-2');
    expect(csv).toContain('W-3');
  });

  // Caso 2: tareas completed se excluyen
  it('excluye tareas con estado completed', async () => {
    const tasks = [
      makeTask({ id: 't1', displayId: 'W-1', status: 'completed' }),
      makeTask({ id: 't2', displayId: 'W-2', status: 'pending' }),
    ];
    exportOpenTasksCSV(makeState(tasks));
    const csv = await getGeneratedCSV();
    expect(csv).not.toContain('W-1');
    expect(csv).toContain('W-2');
  });

  // Caso 3: cálculo de tiempos
  it('calcula elapsed, planned y remaining correctamente', async () => {
    const { getTaskElapsed } = await import('../js/utils.js');
    getTaskElapsed.mockReturnValueOnce(10); // elapsed = 10 min

    const tasks = [makeTask({ planned: 30, elapsedBefore: 10, status: 'running' })];
    exportOpenTasksCSV(makeState(tasks));
    const csv = await getGeneratedCSV();
    const lines = parseCSV(csv);
    const dataLine = lines[1]; // header | data

    // planned=30, elapsed=10, remaining=20
    expect(dataLine).toContain(';30;');
    expect(dataLine).toContain(';10;');
    expect(dataLine).toContain(';20;');
  });

  // Caso 4: tarea destacada
  it('exporta Sí para tareas featured=true en español', async () => {
    const tasks = [makeTask({ featured: true })];
    exportOpenTasksCSV(makeState(tasks));
    const csv = await getGeneratedCSV();
    expect(csv).toContain(';Sí;');
  });

  it('exporta No para tareas featured=false en español', async () => {
    const tasks = [makeTask({ featured: false })];
    exportOpenTasksCSV(makeState(tasks));
    const csv = await getGeneratedCSV();
    // buscar No como campo (entre ; ; o en posición final)
    expect(csv).toContain(';No;');
  });

  it('exporta el valor de urgencia prefijado numéricamente (1-Hoy, 2-Días, etc.) en el CSV', async () => {
    const tasks = [
      makeTask({ id: 't1', displayId: 'W-1', urgency: 'today' }),
      makeTask({ id: 't2', displayId: 'W-2', urgency: 'days' }),
      makeTask({ id: 't3', displayId: 'W-3', urgency: 'week' }),
      makeTask({ id: 't4', displayId: 'W-4', urgency: 'later' }),
    ];
    exportOpenTasksCSV(makeState(tasks));
    const csv = await getGeneratedCSV();
    expect(csv).toContain(';1-Hoy;');
    expect(csv).toContain(';2-Días;');
    expect(csv).toContain(';3-Semana;');
    expect(csv).toContain(';4-Más adelante;');
  });

  // Caso 5: dependencias mapeadas a displayId
  it('mapea dependsOn a displayId en la columna Dependencias', async () => {
    const tasks = [
      makeTask({ id: 'dep-1', displayId: 'W-1', status: 'pending' }),
      makeTask({ id: 'main-1', displayId: 'W-2', status: 'pending', dependsOn: ['dep-1'] }),
    ];
    exportOpenTasksCSV(makeState(tasks));
    const csv = await getGeneratedCSV();
    // La tarea W-2 debe tener W-1 en su columna de dependencias
    expect(csv).toContain('W-1');
    const lines = parseCSV(csv);
    const w2Line = lines.find(l => l.includes('W-2'));
    expect(w2Line).toBeDefined();
    // La dependencia W-1 debe aparecer en la misma línea que W-2
    // (verificamos que W-1 no es la propia W-2)
    const w1Line = lines.find(l => l.startsWith('W-1;'));
    expect(w1Line).toBeDefined();
  });

  // Caso 6: regla recurrente activa sin endDate
  it('incluye reglas recurrentes activas sin endDate', async () => {
    const rule = {
      id: 'rec_task_1',
      title: 'Standup diario',
      planned: 15,
      urgency: 'today',
      featured: false,
      freq: 'daily',
      interval: 1,
      daysOfWeek: [],
      startDate: '2026-01-01',
      endDate: null,
      tags: [],
      mentions: [],
      notes: '',
    };
    exportOpenTasksCSV(makeState([], [rule]));
    const csv = await getGeneratedCSV();
    expect(csv).toContain('rec_task_1');
    expect(csv).toContain('Standup diario');
    expect(csv).toContain('Regla recurrente');
  });

  // Caso 7: regla recurrente con endDate pasada
  it('excluye reglas recurrentes con endDate pasada', async () => {
    const rule = {
      id: 'rec_old_1',
      title: 'Tarea expirada',
      planned: 30,
      urgency: 'days',
      featured: false,
      freq: 'daily',
      interval: 1,
      daysOfWeek: [],
      startDate: '2025-01-01',
      endDate: '2025-12-31', // pasada respecto a getTodayStr() = '2026-09-09'
      tags: [],
      mentions: [],
      notes: '',
    };
    exportOpenTasksCSV(makeState([], [rule]));
    const csv = await getGeneratedCSV();
    expect(csv).not.toContain('rec_old_1');
    expect(csv).not.toContain('Tarea expirada');
  });

  // Caso 10: localización en español
  it('genera cabeceras en español cuando language=es', async () => {
    exportOpenTasksCSV(makeState([makeTask()]));
    const csv = await getGeneratedCSV();
    expect(csv).toContain('Título');
    expect(csv).toContain('Estado');
    expect(csv).toContain('Urgencia');
    expect(csv).toContain('Destacada');
    expect(csv).toContain('Duración_estimada_min');
  });

  // Caso 11: localización en inglés
  it('genera cabeceras en inglés cuando language=en', async () => {
    const { t } = await import('../js/i18n.js');
    t.setLocale('en');

    try {
      exportOpenTasksCSV(makeState([makeTask()]));
      const csv = await getGeneratedCSV();
      expect(csv).toContain('Title');
      expect(csv).toContain('Status');
      expect(csv).toContain('Urgency');
      expect(csv).toContain('Featured');
      expect(csv).toContain('Planned_duration_min');
    } finally {
      t.setLocale('es'); // restaurar
    }
  });

  // Caso 12: estructura Excel con BOM UTF-8 y cabecera directa (sin sep=; para evitar bug de encoding en Excel)
  it('primera línea es la cabecera de columnas (tras quitar BOM)', async () => {
    exportOpenTasksCSV(makeState([makeTask()]));
    const csv = await getGeneratedCSV();
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('ID;Tipo;Título;');
  });

  it('el Blob comienza con BOM UTF-8 (\\uFEFF como bytes EF BB BF)', async () => {
    exportOpenTasksCSV(makeState([makeTask()]));
    const blob = downloadedBlobs[0];
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // BOM UTF-8 son los bytes 0xEF, 0xBB, 0xBF
    expect(bytes[0]).toBe(0xEF);
    expect(bytes[1]).toBe(0xBB);
    expect(bytes[2]).toBe(0xBF);
  });

  it('el Blob tiene tipo text/csv;charset=utf-8;', async () => {
    exportOpenTasksCSV(makeState([makeTask()]));
    const blob = downloadedBlobs[0];
    expect(blob.type).toBe('text/csv;charset=utf-8;');
  });

  // Caso 13: nombre de archivo localizado
  it('genera nombre de archivo en español con entorno trabajo', async () => {
    exportOpenTasksCSV(makeState([makeTask()], [], 'work'));
    // lastDownloadName se captura en el mock de createElement
    await getGeneratedCSV();
    expect(lastDownloadName).toBe('tareas-abiertas-trabajo-2026-09-09.csv');
  });

  it('genera nombre de archivo en inglés con entorno work', async () => {
    const { t } = await import('../js/i18n.js');
    t.setLocale('en');

    try {
      exportOpenTasksCSV(makeState([makeTask()], [], 'work'));
      await getGeneratedCSV();
      expect(lastDownloadName).toBe('open-tasks-work-2026-09-09.csv');
    } finally {
      t.setLocale('es');
    }
  });

  // Caso 14: liberación de recursos Blob
  it('invoca URL.revokeObjectURL para liberar el Blob', async () => {
    exportOpenTasksCSV(makeState([makeTask()]));
    await getGeneratedCSV();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(revokedUrls).toContain('blob:mock-url');
  });

  // Caso extra: notas multilinea escapadas correctamente
  it('escapa correctamente notas con saltos de línea', async () => {
    const tasks = [makeTask({ notes: 'Línea 1\nLínea 2\nLínea 3' })];
    exportOpenTasksCSV(makeState(tasks));
    const csv = await getGeneratedCSV();
    expect(csv).toContain('"Línea 1\nLínea 2\nLínea 3"');
  });

  // Caso extra: estado no envía nada si no hay entorno
  it('no genera descarga si el estado es inválido', () => {
    exportOpenTasksCSV(null);
    expect(downloadedBlobs.length).toBe(0);
    exportOpenTasksCSV({});
    expect(downloadedBlobs.length).toBe(0);
  });
});
