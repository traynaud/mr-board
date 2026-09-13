import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { TranslationDictionary } from './translate.service';

/** Aplatit un dictionnaire en une map chemin de clé → valeur. */
function flatten(dictionary: TranslationDictionary, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.set(path, value);
    } else {
      for (const [nestedPath, nestedValue] of flatten(value, path)) {
        result.set(nestedPath, nestedValue);
      }
    }
  }
  return result;
}

/** Extrait l'ensemble des noms de paramètres `{{name}}` d'une chaîne. */
function extractParams(value: string): string[] {
  return [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort();
}

describe('parité des dictionnaires i18n (RG-022-06)', () => {
  const frEntries = flatten(fr as TranslationDictionary);
  const enEntries = flatten(en as TranslationDictionary);

  it('should_have_the_exact_same_set_of_keys', () => {
    const frKeys = [...frEntries.keys()].sort();
    const enKeys = [...enEntries.keys()].sort();

    expect(enKeys).toEqual(frKeys);
  });

  it('should_have_the_same_interpolation_parameters_for_every_key', () => {
    const mismatches: string[] = [];
    for (const [key, frValue] of frEntries) {
      const enValue = enEntries.get(key);
      if (enValue === undefined) {
        continue; // déjà signalé par le test de parité des clés
      }
      const frParams = extractParams(frValue);
      const enParams = extractParams(enValue);
      if (JSON.stringify(frParams) !== JSON.stringify(enParams)) {
        mismatches.push(`${key} (fr: [${frParams}], en: [${enParams}])`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('should_have_no_empty_value_in_either_dictionary', () => {
    const emptyFr = [...frEntries].filter(([, value]) => value.trim() === '').map(([key]) => key);
    const emptyEn = [...enEntries].filter(([, value]) => value.trim() === '').map(([key]) => key);

    expect(emptyFr).toEqual([]);
    expect(emptyEn).toEqual([]);
  });
});
