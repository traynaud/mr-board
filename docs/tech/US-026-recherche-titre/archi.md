# Architecture — US-026 Recherche libre sur le titre des MRs

## Résumé fonctionnel
Un champ de recherche permanent dans la barre de filtres restreint le tableau aux MRs dont le titre contient tous
les mots saisis (insensible casse/accents), avec un raccourci pour retrouver une MR par son numéro (`!42`).

---

## Backend

### Impacts sur le modèle de données

Aucun. `title` et `iid` existent déjà sur `MergeRequest` (aucune synchronisation ni migration nécessaire) — c'est
un filtre en mémoire, calculé à la demande, exactement comme les 6 filtres composables existants.

### Intégration dans les modules existants

- **`modules/merge-requests`** : seul module concerné.
  - `MergeRequestsService.loadBase()` — nouveau paramètre `search`, filtrage ajouté juste après le filtrage par
    labels ignorés (RG-015-02), donc **avant** que `listOpen`/`getFacets` ne divergent. Conséquence directe :
    RG-026-07 (la recherche est prise en compte dans les compteurs de facettes) est satisfaite gratuitement,
    puisque `buildFacets` ne voit jamais les MRs exclues par la recherche — aucune notion d'« exclusion de la
    recherche elle-même » à gérer (contrairement aux 6 filtres composables et leur `applyComposableFiltersExcept`),
    car la recherche n'est pas elle-même une facette à compteurs.
  - `MergeRequestsController` — un nouveau paramètre `q` sur les deux endpoints existants, aucune route ajoutée.

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/merge-requests` | `...&q=<texte>` (nouveau, en plus des params existants) | `MergeRequestsResponseDto` (inchangé) | 200 |
| GET | `/api/v1/merge-requests/facets` | `...&q=<texte>` | `MergeRequestsFacetsDto` (inchangé) | 200 |

`q` est une chaîne libre, non CSV, jamais rejetée (RG-026-13) : pas de `@MaxLength` côté DTO — la borne de 100
caractères (RG-026-08) est une contrainte de saisie côté frontend (`maxlength` HTML), pas une validation serveur ;
une valeur plus longue arrivant malgré tout par une URL forgée est simplement traitée telle quelle (coût
négligeable, un `Array.filter` en mémoire sur au plus quelques milliers de MRs).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `domain/search-merge-requests.ts` | Fonction pure | `matchesSearch(mr: {title, iid}, query: string): boolean` + `searchMergeRequests<T>(items: T[], query: string): T[]`. Découpage en termes (espaces), normalisation Unicode NFD + suppression des diacritiques + minuscule (RG-026-04), ET entre termes (RG-026-03) ; si la requête entière (trim) matche `/^[!#]?\d+$/`, ajoute un OU sur `mr.iid === Number(...)` (RG-026-05) ; requête vide (après trim) → tout passe (RG-026-08) |
| Créer `domain/search-merge-requests.spec.ts` | Test unitaire | Cas nominal, multi-termes désordonnés, casse/accents, recherche par `!42`/`#42`/`42`, requête vide, aucun résultat, terme absent du titre |
| Ajouter `q` à `MergeRequestFilterQueryDto` | DTO | `@IsOptional() @IsString() q?: string;` — partagé par `list`/`facets` comme les autres filtres |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `merge-requests.service.ts` — `ListOpenOptions`/`FacetsOptions` | Ajout `search?: string` (défaut `''`) | Faible | Paramètre optionnel, rétrocompatible |
| `merge-requests.service.ts` — `loadBase()` | Nouveau paramètre `search`, un `.filter(mr => matchesSearch(mr, search))` sur les entités brutes juste après le filtre labels ignorés (avant construction des vues complètes — filtrer tôt sur `{title, iid}` évite de construire les vues des MRs déjà exclues) | Faible | Fonction pure déjà testée isolément |
| `merge-requests.controller.ts` — `toComposableFilters`/`list`/`facets` | Lit `query.q`, le passe en `search` à `listOpen`/`getFacets` (`ComposableFilters` reste inchangée — la recherche n'en fait pas partie, RG-026-01 : ce n'est pas une pastille) | Faible | — |
| `merge-requests.controller.spec.ts`, `merge-requests.service.spec.ts` | Nouveaux cas couvrant `q` | Faible | — |
| `backend/test/merge-requests.e2e-spec.ts` | Nouveaux cas `GET /merge-requests?q=...` et `GET /merge-requests/facets?q=...` | Faible | — |

---

## Frontend

### Intégration dans les features existantes

- **`features/board`** : `FilterBarComponent` (champ de recherche), `BoardPageComponent` (câblage store ↔ URL).
- **`stores`** : `FiltersStore` (état `search`), `MergeRequestsStore` (debounce dédié).
- **`core/url-state`** : `query-params.mapper.ts` (paramètre `q`).
- **`core/api`** : `MergeRequestsService` (paramètre `q` sur les deux appels).
- Aucune nouvelle route.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `MatFormField` (`appearance="outline"`, `subscriptSizing="dynamic"`) | Angular Material | Même style que `.menu-search` de `FilterPillComponent` (US-010) |
| `MatInput` | Angular Material | Champ de saisie |
| `MatIconButton` + icône `x` (déjà enregistrée) | Angular Material / Lucide | Croix pour vider le champ seul (RG-026-11) |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Étendre `models/merge-request.model.ts` | Interface TS | `MergeRequestFilters` gagne `search: string` (regroupé avec `drafts`/`mine`, valeurs simples non facettées — cohérent avec l'usage existant de ce type, distinct de `ComposableFilters`) |
| Étendre `core/url-state/query-params.mapper.ts` | Fonctions pures | `UrlState.search: string` ; `decodeQueryParams` lit `params['q'] ?? ''` ; `encodeQueryParams` n'écrit `q` que si `state.search !== ''` (RG-026-10) |
| Étendre `core/url-state/query-params.mapper.spec.ts` | Test unitaire | Round-trip `q` présent/absent, valeur avec espaces |
| Étendre `core/api/merge-requests.service.ts` | Service Angular | `getMergeRequests`/`getFacets` prennent `filters: MergeRequestFilters` (déjà le cas) ; `filterParams` ajoute `q` si `filters.search` non vide |
| Étendre `stores/filters.store.ts` | SignalStore | État `search: string` (défaut `''`) ; méthode `setSearch(value: string)` ; `clear()` remet `search: ''` (RG-026-11) ; `restore()` accepte `search` |
| Étendre `stores/merge-requests.store.ts` | SignalStore | `load()` inclut `search: filters.search()` dans `baseFilters` ; `scheduleReload(debounceMs = FILTER_RELOAD_DEBOUNCE_MS)` prend un délai optionnel — nouvelle constante `SEARCH_RELOAD_DEBOUNCE_MS = 300` utilisée par l'appelant pour la recherche uniquement (RG-026-09), `0` quand le champ redevient vide (rechargement immédiat) |
| Étendre `features/board/filter-bar/filter-bar.component.ts`/`.html`/`.scss` | Composant | Nouveau `input<string>('')` `search`, nouveau `output<string>()` `searchChange` ; champ texte inséré entre le séparateur et les pastilles (RG-026-01) ; `hasActiveFilter` inclut `this.search().length > 0` |
| Étendre `features/board/board-page.component.ts` | Composant | `onSearchChange(value: string)` : `filtersStore.setSearch(value)` puis `mrStore.scheduleReload(value.trim() === '' ? 0 : SEARCH_RELOAD_DEBOUNCE_MS)` ; `currentQueryParams` ajoute `search: filtersStore.search()` ; `restoreFromUrl` ajoute `search: state.search` ; `hasActiveFilter` (état vide) inclut la recherche |
| Ajouter clé i18n `board.filters.searchPlaceholder` | i18n | `public/i18n/fr.json` **et** `public/i18n/en.json` (US-022) — « Rechercher un titre… » |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `filter-bar.component.html` | Nouvel élément entre `.separator` et `.filter-pills` | Faible | Structure flex existante, `gap` déjà en place |
| `board-page.component.ts` — `hasActiveFilter` | Condition étendue | Faible | Un seul `||` ajouté, testé par les specs existantes + nouveaux cas |
| `merge-requests.store.ts` — `scheduleReload()` | Signature étendue (paramètre optionnel) | Faible | Tous les appels existants sans argument gardent le comportement actuel (150 ms) |

---

## Points de vigilance globaux

- **Un seul filtrage, deux consommateurs** : en filtrant dans `loadBase()` plutôt que dans `listOpen`/`getFacets`
  séparément, la recherche ne peut pas diverger entre la liste et ses facettes — even RG-026-07 est une
  conséquence de l'architecture, pas une règle à tester séparément côté intégration (elle reste testée au niveau
  du service).
- **Normalisation Unicode** : `String.prototype.normalize('NFD')` est supporté nativement par Node ≥ 22 et tous
  les navigateurs ciblés — aucune dépendance ajoutée. La même fonction de normalisation doit rester **uniquement
  côté backend** (RG-026-04 est une règle de filtrage serveur comme les autres) ; le frontend n'a besoin d'aucune
  logique de correspondance, seulement de transmettre `q` tel quel.
- **Deux debounces distincts** : 150 ms (clics discrets, `FILTER_RELOAD_DEBOUNCE_MS`, existant) vs 300 ms (frappe
  continue, `SEARCH_RELOAD_DEBOUNCE_MS`, nouveau) — à ne pas fusionner, RG-026-09 fixe explicitement 300 ms pour la
  recherche.
- **`hasActiveFilter` existe à deux endroits** (`FilterBarComponent` pour le bouton « Effacer » de la barre,
  `BoardPageComponent` pour le choix du message d'état vide) : les deux doivent inclure la recherche
  symétriquement, sous peine d'un bouton « Effacer » qui apparaît sans que le message d'état vide ne s'adapte (ou
  l'inverse).

---

## Ordre de réalisation suggéré

1. Backend : `domain/search-merge-requests.ts` + tests unitaires
2. Backend : DTO (`q`), `MergeRequestsService` (`loadBase`, options), `MergeRequestsController`
3. Backend : tests service/controller + e2e
4. Frontend : `merge-request.model.ts` (`MergeRequestFilters.search`), `query-params.mapper.ts` (+ tests)
5. Frontend : `MergeRequestsService` (`q`), `FiltersStore` (état + méthodes), `MergeRequestsStore` (debounce)
6. Frontend : `FilterBarComponent` (champ + `hasActiveFilter`) + i18n
7. Frontend : `BoardPageComponent` (câblage `onSearchChange`, URL, état vide)
8. Tests unitaires frontend complets + validation manuelle contre les critères d'acceptation
