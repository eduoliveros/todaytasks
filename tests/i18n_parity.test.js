import { describe, it, expect } from 'vitest';
import es from '../js/i18n/es.js';
import en from '../js/i18n/en.js';

/**
 * Extrae los tokens de interpolación {variable} de un texto o estructura de plural.
 * @param {string | Record<string, string>} val
 * @returns {string[]}
 */
export function extractInterpolationVariables(val) {
  const text = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
  const matches = text.match(/\{(\w+)\}/g);
  return matches ? Array.from(new Set(matches)).sort() : [];
}

/**
 * Valida que un diccionario no tenga valores nulos, cadenas vacías o estructuras malformadas.
 * @param {Record<string, any>} dict
 * @returns {string[]} Lista de incidencias encontradas
 */
export function validateDictionaryIntegrity(dict) {
  const issues = [];
  for (const [key, val] of Object.entries(dict)) {
    if (val === null || val === undefined) {
      issues.push(`${key} (valor null o undefined)`);
    } else if (typeof val === 'string') {
      if (val.trim() === '') {
        issues.push(`${key} (cadena vacía)`);
      }
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        issues.push(`${key} (array vacío)`);
      } else {
        val.forEach((item, idx) => {
          // days.short y days.letter están indexados de 1 a 7 (Lunes a Domingo), el índice 0 es un placeholder intencionado
          const isAllowedEmptyIndex0 = (key === 'days.short' || key === 'days.letter') && idx === 0;
          if (!isAllowedEmptyIndex0 && (typeof item !== 'string' || item.trim() === '')) {
            issues.push(`${key}[${idx}] (elemento vacío o no string)`);
          }
        });
      }
    } else if (typeof val === 'object') {
      if (!val.one || typeof val.one !== 'string' || val.one.trim() === '') {
        issues.push(`${key}.one (subclave plural 'one' vacía o no válida)`);
      }
      if (!val.other || typeof val.other !== 'string' || val.other.trim() === '') {
        issues.push(`${key}.other (subclave plural 'other' vacía o no válida)`);
      }
    } else {
      issues.push(`${key} (tipo no soportado: ${typeof val})`);
    }
  }
  return issues;
}

/**
 * Compara dos diccionarios y detecta variables de interpolación discordantes.
 * @param {Record<string, any>} dictA
 * @param {Record<string, any>} dictB
 * @returns {string[]}
 */
export function findVariableMismatches(dictA, dictB) {
  const mismatches = [];
  for (const key of Object.keys(dictA)) {
    if (!(key in dictB)) continue;

    const varsA = extractInterpolationVariables(dictA[key]);
    const varsB = extractInterpolationVariables(dictB[key]);

    if (varsA.join(',') !== varsB.join(',')) {
      mismatches.push(`${key} -> [${varsA.join(', ')}] vs [${varsB.join(', ')}]`);
    }
  }
  return mismatches;
}

/**
 * Compara tipos y estructura de subclaves entre dos diccionarios.
 * @param {Record<string, any>} dictA
 * @param {Record<string, any>} dictB
 * @returns {string[]}
 */
export function findStructureMismatches(dictA, dictB) {
  const mismatches = [];
  for (const key of Object.keys(dictA)) {
    if (!(key in dictB)) continue;

    const valA = dictA[key];
    const valB = dictB[key];

    const isArrA = Array.isArray(valA);
    const isArrB = Array.isArray(valB);

    if (isArrA !== isArrB) {
      mismatches.push(`${key}: (Array=${isArrA}) vs (Array=${isArrB})`);
      continue;
    }

    if (isArrA && isArrB) {
      if (valA.length !== valB.length) {
        mismatches.push(`${key}: length(${valA.length}) vs length(${valB.length})`);
      }
      continue;
    }

    const typeA = typeof valA;
    const typeB = typeof valB;

    if (typeA !== typeB) {
      mismatches.push(`${key}: tipo (${typeA}) vs (${typeB})`);
      continue;
    }

    if (typeA === 'object' && valA !== null) {
      const subkeysA = Object.keys(valA).sort().join(',');
      const subkeysB = Object.keys(valB || {}).sort().join(',');
      if (subkeysA !== subkeysB) {
        mismatches.push(`${key} (subkeys mismatch): [${subkeysA}] vs [${subkeysB}]`);
      }
    }
  }
  return mismatches;
}

describe('i18n Dictionary Parity (es.js vs en.js)', () => {
  const esKeys = Object.keys(es);
  const enKeys = Object.keys(en);

  it('el diccionario en español debe tener claves definidas (>500 claves)', () => {
    expect(esKeys.length).toBeGreaterThan(500);
  });

  it('el diccionario en inglés debe tener claves definidas (>500 claves)', () => {
    expect(enKeys.length).toBeGreaterThan(500);
  });

  it('todas las claves de es.js deben existir en en.js', () => {
    const missingInEn = esKeys.filter((key) => !(key in en));
    expect(
      missingInEn,
      `Claves presentes en es.js pero ausentes en en.js:\n${missingInEn.join('\n')}`
    ).toEqual([]);
  });

  it('todas las claves de en.js deben existir en es.js', () => {
    const missingInEs = enKeys.filter((key) => !(key in es));
    expect(
      missingInEs,
      `Claves presentes en en.js pero ausentes en es.js:\n${missingInEs.join('\n')}`
    ).toEqual([]);
  });

  it('ninguna clave debe contener valores nulos, vacíos o estructuras malformadas', () => {
    const issuesEs = validateDictionaryIntegrity(es);
    const issuesEn = validateDictionaryIntegrity(en);

    expect(issuesEs, `Problemas en es.js:\n${issuesEs.join('\n')}`).toEqual([]);
    expect(issuesEn, `Problemas en en.js:\n${issuesEn.join('\n')}`).toEqual([]);
  });

  it('debe coincidir el tipo de datos y la estructura entre ambos diccionarios', () => {
    const mismatches = findStructureMismatches(es, en);
    expect(mismatches, `Discrepancias de tipo o subclaves:\n${mismatches.join('\n')}`).toEqual([]);
  });

  it('las variables de interpolación {variable} deben coincidir exactamente entre ambos idiomas', () => {
    const mismatches = findVariableMismatches(es, en);
    expect(
      mismatches,
      `Variables de interpolación discordantes entre idiomas:\n${mismatches.join('\n')}`
    ).toEqual([]);
  });

  describe('Detección de discrepancias simuladas (pruebas unitarias de los validadores)', () => {
    it('detecta claves vacías, arrays vacíos y plurales incompletos', () => {
      const badDict = {
        'test.empty': '',
        'test.null': null,
        'test.emptyArr': [],
        'test.badPlural': { one: 'algo' }, // falta other
      };
      const issues = validateDictionaryIntegrity(badDict);
      expect(issues.some((i) => i.includes('test.empty'))).toBe(true);
      expect(issues.some((i) => i.includes('test.null'))).toBe(true);
      expect(issues.some((i) => i.includes('test.emptyArr'))).toBe(true);
      expect(issues.some((i) => i.includes('test.badPlural.other'))).toBe(true);
    });

    it('detecta desajustes en las variables de interpolación', () => {
      const dictA = { 'msg.greet': 'Hola {name}, tienes {count} tareas' };
      const dictB = { 'msg.greet': 'Hello {userName}, you have {count} tasks' };
      const mismatches = findVariableMismatches(dictA, dictB);
      expect(mismatches.length).toBe(1);
      expect(mismatches[0]).toContain('msg.greet');
    });

    it('detecta desajustes de tipo y longitud de arrays', () => {
      const dictA = { 'item.list': ['a', 'b'], 'item.kind': 'simple' };
      const dictB = { 'item.list': ['a'], 'item.kind': { one: '1', other: '2' } };
      const mismatches = findStructureMismatches(dictA, dictB);
      expect(mismatches.length).toBe(2);
    });
  });
});
