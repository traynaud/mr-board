# MR Board — CLAUDE.md

## Vue d'ensemble du projet

Une application web (dans le navigateur) permettant à une équipe de suivre les Merge Requests (MR) ouvertes sur un ou
plusieurs projets GitLab. Elle se présente sous la forme d'un tableau filtrable et triable, alimenté par une
synchronisation périodique avec l'API GitLab, et d'un écran de paramètres.

- **Backend** : NestJS / TypeScript (`/backend`) — expose une API REST, synchronise les MRs depuis GitLab, persiste en SQLite
- **Frontend** : Angular + Angular Material (`/frontend`) — tableau des MRs, filtres, écran de paramètres
- **Base de données** : SQLite (fichier local, via TypeORM + `better-sqlite3`)

La documentation fonctionnelle et le découpage en User Stories sont dans `docs/features/README.md`.
Le design de référence (prototype + wireframes + design system) est dans `docs/design/` et **doit être respecté**
systématiquement lors de la conception et de l'implémentation (voir `docs/tech/design-system.md`).

---

## Structure du projet

```
mr-board/
├── backend/          # API NestJS + SQLite
├── frontend/         # Application Angular + Angular Material
├── docs/
│   ├── features/     # Documentation fonctionnelle, specs et rapports QA par User Story
│   │   ├── README.md              # Vision produit, règles de gestion globales, roadmap des US
│   │   └── US-xxx-<slug>/specs.md # Spec détaillée d'une US (format PO)
│   ├── design/       # Prototype interactif, wireframes et design system (source de vérité UI)
│   └── tech/         # Architecture, conventions, tests, rapports techniques par US
│       ├── architecture-backend.md
│       ├── architecture-frontend.md
│       ├── design-system.md
│       ├── i18n.md
│       ├── testing.md
│       └── US-xxx-<slug>/{archi.md,design.md,dev-report.md}
└── .claude/
    └── commands/
        │── # WORKFLOWS (orchestrateurs)
        ├── feature.md          # /project:feature    → Nouvelle fonctionnalité
        ├── refacto.md          # /project:refacto    → Refactoring technique
        ├── bugfix.md           # /project:bugfix     → Correction de bug
        ├── puretech.md         # /project:puretech   → Tâche purement technique (init, montée de version…)
        │── # AGENTS (spécialistes, appelés par les workflows)
        ├── po.md               # /project:po         → Analyse fonctionnelle
        ├── architect.md        # /project:architect  → Analyse technique préalable
        ├── dev.md              # /project:dev        → Implémentation
        ├── qa.md               # /project:qa         → Tests
        └── review.md           # /project:review     → Revue de code
```

---

## Règle changelog — OBLIGATOIRE

**À chaque feature, fix ou refacto**, mettre à jour `frontend/public/changelog.json` en ajoutant une entrée en tête du
tableau :

```json
{ "date": "YYYY-MM-DD", "type": "feat|fix|refacto", "user-story": "US-xxx", "title": "Description courte en une phrase." }
```

Les workflows (`feature.md`, `bugfix.md`, `refacto.md`) incluent cette étape en phase de finalisation.

---

## Workflows disponibles

| Commande            | Usage                   | Exemple                                                                    |
|---------------------|-------------------------|----------------------------------------------------------------------------|
| `/project:feature`  | Nouvelle fonctionnalité | `/project:feature US-010`                                                  |
| `/project:refacto`  | Refactoring technique   | `/project:refacto Extraire le calcul de difficulté dans un service dédié`  |
| `/project:bugfix`   | Correction de bug       | `/project:bugfix Le tri par Ready ignore les MRs sans reviewer`            |
| `/project:puretech` | Tâche technique pure    | `/project:puretech Initialise le projet backend NestJS`                    |

### Agents individuels (utilisables seuls)

| Commande             | Usage                        |
|----------------------|------------------------------|
| `/project:po`        | Analyse fonctionnelle seule  |
| `/project:architect` | Analyse d'architecture seule |
| `/project:dev`       | Implémentation seule         |
| `/project:qa`        | Tests seuls                  |
| `/project:review`    | Revue de code seule          |

---

## Environnement local (Windows)

- Node.js 22 LTS, npm 10. Aucune CLI globale : utiliser `npx nest` / `npx ng`.
- **Toujours** préfixer les commandes shell avec `rtk` (voir `~/.claude/CLAUDE.md`).

```bash
# Backend
cd backend
rtk npm install
rtk npm run start:dev          # API sur http://localhost:3000 (préfixe /api/v1)
rtk npm test                   # Tests unitaires (Jest)
rtk npm run test:e2e           # Tests e2e (Jest + supertest + SQLite in-memory)
rtk npm run test:cov           # Couverture (seuil 80 %)
rtk npm run lint               # ESLint
rtk npx tsc --noEmit -p tsconfig.json

# Frontend
cd frontend
rtk npm install
rtk npm start                  # ng serve sur http://localhost:4200 (proxy /api → :3000)
rtk npx ng test --no-watch     # Tests unitaires (Vitest via @angular/build:unit-test, jsdom)
rtk npx ng test --no-watch --coverage
rtk npx tsc --noEmit
rtk npm run build
```

Le détail des commandes de test et des règles de couverture est dans `docs/tech/testing.md`.

---

## Backend (`/backend`)

### Stack technique

- Node.js 22 / TypeScript 5 (strict)
- NestJS 11
- TypeORM + `better-sqlite3` (SQLite), migrations TypeORM versionnées
- `class-validator` / `class-transformer` pour les DTOs
- `@nestjs/config` (variables d'environnement) + `@nestjs/schedule` (synchro périodique)
- Jest (unitaires + e2e via `supertest`)
- ESLint + Prettier

### Structure des packages

Le backend est organisé par **feature** (approche verticale), pas par couche technique.

```
backend/src/
├── main.ts                     # Bootstrap : ValidationPipe global, préfixe /api/v1, CORS
├── app.module.ts
├── config/                     # Configuration typée (env, chemin de la BDD, port)
├── database/                   # DataSource TypeORM, migrations/
├── common/                     # Transversal : filters (exceptions), interceptors, pipes, decorators, utils
│   ├── exceptions/             # Exceptions métier (BusinessException, EntityNotFoundException…)
│   └── filters/                # HttpExceptionFilter global
└── modules/
    └── <feature>/              # ex : settings, projects, gitlab, sync, merge-requests
        ├── <feature>.module.ts
        ├── <feature>.controller.ts        # Couche REST
        ├── <feature>.service.ts           # Logique métier / orchestration
        ├── <feature>.repository.ts        # Accès données (optionnel si TypeORM Repository suffit)
        ├── domain/                        # Fonctions métier pures (calculs, règles), sans dépendance Nest
        ├── entities/                      # Entités TypeORM
        ├── dto/                           # DTOs request/response (class-validator)
        └── *.spec.ts                      # Tests unitaires à côté du code testé
backend/test/                   # Tests e2e (*.e2e-spec.ts)
```

> **Règle** : tout ce qui est propre à une feature vit dans `modules/<feature>/`. Ce qui est partagé va dans `common/`.
> Le détail est dans `docs/tech/architecture-backend.md`.

### Conventions

- Organisation **feature-first** — `modules/<feature>/<fichier>`
- Nommage des fichiers : `kebab-case.<type>.ts` (`merge-request.entity.ts`, `sync.service.ts`, `create-project.dto.ts`)
- Entités TypeORM dans `entities/`, jamais exposées directement par l'API : toujours un DTO de réponse
- Toute entrée HTTP est validée par un DTO `class-validator` (ValidationPipe global `whitelist: true`)
- Nommage REST : `/api/v1/...`, verbes HTTP explicites, codes HTTP corrects (201 création, 204 suppression)
- Les règles métier calculables (difficulté, délai Ready, filtres) sont des **fonctions pures** dans `domain/`, testées unitairement
- Injection de dépendances via constructeur, `private readonly`
- Pas de `any` ; `unknown` + type guards si nécessaire
- JSDoc sur toutes les méthodes publiques des services et controllers
- Secrets (jeton GitLab) : jamais loggés, jamais renvoyés en clair par l'API (masquage), jamais commités
- Migrations TypeORM obligatoires pour tout changement de schéma (`synchronize: false` hors tests)

#### Rôles et conventions des Controllers

- Rôle : recevoir la requête HTTP, valider les paramètres (DTO + pipes), appeler le service, renvoyer un DTO de réponse
- Aucune logique métier, aucun accès direct au repository
- Un controller par feature, décoré `@Controller('<ressource>')`
- Gestion d'erreurs centralisée par le filtre global (`common/filters`), pas de try/catch dans les controllers

#### Rôles et conventions des Services

- Rôle : orchestrer la logique métier et l'accès aux données
- Un service par responsabilité : `XxxService` (métier/CRUD), `GitlabClientService` (appels externes), `SyncService` (orchestration)
- Les services lèvent des exceptions métier (`common/exceptions`), jamais des `Error` génériques
- Les appels externes (GitLab) sont isolés dans un module dédié et mockés dans les tests

#### Conventions des Repositories / accès données

- Utiliser `@InjectRepository(Entity)` avec le `Repository` TypeORM par défaut
- Créer un `XxxRepository` custom uniquement si des requêtes complexes le justifient
- Favoriser dans l'ordre : méthodes Repository → QueryBuilder → SQL natif

---

## Frontend (`/frontend`)

### Stack technique

- Angular 20+ (standalone components, signals, nouveau control flow `@if/@for`)
- Angular Material 20+ (**tous les composants UI proviennent d'Angular Material** en priorité : table, chips, menu, select, dialog, snackbar, slide-toggle…)
- TypeScript 5 (strict)
- SCSS, thème Material personnalisé aux tokens du design system (voir `docs/tech/design-system.md`)
- `@ngrx/signals` (SignalStore) pour l'état
- Vitest via `@angular/build:unit-test` (jsdom) pour les tests unitaires
- Playwright pour les tests E2E (optionnel, phase ultérieure)

### Structure

```
frontend/src/app/
├── app.config.ts / app.routes.ts
├── core/                       # Services transverses (API http, i18n, config), interceptors
├── shared/                     # Composants/pipes/directives techniques réutilisables (avatar initiales, translate pipe…)
├── models/                     # Interfaces TS des DTOs backend
├── stores/                     # SignalStores (merge-requests.store.ts, settings.store.ts, filters.store.ts)
└── features/
    ├── board/                  # Écran Tableau : composants d'affichage, filtres, table
    └── settings/               # Écran Paramètres
```

### Conventions

- Composants **standalone**, `ChangeDetectionStrategy.OnPush`, signals pour l'état local, `input()`/`output()` fonctionnels
- Les services (`*.service.ts`) sont utilisés pour toute communication avec l'API backend et retournent des Observables
- Les services ne sont appelés que par les stores ; les composants lisent les stores
- Les entités provenant du backend sont gérées via des stores (`@ngrx/signals`)
- Typage strict, pas de `any`
- Chaque composant/service/store a son `*.spec.ts`
- Variables d'environnement dans `src/environments/`
- Le détail est dans `docs/tech/architecture-frontend.md`

#### Rôles et conventions des Components

- Rôle : présentation de l'interface utilisateur
- Nommage : `<nom>.component.ts` + `.html` + `.scss` + `.spec.ts`
- Utiliser un composant Angular Material dès qu'il existe (ne pas recoder une table, un menu, un chip…)
- Composants techniques transverses dans `src/app/shared/` ; composants d'affichage organisés par feature
- Pas d'appel HTTP direct dans un composant

#### Rôles et conventions des Services

- Nommage : `<nom>.service.ts`
- Méthodes nommées avec le verbe HTTP (`get`, `post`, `put`, `delete`) et retournant un `Observable`
- Appelés uniquement via des stores

#### Rôles et conventions des Stores

- Nommage : `<nom>.store.ts`, construits avec `signalStore` (`withState`, `withComputed`, `withMethods`)
- Actions nommées par le verbe HTTP ou l'intention (`load`, `refresh`, `save`)
- Les messages d'erreur dans les stores sont des **clés i18n** (ex : `'board.errors.load'`), jamais du texte brut

#### Conventions i18n

Système de traduction custom sans dépendance externe, décrit dans `docs/tech/i18n.md`.

- Tous les textes visibles sont dans `public/i18n/fr.json`
- Pipe `| translate` dans les templates, `TranslatePipe` importé dans chaque composant standalone
- Ajouter les clés dans `fr.json` avant d'écrire le template — jamais de texte en dur

---

## Règles générales

- Ne jamais committer `.env`, `*.sqlite`, ou tout fichier contenant un jeton GitLab
- Toujours tester avant de proposer un commit (backend `npm test` + frontend `ng test`)
- Respecter les maquettes de `docs/design/` : Archivo, accent `#ec3013`, aucun arrondi, règles 2 px, vert `#2f8f4e`, orange `#d98a1f`
- Respecter les conventions de nommage existantes dans chaque module
- Commits en français, format conventionnel (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)
- Branches : `feature/`, `fix/`, `refactor/`