import es from './i18n/es.js';
import en from './i18n/en.js';

const dictionaries = { es, en };
let currentLocale = 'es';

/**
 * Registra o sobreescribe un diccionario para un idioma específico.
 * @param {string} locale
 * @param {Record<string, any>} dict
 */
export function registerDictionary(locale, dict) {
  dictionaries[locale] = { ...(dictionaries[locale] || {}), ...dict };
}

/**
 * Detecta el idioma inicial según la configuración del navegador.
 * Si el idioma del navegador empieza por 'es', devuelve 'es'; de lo contrario, 'en'.
 * @returns {'es' | 'en'}
 */
export function detectInitialLanguage() {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const navLang = navigator.language.toLowerCase();
    return navLang.startsWith('es') ? 'es' : 'en';
  }
  return 'es';
}

/**
 * Obtiene el idioma activo actualmente.
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Establece el idioma activo y actualiza el atributo lang del documento si está disponible.
 * @param {string} locale
 */
export function setLocale(locale) {
  if (locale && (dictionaries[locale] || locale === 'es' || locale === 'en')) {
    currentLocale = locale;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', locale);
    }
  }
}

/**
 * Reemplaza variables en el formato {nombre} con los valores de params.
 * @param {string} template
 * @param {Record<string, any>} params
 * @returns {string}
 */
function interpolate(template, params = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in params && params[key] !== undefined && params[key] !== null ? String(params[key]) : match;
  });
}

/**
 * Traduce una clave con soporte para fallback en español e interpolación de variables.
 * @param {string} key
 * @param {Record<string, any> | number} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  const normParams = typeof params === 'number' ? { count: params } : (params || {});
  const activeDict = dictionaries[currentLocale] || {};
  const fallbackDict = dictionaries.es || {};

  let value = activeDict[key];
  if (value === undefined && currentLocale !== 'es') {
    value = fallbackDict[key];
  }

  if (value === undefined) {
    return key;
  }

  // Si el valor es una estructura de pluralización { one, other }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const count = typeof normParams.count === 'number' ? normParams.count : 1;
    const pattern = count === 1 ? (value.one || value.other || '') : (value.other || value.one || '');
    return interpolate(pattern, normParams);
  }

  if (typeof value === 'string') {
    return interpolate(value, normParams);
  }

  return value;
}

/**
 * Función explícita para pluralización.
 * @param {string} key
 * @param {number} count
 * @param {Record<string, any>} [params]
 * @returns {string}
 */
export function tPlural(key, count, params = {}) {
  return t(key, { ...params, count });
}

t.plural = tPlural;
t.getLocale = getLocale;
t.setLocale = setLocale;
t.days = () => t('days.full');
t.daysShort = () => t('days.short');
t.dayLetters = () => t('days.letter');
t.months = () => t('months.short');

/**
 * Traduce elementos declarativos en el DOM según atributos data-i18n-*.
 * @param {HTMLElement | Document} [container=document]
 */
export function translateDOM(container) {
  if (typeof document === 'undefined') return;
  const root = container || document;

  // Page Title (si container es document o no se especifica)
  if ((!container || container === document) && typeof document !== 'undefined') {
    const pageTitle = t('app.pageTitle');
    if (pageTitle && pageTitle !== 'app.pageTitle') {
      document.title = pageTitle;
    }
  }

  // Text content
  const textElements = root.querySelectorAll ? root.querySelectorAll('[data-i18n]') : [];
  textElements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  // HTML content (con tags interiores permitidos)
  const htmlElements = root.querySelectorAll ? root.querySelectorAll('[data-i18n-html]') : [];
  htmlElements.forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (key) el.innerHTML = t(key);
  });

  // Placeholder
  const placeholderElements = root.querySelectorAll ? root.querySelectorAll('[data-i18n-placeholder]') : [];
  placeholderElements.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });

  // Title (tooltips)
  const titleElements = root.querySelectorAll ? root.querySelectorAll('[data-i18n-title]') : [];
  titleElements.forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });

  // Aria-label
  const ariaElements = root.querySelectorAll ? root.querySelectorAll('[data-i18n-aria]') : [];
  ariaElements.forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) el.setAttribute('aria-label', t(key));
  });

  // Botones de días de recurrencia (.rec-pop-day-btn[data-day])
  const dayLetters = t.dayLetters();
  const dayNames = t.days();
  if (Array.isArray(dayLetters) && Array.isArray(dayNames)) {
    const dayButtons = root.querySelectorAll ? root.querySelectorAll('.rec-pop-day-btn[data-day]') : [];
    dayButtons.forEach(btn => {
      const d = parseInt(btn.getAttribute('data-day'), 10);
      if (d >= 1 && d <= 7) {
        btn.textContent = dayLetters[d] || btn.textContent;
        // En days.full, índice 0 es Domingo y 1..6 es Lunes..Sábado
        const dayNameIndex = d === 7 ? 0 : d;
        if (dayNames[dayNameIndex]) {
          btn.setAttribute('title', dayNames[dayNameIndex]);
        }
      }
    });
  }

  // Insignia del día de la semana seleccionado (#selectedDayLabel o .day-abbr-badge)
  const dayBadges = root.querySelectorAll ? root.querySelectorAll('#selectedDayLabel, #datePickerDayLabel, .day-abbr-badge') : [];
  if (dayBadges.length > 0) {
    const dateInput = root.querySelector ? root.querySelector('#datePickerInput') : (typeof document !== 'undefined' ? document.getElementById('datePickerInput') : null);
    let dateStr = dateInput && dateInput.value ? dateInput.value : '';
    if (!dateStr) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
    }
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const day = d.getDay();
      const dow = day === 0 ? 7 : day;
      const shortDays = t.daysShort();
      if (Array.isArray(shortDays) && shortDays[dow]) {
        dayBadges.forEach(badge => {
          badge.textContent = shortDays[dow];
        });
      }
    }
  }
}
