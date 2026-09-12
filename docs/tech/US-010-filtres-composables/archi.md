# Architecture — US-010 Filtres composables

## Résumé fonctionnel
Cinq pastilles de filtre composables (Projet, Auteur, Affecté à, Approved, Commenté), ajoutées/retirées via un menu
« Ajouter un filtre », chacune avec son propre menu (multi-sélection avec compteurs, ou Oui/Non). Un nouvel
endpoint `GET /merge-requests/facets` fournit les options et compteurs contextuels.

---

## Backend

### Impacts sur le modèle de données
Aucun changement de schéma. Tout est calculé à la lecture à partir des données déjà synchronisées.

### Intégration dans les modules existants

**Refactorisation de `merge-requests.service.ts`** — `listOpen()` et la nouvelle `getFacets()` partagent désormais
un même socle : assembler le jeu de MRs « de base » (drafts + mine appliqués, RG-009), puis diverger :
- `listOpen()` applique les 5 filtres composables sur ce socle, trie, retourne les lignes.
- `getFacets()` calcule, pour chaque filtre, les options et leur compteur en appliquant le socle **et** les 4
  *autres* filtres composables actifs (jamais le filtre lui-même) — traduction directe de `applyAllBut(skip)` du
  prototype (`docs/design/MR Board - Prototype.dc.html`, lignes 373-409), qui fait explicitement référence pour
  cette US comme pour les précédentes.

```ts
private async loadBase(includeDrafts: boolean, mineOnly: boolean): Promise<{ views: MergeRequestViewDto[]; warnings: string[] }>
```
Corps = l'actuel `listOpen()` jusqu'au calcul de `isMine`/`mineOnly`/`warnings` inclus (US-009), sans le filtrage
composable ni le tri — factorisé tel quel, aucun changement de comportement pour US-009.

- **Nouveau** `domain/filter-merge-requests.ts` — fonctions pures : un « test » par filtre (RG-010-02, RG-G13,
  RG-G14), `applyComposableFilters` (tous les tests) et `applyComposableFiltersExcept` (tous sauf un, pour les
  facets).
- **Nouveau** `domain/build-facets.ts` — fonction pure : à partir du socle + des filtres actifs + de la liste des
  repos configurés, construit les 5 tableaux d'options triées avec compteurs (RG-010-07/08).
- **`merge-requests.controller.ts`** : nouvelle route `GET /merge-requests/facets`.
- **`merge-request-query.dto.ts`** : factorisé en `MergeRequestFilterQueryDto` (drafts, mine, project, author,
  assigned, approved, commented — partagé) + `MergeRequestQueryDto extends MergeRequestFilterQueryDto` (ajoute
  `sort`, utilisé par `GET /merge-requests`) + `MergeRequestFacetsQueryDto extends MergeRequestFilterQueryDto` (sans
  `sort`, utilisé par `GET /merge-requests/facets`) — les décorateurs `class-validator` sont hérités.

### Contrat API

| Méthode | Route | Query | Réponse | Codes |
|---------|-------|-------|---------|-------|
| GET | `/api/v1/merge-requests` | `sort`, `drafts`, `mine` (US-008/009) + `project`, `author`, `assigned` (CSV) + `approved`, `commented` (`0\|1`) | `MergeRequestsResponseDto` (inchangé) | 200, 400 si `sort`/`drafts`/`mine`/`approved`/`commented` invalide (RG-010-12) |
| GET | `/api/v1/merge-requests/facets` | `drafts`, `mine`, `project`, `author`, `assigned`, `approved`, `commented` (mêmes valeurs que ci-dessus, sans `sort`) | `MergeRequestsFacetsDto` | 200, 400 si `approved`/`commented` invalide |

`domain/filter-merge-requests.ts` :

```ts
export interface FilterableMergeRequest {
  projectAlias: string;
  authorUsername: string;
  reviewerUsernames: string[];
  assigneeUsernames: string[];
  approved: boolean;
  commentsCount: number;
}
export type FilterKey = 'project' | 'author' | 'assigned' | 'approved' | 'commented';
export interface ComposableFilters {
  project: string[];
  author: string[];
  assigned: string[];       // 'nobody' est une valeur comme une autre ici
  approved: 'yes' | 'no' | null;
  commented: 'yes' | 'no' | null;
}

/** RG-010-02 (ET entre filtres, OU entre valeurs), RG-G13 (assigned = reviewer OU assignee, nobody = ni l'un ni l'autre). */
export function applyComposableFilters<T extends FilterableMergeRequest>(items: T[], filters: ComposableFilters): T[] { /* ... */ }

/** RG-010-07 : comme applyComposableFilters, mais ignore le test `except`. */
export function applyComposableFiltersExcept<T extends FilterableMergeRequest>(items: T[], filters: ComposableFilters, except: FilterKey): T[] { /* ... */ }
```

`domain/build-facets.ts` :

```ts
export interface FacetOption { value: string; label: string; count: number; }
export interface MergeRequestsFacets {
  project: FacetOption[];
  author: FacetOption[];
  assigned: FacetOption[];   // 'nobody' toujours en premier (RG-010-05)
  approved: FacetOption[];   // 2 entrées : 'yes'/'no' (voir note ci-dessous)
  commented: FacetOption[];  // idem
}

export function buildFacets(
  base: (FilterableMergeRequest & { authorName: string })[],
  filters: ComposableFilters,
  configuredProjects: { alias: string; pathWithNamespace: string }[],
): MergeRequestsFacets { /* ... */ }
```

⚠️ **Forme de `approved`/`commented`** : le scénario Gherkin « Facets » de `specs.md` écrit `approved{yes,no}` de
façon elliptique. Retenu : un tableau de 2 `FacetOption` (`value: 'yes'|'no'`, `label: 'Oui'|'Non'`), **identique**
aux autres filtres — reproduit exactement `optsFor('approved')` du prototype (ligne 407) et permet au frontend
d'utiliser le même composant de menu booléen sans cas particulier de forme de données. Signalé pour confirmation
en review si le PO voulait littéralement `{ yes: number, no: number }`.

**Sources des options** (RG-010-01, RG-010-08, QO-010-01) :
- **Projet** : *tous* les repos configurés (`ProjectsService.list()`, pas seulement les actifs — RG-010-01 dit
  « repos configurés », pas « activés » ; à confirmer en review) — permet un compteur à 0 pour un repo sans MR
  ouverte (RG-010-08), triés par alias.
- **Auteur** / **Affecté à** : uniquement les utilisateurs présents dans le socle (drafts/mine appliqués) — jamais
  tous les utilisateurs jamais rencontrés (hypothèse QO-010-01), triés par nom complet ; « Nobody » toujours
  première option de « Affecté à ».

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Créer `domain/filter-merge-requests.ts` (+ `.spec.ts`) | Fonction pure | 5 tests, `applyComposableFilters`, `applyComposableFiltersExcept` — RG-010-02, RG-G13, RG-G14, exhaustif |
| Créer `domain/build-facets.ts` (+ `.spec.ts`) | Fonction pure | Options + compteurs, tri, Nobody en premier, repos à 0 visibles |
| Créer `dto/merge-requests-facets.dto.ts` | DTO | `MergeRequestsFacetsDto` |
| Étendre `dto/merge-request-query.dto.ts` | DTO | Factorisation `MergeRequestFilterQueryDto`, ajout `project`/`author`/`assigned` (CSV → `string[]` via `@Transform`), `approved`/`commented` (`@IsIn(['0','1'])`) |
| Refactorer `merge-requests.service.ts` (`loadBase` partagé, `listOpen`, nouvelle `getFacets`) (+ `.spec.ts`) | Service | Voir ci-dessus |
| Étendre `merge-requests.controller.ts` (+ `.spec.ts`) | Controller | `GET /merge-requests/facets` |
| Étendre `test/merge-requests.e2e-spec.ts` | Test e2e | Tous les scénarios Gherkin de `specs.md` §5 (filtres, combinaisons, valeur inconnue → 200 vide vs 400, endpoint facets) |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `merge-requests.service.ts` (`listOpen`) | Extraction de `loadBase`, ajout du filtrage composable avant tri | Moyen | Comportement US-005 à US-009 inchangé si `project`/`author`/`assigned`/`approved`/`commented` sont absents (listes vides = « tous », RG-010-02) — à vérifier explicitement par les tests existants qui continuent de passer sans ces params |
| `dto/merge-request-query.dto.ts` | Restructuration en classe de base + 2 sous-classes | Faible | Additif du point de vue de l'API, pas de champ retiré |

---

## Frontend

### Intégration dans les features existantes
- `stores/filters.store.ts` (US-009) étendu : `active: FilterKey[]` (pastilles affichées, dans l'ordre d'ajout),
  valeurs par filtre (`project`, `author`, `assigned`: `string[]` ; `approved`, `commented`: `'yes'|'no'|null`).
- `stores/merge-requests.store.ts` (US-008/009) : `load()` récupère désormais aussi les facets (`Promise.all`),
  nouvel état `facets: MergeRequestsFacets | null`.
- **Nouveau** `features/board/filter-bar/filter-pill/` — pastille de filtre générique (les 5 filtres partagent un
  seul composant, paramétré par son type multi/booléen — pas 5 composants distincts).
- **Nouveau** `features/board/filter-bar/add-filter-menu/` — bouton + menu « Ajouter un filtre ».

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-menu` / `matMenuTriggerFor` | Angular Material (première utilisation dans le projet) | Menu de chaque pastille et du bouton « Ajouter un filtre » |
| `mat-checkbox` | Angular Material | Options multi-sélection — **hors `mat-menu-item`** (un `mat-menu-item` ferme le menu au clic ; RG-010-05 exige qu'il reste ouvert pendant les sélections — rendu en contenu libre du panneau `mat-menu`, comportement par défaut de Material qui ne ferme que sur clic d'un `mat-menu-item`) |
| `mat-menu-item` | Angular Material | Options du menu booléen (RG-010-06 : choisir ferme le menu, comportement par défaut) et items du menu « Ajouter un filtre » |
| `mat-form-field` + `matInput` | Angular Material | Champ « Rechercher… » (RG-010-05, affiché si > 6 options) |
| `computeInitials` | `shared/avatar/compute-initials.ts` | Réutilisé tel quel pour le libellé de pastille (RG-010-04 : initiales pour les utilisateurs) |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Étendre `models/merge-request.model.ts` | Types TS | `FilterKey`, `ComposableFilters`, `MergeRequestsFacets`, `FacetOption` |
| Étendre `stores/filters.store.ts` (+ `.spec.ts`) | SignalStore | `active`, valeurs par filtre, `addFilter`/`removeFilter`/`toggleMultiValue`/`setBoolean` (RG-010-06 : re-cliquer désélectionne), `clear()` étendu (RG-010-11 : retire toutes les pastilles, ne touche pas `drafts`) |
| Étendre `core/api/merge-requests.service.ts` (+ `.spec.ts`) | Service | `getFacets(filters)` ; `getMergeRequests` transmet aussi les 5 nouveaux params |
| Étendre `stores/merge-requests.store.ts` (+ `.spec.ts`) | SignalStore | `load()` récupère rows + facets en parallèle, état `facets` |
| Créer `features/board/filter-bar/filter-pill/filter-pill.component.{ts,html,scss,spec.ts}` | Composant | Pastille + menu (branche multi/booléen selon le type du filtre), recherche conditionnelle, croix `aria-label` (RG-010-13) |
| Créer `features/board/filter-bar/add-filter-menu/add-filter-menu.component.{ts,html,scss,spec.ts}` | Composant | RG-010-03 : les 5 filtres **toujours listés**, actifs grisés + cochés (⚠️ diffère du prototype qui les masque — specs.md fait foi, voir Points à clarifier) |
| Étendre `filter-bar.component.{ts,html}` (+ `.spec.ts`) | Composant | Intègre les pastilles + le bouton « Ajouter un filtre » entre les chips Drafts/Mes MRs et le compteur |
| Ajouter clés `board.filters.pills.*` | i18n | Titres de menu, « Rechercher… », « tous », « Retirer le filtre {{name}} » |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `filter-bar.component.html` | Insertion des pastilles + bouton entre les chips et le compteur | Faible | Additif |
| `board-page.component.ts` | État vide contextuel déjà générique (`hasActiveFilter`, US-009) — étendre la condition à « au moins un filtre actif hors drafts », pas seulement `mine` (RG-010-10) | Faible | `hasActiveFilter = computed(() => filtersStore.mine() || filtersStore.active().length > 0)` |
| `stores/merge-requests.store.spec.ts`, `board-page.component.spec.ts` | Mocks HTTP à étendre pour la requête facets parallèle | Moyen (volume) | Mécanique, même pattern que US-008/009 |

---

## ⚠️ Points à clarifier

1. **Menu « Ajouter un filtre » : RG-010-03 vs prototype** — les specs demandent d'afficher les 5 filtres même
   actifs (grisés + cochés) ; le prototype les masque une fois actifs. Implémenté selon les specs (source de
   vérité), déjà signalé au PO en Phase 1 implicitement via cette US — à confirmer si un écart de compréhension.
2. **Repos « configurés » vs « activés » pour le facet Projet** — RG-010-01 dit « configurés » ; retenu :
   `ProjectsService.list()` (tous), pas `listActive()`. À confirmer en review.
3. **Forme de `approved`/`commented` dans `MergeRequestsFacetsDto`** — tableau de 2 options (comme les 3 autres
   filtres) plutôt que `{yes,no}` littéral, voir note dans le contrat API.

## Points de vigilance globaux

- **Double appel réseau à chaque changement de filtre** (`GET /merge-requests` + `GET /merge-requests/facets`),
  tous deux derrière le `scheduleReload()` debouncé existant (US-009, 150 ms) — acceptable au volume de ce projet
  (pas de pagination, quelques centaines de MRs au plus).
- **`applyComposableFiltersExcept` appelé 5 fois** dans `buildFacets` (une par filtre) sur le même jeu de base — 
  coût négligeable au volume visé, pas d'optimisation prématurée.
- **Cohérence avec RG-010-09** (sélection invalide retirée silencieusement) : le frontend doit, à chaque réponse
  `facets`, retirer de `FiltersStore` toute valeur sélectionnée absente des options renvoyées — logique à placer
  dans `MergeRequestsStore.load()` après réception des facets, pas dans `FiltersStore` lui-même (qui reste un état
  UI pur sans connaissance du serveur, cohérent avec la décision déjà prise en US-009).

---

## Ordre de réalisation suggéré
1. `domain/filter-merge-requests.ts` (fonction pure) + tests exhaustifs
2. `domain/build-facets.ts` (fonction pure) + tests
3. `dto/merge-request-query.dto.ts` (restructuration) + `dto/merge-requests-facets.dto.ts`
4. Refactorisation `merge-requests.service.ts` (`loadBase`, `listOpen`, `getFacets`) + tests unitaires
5. Extension de `merge-requests.controller.ts` + test
6. Extension de `test/merge-requests.e2e-spec.ts`
7. `models/merge-request.model.ts` (frontend) + `core/api/merge-requests.service.ts` (+ tests)
8. `stores/filters.store.ts` (extension) + `stores/merge-requests.store.ts` (facets, réconciliation RG-010-09) (+ tests)
9. `filter-pill.component.*` (+ tests) puis `add-filter-menu.component.*` (+ tests) + i18n
10. Intégration dans `filter-bar.component` + `board-page.component` (état vide) (+ tests)
