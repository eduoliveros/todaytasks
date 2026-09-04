# Revisión de Estructura del Proyecto

> Análisis de la organización, calidad y puntos de mejora del repositorio.
> Fecha: 2026-09-04

---

## 1. Valoración General

La estructura del proyecto es **sólida y bien documentada**. Entre los puntos fuertes destacan:

- **Separación clara de responsabilidades** entre acciones (`js/actions/`) y vistas (`js/views/`), con las reglas explícitas de que las vistas no mutan el estado y las acciones no tocan el DOM.
- **Inyección de dependencias vía contexto (`ctx`)**, que desacopla los módulos y hace el código 100% testeable.
- **Flujo unidireccional de datos** bien definido: evento → acción → estado (`wrapState`) → persistencia → renderizado.
- **Documentación excepcional**: `ARCHITECTURE.md`, `DATA_SCHEMA.md`, ADRs, `CHANGELOG.md` y catálogo de features.
- **Amplia cobertura de pruebas** unitarias, de integración y E2E (Vitest + Playwright).
- **Internacionalización (i18n)** modular y bien organizada.

La arquitectura conceptual es correcta; el principal riesgo detectado es el crecimiento desmedido de `js/app.js`, que está absorbiendo lógica de presentación que debería vivir en submódulos.

---

## 2. Puntos de Mejora

### 2.1. `js/app.js` se ha convertido en un "god file" (1.456 líneas)

El orquestador principal contiene tanto inicialización como lógica de vista/DOM que no le corresponde:

- Popovers de tiempo (`openTimePopover`), inicio mínimo (`openStartAfterPopover`) y recurrencia (`openRecurringInfoPopover`).
- Dropdown de urgencia (`openUrgencyDropdown`, `openFormUrgencyDropdown`, `selectTaskUrgency`).
- Prompts de métricas de historial (`promptAddHistoryMetric`, `editHistoryMetricPrompt`).
- Inserción de markdown en notas (`insertFormNotesFormat`, `insertFormNotesLink`, etc.).

**Propuesta:** extraer esta lógica a `js/app/`, siguiendo el patrón ya existente (`forms.js`, `shortcuts.js`, `weekly-schedule.js`):

```
js/app/
├── forms.js
├── shortcuts.js
├── weekly-schedule.js
├── popovers.js          # Popovers de tiempo, startAfter y recurrencia
├── urgency-dropdown.js  # Selector de urgencia estilo Linear
└── history-metrics.js   # Prompts de métricas de historial
```

### 2.2. Código duplicado de posicionamiento de popovers

El cálculo de `left`/`top` con ajuste al viewport se repite casi idéntico en cinco sitios:

| Método | Ubicación |
| --- | --- |
| `openTimePopover` | `js/app.js:606` |
| `openStartAfterPopover` | `js/app.js:680` |
| `openRecurringInfoPopover` | `js/app.js:813` |
| `openUrgencyDropdown` | `js/app.js:1234` |
| `openFormUrgencyDropdown` | `js/app.js:1317` |

**Propuesta:** crear un helper compartido, por ejemplo:

```js
// js/ui.js
function positionPopover(target, popover, { width, height, gap = 6 })
```

que calcule `left`, `top`, recorte contra el viewport y devuelva las coordenadas, eliminando la duplicación.

### 2.3. `urgencyMap` duplicado

El mapa de urgencias (`today`/`days`/`week`/`later` con icono, etiqueta y clase CSS) está definido dos veces dentro de `selectTaskUrgency`:

- `js/app.js:1269`
- `js/app.js:1280`

**Propuesta:** extraerlo a una constante única y exportada (p. ej. en `js/utils.js` o en el propio submódulo de urgencia), y reutilizarla en ambos sitios.

### 2.4. Inconsistencia en la carga de CSS

- `css/styles.css` se presenta como "Master Aggregator" pero **no** importa `pip.css`, que se carga aparte en `index.html`. El agregador está incompleto.
- Los parámetros de cache-busting (`?v=`) están desincronizados:
  - `css/styles.css?v=1.78`
  - `css/pip.css?v=1.96`
  - `js/app.js?v=1.96`

Esto puede servir CSS/JS obsoletos pese a las cabeceras `no-cache` del servidor.

**Propuesta:** unificar el mecanismo de versión (p. ej. un único `?v=` generado a partir de `version.json`) e incluir `pip.css` en el agregador o documentar por qué se excluye.

### 2.5. `package.json` referencia un archivo inexistente

```json
"main": "index.js"
```

No existe tal archivo (solo `server.js` y `js/app.js`). Limpieza menor del manifiesto.

### 2.6. Prompts de métricas de historial fuera del sistema i18n

`promptAddHistoryMetric` y `editHistoryMetricPrompt` (`js/app.js:447-495`) usan `window.prompt` encadenado y texto en español hardcodeado, sin pasar por `t(...)`. Esto:

- Rompe el sistema de internacionalización (el resto de la app está traducida).
- Ofrece una UX pobre (múltiples prompts secuenciales).

**Propuesta:** reemplazar por un modal accesible con campos etiquetados e i18n, o al menos traducir los textos vía `t(...)`.

---

## 3. Priorización Sugerida

| Prioridad | Acción | Impacto |
| --- | --- | --- |
| Alta | Extraer popovers/dropdown de urgencia de `app.js` a `js/app/` | Mantenibilidad |
| Alta | Crear `positionPopover()` y eliminar duplicación | Reducción de bugs |
| Media | Unificar versión de cache-busting y agregador CSS | Corrección de caché |
| Media | Traducir/rediseñar prompts de historial | Consistencia i18n |
| Baja | Eliminar `"main": "index.js"` de `package.json` | Limpieza |
| Baja | Consolidar `urgencyMap` en una constante | DRY |
