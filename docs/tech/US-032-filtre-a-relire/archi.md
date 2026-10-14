# Architecture — US-032 Filtre rapide « À relire »

Pas de `design.md` : un `mat-chip-option` de plus, identique à « Favoris » (US-027).

## Approche

Clone du chemin de données du filtre rapide « Favoris » (`fav`), en plus simple : aucun état persisté, aucune entité,
aucune migration, aucun impact export/import. Le filtre est un prédicat pur sur la vue (`reviewers` vide ET
`commentsCount === 0`), appliqué dans `loadBase` — donc partagé par `listOpen` et `getFacets` (RG-032-03) et
appliqué après le filtrage des drafts/labels ignorés (RG-032-04/05, déjà faits plus haut).

QO-032-04 : `commentsCount` est déjà la valeur unique exposée par la vue pour toutes les forges (RG-G08) ; on la
réutilise telle quelle, sans toucher au mapping GitHub.

## Backend (`backend/src/modules/merge-requests/`)

| Fichier | Changement |
|---|---|
| `domain/is-to-review.ts` (+ `.spec.ts`) | Nouvelle fonction pure `isToReview({ reviewers, commentsCount })` |
| `dto/merge-request-query.dto.ts` | `toReview?: BooleanParam` (`@IsOptional @IsIn(BOOLEAN_PARAMS)`) dans `MergeRequestFilterQueryDto` → hérité par `/facets` ; 400 si invalide (RG-032-06) |
| `merge-requests.controller.ts` | passe `toReviewOnly: query.toReview === '1'` à `listOpen` et `getFacets` ; MAJ des JSDoc |
| `merge-requests.service.ts` | `toReviewOnly` dans `ListOpenOptions`/`FacetsOptions`, `loadBase(…, toReviewOnly, search)` + filtre `views.filter(isToReview)` |
| specs : service, controller | cas `toReview` (+ e2e si un e2e couvre `fav`) |

`loadBase` : paramètre positionnel `toReviewOnly` ajouté dans la continuité de `favoritesOnly` (pas de refactor de la
signature, hors périmètre).

## Frontend (`frontend/src/app/`)

| Fichier | Changement |
|---|---|
| `models/merge-request.model.ts` | `MergeRequestFilters.toReview: boolean` |
| `stores/filters.store.ts` | état `toReview: false`, `toggleToReview()`, remis à `false` par `clear()` |
| `core/api/merge-requests.service.ts` | `filterParams` : `.set('toReview', …)` |
| `core/url-state/query-params.mapper.ts` | `UrlState.toReview`, décodage `toReview === '1'`, encodage `toReview: '1'|'0'` (juste après `fav`) |
| `stores/merge-requests.store.ts` | `baseFilters.toReview` |
| `features/board/board-page.component.{ts,html}` | `hasActiveFilter`, `currentQueryParams`, `boardQueryParams`, `restoreFromUrl`, `onToReviewToggle()`, binding `[toReview]`/`(toReviewToggle)` |
| `features/settings/settings-page.component.ts` | `boardQueryParams` (lien retour) : ajouter `toReview` |
| `features/board/filter-bar/filter-bar.component.{ts,html}` | input `toReview`, output `toReviewToggle`, chip après « Favoris », sans icône (aucune icône adaptée dans le jeu existant), `hasActiveFilter` |
| `public/i18n/fr.json` / `en.json` | `board.filters.toReview` : « À relire » / « To review » |
| specs | filters.store, query-params.mapper, merge-requests.service/store, filter-bar, board-page |

## Risques de régression

- Tout appelant de `encodeQueryParams`/`UrlState`/`MergeRequestFilters` doit fournir `toReview` (champ requis) : le
  compilateur (`tsc`) les révèle tous, dont les specs.
- L'URL contient désormais toujours `toReview=0|1` (comme `fav`) : les specs de round-trip d'URL sont à mettre à jour.
- Aucun risque sur les données (pas de schéma).

## Ordre d'implémentation

1. Backend domain → DTO → service → controller → tests.
2. Frontend model → store → API service → URL mapper → composants → i18n → tests.
