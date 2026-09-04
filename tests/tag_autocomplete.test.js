import { describe, it, expect } from 'vitest';
import {
  extractHashtags,
  getTagColorClass,
  formatTitleWithTags
} from '../js/utils.js';
import {
  getWordAtCursor,
  filterExistingTags,
  replaceTagAtCursor,
  getEnvironmentTags,
  attachTagAutocomplete
} from '../js/app/tag-autocomplete.js';

describe('Sistema de Tags y Autocompletado', () => {

  describe('extractHashtags', () => {
    it('extrae etiquetas únicas en minúsculas ignorando mayúsculas/minúsculas', () => {
      const text = 'Implementar #Backend y #frontend con #BACKEND';
      const tags = extractHashtags(text);
      expect(tags).toEqual(['backend', 'frontend']);
    });

    it('maneja caracteres en español (tildes, eñes) y guiones', () => {
      const text = 'Reunión de #diseño, #reunión y #cliente-acme';
      const tags = extractHashtags(text);
      expect(tags).toEqual(['diseño', 'reunión', 'cliente-acme']);
    });

    it('ignora signos de puntuación pegados al final del tag', () => {
      const text = 'Hacer pruebas de #qa. Luego avisar a #dev, #ops!';
      const tags = extractHashtags(text);
      expect(tags).toEqual(['qa', 'dev', 'ops']);
    });

    it('devuelve array vacío si no hay hashtags válidos', () => {
      expect(extractHashtags('Tarea sin tags')).toEqual([]);
      expect(extractHashtags('#')).toEqual([]);
      expect(extractHashtags(null)).toEqual([]);
    });
  });

  describe('getTagColorClass', () => {
    it('devuelve una clase determinista para un tag', () => {
      const c1 = getTagColorClass('frontend');
      const c2 = getTagColorClass('frontend');
      expect(c1).toBe(c2);
      expect(c1).toMatch(/^syntax-[a-z]+$/);
    });

    it('es insensible a mayúsculas y minúsculas', () => {
      expect(getTagColorClass('Casa')).toBe(getTagColorClass('casa'));
      expect(getTagColorClass('CASA')).toBe(getTagColorClass('casa'));
    });
  });

  describe('formatTitleWithTags', () => {
    it('reemplaza hashtags en el título por spans con clases de sintaxis', () => {
      const formatted = formatTitleWithTags('Revisar #frontend y #urgente', 'app.filterByTag');
      expect(formatted).toContain('class="task-tag-syntax');
      expect(formatted).toContain('#frontend');
      expect(formatted).toContain('#urgente');
      expect(formatted).toContain('app.filterByTag(\'frontend\', event)');
    });

    it('escapa texto HTML malicioso para evitar XSS', () => {
      const raw = '<img src=x onerror=alert(1)> #seguridad';
      const formatted = formatTitleWithTags(raw, 'app.filterByTag');
      expect(formatted).not.toContain('<img');
      expect(formatted).toContain('&lt;img');
      expect(formatted).toContain('#seguridad');
    });

    it('devuelve string vacío si el título es nulo o vacío', () => {
      expect(formatTitleWithTags('')).toBe('');
      expect(formatTitleWithTags(null)).toBe('');
    });
  });

  describe('getWordAtCursor', () => {
    it('detecta hashtag en edición cuando el cursor está dentro o al final de la palabra', () => {
      const text = 'Comprar leche #cas';
      const result = getWordAtCursor(text, 18); // al final de #cas
      expect(result.isHashtag).toBe(true);
      expect(result.query).toBe('cas');
      expect(result.startIndex).toBe(14);
      expect(result.endIndex).toBe(18);
    });

    it('detecta hashtag recién iniciado (# solo)', () => {
      const text = 'Revisar #';
      const result = getWordAtCursor(text, 9);
      expect(result.isHashtag).toBe(true);
      expect(result.query).toBe('');
      expect(result.startIndex).toBe(8);
      expect(result.endIndex).toBe(9);
    });

    it('detecta hashtag en medio del texto', () => {
      const text = 'Revisar #cas para mañana';
      const result = getWordAtCursor(text, 12); // justo tras 's'
      expect(result.isHashtag).toBe(true);
      expect(result.query).toBe('cas');
      expect(result.startIndex).toBe(8);
      expect(result.endIndex).toBe(12);
    });

    it('devuelve isHashtag: false si el cursor no está en un hashtag', () => {
      const text = 'Comprar leche fresca';
      const result = getWordAtCursor(text, 13);
      expect(result.isHashtag).toBe(false);
    });
  });

  describe('filterExistingTags (Case-insensitive)', () => {
    const existingTags = [
      { name: 'casa', count: 5 },
      { name: 'casos', count: 3 },
      { name: 'castillo', count: 1 },
      { name: 'frontend', count: 8 },
      { name: 'backend', count: 4 }
    ];

    it('filtra coincidencias por prefijo sin distinguir mayúsculas ni minúsculas', () => {
      const r1 = filterExistingTags(existingTags, 'cas');
      expect(r1.map(t => t.name)).toEqual(['casa', 'casos', 'castillo']);

      const r2 = filterExistingTags(existingTags, 'CAS');
      expect(r2.map(t => t.name)).toEqual(['casa', 'casos', 'castillo']);

      const r3 = filterExistingTags(existingTags, 'Cas');
      expect(r3.map(t => t.name)).toEqual(['casa', 'casos', 'castillo']);
    });

    it('si la query está vacía, devuelve todos los tags ordenados por frecuencia', () => {
      const all = filterExistingTags(existingTags, '');
      expect(all[0].name).toBe('frontend');
      expect(all.length).toBe(5);
    });

    it('devuelve array vacío si no hay coincidencias', () => {
      const none = filterExistingTags(existingTags, 'xyz');
      expect(none).toEqual([]);
    });
  });

  describe('replaceTagAtCursor', () => {
    it('reemplaza el hashtag parcial por el tag seleccionado con espacio al final', () => {
      const text = 'Revisar #cas';
      const replaced = replaceTagAtCursor(text, 12, 'casa');
      expect(replaced.text).toBe('Revisar #casa ');
      expect(replaced.newCursorPosition).toBe(14);
    });

    it('reemplaza correctamente en medio de una frase', () => {
      const text = 'Revisar #cas para el cliente';
      const replaced = replaceTagAtCursor(text, 12, 'casa');
      expect(replaced.text).toBe('Revisar #casa para el cliente');
      expect(replaced.newCursorPosition).toBe(14);
    });
  });

  describe('getEnvironmentTags', () => {
    it('recopila y cuenta todos los tags únicos de un entorno de forma insensible a mayúsculas', () => {
      const state = {
        activeEnv: 'work',
        tasks: [
          { id: '1', title: 'Tarea #Frontend #casa', tags: ['frontend', 'casa'] },
          { id: '2', title: 'Tarea #frontend #Trabajo', tags: ['frontend', 'trabajo'] }
        ],
        environments: {
          work: {
            days: {
              '2026-09-01': {
                tasks: [
                  { id: '3', title: 'Antigua #casa #CASA', tags: ['casa'] }
                ]
              }
            },
            recurringTasks: [
              { id: 'rec1', title: 'Semanal #rutina', tags: ['rutina'] }
            ]
          }
        }
      };

      const collected = getEnvironmentTags(state);
      const names = collected.map(t => t.name);
      expect(names).toContain('frontend');
      expect(names).toContain('casa');
      expect(names).toContain('trabajo');
      expect(names).toContain('rutina');

      const casaItem = collected.find(t => t.name === 'casa');
      expect(casaItem.count).toBeGreaterThanOrEqual(2);
    });

    it('recopila tags de todos los entornos cuando targetEnv es "both"', () => {
      const state = {
        activeEnv: 'work',
        tasks: [],
        environments: {
          work: {
            days: {
              '2026-09-01': {
                tasks: [{ id: '1', title: 'Tarea #oficina', tags: ['oficina'] }]
              }
            }
          },
          personal: {
            days: {
              '2026-09-01': {
                tasks: [{ id: '2', title: 'Comprar #hogar', tags: ['hogar'] }]
              }
            }
          }
        }
      };

      const activeOnly = getEnvironmentTags(state);
      expect(activeOnly.map(t => t.name)).toContain('oficina');
      expect(activeOnly.map(t => t.name)).not.toContain('hogar');

      const both = getEnvironmentTags(state, 'both');
      expect(both.map(t => t.name)).toContain('oficina');
      expect(both.map(t => t.name)).toContain('hogar');
    });
  });

  describe('attachTagAutocomplete en inputs de búsqueda', () => {
    it('muestra el menú flotante al escribir un hashtag y autocompleta al pulsar Enter', () => {
      const state = {
        activeEnv: 'work',
        tasks: [
          { id: '1', title: 'Preparar informe #urgente #proyecto', tags: ['urgente', 'proyecto'] }
        ],
        environments: { work: { days: {}, recurringTasks: [] } }
      };

      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      let selectedTag = null;
      const instance = attachTagAutocomplete(input, {
        getState: () => state,
        onSelect: (tag) => { selectedTag = tag; }
      });

      // Escribir '#urg' en el input
      input.value = '#urg';
      input.selectionStart = 4;
      input.selectionEnd = 4;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const menu = document.querySelector('.tag-autocomplete-dropdown');
      expect(menu).not.toBeNull();
      expect(menu.style.display).toBe('block');
      expect(menu.innerHTML).toContain('#urgente');

      // Pulsar Enter para aceptar sugerencia
      const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      input.dispatchEvent(enterEvt);

      expect(input.value).toBe('#urgente ');
      expect(selectedTag).toBe('urgente');
      expect(menu.style.display).toBe('none');

      instance.destroy();
      input.remove();
    });

    it('al pulsar Escape con el menú abierto, solo cierra el menú y previene la propagación', () => {
      const state = {
        activeEnv: 'work',
        tasks: [{ id: '1', title: 'Tarea #casa', tags: ['casa'] }],
        environments: { work: { days: {}, recurringTasks: [] } }
      };

      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      let externalCleared = false;
      input.addEventListener('keydown', (e) => {
        if (e.defaultPrevented) return;
        if (e.key === 'Escape') {
          externalCleared = true;
        }
      });

      const instance = attachTagAutocomplete(input, {
        getState: () => state
      });

      input.value = '#cas';
      input.selectionStart = 4;
      input.selectionEnd = 4;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const menu = document.querySelector('.tag-autocomplete-dropdown');
      expect(menu.style.display).toBe('block');

      // Pulsar Escape
      const escEvt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      input.dispatchEvent(escEvt);

      // El menú debe haberse cerrado pero externalCleared debe seguir en false
      expect(menu.style.display).toBe('none');
      expect(externalCleared).toBe(false);

      // Pulsar Escape de nuevo con el menú ya cerrado
      const escEvt2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      input.dispatchEvent(escEvt2);
      expect(externalCleared).toBe(true);

      instance.destroy();
      input.remove();
    });
  });

});
