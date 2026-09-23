# 024. Modularización de la Vista de Triaje Rápido (`js/views/triage/`)

* **Fecha:** 2026-09-23
* **Estado:** Aceptado

## Contexto

Con la evolución funcional de la vista de triaje (`#/triage`) —que incorporó soporte táctil mobile, long-press, bottom sheets, reordenación masiva por bloques, historial local de Undo/Redo, buscador multi-token con autocompletado y creación unificada de tareas recurrentes—, el fichero `js/views/triage.js` creció hasta alcanzar los **95 KB y casi 2.000 líneas de código**.

Este tamaño presentaba importantes inconvenientes:
- Elevado coste cognitivo para el mantenimiento y depuración.
- Riesgo de regresiones colaterales al modificar funcionalidades específicas (ej. drag & drop o renderizado).
- Dificultad para que múltiples agentes o desarrolladores trabajen en paralelo sobre la vista.

## Alternativas Consideradas

* **Alternativa A (Subdirectorio `js/views/triage/` con módulos por responsabilidad):**
  Crear una carpeta `js/views/triage/` y dividir las funciones por área funcional (datos, renderizado, eventos, drag & drop, batch actions, modal), dejando un coordinador `index.js` y una fachada en `js/views/triage.js` para compatibilidad retroactiva.
* **Alternativa B (Módulos planos en la raíz de `js/views/`):**
  Crear archivos como `js/views/triage-data.js`, `js/views/triage-render.js`, etc. Descartada por dispersar los archivos de una misma vista en la raíz de vistas junto a `dashboard.js`, `tasks.js`, etc.
* **Alternativa C (Descomposición interna de `renderTriageView`):**
  Extraer la generación de componentes complejos (modal de edición, barra flotante, bottom sheet y actualización selectiva del DOM) fuera de la función principal de renderizado para simplificar el flujo reactivo.

## Decisión

Se optó por una combinación de **Alternativa A + Alternativa C**:

1. **Estructura en Directorio Dedicado (`js/views/triage/`):**
   - **`index.js` (Coordinador):** Mantiene el estado local (`selectedTaskIds`, `currentSort`, `collapsedGroups`, timers), instancia los submódulos con inyección de estado y dependencias, coordina el ciclo de vida de renderizado y expone el objeto público con ~54 métodos.
   - **`triage-data.js`:** Lógica de derivación de datos y agrupación (fechas, ordenación principal, agrupaciones por urgencia/viabilidad/duración/destacadas y colapsado de grupos).
   - **`triage-render.js`:** Componentes de renderizado visual (filas de tareas, chips de dependencias, contenedor de grupos, barra flotante, bottom sheet, sincronización de `#triageTaskEditModal` y actualización selectiva del DOM).
   - **`triage-batch.js`:** Gestión de selección múltiple, dropdowns contextuales, acciones por lote (mover fecha, urgencia, estrella, completar, borrar, reordenación direccional) y pila de Undo/Redo.
   - **`triage-dragdrop.js`:** Motor táctil de arrastre con long-press (`touchEngine`), controladores de eventos de arrastre HTML5 de escritorio y gestión del bottom sheet móvil.
   - **`triage-events.js`:** Controladores de eventos de usuario (clic simple, doble clic, atajos de teclado, búsqueda integrada y acciones individuales sobre tareas).
   - **`triage-task-modal.js`:** Modal de alta rápida de tareas, selector interactivo de recurrencias periódicas y barra rápida de entrada.

2. **Fachada de Compatibilidad (`js/views/triage.js`):**
   - Mantiene la signatura original `TodayTasksTriageView(ctx)` reexportando desde `./triage/index.js`, asegurando que tests unitarios existentes (`tests/triage*.test.js`) y módulos que importan desde `views/triage.js` continúen funcionando sin ninguna modificación.

3. **Inyección de Dependencias Sin Acoplamiento Circular:**
   - Cada submódulo se exporta mediante una fábrica (`createTriageData(ctx, state, deps)`, etc.) donde `state` provee acceso reactivo al estado local del triaje mediante getters/setters y referencias de Sets, y `deps` suministra las funciones compartidas necesarias entre hermanos.

## Consecuencias

* **Positivas:**
  - El fichero principal de la vista pasó de ~2.000 líneas a un coordinador limpio de ~300 líneas, con submódulos independientes de entre 140 y 900 líneas.
  - 100% de paridad y compatibilidad con el API público de la vista de triaje.
  - La suite completa de 75 ficheros de pruebas unitarias (762 tests) y las 23 pruebas E2E de Playwright siguen pasando limpiamente sin requerir modificaciones en los tests.
  - Facilita enormemente futuras ampliaciones o refactorizaciones en la vista de triaje.
