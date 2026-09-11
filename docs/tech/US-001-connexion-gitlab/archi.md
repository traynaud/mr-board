# Architecture — US-001 Paramètres : Connexion GitLab

## Résumé fonctionnel
> L'utilisateur renseigne l'URL de son instance GitLab et son jeton d'accès, teste la connexion et enregistre.
> Le backend stocke le jeton chiffré et ne le renvoie jamais ; l'écran Paramètres acquiert son cycle
> charger → modifier → tester → enregistrer / annuler (avec confirmation).

---

## Backend

### Impacts sur le modèle de données
- **Entités modifiées** : aucune (première entité du projet).
- **Nouvelle entité `Settings`** (`modules/settings/entities/settings.entity.ts`), table `settings` :

  | Colonne                  | Type SQLite | Contraintes                         | Rôle                                   |
  |--------------------------|-------------|-------------------------------------|----------------------------------------|
  | `id`                     | integer     | PK, toujours `1` (singleton)        | RG-001-09                              |
  | `gitlab_url`             | text        | NOT NULL, défaut `https://gitlab.com` | RG-001-01                            |
  | `gitlab_token_encrypted` | text        | NULL                                | Jeton chiffré `iv:tag:cipher` base64 (RG-001-10) |
  | `updated_at`             | text        | NOT NULL, ISO 8601                  | Audit                                  |

  Les colonnes des sections suivantes (identité, fréquence, seuils…) seront ajoutées par les US concernées via
  migrations dédiées. Un seul enregistrement, garanti par `CHECK (id = 1)`.
- **Migration** : `src/database/migrations/<ts>-CreateSettings.ts` — crée la table et insère la ligne `id = 1` avec
  les valeurs par défaut (idempotent grâce à `INSERT OR IGNORE`).

### Intégration dans les modules existants
- Nouveau module `SettingsModule` (`modules/settings/`) importé dans `AppModule`.
- Nouveau module `GitlabModule` (`modules/gitlab/`) exportant `GitlabClientService` ; importé par `SettingsModule`
  (sera réutilisé par US-003 et US-004).
- Nouveau module `CryptoModule` (`common/crypto/`) exportant `TokenCipherService` (clé dérivée de `APP_SECRET`
  via `scrypt`, AES-256-GCM). Réutilisé par toute lecture du jeton (US-003, US-004).
- `ConfigService` déjà en place (TECH-001) fournit `appSecret`.

### Contrat API
| Méthode | Route                          | Body / Query                              | Réponse                                  | Codes |
|---------|--------------------------------|-------------------------------------------|------------------------------------------|-------|
| GET     | `/api/v1/settings`             | —                                         | `SettingsResponseDto { gitlabUrl, tokenConfigured, tokenHint }` | 200 |
| PUT     | `/api/v1/settings`             | `UpdateSettingsDto { gitlabUrl, gitlabToken? }` | `SettingsResponseDto`               | 200, 400 (URL invalide, jeton < 8) |
| POST    | `/api/v1/settings/test-connection` | `TestConnectionDto { gitlabUrl, gitlabToken? }` | `TestConnectionResultDto { username, name, avatarUrl, expiresAt, expirationKnown }` | 200, 400 (`gitlab.scope`), 409 (`settings.tokenMissing`), 502 (`gitlab.auth` / `gitlab.unavailable`) |

Détails :
- `tokenHint` = 4 derniers caractères du jeton déchiffré, `null` si aucun jeton ou jeton illisible.
- `gitlabToken` absent ou vide dans `PUT` → jeton inchangé (RG-001-02). Transformer `class-transformer` : chaîne vide → `undefined`.
- `gitlabUrl` normalisée (`domain/normalize-gitlab-url.ts`) : trim, suppression du `/` final et de tout chemin (`/api/v4`…), schéma `http(s)` obligatoire, sinon 400.
- `test-connection` : jeton du body s'il est fourni, sinon jeton stocké (déchiffré), sinon 409 `settings.tokenMissing`.
- Codes d'erreur (`code`) stables consommés par le frontend pour l'i18n : `gitlab.auth`, `gitlab.unavailable`, `gitlab.scope`, `settings.tokenMissing`.

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| Créer `common/crypto/token-cipher.service.ts` + `crypto.module.ts` | Service | `encrypt(plain): string`, `decrypt(payload): string \| null` (null + warn si clé invalide ou payload corrompu) |
| Créer `common/crypto/token-cipher.service.spec.ts` | Test unitaire | Aller-retour, payload altéré, mauvaise clé |
| Créer `modules/gitlab/gitlab.module.ts` | Module | Exporte `GitlabClientService` |
| Créer `modules/gitlab/gitlab-client.service.ts` | Service | `getCurrentUser(baseUrl, token)`, `getTokenInfo(baseUrl, token)` via `fetch` natif, header `PRIVATE-TOKEN`, `AbortSignal.timeout(15000)` ; mappe 401/403 → `GitlabAuthException`, réseau/timeout/5xx → `GitlabUnavailableException`, 404 sur token info → `null` |
| Créer `modules/gitlab/types/gitlab-user.ts`, `gitlab-token-info.ts` | Types | Sous-ensemble typé des réponses GitLab |
| Créer `modules/gitlab/gitlab-client.service.spec.ts` | Test unitaire | `fetch` mocké : 200, 401, 404 token-info, 500, timeout, JSON invalide |
| Créer `modules/settings/entities/settings.entity.ts` | Entité TypeORM | Voir tableau ci-dessus |
| Créer migration `CreateSettings` | Migration | Table + ligne singleton |
| Créer `modules/settings/domain/normalize-gitlab-url.ts` (+ spec) | Fonction pure | RG-001-01 |
| Créer `modules/settings/domain/token-hint.ts` (+ spec) | Fonction pure | 4 derniers caractères |
| Créer `modules/settings/domain/check-token-scopes.ts` (+ spec) | Fonction pure | `read_api` ou `api` requis (RG-001-04) |
| Créer `modules/settings/dto/update-settings.dto.ts` | DTO | `@IsUrl({ require_protocol: true, require_tld: false, protocols: ['http','https'] })`, `@IsOptional() @MinLength(8)` |
| Créer `modules/settings/dto/test-connection.dto.ts` | DTO | Même validation d'URL, jeton optionnel |
| Créer `modules/settings/dto/settings-response.dto.ts`, `test-connection-result.dto.ts` | DTO | Réponses (jamais le jeton) |
| Créer `modules/settings/settings.service.ts` | Service | `get()`, `update(dto)`, `testConnection(dto)`, `getGitlabUrl()`, `getToken(): string \| null` (pour les US suivantes) |
| Créer `modules/settings/settings.service.spec.ts` | Test unitaire | Repository, cipher et client GitLab mockés ; tous les scénarios Gherkin backend |
| Créer `modules/settings/settings.controller.ts` (+ spec) | Controller | 3 routes |
| Créer `modules/settings/settings.module.ts` | Module | `TypeOrmModule.forFeature([Settings])`, imports `GitlabModule`, `CryptoModule` |
| Créer `test/settings.e2e-spec.ts` | Test e2e | Contrat complet sur `:memory:` avec `GitlabClientService` mocké via `createTestApp(b => b.overrideProvider(...))` ; vérifie l'absence du jeton dans toute réponse |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|--------------------------|--------|-------------------|
| `src/app.module.ts` | Import de `SettingsModule` | Faible | — |
| `src/common/exceptions/business.exception.ts` | Ajout `GitlabScopeException` (400, `gitlab.scope`) | Faible | Étend `BusinessValidationException` |
| `test/utils/create-test-app.ts` | Aucun changement requis (hook `customize` déjà prévu) | — | — |

---

## Frontend

### Intégration dans les features existantes
- Feature `features/settings/` : `SettingsPageComponent` (squelette TECH-002) devient la page complète ; nouvelle
  sous-feature `sections/gitlab-connection/`.
- Route `/settings` inchangée ; ajout d'un guard `canDeactivate` pour la confirmation d'abandon (RG-001-07), qui
  couvre « Annuler », le bouton retour et le bouton précédent du navigateur.

### Composants réutilisables et Angular Material
| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-toolbar`, `mat-button`, `mat-flat-button`, `mat-icon-button` | Angular Material | En-tête (existant) |
| `mat-form-field` (outlined) + `matInput` | Angular Material | URL, jeton |
| `matSuffix` + `mat-icon-button` + icônes `eye` / `eye-off` | Material + `shared/icons` | Afficher / masquer le jeton |
| `mat-stroked-button` | Angular Material | Tester la connexion |
| `mat-progress-bar` | Angular Material | Chargement initial |
| `MatSnackBar` | Angular Material | Toasts succès / erreur |
| `MatDialog` + `ConfirmDialogComponent` (nouveau, `shared/confirm-dialog`) | Material + shared | « Abandonner les modifications ? » |
| `TranslatePipe`, `TranslateService` | `core/i18n` | Tous les libellés |
| `apiBaseUrlInterceptor`, `httpErrorInterceptor`, `ApiError` | `core` | Appels et erreurs |

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| Créer `models/settings.model.ts` | Interfaces TS | `Settings`, `UpdateSettingsRequest`, `TestConnectionRequest`, `TestConnectionResult` (miroir des DTOs) |
| Créer `core/api/settings.service.ts` (+ spec) | Service HTTP | `getSettings()`, `putSettings()`, `postTestConnection()` sur `api://settings…` |
| Créer `stores/settings.store.ts` (+ spec) | SignalStore | État : `settings`, `loading`, `loadError`, `saving`, `test: { status: idle\|pending\|success\|error, result, errorKey }` ; méthodes `load()`, `save(req)`, `testConnection(req)`, `resetTest()` |
| Créer `shared/confirm-dialog/confirm-dialog.component.ts` (+ spec) | Composant | Dialog générique (titre, message, libellés) retournant `boolean` |
| Créer `shared/section/settings-section.component.ts` (+ spec) | Composant | Ligne de grille « NN · Titre » + description à gauche, contenu projeté à droite, règle 2 px (réutilisé par toutes les sections) |
| Créer `features/settings/sections/gitlab-connection/gitlab-connection-section.component.*` (+ spec) | Composant présentationnel | `input()` : `form` (FormGroup typé), `tokenConfigured`, `tokenHint`, `test` ; `output()` : `test` ; gère l'œil et l'affichage du résultat |
| Créer `features/settings/settings-form.ts` | Fonction pure | `buildSettingsForm(settings)` → `FormGroup` typé, `toUpdateRequest(form)` ; validateur d'URL identique au backend |
| Créer `features/settings/unsaved-changes.guard.ts` (+ spec) | Guard `CanDeactivateFn` | Ouvre `ConfirmDialogComponent` si `component.hasUnsavedChanges()` |
| Étendre `features/settings/settings-page.component.*` (+ spec) | Page | Charge le store, construit le formulaire, états chargement / erreur / formulaire, actions Enregistrer / Annuler, toasts, navigation |
| Ajouter clés `settings.*`, `common.*`, `errors.*` | i18n | `public/i18n/fr.json` |
| Ajouter icônes `eye`, `eye-off` déjà présentes ; ajouter `alert-circle`, `check` déjà présente | Icônes | `shared/icons/provide-icons.ts` |
| Modifier `app.routes.ts` | Routing | `canDeactivate: [unsavedChangesGuard]` sur `/settings` |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|--------------------------|--------|-------------------|
| `settings-page.component.*` | Remplacement du placeholder | Faible | Test existant remplacé par les nouveaux |
| `app.spec.ts` | Le routage `/settings` déclenche désormais un `GET api://settings` | Faible | `HttpTestingController` : répondre ou ignorer la requête en attente |
| `public/i18n/fr.json` | Suppression de `settings.placeholder` | Faible | — |

---

## Points de vigilance globaux
- **Jeton** : jamais dans un log, une réponse, un état frontend persisté ou l'URL. Le champ jeton du formulaire n'est
  jamais pré-rempli ; le store ne conserve pas la valeur saisie après enregistrement.
- **`APP_SECRET`** : la dérivation de clé doit être déterministe (`scrypt` avec sel constant) pour survivre aux
  redémarrages ; un changement de secret rend le jeton illisible → `tokenConfigured: false` + warn (RG-001-10).
- **Timeout GitLab** : `AbortSignal.timeout(15000)` ; le controller ne doit pas dépasser le timeout HTTP par défaut.
- **Validation URL** : même règle côté frontend (validateur) et backend (DTO + normalisation) pour éviter un 400 surprise.
- **Guard `canDeactivate`** : ne pas demander confirmation après un enregistrement réussi (le formulaire est marqué
  `pristine` avant la navigation).
- **Tests frontend** : `MatDialog` et `MatSnackBar` testés via harnesses (`MatDialogHarness`, `MatSnackBarHarness`) ;
  le `fetch` GitLab n'est jamais appelé côté frontend.
- **e2e backend** : `GitlabClientService` mocké, aucun accès réseau.

---

## Ordre de réalisation suggéré
1. `CryptoModule` + `TokenCipherService` + tests
2. Entité `Settings` + migration + fonctions pures `domain/` + tests
3. `GitlabModule` + `GitlabClientService` + tests
4. `SettingsService`, DTOs, controller + tests unitaires ; `GitlabScopeException`
5. Test e2e `settings.e2e-spec.ts`
6. Frontend : i18n, modèles, `SettingsService` HTTP, `SettingsStore` + tests
7. `ConfirmDialogComponent`, `SettingsSectionComponent`, `GitlabConnectionSectionComponent` + tests
8. `SettingsPageComponent` complète, guard, routing + tests ; validation visuelle contre le wireframe 1c
