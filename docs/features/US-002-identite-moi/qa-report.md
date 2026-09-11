# Rapport QA — US-002 Paramètres : Identité « Moi »

Date : 2026-09-12 — Testeur : agent QA

## 1. Tests automatisés

| Suite | Résultat | Couverture |
|---|---|---|
| Backend unitaires (Jest) | 86 passés / 0 échoué (13 suites) | 99,5 % lignes · 86,3 % branches · 100 % fonctions (seuil 80 % OK) |
| Backend e2e (supertest) | 20 passés / 0 échoué (2 suites) | — |
| Frontend (Vitest) | 106 passés / 0 échoué (19 fichiers) | seuil 80 % respecté |
| Lint backend / frontend | 0 erreur / 0 erreur | |
| Build backend / frontend | OK / OK | |

**Correction documentaire** : le dev-report indiquait initialement 92 tests unitaires backend ; le nombre réel constaté à l'exécution est 86 (corrigé dans `dev-report.md`).

## 2. Tests API manuels (backend réel, SQLite fichier, `APP_SECRET` de test)

| Appel | Attendu | Observé | ✓ |
|-------|---------|---------|---|
| `GET /settings` (premier lancement) | `meUsername: null, meEmail: null` | conforme | ✅ |
| `PUT /settings` avec username/email entourés d'espaces | 200, valeurs trimées (`mdupont`, `marie@exemple.fr`) | conforme | ✅ |
| `PUT /settings` avec seulement `{ gitlabUrl }` | 200, identité inchangée | conforme | ✅ |
| `PUT /settings` avec `meEmail: "marie@"` | 400, message sur `meEmail` | conforme | ✅ |
| `PUT /settings` avec `meUsername: "", meEmail: ""` | 200, `null`/`null` | conforme | ✅ |
| `GET /settings` après effacement | `null`/`null` persistés | conforme | ✅ |
| `POST /settings/test-connection` avec `meUsername` dans le body | 400 `property meUsername should not exist` | conforme (régression du refactor DTO vérifiée en conditions réelles) | ✅ |

## 3. Vérification UI contre les maquettes

⚠️ **Non réalisée visuellement** (pas de navigateur dans cette session). États couverts par les tests de composants
(`MeSectionComponent`, `AvatarComponent`, page). Check-list à dérouler sur `http://localhost:4200/settings` :

- ☐ Section `01 · Moi` apparaît **avant** `02 · Connexion GitLab`, même style de titre/description (accent, 12 px gris)
- ☐ Champs « Nom d'utilisateur GitLab » et « Email (optionnel) » en grille `1fr 1fr`, mêmes classes que la section Connexion GitLab
- ☐ Champ vide → aucune ligne d'aperçu
- ☐ Après un test de connexion réussi avec username vide → le champ se pré-remplit, le formulaire passe en « modifié », l'aperçu affiche l'avatar/initiales, le nom complet et le tag « détecté via le jeton »
- ☐ Username saisi manuellement (différent du test, ou sans test) → carré d'initiales calculées, tag « ne correspond pas au jeton » ou « saisi manuellement » selon le cas
- ☐ Avatar carré 28 px sans arrondi, image GitLab si disponible sinon initiales blanches sur fond `neutral-800`
- ☐ Email invalide → message d'erreur sous le champ, cohérent visuellement avec celui de l'URL/jeton
- ☐ `Enregistrer` toujours désactivé quand rien n'est modifié dans **aucune** des deux sections

## 4. Critères d'acceptation

| Scénario (specs §6) | Couvert par | Statut |
|---|---|---|
| Saisir et enregistrer mon identité | e2e, `settings.service.spec` | ✅ |
| Enregistrer un email valide | e2e, `settings.service.spec` | ✅ |
| Email invalide | e2e 400, `settings-form.spec` (validateur), `me-section.component.spec` (message) | ✅ |
| Effacer mon identité | e2e `clear_identity_fields_with_empty_strings`, `settings.service.spec` | ✅ |
| Champ omis du corps de la requête | e2e `keep_identity_fields_when_omitted`, `settings.service.spec` | ✅ |
| Aperçu — identité non configurée | `me-section.component.spec` `should_hide_preview_when_unset` | ✅ |
| Aperçu — pré-remplissage après test de connexion | `settings-page.component.spec` `should_prefill_username_after_successful_test_when_empty` | ✅ |
| Aperçu — ne pas écraser un username déjà saisi | `settings-page.component.spec` `should_not_overwrite_username_already_filled_after_test` | ✅ |
| Aperçu — saisie manuelle sans test | `settings-page.component.spec` `should_show_manual_status_when_no_test_has_run`, `me-identity.spec` | ✅ |
| Calcul des initiales sans nom complet connu | `compute-initials.spec` (tous les cas de la table, y compris la correction `l_rousseau → LR`) | ✅ |
| Initiales calculées depuis un nom complet connu | `avatar.component.spec`, `me-section.component.spec` (cas « Marie Dupont » → MD) | ✅ |
| Avatar GitLab disponible | `avatar.component.spec` `should_render_image_with_alt_when_avatar_url_is_set` | ✅ |

**Critères d'acceptation : 12/12 validés** (vérification visuelle en réserve, cf. §3).

## 5. Bugs trouvés

Les deux bugs suivants ont été trouvés **et corrigés pendant le développement** (Phase 3), avant remise en QA. Ils sont
listés ici pour traçabilité, conformément au format attendu, avec le statut de résolution.

- **BUG-002 (corrigé)** — `@IsEmail()` rejetait un email avec espaces en bordure, bloquant la validation avant que le
  service ne trime la valeur. Corrigé par un `@Transform` de trim avant validation dans `UpdateSettingsDto`. Vérifié
  manuellement (`PUT` avec `"  marie@exemple.fr  "` → 200, valeur trimée).
- **BUG-003 (corrigé)** — la remise à zéro du résultat de test de connexion écoutait tout changement du formulaire
  partagé, ce qui effaçait le résultat juste utilisé pour le pré-remplissage du username (RG-002-04), empêchant
  l'aperçu d'atteindre l'état « détecté via le jeton ». Corrigé en limitant l'écoute aux champs URL/jeton (RG-001-05).
  Vérifié par `settings-page.component.spec.ts` (`should_prefill_username_after_successful_test_when_empty`).

Aucun nouveau bug trouvé en QA.

## 6. Recommandations

- Dérouler la check-list UI §3 avant de clore l'US, en particulier l'enchaînement test de connexion → pré-remplissage
  → aperçu, qui est le comportement le plus subtil de cette US.
- Le préfixe `@` ajouté par `MeSectionComponent` devant un username sans nom connu (`@lrousseau`) n'est pas dans les
  specs ; à valider ou ajuster visuellement, sans impact fonctionnel si conservé.
- Revoir QO-002-01 (autocomplétion depuis les utilisateurs synchronisés) une fois US-004 livrée.
