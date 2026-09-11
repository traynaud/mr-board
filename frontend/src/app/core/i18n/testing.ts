import { Provider } from '@angular/core';
import fr from '../../../../public/i18n/fr.json';
import {
  TranslateService,
  TranslationDictionary,
  TranslationParams,
  interpolateTranslation,
  lookupTranslation,
} from './translate.service';

const DICTIONARY = fr as TranslationDictionary;

/**
 * Fournit un `TranslateService` préchargé avec le vrai `fr.json`,
 * pour vérifier les libellés par leur clé résolue dans les tests.
 */
export function provideI18nTesting(): Provider {
  return {
    provide: TranslateService,
    useFactory: () => {
      const service = new TranslateService();
      service.use(DICTIONARY);
      return service;
    },
  };
}

/**
 * Traduit une clé avec le vrai dictionnaire, hors injection Angular.
 * Lève une erreur si la clé n'existe pas (détecte les clés oubliées dans les tests).
 * @param key clé de traduction.
 * @param params valeurs interpolées.
 */
export function t(key: string, params?: TranslationParams): string {
  const value = lookupTranslation(DICTIONARY, key);
  if (value === undefined) {
    throw new Error(`[i18n:test] clé manquante dans fr.json : ${key}`);
  }
  return params ? interpolateTranslation(value, params) : value;
}
