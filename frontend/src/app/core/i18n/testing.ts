import { Provider } from '@angular/core';
import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { Language } from '../../models/settings.model';
import {
  TranslateService,
  TranslationDictionary,
  TranslationParams,
  interpolateTranslation,
  lookupTranslation,
} from './translate.service';

const DICTIONARIES: Record<Language, TranslationDictionary> = {
  fr: fr as TranslationDictionary,
  en: en as TranslationDictionary,
};

/**
 * Fournit un `TranslateService` préchargé avec le vrai dictionnaire `fr.json`
 * et, si `language` vaut `'en'`, avec le vrai `en.json` comme langue active
 * (le français reste chargé en repli, RG-022-07), pour vérifier les
 * libellés par leur clé résolue dans les tests.
 */
export function provideI18nTesting(language: Language = 'fr'): Provider {
  return {
    provide: TranslateService,
    useFactory: () => {
      const service = new TranslateService();
      service.use(DICTIONARIES.fr, 'fr');
      if (language === 'en') {
        service.use(DICTIONARIES.en, 'en');
      }
      return service;
    },
  };
}

/**
 * Traduit une clé avec le vrai dictionnaire (`fr` par défaut), hors
 * injection Angular. Lève une erreur si la clé n'existe pas (détecte les
 * clés oubliées dans les tests).
 * @param key clé de traduction.
 * @param params valeurs interpolées.
 * @param language dictionnaire à utiliser (défaut `fr`).
 */
export function t(key: string, params?: TranslationParams, language: Language = 'fr'): string {
  const value = lookupTranslation(DICTIONARIES[language], key);
  if (value === undefined) {
    throw new Error(`[i18n:test] clé manquante dans ${language}.json : ${key}`);
  }
  return params ? interpolateTranslation(value, params) : value;
}
