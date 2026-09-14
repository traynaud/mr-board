# Architecture — US-021 Forges dans le tableau

## Résumé fonctionnel
Le tableau distingue la forge et la connexion d'origine de chaque MR (icône, infobulle, filtre « Connexion »,
messages de synchro/notifications nommant la connexion) dès qu'il en existe plusieurs. En prime (§0 des specs), la
section Paramètres « 02 · Connexions » absorbe la section « 03 · Repos à scanner » : chaque connexion, dépliée,
gère désormais ses propres repos — la section séparée disparaît.

---

## Backend

### Impacts sur le modèle de données
Aucun changement de schéma, aucune migration. Un seul ajustement de validation :
- **`connections.name`** (`CreateConnectionDto`/`UpdateConnectionDto`) : ajouter un `@Matches(/^[^,;]*$/)` (message
  `connections.nameInvalidChars`) en complément des validateurs existants (`MaxLength`, `IsNotEmpty`) — RG-021-04
  complète RG-019-01 : un nom de connexion ne peut contenir ni `,` ni `;` (utilisés comme séparateurs CSV dans
  `?connection=` et dans la pastille). Nouveau code d'erreur i18n `errors.connections.nameInvalidChars`.

### Intégration dans les modules existants
- **`modules/merge-requests/`** : `connection` devient un 6ᵉ filtre composable, au même niveau que
  `project`/`author`/`assigned`/`approved`/`commented`. Le champ `connection: ConnectionSummaryDto` du DTO de
  réponse existe déjà (livré par US-019, RG-019-22) — rien à ajouter côté assemblage de la vue.
- **`modules/sync/`, `modules/connections/`** : aucun changement de comportement. `SyncService`/`summarizeSyncRun`
  produisent déjà un `errorMessage` nommant la connexion (RG-019-16, RG-020-*) — réutilisé tel quel par le frontend
  (voir « Points de vigilance »).

### Contrat API
| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/merge-requests` | + `connection=<noms CSV>` (insensible à la casse) | inchangé | 200 |
| GET | `/api/v1/merge-requests/facets` | + `connection=<noms CSV>` | + `connection: FacetOptionDto[]` | 200 |
| POST/PUT | `/api/v1/connections` | `name` refuse désormais `,`/`;` | 400 `connections.nameInvalidChars` | 400 |

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| Étendre `FilterableMergeRequest`/`ComposableFilters`/`FilterKey` (`domain/filter-merge-requests.ts`) | Fonction pure | Ajouter `connection: { name: string }` au type structurel, `connection: string[]` aux filtres, `'connection'` à `ALL_KEYS` ; `matchesConnection` compare en `toLowerCase()` (RG-021-05, seul filtre insensible à la casse — les autres comparent des alias/usernames déjà normalisés) |
| Étendre `buildFacets` (`domain/build-facets.ts`) | Fonction pure | Ajouter un paramètre `configuredConnections: { name: string }[]` (même pattern que `configuredProjects`) et une entrée `connection: FacetOption[]` (`value`/`label` = nom, trié alphabétiquement, compteur via `applyComposableFiltersExcept('connection', …)`) |
| Étendre `MergeRequestsService.getFacets` | Service | Charger `this.connections.findAll()` (déjà fait dans `loadBase`, à dupliquer ou factoriser) et le passer à `buildFacets` |
| Étendre `MergeRequestFilterQueryDto` | DTO | `connection?: string[]` avec le même `@Transform(toArray)` que `project`/`author`/`assigned` |
| Étendre `MergeRequestsFacetsDto` | DTO | Ajouter `connection!: FacetOptionDto[]` |
| Étendre `toComposableFilters` (`merge-requests.controller.ts`) | Controller | `connection: query.connection ?? []` |
| Ajouter `@Matches` sur `name` | DTO | `create-connection.dto.ts` + `update-connection.dto.ts`, RG-021-04 |
| Tests unitaires | Test | `filter-merge-requests.spec.ts`, `build-facets.spec.ts`, `merge-requests.service.spec.ts`, `merge-requests.controller.spec.ts`, tests DTO du nom de connexion (`connections.service.spec.ts` ou `connections.controller.spec.ts` selon où la règle est déjà testée pour `MaxLength`) |
| Tests e2e | Test | Cas « filtrer par connexion », « facet connexion », « nom de connexion avec virgule refusé » dans les specs e2e existantes de `merge-requests`/`connections` |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `filter-merge-requests.ts` | Ajout d'une clé à `ALL_KEYS`/`ComposableFilters`/`EMPTY_COMPOSABLE_FILTERS` | Faible | Type structurel déjà en duck-typing avec `MergeRequestViewDto` (qui porte `connection`) — aucun mapping supplémentaire au site d'appel |
| `merge-requests.controller.spec.ts` / `.service.spec.ts` | Les fixtures de test devront porter un champ `connection` cohérent | Faible | Mettre à jour les factories de test existantes (US-019 les a déjà introduites) |

---

## Frontend

### Intégration dans les features existantes
- **`features/board/`** : icône de forge + infobulle sur le tag projet (`mr-table`), 6ᵉ filtre « Connexion »
  (`filter-bar`, `add-filter-menu`, `filter-pill` — génériques, aucune modification structurelle requise au-delà de
  la liste des clés), tooltip + toast de synchro nommant la connexion (`board-toolbar`, `board-page`), notification
  navigateur nommant la connexion (`merge-requests.store`).
- **`features/settings/`** : fusion de `RepositoriesSectionComponent` dans `ConnectionsSectionComponent` (§0),
  suppression de la section « 03 · Repos à scanner », renumérotation des sections suivantes.
- Aucune nouvelle route.

### Composants réutilisables et Angular Material
| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-icon svgIcon="gitlab"/"github"` | `shared/icons/provide-icons.ts` | **Déjà enregistrées** (utilisées par `connections-section`) — réemploi direct dans le tag projet, 12 px via `[style.width/height.px]` ou classe utilitaire, `currentColor` déjà natif au SVG |
| `matTooltip` | Angular Material (CDK) | Infobulle du tag projet (RG-021-02), tooltip de synchro en échec (RG-021-06) |
| `mat-expansion-panel` **ou** pattern maison (chevron + `@if`) | Angular Material / existant | Ligne de connexion repliable (§0) — voir `design.md` pour le choix retenu |
| `FilterPillComponent`/`AddFilterMenuComponent` | `features/board/filter-bar` | Déjà génériques sur `FilterKey` — aucune duplication de composant pour « Connexion » |

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| `FilterKey` += `'connection'`, `ALL_FILTER_KEYS`, `isMultiValueFilter` | Modèle | `models/merge-request.model.ts` : `ComposableFilters.connection: string[]`, `EMPTY_COMPOSABLE_FILTERS`, `MergeRequestsFacets.connection`, ordre `['connection', 'project', 'author', 'assigned', 'approved', 'commented']` (RG-021-03 : Connexion en tête) |
| `AddFilterMenuComponent` : masquage conditionnel | Composant | Nouvel `input<boolean>('showConnectionFilter')` (câblé depuis `BoardPageComponent` sur `connectionsStore.connections().length > 1`) ; `allKeys` devient un `computed` filtrant `'connection'` de `ALL_FILTER_KEYS` quand `false` (RG-021-03, QO-021-02) |
| `FiltersStore` | SignalStore | `connection: string[]` dans l'état, `composableFilters`, `restore`, `removeFilter` (déjà générique via `isMultiValueFilter`), élargir l'union `toggleMultiValue`/`setMultiValue` à `'connection'` |
| `MergeRequestsStore.reconcileSelections` | Service/Store | Ajouter `'connection'` à la liste des clés réconciliées (RG-010-09 étendue à RG-021-03 : une connexion supprimée retire son filtre, cf. scénario specs) |
| `query-params.mapper.ts` | Fonction pure | `UrlState.connection: string[]`, `decodeListFilter('connection', …)`, `encodeQueryParams` (déjà générique via `isMultiValueFilter`) |
| `BoardPageComponent` | Composant | Câbler `connection` dans `currentQueryParams`, `restoreFromUrl`, `onFilterToggleValue` (ajouter `'connection'` à la liste de clés acceptées) |
| `mr-table.component.html/scss` | Composant | Icône de forge conditionnelle avant `row.projectAlias` (RG-021-01, visible seulement si `connectionsStore` expose ≥ 2 types) + `[matTooltip]` du tag (RG-021-02) ; nouvel `input<boolean>('showForgeIcon')` calculé par `BoardPageComponent` |
| `board.filters.pills.names.connection` + clés `board.filters.connectionTooltip.*` | i18n | `fr.json`/`en.json` |
| `sync-status-label.ts` | Fonction pure | Nouvelle fonction `computeSyncFailureDetail(lastRun: SyncRun \| null): string \| null` → `lastRun.errorMessage` si `status` ∈ {`partial`, `error`}, sinon `null` (RG-021-06) |
| `board-toolbar.component.ts/.html` | Composant | Nouvel `input<string \| null>('failureDetail')` ; `[matTooltip]` du `sync-label` devient `failureDetail() ?? (nextRunTooltip().key | translate: …)` (le détail d'échec prime sur le tooltip « prochaine synchro ») |
| `board-page.component.ts` | Composant | Toast de fin de synchro (`board.sync.toastPartial`/`toastError` comme **préfixes**, plus `lastRun.errorMessage` concaténé) au lieu du texte statique actuel ; passer `failureDetail` calculé au toolbar |
| `assignment-diff.ts` | Fonction pure | `NewAssignment.connectionName: string` (`mr.connection.name`) |
| `merge-requests.store.ts` | Store | `notifyNewAssignments` : injecter `ConnectionsStore`, corps de la notification = `` `[${connectionName} · ${projectAlias}] ${title}` `` si ≥ 2 connexions, sinon `title` seul (comportement actuel, RG-021-08) |
| **§0** — `ConnectionsSectionComponent` | Composant | Fusionne l'affichage : chaque ligne devient repliable/dépliable (état local `expandedId` remplaçant `openForm` pour le mode liste, tout en conservant le mode formulaire d'édition/ajout à l'intérieur de la carte dépliée) ; dépliée, affiche formulaire (RG-019-11 inchangé) **puis** `<app-repositories-section>` scopée à cette connexion ; nouvel `input.required<RepoRow[]>('rows')` (liste complète, filtrée en interne par `connection.id`) |
| **§0** — `RepositoriesSectionComponent` | Composant | Devient scopé à une connexion : `input.required<Connection>('connection')` remplace la logique `showConnectionSelector` ; suppression du `mat-select` « Connexion » et de la colonne « Connexion » du tableau ; `addRepo()` envoie toujours `connectionId: this.connection().id` ; message « Configurez d'abord le jeton de cette connexion » (RG-021-00b) affiché à la place de la ligne d'ajout quand `!connection().tokenConfigured` |
| **§0** — `settings-page.component.html/.ts` | Composant | Retrait du bloc `<app-settings-section number="03">…<app-repositories-section [rows]="repoRows()" />…`, `repoRows` passé directement à `<app-connections-section [rows]="repoRows()" />` ; renumérotation `settings.refresh/thresholds/misc.number` (`"04"→"03"`, `"05"→"04"`, `"06"→"05"`) |
| **§0** — i18n | i18n | Suppression de `settings.projects.{number,title,description,connectionHeader}` ; déplacement de `settings.projects.{pathHeader,aliasHeader,pathPlaceholderGitlab,pathPlaceholderGithub,aliasPlaceholder,add,remove,added,removed,loadError,deleteConfirm}` vers `settings.connections.repos.*` ; `settings.connections.list.repoCount` (« {{count}} dépôts ») ; réutiliser `errors.connections.tokenMissing` (déjà existant) pour RG-021-00b plutôt que dupliquer une clé — **dans `fr.json` ET `en.json` simultanément** (`dictionary-parity.spec.ts`, RG-019-26) |
| **§0** — Tests unitaires | Test | `connections-section.component.spec.ts` (déplié/replié, repos nichés), `repositories-section.component.spec.ts` (scope connexion unique), `settings-page.component.spec.ts` (plus de section 03, `repoRows` transmis à `connections-section`), `dictionary-parity.spec.ts` (déjà générique, passera si les deux fichiers sont synchrones) |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `add-filter-menu.component.ts` | `allKeys` devient un `computed` au lieu d'une constante | Faible | Signature de `input()` avec défaut `true`, aucun appelant existant cassé |
| `board-toolbar.component.ts` | Le tooltip du `sync-label` change de source selon le contexte | Faible | Le comportement RG-013-07 (tooltip « prochaine synchro ») reste inchangé quand `failureDetail()` est `null` — vérifier `board-toolbar.component.spec.ts` existant |
| `board-page.component.ts` | Le toast de synchro n'est plus un texte statique | Moyen | Le test `board-page.component.spec.ts` qui vérifie le texte du toast (`board.sync.toastError`) devra être mis à jour pour vérifier la composition dynamique |
| `repos-form.ts` (`RepoRow.connectionName`) | Champ devenu inutile à l'affichage (colonne supprimée) | Faible | Conserver le champ (inoffensif, US-019 l'a introduit) ou le retirer si plus aucun test/consommateur n'y fait référence — au choix du dev |
| `merge-requests.store.spec.ts`, `assignment-diff.spec.ts` | Fixtures à enrichir de `connection` | Faible | Étendre les factories de test existantes |

---

## Points de vigilance globaux

- **⚠️ Écart de formulation RG-021-06** : les specs illustrent le format attendu par « github.com/equipe/front-web :
  jeton refusé », alors que `SyncService`/`summarizeSyncRun` (livrés par US-019/US-020, déjà testés) produisent un
  format différent mais tout aussi informatif : `"<alias>: Jeton refusé (<connexion>)"` pour un échec de projet, ou
  `"Aucun jeton (<connexion>) : <alias1>, <alias2>"` pour une connexion entière sans jeton. **Recommandation** :
  réutiliser `lastRun.errorMessage` tel quel côté frontend (tooltip + toast) plutôt que de reformater le backend —
  cela évite de toucher une logique déjà couverte par `summarize-sync-run.spec.ts`/`sync.service.spec.ts` pour un
  gain cosmétique. Le QA devra valider le libellé réellement produit plutôt que la chaîne exacte des specs
  (illustrative). À confirmer en Phase 3 si le dev préfère malgré tout aligner le format exact.
- **RG-021-06 ne s'applique qu'aux statuts `partial`/`error`** : RG-004-08 traite déjà `partial` comme un succès
  visuel dans le libellé de la toolbar (« Synchronisé… », sans accent) — ceci reste inchangé ; seul le **tooltip**
  du libellé et le **toast** de fin de synchro portent le détail des échecs, sans changer l'apparence du libellé
  lui-même pour un run `partial`.
- **RG-021-01/RG-021-03/RG-021-08** dépendent tous de la même condition « ≥ 2 connexions » ou « ≥ 2 types de forge » :
  centraliser ces deux booléens (ex. `connectionsStore` expose des `computed` `hasMultipleConnections`/
  `hasMultipleForgeTypes`) plutôt que de recalculer l'inline à chaque appelant.
- **§0 — non-régression RG-003-07** : le renommage d'alias reste différé au bouton « Enregistrer » global
  (`form.controls.repos`, `FormArray` porté par `SettingsPageComponent`) — la restructuration ne doit **pas**
  faire passer le renommage en immédiat. `repoRows()` (signal de page) doit continuer à zipper `projects()` et
  `form.controls.repos` par index ; seule sa **présentation** (regroupée par connexion) change, jamais la
  construction du `FormArray` lui-même.
- **§0 — état déplié transitoire** : conserver le principe déjà en place pour `openForm` (RG-019-11, confirmation
  d'abandon si le formulaire est modifié) au moment de replier/déplier une autre connexion — pas de perte silencieuse
  de saisie.
- **i18n** : toute clé ajoutée/supprimée/renommée doit l'être simultanément dans `fr.json` et `en.json`
  (`dictionary-parity.spec.ts`, RG-019-26) — particulièrement sensible ici vu le volume de clés déplacées (§0).
- **Aucune icône à créer** : `gitlab`/`github` sont déjà enregistrées dans `shared/icons/provide-icons.ts`.

---

## Ordre de réalisation suggéré
1. Backend : filtre/facet « Connexion » (`domain/`, DTOs, controller, service) + tests unitaires/e2e
2. Backend : validation du nom de connexion (`,`/`;` interdits) + tests
3. Frontend — modèles/URL : `merge-request.model.ts`, `filters.store.ts`, `query-params.mapper.ts`
4. Frontend — tableau : icône de forge + infobulle (`mr-table`), filtre « Connexion » (menu conditionnel)
5. Frontend — synchro/notifications : tooltip + toast de synchro, notification navigateur
6. Frontend — **§0** : restructuration Paramètres (fusion connexions/repos, renumérotation, i18n)
7. Tests unitaires frontend (stores, composants, fonctions pures) + validation manuelle contre le prototype (écrans
   2a/2b) avec 1 puis 2 connexions (dont 2 types de forge différents)
