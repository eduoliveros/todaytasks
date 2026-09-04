/* app/tag-autocomplete.js — Menú flotante de autocompletado para hashtags (#cas...) */
import { extractHashtags, getTagColorClass } from '../utils.js';

/**
 * Detecta si el cursor se encuentra sobre o justo después de un hashtag en un texto.
 * Devuelve información de límites y el término de búsqueda actual.
 *
 * @param {string} text Texto completo del input
 * @param {number} cursorPosition Posición actual del cursor (0..length)
 * @returns {{ isHashtag: boolean, query: string, startIndex: number, endIndex: number }}
 */
export function getWordAtCursor(text, cursorPosition) {
  if (typeof text !== 'string' || cursorPosition == null || cursorPosition < 0) {
    return { isHashtag: false, query: '', startIndex: -1, endIndex: -1 };
  }

  // Si el cursor está más allá de la longitud, acotar
  const pos = Math.min(cursorPosition, text.length);

  // Buscar hacia atrás el inicio de la palabra (espacio o inicio de string)
  let start = pos;
  while (start > 0 && !/\s/.test(text.charAt(start - 1))) {
    start--;
  }

  // Buscar hacia adelante el fin de la palabra (espacio o fin de string)
  let end = pos;
  while (end < text.length && !/\s/.test(text.charAt(end))) {
    end++;
  }

  const word = text.substring(start, end);
  if (word.startsWith('#')) {
    const query = word.slice(1);
    return {
      isHashtag: true,
      query,
      startIndex: start,
      endIndex: end
    };
  }

  return { isHashtag: false, query: '', startIndex: -1, endIndex: -1 };
}

/**
 * Filtra la lista de etiquetas existentes según el prefijo buscado,
 * de manera totalmente insensible a mayúsculas y minúsculas (case-insensitive).
 *
 * @param {Array<{ name: string, count: number }>} existingTags Lista de tags con recuento
 * @param {string} query Término buscado sin '#'
 * @param {number} [maxResults=8] Límite de resultados
 * @returns {Array<{ name: string, count: number }>}
 */
export function filterExistingTags(existingTags, query, maxResults = 8) {
  if (!Array.isArray(existingTags)) return [];
  const q = (query || '').toLowerCase().trim();

  if (!q) {
    return [...existingTags]
      .sort((a, b) => b.count - a.count)
      .slice(0, maxResults);
  }

  const prefixMatches = [];
  const otherMatches = [];

  for (const item of existingTags) {
    if (!item || !item.name) continue;
    const lowerName = item.name.toLowerCase();
    if (lowerName.startsWith(q)) {
      prefixMatches.push(item);
    } else if (lowerName.includes(q)) {
      otherMatches.push(item);
    }
  }

  prefixMatches.sort((a, b) => b.count - a.count);
  otherMatches.sort((a, b) => b.count - a.count);

  return [...prefixMatches, ...otherMatches].slice(0, maxResults);
}

/**
 * Reemplaza el hashtag parcial bajo el cursor por el tag seleccionado,
 * añadiendo un espacio después para que el usuario continúe escribiendo sin fricción.
 *
 * @param {string} text Texto actual
 * @param {number} cursorPosition Posición del cursor
 * @param {string} selectedTag Tag seleccionado (sin '#')
 * @returns {{ text: string, newCursorPosition: number }}
 */
export function replaceTagAtCursor(text, cursorPosition, selectedTag) {
  const wordInfo = getWordAtCursor(text, cursorPosition);
  if (!wordInfo.isHashtag || wordInfo.startIndex === -1) {
    return { text, newCursorPosition: cursorPosition };
  }

  const before = text.substring(0, wordInfo.startIndex);
  let after = text.substring(wordInfo.endIndex);

  // Evitar doble espacio si lo siguiente ya era un espacio
  if (after.startsWith(' ')) {
    after = after.substring(1);
  }

  const cleanTag = String(selectedTag).toLowerCase().replace(/^#+/, '').trim();
  const insertion = `#${cleanTag} `;
  const newText = before + insertion + after;
  const newCursorPosition = (before + insertion).length;

  return {
    text: newText,
    newCursorPosition
  };
}

/**
 * Escanea el entorno activo (o todos si targetEnv es 'both' o 'all') para recopilar
 * todas las etiquetas utilizadas en tareas del día, días almacenados y reglas periódicas.
 *
 * @param {Object} state Estado global de la aplicación
 * @param {string|null} [targetEnv=null] 'work' | 'personal' | 'both' | 'all' | null (usa state.activeEnv)
 * @returns {Array<{ name: string, count: number }>}
 */
export function getEnvironmentTags(state, targetEnv = null) {
  if (!state) return [];
  const tagCounts = new Map();

  function record(tag) {
    if (!tag) return;
    const clean = String(tag).toLowerCase().trim().replace(/^#+/, '').replace(/[-_.]+$/, '');
    if (!clean) return;
    tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
  }

  function recordFromTitle(title) {
    const tags = extractHashtags(title);
    tags.forEach(record);
  }

  // 1. Tareas activas en el estado actual
  if (Array.isArray(state.tasks)) {
    state.tasks.forEach(t => {
      if (Array.isArray(t.tags)) t.tags.forEach(record);
      if (t.title) recordFromTitle(t.title);
    });
  }

  const isBoth = targetEnv === 'both' || targetEnv === 'all';
  const envsToScan = [];

  if (state.environments && typeof state.environments === 'object') {
    if (isBoth) {
      Object.values(state.environments).forEach(env => {
        if (env) envsToScan.push(env);
      });
    } else {
      const envKey = targetEnv || state.activeEnv || 'work';
      const env = state.environments[envKey] || state.environments.work;
      if (env) envsToScan.push(env);
    }
  }

  envsToScan.forEach(env => {
    // 2. Tareas en días del entorno
    if (env.days && typeof env.days === 'object') {
      Object.values(env.days).forEach(day => {
        if (day && Array.isArray(day.tasks)) {
          day.tasks.forEach(t => {
            if (Array.isArray(t.tags)) t.tags.forEach(record);
            if (t.title) recordFromTitle(t.title);
          });
        }
      });
    }

    // 3. Reglas periódicas del entorno
    if (Array.isArray(env.recurringTasks)) {
      env.recurringTasks.forEach(rule => {
        if (Array.isArray(rule.tags)) rule.tags.forEach(record);
        if (rule.title) recordFromTitle(rule.title);
      });
    }
  });

  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Conecta el comportamiento de autocompletado de hashtags a un input de texto.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} inputEl Elemento de entrada
 * @param {Object} [options]
 * @param {Function} [options.getState] Proveedor del estado global
 * @param {Function} [options.getEnv] Proveedor opcional del entorno a escanear ('work', 'personal', 'both')
 * @param {boolean} [options.allEnvs] Si es true, busca en ambos entornos
 * @param {Function} [options.onSelect] Callback tras seleccionar un tag
 * @returns {{ destroy: Function, close: Function }}
 */
export function attachTagAutocomplete(inputEl, options = {}) {
  if (!inputEl || typeof document === 'undefined') {
    return { destroy: () => {}, close: () => {} };
  }

  const { getState, onSelect, getEnv, allEnvs } = options;

  let menuEl = null;
  let currentMatches = [];
  let selectedIndex = -1;
  let isOpen = false;

  function ensureMenu() {
    if (!menuEl) {
      menuEl = document.createElement('div');
      menuEl.className = 'tag-autocomplete-dropdown';
      menuEl.style.display = 'none';
      menuEl.setAttribute('role', 'listbox');
      menuEl.setAttribute('aria-label', 'Sugerencias de etiquetas');
      document.body.appendChild(menuEl);
    }
  }

  function positionMenu() {
    if (!menuEl || !isOpen) return;
    const rect = inputEl.getBoundingClientRect();
    const dropdownHeight = menuEl.offsetHeight || 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    menuEl.style.position = 'fixed';
    const targetWidth = Math.min(360, Math.max(200, rect.width * 0.7));
    menuEl.style.minWidth = `${targetWidth}px`;
    menuEl.style.maxWidth = '360px';

    let left = Math.max(10, rect.left);
    if (typeof window !== 'undefined' && window.innerWidth) {
      if (left + targetWidth > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - targetWidth - 10);
      }
    }
    menuEl.style.left = `${left}px`;

    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      // Mostrar por encima
      menuEl.style.top = `${Math.max(10, rect.top - dropdownHeight - 6)}px`;
    } else {
      // Mostrar por debajo
      menuEl.style.top = `${rect.bottom + 6}px`;
    }
    menuEl.style.zIndex = '99999';
  }

  function closeMenu() {
    if (menuEl) {
      menuEl.style.display = 'none';
      menuEl.innerHTML = '';
    }
    isOpen = false;
    selectedIndex = -1;
    currentMatches = [];
  }

  function selectTag(tagName) {
    const text = inputEl.value;
    const cursor = inputEl.selectionStart != null ? inputEl.selectionStart : text.length;
    const replaced = replaceTagAtCursor(text, cursor, tagName);

    inputEl.value = replaced.text;
    inputEl.setSelectionRange(replaced.newCursorPosition, replaced.newCursorPosition);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));

    closeMenu();
    inputEl.focus();

    if (typeof onSelect === 'function') {
      onSelect(tagName);
    }
  }

  function renderMenu() {
    if (!menuEl) return;
    if (currentMatches.length === 0) {
      closeMenu();
      return;
    }

    menuEl.innerHTML = currentMatches.map((item, idx) => {
      const isSelected = idx === selectedIndex;
      const colorClass = getTagColorClass(item.name);
      return `
        <div class="tag-autocomplete-item ${isSelected ? 'selected' : ''}" data-index="${idx}" role="option" aria-selected="${isSelected}">
          <span class="tag-dot ${colorClass}"></span>
          <span class="tag-name">#${item.name}</span>
          <span class="tag-count" title="${item.count} tarea(s)">${item.count}</span>
        </div>
      `;
    }).join('');

    menuEl.style.display = 'block';
    isOpen = true;
    positionMenu();

    // Eventos de clic en elementos del menú
    menuEl.querySelectorAll('.tag-autocomplete-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Evitar desenfoque del input
        const idx = parseInt(el.dataset.index, 10);
        if (!isNaN(idx) && currentMatches[idx]) {
          selectTag(currentMatches[idx].name);
        }
      });
    });
  }

  function updateSuggestions() {
    const text = inputEl.value;
    const cursor = inputEl.selectionStart != null ? inputEl.selectionStart : text.length;
    const wordInfo = getWordAtCursor(text, cursor);

    if (!wordInfo.isHashtag) {
      closeMenu();
      return;
    }

    const state = typeof getState === 'function' ? getState() : {};
    const envOpt = typeof getEnv === 'function' ? getEnv() : (allEnvs ? 'both' : null);
    const allTags = getEnvironmentTags(state, envOpt);
    currentMatches = filterExistingTags(allTags, wordInfo.query, 8);

    if (currentMatches.length === 0) {
      closeMenu();
      return;
    }

    ensureMenu();
    selectedIndex = 0; // Preseleccionar el primer resultado para aceptar con Enter o Tab
    renderMenu();
  }

  function handleKeydown(e) {
    if (!isOpen || currentMatches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      selectedIndex = (selectedIndex + 1) % currentMatches.length;
      renderMenu();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      selectedIndex = (selectedIndex - 1 + currentMatches.length) % currentMatches.length;
      renderMenu();
      return;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (selectedIndex >= 0 && selectedIndex < currentMatches.length) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        selectTag(currentMatches[selectedIndex].name);
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      closeMenu();
      return;
    }
  }

  function handleInput() {
    updateSuggestions();
  }

  function handleKeyup(e) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      updateSuggestions();
    }
  }

  function handleClick() {
    updateSuggestions();
  }

  function handleBlur() {
    // Cerrar tras breve retraso para permitir mousedown
    setTimeout(() => {
      closeMenu();
    }, 180);
  }

  inputEl.addEventListener('input', handleInput);
  inputEl.addEventListener('keydown', handleKeydown, true);
  inputEl.addEventListener('keyup', handleKeyup);
  inputEl.addEventListener('click', handleClick);
  inputEl.addEventListener('blur', handleBlur);

  const handleWindowScroll = () => { if (isOpen) closeMenu(); };
  const handleWindowResize = () => { if (isOpen) positionMenu(); };

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowResize, { passive: true });
  }

  return {
    close: closeMenu,
    destroy: () => {
      inputEl.removeEventListener('input', handleInput);
      inputEl.removeEventListener('keydown', handleKeydown, true);
      inputEl.removeEventListener('keyup', handleKeyup);
      inputEl.removeEventListener('click', handleClick);
      inputEl.removeEventListener('blur', handleBlur);
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', handleWindowScroll);
        window.removeEventListener('resize', handleWindowResize);
      }
      if (menuEl && menuEl.parentNode) {
        menuEl.parentNode.removeChild(menuEl);
      }
    }
  };
}
