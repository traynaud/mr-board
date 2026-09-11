# Architecture — US-003 Paramètres : Repos à scanner avec alias

## Résumé fonctionnel
> L'utilisateur gère la liste des repos GitLab à surveiller (ajout par chemin/URL, alias, suppression) dans une
> nouvelle section `03 · Repos à scanner`. L'ajout et la suppression sont immédiats ; le renommage d'un alias suit
> le cycle Enregistrer/Annuler partagé avec les sections `01 · Moi` et `02 · Connexion GitLab`.

---

## Backend

### Impacts sur le modèle de données
- **Nouvelle entité `Project`** (`modules/projects/entities/project.entity.ts`), table `projects` :

  | Colonne               | Type SQLite | Contraintes                              | Rôle |
  |------------------------|-------------|-------------------------------------------|------|
  | `id`                   | integer     | PK autoincrément                          | Identifiant interne (adressage `PUT`/`DELETE`) |
  | `gitlab_project_id`    | integer     | NOT NULL, UNIQUE                          | RG-003-06 |
  | `path_with_namespace`  | text        | NOT NULL, UNIQUE                          | Filet de sécurité secondaire ; l'unicité qui compte fonctionnellement est celle de `gitlab_project_id` |
  | `alias`                | text        | NOT NULL, `COLLATE NOCASE`, UNIQUE        | RG-003-04 (unicité insensible à la casse déléguée à SQLite) |
  | `web_url`              | text        | NOT NULL                                  | Stocké pour un usage futur, non exposé par l'API dans cette US |
  | `enabled`              | boolean     | NOT NULL, défaut `true`                   | Anticipe QO-003-01, non exposé/non piloté dans cette US |
  | `created_at`           | text        | NOT NULL                                  | Détermine l'ordre d'affichage (RG-003-09, tri par `id`) |

- **Migration** : `src/database/migrations/<ts>-CreateProjects.ts`. `COLLATE NOCASE` posé au niveau de la colonne SQL
  (pas gérable proprement via les décorateurs TypeORM avec `synchronize: false` : la migration SQL brute fait
  autorité, comme pour `CreateSettings`).
- **Limite acceptée** : les contraintes `UNIQUE` en base sont un filet de sécurité, pas le mécanisme de restitution de
  l'erreur métier — voir « Points de vigilance ».

### Intégration dans les modules existants
- Nouveau module `ProjectsModule` (`modules/projects/`), importé dans `AppModule`.
- Importe `SettingsModule` (déjà `exports: [SettingsService]`) pour lire l'URL et le jeton configurés (RG-003-02), et
  `GitlabModule` pour la résolution du projet.
- Ajout à `GitlabClientService` : `getProject(baseUrl, token, path): Promise<GitlabProject | null>` — `GET
  /api/v4/projects/:id` avec `path` encodé (`encodeURIComponent`) en un seul segment, `allowNotFound: true` (comme
  `getTokenInfo`). Un 401/403 continue de lever `GitlabAuthException` (comportement existant du client, inchangé) ;
  c'est au service `ProjectsService` de le retraduire en `projects.notFound` (RG-003-03 regroupe 401/403/404).

### Contrat API
Voir `docs/features/US-003-repos-a-scanner/specs.md` §4 pour le détail des routes, codes et `ProjectResponseDto`.

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| Créer `modules/projects/domain/normalize-project-path.ts` (+ spec) | Fonction pure | RG-003-01 : retire schéma/hôte, suffixe `/-/…`, `/` de bordure ; `null` si résultat vide |
| Créer `modules/projects/domain/derive-default-alias.ts` (+ spec) | Fonction pure | RG-003-05 : dernier segment du chemin |
| Créer `modules/projects/entities/project.entity.ts` | Entité TypeORM | Voir tableau ci-dessus |
| Créer migration `CreateProjects` | Migration | Table + contraintes (voir ci-dessus) |
| Créer `modules/projects/dto/create-project.dto.ts` | DTO | `path: string` (`@IsString @IsNotEmpty`), `alias?: string` (`@IsOptional @Matches(ALIAS_PATTERN)`) |
| Créer `modules/projects/dto/update-project.dto.ts` | DTO | `alias: string` (`@Matches(ALIAS_PATTERN)`) — requis, pas d'omission possible (renommer exige une valeur) |
| Créer `modules/projects/dto/project-response.dto.ts` | DTO | `{ id, pathWithNamespace, alias, gitlabProjectId }` |
| Créer `modules/projects/projects.service.ts` (+ spec) | Service | `list()`, `add(dto)`, `rename(id, dto)`, `remove(id)` ; vérifications d'unicité applicatives avant écriture (voir Points de vigilance) |
| Créer `modules/projects/projects.controller.ts` (+ spec) | Controller | `GET/POST /projects`, `PUT/DELETE /projects/:id` |
| Créer `modules/projects/projects.module.ts` | Module | `TypeOrmModule.forFeature([Project])`, imports `SettingsModule`, `GitlabModule` |
| Étendre `modules/gitlab/gitlab-client.service.ts` (+ spec) | Service | `getProject(...)` |
| Créer `test/projects.e2e-spec.ts` | Test e2e | Contrat complet, `GitlabClientService` mocké |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|--------------------------|--------|-------------------|
| `src/app.module.ts` | Import de `ProjectsModule` | Faible | — |
| `common/exceptions/business.exception.ts` | Aucun ajout nécessaire — `projects.notFound`/`projects.aliasDuplicate`/`projects.alreadyConfigured` sont des `code` passés à `BusinessValidationException`/`BusinessException` existants, pas de nouvelles classes | — | — |
| `fr.json` (backend n'en a pas — voir Frontend) | — | — | — |

---

## Frontend

### Intégration dans les features existantes
- Reste dans `features/settings/` : nouvelle sous-feature `sections/repositories/`, nouveau store `ProjectsStore`,
  nouveau modèle `Project`. Nouvelle section `03 · Repos à scanner`, insérée **après** `02 · Connexion GitLab`, qui
  perd son `[last]="true"` au profit de cette nouvelle section (dernière du formulaire tant que US-013/US-014/US-015
  ne sont pas livrées).

### Composants réutilisables et Angular Material
| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `<table>` stylé par tokens (pas `mat-table`) | Design system (`components/table.html`, wireframe 1c) | Voir `design.md` — un `mat-table` avec `dataSource` alimenté par un `FormArray` ajouterait de la complexité pour zéro bénéfice visuel sur une liste non triable ; le wireframe lui-même utilise une table sémantique simple |
| `mat-form-field` (outline) + `matInput` | Angular Material | Champ chemin/alias de la ligne d'ajout, champ alias inline par repo existant |
| `mat-icon-button` + icône `x` | Material + `shared/icons` (déjà présente) | Supprimer un repo |
| `mat-stroked-button` + icône `plus` (déjà présente) | Angular Material | Bouton « Ajouter » |
| `ConfirmDialogComponent` | `shared/confirm-dialog/` (US-001) | Confirmation de suppression |
| `SettingsSectionComponent` | `shared/settings-section/` (US-001) | Conteneur de la section 03 |

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| Créer `models/project.model.ts` | Interfaces TS | `Project`, `CreateProjectRequest`, `UpdateProjectRequest` |
| Créer `core/api/projects.service.ts` (+ spec) | Service HTTP | `getProjects()`, `postProject()`, `putProject(id, …)`, `deleteProject(id)` sur `api://projects…` |
| Créer `stores/projects.store.ts` (+ spec) | SignalStore | État : `projects: Project[]`, `loading`, `loadError`, `adding`. Méthodes : `load()`, `add(req): Promise<string \| null>` (ajoute au tableau si succès), `rename(id, alias): Promise<string \| null>` (met à jour l'élément si succès), `remove(id): Promise<string \| null>` (retire l'élément si succès) — même style que `SettingsStore` |
| Créer `features/settings/repos-form.ts` (+ spec) | Fonctions pures + types | `ALIAS_PATTERN`, `aliasFormatValidator`, `RepoAliasFormGroup`/`RepoAliasForm`, `buildRepoAliasGroup(project)`, `syncReposFormArray(array, projects)`, `collectDirtyAliasChanges(array)` |
| Étendre `features/settings/settings-form.ts` (+ spec) | Fonction pure | `SettingsFormControls.repos: FormArray<RepoAliasForm>` (vide à la construction, peuplé par un effect de la page) |
| Créer `features/settings/sections/repositories/repositories-section.component.ts\|html\|scss` (+ spec) | Composant **hybride** | Voir « Points de vigilance » — reçoit `rows: {project, group}[]` en `input()` pour la partie renommage (différée, orchestrée par la page) ; injecte `ProjectsStore`/`MatDialog`/`MatSnackBar` en interne pour l'ajout et la suppression (immédiats, RG-003-10) |
| Étendre `features/settings/settings-page.component.ts\|html` (+ spec) | Page | Injecte `ProjectsStore`, l'initialise dans `ngOnInit` ; `effect` inconditionnel qui resynchronise `form.controls.repos` sur `projectsStore.projects()` (RG-003-07) ; `computed repoRows` (zippe `projects()` et `form.controls.repos.controls` par index) ; `save()` étendu (voir ci-dessous) |
| Ajouter clés `settings.projects.*`, `errors.projects.*` | i18n | `public/i18n/fr.json` |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|--------------------------|--------|-------------------|
| `settings-form.ts` | Ajout du champ `repos` (FormArray) à `SettingsFormControls` | Faible | `resetSettingsForm`/`toUpdateRequest` ne touchent pas `repos` (géré séparément, voir ci-dessous) ; tests existants inchangés pour les 4 champs actuels |
| `settings-page.component.ts` | `save()` orchestre désormais **deux stores** : `PUT /settings` (inchangé) puis, si succès, un `PUT /projects/:id` par alias modifié (`Promise.all`) | Moyen | Voir Points de vigilance : en cas d'échec d'un renommage, le formulaire n'est **pas** remis à l'état pristine et l'utilisateur reste sur l'écran (aucune donnée perdue, comportement testé) |
| `settings-page.component.html` | Insertion de la section 03, déplacement de `[last]="true"` | Faible | — |

---

## Points de vigilance globaux

- **Le renommage d'alias est différé, l'ajout/suppression sont immédiats** (RG-003-07/RG-003-10) : c'est une
  dissymétrie assumée (fidèle au prototype de référence), pas une incohérence à corriger. `RepositoriesSectionComponent`
  reflète cette dissymétrie dans son architecture : il reçoit la partie « renommage » en `input()` depuis le formulaire
  partagé de la page, mais gère lui-même l'ajout/suppression en injectant `ProjectsStore` directement — une exception
  documentée au patron « composant purement présentationnel » des deux autres sections, justifiée par la règle
  métier elle-même.
- **Alignement par index, pas par id** : `syncReposFormArray` reconstruit le `FormArray` dans le même ordre que
  `projectsStore.projects()` ; le `computed repoRows` de la page zippe les deux tableaux **par index** (pas par
  recherche d'id), en confiance que les deux sont toujours reconstruits en lock-step par le même effect.
- **Reconstruction inconditionnelle du `FormArray`** : contrairement aux champs `gitlabUrl`/`meUsername`/etc.
  (protégés par `if (form.pristine)`), la resynchronisation du `FormArray` n'est **pas** gardée par la pristineté du
  formulaire — elle doit toujours refléter l'état serveur après un ajout/suppression immédiat, quitte à perdre une
  modification d'alias non enregistrée sur une autre ligne (RG-003-07, assumé et testé). ⚠️ Si une US future (US-013,
  actualisation automatique) fait recharger `projectsStore.projects()` en arrière-plan, cette reconstruction
  inconditionnelle redeviendra un risque de perte de saisie silencieuse — à revisiter à ce moment-là avec la même
  garde `pristine` que les autres champs.
- **Sauvegarde partielle sur échec d'un renommage** : si `PUT /settings` réussit mais qu'un `PUT /projects/:id`
  échoue (ex. doublon d'alias), le formulaire entier reste à l'état modifié (pas de `resetSettingsForm`, pas de
  navigation) — l'utilisateur peut corriger et cliquer à nouveau sur « Enregistrer » sans perdre sa saisie ; renvoyer
  un `PUT /settings` déjà appliqué est sans effet indésirable (idempotent).
- **Pas de retraduction des violations `UNIQUE` de la base** en erreur métier conviviale (accepté pour cette US) : le
  service vérifie l'unicité en lecture avant écriture (pas de race en pratique pour un outil interne mono-instance) ;
  si une contrainte SQL est malgré tout violée, le filtre d'exceptions global renvoie un 500 générique sans fuite de
  détail (déjà couvert par les tests de `HttpExceptionFilter`), donc pas de risque de sécurité — juste un message
  moins précis dans ce cas résiduel.
- **Table HTML, pas `mat-table`** : cohérent avec le wireframe et le design system (voir `design.md`) ; les éléments
  interactifs à l'intérieur (champ alias, bouton supprimer, bouton ajouter) restent des composants Material.

---

## Ordre de réalisation suggéré
1. Backend : `normalize-project-path.ts` + `derive-default-alias.ts` (+ tests) ; `Project` entity + migration
2. `GitlabClientService.getProject` (+ tests)
3. `ProjectsService`, DTOs, controller (+ tests unitaires) ; module + import dans `AppModule`
4. `test/projects.e2e-spec.ts`
5. Frontend : `models/project.model.ts`, `core/api/projects.service.ts` (+ tests)
6. `stores/projects.store.ts` (+ tests)
7. `features/settings/repos-form.ts` (+ tests) ; extension de `settings-form.ts` (+ tests)
8. `RepositoriesSectionComponent` (+ tests)
9. Extension de `SettingsPageComponent` (effect de resynchronisation, `repoRows`, `save()` orchestré) (+ tests) ; réordonnancement des sections dans le template
10. Vérification manuelle contre le wireframe 1c (tableau des repos, ligne d'ajout, dialog de suppression)
