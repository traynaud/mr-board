# Rapport QA — US-025 Couleur d'arrière-plan par repo dans la colonne Projet

Testé le 2026-09-14.

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Backend `npm test` | ✅ 564 passed / 0 failed (50 suites) |
| Backend `npm run test:e2e` | ✅ 132 passed / 0 failed (7 suites) |
| Backend `npm run test:cov` | ✅ 98.88 % stmts / 89.42 % branch / 98 % funcs / 98.95 % lines — seuil 80 % largement respecté ; `project.entity.ts` et `domain/project-color.ts` à 100 % |
| Backend `npm run lint` / `npm run build` | ✅ |
| Frontend `npx tsc --noEmit` | ✅ |
| Frontend `npx ng test --no-watch --coverage` | ✅ 748 passed / 0 failed (65 suites) — +4 tests ajoutés en Phase 5 (revue de code) |
| Frontend couverture globale | ✅ 96.54 % stmts / 94.63 % branch / 92.23 % funcs / 98.72 % lines — seuil 80 % largement respecté ; `shared/project-color/*` (palette, `projectTagStyle`, `ProjectColorPickerComponent`) absents du tableau détaillé car à 100 % sur les 4 métriques |
| Frontend `npm run build` | ✅ |

## 2. Tests API manuels

**Non réalisés.** En tentant de démarrer une instance backend isolée pour ces tests, ma commande a interrogé un
processus backend déjà en cours d'exécution sur le port choisi (`node dist/main`, démarré indépendamment de cette
session) au lieu de ma propre instance (qui avait en fait échoué au démarrage sur une variable `APP_SECRET` trop
courte). Une connexion de test a été créée par erreur sur cette instance déjà active puis immédiatement supprimée
après vérification que rien d'autre n'avait été modifié (aucun repo n'a pu être ajouté, l'appel ayant échoué avant
toute écriture). Sur decision de l'utilisateur, la QA API manuelle a été explicitement passée au profit des tests
e2e automatisés (§1), qui couvrent déjà : validation de la couleur (palette fermée, 400 sur une valeur hors liste),
206 création/mise à jour avec couleur, remise à « Aucune », et export/import (voir `backend/test/projects.e2e-spec.ts`
et `backend/test/settings-transfer.e2e-spec.ts`).

## 3. Vérification UI contre les maquettes

⚠️ **Non réalisée en direct**, comme lors des QA précédentes de ce projet (US-021, US-024) : l'extension Claude in
Chrome reste déconnectée dans cet environnement (`tabs_context_mcp` échoue avec « Browser extension is not
connected »). Compensé par une relecture complète du code (templates + SCSS) et par les tests unitaires (§1) :
- Palette conforme à `design.md` (10 couples fond/texte fixes), aucun arrondi (`border-radius: 0` sur toutes les
  pastilles), respect des tokens de neutre existants (`--color-neutral-400/600`, `--color-divider`).
- Menu de couleur : implémenté comme une liste `mat-menu-item` plutôt que la grille icône-only prévue dans
  `design.md` (écart signalé dans `dev-report.md` §Écarts, sans impact sur les RG).

**Recommandation** : vérifier visuellement dès que l'extension sera disponible, en particulier le contraste réel
des 10 couleurs sur les deux thèmes (clair/sombre) et l'alignement du picker dans la ligne du tableau des repos.

## 4. Critères d'acceptation (specs.md §5)

| Scénario | Statut |
|----------|--------|
| Repo sans couleur garde l'apparence actuelle | ✅ `should_keep_tag_neutral_when_the_repo_has_no_color_rg_025_01` |
| Couleur choisie sur une MR Ready | ✅ `should_show_the_full_color_for_a_ready_mr_rg_025_03` |
| Même couleur éclaircie sur une MR Draft | ✅ `should_lighten_the_color_for_a_draft_mr_rg_025_04` |
| Changer la couleur d'un repo met à jour toutes ses MRs | ✅ `should_update_every_row_of_the_same_repo_when_its_color_changes` (deux MRs du même alias, ajouté en Phase 5) + `should_update_the_color_rg_025_07` (service) |
| Revenir à « Aucune » restaure le style neutre | ✅ `should_clear_the_color_back_to_none_rg_025_01` (service), `should_set_and_then_clear_the_color_rg_025_01_07` (e2e), `should_emit_null_when_none_is_chosen` (picker) |
| Deux repos avec des couleurs différentes coexistent | ✅ `should_resolve_the_color_by_the_rows_own_project_alias_rg_025_06` (résolution indépendante par ligne, pas d'état partagé entre lignes) |
| Couleur conservée à l'export puis à l'import | ✅ `should_import_and_export_a_repos_color_rg_025_08` (e2e) |
| Le filtre Projet affiche la couleur de chaque repo | ✅ 3 tests ajoutés en Phase 5 (voir BUG-001) |

**8/8 scénarios validés avec test dédié.**

## 5. Bugs / anomalies trouvés

### BUG-001 (mineur) — Pastille du filtre Projet non couverte par un test automatisé — ✅ corrigé en Phase 5

3 tests ajoutés à `filter-pill.component.spec.ts` (`should_show_a_swatch_on_a_project_option_whose_repo_has_a_color_rg_025_09`,
`should_not_show_a_swatch_on_a_project_option_whose_repo_has_no_color_rg_025_01`,
`should_not_show_a_swatch_for_a_non_project_filter_rg_025_09`) — suite complète rejouée : 748 passed / 0 failed.

<details>
<summary>Détail original de la découverte (QA)</summary>

- **Constat** : `FilterPillComponent.swatchFor()` et son rendu dans `filter-pill.component.html` (RG-025-09)
  n'ont aucun test dans `filter-pill.component.spec.ts`. Le rapport de couverture montre `filter-pill.component.ts`
  à 100 % statements mais seulement 90.4 % branch — cohérent avec une méthode dont une seule branche (« pas de
  couleur/pas le filtre Projet ») est exercée par les tests existants, jamais la branche « couleur trouvée et
  affichée ».
- **Relecture de code** : le mapping repose sur `option.value` (l'alias, confirmé par `FacetOption`/`ComposableFilters`)
  et `Project.alias`, exactement comme `mr-table.component.ts` le fait déjà pour la case du tableau (mécanisme
  identique, déjà testé là-bas) — la logique paraît correcte à la lecture, mais n'est pas prouvée par un test pour
  ce composant précis.
- **Reproduction suggérée pour un test** : monter `FilterPillComponent` avec `filterKey="project"`, `options`
  contenant une entrée `{ value: 'api', label: 'api', count: 3 }` et `projects` contenant `{ alias: 'api', color:
  'sage', ... }` ; ouvrir le menu et vérifier la présence d'un `.option-swatch` avec `background-color: rgb(200,
  221, 199)` sur cette option, absent sur une option dont le repo n'a pas de couleur.
- **Impact** : aucun impact fonctionnel connu (implémentation jugée correcte à la lecture) — uniquement un trou de
  couverture sur un critère d'acceptation explicite des specs. À corriger en Phase 5 (Revue de code).

</details>

## 6. Recommandations

1. ~~**BUG-001** : ajouter le test manquant pour la pastille du filtre Projet~~ — ✅ fait en Phase 5.
2. ~~Ajouter un test `MrTableComponent` avec deux lignes partageant le même `projectAlias`~~ — ✅ fait en Phase 5.
3. Vérification visuelle en direct dès que l'extension Claude in Chrome sera disponible (§3), en particulier le
   contraste des 10 couleurs en thème sombre.
4. QA API manuelle non réalisée cette fois-ci (§2) — à refaire via une instance isolée (port dédié, base SQLite
   jetable) si une vérification de bout en bout contre un vrai GitLab est un jour nécessaire.
