# Rapport QA — US-032 Filtre rapide « À relire »

Tests automatisés uniquement (pas de recette navigateur dans cet environnement).

## Révision 2026-11-09 — condition « aucun commentaire » supprimée

| Scénario (specs §5) | Couverture |
|---|---|
| Seules les MRs sans relecteur sont retenues (A et C, « 2 MRs ») | `is-to-review.spec.ts`, `merge-requests.service.spec.ts` (MR commentée sans reviewer retenue, MR avec reviewer exclue), e2e `toReview=1` |
| MR sans relecteur mais commentée retenue | `is-to-review.spec.ts` (« ignores comments »), `merge-requests.service.spec.ts` |
| MR avec relecteur sans commentaire exclue | `is-to-review.spec.ts`, `merge-requests.service.spec.ts` |
| Assignee ≠ relecteur / MR approuvée | le prédicat ne lit que `reviewers` — `is-to-review.spec.ts` |
| Cumul Mes MRs / Drafts / composables | e2e `toReview=1` + `drafts=1` (non exécuté, voir réserve) ; filtres appliqués en série dans `loadBase` (inchangé) |
| Propagation URL, Effacer, libellé EN, état vide | inchangés — `query-params.mapper.spec.ts`, `board-page.component.spec.ts`, `filters.store.spec.ts`, `filter-bar.component.spec.ts`, `fr.json`/`en.json` |
| 400 sur valeur invalide | DTO `@IsIn` ; e2e `toReview=2` (non exécuté, voir réserve) |

## Résultats

- Backend unitaires : 642/642 ✔ ; couverture globale 98,8 % (seuil 80 % respecté), `is-to-review.ts` 100 %.
- Frontend : `tsc` ✔, `ng test` 825/825 ✔.
- Lint et build backend ✔ ; e2e backend 162/162 ✔.
- Aucune mention des commentaires dans les libellés/tooltips du chip (fr/en).

## Réserves

- Pas de recette UI/API manuelle : aucun changement frontend ni de contrat API (seule la sémantique du filtre évolue).
- E2E backend : 162/162 ✔ (7 suites) via `npm run test:e2e`, désormais lancé suite par suite (voir `dev-report.md`).

## Anomalies

Aucune.
