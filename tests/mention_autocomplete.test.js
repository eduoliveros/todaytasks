import { describe, it, expect } from 'vitest';
import {
  extractMentions,
  formatTitleWithTags,
  getTaskSearchableText,
  matchesTaskSearch
} from '../js/utils.js';
import {
  getWordAtCursor,
  filterExistingMentions,
  replaceMentionAtCursor,
  getEnvironmentMentions,
  attachTagAutocomplete
} from '../js/app/tag-autocomplete.js';

describe('Sistema de Referencias a Personas (@Nombre) y Autocompletado', () => {

  describe('extractMentions', () => {
    it('extrae menciones únicas en minúsculas ignorando mayúsculas/minúsculas', () => {
      const text = 'Reunión con @Carlos y @Maria para revisar con @CARLOS';
      const mentions = extractMentions(text);
      expect(mentions).toEqual(['carlos', 'maria']);
    });

    it('maneja caracteres en español (tildes, eñes)', () => {
      const text = 'Avisar a @Íñigo, @José y @Begoña';
      const mentions = extractMentions(text);
      expect(mentions).toEqual(['íñigo', 'josé', 'begoña']);
    });

    it('soporta guiones, puntos y barras bajas en nombres de usuario', () => {
      const text = 'Coordinar con @juan-carlos, @ana.lopez y @maria_perez';
      const mentions = extractMentions(text);
      expect(mentions).toEqual(['juan-carlos', 'ana.lopez', 'maria_perez']);
    });

    it('ignora signos de puntuación pegados al final de la mención', () => {
      const text = 'Hablar con @pedro. Luego con @luis, y @ana!';
      const mentions = extractMentions(text);
      expect(mentions).toEqual(['pedro', 'luis', 'ana']);
    });

    it('extrae correctamente menciones entre paréntesis', () => {
      const text = 'Revisar PR (@carlos)';
      const mentions = extractMentions(text);
      expect(mentions).toEqual(['carlos']);
    });

    it('descarta direcciones de correo electrónico para no generar falsos positivos', () => {
      const text = 'Enviar correo a contacto@empresa.com y avisar a @pedro';
      const mentions = extractMentions(text);
      expect(mentions).toEqual(['pedro']);
      expect(mentions).not.toContain('empresa.com');
      expect(extractMentions('texto@email.com')).toEqual([]);
    });

    it('devuelve array vacío si no hay menciones válidas', () => {
      expect(extractMentions('Tarea normal sin menciones')).toEqual([]);
      expect(extractMentions('@')).toEqual([]);
      expect(extractMentions('')).toEqual([]);
      expect(extractMentions(null)).toEqual([]);
    });
  });

  describe('formatTitleWithTags (soporte para @menciones)', () => {
    it('reemplaza menciones @Nombre por spans con task-mention-syntax', () => {
      const formatted = formatTitleWithTags('Revisar PR con @Carlos y avisar a @Maria');
      expect(formatted).toContain('class="task-mention-syntax"');
      expect(formatted).toContain('@Carlos');
      expect(formatted).toContain('@Maria');
      expect(formatted).toContain("app.filterByMention('carlos', event)");
      expect(formatted).toContain("app.filterByMention('maria', event)");
    });

    it('formatea simultáneamente #tags y @menciones en el mismo título', () => {
      const formatted = formatTitleWithTags('Completar #frontend con @Carlos');
      expect(formatted).toContain('class="task-tag-syntax');
      expect(formatted).toContain('#frontend');
      expect(formatted).toContain('class="task-mention-syntax"');
      expect(formatted).toContain('@Carlos');
    });

    it('preserva los signos de puntuación tras la mención', () => {
      const formatted = formatTitleWithTags('Avisar a @Carlos. Luego continuar.');
      expect(formatted).toContain('>@Carlos</span>.');
    });

    it('no formatea direcciones de email', () => {
      const formatted = formatTitleWithTags('Escribir a info@empresa.com para dudas');
      expect(formatted).not.toContain('class="task-mention-syntax"');
      expect(formatted).toContain('info@empresa.com');

      const exactEmail = formatTitleWithTags('texto@email.com');
      expect(exactEmail).toBe('texto@email.com');
      expect(exactEmail).not.toContain('task-mention-syntax');
    });

    it('escapa texto HTML peligroso para evitar XSS', () => {
      const raw = '<img src=x onerror=alert(1)> @Carlos';
      const formatted = formatTitleWithTags(raw);
      expect(formatted).not.toContain('<img');
      expect(formatted).toContain('&lt;img');
      expect(formatted).toContain('@Carlos');
    });
  });

  describe('getWordAtCursor', () => {
    it('detecta mención en edición cuando el cursor está al final de la palabra', () => {
      const text = 'Reunión con @car';
      const result = getWordAtCursor(text, 16);
      expect(result.isMention).toBe(true);
      expect(result.isHashtag).toBe(false);
      expect(result.trigger).toBe('@');
      expect(result.query).toBe('car');
      expect(result.startIndex).toBe(12);
      expect(result.endIndex).toBe(16);
    });

    it('detecta mención recién iniciada (@ solo)', () => {
      const text = 'Hablar con @';
      const result = getWordAtCursor(text, 12);
      expect(result.isMention).toBe(true);
      expect(result.query).toBe('');
      expect(result.startIndex).toBe(11);
      expect(result.endIndex).toBe(12);
    });

    it('detecta mención en medio del texto', () => {
      const text = 'Hablar con @car mañana por la mañana';
      const result = getWordAtCursor(text, 15);
      expect(result.isMention).toBe(true);
      expect(result.query).toBe('car');
    });

    it('distingue correctamente entre @mención y #hashtag', () => {
      const hashtagResult = getWordAtCursor('Tarea #frontend', 15);
      expect(hashtagResult.isHashtag).toBe(true);
      expect(hashtagResult.isMention).toBe(false);

      const mentionResult = getWordAtCursor('Tarea @carlos', 13);
      expect(mentionResult.isHashtag).toBe(false);
      expect(mentionResult.isMention).toBe(true);
    });

    it('no activa modo mención si el cursor está sobre un correo electrónico (ej: texto@email.com)', () => {
      const emailText = 'Escribir a texto@email.com urgente';
      expect(getWordAtCursor(emailText, 16).isMention).toBe(false); // justo tras @
      expect(getWordAtCursor(emailText, 20).isMention).toBe(false); // dentro del dominio
      expect(getWordAtCursor(emailText, 26).isMention).toBe(false); // al final de .com
    });
  });

  describe('filterExistingMentions', () => {
    const existingMentions = [
      { name: 'Carlos', count: 5 },
      { name: 'Carmen', count: 3 },
      { name: 'Carolina', count: 1 },
      { name: 'Maria', count: 8 },
      { name: 'Diego', count: 4 }
    ];

    it('filtra coincidencias por prefijo de forma insensible a mayúsculas', () => {
      const r1 = filterExistingMentions(existingMentions, 'car');
      expect(r1.map(m => m.name)).toEqual(['Carlos', 'Carmen', 'Carolina']);

      const r2 = filterExistingMentions(existingMentions, 'CAR');
      expect(r2.map(m => m.name)).toEqual(['Carlos', 'Carmen', 'Carolina']);
    });

    it('si la query está vacía devuelve todas las menciones ordenadas por frecuencia', () => {
      const all = filterExistingMentions(existingMentions, '');
      expect(all[0].name).toBe('Maria');
      expect(all.length).toBe(5);
    });

    it('devuelve array vacío si no hay coincidencias', () => {
      expect(filterExistingMentions(existingMentions, 'xyz')).toEqual([]);
    });
  });

  describe('replaceMentionAtCursor', () => {
    it('reemplaza la mención parcial por la persona seleccionada con espacio al final', () => {
      const text = 'Reunión con @car';
      const replaced = replaceMentionAtCursor(text, 16, 'Carlos');
      expect(replaced.text).toBe('Reunión con @Carlos ');
      expect(replaced.newCursorPosition).toBe(20);
    });

    it('reemplaza correctamente en medio de una frase sin duplicar espacios', () => {
      const text = 'Hablar con @car para el informe';
      const replaced = replaceMentionAtCursor(text, 15, 'Carlos');
      expect(replaced.text).toBe('Hablar con @Carlos para el informe');
      expect(replaced.newCursorPosition).toBe(19);
    });
  });

  describe('getEnvironmentMentions', () => {
    it('recopila y cuenta menciones en tareas activas, días y reglas periódicas preservando mayúsculas', () => {
      const state = {
        activeEnv: 'work',
        tasks: [
          { id: '1', title: 'Reunión con @Carlos y @Maria', mentions: ['carlos', 'maria'] },
          { id: '2', title: 'Validar con @carlos', mentions: ['carlos'] }
        ],
        environments: {
          work: {
            days: {
              '2026-09-01': {
                tasks: [
                  { id: '3', title: 'Demo con @Diego', mentions: ['diego'] }
                ]
              }
            },
            recurringTasks: [
              { id: 'rec1', title: '1-on-1 semanal con @Carlos', mentions: ['carlos'] }
            ]
          }
        }
      };

      const mentions = getEnvironmentMentions(state);
      const names = mentions.map(m => m.name.toLowerCase());
      expect(names).toContain('carlos');
      expect(names).toContain('maria');
      expect(names).toContain('diego');

      const carlosItem = mentions.find(m => m.name.toLowerCase() === 'carlos');
      expect(carlosItem.count).toBe(3);
      // Preserva el casing canónico con mayúscula
      expect(carlosItem.name).toBe('Carlos');
    });
  });

  describe('Búsqueda e indexación de menciones en tareas', () => {
    it('getTaskSearchableText incluye menciones con y sin arroba', () => {
      const task = {
        title: 'Revisar propuesta',
        mentions: ['carlos', 'maria']
      };
      const searchable = getTaskSearchableText(task);
      expect(searchable).toContain('carlos');
      expect(searchable).toContain('@carlos');
      expect(searchable).toContain('maria');
      expect(searchable).toContain('@maria');
    });

    it('matchesTaskSearch encuentra tareas al buscar por @persona o por persona', () => {
      const task = {
        title: 'Llamar a @Carlos por la tarde',
        mentions: ['carlos']
      };
      expect(matchesTaskSearch(task, '@carlos')).toBe(true);
      expect(matchesTaskSearch(task, 'carlos')).toBe(true);
      expect(matchesTaskSearch(task, '@maria')).toBe(false);
    });
  });

  describe('attachTagAutocomplete con menciones', () => {
    it('despliega menú flotante de personas al escribir @ y autocompleta con Enter', () => {
      const state = {
        activeEnv: 'work',
        tasks: [
          { id: '1', title: 'Hablar con @Carlos', mentions: ['carlos'] }
        ],
        environments: { work: { days: {}, recurringTasks: [] } }
      };

      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      let selectedPerson = null;
      let selectedMode = null;
      const instance = attachTagAutocomplete(input, {
        getState: () => state,
        onSelect: (val, mode) => {
          selectedPerson = val;
          selectedMode = mode;
        }
      });

      input.value = 'Reunión con @Car';
      input.setSelectionRange(16, 16);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const dropdown = document.querySelector('.tag-autocomplete-dropdown');
      expect(dropdown).toBeTruthy();
      expect(dropdown.style.display).toBe('block');
      expect(dropdown.innerHTML).toContain('@Carlos');
      expect(dropdown.innerHTML).toContain('mention-dot');

      // Simular tecla Enter
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      input.dispatchEvent(enterEvent);

      expect(input.value).toBe('Reunión con @Carlos ');
      expect(selectedPerson).toBe('Carlos');
      expect(selectedMode).toBe('mention');

      instance.destroy();
      document.body.removeChild(input);
    });
  });

});
