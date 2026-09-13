# Architecture — US-022 Support d'autres langues (anglais)

## Résumé fonctionnel
L'utilisateur choisit la langue de l'interface (français ou anglais) dans les paramètres, section « 06 · Divers »,
juste sous le contrôle « Thème ». Le choix est persisté côté backend, appliqué immédiatement en aperçu, sans flash
au chargement, et couvre l'intégralité des textes visibles de l'application.

---

## ⚠️ Points à clarifier / corrections par rapport aux specs

- **RG-022-12 contient une inexactitude** : le pipe `translate` (`core/i18n/translate.pipe.ts`) est **déjà** déclaré
  `pure: false` aujourd'hui (commentaire existant : « Pipe impur : réévalué après le chargement du dictionnaire »).
  Il n'y a donc rien à « faire évoluer d'un pipe pur vers un pipe impur ». Le vrai travail technique est plus
  précis et plus subtil, détaillé ci-dessous (§ Frontend › Réactivité du changement de langue) : il faut que
  `TranslatePipe.transform()` **lise le signal `language`** exposé par `TranslateService`, pour que les vues déjà
  rendues (notamment tout composant `OnPush` n'ayant par ailleurs aucune raison d'être re-vérifié) soient
  effectivement re-contrôlées par Angular quand la langue change en cours de session. Sans cette lecture de signal,
  le mécanisme actuel (bootstrap bloqué par `provideAppInitializer` le temps du premier chargement) ne couvre que
  le tout premier rendu, jamais un changement de langue après coup.
- **RG-022-06 mentionne un script `npm run i18n:check`** repris de `docs/tech/i18n.md` §4 (« à prévoir »). Ce script
  CLI n'existe pas encore et sa création est un chantier d'outillage plus large que cette US (utilisable aussi pour
  détecter les clés orphelines, cf. i18n.md §4). Le critère d'acceptation « Parité des dictionnaires » est
  entièrement satisfait par un **test unitaire Vitest** comparant `fr.json` et `en.json` — c'est le périmètre
  retenu ici ; la commande npm dédiée reste hors périmètre (à netre dans un `puretech` séparé si souhaité).

---

## Backend

### Impacts sur le modèle de données

- **Entité modifiée** : `Settings` (`backend/src/modules/settings/entities/settings.entity.ts`) — nouvelle colonne
  texte `language`, exactement sur le modèle de `theme` (US-018) :

  ```ts
  /** UI language preference (RG-022-01). */
  @Column({ name: 'language', type: 'text', default: 'fr' })
  language!: Language; // 'fr' | 'en'
  ```

  Placée après `highlightMe` (dernier champ ajouté, US-023), avant `updatedAt`.
- **Migration** : `backend/src/database/migrations/<timestamp>-AddLanguageSetting.ts` (calculer le timestamp après
  `1757601100000-AddHighlightMeSetting.ts`, ex. `1757601200000`), sur le modèle de `AddThemeSetting` :

  ```ts
  export class AddLanguageSetting<timestamp> implements MigrationInterface {
    name = 'AddLanguageSetting<timestamp>';
    async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(
        `ALTER TABLE "settings" ADD COLUMN "language" text NOT NULL DEFAULT ('fr')`,
      );
    }
    async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "language"`);
    }
  }
  ```

### Intégration dans les modules existants

- **`modules/settings/`** : `Settings` (entité), `UpdateSettingsDto`, `SettingsResponseDto`, `SettingsService`
  (`MergeableSettingsFields`, `ExportableSettings`, `mergeCommonFields`, `load()`, `getExportableSettings()`,
  `toResponse()`) — circuit identique à `theme` et `highlightMe`.
- **`modules/settings-transfer/`** : `ImportSettingsDto` (`dto/import-settings.dto.ts`) — **ne pas oublier ce
  fichier**, distinct de `UpdateSettingsDto` (piège déjà rencontré lors de l'US-023, voir son dev-report.md).
- Aucun autre module backend touché : RG-022-13 impose que le backend reste **agnostique de la langue** — aucun
  traitement de `Accept-Language`, aucune traduction de message d'erreur côté serveur. Les exceptions métier
  continuent de porter uniquement un **code** (`common/exceptions`), jamais de texte.

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/settings` | — | `SettingsResponseDto` (+ `language: 'fr' \| 'en'`) | 200 |
| PUT | `/api/v1/settings` | `UpdateSettingsDto` (+ `language?: 'fr' \| 'en'`) | `SettingsResponseDto` | 200, 400 |
| GET | `/api/v1/settings/export` | — | `ExportableSettings` (+ `language: 'fr' \| 'en'`) | 200 |
| POST | `/api/v1/settings/import` | (+ `language?: 'fr' \| 'en'` dans `settings`) | `SettingsResponseDto` (via `ImportResult`) | 200, 400 |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Ajouter colonne `language` | Entité | `Settings.language: Language`, défaut `'fr'`. Définir `export type Language = 'fr' \| 'en';` dans `settings.entity.ts` (à côté de `ThemePreference`), exportée. |
| Créer migration `AddLanguageSetting` | Migration | Voir ci-dessus. |
| Créer `LANGUAGE_OPTIONS` | Constante | Dans `update-settings.dto.ts`, à côté de `THEME_OPTIONS` : `export const LANGUAGE_OPTIONS = ['fr', 'en'] as const;` — **source unique** réutilisée par `ImportSettingsDto` (import déjà établi pour `THEME_OPTIONS`, même pattern). |
| Étendre `UpdateSettingsDto` | DTO | `@IsOptional() @IsIn(LANGUAGE_OPTIONS) language?: Language;` |
| Étendre `SettingsResponseDto` | DTO | `language!: Language;` |
| Étendre `ImportSettingsDto` | DTO | `@IsOptional() @IsIn(LANGUAGE_OPTIONS) language?: Language;` (import `LANGUAGE_OPTIONS` depuis `update-settings.dto.ts`, comme `THEME_OPTIONS`). |
| Étendre `SettingsService` | Service | `MergeableSettingsFields.language?`, `ExportableSettings.language`, branche dans `mergeCommonFields`, défaut `'fr'` dans `load()`, mapping dans `getExportableSettings()` et `toResponse()`. |
| Tests unitaires | Test | `settings.service.spec.ts` : défaut, update, keep-when-omitted, export (mêmes cas que `theme`/`highlightMe`). |
| Tests e2e | Test | `settings.e2e-spec.ts` (GET défaut, PUT store/keep/reject-invalide) et `settings-transfer.e2e-spec.ts` (export contient `language`, import avec/sans/valeur invalide). |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|------------------|---------------------------|--------|--------------------|
| `settings.entity.ts` / migrations | Colonne ajoutée avec défaut | Faible | Pattern éprouvé 7 fois désormais. |
| `import-settings.dto.ts` | Nouveau champ optionnel | Faible | Ne pas oublier ce fichier (piège identifié lors de l'US-023). |

---

## Frontend

### Vue d'ensemble du mécanisme

```
localStorage (mrboard.language.v1) ──┐
                                      ▼
              provideI18n() (APP_INITIALIZER, bloque le 1er rendu)
                                      │
                                      ▼
              TranslateService.load(langue initiale)
                 ├─ fetch i18n/fr.json  (toujours : sert de repli, RG-022-07)
                 └─ fetch i18n/<langue>.json (si ≠ fr)
                                      │
                                      ▼
              TranslateService.language (signal) + document.documentElement.lang
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                    ▼
        TranslatePipe (lit `language()` → réactif)   LanguageService (préférence, aperçu,
                                                       synchro localStorage depuis SettingsStore)
                                      ▲
                                      │ setPreview() / clearPreview()
                     MiscellaneousSectionComponent (radio « Langue »)
```

### Réactivité du changement de langue (point critique)

Contrairement au thème (bascule purement CSS via `data-theme`, RG-018-07), changer de langue doit re-déclencher
**tous** les usages du pipe `translate` déjà rendus à l'écran, y compris dans des composants `OnPush` qui n'ont par
ailleurs aucune autre raison d'être revérifiés. La solution : `TranslateService` expose son état actif sous forme de
signal `language`, et `TranslatePipe.transform()` **lit ce signal** (même sans utiliser sa valeur dans le résultat) :

```ts
transform(key: string, params?: TranslationParams): string {
  this.service.language(); // établit la dépendance réactive du binding hôte
  return this.service.translate(key, params);
}
```

Angular (signals + `OnPush`, sans zoneless ici — `app.config.ts` n'active pas `provideZonelessChangeDetection`,
mais le suivi des signaux lus pendant l'exécution d'un template s'applique de la même façon) enregistre cette
lecture comme dépendance de la vue hôte : quand `language` change, **exactement** les vues utilisant `| translate`
sont reprogrammées pour un contrôle, où le pipe (déjà impur) est réinvoqué et renvoie la nouvelle valeur. Sans cette
lecture de signal, rien ne garantit qu'une vue déjà stable soit revérifiée après un changement de langue survenu
en dehors d'elle.

### Nouveau module `core/language/` (miroir de `core/theme/`)

| Fichier | Rôle |
|---------|------|
| `language-storage.ts` | `LANGUAGE_STORAGE_KEY = 'mrboard.language.v1'`, `readStoredLanguage()` / `writeStoredLanguage()` — même tolérance aux erreurs que `theme-storage.ts`. |
| `language.service.ts` | `LanguageService` : `persisted` (depuis `SettingsStore`), `preview` (RG-022-03), `preference` = `preview() ?? persisted()`. Un `effect()` recopie `settings.language` dans `localStorage` **et** appelle `translateService.load(settings.language)` à chaque chargement des paramètres (RG-022-04) ; un second `effect()` appelle `translateService.load(preference())` à chaque changement d'aperçu. `setPreview(lang)` / `clearPreview()` — mêmes signatures que `ThemeService`. |
| `provide-language.ts` | `provideLanguage()` : instancie `LanguageService` au démarrage via `provideEnvironmentInitializer`, comme `provideTheme()`. |
| `testing.ts` | Si besoin d'un helper de test (a priori aucun stub externe requis, contrairement à `matchMedia` pour le thème). |

> Contrairement à `ThemeService`, `LanguageService` ne manipule **aucun** attribut DOM lui-même : `document.documentElement.lang`
> est posé par `TranslateService.load()` (voir plus bas), pas par `LanguageService`.

### `TranslateService` — réécriture pour le multi-dictionnaire

- Nouveau signal public `readonly language = signal<Language>('fr')`.
- Cache interne `private readonly dictionaries = new Map<Language, TranslationDictionary>()`.
- `private dictionary: TranslationDictionary = {}` (dictionnaire actif) et
  `private fallback: TranslationDictionary = {}` (toujours `fr`, RG-022-07).
- `async load(language: Language = 'fr'): Promise<void>` remplace la signature actuelle sans paramètre :
  1. `Promise.all([ensure('fr'), language === 'fr' ? Promise.resolve() : ensure(language)])`, où `ensure(lang)`
     fetch `i18n/<lang>.json` **une seule fois** par langue (mémoïsé dans `dictionaries`) — en cas d'échec HTTP,
     mémoïse un dictionnaire vide `{}` et logue un avertissement (comportement actuel conservé, juste paramétré).
  2. `this.dictionary = dictionaries.get(language) ?? {}`, `this.fallback = dictionaries.get('fr') ?? {}`.
  3. `this.language.set(language)`.
  4. `document.documentElement.lang = language` (RG-022-11 — posé ici, pas dans `index.html`, car `provideAppInitializer`
     bloque déjà le tout premier rendu : pas besoin du script anti-flash inline utilisé par le thème, RG-018-05).
  5. `this.loaded.set(true)`.
  - **Idempotent** : rappeler `load('en')` deux fois ne refait pas de requête HTTP (langues déjà en cache) — c'est
    ce mécanisme, et lui seul, qui sert à la fois au chargement initial et à un changement de langue en cours de
    session (pas de méthode `switchLanguage` séparée).
- `translate(key, params)` : cherche dans `dictionary`, puis dans `fallback` si absent (RG-022-07), sinon
  comportement actuel (clé brute + avertissement une fois).
- `use(dictionary, language: Language = 'fr')` (test helper) : peuple `dictionaries.set(language, dictionary)` et,
  si `language === 'fr'`, l'utilise aussi comme repli — **rétrocompatible** avec tous les appels existants
  `service.use({...})` (paramètre par défaut).

### `provideI18n()` — langue initiale

```ts
export function provideI18n(): EnvironmentProviders {
  return provideAppInitializer(() =>
    inject(TranslateService).load(readStoredLanguage() ?? 'fr'),
  );
}
```

`readStoredLanguage()` importé de `core/language/language-storage.ts` — lecture **synchrone**, avant tout appel
réseau, cohérente avec RG-022-04 (« aucun flash »).

### `app.config.ts`

Ajouter `provideLanguage()` à la suite de `provideTheme()`.

### Dictionnaires

| Tâche | Description |
|-------|-------------|
| Créer `frontend/public/i18n/en.json` | Traduction complète des 217 clés actuelles (voir RG-022-09 pour le vocabulaire de référence ; le Dev complète pour l'exhaustivité). Même structure exacte que `fr.json` (mêmes chemins de clés, mêmes `{{paramètres}}`). |
| Créer un test de parité | Nouveau fichier, ex. `frontend/src/app/core/i18n/dictionary-parity.spec.ts` : importe `fr.json` et `en.json`, aplatit récursivement les deux arbres en ensembles de chemins de clés + ensembles de noms de paramètres `{{…}}` extraits par regex de chaque valeur, et vérifie l'égalité stricte des deux ensembles (`toEqual` sur des tableaux triés) ; vérifie aussi qu'aucune valeur n'est une chaîne vide. Satisfait entièrement le critère Gherkin « Parité des dictionnaires » (le script CLI `i18n:check` reste hors périmètre, voir § Points à clarifier). |

### Formats localisés (`shared/format/`)

- **`format-date.ts`** : `formatShortDate(iso, language: Language = 'fr')` et `formatDateTime(iso, language: Language = 'fr')`
  gagnent un second paramètre : en `en`, `YYYY-MM-DD` (resp. `YYYY-MM-DD HH:mm`) au lieu de `JJ/MM/AAAA` (resp.
  `JJ/MM/AAAA HH:mm`) — implémentation manuelle, pas d'`Intl` (cohérent avec l'existant). **`formatTime` ne change
  pas** (RG-022-10 : l'heure `HH:mm` est identique dans les deux langues) — ne pas lui ajouter de paramètre inutile.
- **`format-number.ts`** : `formatThousands(n, language: Language = 'fr')` — séparateur `' '` en `fr`, `','` en `en`.
- Import de `Language` depuis `models/settings.model.ts` (déjà le cas pour d'autres types partagés, ex.
  `Difficulty` importé par `difficulty-badge.component.ts`).

### Composants et fonctions à mettre à jour pour passer la langue courante

| Fichier | Modification |
|---------|---------------|
| `shared/difficulty-badge/difficulty-badge.component.ts` | `i18n` déjà injecté : passer `this.i18n.language()` aux 3 appels `formatThousands(...)` du `computed() tooltip`. |
| `shared/ready-delay/ready-delay.component.ts` | `i18n` déjà injecté : passer `this.i18n.language()` à `formatDateTime(readyAt, ...)`. |
| `features/settings/sections/gitlab-connection/gitlab-connection-section.component.ts` | `i18n` déjà injecté : passer `this.i18n.language()` à `formatShortDate(result.expiresAt, ...)`. |
| `features/board/mr-table/mr-table.component.ts` | `i18n` déjà injecté (`private`) : ajouter `protected readonly language = this.i18n.language;` pour l'exposer au template. |
| `features/board/mr-table/mr-table.component.html` | `{{ formatShortDate(row.createdAt, language()) }}` et `formatDateTime(row.createdAt, language())` dans le tooltip de la colonne « Ouverte ». |

`features/board/sync-status-label.ts` (`computeNextRunTooltip`, utilisé par `board-toolbar.component.ts`) **n'a pas
besoin de changer** : il n'utilise que `formatTime`, invariant par langue (RG-022-10).

### Formulaire des paramètres

| Tâche | Description |
|-------|--------------|
| `SettingsFormControls` | Ajouter `language: FormControl<Language>` (à côté de `theme`). |
| `buildSettingsForm()` | `language: new FormControl<Language>('fr', { nonNullable: true })`. |
| `resetSettingsForm()` | `form.controls.language.reset(settings.language);`. |
| `resetSettingsFormToDefaults()` | `controls.language.setValue('fr');` — **ne déclenche pas** d'aperçu immédiat (comportement identique à `theme`, `setValue` programmatique ne passe pas par `(change)`, voir US-018 : « Réinitialiser » ne change que le formulaire, pas l'aperçu live). |
| `toUpdateRequest()` | Déstructurer et renvoyer `language`. |

### Section « 06 · Divers » — contrôle « Langue »

- **`miscellaneous-section.component.ts`** : injecter `LanguageService` (comme `ThemeService`) ; `protected readonly languageOptions: readonly Language[] = ['fr', 'en'];` (ou une constante exportée `LANGUAGE_OPTIONS`, miroir frontend de celle du backend — pas de partage de code entre les deux projets, à dupliquer comme `THEME_OPTIONS` l'est déjà) ; `protected onLanguageChange(language: Language): void { this.languageService.setPreview(language); }`.
- **`miscellaneous-section.component.html`** : un bloc `.language-field`, **immédiatement après** `.theme-field`,
  copiant exactement sa structure (`block-title` + `mat-radio-group` + `(change)`) :

  ```html
  <div class="language-field">
    <div class="block-title">{{ 'settings.misc.language.title' | translate }}</div>
    <mat-radio-group
      formControlName="language"
      [attr.aria-label]="'settings.misc.language.title' | translate"
      (change)="onLanguageChange($event.value)"
    >
      <mat-radio-button value="fr">Français</mat-radio-button>
      <mat-radio-button value="en">English</mat-radio-button>
    </mat-radio-group>
  </div>
  ```

  ⚠️ **Exception délibérée et spécifiée à la règle « aucun texte en dur »** (RG-022-02) : les libellés « Français »
  et « English » sont des **endonymes**, jamais traduits, contrairement à toutes les autres chaînes de
  l'application — ce n'est **pas** un oubli à corriger en revue.
- **`.language-field`** dans `miscellaneous-section.component.scss` : reprendre le style de `.theme-field` (à
  vérifier dans le fichier SCSS existant — probablement `display:flex; flex-direction:column; gap:...`).

### Page Paramètres

- **`settings-page.component.ts`** : injecter `LanguageService` et ajouter
  `this.destroyRef.onDestroy(() => this.languageService.clearPreview());` à côté de la ligne équivalente pour
  `themeService` (même raisonnement RG-022-03 / RG-018-03 : l'aperçu ne doit pas survivre à la navigation hors de
  l'écran, qu'on ait cliqué « Enregistrer » ou « Annuler »).

### `index.html`

Aucune modification requise : `lang="fr"` reste la valeur par défaut du HTML statique (filet de sécurité si JS ne
s'exécute pas) ; la valeur effective est posée par `TranslateService.load()` avant le premier rendu Angular (le
bootstrap est déjà bloqué par l'`APP_INITIALIZER`, contrairement au thème qui a besoin d'un script inline parce que
le CSS, lui, s'applique avant même l'exécution de JS).

### `docs/tech/i18n.md`

À mettre à jour en fin d'implémentation (Dev) : §1 (deux fichiers `fr.json`/`en.json`), §3 (mention du signal
`language` et de la réactivité du pipe), §4 (règle de repli RG-022-07, mention du test de parité).

---

## Points de vigilance globaux

- **Le point le plus risqué de cette US** est la réactivité du pipe décrite plus haut : à tester explicitement
  (montrer un composant `OnPush` déjà rendu, changer la langue ailleurs dans l'application, vérifier que son texte
  change sans `detectChanges()` manuel dans le test — ou avec, mais alors le test doit d'abord prouver que le
  changement se propage **sans** action de test supplémentaire dans un scénario d'intégration réaliste).
- **Latence du changement de langue** : contrairement au thème (instantané), passer de `fr` à `en` implique une
  requête HTTP (`i18n/en.json`, non mise en cache la première fois). RG-022-03 accepte explicitement ce délai
  (« quelques dizaines de ms ») : ne pas essayer de le masquer par un état de chargement supplémentaire non
  spécifié.
- **`ImportSettingsDto`** : ne pas oublier ce fichier (piège déjà rencontré et documenté lors de l'US-023).
- **Volume de traduction** : 217 clés à traduire intégralement en anglais est le poste de travail le plus long de
  cette US ; RG-022-09 fournit un vocabulaire de référence mais ne couvre pas les 217 clés individuellement — le
  Dev doit traduire le fichier complet, pas seulement les entrées listées.
- **Aucune régression sur le thème** : `LanguageService` et `ThemeService` sont deux services indépendants,
  chacun avec son propre `effect()` sur `SettingsStore.settings()` — ne pas les fusionner.

---

## Ordre de réalisation suggéré

1. Backend : migration `AddLanguageSetting` + entité `Settings` + `LANGUAGE_OPTIONS`.
2. Backend : `UpdateSettingsDto`, `SettingsResponseDto`, `ImportSettingsDto`, `SettingsService` + tests unitaires.
3. Backend : tests e2e (`settings.e2e-spec.ts`, `settings-transfer.e2e-spec.ts`).
4. Frontend : `models/settings.model.ts` (`Language`, `Settings.language`, `UpdateSettingsRequest.language`).
5. Frontend : `TranslateService` (multi-dictionnaire, signal `language`, repli fr) + tests unitaires — **avant** le reste, tout en dépend.
6. Frontend : `TranslatePipe` (lecture du signal) + test de réactivité.
7. Frontend : `core/language/` (`language-storage.ts`, `language.service.ts`, `provide-language.ts`) + tests unitaires.
8. Frontend : `provideI18n()` + `app.config.ts`.
9. Frontend : `frontend/public/i18n/en.json` (traduction complète) + test de parité des dictionnaires.
10. Frontend : `shared/format/format-date.ts` et `format-number.ts` (paramètre `language`) + tests unitaires.
11. Frontend : mise à jour des call sites (`difficulty-badge`, `ready-delay`, `gitlab-connection-section`, `mr-table`) + tests.
12. Frontend : `settings-form.ts` (contrôle `language`) + tests unitaires.
13. Frontend : `MiscellaneousSectionComponent` (radio « Langue ») + `SettingsPageComponent` (`clearPreview` au destroy) + tests unitaires.
14. Frontend : `docs/tech/i18n.md` mis à jour.
15. Validation manuelle : parcours complet de l'application en anglais (tableau, filtres, paramètres, dialogs, toasts, notification navigateur), en clair et en sombre.
