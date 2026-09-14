# Rapport QA — US-027 Favoris

Testé le 2026-09-14.

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Backend `npm test` | ✅ 619 passed / 0 failed (53 suites) — +5 en Phase 5 (extraction `domain/is-favorite.ts`) |
| Backend `npm run test:e2e` | ✅ 150 passed / 0 failed (7 suites) — +5 en Phase 5 (BUG-002/003/004/005) |
| Backend `npm run test:cov` | ✅ 98.95 % stmts / 89.38 % branch / 98.15 % funcs / 99.02 % lines — seuil 80 % largement respecté ; `modules/favorites` à 100 % stmts/funcs/lines (83.33 % branch, seule « branche » non couverte étant la ligne de déclaration du paramètre `@InjectRepository` du constructeur — faux positif Istanbul classique, sans impact) |
| Backend `npm run lint` / `npm run build` | ✅ |
| Frontend `npx ng test --no-watch --coverage` | ✅ 801 passed / 0 failed (66 suites) — +4 en Phase 5 (BUG-001) |
| Frontend couverture globale | ✅ 96.63 % stmts / 94.74 % branch / 92.5 % funcs / 98.76 % lines |
| Frontend `npm run lint` / `npm run build` | ✅ |

## 2. Tests API manuels

**Non réalisés**, même choix reconduit que pour US-025/US-026 — éviter de risquer une nouvelle collision avec un
processus backend externe à cette session (incident rencontré en QA de US-025). Compensé par les 11 scénarios e2e
dédiés (`backend/test/merge-requests.e2e-spec.ts`, describe `favorites (US-027)`, complétés en Phase 5) qui
couvrent : marquage, retrait, 404 sur id inconnu, filtre `fav=1`, combinaison avec `drafts=1` et avec `project=`,
export incluant le favori, survie à la disparition/réapparition de la MR, et purge à la suppression du repo —
ainsi que les 2 scénarios ajoutés à `settings-transfer.e2e-spec.ts` pour l'import.

## 3. Vérification UI contre les maquettes

⚠️ **Non réalisée en direct** (extension Claude in Chrome toujours déconnectée dans cet environnement — nouvelle
tentative faite ce tour-ci, même résultat). Compensé par une relecture du template/SCSS :
- Chip « Favoris » : reprend exactement la structure `mat-chip-option` + `matChipAvatar` du chip « Mes MRs »
  existant (US-009), donc même style Material garanti.
- Colonne étoile : `mat-icon-button` + `mat-icon svgIcon`, 18 px, cohérent avec les autres icônes de cellule
  (`check` de la colonne Approved) ; classe `.active` applique `var(--color-accent)` (`#ec3013`), vérifiée présente
  dans les deux thèmes (`styles.scss`).
- Aucun `border-radius` introduit, aucune divergence de police repérée dans le diff.

Risque visuel résiduel faible, mais **non nul** pour l'alignement vertical de l'étoile dans sa cellule (36 px) —
recommandé de vérifier en direct dès que l'extension sera disponible (voir §6).

## 4. Critères d'acceptation (specs.md §5 — 14 scénarios Gherkin)

| # | Scénario | Statut |
|---|----------|--------|
| 1 | Marquer une MR comme favorite | ✅ e2e + store + intégration `BoardPageComponent` (Phase 5) |
| 2 | Retirer une MR des favoris | ✅ e2e `should_unmark_a_merge_request_as_favorite_rg_027_08` + store `should_unmark_when_the_row_is_already_a_favorite` |
| 3 | Le favori survit au rechargement | ✅ e2e (marquage puis nouveau `GET` renvoyant `isFavorite: true`) |
| 4 | Filtrer sur les favoris (compteur global) | ✅ e2e `should_only_return_favorited_merge_requests_rg_027_10` ; compteur global générique déjà éprouvé |
| 5 | Le filtre Favoris se combine avec les autres filtres (Projet) | ✅ e2e `should_combine_favorites_with_a_composable_filter_rg_027_10` (Phase 5) |
| 6 | Propagé dans l'URL et restauré | ✅ unitaire (`query-params.mapper.spec.ts`) + intégration `BoardPageComponent` (Phase 5) |
| 7 | « Effacer » désactive le filtre sans perdre les favoris | ✅ `FiltersStore` `should_clear_favorites_only_and_never_touch_drafts_rg_027_11` ; marquage jamais touché par construction |
| 8 | Un favori survit à la disparition puis au retour de la MR | ✅ e2e `should_keep_a_favorite_across_its_merge_requests_disappearance_and_reappearance_rg_027_04` (Phase 5) |
| 9 | Supprimer un repo purge ses favoris | ✅ e2e `should_purge_its_favorites_rg_027_05` (Phase 5) |
| 10 | Le tri n'est pas modifié par les favoris | ✅ par construction (`sortMergeRequests` ne reçoit jamais `isFavorite`) |
| 11 | Un draft favori reste soumis à l'affichage des drafts | ✅ e2e `should_keep_a_favorited_draft_hidden_unless_drafts_are_included_rg_027_13` |
| 12 | Favoris conservés à l'export puis à l'import | ✅ export en e2e réel + import en e2e réel (`should_import_and_export_a_favorite_rg_027_15`, Phase 5) |
| 13 | Un favori importé pour un repo inconnu est ignoré | ✅ unitaire + e2e `should_silently_ignore_a_favorite_for_an_unknown_repo_rg_027_15` (Phase 5) |
| 14 | Échec serveur lors de la bascule | ✅ store + intégration `BoardPageComponent` avec toast réel (Phase 5) |

**14/14 scénarios validés avec preuve de bout en bout après les corrections de Phase 5.**

## 5. Bugs / anomalies trouvés

### BUG-004 (modéré) — Cascade de suppression d'un repo → favoris jamais vérifiée empiriquement — ✅ corrigé en Phase 5

Test e2e ajouté (`merge-requests.e2e-spec.ts`, `DELETE /projects/:id should_purge_its_favorites_rg_027_05`) :
marque une MR favorite, supprime réellement son repo via `DELETE /api/v1/projects/:id`, vérifie via
`GET /settings/export` que plus aucun favori ne référence ce repo. Confirme empiriquement que la contrainte
`ON DELETE CASCADE` fonctionne pour la table `favorites`.

<details>
<summary>Détail original de la découverte (QA)</summary>

- **Constat** : RG-027-05 et le scénario Gherkin « Supprimer un repo purge ses favoris » reposent entièrement sur
  la contrainte `FK_favorites_project ... ON DELETE CASCADE` posée en migration (`archi.md` §2.1) — aucun test,
  unitaire ou e2e, ne créait un favori puis ne supprimait réellement son repo pour vérifier que la ligne
  `favorites` disparaissait bien de la base.
- **Analyse** : le raisonnement de `archi.md` (FK appliquées en fonctionnement normal, seulement désactivées
  pendant l'exécution des migrations) est correct et déjà démontré pour `merge_requests.project_id`, mais jamais
  reproduit pour la nouvelle table `favorites`.
- **Impact** : risque fonctionnel réel (pas seulement un trou de couverture) — c'est le seul mécanisme censé
  empêcher une accumulation indéfinie de favoris orphelins après suppression d'un repo.

</details>

### BUG-003 (mineur à modéré) — Survie d'un favori à la disparition puis au retour de sa MR jamais simulée — ✅ corrigé en Phase 5

Test e2e ajouté (`should_keep_a_favorite_across_its_merge_requests_disappearance_and_reappearance_rg_027_04`) :
synchronise une MR, la marque favorite, resynchronise sans elle (elle disparaît via `deleteMissing`), vérifie
qu'elle n'apparaît plus, puis la resynchronise à nouveau — vérifie que le nouvel id interne diffère du premier
**et** que `isFavorite: true` malgré tout, prouvant que le rattachement par `(projectId, iid)` fonctionne.

<details>
<summary>Détail original de la découverte (QA)</summary>

- **Constat** : le scénario Gherkin dédié (specs.md §5, MR d'iid 42 sur « web/api ») et RG-027-04 tout entier
  n'avaient aucun test qui simule le cycle complet `upsertForProject` → `deleteMissing` → `isFavorite` reste vrai
  en base → nouveau `upsertForProject` avec le même `(projectId, iid)` → `isFavorite: true` à nouveau.
- **Analyse** : chaque brique était testée séparément, mais leur enchaînement dans le temps — la garantie même de
  RG-027-04 — n'était démontré nulle part.
- **Impact** : fonctionnel modéré — si `upsertForProject` ne retombait jamais sur le même `(projectId, iid)`
  qu'avant, le favori resterait orphelin silencieusement sans qu'aucun test ne l'attrape.

</details>

### BUG-002 (mineur) — Combinaison Favoris + filtre composable jamais testée directement — ✅ corrigé en Phase 5

Test e2e ajouté (`GET /merge-requests?fav=1&project=... should_combine_favorites_with_a_composable_filter_rg_027_10`) :
deux MRs favorites sur deux repos différents, `fav=1&project=api` ne retourne que celle du repo `api`.

<details>
<summary>Détail original de la découverte (QA)</summary>

- **Constat** : le scénario Gherkin « Le filtre Favoris se combine avec les autres filtres » (ex. Projet) n'avait
  pas de test dédié, contrairement à des combinaisons équivalentes déjà couvertes pour `mine`/`drafts`.
- **Relecture de code** : `favoritesOnly` est appliqué dans `loadBase()` avant que `listOpen()` n'applique
  `applyComposableFilters()` — même mécanisme séquentiel et indépendant que `mineOnly`, déjà éprouvé. Comportement
  jugé correct à la lecture, désormais prouvé par un test.

</details>

### BUG-005 (mineur) — Round-trip export→import de favoris jamais exercé via le véritable endpoint HTTP — ✅ corrigé en Phase 5

2 tests e2e ajoutés à `settings-transfer.e2e-spec.ts` : import d'un favori puis vérification par export
(`should_import_and_export_a_favorite_rg_027_15`), et import d'un favori sur un repo inconnu ignoré sans erreur
(`should_silently_ignore_a_favorite_for_an_unknown_repo_rg_027_15`).

<details>
<summary>Détail original de la découverte (QA)</summary>

- **Constat** : `settings-transfer.e2e-spec.ts` ne contenait aucun scénario avec `favorites` dans le corps de
  `POST /settings/import`. L'import n'était prouvé qu'unitairement (mocks) ; seul l'export avait une preuve e2e
  réelle.
- **Impact** : aucun impact fonctionnel connu à la lecture, mais le scénario Gherkin correspondant n'était validé
  qu'à moitié de bout en bout.

</details>

### BUG-001 (mineur) — Intégration `BoardPageComponent` non prouvée pour les favoris — ✅ corrigé en Phase 5

4 tests ajoutés à `board-page.component.spec.ts` : clic sur le chip « Favoris » → rechargement avec `fav=1` ;
clic sur le bouton étoile rendu dans le vrai tableau → appel `PUT` + mise à jour visuelle ; échec serveur → toast
réel + rollback visuel ; restauration de `fav=1` depuis l'URL au niveau de la page.

<details>
<summary>Détail original de la découverte (QA)</summary>

- **Constat** : contrairement à `drafts`/`mine`, aucun test de `board-page.component.spec.ts` ne cliquait sur le
  chip « Favoris », ne cliquait sur le bouton étoile rendu dans le vrai tableau, n'affichait le toast d'erreur
  réel, ni ne restaurait `fav=1` depuis l'URL au niveau de la page.
- **Relecture de code** : `onFavoritesToggle()`/`onFavoriteStarToggle()` et le câblage template suivaient
  exactement le patron déjà en place pour `onMineToggle()`/`onThemeToggle()` — jugé correct à la lecture, désormais
  prouvé de bout en bout.

</details>

### Suggestion (revue de code) — cohérence architecturale : `isFavorite` extrait en fonction pure `domain/` — ✅ corrigée en Phase 5

`favoriteKey()`/le calcul de `isFavorite` vivaient comme fonctions privées directement dans
`merge-requests.service.ts`, alors que le calcul équivalent `isMine`/`isMe` (RG-G09) est une fonction pure dans
`domain/is-mine.ts`, testée indépendamment. Extrait vers `domain/is-favorite.ts` (`favoriteKey`/`isFavorite`),
avec son propre `is-favorite.spec.ts` (5 tests), pour la cohérence architecturale du module et une meilleure
testabilité isolée — même pattern que les autres règles calculables du module (`architecture-backend.md` : « les
règles métier calculables sont des fonctions pures dans `domain/`, testées unitairement »).

## 6. Recommandations

1. Vérification visuelle en direct dès que l'extension Claude in Chrome sera disponible (§3) — non bloquant,
   attention particulière à l'alignement vertical de l'étoile dans sa cellule de 36 px.
2. QA API manuelle non réalisée cette fois-ci (§2), comme pour US-025/US-026 — même limitation d'environnement.
