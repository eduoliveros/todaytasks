# 014. Sistema de Referencias a Personas (@Nombre), Color Único y Autocompletado

* **Fecha:** 2026-09-06
* **Estado:** Aceptado
* **Versión:** v1.105
* **Relacionado con:** Entidad Task, RecurringTaskRule, Autocompletado, Buscador Local y Global, Temas Claro y Oscuro

---

## Contexto

TodayTasks contaba desde la versión 1.94 con un sistema de etiquetas (`#tags`) con paleta de 9 colores rotativos y menú flotante de autocompletado ([ADR 011](./011-sistema-etiquetas-tags-y-autocompletado.md)). No obstante, los usuarios necesitaban poder referenciar de forma clara y directa a personas involucradas o responsables de tareas (ej. `@Carlos`, `@Maria`, `@ana.lopez`), facilitando:
1. Identificar rápidamente personas en la vista diaria y de triaje.
2. Contar con un color propio y **único** (homogéneo) para todas las personas, que diferencie visualmente a los individuos de las etiquetas temáticas `#tag`.
3. Ofrecer asistencia de autocompletado en tiempo real al escribir `@` en inputs de título y buscador.
4. Filtrar al instante al hacer clic sobre una mención (`@Nombre`).

---

## Opciones Evaluadas

1. **Reutilizar la paleta determinista de 9 colores rotativos de los hashtags:**
   * *Descartado:* Los hashtags ya usan 9 colores según un hash del texto. Usar colores rotativos para personas causaría confusión perceptual entre tags y personas (ej. `@Carlos` y `#frontend` podrían compartir el mismo color verde).
2. **Selector formal de usuario con catálogo cerrado / avatars pesados:**
   * *Descartado:* Introduciría fricción en la entrada rápida de tareas, rompería el principio offline-first y requeriría una tabla relacional foránea de usuarios/contactos.
3. **Sintaxis en línea `@Nombre` con Color Único Teal + Autocompletado Integrado (Elegida):**
   * Sintaxis natural en el título (`@Nombre`).
   * Color semántico único y dedicado: **Teal / Verde Azulado** (`#0f766e` en modo claro y `#5eead4` en modo oscuro), con micro-píldora y borde sutil.
   * Motor de autocompletado unificado que detecta `#` o `@` bajo el cursor de forma dinámica.
   * Filtrado instantáneo mediante `app.filterByMention`.
   * Descarte estricto de direcciones de correo electrónico (`contacto@empresa.com`).

---

## Decisión

Se adopta la **Opción 3**:

1. **Extracción y Modelo de Datos:**
   * Las tareas (`Task`) y reglas periódicas (`RecurringTaskRule`) almacenan un array de menciones en minúsculas `mentions?: string[]` extraídas mediante `extractMentions(text)` en `js/utils.js`.
   * Regex con soporte de caracteres latinos (acentos, eñes), guiones, barras bajas y puntos: `/(^|[\s([{<])@([a-zA-Z0-9_\u00C0-\u017F.-]+)/g`.
   * Se descartan correos electrónicos (no se extrae `empresa.com` de `user@empresa.com`).
2. **Estilo Visual Único (Teal):**
   * Clase CSS `.task-mention-syntax`:
     * Modo claro: texto `#0f766e`, fondo `rgba(20, 184, 166, 0.10)`, borde `rgba(20, 184, 166, 0.25)`.
     * Modo oscuro: texto `#5eead4`, fondo `rgba(45, 212, 191, 0.18)`, borde `rgba(45, 212, 191, 0.35)`.
   * Resaltado seguro de sintaxis en `formatTitleWithTags()` que escapa HTML contra XSS y añade el manejador `app.filterByMention`.
3. **Autocompletado Dual (`js/app/tag-autocomplete.js`):**
   * La función `getWordAtCursor` detecta si el término en edición empieza por `#` (modo tag) o `@` (modo mención).
   * Al teclear `@`, escanea `state.tasks`, `days.*.tasks` y `recurringTasks` mediante `getEnvironmentMentions(state)`.
   * Preserva el formato canónico con mayúsculas preferente (ej. `@Carlos`) y ordena sugerencias por frecuencia de uso.
   * Inserta `@Nombre ` con espacio de continuación y soporte para teclado (<kbd>↓</kbd>, <kbd>↑</kbd>, <kbd>Enter</kbd>, <kbd>Tab</kbd>, <kbd>Esc</kbd>).
4. **Búsqueda e Indexación:**
   * `getTaskSearchableText()` indexa tanto `@nombre` como `nombre`.
   * `app.filterByMention(mention)` conmuta el filtro de búsqueda del tablero al pulsar sobre cualquier mención.

---

## Consecuencias

* **Positivas:**
  * Entrada rápida y natural de colaboradores y personas asociadas a tareas.
  * Diferenciación cromática inmediata entre etiquetas de proyecto/categoría y personas gracias al color único Teal.
  * Cero duplicación de código en la UI: el mismo componente de autocompletado gestiona `#` y `@`.
  * Paridad total en todos los inputs: creación de tareas, triaje rápido, edición en línea y buscador.
