# Rapport QA — US-032 Filtre rapide « À relire »

Tests automatisés uniquement (pas de recette navigateur dans cet environnement).

| Scénario (specs §5) | Couverture |
|---|---|
| Seules les MRs sans relecteur ni commentaire | `is-to-review.spec.ts`, `merge-requests.service.spec.ts` (RG-032-01) |
| Assignee ≠ relecteur / MR approuvée / notes système | prédicat ne lit que `reviewers` et `commentsCount` (RG-G08) — `is-to-review.spec.ts` |
| Cumul avec Mes MRs / Drafts / composables | e2e `toReview=1` + `drafts=1` (non exécuté, voir ci-dessous) ; filtres appliqués en série dans `loadBase` |
| Propagation URL | `query-params.mapper.spec.ts`, `board-page.component.spec.ts` (restauration `toReview=1`) |
| Effacer (ne touche pas Drafts) | `filters.store.spec.ts`, `filter-bar.component.spec.ts` (bouton Effacer visible) |
| Libellé en anglais | clés `fr.json` / `en.json` (`board.filters.toReview`) |
| 400 sur valeur invalide | DTO `@IsIn` ; e2e `toReview=2` (non exécuté) |
| État vide | inchangé (`hasActiveFilter` inclut `toReview`) |

## Résultats
- Backend unitaires 643 ✔ ; frontend 825 ✔ ; lint et build ✔ des deux côtés.
- **Réserve** : les e2e backend sont inexécutables ici (erreur TypeORM/Jest préexistante, voir `dev-report.md`) ; les 2 cas
  e2e ajoutés sont à valider sur un environnement où les e2e tournent.
- **Non vérifié** : QO-032-04 (GitHub : `commentsCount` inclut-il les commentaires de revue en ligne ?) — la règle
  s'appuie sur la valeur déjà exposée par MR Board.
