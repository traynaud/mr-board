# Architecture — US-002 Paramètres : Identité « Moi »

## Résumé fonctionnel
> L'utilisateur renseigne son username et son email GitLab dans une nouvelle section `01 · Moi`. Un aperçu affiche
> l'identité résolue (avatar/initiales, nom, statut) à partir du champ saisi et du dernier test de connexion réussi
> de la session (US-001) — rien n'est résolu côté serveur au-delà de ce test.

⚠️ **Point corrigé pendant l'architecture** : l'exemple `l_rousseau → LR` des specs (§6, scénario « Calcul des
initiales ») contenait une valeur incohérente avec la règle RG-002-03bis (`l_rousseau` se découpe en deux mots
`l` et `rousseau` → initiales `LR`, pas `L`). Corrigé directement dans `specs.md` ; implémentation alignée sur la
règle, pas sur l'erreur de frappe.

---

## Backend

### Impacts sur le modèle de données
- **Entité modifiée** : `Settings` (`src/modules/settings/entities/settings.entity.ts`) — ajout de deux colonnes :

  | Colonne       | Type SQLite | Contraintes | Rôle |
  |---------------|-------------|-------------|------|
  | `me_username` | text        | NULL        | Username GitLab de l'utilisateur courant (RG-002-01/02) |
  | `me_email`    | text        | NULL        | Email de repli pour la correspondance (RG-002-01/02, RG-G09) |

- **Migration** : `src/database/migrations/<ts>-AddMeIdentity.ts` — `ALTER TABLE settings ADD COLUMN me_username text NULL` et `ADD COLUMN me_email text NULL`. Aucune donnée existante à migrer (colonnes nullable, défaut implicite `NULL`).

### Intégration dans les modules existants
- Reste entièrement dans `modules/settings/` (`SettingsService`, `SettingsController`, DTOs) : aucune nouvelle route, aucun nouveau module.
- **Refactor mineur avant extension** : `UpdateSettingsDto` et `TestConnectionDto` partagent aujourd'hui `gitlabUrl`/`gitlabToken` par héritage direct (`TestConnectionDto extends UpdateSettingsDto`). Si on ajoute `meUsername`/`meEmail` à `UpdateSettingsDto`, `TestConnectionDto` les hériterait aussi alors qu'ils sont sans objet pour ce endpoint (le body de test-connection n'a jamais besoin de l'identité). Extraction d'une base commune `GitlabCredentialsDto` (`gitlabUrl` + `gitlabToken`) dont héritent séparément `UpdateSettingsDto` (+ `meUsername`/`meEmail`) et `TestConnectionDto` (rien de plus). Effet : `POST /settings/test-connection` rejette désormais un body contenant `meUsername`/`meEmail` (400, `forbidNonWhitelisted`), ce qui est le comportement correct.

### Contrat API (extension de US-001)
| Méthode | Route | Changement |
|---------|-------|------------|
| GET     | `/api/v1/settings` | Réponse enrichie de `meUsername: string \| null`, `meEmail: string \| null` |
| PUT     | `/api/v1/settings` | Body enrichi de `meUsername?: string`, `meEmail?: string` (voir sémantique ci-dessous) |
| POST    | `/api/v1/settings/test-connection` | Inchangé — body limité à `gitlabUrl`/`gitlabToken` après le refactor DTO (aucune référence à l'identité) |

Sémantique `meUsername`/`meEmail` dans `PUT` (RG-002-02, différente de `gitlabToken`) :
- Absent du body → valeur inchangée
- `""` → efface (stocké `null`)
- Non vide → stocké trimé ; `meEmail` doit être un email valide (sinon 400)

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| Créer `dto/gitlab-credentials.dto.ts` | DTO de base | `gitlabUrl` (`@IsUrl`) + `gitlabToken` optionnel (`@MinLength(8)`, transform `''→undefined`) ; déplace `GITLAB_URL_OPTIONS`/`TOKEN_MIN_LENGTH` depuis `update-settings.dto.ts` |
| Modifier `dto/update-settings.dto.ts` | DTO | `extends GitlabCredentialsDto` ; ajoute `meUsername?: string` (`@IsOptional @IsString @MaxLength(255)`) et `meEmail?: string` (`@IsOptional @ValidateIf(o => o.meEmail !== undefined && o.meEmail !== '') @IsEmail`) |
| Modifier `dto/test-connection.dto.ts` | DTO | `extends GitlabCredentialsDto` (au lieu de `UpdateSettingsDto`) |
| Modifier `dto/settings-response.dto.ts` | DTO | Ajoute `meUsername: string \| null`, `meEmail: string \| null` |
| Modifier `entities/settings.entity.ts` | Entité | Ajoute `meUsername`, `meEmail` |
| Créer migration `AddMeIdentity` | Migration | Voir ci-dessus |
| Modifier `settings.service.ts` | Service | `load()` : defaults avec `meUsername: null, meEmail: null` ; `update()` : applique la sémantique absent/vide/valeur pour les deux champs (inline, un test suffit — pas de fonction `domain/` dédiée, logique triviale d'une ligne chacune) ; `toResponse()` : passe `meUsername`/`meEmail` tels quels (pas de chiffrement, ce ne sont pas des secrets) |
| Étendre `settings.service.spec.ts` | Test unitaire | Cas absent/vide/valeur pour les deux champs, email invalide, valeurs par défaut |
| Étendre `test/settings.e2e-spec.ts` | Test e2e | GET défauts, PUT set/clear/keep, 400 email invalide, 400 si `meUsername` envoyé à `test-connection` (régression du refactor DTO) |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|--------------------------|--------|-------------------|
| `dto/update-settings.dto.ts` | Hérite de `GitlabCredentialsDto` au lieu de définir `gitlabUrl`/`gitlabToken` en propre | Faible | Comportement de validation identique, uniquement un déplacement de code ; couvert par les tests e2e existants (aucun ne doit régresser) |
| `dto/test-connection.dto.ts` | N'hérite plus de `UpdateSettingsDto` | Faible | Un seul endroit consomme ce DTO (`SettingsController.postTestConnection`) ; aucun champ d'identité n'y était utilisé |

---

## Frontend

### Intégration dans les features existantes
- Reste dans `features/settings/` : nouvelle sous-section `sections/me/`, extension du formulaire unique de la page (`settings-form.ts`), aucune nouvelle route.

### Composants réutilisables et Angular Material
| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-form-field` (outline) + `matInput` | Angular Material | Champs username / email (mêmes classes que la section Connexion GitLab) |
| `matTooltip` | Angular Material | Nom complet au survol de l'avatar (RG-G12) |
| `SettingsSectionComponent` | `shared/settings-section/` (US-001) | Conteneur de la section `01 · Moi`, place avant `02 · Connexion GitLab` |
| **`AvatarComponent` (nouveau)** | `shared/avatar/` | Prévu dès l'architecture de US-001 (`docs/tech/architecture-frontend.md` §2) pour l'auteur/reviewer/affecté du tableau (US-005) ; construit ici pour l'aperçu d'identité, réutilisé tel quel plus tard |

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| Créer `shared/avatar/compute-initials.ts` (+ spec) | Fonction pure | RG-G12 / RG-002-03bis : découpe sur `[espace . - _]`, 2 premières lettres, `?` si vide |
| Créer `shared/avatar/avatar.component.ts\|scss` (+ spec) | Composant | `input()` : `name` (requis), `avatarUrl` (nullable), `variant: 'filled' \| 'outlined'` (défaut `filled`) ; carré 28 px, `matTooltip="name"`, image si `avatarUrl`, sinon initiales via `computeInitials(name)` |
| Créer `features/settings/me-identity.ts` (+ spec) | Fonction pure | `resolveMeIdentity(username, test: TestConnectionState): MeIdentity` — 4 états (RG-002-03), comparaison insensible à la casse, trim |
| Créer `features/settings/sections/me/me-section.component.ts\|html\|scss` (+ spec) | Composant présentationnel | `input()` : `form`, `identity: MeIdentity` ; champs username/email + ligne d'aperçu conditionnelle (`AvatarComponent` + libellé + tag) |
| Étendre `models/settings.model.ts` | Interfaces TS | `Settings.meUsername/meEmail: string \| null` ; `UpdateSettingsRequest.meUsername?/meEmail?: string` |
| Étendre `features/settings/settings-form.ts` (+ spec) | Fonction pure | Ajoute les contrôles `meUsername`/`meEmail` (`Validators.email` suffit : renvoie `null` sur chaîne vide, pas de validateur custom nécessaire) ; `resetSettingsForm` et `toUpdateRequest` mis à jour (ces deux champs sont **toujours** envoyés, y compris vides — sémantique différente de `gitlabToken`, RG-002-02) |
| Étendre `features/settings/settings-page.component.ts\|html` (+ spec) | Page | `computed meIdentity` (lit le formulaire + `store.test()`) ; nouvel `effect` de pré-remplissage (RG-002-04) ; insertion de `<app-settings-section number="01">` avant celle de connexion (qui garde `[last]="true"`) |
| Ajouter clés `settings.me.*` | i18n | `public/i18n/fr.json` : titre, description, labels des champs, erreur email, 3 tags de statut |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|--------------------------|--------|-------------------|
| `settings-form.ts` | Ajout de 2 contrôles à `SettingsFormControls`, `resetSettingsForm`, `toUpdateRequest` | Faible | Tests existants (`settings-form.spec.ts`) étendus, pas de suppression de comportement pour `gitlabUrl`/`gitlabToken` |
| `settings-page.component.ts\|html\|spec.ts` | Ajout de la section 01, d'un computed et d'un effect | Faible | La section Connexion GitLab (US-001) n'est pas modifiée fonctionnellement, seulement son `[last]` reste `true` ; tests e2e de page (`should_save_then_toast...` etc.) doivent inclure `meUsername`/`meEmail` dans le body PUT attendu |
| `models/settings.model.ts` | Champs ajoutés aux interfaces | Faible | Purement additif |

---

## Points de vigilance globaux
- **Ne pas persister l'état « détecté via le jeton »** : c'est un calcul 100 % frontend, recalculé à chaque chargement à partir de `store.test()` (qui redémarre à `idle` à chaque navigation vers `/settings`, RG-002-03/QO note). Aucune colonne `me_source` ou équivalent en base.
- **Ordre des sections** : `SettingsSectionComponent` reçoit `last` explicitement ; seule la dernière section réelle doit valoir `true`. À l'ajout d'une US-003 plus tard, `[last]="true"` migrera vers cette nouvelle section — s'assurer que la Phase Dev de US-002 le laisse sur `02 · Connexion GitLab` (pas de régression visuelle).
- **`toUpdateRequest` envoie toujours `meUsername`/`meEmail`** (contrairement à `gitlabToken`) : bien vérifier qu'aucun code ne réintroduit par erreur un `...(meUsername ? { meUsername } : {})` qui casserait l'effacement (RG-002-02, scénario « Effacer mon identité »).
- **`AvatarComponent` est un composant transverse** : le concevoir sans dépendance à `SettingsStore` ou à quoi que ce soit de spécifique aux paramètres, pour qu'il soit réutilisable tel quel dans le tableau (US-005) sans modification.
- **Validateur email frontend** : confirmer par un test que `Validators.email` d'Angular renvoie bien `null` (pas d'erreur) sur une chaîne vide, pour ne pas bloquer l'effacement du champ.

---

## Ordre de réalisation suggéré
1. Backend : extraction `GitlabCredentialsDto`, migration `AddMeIdentity`, entité, DTOs, service (+ tests unitaires), e2e
2. Frontend : `compute-initials.ts` + `AvatarComponent` (+ tests) — indépendants du reste, à faire en premier
3. `me-identity.ts` (+ tests)
4. `settings-form.ts` étendu (+ tests)
5. `me-section.component.*` (+ tests)
6. `settings-page.component.*` étendu (computed, effect, template, i18n) (+ tests)
7. Vérification manuelle contre le wireframe 1c (section `01 · Moi`, ordre des sections, tags de statut)
