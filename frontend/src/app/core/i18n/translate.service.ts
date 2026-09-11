import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Dictionnaire de traduction : arbre de chaînes indexé par clé. */
export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

/** Paramètres interpolés dans une traduction (`{{name}}`). */
export type TranslationParams = Record<string, string | number>;

const DICTIONARY_URL = 'i18n/fr.json';

/**
 * Recherche une clé pointée (`board.toolbar.refresh`) dans le dictionnaire.
 * @returns la chaîne trouvée, ou `undefined` si la clé est absente ou pointe une branche.
 */
export function lookupTranslation(
  dictionary: TranslationDictionary,
  key: string,
): string | undefined {
  let node: string | TranslationDictionary | undefined = dictionary;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object') {
      return undefined;
    }
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Remplace les `{{name}}` d'un gabarit par les paramètres fournis.
 * Un paramètre absent laisse le gabarit intact.
 */
export function interpolateTranslation(template: string, params: TranslationParams): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Service de traduction sans dépendance externe (voir docs/tech/i18n.md).
 * Le dictionnaire est chargé une fois au démarrage via `provideI18n()`.
 */
@Injectable({ providedIn: 'root' })
export class TranslateService {
  private readonly http = inject(HttpClient);
  private dictionary: TranslationDictionary = {};
  private readonly missing = new Set<string>();

  /** Vrai une fois le dictionnaire chargé. */
  readonly loaded = signal(false);

  /**
   * Charge le dictionnaire depuis `public/i18n/fr.json`.
   * En cas d'échec, l'application démarre avec un dictionnaire vide
   * (les clés sont alors affichées telles quelles).
   */
  async load(): Promise<void> {
    try {
      this.dictionary = await firstValueFrom(this.http.get<TranslationDictionary>(DICTIONARY_URL));
    } catch {
      console.warn('[i18n] dictionnaire introuvable, clés affichées brutes');
      this.dictionary = {};
    }
    this.loaded.set(true);
  }

  /**
   * Injecte directement un dictionnaire (tests, préchargement).
   * @param dictionary dictionnaire complet.
   */
  use(dictionary: TranslationDictionary): void {
    this.dictionary = dictionary;
    this.loaded.set(true);
  }

  /**
   * Traduit une clé avec interpolation.
   * Une clé absente renvoie la clé elle-même et logue un avertissement (une seule fois).
   * @param key clé de traduction.
   * @param params valeurs interpolées.
   */
  translate(key: string, params?: TranslationParams): string {
    const value = lookupTranslation(this.dictionary, key);
    if (value === undefined) {
      if (!this.missing.has(key)) {
        this.missing.add(key);
        console.warn(`[i18n] clé manquante : ${key}`);
      }
      return key;
    }
    return params ? interpolateTranslation(value, params) : value;
  }
}
