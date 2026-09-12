# Architecture — US-008 Tri par défaut et tri sur colonnes

## Résumé fonctionnel
Le backend trie la liste des MRs selon un paramètre de requête (`sort=ready:asc|ready:desc|diff:asc|diff:desc`,
défaut `ready:asc`) ; le frontend affiche des en-têtes cliquables « Difficulté » et « Depuis Ready » avec indicateur
visuel (↑/↓/↕, couleur accent) et déclenche un rechargement au clic — sans jamais re-trier lui-même.

---

## Backend

### Impacts sur le modèle de données
Aucun changement de schéma, aucune migration. Le tri porte sur des champs déjà calculés en mémoire par
`toMergeRequestView` (`readyAt`, `difficulty`) — pas de colonne SQL supplémentaire nécessaire.

### Intégration dans les modules existants

- **Nouveau** `domain/sort-merge-requests.ts` — fonction pure `sortMergeRequests`, sur le modèle de
  `calculate-difficulty.ts`/`calculate-ready-delay.ts` (même dossier, même convention de nommage verbe-nom).
- **`domain/calculate-difficulty.ts`** : ajout additif d'un export `DIFFICULTY_ORDER` (rang numérique par
  difficulté), réutilisé par `sort-merge-requests.ts` — évite de dupliquer la connaissance de l'ordre
  easy < medium < hard dans deux fichiers.
- **Nouveau** `dto/merge-request-query.dto.ts` — `MergeRequestQueryDto` avec un champ `sort` optionnel, validé par
  `class-validator` (`@IsIn`), premier DTO de **query params** du projet (les DTOs existants sont tous des DTOs de
  body).
- **`merge-requests.controller.ts`** : `@Get()` reçoit désormais `@Query() query: MergeRequestQueryDto`.
- **`merge-requests.service.ts`** : `listOpen(sort: SortParam = DEFAULT_SORT)` — le tri SQL (`order: { readyAt:
  'ASC' }`) actuel de la requête `find()` est retiré : le tri final dépend de `difficulty`, une valeur calculée
  après lecture (à partir de `changedFiles`/`changedLines`), donc impossible à exprimer entièrement en SQL sans
  dupliquer les seuils de difficulté dans une expression `ORDER BY CASE…` — le tri est fait en mémoire sur les DTOs
  déjà assemblés, une fois pour les deux clés (`ready` et `diff`), cohérent avec la façon dont le prototype
  (`docs/design/MR Board - Prototype.dc.html`, lignes 385-387) trie lui aussi le tableau déjà mappé plutôt que la
  source brute.

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/merge-requests` | `?sort=ready:asc\|ready:desc\|diff:asc\|diff:desc` (optionnel, défaut `ready:asc`) | `MergeRequestViewDto[]` (inchangé) | 200, 400 si `sort` invalide |

`domain/sort-merge-requests.ts` :

```ts
export type SortKey = 'ready' | 'diff';
export type SortDirection = 'asc' | 'desc';
export type SortParam = 'ready:asc' | 'ready:desc' | 'diff:asc' | 'diff:desc';

export const SORT_PARAMS: readonly SortParam[] = ['ready:asc', 'ready:desc', 'diff:asc', 'diff:desc'];
/** RG-008-01. */
export const DEFAULT_SORT: SortParam = 'ready:asc';

export interface SortableMergeRequest {
  iid: number;
  draft: boolean;
  /** `null` pour un draft (invariant RG-004-04) ; ignoré si `draft`. */
  readyAt: string | null;
  createdAt: string;
  difficulty: Difficulty;
}

/**
 * Ordonne les MRs selon RG-G10/RG-008-01/04/05 : bloc Ready trié par
 * `sort`, toujours avant le bloc Draft (lui-même toujours trié par
 * `createdAt` croissant, quelle que soit la direction de `sort`).
 */
export function sortMergeRequests<T extends SortableMergeRequest>(items: T[], sort: SortParam): T[] { /* ... */ }
```

Algorithme (RG-008-04) :
1. Partitionner `items` en `ready` (`!draft`) et `drafts` (`draft`) — filtre avec garde de type sur `readyAt` pour
   les items `ready` (pas de `!` non justifié : `items.filter((i): i is T & { readyAt: string } => !i.draft &&
   i.readyAt !== null)`).
2. `ready.sort(...)` : comparateur = `(compare(readyAt) || compare(DIFFICULTY_ORDER))` si `key === 'ready'`, l'ordre
   inverse des deux termes si `key === 'diff'` ; tie-break final sur `iid` croissant ; l'ensemble du résultat
   (primaire + tie-breaks) est multiplié par `+1`/`-1` selon `direction` (RG-008-04 : « en décroissant, l'ordre
   complet est inversé » — y compris les tie-breaks, pas seulement le critère primaire).
3. `drafts.sort(...)` : toujours par `createdAt` croissant puis `iid`, **jamais** affecté par `direction` (RG-008-05).
4. Retourner `[...ready, ...drafts]`.
5. Comparaisons de dates via `Date.parse(...)` (nombres), pas `localeCompare` sur les chaînes ISO — plus robuste à
   d'éventuelles différences de précision (`Z` vs `.000Z`).

`merge-request-query.dto.ts` :

```ts
export class MergeRequestQueryDto {
  @IsOptional()
  @IsIn(SORT_PARAMS)
  sort?: SortParam;
}
```

`merge-requests.controller.ts` : `list(@Query() query: MergeRequestQueryDto)` appelle
`this.mergeRequestsService.listOpen(query.sort ?? DEFAULT_SORT)`.

`merge-requests.service.ts` — `listOpen` :
1. `find({ where: { draft: false } })` (le tri SQL est retiré, voir ci-dessus).
2. Assemble les `MergeRequestViewDto[]` comme aujourd'hui (US-005/006/007).
3. `return sortMergeRequests(views, sort);`

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Créer `domain/sort-merge-requests.ts` (+ `.spec.ts`) | Fonction pure | Algorithme ci-dessus, testé exhaustivement : les 6 scénarios Gherkin de `specs.md` §5, plus les 4 combinaisons clé×direction, plus égalités (même `difficulty`, même `readyAt`), plus tie-break `iid`, plus bloc Drafts non affecté par `direction` |
| Étendre `domain/calculate-difficulty.ts` (+ `.spec.ts`) | Fonction pure | Ajout additif de `DIFFICULTY_ORDER` |
| Créer `dto/merge-request-query.dto.ts` (+ test via e2e) | DTO | `sort` optionnel, `@IsIn(SORT_PARAMS)` |
| Étendre `merge-requests.controller.ts` (+ `.spec.ts`) | Controller | `@Query() query: MergeRequestQueryDto` |
| Étendre `merge-requests.service.ts` (`listOpen`) (+ `.spec.ts`) | Service | Signature `listOpen(sort: SortParam = DEFAULT_SORT)`, appel à `sortMergeRequests` |
| Étendre `test/merge-requests.e2e-spec.ts` | Test e2e | `?sort=diff:asc` / `diff:desc` / `ready:desc` renvoient l'ordre attendu ; `?sort=title:asc` → 400 ; pas de `sort` → comportement `ready:asc` (déjà couvert par le test existant `should_be_sorted_by_ready_at_ascending`, à conserver tel quel) |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `merge-requests.service.ts` (`listOpen`) | Signature `listOpen()` → `listOpen(sort: SortParam = DEFAULT_SORT)` ; retrait de `order: { readyAt: 'ASC' }` de l'appel `find()` | Faible | Paramètre par défaut : tous les appels existants `service.listOpen()` (tests US-005/006/007) continuent de fonctionner sans modification, le tri par défaut restant `ready:asc` |
| `merge-requests.service.spec.ts` | Le test `should_query_non_draft_merge_requests_sorted_by_ready_at_ascending` assertait `find` appelé avec `order: { readyAt: 'ASC' }` | Moyen | Mettre à jour l'assertion : `find` appelé avec `{ where: { draft: false } }` seulement (le tri n'est plus délégué à TypeORM) — renommer le test en conséquence (ex : `should_query_only_non_draft_merge_requests`) |
| `merge-requests.controller.ts` | Ajout d'un paramètre de requête | Faible | Additif, route inchangée |

---

## Frontend

### Intégration dans les features existantes
- `features/board/mr-table/` (US-005/006/007) : les en-têtes des colonnes `difficulty` et `ready` deviennent
  cliquables/activables au clavier.
- `stores/merge-requests.store.ts` (US-005) étendu avec l'état `sort` et la méthode `setSort`.
- `board-page.component.ts` (US-004/005) : câble le nouvel input/output de `MrTableComponent` sur le store, comme
  il le fait déjà pour `rows`.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| — | — | **Pas de `MatSortModule`/`mat-sort-header`** — voir ⚠️ ci-dessous |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Étendre `models/merge-request.model.ts` | Types TS | `SortKey = 'ready' \| 'diff'`, `SortDirection = 'asc' \| 'desc'`, `interface MergeRequestSort { key: SortKey; direction: SortDirection }` |
| Étendre `core/api/merge-requests.service.ts` (+ `.spec.ts`) | Service Angular | `getMergeRequests(sort: MergeRequestSort)` ajoute `?sort=${key}:${direction}` via `HttpParams` |
| Étendre `stores/merge-requests.store.ts` (+ `.spec.ts`) | SignalStore | État `sort: MergeRequestSort` (défaut `{ key: 'ready', direction: 'asc' }`, RG-008-01/08) ; `load()` lit `store.sort()` et le passe au service ; nouvelle méthode `setSort(key: SortKey)` implémentant le cycle de RG-008-03 (colonne différente → `asc` ; même colonne + `asc` → `desc` ; même colonne + `desc` → `asc`), puis recharge |
| Étendre `mr-table.component.{ts,html,scss}` (+ `.spec.ts`) | Composant | `sort = input.required<MergeRequestSort>()`, `sortChange = output<SortKey>()` ; en-têtes `difficulty`/`ready` cliquables + activables au clavier (Enter/Espace), `aria-sort`, indicateur `↑`/`↓`/`↕` |
| Étendre `board-page.component.html` | Intégration | `[sort]="mrStore.sort()"` / `(sortChange)="mrStore.setSort($event)"` sur `<app-mr-table>` |

#### En-têtes triables — détail

- `<th>` des colonnes `difficulty` et `ready` : `tabindex="0"` (pas de `role="button"` — `mat-header-cell` impose déjà
  `role="columnheader"` via son propre host binding, non surchargeable ; pattern WAI-ARIA "columnheader interactif
  avec `aria-sort`", plus correct qu'un rôle `button` de toute façon), `[attr.aria-sort]` (`"ascending"` /
  `"descending"` si la colonne est active, sinon absent), `(click)` et `(keydown.enter)`/`(keydown.space)` émettant
  `sortChange.emit('diff' | 'ready')` — **la clé émise est celle du backend (`diff`/`ready`), indépendante du nom de
  colonne Angular (`difficulty`/`ready`)**, à ne pas confondre.
- Indicateur : `↑` si active + `asc`, `↓` si active + `desc`, `↕` à 50 % d'opacité si triable et inactive (RG-008-06).
  Couleur du libellé + indicateur : `--color-accent` si active, héritée sinon. `cursor: pointer` sur les deux
  en-têtes triables uniquement.
- Symboles `↑`/`↓`/`↕` : glyphes non traduisibles (identiques FR/EN, comme les icônes `mat-icon` déjà utilisées pour
  Approved/Commentaires) — **pas de clé i18n nécessaire**.

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `mr-table.component.ts`/`.html` (+ `.spec.ts`) | Ajout `input()`/`output()`, en-têtes cliquables | Faible | Additif ; les tests existants de `mr-table.component.spec.ts` construisent déjà `HostComponent` avec un `rows` signal — ajouter un `sort` signal par défaut `{ key: 'ready', direction: 'asc' }` |
| `stores/merge-requests.store.spec.ts` | `load()` appelle désormais `api.getMergeRequests(sort)` avec un argument | Faible | Mettre à jour le mock du service pour accepter/vérifier l'argument |
| `board-page.component.spec.ts` | Fixture `mergeRequest()` inchangée, mais `MrTableComponent` reçoit un nouvel input requis | Faible | Le test monte `BoardPageComponent` complet (pas `MrTableComponent` isolé) ; vérifier que `mrStore.sort()` a bien une valeur par défaut exploitable sans configuration supplémentaire |

---

## ⚠️ Points à clarifier / décisions d'architecture

1. **Pas de `mat-sort-header`** : `architecture-frontend.md` (tableau §4) mentionne « `mat-mable` + `mat-sort` (tri
   contrôlé) » et `testing.md` (§3) mentionne `MatSortHarness`. Après vérification de l'API installée (Angular
   Material 21.2.14, `@angular/material/sort`), le rendu natif de `mat-sort-header` est un chevron animé, sans état
   « inactif visible à 50 % d'opacité » (Material masque l'indicateur des colonnes inactives hors survol) — ne
   correspond pas à RG-008-06 (flèches `↑`/`↓`/`↕` explicites, indicateur toujours visible). Reproduire le rendu
   exact demanderait de masquer l'indicateur natif (`::ng-deep`, interdit sans documentation dans `design.md` — donc
   documenté ci-dessus et dans `design.md`) pour le remplacer par un rendu maison. Décision : en-têtes `<th>`
   cliquables/clavier custom, sans `MatSortModule`, cohérent avec le pattern déjà établi par `DifficultyBadgeComponent`
   /`ReadyDelayComponent` (US-006/007) — un composant custom pour un rendu spécifique du design plutôt que de forcer
   un composant Material dont le rendu ne correspond pas. `architecture-frontend.md`/`testing.md` seront corrigés en
   fin de feature (comme la correction de nommage faite en fin d'US-007).
2. **Portée des drafts inchangée** : comme pour US-007, `MergeRequestsService.listOpen()` continue de filtrer
   `draft: false` — le bloc Drafts de `sortMergeRequests` est implémenté et testé unitairement (RG-008-05, scénario
   « Drafts toujours en bas ») mais toujours vide en production tant qu'US-009 n'étend pas `listOpen()`. Même
   décision que US-007, déjà validée par l'utilisateur.
3. **Comportement sans paramètre `sort`** : `GET /merge-requests` sans `sort` reste `ready:asc` (valeur par défaut
   du paramètre de la méthode de service), pas une erreur — cohérent avec RG-008-01 et le comportement déjà testé en
   e2e (`should_be_sorted_by_ready_at_ascending`).

---

## Points de vigilance globaux

- **Tri en mémoire, pas en SQL** : acceptable au volume actuel (pas de pagination, MRs bornées) ; à revisiter si le
  volume dépasse ~500 MRs (déjà noté comme limite dans `architecture-backend.md` §5).
- **`iid` comme tie-break final** : absent du prototype (données de démo sans doublons exacts) mais nécessaire pour
  un ordre HTTP déterministe testable — à documenter dans le JSDoc de `sortMergeRequests`.

---

## Ordre de réalisation suggéré
1. `domain/calculate-difficulty.ts` : ajout de `DIFFICULTY_ORDER`
2. `domain/sort-merge-requests.ts` (fonction pure) + tests exhaustifs
3. `dto/merge-request-query.dto.ts`
4. Extension de `merge-requests.service.ts` (`listOpen`) + tests unitaires (dont la mise à jour du test cassé)
5. Extension de `merge-requests.controller.ts` + test unitaire
6. Extension de `test/merge-requests.e2e-spec.ts`
7. `models/merge-request.model.ts` (frontend) : types de tri
8. `core/api/merge-requests.service.ts` (+ tests)
9. `stores/merge-requests.store.ts` (état `sort` + `setSort`) (+ tests)
10. `mr-table.component` (en-têtes cliquables) (+ tests)
11. Câblage dans `board-page.component.html`
