# Rapport QA — US-008 Tri par défaut et tri sur colonnes

## 1. Tests automatisés

| Suite | Résultat |
|---|---|
| Backend unit (`npm test`) | ✅ 246 passed / 0 failed (28 suites) |
| Backend e2e (`npm run test:e2e`) | ✅ 58 passed / 0 failed (5 suites, dont 12 sur `merge-requests.e2e-spec.ts`) |
| Backend couverture (`npm run test:cov`) | ✅ 99,15 % lignes / 86,78 % branches — module `merge-requests` 100 % lignes/fonctions, `sort-merge-requests.ts` 100 %/100 %/100 % |
| Backend build (`npm run build`) | ✅ après correction de BUG-001 (voir §5) |
| Frontend (`ng test --no-watch --coverage`) | ✅ 247 passed / 0 failed (35 fichiers) |
| Frontend couverture | ✅ 98,68 % statements / 94,31 % branches / 96,98 % fonctions / 98,99 % lignes |
| Frontend build (`ng build`) | ✅ |

## 2. Tests API manuels

Smoke test sur un serveur local (`DB_PATH=:memory:`, port 3011, arrêté après test) :

- `GET /api/v1/merge-requests?sort=diff:desc` → 200, `[]` (pas de données GitLab réelles disponibles dans cet
  environnement, cf. limitation déjà documentée dans les rapports QA précédents)
- `GET /api/v1/merge-requests?sort=title:asc` → **400**, `{"statusCode":400,"error":"Bad Request","message":["sort
  must be one of the following values: ready:asc, ready:desc, diff:asc, diff:desc"],...}` — conforme à RG-008-07 et
  au scénario Gherkin « Valeur de tri invalide »
- `GET /api/v1/merge-requests` (sans `sort`) → 200, `[]` — confirme que l'absence du paramètre ne provoque pas
  d'erreur et retombe silencieusement sur `ready:asc` (RG-008-01)

C'est en démarrant ce serveur que **BUG-001** a été détecté (voir §5) — les scénarios de tri avec données réelles
(ordre effectif des lignes) restent couverts par la suite e2e (GitLab mocké), qui exerce déjà les 4 combinaisons
clé×direction avec assertions précises sur l'ordre des `iid`.

## 3. Vérification UI contre les maquettes

Pas de vérification visuelle en navigateur : `BoardPageComponent` remplace le tableau par l'état vide dès que
`mergeRequests().length === 0` (aucune donnée GitLab réelle disponible ici pour peupler au moins une ligne et
afficher effectivement les en-têtes triables). Vérification faite par **revue de code contre `design.md`** :

- En-têtes `difficulty`/`ready` : classe `sortable`, `cursor: pointer`, `tabindex="0"`, `aria-sort` correctement
  positionné/absent → conforme, vérifié par `mr-table.component.spec.ts` (12 tests dédiés au tri, DOM réel, pas de
  mock du rendu)
- Couleur accent sur la colonne active, opacité 0.5 sur `↕` inactif, 1 sur `↑`/`↓` actif → conforme au SCSS revu
  ligne à ligne contre `design.md` (écart prototype/specs sur l'opacité déjà noté en Phase 2, tranché en faveur des
  specs à 50 %)
- Pas de `mat-sort-header` (décision actée en Phase 2) → confirmé dans le code livré

⚠️ Recommandation inchangée depuis US-007 : faire une vérification visuelle rapide en navigateur avant mise en
production (idéalement avec quelques MRs de fixtures locales pour voir le tableau peuplé).

## 4. Critères d'acceptation (specs.md §5)

| Scénario | Statut | Détail |
|---|---|---|
| Tri par défaut (`ready:asc`, en-tête accent + `↑`, l'autre `↕`) | ✅ Validé | e2e `should_be_sorted_by_ready_at_ascending` + tests composant `should_mark_the_active_sort_column...` |
| Trier par difficulté (`GET ...?sort=diff:asc`, easy→medium→hard, tie-break readyAt) | ✅ Validé | e2e `should_sort_easy_to_hard` + `sort-merge-requests.spec.ts` |
| Inverser le tri (asc↔desc au clic répété) | ✅ Validé | `merge-requests.store.spec.ts` (`should_toggle_the_direction_when_the_same_column_is_selected_again`) |
| Drafts toujours en bas, triés par date d'ouverture | ✅ Validé unitairement (`sort-merge-requests.spec.ts`) | ⚠️ Même réserve que US-007 : `listOpen()` exclut toujours les drafts en production, invisible tant qu'US-009 n'étend pas l'API |
| Un seul tri actif (une seule flèche à la fois) | ✅ Validé | `should_mark_the_active_sort_column...` vérifie l'absence d'`aria-sort` sur la colonne inactive |
| Valeur de tri invalide → 400 | ✅ Validé | e2e `should_respond_400_for_an_invalid_sort_value` **et** smoke test manuel (§2) |
| En-têtes non triables (clic sans effet) | ✅ Validé | `should_not_be_clickable_or_marked_sortable_for_a_non_sortable_header` (pas de classe `sortable`, pas de `tabindex`) |

**7/7 scénarios validés.**

## 5. Bugs trouvés

### BUG-001 — 🔴 Corrigé pendant la QA — Erreur de compilation `nest build`/`nest start` non détectée par les tests

- **Où** : `backend/src/modules/merge-requests/dto/merge-request-query.dto.ts`
- **Symptôme** : `import { SORT_PARAMS, SortParam } from '../domain/sort-merge-requests'` faisait échouer `nest
  build`/`nest start` avec `TS1272: A type referenced in a decorated signature must be imported with 'import type'
  ...` (le champ `sort` est décoré par `@IsIn(SORT_PARAMS)`, et `SortParam` est un alias de type sans existence à
  l'exécution — `isolatedModules`/`emitDecoratorMetadata` exigent un `import type` explicite dans ce cas).
- **Pourquoi passé inaperçu en Phase 3** : ni `npm test` (Jest/ts-jest), ni `npm run test:e2e`, ni `npm run lint`
  (ESLint) ne détectent cette classe d'erreur — seul `tsc`/`nest build` avec la configuration stricte du projet la
  révèle. Détecté ici en démarrant un serveur réel pour le smoke test API (§2).
- **Correction** : `import { SORT_PARAMS, type SortParam } from '../domain/sort-merge-requests';` — build backend
  et frontend revérifiés OK après correction (§1).
- **Recommandation process** : le workflow `/project:feature` (Phase 6 finalisation) ne lance actuellement que
  `lint`/`test`/`test:e2e` pour le backend, jamais `npm run build`, alors que `docs/tech/testing.md` §5 (pipeline CI
  cible) liste explicitement `npm run build` pour le job backend. Ajouter `rtk npm run build` à la checklist de
  Phase 6 du workflow `feature.md` (et `bugfix.md`/`refacto.md`) éviterait de ne détecter ce genre d'erreur qu'en
  QA, voire en CI/production.

## 6. Recommandations

1. **Ajouter `npm run build` (backend) à la Phase 6 du workflow `/project:feature`** — voir BUG-001.
2. Vérification visuelle rapide en navigateur avant merge (inchangé depuis US-007).
3. Pour US-009, le branchement de l'inclusion des drafts dans `listOpen()` rendra visible à la fois RG-007-05 et le
   bloc Drafts de `sortMergeRequests` — les deux sont déjà testés en isolation et prêts.
