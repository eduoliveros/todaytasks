# Plan de Implementación: Exportación CSV de Tareas Abiertas

**Estado:** Aprobado para implementación  
**Fecha:** 2026-09-09  
**Versión objetivo:** v1.109 (base actual: v1.108)

---

## 1. Descripción

Añadir un botón **"⬇ Exportar CSV"** en el panel de Configuración (panel `3`, `#htab-config`), ubicado inmediatamente antes del botón `↻ Nuevo día`, que genere y descargue directamente en el navegador un archivo `.csv` con todas las tareas abiertas (estados `pending`, `running` o `paused`) del entorno activo, incluyendo las reglas maestras de tareas recurrentes.

El archivo generado será **100% compatible con Microsoft Excel** (sin requerir asistentes de importación) y se exportará en el **idioma activo de la aplicación (`state.language`: Español o English)**, traduciendo automáticamente cabeceras, tipos de registro, estados, urgencias, valores booleanos y el nombre del archivo.

---

## 2. Alcance

### Incluido
- Tareas con estado `pending`, `running` o `paused` de **todos los días retenidos** en `env.days` del entorno activo.
- **Reglas maestras de tareas recurrentes** (`env.recurringTasks`) activas (sin fecha de fin o con `endDate` futura).
- **Métricas de avance:** Inclusión del tiempo estimado (`planned`), tiempo ya consumido (`elapsed`) y tiempo restante (`remaining`).
- **Atributos de sistema:** Tarea destacada (`featured`), dependencias directas (`dependsOn` mapeadas a sus identificadores visibles `displayId`), etiquetas normalizadas (`tags`) y menciones (`mentions`).
- **Localización dinámica (i18n):** Cabeceras, valores enumerados y nombre del archivo generados según `state.language` (`es` / `en`).
- **Compatibilidad Excel europea:** Inclusión de BOM UTF-8 (`\uFEFF`) + directiva de delimitador `sep=;` en la primera línea + separador `;`.
- **Seguridad:** Protección activa contra inyección de fórmulas CSV (*CSV Formula Injection*) para caracteres `=`, `+`, `-`, `@`.
- **Descarga limpia en cliente:** Descarga nativa con `<a download>` y liberación inmediata de memoria con `URL.revokeObjectURL(url)`.

### Excluido
- Tareas de días anteriores ya podados de `env.days` (>10 días, archivados en `env.history`).
- Exportación del entorno inactivo (se exporta exclusivamente el entorno activo en el momento de la descarga).
- Exportación de reuniones, historial agregado o interrupciones.
- Formato XLSX binario (requeriría librerías externas pesadas).
- Importación de tareas desde CSV (posible mejora futura).

---

## 3. Formato CSV y Codificación

### Cabecera y codificación
```csv
\uFEFF[Cabecera localizada según idioma activo]
```
- `\uFEFF`: Byte Order Mark (BOM) UTF-8 al inicio del archivo para forzar a Excel a abrir el archivo con codificación UTF-8 pura (soporte nativo de acentos, eñes y caracteres especiales sin conflicto con la directiva `sep=`).
- Separador `;` nativo por compatibilidad regional europea y latinoamericana.

### Columnas y Mapeo de Datos

| # | Columna (ES) | Columna (EN) | Fuente (`Task` / `RecurringTaskRule`) | Formato / Valores |
|---|---|---|---|---|
| 1 | `ID` | `ID` | `task.displayId \|\| task.id` / `rule.id` | Identificador visible (`W-1`, `P-3`) o ID técnico |
| 2 | `Tipo` | `Type` | Tipo de entidad | `Tarea` / `Task` vs `Regla recurrente` / `Recurring rule` |
| 3 | `Título` | `Title` | `task.title` / `rule.title` | Texto plano sanitizado |
| 4 | `Estado` | `Status` | `task.status` | `Pendiente`/`Pending`, `En marcha`/`Running`, `En pausa`/`Paused`, `Recurrente`/`Recurring` |
| 5 | `Urgencia` | `Urgency` | `task.urgency` / `rule.urgency` | Prefijo numérico ordenable: `1-Hoy`/`1-Today`, `2-Días`/`2-Days`, `3-Semana`/`3-Week`, `4-Más adelante`/`4-Later` |
| 6 | `Destacada` | `Featured` | `task.featured` / `rule.featured` | `Sí`/`Yes`, `No`/`No` |
| 7 | `Duración_estimada_min` | `Planned_duration_min` | `task.planned` / `rule.planned` | Entero en minutos |
| 8 | `Tiempo_consumido_min` | `Elapsed_time_min` | `getTaskElapsed(task)` (o `0` para reglas) | Entero en minutos calculados en tiempo real |
| 9 | `Tiempo_restante_min` | `Remaining_time_min` | `Math.max(0, planned - elapsed)` | Entero en minutos restantes |
| 10 | `Dependencias` | `Dependencies` | Mapeo de `task.dependsOn` a `displayId` | `W-2, W-4` o vacío |
| 11 | `Entorno` | `Environment` | `state.activeEnv` | `Trabajo`/`Work` o `Personal`/`Personal` |
| 12 | `Fecha` | `Date` | Clave del día en `env.days` o `Recurrente` | `YYYY-MM-DD` o `Recurrente`/`Recurring` |
| 13 | `Recurrente` | `Recurring` | `task.isRecurring` | `Sí`/`Yes`, `No`/`No` |
| 14 | `Patrón_recurrencia` | `Recurrence_pattern` | Derivado de regla periódica | `daily:1`, `weekly:1:1,3,5` o vacío |
| 15 | `Etiquetas` | `Tags` | `(task.tags \|\| []).join(', ')` | Hashtags sin `#`, separados por comas |
| 16 | `Menciones` | `Mentions` | `(task.mentions \|\| []).join(', ')` | Menciones sin `@`, separadas por comas |
| 17 | `Notas` | `Notes` | `task.notes \|\| ''` | Markdown de notas, escapado en celda multilínea |

### Función de Escape y Sanitización (`csvField`)

Implementa el estándar RFC 4180 con protección contra inyección de fórmulas:

```javascript
export function csvField(value) {
  let str = value == null ? '' : String(value);
  
  // Mitigación de CSV Formula Injection en Excel:
  // Si comienza por =, +, -, @, anteponer apóstrofe para forzar tratamiento de texto plano
  if (/^[=+@\-]/.test(str)) {
    str = "'" + str;
  }
  
  // Escape RFC 4180: si contiene delimitador, comillas o saltos de línea, envolver entre comillas
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
```

---

## 4. Cambios en el Código

### 4.1. Nuevo módulo: `js/app/export-csv.js`

Función principal exportada:
```javascript
export function exportOpenTasksCSV(state)
```

**Flujo interno de ejecución:**
1. Determinar el entorno activo (`envKey = state.activeEnv || 'work'`) y su objeto `env`.
2. Crear un mapa de búsqueda de identificadores de dependencias (`id -> displayId || id`) a través de todas las tareas del entorno.
3. Recopilar tareas abiertas (`status !== 'completed'`) iterando por cada fecha en `env.days`, extrayendo:
   - Duración planificada (`t.planned`).
   - Minutos consumidos en tiempo real usando el helper del sistema `getTaskElapsed(t)`.
   - Minutos restantes calculados como `Math.max(0, t.planned - elapsed)`.
   - Identificadores de dependencias formateados como `t.dependsOn.map(depId => depMap.get(depId) || depId).join(', ')`.
4. Recopilar reglas periódicas activas de `env.recurringTasks` (sin `endDate` o con `endDate >= hoy`).
5. Generar las cabeceras traducidas mediante las claves i18n correspondientes al idioma actual de la sesión.
6. Construir las filas aplicando `csvField()` a cada celda.
7. Componer el Blob binario: `new Blob(['\uFEFFsep=;\n' + csvContent], { type: 'text/csv;charset=utf-8;' })`.
8. Generar el nombre de archivo localizado:
   - ES: `tareas-abiertas-${envName}-${fechaActual}.csv` (ej. `tareas-abiertas-trabajo-2026-09-09.csv`).
   - EN: `open-tasks-${envName}-${fechaActual}.csv` (ej. `open-tasks-work-2026-09-09.csv`).
9. Desencadenar la descarga mediante un enlace temporal `<a>` y ejecutar `URL.revokeObjectURL(url)` para evitar fugas de memoria.

### 4.2. `index.html`

Ubicar el botón **inmediatamente antes** de `#newDayBtn` en el panel de Configuración (`#htab-config`):

```html
      <!-- Botón de exportación CSV antes de Nuevo día -->
      <button class="btn secondary" id="exportCsvBtn"
        data-i18n-title="export.csvTooltip"
        data-i18n="export.csvBtn"
        title="Exporta todas las tareas abiertas a un archivo CSV compatible con Excel">
        ⬇ Exportar CSV
      </button>
      <button class="btn secondary" id="newDayBtn" data-i18n-title="config.newDayTooltip" data-i18n="config.newDay" title="Borra reuniones y tareas del día seleccionado para empezar de cero">↻ Nuevo día</button>
```

### 4.3. `js/app.js`

Importar y vincular en el arranque de la interfaz dentro del panel de configuración:

```javascript
import { exportOpenTasksCSV } from './app/export-csv.js';

// En el bloque de listeners de configuración:
const exportCsvBtn = document.getElementById('exportCsvBtn');
if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => {
    exportOpenTasksCSV(state);
  });
}
```

### 4.4. Diccionarios de Idioma (`js/i18n/es.js` y `js/i18n/en.js`)

#### En `js/i18n/es.js`:
```javascript
  // Exportación CSV
  'export.csvBtn': '⬇ Exportar CSV',
  'export.csvTooltip': 'Exporta todas las tareas abiertas (incluidas recurrentes) a un archivo CSV compatible con Excel',
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
```

#### En `js/i18n/en.js`:
```javascript
  // CSV Export
  'export.csvBtn': '⬇ Export CSV',
  'export.csvTooltip': 'Export all open tasks (including recurring) to an Excel-compatible CSV file',
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
```

---

## 5. Batería de Pruebas Unitarias (`tests/export_csv.test.js`)

Se creará la suite completa en `tests/export_csv.test.js` con las siguientes validaciones:

| # | Caso de Prueba | Resultado Esperado |
|---|---|---|
| 1 | Tareas con estados `pending`, `running`, `paused` | Todas se incluyen en el archivo resultante |
| 2 | Tarea con estado `completed` | Se excluye estrictamente del CSV |
| 3 | Cálculo de tiempos (`planned`, `elapsed`, `remaining`) | `elapsed` refleja tiempo consumido y `remaining` refleja la resta exacta |
| 4 | Tarea destacada (`featured: true`) | Columna refleja `Sí` (es) o `Yes` (en) |
| 5 | Tareas con dependencias (`dependsOn`) | Columna exporta la lista de `displayId` separados por coma |
| 6 | Regla recurrente activa (sin fin o fecha futura) | Aparece con `Tipo = Regla recurrente` y `Fecha = Recurrente` |
| 7 | Regla recurrente con fecha de fin expirada | No aparece en el archivo exportado |
| 8 | Mitigación de CSV Formula Injection (`=`, `@`, `+`, `-`) | Se antepone `'` para forzar valor literal |
| 9 | Escape RFC 4180 de comillas dobles, saltos de línea y punto y coma | Envueltas entre comillas y comillas escapadas como `""` |
| 10 | Generación localizada en Español (`state.language = "es"`) | Cabeceras y valores traducidos al español |
| 11 | Generación localizada en Inglés (`state.language = "en"`) | Cabeceras y valores traducidos al inglés |
| 12 | Estructura de cabecera Excel | Primera línea comienza exactamente con `sep=;` y Blob con BOM `\uFEFF` |
| 13 | Nombre del archivo generado | Formato dinámico localizado según entorno y fecha actual |
| 14 | Liberación de recursos Blob | Invocación confirmada de `URL.revokeObjectURL` |

---

## 6. Orden de Implementación

1. Crear el módulo `js/app/export-csv.js` implementando `csvField` y `exportOpenTasksCSV`.
2. Añadir las claves de traducción en `js/i18n/es.js` y `js/i18n/en.js`.
3. Crear y ejecutar la suite unitaria `tests/export_csv.test.js` y verificar paridad i18n (`npm test`).
4. Añadir el botón `#exportCsvBtn` en `index.html` antes de `#newDayBtn`.
5. Registrar el listener en `js/app.js`.
6. Realizar prueba visual y funcional en el navegador:
   - Exportar con idioma español y validar en Excel.
   - Conmutar a idioma inglés, exportar y verificar cabeceras en inglés.
7. Incrementar versión a **`v1.109`** en `index.html` y `version.json`.
8. Documentar los cambios en `CHANGELOG.md` y actualizar `docs/ARCHITECTURE.md`.

---

## 7. Decisión de Arquitectura

Esta funcionalidad es una extensión de presentación y utilidad cliente. No altera la estructura de persistencia ni modifica `docs/DATA_SCHEMA.md`. No requiere un ADR independiente.

---

## 8. Fuera de Alcance (Backlog Futuro)

- **Exportación simultánea de ambos entornos:** Exportar Trabajo y Personal juntos en un solo archivo con columna de diferenciación.
- **Exportación XLSX con estilos:** Formato nativo de hojas de cálculo con colores por nivel de urgencia y formato condicional (requeriría librería externa).
- **Importación masiva desde CSV:** Posibilidad de cargar tareas al tablero leyendo un archivo CSV.
- **Exportación de Historial:** Descarga de métricas acumuladas de la pestaña Historial (`env.history`) en un CSV independiente.
