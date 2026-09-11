# Architecture backend — NestJS + SQLite

Ce document décrit l'architecture cible du backend et les bonnes pratiques à respecter. Il fait autorité avec
`CLAUDE.md`. Toute dérogation doit être documentée dans le `archi.md` de l'US concernée.

---

## 1. Stack et versions

| Brique              | Choix                                   | Justification                                                         |
|---------------------|-----------------------------------------|-----------------------------------------------------------------------|
| Runtime             | Node.js 22 LTS                          | Support long terme, `fetch` natif                                     |
| Framework           | NestJS 11                               | Modules, DI, pipes, décorateurs, écosystème de test                    |
| Langage             | TypeScript 5, `strict: true`            | Sécurité de typage partagée avec le frontend                          |
| ORM                 | TypeORM 0.3 + driver `better-sqlite3`   | Intégration `@nestjs/typeorm`, migrations versionnées, driver synchrone et rapide |
| Base de données     | SQLite (fichier `backend/data/mr-board.sqlite`) | Zéro infrastructure, une seule instance, volume faible         |
| Validation          | `class-validator` + `class-transformer` | DTOs déclaratifs, `ValidationPipe` global                              |
| Config              | `@nestjs/config` + schéma Joi           | Variables d'environnement validées au démarrage                       |
| Planification       | `@nestjs/schedule`                      | Synchronisation périodique avec GitLab                                |
| HTTP sortant        | `fetch` natif (ou `@nestjs/axios`)      | Appels API GitLab, avec timeout                                       |
| Tests               | Jest 29 + `@nestjs/testing` + `supertest` | Unitaires et e2e                                                    |
| Qualité             | ESLint (typescript-eslint) + Prettier   | Config générée par `nest new`, renforcée (`no-explicit-any: error`)   |

Initialisation : `npx @nestjs/cli new backend --package-manager npm --strict`.

---

## 2. Organisation feature-first

```
backend/
├── src/
│   ├── main.ts                          # bootstrap : préfixe /api/v1, ValidationPipe, CORS, filtre global
│   ├── app.module.ts                    # importe ConfigModule, DatabaseModule, ScheduleModule et les modules métier
│   ├── config/
│   │   ├── configuration.ts             # lecture typée des variables d'env
│   │   └── validation.schema.ts         # schéma Joi des variables d'env
│   ├── database/
│   │   ├── database.module.ts           # TypeOrmModule.forRootAsync (fichier SQLite, migrations, synchronize:false)
│   │   ├── data-source.ts               # DataSource CLI pour les migrations
│   │   └── migrations/                  # <timestamp>-<Nom>.ts
│   ├── common/
│   │   ├── exceptions/                  # BusinessException, EntityNotFoundException, GitlabUnavailableException…
│   │   ├── filters/http-exception.filter.ts
│   │   ├── interceptors/                # logging, transformation de réponse (optionnel)
│   │   ├── pipes/                       # pipes custom (ex : ParseCsvPipe pour les filtres multi-valeurs)
│   │   └── utils/                       # helpers purs (dates, jours ouvrés…)
│   └── modules/
│       ├── settings/                    # Paramètres de l'application (identité, jeton, fréquence, seuils, divers)
│       ├── projects/                    # Repos GitLab à scanner + alias
│       ├── gitlab/                      # Client API GitLab (aucune logique métier)
│       ├── sync/                        # Orchestration de la synchronisation (manuelle + planifiée)
│       ├── merge-requests/              # MRs persistées, calculs (difficulté, délai Ready), filtres, tri
│       └── users/                       # Utilisateurs GitLab rencontrés (auteurs, reviewers, assignés)
└── test/
    ├── app.e2e-spec.ts
    ├── <feature>.e2e-spec.ts
    └── utils/                           # helpers de test e2e (app factory, fixtures, mock GitLab)
```

Chaque module métier suit la même structure interne :

```
modules/merge-requests/
├── merge-requests.module.ts
├── merge-requests.controller.ts          # REST
├── merge-requests.controller.spec.ts
├── merge-requests.service.ts             # orchestration, accès données
├── merge-requests.service.spec.ts
├── domain/
│   ├── difficulty.calculator.ts          # fonction pure : (files, lines, thresholds) → 'easy' | 'medium' | 'hard'
│   ├── difficulty.calculator.spec.ts
│   ├── ready-delay.calculator.ts         # fonction pure : (readyAt, now, thresholds, workdays) → { days, level }
│   └── ready-delay.calculator.spec.ts
├── entities/
│   └── merge-request.entity.ts
└── dto/
    ├── merge-request-query.dto.ts        # filtres/tri (query params)
    └── merge-request-response.dto.ts
```

---

## 3. Couches et responsabilités

```
HTTP → Controller → Service → Repository (TypeORM) → SQLite
                     │
                     ├→ domain/ (fonctions pures)
                     └→ GitlabClientService (module gitlab)
```

### Controller
- Décoré `@Controller('merge-requests')` ; routes RESTful, verbes explicites (`@Get()`, `@Post()`, `@Put(':id')`, `@Delete(':id')`)
- Reçoit des DTOs validés, renvoie des DTOs de réponse (jamais une entité)
- Codes HTTP : `@HttpCode(204)` pour les suppressions, 201 par défaut sur `@Post`
- Aucune logique métier, aucun try/catch (filtre global)

### Service
- Une classe par responsabilité. Injecte les repositories TypeORM et d'autres services
- Lève des exceptions métier typées (`common/exceptions`) converties en HTTP par le filtre global :

| Exception                     | HTTP | Usage                                              |
|-------------------------------|------|----------------------------------------------------|
| `EntityNotFoundException`     | 404  | Ressource inexistante                              |
| `BusinessValidationException` | 400  | Règle métier violée (alias en doublon, seuil incohérent) |
| `GitlabAuthException`         | 502  | Jeton refusé par GitLab (401/403)                  |
| `GitlabUnavailableException`  | 502  | GitLab injoignable / timeout / 5xx                 |
| `MissingConfigurationException` | 409 | Jeton ou repo non configuré                        |

### Domain (fonctions pures)
- Aucune dépendance à Nest, TypeORM ou HTTP ; entrées/sorties typées ; testées exhaustivement (cas limites inclus)
- Exemples : calcul de difficulté, calcul du délai Ready (jours calendaires / ouvrés), tri des MRs, application des filtres

### Repository
- `@InjectRepository(Entity) private readonly repo: Repository<Entity>` par défaut
- Repository custom (`xxx.repository.ts`) uniquement pour des requêtes complexes (QueryBuilder)
- Toujours des paramètres liés, jamais de concaténation SQL

---

## 4. Modèle de données cible (SQLite)

| Table              | Colonnes principales                                                                                                                                                                         |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `settings`         | `id` (=1, singleton), `gitlab_url`, `gitlab_token` (chiffré, nullable), `me_username`, `me_email`, `refresh_interval_min`, `pause_when_hidden`, `easy_files`, `easy_lines`, `hard_files`, `hard_lines`, `ready_green_days`, `ready_orange_days`, `workdays_only`, `open_in_new_tab`, `ignored_labels` (JSON `string[]`), `notify_assigned`, `tab_badge`, `updated_at` |
| `projects`         | `id`, `gitlab_project_id` (unique), `path_with_namespace` (unique), `alias` (unique), `web_url`, `enabled`, `created_at`                                                                       |
| `users`            | `id`, `gitlab_user_id` (unique), `username`, `name`, `avatar_url`, `web_url`                                                                                                                   |
| `merge_requests`   | `id`, `gitlab_mr_id`, `iid`, `project_id` (FK), `title`, `web_url`, `draft` (bool), `state`, `author_id` (FK users), `reviewer_id` (FK users, nullable), `assignee_id` (FK users, nullable), `approved` (bool), `comments_count`, `changed_files`, `changed_lines`, `labels` (JSON), `created_at_gitlab`, `ready_at` (nullable), `updated_at_gitlab`, `synced_at`. Unique (`project_id`, `iid`) |
| `sync_runs`        | `id`, `started_at`, `finished_at`, `status` (`success`/`error`/`partial`), `error_message`, `mr_count`, `trigger` (`manual`/`scheduled`)                                                        |

Règles :
- Dates stockées en ISO 8601 UTC (colonne `text`) ; conversion en `Date` via transformer TypeORM
- Booléens en `integer` 0/1 (transformer)
- Index sur `merge_requests.project_id`, `merge_requests.ready_at`, `merge_requests.draft`
- `synchronize: false` ; toute évolution passe par une migration versionnée ; `migrationsRun: true` au démarrage
- Le jeton GitLab est chiffré au repos (AES-256-GCM, clé `APP_SECRET` en variable d'env) ; l'API ne renvoie jamais le jeton, seulement `tokenConfigured: boolean` et `tokenHint` (4 derniers caractères)

---

## 5. Contrat API (préfixe `/api/v1`)

| Méthode | Route                          | Description                                                        |
|---------|--------------------------------|--------------------------------------------------------------------|
| GET     | `/settings`                    | Paramètres (jeton masqué)                                          |
| PUT     | `/settings`                    | Mise à jour des paramètres (jeton optionnel : absent = inchangé)   |
| POST    | `/settings/test-connection`    | Teste le jeton : renvoie l'utilisateur courant et l'expiration     |
| GET     | `/settings/export`             | Export JSON de la configuration (sans jeton) + repos (US-015)      |
| POST    | `/settings/import`             | Import JSON : remplace les paramètres, fusionne les repos (US-015) |
| GET     | `/projects`                    | Repos configurés                                                   |
| POST    | `/projects`                    | Ajoute un repo (résolution du chemin via GitLab)                   |
| PUT     | `/projects/:id`                | Modifie l'alias                                                    |
| DELETE  | `/projects/:id`                | Supprime le repo et ses MRs                                        |
| GET     | `/merge-requests`              | Liste des MRs ouvertes avec champs calculés (filtres/tri en query) |
| GET     | `/merge-requests/facets`       | Valeurs disponibles pour les filtres (auteurs, assignés, projets) avec compteurs |
| POST    | `/sync`                        | Déclenche une synchronisation manuelle                             |
| GET     | `/sync/status`                 | `{ running, lastRun, nextRunAt }` — dernière synchro et prochaine planifiée |
| GET     | `/health`                      | Liveness (TECH-001)                                                |

Conventions :
- Query params multi-valeurs en CSV (`?project=api,web&assigned=nobody,mdupont`)
- Réponses d'erreur normalisées : `{ statusCode, error, message, timestamp, path }`
- Pagination non nécessaire (volume borné aux MRs ouvertes) ; à revoir si > 500 MRs

---

## 6. Module GitLab (client)

- `GitlabClientService` encapsule tous les appels GitLab : REST v4 (`/projects/:path`, `/user`, `/personal_access_tokens/self`) et GraphQL (`project(fullPath).mergeRequests(state: opened)` avec `diffStatsSummary { fileCount additions deletions }`, `approvedBy`, `reviewers`, `assignees`, `userNotesCount`, `draft`, `labels`) — une requête paginée par projet suffit pour enrichir toutes les MRs (voir QO-G04). Repli REST (`/merge_requests/:iid/approvals`, `/diffs`) documenté si GraphQL est indisponible
- Header `PRIVATE-TOKEN`, timeout 15 s, gestion de la pagination (`per_page=100`, header `x-next-page`)
- Mapping GitLab → objets internes dans `gitlab/mappers/` (fonctions pures testées)
- Erreurs converties en exceptions métier ; jamais de fuite du jeton dans les messages/logs
- Aucune logique métier : le client renvoie des données brutes typées (`GitlabMergeRequest`, `GitlabUser`…)
- Détection de « Ready » : GitLab n'expose pas de date `ready_at` ; le backend enregistre `ready_at` = date de la première synchro où la MR est vue non-draft (ou `created_at` si créée non-draft). Voir RG-G05 dans `docs/features/README.md`

---

## 7. Module Sync

- `SyncService.run(trigger)` : pour chaque projet activé, récupère les MRs ouvertes, enrichit (approvals, changes, notes count), upsert en base, marque fermées celles qui ont disparu, écrit un `sync_run`
- Verrou en mémoire : une seule synchro à la fois (une demande pendant une synchro en cours renvoie 202 avec l'état courant)
- `SyncScheduler` : `@Interval` dynamique piloté par `settings.refresh_interval_min` (0 = manuel) ; recalculé à chaque sauvegarde des paramètres
- Résilience : une erreur sur un projet n'interrompt pas les autres (statut `partial`)

---

## 8. Configuration et sécurité

Variables d'environnement (`backend/.env`, modèle dans `backend/.env.example`) :

| Variable        | Défaut                       | Rôle                                        |
|-----------------|------------------------------|---------------------------------------------|
| `PORT`          | `3000`                       | Port HTTP                                   |
| `DB_PATH`       | `./data/mr-board.sqlite`     | Fichier SQLite (`:memory:` en test)         |
| `APP_SECRET`    | (obligatoire)                | Clé de chiffrement du jeton GitLab          |
| `CORS_ORIGIN`   | `http://localhost:4200`      | Origine autorisée                           |
| `LOG_LEVEL`     | `log`                        | Niveau de log Nest                          |

- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` global
- `helmet` activé ; CORS restreint
- Le jeton n'est jamais loggé (logger custom qui masque `PRIVATE-TOKEN` et `glpat-*`)
- Pas d'authentification applicative en v1 (instance mono-utilisateur, réseau de confiance) — voir question ouverte QO-G01 dans `docs/features/README.md`

---

## 9. Bonnes pratiques de code

- Un module Nest = une feature ; les dépendances entre modules passent par `exports`/`imports`, jamais par import direct d'un provider d'un autre module
- `forwardRef` interdit : si nécessaire, revoir le découpage
- Services `@Injectable()` sans état mutable partagé (hors verrou de synchro explicitement documenté)
- Les DTOs de réponse sont des classes avec constructeur `fromEntity(entity, computed)` ou des mappers dédiés
- Dates : `Date` en interne, ISO string en sortie ; `now` injecté (`ClockService`) pour rendre les calculs testables
- Logs structurés via le `Logger` Nest avec contexte de classe
- Pas de logique dans `main.ts` hors bootstrap
- Toute règle métier décrite dans `docs/features/README.md` (RG-xxx) doit être retrouvable dans une fonction `domain/` nommée explicitement et référencée dans son JSDoc (`@see RG-G03`)

---

## 10. Scripts npm attendus (`backend/package.json`)

| Script                | Commande                                                            |
|-----------------------|---------------------------------------------------------------------|
| `start:dev`           | `nest start --watch`                                                |
| `build`               | `nest build`                                                        |
| `lint`                | `eslint "{src,test}/**/*.ts"`                                       |
| `test`                | `jest`                                                              |
| `test:watch`          | `jest --watch`                                                      |
| `test:cov`            | `jest --coverage`                                                   |
| `test:e2e`            | `jest --config ./test/jest-e2e.json`                                |
| `migration:generate`  | `typeorm-ts-node-commonjs migration:generate -d src/database/data-source.ts` |
| `migration:run`       | `typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`      |
| `migration:revert`    | `typeorm-ts-node-commonjs migration:revert -d src/database/data-source.ts`   |

Voir `docs/tech/testing.md` pour la stratégie de tests détaillée.
