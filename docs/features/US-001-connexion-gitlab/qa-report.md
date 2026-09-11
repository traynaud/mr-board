# Rapport QA — US-001 Paramètres : Connexion GitLab

Date : 2026-09-12 — Testeur : agent QA

## 1. Tests automatisés

| Suite                    | Résultat                     | Couverture                                   |
|--------------------------|------------------------------|----------------------------------------------|
| Backend unitaires (Jest) | 78 passés / 0 échoué (13 suites) | 99,5 % lignes · 84,5 % branches · 100 % fonctions (seuil 80 % OK) |
| Backend e2e (supertest)  | 15 passés / 0 échoué (2 suites)  | —                                            |
| Frontend (Vitest)        | 72 passés / 0 échoué (15 fichiers) | seuil 80 % respecté (builder sort en succès) |
| Lint backend / frontend  | 0 erreur / 0 erreur          |                                              |
| Build backend / frontend | OK / OK                      |                                              |

## 2. Tests API manuels (backend réel, SQLite fichier, `APP_SECRET` de test)

| Appel | Attendu | Observé | ✓ |
|-------|---------|---------|---|
| `GET /settings` (première exécution) | 200, `gitlab.com`, `tokenConfigured:false`, `tokenHint:null` | conforme (migration + ligne singleton OK) | ✅ |
| `POST /settings/test-connection` sans jeton | 409 `settings.tokenMissing` | conforme | ✅ |
| `PUT /settings` `gitlab.exemple.fr` | 400 message sur `gitlabUrl` | conforme | ✅ |
| `PUT /settings` jeton `abc` | 400 message sur `gitlabToken` (≥ 8) | conforme | ✅ |
| `PUT /settings` champ inconnu `hack` | 400 `property hack should not exist` | conforme (`forbidNonWhitelisted`) | ✅ |
| `PUT /settings` URL avec `/` final + jeton | 200, URL normalisée, `tokenHint:"wxyz"`, jeton absent | conforme | ✅ |
| `PUT /settings` jeton `""` | 200, jeton conservé | conforme | ✅ |
| `POST /settings/test-connection` jeton stocké contre gitlab.com | 502 `gitlab.auth` (jeton bidon) | conforme, réponse sans jeton | ✅ |
| `POST /settings/test-connection` `https://127.0.0.1:1` | 502 `gitlab.unavailable` | conforme | ✅ |
| `GET /settings` après redémarrage de la requête | 200 `tokenConfigured:true` | conforme (persistance + déchiffrement) | ✅ |
| Logs backend (niveau warn) | aucune trace du jeton | 17 lignes, jeton absent | ✅ |

## 3. Vérification UI contre les maquettes

⚠️ **Non réalisée visuellement** (pas de navigateur disponible dans cette session). Les états sont couverts par les
tests de composants (chargement, erreur + Réessayer, hint « Aucun jeton » / « Jeton configuré (…wxyz) », œil,
résultat du test vert / rouge / « Connexion… », bouton Enregistrer désactivé, mat-error). Check-list à dérouler
manuellement sur `http://localhost:4200/settings` (backend démarré) :

- ☐ En-tête : ←, « Paramètres », « Annuler », « Enregistrer » (flat accent, désactivé au chargement), règle 2 px
- ☐ Grille 200 px / 1fr, titre `02 · Connexion GitLab` en accent, description grise, règle 2 px sous la section
- ☐ Champs outlined sans arrondi, Archivo, densité compacte ; hint sous le jeton ; placeholder « Laisser vide… » si jeton configuré
- ☐ Œil bascule le masquage ; focus ring accent au clavier
- ☐ « Tester la connexion » désactivé sans jeton, « Connexion… » pendant l'appel, résultat vert avec ✓ / rouge
- ☐ Enregistrer → toast bas gauche fond sombre « Paramètres enregistrés » + action OK, retour au tableau
- ☐ Modifier puis Annuler / ← / bouton précédent → dialog « Abandonner les modifications ? » (Rester / Abandonner), sans arrondi
- ☐ Largeur ≤ 640 px : une colonne

## 4. Critères d'acceptation

| Scénario (specs §5) | Couvert par | Statut |
|---------------------|-------------|--------|
| Accéder à l'écran Paramètres depuis le tableau | `app.spec` (route), `board-page.component.spec` (lien) | ✅ |
| Valeurs par défaut au premier lancement | e2e `GET defaults`, `gitlab-connection-section.spec` (hint « Aucun jeton ») | ✅ |
| Enregistrer un jeton valide | e2e `store_normalized_url_and_masked_token`, `settings-page.spec` save flow | ✅ (déclenchement de la synchro : point d'extension US-004, hors périmètre) |
| Conserver le jeton existant si le champ est vide | e2e `keep_token_when_field_is_empty_or_absent`, curl | ✅ |
| Normaliser l'URL | `normalize-gitlab-url.spec`, e2e, curl | ✅ |
| Refuser une URL invalide | e2e 400, `settings-form.spec`, section `mat-error` | ✅ |
| Tester la connexion avec succès | `settings.service.spec`, `settings-page.spec`, section (libellé complet) | ✅ |
| Tester la connexion avec le jeton déjà enregistré | e2e `use_stored_token_when_omitted`, page spec, curl | ✅ |
| Jeton non personnel sans endpoint d'expiration | `gitlab-client.spec` 404→null, e2e `tolerate_missing_token_info`, section « expiration inconnue » | ✅ |
| Scope insuffisant | `check-token-scopes.spec`, e2e 400 `gitlab.scope` | ✅ |
| Résultat du test effacé à la modification | `settings-page.spec` `reset_result_on_change` | ✅ |
| Jeton trop court | e2e 400, section `mat-error`, curl | ✅ |
| Bouton Enregistrer inactif sans modification | `settings-page.spec` `enable_save_when_dirty_and_valid` | ✅ |
| Annuler sans modification | `unsaved-changes.guard.spec` (pas de dialog), page spec `cancel` | ✅ |
| Backend injoignable au chargement | `settings-page.spec` `error_and_retry` | ✅ |
| Échec de l'enregistrement | `settings-page.spec` `toast_error_and_stay` | ✅ |
| Tester la connexion avec un jeton refusé | e2e 502 `gitlab.auth`, section erreur, curl réel | ✅ |
| Tester la connexion avec une instance injoignable | `gitlab-client.spec` (timeout, réseau), curl | ✅ |
| Bouton de test désactivé sans jeton | `settings-page.spec` `disable_test_without_token` | ✅ |
| Afficher / masquer le jeton | section spec `toggle_token_visibility` | ✅ |
| Annuler des modifications (dialog) | `unsaved-changes.guard.spec`, `confirm-dialog.spec` ; guard câblé dans `app.routes.ts` | ✅ (enchaînement complet routeur → guard → dialog non testé de bout en bout, à valider manuellement) |
| Jeton illisible après changement de clé | `token-cipher.spec` `key_differs`, `settings.service.spec` `unreadable_token` | ✅ |

**Critères d'acceptation : 22/22 validés** (2 avec réserve de vérification manuelle).

## 5. Bugs trouvés

- **BUG-001 (mineur, cosmétique) — corrigé en Phase 5 (revue)** — Le champ `error` des réponses d'erreur n'est pas homogène : `"CONFLICT"` /
  `"BAD_GATEWAY"` pour les exceptions métier (constante `HttpStatus`) contre `"Bad Request"` pour les exceptions Nest.
  Sans impact fonctionnel (le frontend s'appuie sur `code`). Recommandation : produire le libellé HTTP standard dans
  `BusinessException` ou dans le filtre.

## 6. Recommandations

- Dérouler la check-list UI §3 avant de clore l'US (ou ajouter un test Playwright quand la phase E2E sera lancée).
- Prévoir un test d'intégration routeur → guard → dialog (via `RouterTestingHarness` + `MatDialogHarness`) lors de la
  prochaine US touchant l'écran Paramètres (US-002).
- `TranslatePipe` impur : surveiller les performances sur le tableau (US-005).
