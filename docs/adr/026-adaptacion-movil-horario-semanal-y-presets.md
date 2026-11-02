# 026. Adaptación Móvil de Horario Semanal y Plantillas Rápidas Contextuales (Presets)

* **Fecha:** 2026-11-02
* **Estado:** Aceptado

## Contexto

El modal de configuración de horario semanal (`#weeklyScheduleModal` gestionado por `js/app/weekly-schedule.js`) permitía establecer las horas de inicio y fin de jornada así como los días libres para cada uno de los ambientes (`work` y `personal`).

Sin embargo, en dispositivos móviles o pantallas estrechas ($\le$ 600px):
1. Cada fila mostraba en una sola línea horizontal (`display: flex; gap: 10px`) el nombre del día, dos selectores de tipo `<input type="time">`, la flecha separadora y el checkbox con etiqueta «Día libre».
2. En pantallas móviles de 320px–400px el ancho necesario supera los 370px, provocando desbordamiento horizontal, truncado de textos y campos apiñados.
3. El área de toque (*touch target*) de los inputs no alcanzaba el estándar táctil ergonómico ($\ge$ 40px–44px).
4. El modal podía exceder la altura de la pantalla en dispositivos pequeños sin un scroll interno adecuado.
5. Faltaba una forma rápida de establecer configuraciones habituales de jornada (como jornada intensiva de verano, vacaciones completas o el régimen especial de verano en el ambiente Personal donde la jornada es completa de 09:00 a 23:00 de lunes a domingo y el trabajo queda 100% libre).

## Alternativas Consideradas

* **A. Selector por pestañas día a día (L, M, X, J, V, S, D):**
  Evita el scroll vertical, pero impide visualizar la semana completa en un único vistazo y obliga a navegar día por día.
* **B. Modal inferior (*Bottom Sheet*) exclusivamente con grupos de días:**
  Muy rápido para aplicar jornadas tipo, pero añade complejidad para retocar excepciones en días concretos.
* **C. Solución Híbrida: Barra de Plantillas Rápidas (*Presets*) Contextuales + Lista Adaptable en 2 Niveles por Tarjeta:**
  - En la parte superior: presets contextuales según el ambiente activo (`work` o `personal`) aplicables con 1 toque.
  - En el cuerpo: lista completa de los 7 días que en móvil ($\le$ 600px) se reorganiza en 2 niveles táctiles (Línea 1: Día y Día libre; Línea 2: selectores de hora amplios y confortables al tacto).
  - En escritorio ($\ge$ 600px): se preserva intacto el formato clásico horizontal de 1 sola línea por día.
  - Soporte para el preset de verano en personal: L–D 09:00–23:00 y sincronización automática de trabajo como todo libre/vacaciones al guardar.

## Decisión (Opción C)

Se adoptó la **Opción C**:
1. Se añadió el contenedor `#weeklySchedulePresets` en `index.html` sobre las filas de días `#weeklyScheduleRows`.
2. Se implementó en `js/app/weekly-schedule.js` la función `renderWeeklySchedulePresets(envKey)` y `applyPreset(presetKey)`:
   - Para `work`: *Estándar (L-V 9-18)*, *Intensiva (L-V 8-15)* y *Vacaciones (L-D libre)*.
   - Para `personal`: *Verano (L-D 09:00 - 23:00 y Trabajo libre)*, *Tardes + Fin de semana (18-23 / 9-23)* y *Solo noches (20-23)*.
3. Al aplicar el preset de verano en personal, se activa la sincronización que al pulsar «Guardar» configura `work.weeklySchedule` con todos los días nulos (todo libre).
4. En `css/modals.css`:
   - En pantallas móviles ($\le$ 600px), cada fila `.weekly-schedule-row` se transforma en tarjeta con dos renglones: cabecera con el día y checkbox de día libre, e inputs de tiempo con altura táctil mínima de 40px y tipografía monospace legible.
   - Si se marca «Día libre», los selectores de hora se ocultan y se muestra un distintivo claro de «Día no laborable / descanso».
   - El modal incorpora `max-height: 88vh` y scroll vertical suave.
   - En pantallas mayores a 600px, se mantiene intacta la vista de escritorio en una sola línea horizontal.
5. Se añadieron estilos para tema oscuro en `css/theme-dark.css`.
6. Se actualizaron los diccionarios i18n en `js/i18n/es.js` y `js/i18n/en.js`.

## Consecuencias

* **Positivas:**
  - Experiencia táctil y móvil óptima, sin desbordamiento ni elementos recortados.
  - Configuración ultrarrápida mediante presets de 1 solo clic y capacidad de afinar días individuales.
  - Soporte específico para el horario de verano en personal con trabajo libre.
  - Cero regresiones en desktop y compatibilidad garantizada con todas las suites de prueba.
* **Verificación:**
  - Tests unitarios ampliados en `tests/weekly_schedule_modal.test.js` verificando renderizado de presets, preset de verano y sincronización de ambientes.
  - 100% de paridad i18n (`tests/i18n_parity.test.js`).
  - Suite completa de 791 tests unitarios superada con éxito.
