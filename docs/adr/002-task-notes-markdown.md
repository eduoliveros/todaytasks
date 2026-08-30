# 002. Notas Enriquecidas con Micro-Parser Markdown Seguro

* **Fecha:** 2026-08-31
* **Estado:** Aceptado
* **Relacionado con:** Entidad Task, sanitización de UI y persistencia Offline-First

---

## Contexto
Los usuarios necesitan adjuntar notas de contexto, especificaciones, referencias a tickets (Jira, GitHub PRs) y enlaces web externos dentro de las tareas diarias para no depender de herramientas de notas de terceros mientras ejecutan su jornada.

Para TodayTasks se requería que estas notas permitieran texto enriquecido básico (**negrita**, *cursiva*) y enlaces URL accionables que abran en una nueva pestaña (`target="_blank" rel="noopener noreferrer"`), respetando los principios de la aplicación:
1. JavaScript Vanilla nativo con ES Modules (0 dependencias externas / sin bundlers).
2. Modelo de datos persistido en `localStorage` y sincronizado en Firebase Firestore de forma compacta y libre de código HTML sucio o propenso a XSS.
3. Compatibilidad Offline-First total.

## Opciones Evaluadas

1. **Micro-Parser Markdown Seguro (Regex Nativo) (Elegida):**
   * El estado almacena texto plano en formato Markdown ligero (`Task.notes?: string`).
   * Una función pura (`renderNotesMarkdown`) escapa primero el HTML (`escapeHtml`) y posteriormente transforma sintaxis Markdown (`**bold**`, `*italic*`, `[title](url)`, `https://...`) a etiquetas HTML seguras con `target="_blank" rel="noopener noreferrer"`.
2. **Editor WYSIWYG (`contenteditable`):**
   * Descartado por la inconsistencia cross-browser de `document.execCommand` (deprecado) y el riesgo de persistir HTML inseguro o mal estructurado en la base de datos.
3. **Librería Externa (`marked.js` / `DOMPurify`):**
   * Descartado para evitar añadir dependencias externas de gran tamaño para un conjunto reducido de formatos requeridos.

## Decisión
Se adopta la **Opción 1**:
* Se añade el campo opcional `notes?: string` a la entidad `Task` y a `RecurringTaskRule`.
* Se implementa `renderNotesMarkdown(rawText)` en `js/ui.js` garantizando sanitización estricta anti-XSS antes de cualquier transformación.
* Se añade soporte en la UI para:
  - Tarjetas de lista de tareas: botón píldora `📝 Notas` con desplegable interactivo.
  - Formulario de creación y edición: campo textarea con toolbar de inserción rápida (`[B]`, `[I]`, `[🔗 Link]`) y previsualización.
  - Vista de foco (`#/task/:id`): panel de notas dedicado para consulta durante la ejecución.
  - Buscador (`/`): indexación de notas en el motor de búsqueda en tiempo real.

## Consecuencias
* **Positivas:**
  - 0 peso en dependencias externas.
  - Seguridad total frente a inyecciones XSS.
  - Persistencia limpia y ligera en Firestore y copias locales.
  - Excelente experiencia de usuario con enlaces directos en nueva pestaña.
* **Compensaciones:**
  - Solo soporta un subconjunto de Markdown (negritas, cursivas, enlaces y saltos de línea), lo cual es suficiente y predecible para el caso de uso del producto.
