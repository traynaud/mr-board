import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Language } from '../../models/settings.model';

/** Dictionnaire de traduction : arbre de chaînes indexé par clé. */
export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

/** Paramètres interpolés dans une traduction (`{{name}}`). */
export type TranslationParams = Record<string, string | number>;

/** Langue toujours chargée en mémoire comme repli (RG-022-07). */
const FALLBACK_LANGUAGE: Language = 'fr';

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
 * Gère plusieurs dictionnaires (`fr`, `en`, RG-022-06) : le dictionnaire
 * `fr` est toujours conservé en mémoire comme repli (RG-022-07), même
 * quand la langue active est `en`. Le dictionnaire initial est chargé une
 * fois au démarrage via `provideI18n()` ; `load()` peut être rappelée en
 * cours de session pour changer de langue (RG-022-03/04).
 */
@Injectable({ providedIn: 'root' })
export class TranslateService {
  private readonly http = inject(HttpClient);
  private readonly dictionaries = new Map<Language, TranslationDictionary>();
  private dictionary: TranslationDictionary = {};
  private fallback: TranslationDictionary = {};
  private readonly missing = new Set<string>();

  /** Vrai une fois le dictionnaire de la langue active chargé. */
  readonly loaded = signal(false);

  /**
   * Langue actuellement active (RG-022-12). Lue par `translate()` elle-même
   * (voir plus bas) : tout appelant — via le pipe `| translate` ou
   * directement dans un `computed()` de composant — dépend donc
   * automatiquement de ce signal, sans avoir à le lire lui-même.
   */
  readonly language = signal<Language>(FALLBACK_LANGUAGE);

  /**
   * Charge (si nécessaire) et active le dictionnaire d'une langue depuis
   * `public/i18n/<language>.json`. Le dictionnaire `fr` est systématiquement
   * chargé en plus, comme repli (RG-022-07) — sans requête supplémentaire si
   * `language` vaut déjà `'fr'`. Idempotent : une langue déjà en cache n'est
   * jamais re-fetchée, ce qui permet d'appeler cette méthode aussi bien au
   * démarrage qu'à chaque changement de langue en cours de session.
   * @param language langue à activer (défaut `fr`).
   */
  async load(language: Language = FALLBACK_LANGUAGE): Promise<void> {
    await Promise.all([
      this.ensureDictionary(FALLBACK_LANGUAGE),
      language === FALLBACK_LANGUAGE ? Promise.resolve() : this.ensureDictionary(language),
    ]);
    this.dictionary = this.dictionaries.get(language) ?? {};
    this.fallback = this.dictionaries.get(FALLBACK_LANGUAGE) ?? {};
    this.language.set(language);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
    this.loaded.set(true);
  }

  /**
   * Injecte directement un dictionnaire (tests, préchargement).
   * @param dictionary dictionnaire complet.
   * @param language langue de ce dictionnaire (défaut `fr`) ; utilisé aussi
   * comme repli quand `language` vaut `fr`.
   */
  use(dictionary: TranslationDictionary, language: Language = FALLBACK_LANGUAGE): void {
    this.dictionaries.set(language, dictionary);
    this.dictionary = dictionary;
    this.fallback = language === FALLBACK_LANGUAGE ? dictionary : (this.dictionaries.get(FALLBACK_LANGUAGE) ?? {});
    this.language.set(language);
    this.loaded.set(true);
  }

  /**
   * Traduit une clé avec interpolation. Une clé absente du dictionnaire actif
   * retombe sur le dictionnaire français (RG-022-07) ; absente des deux, elle
   * est renvoyée telle quelle et logue un avertissement (une seule fois).
   *
   * Lit le signal `language` (RG-022-12), sans utiliser sa valeur : c'est ce
   * qui établit une dépendance réactive sur l'appelant (pipe impur ou
   * `computed()` de composant), pour qu'Angular le recontrôle quand la
   * langue change ailleurs dans l'application — y compris un composant déjà
   * stable, sans aucun `@Input` ni évènement propre à lui. Sans cette
   * lecture ici, chaque appelant devrait penser à la faire lui-même
   * (oubli constaté : `avatar.component.ts`, `difficulty-badge.component.ts`,
   * `filter-pill.component.ts`… avant ce correctif).
   * @param key clé de traduction.
   * @param params valeurs interpolées.
   */
  translate(key: string, params?: TranslationParams): string {
    this.language();
    const value = lookupTranslation(this.dictionary, key) ?? lookupTranslation(this.fallback, key);
    if (value === undefined) {
      if (!this.missing.has(key)) {
        this.missing.add(key);
        console.warn(`[i18n] clé manquante : ${key}`);
      }
      return key;
    }
    return params ? interpolateTranslation(value, params) : value;
  }

  /** Fetch mémoïsé de `i18n/<language>.json` ; un échec mémoïse un dictionnaire vide. */
  private async ensureDictionary(language: Language): Promise<void> {
    if (this.dictionaries.has(language)) {
      return;
    }
    try {
      const dictionary = await firstValueFrom(
        this.http.get<TranslationDictionary>(`i18n/${language}.json`),
      );
      this.dictionaries.set(language, dictionary);
    } catch {
      console.warn(`[i18n] dictionnaire ${language} introuvable, clés affichées brutes`);
      this.dictionaries.set(language, {});
    }
  }
}
