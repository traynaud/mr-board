# Architecture — US-018 Thème sombre

## Résumé fonctionnel
L'utilisateur choisit un thème `system` / `light` / `dark` dans Paramètres › Divers (aperçu immédiat, persisté au
« Enregistrer ») ou bascule directement entre clair et sombre via une icône dans la toolbar du tableau (persistée
immédiatement) ; l'ensemble de l'application (tokens CSS + surcharges Material) suit ce choix sans flash au chargement.

---

## Backend

### Impacts sur le modèle de données

- **Entité modifiée** : `Settings` (`backend/src/modules/settings/entities/settings.entity.ts`) — ajout de la colonne
  `theme` (`text`, `NOT NULL DEFAULT 'system'`). Pas de contrainte SQL d'énumération (SQLite) : la validation
  `system|light|dark` est faite exclusivement en DTO (`@IsIn`), comme `refreshIntervalMin`.
- **Migration** : `backend/src/database/migrations/<timestamp>-AddThemeSetting.ts`, suffixe temporel supérieur à
  `1757600900000` (dernière migration existante). Modèle : `1757600800000-AddNotificationSettings.ts`.
  ```sql
  ALTER TABLE "settings" ADD COLUMN "theme" text NOT NULL DEFAULT ('system')
  ```
  `down()` : `DROP COLUMN "theme"`.

### Intégration dans les modules existants

- **`modules/settings`** : `Settings`, `UpdateSettingsDto`, `SettingsResponseDto`, `SettingsService` (déjà porteurs
  de tous les autres champs « Divers » — RG-015). Aucun nouveau service, aucun nouveau contrôleur : `theme` suit
  exactement le chemin de `openInNewTab`/`tabBadge`.
- **`modules/settings-transfer`** (US-015, export/import) : `ImportSettingsDto` (mirroir de `UpdateSettingsDto`),
  `ExportConfigDto` (réutilise `ExportableSettings` de `SettingsService`) — pas de nouveau fichier, deux DTOs à
  étendre.
- **Bascule rapide toolbar (RG-018-12)** : **aucun nouvel endpoint**. Le frontend appelle le `PUT /api/v1/settings`
  existant avec seulement `{ gitlabUrl, theme }` — `mergeCommonFields` ne touche que les champs fournis, donc les
  autres réglages restent inchangés. C'est le même mécanisme qu'un `PUT` partiel classique de cette API.

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|---------------|---------|-------|
| GET | `/api/v1/settings` | — | `SettingsResponseDto` (+ `theme`) | 200 |
| PUT | `/api/v1/settings` | `UpdateSettingsDto` (+ `theme?: 'system'\|'light'\|'dark'`) | `SettingsResponseDto` | 200, 400 (`theme` invalide → `IsIn` → message `ValidationPipe` standard, RG-018 « Valeur invalide ») |
| GET | `/api/v1/settings/export` | — | `ExportConfigDto` (`settings.theme`) | 200 |
| POST | `/api/v1/settings/import` | `ImportConfigDto` (`settings.theme?`) | `ImportResultDto` | 200, 400 |

Aucune route nouvelle.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer migration `AddThemeSetting` | Migration | Colonne `theme` texte, défaut `'system'` |
| Étendre `Settings` | Entité TypeORM | Colonne `theme: 'system' \| 'light' \| 'dark'` (typée en TS ; SQLite reste `text`) |
| Étendre `UpdateSettingsDto` | DTO | `theme?: ...`, `@IsOptional() @IsIn(THEME_OPTIONS)` ; exporter `THEME_OPTIONS = ['system','light','dark'] as const` (même pattern que `REFRESH_INTERVAL_OPTIONS`) |
| Étendre `SettingsResponseDto` | DTO | `theme!: 'system' \| 'light' \| 'dark'` |
| Étendre `SettingsService` | Service | `MergeableSettingsFields.theme?`, `ExportableSettings.theme`, `mergeCommonFields` (merge conditionnel), `load()` (défaut `'system'` à la recréation de la ligne), `toResponse()`, `getExportableSettings()` |
| Étendre `ImportSettingsDto` (settings-transfer) | DTO | `theme?: ...`, réutilise `THEME_OPTIONS` exporté par `update-settings.dto.ts` |
| Étendre les tests `settings.service.spec.ts`, `settings.controller.spec.ts`, `settings-transfer.service.spec.ts` | Test unitaire | Cas par défaut, merge, export, import (absent → `'system'`) |
| Étendre `test/settings.e2e-spec.ts` | Test e2e | `PUT` avec `theme`, `PUT` avec valeur invalide → 400, `GET` reflète la valeur |
| Étendre `test/settings-transfer.e2e-spec.ts` | Test e2e | Export contient `theme`, import sans `theme` → `'system'` |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `settings.entity.ts` | Ajout colonne `NOT NULL DEFAULT 'system'` | Faible | Migration avec défaut SQL, aucune donnée existante à backfiller manuellement |
| `settings.service.ts` (`load()`) | Ajout de `theme: 'system'` dans les valeurs de recréation de la ligne singleton | Faible | Cohérent avec le défaut de la migration |
| `import-settings.dto.ts` | Nouveau champ optionnel | Faible | Un fichier exporté avant US-018 reste importable (`theme` absent → `'system'`, RG-018-01) |

---

## Frontend

### Intégration dans les features existantes

- **Nouveau service transverse** `core/theme/theme.service.ts` (`providedIn: 'root'`), au même niveau que
  `core/i18n`, `core/notifications` — pas rattaché à une feature, consommé par `features/board` (toolbar) et
  `features/settings` (section Divers).
- **`features/settings/sections/miscellaneous`** : ajout du contrôle « Thème » en tête de section (RG-018-02),
  dans le composant existant `MiscellaneousSectionComponent` (pas de nouveau composant de section — la maquette
  1c montre le contrôle dans la section `06 · Divers` existante).
- **`features/board/board-toolbar`** : ajout du bouton icône de bascule rapide (RG-018-12), entre « Rafraîchir »
  et « Paramètres ».
- **`index.html`** : script inline anti-flash (RG-018-05), avant `<app-root>`.
- Aucune nouvelle route.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `MatRadioModule` (`mat-radio-group`) | Angular Material | Contrôle « Thème » — même pattern que `RefreshSectionComponent` (`interval-group` / `refreshIntervalMin`) |
| `MatIconButton` + `MatIcon` + `MatTooltip` | Angular Material | Bouton de bascule toolbar, même pattern que le bouton « Paramètres » du toolbar existant |
| `MatIconRegistry` (icônes Lucide inline) | `shared/icons/provide-icons.ts` | Deux nouvelles icônes `sun` et `moon` à ajouter au registre |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `core/theme/theme.model.ts` | Interface TS | `ThemePreference = 'system' \| 'light' \| 'dark'`, `EffectiveTheme = 'light' \| 'dark'` |
| Créer `core/theme/theme-storage.ts` | Fonctions pures | `readStoredTheme()` / `writeStoredTheme()` sur `localStorage['mrboard.theme.v1']`, résilientes (try/catch, valeur invalide → `null`/ignorée), modèle : `column-widths.store.ts` |
| Créer `core/theme/theme.service.ts` | Service (signalStore ou classe à signals) | Voir design.md §« ThemeService ». Expose `preference`, `effective`, `setPreview`, `clearPreview`, `save` (Enregistrer du formulaire), `quickToggle` (bascule toolbar) |
| Créer `core/theme/provide-theme.ts` | Provider | `provideTheme()` — force l'instanciation précoce de `ThemeService` via `provideEnvironmentInitializer` (même pattern que `provideI18n`/`provideIcons`), à ajouter dans `app.config.ts` |
| Créer `core/theme/theme.service.spec.ts` | Test unitaire | Résolution `system`/`light`/`dark`, écoute `matchMedia`, préview/clear, `quickToggle` |
| Modifier `index.html` | Script inline | Lecture `localStorage['mrboard.theme.v1']` avant `<app-root>`, pose `data-theme` sur `<html>` (voir design.md) |
| Étendre `shared/icons/provide-icons.ts` | Icônes | Ajouter `sun` et `moon` (paths Lucide, voir design.md) |
| Étendre `models/settings.model.ts` | Interface TS | `Settings.theme`, `UpdateSettingsRequest.theme?` |
| Étendre `features/settings/settings-form.ts` | Formulaire | `SettingsFormControls.theme: FormControl<ThemePreference>`, `buildSettingsForm`, `resetSettingsForm`, `resetSettingsFormToDefaults` (défaut `'system'`), `toUpdateRequest` |
| Étendre `features/settings/sections/miscellaneous/miscellaneous-section.component.{ts,html}` | Composant | `mat-radio-group` « Thème » en tête (RG-018-02), appelle `themeService.setPreview()` sur `(change)` en plus du binding `formControlName` (le preview est un effet de bord, pas une valeur de formulaire supplémentaire) |
| Étendre `features/settings/settings-page.component.ts` | Composant | Sur `ngOnDestroy`/`DestroyRef.onDestroy` : `themeService.clearPreview()` (RG-018-03, restaure le thème enregistré à la sortie, y compris après confirmation d'abandon par le guard) |
| Étendre `features/board/board-toolbar/board-toolbar.component.{ts,html}` | Composant | Nouveaux `input()` `themeIcon: 'sun'\|'moon'`, `themeToggleLabel: string`, `output()` `themeToggle` |
| Étendre `features/board/board-page.component.ts` | Composant | Injecte `ThemeService`, calcule les inputs du toolbar, gère `(themeToggle)` → `themeService.quickToggle()` + toast d'erreur en cas d'échec (même pattern que les autres erreurs de cette page) |
| Ajouter clés `settings.misc.theme.*`, `board.toolbar.theme*` | i18n | `public/i18n/fr.json` — voir design.md pour la liste |
| Étendre `frontend/src/styles.scss` | Styles globaux | Bloc `:root:not([data-theme="light"]) { @media (prefers-color-scheme: dark) {...} }` et `:root[data-theme="dark"] {...}` avec les tokens RG-018-08, plus les surcharges `--mat-sys-*` |
| Auditer les composants pour hex en dur | Nettoyage | RG-018-07 : grep exhaustif (`#fff`/`color: *#`/`background: *#`) ne trouve que deux occurrences à corriger : `styles.scss` L.151 (`.mrb-toast { ... color: #fff }`) et `shared/avatar/avatar.component.scss` L.12 (`.filled { color: #fff }`) — remplacer les deux par `var(--color-bg)`, exactement la technique de la maquette |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `settings-form.ts` | Nouveau `FormControl` non lié à un input existant | Faible | Valeur par défaut `'system'`, aucun impact sur les champs existants |
| `miscellaneous-section.component.ts` | Ajout d'un effet de bord (`setPreview`) en plus du form binding | Faible | `setPreview` est idempotent et ne touche aucun état persistant |
| `board-toolbar.component.ts` | Nouveaux inputs/output | Faible | Composant déjà conçu pour recevoir ses données par inputs (`running`, `lastRun`, `refreshDisabled`) — même pattern |
| `styles.scss` | Ajout d'un bloc de surcharge dark important en volume | Moyen | Regrouper dans une section dédiée et clairement commentée (`// Thème sombre — US-018`) pour ne pas polluer les tokens clairs existants |
| `.mrb-toast` (`color: #fff`) et `avatar.component.scss` (`.filled { color: #fff }`) | Remplacement par `var(--color-bg)` | Faible | Vérifié sur les deux thèmes : `--color-bg` est toujours la teinte la plus contrastée avec `--color-neutral-800/900`, dans les deux sens (clair : bg clair sur neutral-900 sombre ; sombre : bg sombre sur neutral-900 devenu clair par inversion de la rampe RG-018-08) |

---

## ⚠️ Points à clarifier

- **Icône de la bascule toolbar** : le wireframe statique (`Wireframes -sombre-.dc.html`, écrans 1a/1b, thème sombre
  actif) affiche l'icône **lune** avec l'infobulle « Thème clair », alors que le prototype interactif affiche le
  **soleil** quand le thème effectif est sombre (`isDark → sun`, `isLight → moon`). Il s'agit très probablement
  d'une incohérence du wireframe statique (copié-collé sans changer l'icône). **Décision retenue** : suivre la
  logique du prototype interactif, plus fiable — `sun` quand le thème effectif est sombre (« passer en clair »),
  `moon` quand il est clair (« passer en sombre »). À confirmer visuellement en QA contre le prototype, pas le
  wireframe statique.
- **`--color-accent-500` sombre absent de la maquette** (RG-018-08) : vérifié, ce token n'est actuellement consommé
  nulle part dans le frontend (déclaré mais jamais utilisé, y compris en clair). Le définir en sombre par cohérence
  (`~#dd2b0f`, valeur de `--color-accent-600` clair) sans y passer de temps supplémentaire.
- **RG-018-12 (bascule toolbar pendant l'édition de Paramètres)** : dans l'implémentation actuelle, le bouton de
  bascule toolbar n'existe que sur `BoardToolbarComponent` (route `/`), jamais affiché sur `/settings` (toolbar
  différente, sans ce bouton d'après la maquette 1c). Le cas « bascule cliquée pendant que le formulaire Paramètres
  est ouvert » décrit par la spec est donc **inatteignable via l'UI actuelle** ; aucune protection applicative
  supplémentaire n'est nécessaire.

---

## Ordre de réalisation suggéré

1. Migration TypeORM + colonne `theme` sur `Settings`
2. Backend : DTOs (`UpdateSettingsDto`, `SettingsResponseDto`, `ImportSettingsDto`) + `SettingsService`
   (merge/export/import/défauts) + tests unitaires
3. Backend : tests e2e (`settings.e2e-spec.ts`, `settings-transfer.e2e-spec.ts`)
4. Frontend : `theme.model.ts`, `theme-storage.ts`, `ThemeService` + tests unitaires
5. Frontend : `provideTheme()` dans `app.config.ts`, script anti-flash dans `index.html`
6. Frontend : tokens CSS sombres + surcharges `--mat-sys-*` dans `styles.scss`, audit hex en dur
7. Frontend : icônes `sun`/`moon`, i18n
8. Frontend : `settings-form.ts` + section Divers (contrôle Thème, aperçu, clear au destroy)
9. Frontend : `board-toolbar` (bouton) + `board-page` (câblage, gestion d'erreur)
10. Validation manuelle contre le prototype interactif (`MR Board - Prototype.dc.html`) en clair et en sombre,
    tous les écrans de RG-018-09
