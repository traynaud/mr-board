# Architecture — US-015 Paramètres : options diverses

## Résumé fonctionnel
L'utilisateur règle deux options de confort (ouverture des MRs dans un nouvel onglet, masquage des MRs `wip`/
`on-hold`), peut exporter/importer sa configuration en JSON (hors jeton, repos fusionnés additivement) et
réinitialiser tout le formulaire Paramètres aux valeurs par défaut sans toucher au jeton ni aux repos.

---

## Backend

### Impacts sur le modèle de données

- **Entité modifiée** : `Settings` (`backend/src/modules/settings/entities/settings.entity.ts`) — 2 colonnes :

  | Colonne (DB)        | Propriété       | Type SQLite | Défaut |
  |----------------------|-----------------|-------------|--------|
  | `open_in_new_tab`    | `openInNewTab`  | boolean     | 0      |
  | `ignored_labels`     | `ignoredLabels` | text (JSON) | `'[]'` |

  `ignoredLabels` est stocké en JSON stringifié, comme `MergeRequest.labels` (même précédent, voir
  `merge-requests.service.ts`, `entity.labels = JSON.stringify(...)`).

- **Migration** : `AddMiscSettings<timestamp>` dans `backend/src/database/migrations/`, sur le modèle de
  `1757600600000-AddThresholdSettings.ts` (2 `ALTER TABLE "settings" ADD COLUMN`, `down` symétrique).

### Nouveau module `settings-transfer` (évite un cycle de modules)

⚠️ **Point d'architecture important** : `ProjectsModule` importe déjà `SettingsModule` (pour que
`ProjectsService` lise l'URL/le jeton via `SettingsService`). Faire l'inverse (`SettingsModule` important
`ProjectsModule` pour résoudre les repos importés) créerait un cycle de modules NestJS. Ne pas utiliser
`forwardRef` (aucun précédent dans le code) : suivre le précédent déjà établi par `MergeRequestsModule`, qui
importe **les deux** modules sans être importé par aucun des deux (`merge-requests.module.ts:19-21`).

- Nouveau dossier `backend/src/modules/settings-transfer/` :
  - `settings-transfer.module.ts` — `imports: [SettingsModule, ProjectsModule]`
  - `settings-transfer.controller.ts` — `@Controller('settings')` avec `@Get('export')` et `@Post('import')`
    (coexiste avec `SettingsController`, déjà `@Controller('settings')` avec des routes différentes — NestJS
    autorise plusieurs controllers sur le même préfixe tant que les chemins ne collisionnent pas)
  - `settings-transfer.service.ts` — orchestre `SettingsService` + `ProjectsService`, aucune des deux ne connaît
    ce nouveau module
  - `dto/export-config.dto.ts`, `dto/import-config.dto.ts`, `dto/import-result.dto.ts`
- Enregistrer `SettingsTransferModule` dans `app.module.ts` (aux côtés de `SettingsModule`/`ProjectsModule`).

### Contrat API

| Méthode | Route                     | Body / Query        | Réponse            | Codes |
|---------|----------------------------|----------------------|---------------------|-------|
| PUT     | `/api/v1/settings`         | `+openInNewTab, +ignoredLabels` | `SettingsResponseDto` | 200, 400 |
| GET     | `/api/v1/settings/export`  | —                    | `ExportConfigDto`   | 200   |
| POST    | `/api/v1/settings/import`  | `ImportConfigDto`    | `ImportResultDto`   | 200, 400 |

- `UpdateSettingsDto` : ajouter `openInNewTab?: boolean` (`@IsOptional() @IsBoolean()`) et
  `ignoredLabels?: string[]` (`@IsOptional() @IsArray() @IsString({ each: true })` — ne pas restreindre aux
  seules valeurs `wip`/`on-hold` : QO-015-01 anticipe une édition libre future).
- `SettingsResponseDto` : ajouter les 2 mêmes champs.
- `ExportConfigDto` : `{ version: 1; settings: Omit<SettingsResponseDto, 'tokenConfigured' | 'tokenHint'>; projects: { pathWithNamespace: string; alias: string }[] }`.
  Construit par `SettingsTransferService.export()` à partir de `SettingsService.get()` (en retirant les 2 champs
  token) + `ProjectsService.list()` (en ne gardant que `pathWithNamespace`/`alias`).
- `ImportConfigDto` : `{ version: number; settings: ImportSettingsDto; projects: ImportProjectDto[] }`, validé
  avec `@ValidateNested()` + `@Type(() => …)` (`class-transformer`, déjà une dépendance). `ImportSettingsDto`
  reprend exactement les champs de `UpdateSettingsDto` **sans** `gitlabToken` (ni `GitlabCredentialsDto.gitlabToken`)
  — un fichier contenant malgré tout un `gitlabToken` est rejeté en 400 par le `ValidationPipe` global
  (`forbidNonWhitelisted: true`), ce qui satisfait « le jeton n'est jamais importé » par construction.
  `ImportProjectDto` : `{ pathWithNamespace: string; alias: string }` (`@IsString()` sur les deux).
- `ImportResultDto` : `{ settings: SettingsResponseDto; projectsAdded: number; projectsUpdated: number; projectsSkipped: { pathWithNamespace: string; reason: string }[] }`.
- Un JSON structurellement invalide (`version` absent, `settings`/`projects` du mauvais type) est rejeté 400 par
  la validation des DTOs **avant** tout accès service/DB — satisfait « rien n'est modifié » sans code dédié.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Migration `AddMiscSettings` | Migration | 2 colonnes + défauts |
| Étendre `settings.entity.ts` | Entité | `openInNewTab`, `ignoredLabels` |
| Étendre `update-settings.dto.ts` / `settings-response.dto.ts` | DTO | 2 champs |
| Étendre `settings.service.ts` | Service | fusion des 2 champs dans `update()` (même chaîne `if (dto.X !== undefined)`), défauts de `load()` ; ajouter `getIgnoredLabels(): Promise<string[]>` (lu frais à chaque appel, même pattern que `getThresholds()`) ; ajouter `getExportableSettings(): Promise<Omit<SettingsResponseDto, 'tokenConfigured'\|'tokenHint'>>` ; ajouter `applyImportedSettings(dto: ImportSettingsDto): Promise<SettingsResponseDto>` réutilisant la même logique de fusion + `requireCoherentThresholds` que `update()` (extraire le corps commun en méthode privée partagée) |
| Créer `domain/is-ignored-by-label.ts` | Fonction pure | `isIgnoredByLabel(rawLabelsJson: string, ignoredLabels: string[]): boolean` — `JSON.parse` + comparaison insensible à la casse (RG-015-02) ; testée unitairement |
| Modifier `merge-requests.service.ts` (`loadBase`) | Service | après construction de `views` (et avant/après le filtre `mineOnly`, peu importe l'ordre — les deux sont des réductions non conditionnelles) : `views = views.filter(v => !isIgnoredByLabel(entityById.get(v.id)!.labels, ignoredLabels))` — nécessite de garder une correspondance `MergeRequest` par id le temps du filtre (ou de filtrer avant la projection en DTO, sur `mergeRequests` bruts, ce qui est plus simple : filtrer la liste `mergeRequests` juste après le `this.mergeRequests.find(...)`, avant la construction des vues) |
| Créer `settings-transfer.module.ts/controller.ts/service.ts` + DTOs | Module | voir ci-dessus |
| Étendre `projects.service.ts` | Service | `importMany(entries: { pathWithNamespace: string; alias: string }[]): Promise<{ added: number; updated: number; skipped: { pathWithNamespace: string; reason: string }[] }>` — pour chaque entrée : si un repo existant a le même `pathWithNamespace` (comparaison insensible à la casse), appelle `this.rename(existing.id, { alias })` ; sinon appelle `this.add({ path: entry.pathWithNamespace, alias: entry.alias })` ; capture toute `BusinessException` de l'un ou l'autre appel dans `skipped` (avec son `.code` comme `reason`) au lieu de laisser l'import entier échouer (RG-015-04, scénario « repo introuvable ») |
| Tests unitaires | Test | `settings.service.spec.ts` (2 champs, `getIgnoredLabels`, `getExportableSettings`, `applyImportedSettings`), `is-ignored-by-label.spec.ts`, `merge-requests.service.spec.ts` (filtrage par label appliqué aussi aux facets), `projects.service.spec.ts` (`importMany` : ajout, mise à jour d'alias, repo introuvable ignoré, alias en collision ignoré), `settings-transfer.service.spec.ts` |
| Tests e2e | Test | `test/settings-transfer.e2e-spec.ts` : export (contenu, absence du jeton), import valide, import invalide (400, rien de modifié), import avec repo introuvable (200 partiel + `projectsSkipped`) |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-------------------|-----------------------------|--------|---------------------|
| `merge-requests.service.ts` (`loadBase`) | Ajout d'un filtre sur les labels ignorés, en amont des filtres composables | Faible | Filtrer sur les entités `MergeRequest` brutes (avant projection), pas sur les DTOs — évite d'exposer `labels` dans `MergeRequestViewDto` (hors périmètre UI de cette US) |
| `settings.service.ts` (`update`) | Extraction de la logique de fusion en méthode privée partagée avec `applyImportedSettings` | Faible | Signature `mergeAndValidate(settings: Settings, dto: Pick<UpdateSettingsDto, ...>): void`, appelée par les deux |

---

## Frontend

### Intégration dans les features existantes

- Feature `features/settings` : nouvelle section présentationnelle-mais-avec-orchestration
  `sections/miscellaneous/miscellaneous-section.component.ts` (checkboxes + boutons Export/Import), insérée
  après la section « 05 · Seuils » dans `settings-page.component.html` (`[last]="true"` déplacé dessus).
- Bouton « Réinitialiser » ajouté dans la toolbar de `settings-page.component.html`, à côté de « Annuler ».
- Feature `features/board` : `MrTableComponent` reçoit un nouvel `input()` `openInNewTab`, alimenté par
  `BoardPageComponent` depuis `settingsStore.settings()?.openInNewTab`.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `MatCheckbox` | Angular Material | `openInNewTab`, `ignoreWip`, et les 2 cases désactivées US-016 |
| `MatTooltip` | Angular Material | « Bientôt disponible » sur les cases US-016 |
| `ConfirmDialogComponent` | `shared/confirm-dialog` | Résumé de confirmation avant import (nécessite une extension, voir ci-dessous) |
| `MatButton` (`mat-stroked-button`) | Angular Material | Export / Import / Réinitialiser, comme le bouton « Tester la connexion » existant |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Étendre `models/settings.model.ts` | Interface TS | `openInNewTab`, `ignoredLabels` sur `Settings`/`UpdateSettingsRequest` ; nouveaux `ExportConfig`, `ImportConfig`, `ImportResult` |
| Étendre `core/api/settings.service.ts` | Service Angular | `getExportConfig(): Observable<ExportConfig>` (`GET api://settings/export`), `postImportConfig(request: ImportConfig): Observable<ImportResult>` (`POST api://settings/import`) |
| Étendre `stores/settings.store.ts` | SignalStore | `exportConfig(): Promise<ExportConfig \| null>`, `importConfig(request: ImportConfig): Promise<ImportResult \| string>` (retourne la clé d'erreur i18n en cas d'échec, même convention que `save()`) |
| Créer `features/settings/config-transfer.ts` | Fonctions pures | `parseImportFile(rawText: string): ImportConfig \| null` (JSON.parse + vérification de forme minimale : `version`, `settings` objet, `projects` tableau) et `summarizeImport(config: ImportConfig, currentPaths: string[]): { settingsCount: number; totalRepos: number; newRepos: number }` — testables sans DOM/FileReader |
| Étendre `settings-form.ts` | Formulaire | `openInNewTab: FormControl<boolean>`, `ignoreWip: FormControl<boolean>` (UI ; converti vers/depuis `ignoredLabels: string[]` dans `toUpdateRequest`/`resetSettingsForm`), `DEFAULT_IGNORED_LABELS = ['wip', 'on-hold'] as const`, `DEFAULT_GITLAB_URL` (nouvelle constante, miroir du défaut backend) ; nouvelle fonction `resetSettingsFormToDefaults(form)` (RG-015-05 — ne touche ni `gitlabToken` ni `repos`) distincte de `resetSettingsForm` (qui recharge depuis le serveur) |
| Étendre `shared/confirm-dialog/confirm-dialog.component.ts` | Composant partagé | Ajouter `messageParams?: Record<string, unknown>` optionnel à `ConfirmDialogData`, propagé au pipe `translate` du template (`{{ data.messageKey \| translate: data.messageParams }}`) — rétrocompatible avec l'usage existant (`repositories-section`) qui ne le passe pas |
| Créer `sections/miscellaneous/miscellaneous-section.component.ts/html/scss/spec.ts` | Composant | 4 checkboxes (2 actives + 2 désactivées `matTooltip` US-016), bouton Export (construit un `Blob` + lien `download` éphémère, RG-015-03 — premier usage de ce pattern dans le repo), bouton Import (déclenche un `<input type="file" hidden>`, lit via `File.text()`, `parseImportFile`, ouvre `ConfirmDialogComponent` avec le résumé, poste via le store) |
| Modifier `settings-page.component.html/.ts` | Intégration | section Divers + bouton « Réinitialiser » (`resetSettingsFormToDefaults(this.form)` puis toast `settings.reset.done`) |
| Modifier `mr-table.component.ts/.html` | Composant | `openInNewTab = input<boolean>(false)` ; `[target]="openInNewTab() ? '_blank' : '_self'"` sur l'ancre du titre (`mr-table.component.html:37`) |
| Modifier `board-page.component.html` | Intégration | `[openInNewTab]="settingsStore.settings()?.openInNewTab ?? false"` sur `<app-mr-table>` |
| Ajouter clés i18n | i18n | voir ci-dessous |
| Tests unitaires | Test | `config-transfer.spec.ts`, `settings-form.spec.ts` (nouveaux champs + `resetSettingsFormToDefaults`), `confirm-dialog.component.spec.ts` (nouveau param), `miscellaneous-section.component.spec.ts`, `settings-page.component.spec.ts` (bouton Réinitialiser), `mr-table.component.spec.ts` (target selon `openInNewTab`), `settings.store.spec.ts` (export/import) |

### Clés i18n à ajouter (`public/i18n/fr.json`, bloc `settings`)

```
settings.reset.button = "Réinitialiser"
settings.reset.done = "Valeurs par défaut restaurées (non enregistrées)"
settings.misc.number = "06"
settings.misc.title = "Divers"
settings.misc.description = "Options de confort et sauvegarde de la configuration."
settings.misc.openInNewTab = "Ouvrir les MRs dans un nouvel onglet"
settings.misc.ignoreWip = "Ignorer les MRs avec le label wip / on-hold"
settings.misc.notifyAssigned = "Notification navigateur quand une MR m'est affectée"
settings.misc.tabBadge = "Badge de compteur sur l'onglet (MRs en rouge)"
settings.misc.comingSoon = "Bientôt disponible"
settings.misc.export = "Exporter la config (JSON)"
settings.misc.import = "Importer"
settings.misc.importInvalid = "Fichier de configuration invalide."
settings.misc.importConfirm.title = "Importer la configuration ?"
settings.misc.importConfirm.message = "{{settingsCount}} paramètres, {{totalRepos}} repos ({{newRepos}} nouveaux)"
settings.misc.importConfirm.confirm = "Importer"
settings.misc.importConfirm.cancel = "Annuler"
settings.misc.importSuccess = "Configuration importée."
settings.misc.importSkipped = "Repos ignorés : {{paths}}"
errors.settings.importInvalid = "Fichier de configuration invalide."
```

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-------------------|-----------------------------|--------|---------------------|
| `thresholds-section.component.ts/.html` (US-014) | **Suppression** du lien « Valeurs par défaut » et de `resetDefaults()` | Faible | Couvert désormais par le bouton global « Réinitialiser » (RG-015-05 dit explicitement remplacer ce lien) ; supprimer aussi les tests dédiés (`should_reset_to_default_thresholds...`) et migrer leur intention vers `settings-page.component.spec.ts` |
| `confirm-dialog.component.ts` | Ajout d'un champ optionnel | Aucun | Rétrocompatible, valeur par défaut `undefined` |
| `settings-form.ts` (`resetSettingsForm`) | Aucun changement de comportement, mais coexiste avec la nouvelle `resetSettingsFormToDefaults` | Faible | Bien nommer/documenter la différence (recharge serveur vs remise à zéro) pour éviter toute confusion pour un futur lecteur |

---

## Points de vigilance globaux

- **Cycle de modules backend** : voir encadré ci-dessus — ne pas faire dépendre `SettingsModule`/`ProjectsModule`
  l'un de l'autre dans le sens inverse de l'existant.
- **`labels` reste interne** : ne pas ajouter `labels` à `MergeRequestViewDto` — rien dans les specs ni les
  maquettes ne demande une colonne d'affichage des labels ; le filtrage se fait sur les entités brutes.
- **Sécurité** : `ImportSettingsDto` ne doit **jamais** déclarer `gitlabToken` — c'est ce qui garantit son rejet
  par le `ValidationPipe` (`forbidNonWhitelisted`) si un fichier trafiqué en contient un.
- **Export ≠ téléchargement serveur** : le backend renvoie du JSON classique ; c'est le frontend qui construit le
  `Blob` et déclenche le téléchargement (aucun `Content-Disposition` côté NestJS à gérer, cohérent avec une API
  100 % JSON).
- **`importMany` et absence de jeton** : si aucun jeton n'est configuré, toute résolution GitLab d'un nouveau
  repo échoue (chaque appel à `add()` lève `MissingConfigurationException`) — attendu, ces repos atterrissent
  dans `skipped` avec `reason: 'settings.tokenMissing'`, sans bloquer les mises à jour d'alias des repos déjà
  configurés (qui n'appellent pas GitLab).
- **Performance** : `importMany` réutilise `add()`/`rename()` tels quels (requêtes DB par repo) — volume
  attendu très faible (config manuelle), pas d'optimisation nécessaire.

---

## Ordre de réalisation suggéré

1. Migration TypeORM + colonnes d'entité `Settings`
2. `update-settings.dto.ts` / `settings-response.dto.ts` — 2 champs + tests
3. `domain/is-ignored-by-label.ts` + tests, intégration dans `merge-requests.service.ts` (`loadBase`) + tests
4. `SettingsService.getExportableSettings()` / `applyImportedSettings()` / `getIgnoredLabels()` + tests
5. `ProjectsService.importMany()` + tests
6. Module `settings-transfer` (DTOs, controller, service) + tests unitaires + e2e
7. Frontend : modèles, `core/api/settings.service.ts`, `SettingsStore` (export/import)
8. `config-transfer.ts` (fonctions pures) + tests
9. `settings-form.ts` (nouveaux champs, `resetSettingsFormToDefaults`) + tests
10. `ConfirmDialogComponent` (extension `messageParams`) + tests
11. `miscellaneous-section.component.*` + intégration `settings-page` (section + bouton Réinitialiser) + i18n + tests
12. `mr-table`/`board-page` (`openInNewTab`) + tests
13. Suppression du lien « Valeurs par défaut » de `thresholds-section` (US-014) + migration des tests
14. Validation manuelle contre le prototype (à l'exception du bouton Import, absent du prototype — voir specs.md)
