# Architecture — US-011 Filtres, tri et colonnes propagés dans l'URL

## Résumé fonctionnel
L'état du tableau (filtres rapides, pastilles composables, tri, visibilité de la colonne « Date d'ouverture ») est
reflété dans les query params de l'URL, restauré au chargement, et mis à jour sans empiler d'historique. Un pied de
page affiche la query string courante. Le retour depuis Paramètres restaure la dernière URL du tableau.

---

## Backend

**Aucun changement.** Tous les query params requis (`drafts`, `mine`, `project`, `author`, `assigned`, `approved`,
`commented`, `sort`) existent déjà côté API depuis US-009/US-010. Cette US est purement frontend.

---

## Frontend

### Intégration dans les features existantes
- `features/board/board-page.component.ts` orchestre la synchronisation URL ↔ état (lecture initiale,
  effet réactif d'écriture) — cohérent avec le principe déjà établi en US-009/US-010 : **pas de DI circulaire entre
  stores**, l'orchestration multi-store se fait au niveau du composant, jamais dans un store qui en injecte un
  autre.
- `features/board/mr-table/` gagne une colonne optionnelle « Ouverte » et un menu « Colonnes » (icône déjà présente
  en bout de tableau dans le prototype).
- `features/settings/settings-page.component.ts` : les 3 navigations vers `/` (lien retour, Annuler, après
  Enregistrer) recalculent la query string du tableau au lieu de naviguer vers `/` nu.

### ⚠️ Divergence assumée avec `architecture-frontend.md`
Le document d'architecture initial (écrit avant le début du projet) suggérait que `filters.store.ts` porte aussi le
tri et les colonnes (« état des filtres/tri/colonnes »). Dans l'implémentation réelle (US-008/009/010), le tri vit
dans `MergeRequestsStore` (couplé au fetch trié côté backend) et non dans `FiltersStore`, qui reste volontairement
scopé aux filtres pour éviter la dépendance croisée entre stores. US-011 poursuit cette séparation déjà actée :
nouveau store dédié `ColumnsStore` plutôt que d'étendre `FiltersStore`, cohérent avec le grain déjà utilisé partout
ailleurs (`SyncStore`, `ProjectsStore`, `SettingsStore`… un store = une responsabilité). Signalé pour information,
pas une question ouverte : suit le précédent déjà établi.

### Contrat interne — `core/url-state/query-params.mapper.ts`

Fonctions pures (RG-011-08), sans dépendance Angular (pas de `Router`/`ActivatedRoute`) :

```ts
export interface UrlState {
  drafts: boolean;
  mine: boolean;
  active: FilterKey[];
  project: string[];
  author: string[];
  assigned: string[];
  approved: 'yes' | 'no' | null;
  commented: 'yes' | 'no' | null;
  sort: MergeRequestSort;
  showOpened: boolean;
}

/** Query params → état. Valeurs invalides silencieusement remplacées (RG-011-04). */
export function decodeQueryParams(params: Record<string, string | undefined>): UrlState { /* ... */ }

/** État → query params, ordre stable (RG-011-01), clés omises quand non pertinentes. */
export function encodeQueryParams(state: UrlState): Record<string, string> { /* ... */ }
```

**Règles de `decodeQueryParams`** (miroir de `toComposableFilters`/`toYesNo` déjà côté backend
`merge-requests.controller.ts`, RG-010-12) :
- `drafts`/`mine` : `'1'` → `true`, tout le reste (y compris absent) → `false`.
- `sort` : `'<key>:<dir>'` où `key ∈ SORT_KEYS`, `dir ∈ SORT_DIRECTIONS` (nouvelles constantes exportées par
  `models/merge-request.model.ts`, à côté de `SortKey`/`SortDirection`) ; sinon `DEFAULT_SORT` (RG-011-04).
- `project`/`author`/`assigned` : présent (même vide) → filtre actif, valeurs CSV **non validées localement**
  (RG-011-04 — la réconciliation RG-010-09 déjà en place dans `MergeRequestsStore.load()` nettoie après le premier
  chargement des facets, ce qui redéclenche naturellement l'effet d'écriture d'URL) ; absent → filtre inactif, `[]`.
- `approved`/`commented` : présent avec `'1'`/`'0'` → `'yes'`/`'no'`, actif ; présent avec toute autre valeur (y
  compris vide) → actif mais `null` (RG-011-04, « filtre présent sans valeur ») ; absent → inactif, `null`.
- `cols` : `'opened'` (ou CSV le contenant) → `showOpened: true` ; sinon `false`.
- `active` reconstruit à partir de la présence des clés `project`/`author`/`assigned`/`approved`/`commented` dans
  `params` — pas un champ séparé dans l'URL.

**Règles de `encodeQueryParams`** :
- `drafts`, `mine`, `sort` toujours présents (RG-011-01).
- Pour chaque `key` de `state.active` : `project`/`author`/`assigned` → CSV (`''` si vide) ; `approved`/`commented`
  → `'1'`/`'0'`/`''` (si `null`, active-sans-valeur — symétrique du decode, nécessaire pour l'idempotence
  RG-011-08 : le prototype de référence a ce même besoin mais son `query()` omet la clé quand la valeur est vide,
  ce qui casse le round-trip pour une pastille tout juste ajoutée — corrigé ici).
- `cols` : présent (`'opened'`) seulement si `state.showOpened`.
- Clé absente du résultat pour tout filtre non actif (pas de `''`).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Étendre `models/merge-request.model.ts` | Types/constantes | Exporter `SORT_KEYS`, `SORT_DIRECTIONS`, `DEFAULT_SORT` (déplacés depuis `merge-requests.store.ts`, réutilisés par le mapper sans dépendance `core → stores`) |
| Créer `core/url-state/query-params.mapper.ts` (+ `.spec.ts`) | Fonction pure | `decodeQueryParams`/`encodeQueryParams`, tests exhaustifs des deux sens + idempotence (RG-011-08) |
| Créer `stores/columns.store.ts` (+ `.spec.ts`) | SignalStore | `showOpened: boolean` (défaut `false`), `toggleOpened()`, `restore(showOpened: boolean)` |
| Étendre `stores/filters.store.ts` (+ `.spec.ts`) | SignalStore | Nouvelle méthode `restore(state: Partial<FiltersState>)` — patch direct en bloc, sans passer par les méthodes de toggle unitaires, pour la restauration initiale depuis l'URL |
| Étendre `stores/merge-requests.store.ts` (+ `.spec.ts`) | SignalStore | Nouvelle méthode `restoreSort(sort: MergeRequestSort)` — patch direct, ne déclenche pas de `load()` (le premier chargement de `ngOnInit` s'en charge une fois l'état restauré) |
| Étendre `features/board/board-page.component.ts` (+ `.spec.ts`) | Composant | Injecte `Router`, `ActivatedRoute`, `ColumnsStore` ; `ngOnInit` décode `activatedRoute.snapshot.queryParamMap` **une seule fois** (lecture ponctuelle, pas d'abonnement réactif — évite toute boucle avec l'effet d'écriture, voir Points de vigilance) et restaure les 3 stores **avant** le premier `loadMergeRequests()` ; nouvel `effect()` qui encode l'état courant (Filters + `mrStore.sort()` + `columnsStore.showOpened()`) via `encodeQueryParams` et appelle `router.navigate([], { relativeTo: activatedRoute, queryParams, replaceUrl: true })` — remplace toute écriture d'URL ad hoc, couvre RG-011-02/03/04/07 sans code supplémentaire dans les handlers existants (`onDraftsToggle`, `onFilterAdd`, `onClearFilters`…) |
| Étendre `features/board/board-page.component.html` | Template | Pied de page (RG-011-06, inline comme les autres états déjà inline dans ce fichier — pas de nouveau composant pour une seule ligne) affichant `?{{ currentQueryString() }}` en police monospace ; câblage `[showOpened]`/`(toggleOpenedColumn)` sur `<app-mr-table>` |
| Étendre `features/board/mr-table/mr-table.component.ts` (+ `.spec.ts`) | Composant | `showOpened = input.required<boolean>()`, `toggleOpenedColumn = output<void>()` ; `displayedColumns` devient `computed()` (ajoute `'opened'` si `showOpened()`, toujours `'columnsMenu'` en dernier) ; imports `MatMenuModule`, `MatCheckboxModule` |
| Étendre `features/board/mr-table/mr-table.component.html` (+ `.scss`) | Template | Colonne `opened` (`formatShortDate(row.createdAt)`) ; colonne `columnsMenu` : icône `columns` (déjà enregistrée) + `mat-menu` avec un item libre (pas `mat-menu-item`, reste ouvert au clic — même pattern que `filter-pill.component.html` en US-010 : `role="checkbox"`, `tabindex="0"`, `[attr.aria-checked]`, `(keydown.enter)`/`(keydown.space)`) |
| Étendre `features/settings/settings-page.component.ts` (+ `.spec.ts`) | Composant | Injecte `FiltersStore`, `MergeRequestsStore`, `ColumnsStore` ; méthode privée `boardQueryParams()` réutilisant `encodeQueryParams` ; remplace les 2 `router.navigateByUrl('/')` (fin de `save()`, `cancel()`) par `router.navigate(['/'], { queryParams: this.boardQueryParams() })` |
| Étendre `features/settings/settings-page.component.html` (+ `.spec.ts`) | Template | Lien retour : `routerLink="/"` → ajoute `[queryParams]="boardQueryParams()"` |
| Ajouter clés `board.columns.*`, `board.mergeRequests.columns.opened` | i18n | Titre menu « Colonnes », libellé « Date d'ouverture », en-tête colonne « Ouverte » |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `merge-requests.store.ts` | `DEFAULT_SORT` déplacé vers le modèle (import au lieu d'une constante locale) | Faible | Comportement identique, juste l'emplacement de la constante |
| `settings-page.component.ts`/`.html` | Navigation vers `/` remplacée par navigation vers le tableau avec query params | Faible | Les 5 tests existants qui assertent `navigateByUrl('/')` (lignes 173/204/214/337/374 de `settings-page.component.spec.ts`) doivent être mis à jour pour attester le nouveau comportement (`router.navigate` avec `queryParams`) |
| `board-page.component.ts`/`.html` | Ajout de l'orchestration URL + pied de page + câblage colonnes | Moyen | Tests existants du fichier à étendre (nouveaux providers `ActivatedRoute`/route de test), pas de régression comportementale sur l'existant (l'effet ne fait qu'écrire l'URL, ne modifie aucun état métier) |
| `mr-table.component.ts`/`.html`/`.spec.ts` | Nouveaux inputs/colonnes | Faible | `showOpened` obligatoire (`input.required`) — tous les call sites existants (dont les tests) doivent le fournir |

---

## Points de vigilance globaux

- **Lecture de l'URL au chargement = un seul instantané** (`activatedRoute.snapshot.queryParamMap`), jamais un
  abonnement réactif à `activatedRoute.queryParams` — sinon la propre écriture de l'effet (`router.navigate`)
  redéclencherait une décodification, créant un aller-retour (pas un vrai risque de boucle infinie puisque l'état
  décodé serait identique à l'état déjà en place donc stable dès la 2ᵉ itération, mais un cycle de navigation
  inutile à chaque changement de filtre). Un rechargement de page (F5) recrée `BoardPageComponent` et relit
  naturellement un nouvel instantané — suffisant pour tous les scénarios de specs.md (pas de besoin de réagir à une
  édition manuelle de l'URL sans rechargement).
- **RG-011-05 sans nouveau store dédié** : `FiltersStore`/`MergeRequestsStore`/`ColumnsStore` sont `providedIn:
  'root'`, donc leur état survit à la destruction de `BoardPageComponent` lors de la navigation vers `/settings`.
  `SettingsPageComponent` peut directement réinjecter ces 3 stores et ré-encoder la query string au moment de
  naviguer, sans registre séparé « dernière URL » à synchroniser (source unique de vérité : les stores
  eux-mêmes).
- **`cols` anticipe une portion de US-012** (validé en Phase 1) — bien circonscrire au strict nécessaire (une seule
  colonne, pas de redimensionnement) pour ne pas empiéter davantage sur le périmètre de US-012.
- **RG-011-07 (Effacer)** : `FiltersStore.clear()` ne touche ni `mrStore.sort` ni `columnsStore.showOpened` (déjà
  vrai avant cette US) — l'effet d'écriture d'URL les conservera automatiquement inchangés dans la query string,
  aucun code spécifique à ajouter pour ce comportement.

---

## Ordre de réalisation suggéré
1. `models/merge-request.model.ts` — `SORT_KEYS`, `SORT_DIRECTIONS`, `DEFAULT_SORT`
2. `core/url-state/query-params.mapper.ts` (+ tests exhaustifs, encode/decode/idempotence)
3. `stores/columns.store.ts` (+ tests)
4. `stores/filters.store.ts` (`restore`) et `stores/merge-requests.store.ts` (`restoreSort`, import `DEFAULT_SORT`) (+ tests)
5. `mr-table.component.*` (colonne « Ouverte » + menu « Colonnes ») (+ tests)
6. `board-page.component.*` (orchestration URL + pied de page + câblage mr-table) (+ tests)
7. `settings-page.component.*` (navigation vers le tableau avec query params) (+ mise à jour des tests existants)
8. Clés i18n
9. Validation manuelle contre les maquettes (état déjà noté comme non réalisable en QA automatisée sans navigateur)
