# Architecture — US-009 Filtres rapides « Drafts » et « Mes MRs »

## Résumé fonctionnel
Deux chips toujours visibles au-dessus du tableau : « Drafts » (masqués par défaut) et « Mes MRs » (désactivé si
identité non configurée). Le backend filtre et calcule `isMine` ; le frontend pose la structure de la barre de
filtres (chips, compteur, « Effacer ») et une nouvelle `FiltersStore`.

---

## Backend

### Impacts sur le modèle de données
Aucun changement de schéma, aucune migration. `drafts`/`mine` sont des paramètres de requête, pas des colonnes.

### ⚠️ Changement de contrat API — réponse enveloppée

`GET /api/v1/merge-requests` doit désormais pouvoir renvoyer `warnings: ["identity.missing"]` (RG-009-02, scénario
« Identité non configurée »). Un tableau JSON nu ne peut pas porter ce champ : la réponse devient

```ts
export class MergeRequestsResponseDto {
  mergeRequests!: MergeRequestViewDto[];
  warnings!: string[]; // toujours présent, [] la plupart du temps
}
```

**Impact** : les ~11 tests e2e existants (US-005 à US-008 dans `merge-requests.e2e-spec.ts`) lisent aujourd'hui
`res.body` comme le tableau directement — ils doivent tous passer à `res.body.mergeRequests`. Confirmé et accepté en
Phase 1 (aucune alternative fidèle au scénario Gherkin qui interroge l'API en direct).

### Intégration dans les modules existants

- **Nouveau** `domain/is-mine.ts` — fonction pure `isMine(subject, identity)` (RG-G09).
- **`merge-requests.module.ts`** : ajoute `SettingsModule` aux imports (même pattern que `SyncModule` →
  `SettingsModule` déjà en place) pour injecter `SettingsService` dans `MergeRequestsService`.
- **`settings.service.ts`** : nouvelle méthode `getIdentity()`, sur le modèle exact de `getGitlabUrl()`/`getToken()`
  (méthodes d'accès étroites déjà exportées pour un usage inter-module).
- **`merge-request-query.dto.ts`** : deux champs optionnels `drafts`/`mine` (`'0'|'1'`, `@IsIn`), même pattern que
  `sort`.
- **`merge-request-view.dto.ts`** : ajout `isMine: boolean` (RG-009-06, toujours renvoyé).
- **`merge-requests.controller.ts`** : type de retour `MergeRequestsResponseDto`.
- **`merge-requests.service.ts`** (`listOpen`) : signature refactorée en objet d'options (voir Contrat API) —
  déjà 3 paramètres logiques (`sort`, `drafts`, `mine`), un objet est plus lisible que 3 positionnels booléens/union.

### Contrat API

| Méthode | Route | Query | Réponse | Codes |
|---------|-------|-------|---------|-------|
| GET | `/api/v1/merge-requests` | `sort` (inchangé US-008) + `drafts=0\|1` (défaut `0`) + `mine=0\|1` (défaut `0`) | `MergeRequestsResponseDto` | 200, 400 si `sort`/`drafts`/`mine` invalide |

`domain/is-mine.ts` :

```ts
export interface MergeRequestIdentitySubject {
  authorUsername: string;
  reviewerUsernames: string[];
  assigneeUsernames: string[];
}
export interface Identity {
  username: string | null;
  email: string | null;
}

/**
 * RG-G09 : une MR est « à moi » si mon username (ou, à défaut, mon email)
 * correspond — insensible à la casse — à l'auteur, un reviewer ou un
 * affecté.
 * ⚠️ Limitation connue (validée en Phase 1) : les enregistrements
 * auteur/reviewer/affecté ne portent jamais d'email (l'API GitLab n'expose
 * pas l'email d'un tiers, et `User` ne le stocke pas) — le repli sur
 * `identity.email` ne peut donc jamais trouver de correspondance en
 * pratique. Implémenté fidèlement à la règle malgré cette limitation.
 */
export function isMine(subject: MergeRequestIdentitySubject, identity: Identity): boolean { /* ... */ }
```

`merge-requests.service.ts` :

```ts
export interface ListOpenOptions {
  sort?: SortParam;
  includeDrafts?: boolean;
  mineOnly?: boolean;
}

async listOpen(options: ListOpenOptions = {}): Promise<MergeRequestsResponseDto> { /* ... */ }
```

Algorithme :
1. `find({ where: includeDrafts ? {} : { draft: false } })` — plus de tri SQL (inchangé depuis US-008).
2. Résout l'identité via `this.settings.getIdentity()`.
3. Assemble les `MergeRequestViewDto[]` comme aujourd'hui, `toMergeRequestView` calcule en plus `isMine` via
   `isMine({ authorUsername, reviewerUsernames, assigneeUsernames }, identity)` (toujours calculé, RG-009-06).
4. Si `mineOnly` : si `identity.username === null && identity.email === null` → ne filtre pas, `warnings =
   ['identity.missing']` ; sinon → `views = views.filter(v => v.isMine)`.
5. `sortMergeRequests(views, sort)` (US-008, inchangé).
6. `return { mergeRequests: sorted, warnings };`

`merge-requests.controller.ts` :

```ts
@Get()
list(@Query() query: MergeRequestQueryDto): Promise<MergeRequestsResponseDto> {
  return this.mergeRequestsService.listOpen({
    sort: query.sort,
    includeDrafts: query.drafts === '1',
    mineOnly: query.mine === '1',
  });
}
```

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Créer `domain/is-mine.ts` (+ `.spec.ts`) | Fonction pure | RG-G09 : match auteur/reviewer(s)/affecté(s), insensible à la casse, plusieurs reviewers (scénario specs.md), identité vide → `false`, repli email documenté comme sans effet |
| Créer `dto/merge-requests-response.dto.ts` | DTO | `{ mergeRequests, warnings }` |
| Étendre `dto/merge-request-query.dto.ts` | DTO | `drafts?: '0'\|'1'`, `mine?: '0'\|'1'`, `@IsIn` |
| Étendre `dto/merge-request-view.dto.ts` | DTO | `isMine: boolean` |
| Étendre `settings.service.ts` (`getIdentity`) (+ `.spec.ts`) | Service | Accesseur étroit, même pattern que `getGitlabUrl`/`getToken` |
| Étendre `merge-requests.module.ts` | Module | Import `SettingsModule` |
| Étendre `merge-requests.service.ts` (`listOpen`) (+ `.spec.ts`) | Service | Signature par objet d'options, filtre drafts/mine, `warnings` |
| Étendre `merge-requests.controller.ts` (+ `.spec.ts`) | Controller | Retour `MergeRequestsResponseDto`, mapping query→options |
| Étendre `test/merge-requests.e2e-spec.ts` | Test e2e | **Migration** de tous les tests existants vers `res.body.mergeRequests` + nouveaux scénarios : drafts affichés/masqués + tri par `createdAt`, Mes MRs (auteur/reviewer/affecté, plusieurs reviewers), identité vide + `warnings`, combinaison drafts+mine, `isMine` présent sur chaque ligne |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `test/merge-requests.e2e-spec.ts` | ~11 tests migrés vers `res.body.mergeRequests` | Moyen (volume) | Mécanique, `MergeRequestViewBody` déplacé sous une interface `MergeRequestsResponseBody { mergeRequests: MergeRequestViewBody[]; warnings: string[] }` |
| `should_exclude_draft_merge_requests` | Devient conditionnel à `drafts` | Faible | Renommer `should_exclude_draft_merge_requests_by_default`, ajouter le pendant `drafts=1` |
| `merge-requests.service.spec.ts` | Tous les appels `service.listOpen()`/`listOpen('diff:asc')` deviennent `service.listOpen({})`/`listOpen({ sort: 'diff:asc' })` | Moyen (volume) | Mécanique |
| `merge-requests.controller.spec.ts` | `controller.list({})` retourne désormais l'enveloppe | Faible | Mettre à jour les mocks `service.listOpen` |

---

## Frontend

### Intégration dans les features existantes
- **Nouveau** `stores/filters.store.ts` — état `{ drafts, mine }` (RG-009-01/02), **indépendant** de
  `MergeRequestsStore` (pas d'injection croisée, voir Points de vigilance).
- **Nouveau** `features/board/filter-bar/` (déjà prévu dans `architecture-frontend.md`).
- `stores/merge-requests.store.ts` (US-005/008) : lit `FiltersStore` (`inject`), expose `warnings`, ajoute
  `scheduleReload()` (debounce 150 ms, RG-009-07).
- `board-page.component.{ts,html}` : compose `FiltersStore` + `SettingsStore` (identité) + `MergeRequestsStore`,
  affiche `<app-filter-bar>` au-dessus du tableau, adapte l'état vide (RG « Aucune MR ne correspond aux filtres »).

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-chip-listbox` / `mat-chip-option` | Angular Material | Chips « Drafts » / « Mes MRs » — le thème global (`--mat-sys-corner-*: 0px`) s'applique déjà sans override supplémentaire |
| `matTooltip` | Angular Material | Tooltip du chip « Mes MRs » désactivé (RG-009-03) — vérifier en dev que le tooltip reste déclenchable sur un chip `disabled` (Material bloque parfois `pointer-events` ; solution standard : englober dans un `<span matTooltip>`) |
| `md-icon` utilisateur (SVG inline) | `shared/icons` | Icône du chip « Mes MRs » (déjà utilisée dans le prototype) |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Créer `stores/filters.store.ts` (+ `.spec.ts`) | SignalStore | État `{ drafts: boolean; mine: boolean }` (défaut `false`/`false`) ; méthodes `toggleDrafts()`, `toggleMine()`, `clear()` (RG-009-05 : ne touche jamais `drafts`) — **pure état UI, aucun appel HTTP, aucune dépendance à `MergeRequestsStore`** |
| Créer `features/board/filter-bar/count-label.ts` (+ `.spec.ts`) | Fonction pure | `{ count, countSuffix, projects, projectsSuffix }` depuis les lignes affichées (RG-G20), pluriel géré en TS (pas d'infra i18n pluriel existante) |
| Créer `features/board/filter-bar/filter-bar.component.{ts,html,scss,spec.ts}` | Composant | 2 chips + séparateur + compteur + bouton « Effacer » (visible seulement si `mine`, RG-009-05) ; purement présentationnel (inputs `drafts`, `mine`, `identityConfigured`, `rows` ; outputs `draftsToggle`, `mineToggle`, `clearFilters`) |
| Étendre `models/merge-request.model.ts` | Types TS | `isMine: boolean` sur `MergeRequestView` ; `MergeRequestsResponse { mergeRequests, warnings }` ; `MergeRequestFilters { drafts, mine }` |
| Étendre `core/api/merge-requests.service.ts` (+ `.spec.ts`) | Service | `getMergeRequests(sort, filters)` ajoute `?drafts=0\|1&mine=0\|1`, retourne `Observable<MergeRequestsResponse>` |
| Étendre `stores/merge-requests.store.ts` (+ `.spec.ts`) | SignalStore | `load()` lit aussi `inject(FiltersStore)` ; état `warnings: string[]` ; nouvelle méthode `scheduleReload()` (debounce 150 ms via `setTimeout`/`clearTimeout` — premier debounce du projet, pas de `rxMethod` introduit pour ce seul cas, voir Points de vigilance) |
| Étendre `board-page.component.{ts,html}` (+ `.spec.ts`) | Intégration | `identityConfigured = computed(() => !!settingsStore.settings()?.meUsername \|\| !!settingsStore.settings()?.meEmail)` ; câblage `<app-filter-bar>` ; état vide contextuel (« Aucune MR ne correspond aux filtres » + « Effacer les filtres » quand `filtersStore.mine()` est actif et la liste est vide, sinon le texte US-005 inchangé) |
| Ajouter clés `board.filters.*` | i18n | `drafts`, `mine`, `mineDisabledTooltip`, `count`, `clear` |
| Étendre clé `board.mergeRequests.empty*` | i18n | Nouvelle clé `emptyFiltered` + `clearFilters` (texte bouton) |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `core/api/merge-requests.service.spec.ts` | La réponse mockée devient `{ mergeRequests, warnings }` | Faible | Mettre à jour les fixtures `req.flush(...)` |
| `stores/merge-requests.store.spec.ts` | `api.getMergeRequests` mocké renvoie désormais l'enveloppe ; nouveaux tests `scheduleReload`/`warnings` | Moyen | Mettre à jour les mocks existants + ajouter les cas |
| `board-page.component.spec.ts` | `http.expectOne('/api/v1/merge-requests?sort=ready:asc')` → `...&drafts=0&mine=0`, et `flush` doit renvoyer l'enveloppe | Moyen (volume, ~5 occurrences comme pour US-008) | Mécanique |
| `mr-table.component.ts`/`.html` | Aucun changement fonctionnel requis (RG-009-06 : `isMine` optionnel visuellement) | — | Pas de marquage visuel ajouté dans cette US, `isMine` seulement transporté dans le modèle pour usage futur |

---

## ⚠️ Points à clarifier / décisions d'architecture

1. **Pas d'injection croisée `FiltersStore` ↔ `MergeRequestsStore`** : `MergeRequestsStore.load()` lit
   `FiltersStore` (sens unique), mais `FiltersStore` n'injecte jamais `MergeRequestsStore` (un cycle de DI entre
   deux stores `providedIn: 'root'` échouerait). Le déclenchement du rechargement après un toggle de filtre se fait
   depuis `BoardPageComponent` (seul composant à composer plusieurs stores, convention déjà en place), qui appelle
   `mrStore.scheduleReload()` après chaque `filtersStore.toggleX()`/`clear()`.
2. **Debounce 150 ms (RG-009-07) en `setTimeout` simple**, pas de `rxMethod`/`debounceTime` : c'est le premier
   besoin de debounce du projet ; introduire `rxjs-interop` pour un seul appelant serait disproportionné. À
   reconsidérer si US-010/011 ajoutent d'autres déclencheurs debouncés.
3. **`isMine` non affiché visuellement** dans cette US (RG-009-06 le rend optionnel côté UI) — le champ est
   transporté par le modèle et testé côté backend/service, mais `mr-table`/`ready-delay`/`avatar` ne changent pas.
4. **Repli email (RG-G09) sans effet réel** — voir `domain/is-mine.ts` ci-dessus, déjà validé en Phase 1.
5. **`warnings` non exploité visuellement côté frontend** dans cette US (aucun critère d'acceptation ne demande de
   toast/bandeau) — stocké dans `MergeRequestsState.warnings` pour exactitude et usage futur.

---

## Points de vigilance globaux

- **Migration e2e volumineuse mais mécanique** (~11 tests) — faire tourner la suite complète après chaque lot de
  changements plutôt qu'en une seule passe, pour isoler rapidement une régression.
- **Chip désactivé + tooltip** : point d'attention Material connu (voir tableau composants) — à vérifier
  manuellement en dev, pas seulement via les tests unitaires (jsdom ne simule pas toujours fidèlement
  `pointer-events`).
- **Ordre des opérations dans `listOpen`** : filtrer `mineOnly` **avant** `sortMergeRequests` (pas d'impact sur le
  tri, mais plus clair et légèrement plus efficace).

---

## Ordre de réalisation suggéré
1. `domain/is-mine.ts` (fonction pure) + tests
2. `settings.service.ts` : `getIdentity()` + test
3. `dto/merge-requests-response.dto.ts`, extension de `merge-request-query.dto.ts` et `merge-request-view.dto.ts`
4. `merge-requests.module.ts` (import `SettingsModule`) + extension de `merge-requests.service.ts` (+ tests)
5. Extension de `merge-requests.controller.ts` (+ test)
6. Migration complète de `test/merge-requests.e2e-spec.ts` + nouveaux scénarios
7. `models/merge-request.model.ts` (frontend) + `core/api/merge-requests.service.ts` (+ tests)
8. `stores/filters.store.ts` (+ tests)
9. `stores/merge-requests.store.ts` : lecture des filtres, `warnings`, `scheduleReload` (+ tests)
10. `features/board/filter-bar/count-label.ts` (+ tests) puis `filter-bar.component.*` (+ tests) + i18n
11. `board-page.component.*` : câblage, état vide contextuel (+ tests)
