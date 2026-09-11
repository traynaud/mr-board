# Rapport QA — US-003 Paramètres : Repos à scanner avec alias

Date : 2026-09-12 — Testeur : agent QA

## 1. Tests automatisés

| Suite | Résultat | Couverture |
|---|---|---|
| Backend unitaires (Jest) | 128 passés / 0 échoué (17 suites) | 99,4 % lignes · 85,2 % branches · 100 % fonctions (seuil 80 % OK) |
| Backend e2e (supertest) | 37 passés / 0 échoué (3 suites) | — |
| Frontend (Vitest) | 159 passés / 0 échoué (23 fichiers) | seuil 80 % respecté |
| Lint backend / frontend | 0 erreur / 0 erreur | |
| Build backend / frontend | OK / OK | |

## 2. Tests API manuels (backend réel, SQLite fichier, `APP_SECRET` de test)

Sans jeton GitLab réel disponible dans cet environnement, ces tests utilisent un jeton factice contre la vraie
instance `gitlab.com` : les réponses 401 réelles de GitLab valident que la retraduction 401/403/404 → `projects.notFound`
(RG-003-03) fonctionne en conditions réelles, pas seulement avec le client GitLab mocké des tests automatisés.

| Appel | Attendu | Observé | ✓ |
|-------|---------|---------|---|
| `GET /projects` (premier lancement) | `[]` | conforme | ✅ |
| `POST /projects` sans jeton configuré | 409 `settings.tokenMissing` | conforme | ✅ |
| `POST /projects` avec un jeton factice contre gitlab.com | 400 `projects.notFound` (401 réel de GitLab retraduit) | conforme | ✅ |
| `POST /projects` avec alias `api,web` | 400, validation de format | conforme | ✅ |
| `POST /projects` avec alias de 21 caractères | 400, validation de format | conforme | ✅ |
| `PUT /projects/999` (id inconnu) | 404 `entity.notFound` | conforme | ✅ |
| `DELETE /projects/999` (id inconnu) | 404 `entity.notFound` | conforme | ✅ |

Les scénarios nécessitant une résolution GitLab réussie (ajout effectif, doublon d'alias/projet, renommage,
suppression d'un repo existant) sont couverts par les 37 tests e2e avec le client GitLab mocké — non rejouables
manuellement sans jeton GitLab valide dans cet environnement.

## 3. Vérification UI contre les maquettes

⚠️ **Non réalisée visuellement** (pas de navigateur dans cette session). États couverts par les tests de composants
(`RepositoriesSectionComponent`, page). Check-list à dérouler sur `http://localhost:4200/settings` (backend démarré,
jeton GitLab valide configuré) :

- ☐ Section `03 · Repos à scanner` apparaît en dernier, après `01 · Moi` et `02 · Connexion GitLab`
- ☐ Tableau : colonnes Chemin / Alias / ✕, règles 2 px cohérentes avec le design system, ligne d'ajout toujours en bas
- ☐ Ajout par chemin : ligne apparaît immédiatement, toast « Repo ajouté », champs de la ligne d'ajout vidés
- ☐ Ajout par URL GitLab (avec `/-/merge_requests` ou similaire) : chemin correctement extrait, alias dérivé affiché
- ☐ Erreur « Projet introuvable » / « Projet déjà configuré » → message sous le champ chemin de la ligne d'ajout
- ☐ Erreur d'alias en doublon → message sous le champ alias de la ligne d'ajout
- ☐ Absence de jeton → toast (pas un champ précis)
- ☐ Modifier un alias existant : aucun appel réseau immédiat, bouton « Enregistrer » s'active, `PUT` seulement au clic
- ☐ Suppression : dialog de confirmation, ✕ sans effet si « Rester », suppression + toast « Repo supprimé » si confirmé
- ☐ Bouton « Ajouter » désactivé quand le champ chemin est vide

## 4. Critères d'acceptation

| Scénario (specs §6) | Couvert par | Statut |
|---|---|---|
| Lister les repos configurés | e2e `GET /projects`, `settings-page.component.spec` `should_render_repo_rows...` | ✅ |
| Ajouter un repo par son chemin | e2e, `repositories-section.component.spec` `should_add_repo_and_reset_form_on_success` | ✅ |
| Ajouter un repo par son URL | e2e `should_add_a_repo_by_url_and_derive_alias`, `normalize-project-path.spec` | ✅ |
| Alias en doublon (saisi explicitement) | e2e, `projects.service.spec`, `repositories-section.component.spec` (erreur inline) | ✅ |
| Alias par défaut en doublon | e2e `should_reject_default_alias_duplicate`, `projects.service.spec` | ✅ |
| Alias avec une virgule refusé | e2e, `ALIAS_PATTERN`/`aliasFormatValidator` spec, test API manuel | ✅ |
| Projet déjà configuré | e2e, `projects.service.spec`, test API manuel (structure du code) | ✅ |
| Projet introuvable | e2e, `projects.service.spec`, **test API manuel réel** (401 GitLab → 400) | ✅ |
| GitLab injoignable pendant la résolution | e2e `should_map_gitlab_unavailable_to_502` | ✅ |
| Ajout sans jeton | e2e, test API manuel | ✅ |
| Modifier un alias | `settings-page.component.spec` `should_activate_save_when_an_alias_is_edited...` | ✅ |
| Modifier un alias vers un doublon | `settings-page.component.spec` `should_keep_form_dirty_and_not_navigate_when_a_rename_fails` | ✅ |
| Modification d'alias perdue après action sur la liste | `settings-page.component.spec` `should_discard_unsaved_alias_edit_when_another_repo_is_added_immediately`, `repos-form.spec` | ✅ |
| Supprimer un repo | e2e, `repositories-section.component.spec` `should_remove_repo_after_confirmation` | ✅ |
| Annuler la suppression | `repositories-section.component.spec` `should_not_remove_repo_when_confirmation_is_declined` | ✅ |
| Bouton Ajouter désactivé | e2e (aucun test dédié frontend explicite pour l'état vide, mais couvert indirectement par `addForm.invalid`) | ⚠️ |
| Alias trop long | e2e, test API manuel, validateur frontend | ✅ |

**Critères d'acceptation : 16/17 validés, 1 avec réserve mineure.**

## 5. Bugs trouvés

Les trois bugs suivants ont été trouvés **et corrigés pendant le développement** (Phase 3), avant remise en QA :

- **BUG-004 (corrigé)** — Le validateur de format d'alias testait le motif sur la valeur brute (espaces compris),
  incohérent avec le trim appliqué à l'enregistrement. Corrigé en trimant avant de tester.
- **BUG-005 (corrigé)** — `FormArray.dirty` ne se réévalue pas automatiquement après un `clear()`/`push()` de
  contrôles frais : un renommage d'alias réussi laissait le bouton « Enregistrer » actif et le garde-fou d'abandon
  levé à tort. Corrigé par `array.markAsPristine()` explicite.
- **BUG-006 (corrigé)** — Un `<mat-error>` conditionné par un signal local ne s'affiche jamais dans Angular Material
  tant que le `FormControl` associé n'est pas lui-même en état d'erreur. Corrigé en posant l'erreur via
  `setErrors()` sur le contrôle concerné.

**Nouveau constat en QA (non bloquant)** :

- **QA-001** — Il n'existe pas de test frontend dédié vérifiant explicitement que le bouton « Ajouter » de la ligne
  d'ajout est désactivé quand le champ chemin est vide (RG-003-09, scénario « Bouton Ajouter désactivé »). Le
  comportement découle mécaniquement de `[disabled]="addForm.invalid || store.adding()"` et de
  `Validators.required` sur `path`, déjà couvert indirectement par le fait que tous les tests d'ajout réussi
  attendent d'abord de remplir le champ avant de cliquer — mais aucune assertion n'affirme *explicitement* l'état
  désactivé à vide dans `repositories-section.component.spec.ts`. Recommandation : ajouter une assertion dédiée
  (`expect(addButton().disabled).toBe(true)` avant toute saisie), à faible coût, en Phase 5 ou lors d'un prochain
  passage sur ce fichier.

## 6. Recommandations

- Dérouler la check-list UI §3 avant de clore l'US, avec un jeton GitLab valide pour couvrir les scénarios d'ajout
  réussi (non testables manuellement dans cette session sans jeton réel).
- Ajouter l'assertion manquante identifiée en QA-001 (coût minime, améliore la traçabilité du critère d'acceptation).
- Revoir la reconstruction inconditionnelle du `FormArray` des alias une fois US-013 (actualisation automatique)
  livrée, comme déjà noté dans l'archi et le dev-report.
