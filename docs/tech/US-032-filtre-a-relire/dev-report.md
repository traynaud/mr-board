# Dev report — US-032 Filtre rapide « À relire »

## Backend
- `domain/is-to-review.ts` (+ spec) : prédicat pur `reviewers` vide ET `commentsCount === 0` (RG-032-01).
- `dto/merge-request-query.dto.ts` : `toReview` (`0|1`, 400 sinon) pour `/merge-requests` et `/facets`.
- `merge-requests.controller.ts` / `merge-requests.service.ts` : option `toReviewOnly`, appliquée dans `loadBase` après
  drafts / labels ignorés / recherche (donc partagée par liste et facets).
- Tests : unitaires (domaine, service, controller) + 2 cas e2e dans `test/merge-requests.e2e-spec.ts`.

## Frontend
- `MergeRequestFilters.toReview`, `FiltersStore` (`toReview`, `toggleToReview`, remis à zéro par `clear`).
- `merge-requests.service.ts` (`toReview=0|1`), `query-params.mapper.ts` (URL `toReview`, juste après `fav`),
  `merge-requests.store.ts`.
- `board-page` et `settings-page` (liens/URL), `filter-bar` : 4e chip « À relire » / « To review ».
- i18n : `board.filters.toReview` (fr/en).
- Specs existantes mises à jour (champ `toReview`, URLs attendues) + nouveaux tests.

## Écarts par rapport à l'archi
- `loadBase` garde ses paramètres positionnels (pas de refactor). Chip sans icône.

## Vérifications
- Backend : `npm test` 643 ✔, `npm run lint` ✔, `npm run build` ✔, `tsc --noEmit` ✔.
- Frontend : `ng test` 825 ✔, `npm run lint` ✔, `npm run build` ✔.
- **E2E backend non exécutables dans cet environnement** : tous les e2e qui ouvrent une base SQLite échouent avec
  `TypeError: this.sqlite is not a constructor` (TypeORM 1.1.1 + Jest ESM + Node 22.23), y compris sur l'arbre git
  propre (vérifié avec `projects.e2e-spec.ts` après `git stash`). Les 2 nouveaux cas e2e ne sont donc pas validés ici.
