# invest-assist — CLAUDE.md

## Vue d'ensemble du projet

Une application web (dans le navigateur) permettant à une équipe de suivre les MRs sur gitlab.

- **Backend** : Java / Spring Boot (`/backend`)
- **Frontend** : Angular (`/frontend`)

---

## Structure du projet

```
invest-assist/
├── backend/      # API Spring Boot
└── frontend/     # Application Angular
├── docs/
│   └── features/     # Specs et rapports par feature
│   └── design/       # Design de l'app, maquettes et wireframe.
│   └── tech/         # Rapports d'architecture, de design et autres éléments orientés tech a destination des devs
└── .claude/
    └── commands/
        │
        │── # WORKFLOWS (orchestrateurs)
        ├── feature.md          # /project:feature    → Nouvelle fonctionnalité
        ├── refacto.md          # /project:refacto    → Refactoring technique
        ├── bugfix.md           # /project:bugfix     → Correction de bug
        ├── puretech.md         # /project:puretech   → Tache purement technique (montée de version, initialisation, etc)
        │
        │── # AGENTS (spécialistes, appelés par les workflows)
        ├── po.md               # /project:po         → Analyse fonctionnelle
        ├── architect.md        # /project:architect  → Analyse technique préalable a l'intégration d'une nouvelle founctionnalité
        ├── dev.md              # /project:dev        → Implémentation d'une nouvelle founctionnalité
        ├── qa.md               # /project:qa         → Tests
        └── review.md           # /project:review     → Revue de code
└── CLAUDE.md
```

---

## Workflow standard pour une nouvelle feature

## Règle changelog — OBLIGATOIRE

**À chaque feature, fix ou refacto**, mettre à jour `frontend/public/changelog.json` en ajoutant une entrée en tête du tableau :

```json
{ "date": "YYYY-MM-DD", "type": "feat|fix|refacto", "user-story": "nom de la ou les us concernées", "title": "Description courte en une phrase." }
```

Les workflows (`feature.md`, `bugfix.md`, `refacto.md`) incluent cette étape en phase de finalisation.

---

## Workflows disponibles

| Commande            | Usage                   | Exemple                                                                          |
|---------------------|-------------------------|----------------------------------------------------------------------------------|
| `/project:feature`  | Nouvelle fonctionnalité | `/project:feature Ajouter l'export PDF des tâches`                               |
| `/project:refacto`  | Refactoring technique   | `/project:refacto Extraire la logique de validation dans un service dédié`       |
| `/project:bugfix`   | Correction de bug       | `/project:bugfix Le tri par date ne fonctionne pas sur les tâches sans deadline` |
| `/project:puretech` | Tâche technique pure    | `/project:puretech Initialise le projet backend`                                 |

### Agents individuels (utilisables seuls)

| Commande             | Usage                         |
|----------------------|-------------------------------|
| `/project:po`        | Analyse fonctionnelle seule   |
| `/project:architect` | Analyse d'architecture seule  |
| `/project:dev`       | Implémentation seule          |
| `/project:qa`        | Tests seuls                   |
| `/project:review`    | Revue de code seule           |

---

## Environnement local (Windows)

Le wrapper `./mvnw` n'existe pas dans ce projet. Utiliser le chemin complet ci-dessous.

```bash
# Java 21 (JDK Microsoft)
export JAVA_HOME=/c/Users/stone/.jdks/ms-21.0.8
export PATH=$JAVA_HOME/bin:$PATH

# Maven 3.9.9
export MVN=/c/Users/stone/.m2/wrapper/dists/apache-maven-3.9.9-bin/4nf9hui3q3djbarqar9g711ggc/apache-maven-3.9.9/bin/mvn
```

**Toujours** préfixer les commandes Maven avec `rtk` et utiliser `$MVN` :
```bash
rtk $MVN test
rtk $MVN spring-boot:run
rtk $MVN package -DskipTests
```

**TypeScript** (frontend) — Le builder `@angular/build:unit-test` utilise Vitest en mode jsdom (sans navigateur). Utiliser :
```bash
rtk npx tsc --noEmit          # Vérification de types
npx ng test --no-watch        # Tests unitaires (Angular builder, jsdom, sans navigateur)
```

---

## Backend (`/backend`)

### Stack technique

- Java 21
- Spring Boot 3.X
- Maven 3.9.X
- PostgreSQL
- Liquibase
- JUnit 5
- Mockito
- Docker

### Commandes essentielles

```bash
cd backend
rtk $MVN spring-boot:run        # Démarrer le serveur
rtk $MVN test                   # Lancer les tests
rtk $MVN package -DskipTests    # Builder sans tests
```

### Structure des packages

Le backend est organisé par **feature** (approche verticale), pas par couche technique.

```
com.traynaud.invest/
├── common/                  # Transversal à toutes les features
│   ├── config/              # Configuration Spring (sécurité, CORS, audit…)
│   ├── dto/                 # DTOs partagés entre features
│   ├── exception/           # Exceptions métier (BusinessValidationException, EntityNotFoundException…)
│   └── handler/             # GlobalExceptionHandler
├── security/                # JWT, filtres, UserDetailsService
└── features/
    └── <feature>/           # ex : account, asset, transaction, currency, users…
        ├── controller/      # Couche REST
        ├── facade/          # Orchestration + contrôle d'accès
        ├── service/         # Logique métier / CRUD
        ├── repository/      # Interfaces Spring Data JPA
        ├── domain/          # Entités JPA (= anciennement entity/)
        ├── dto/             # DTOs propres à la feature (request/response)
        └── enums/           # Enums propres à la feature
```

> **Règle** : tout ce qui est propre à une feature vit dans `features/<feature>/`. Ce qui est partagé entre plusieurs features va dans `common/`.

### Conventions

- Packages Java : `com.traynaud.immo`
- Organisation : **feature-first** — `features/<feature>/<couche>`
- Entités JPA dans `features/<feature>/domain/` (pas `entity/`)
- DTOs séparés des entités JPA
- Tests unitaires avec JUnit 5 + Mockito
- Tests d'intégration avec `@SpringBootTest`
- Fichiers de config sensibles dans `application-local.properties` (ignoré par git)
- Nommage REST : /api/v1/...
- Javadoc sur les méthodes publiques

#### Roles et Conventions des Controller

- Role: Le controller récupère la requete depuis le frontend sous forme d'api. Il check que les paramètres obligatoires
  soit présents, via des annotations, et il appel la facade.
- Utiliser des noms explicites pour les méthodes HTTP (get, post, put, delete)
- Gérer les exceptions avec des handlers spécifiques
- Utiliser des DTOs pour la sérialisation/désérialisation des données
- Le Controller ne gère JAMAIS le controlle d'accès (Géré en facade)

#### Roles et Conventions des Facade

- Role: Controle l'accès a l'application et orchestre l'éxécution de la demande
- Chaque Controller a toujours une facade
- Valide le controle d'accès (quand applicable), a travers des annotations
- Converti les DTOs en objets métiers (entités JPA)
- Orchestre et appel les services nécessaires au déroulement de la tache

#### Roles et Conventions des Services

- Role: Les Business Services sont responsables de la logique métier de l'application
- Role: Les CRUD Services sont responsables de la gestion des entités JPA
- Les services ne consomment et ne renvoient que des objets métiers (entités JPA)
- On distinguera les services en fonction de leur responsabilité (CRUD, Business, etc.)

#### Conventions des Repositories

- Utiliser par défaut des interfaces qui extends JPARepository ou CRUDRepository
- Favoriser dans l'odre: JPAQueries -> JPQL Queries -> Native SQL Queries

---

## Frontend (`/frontend`)

### Stack technique

- Angular 20+
- TypeScript 4.X
- Node.js
- SCSS
- Jest
- Playwright
- Docker

### Commandes essentielles

```bash
cd frontend
npm install                     # Installer les dépendances
npm start                       # Démarrer le serveur de dev (ng serve)
npm test                        # Lancer les tests (ng test)
npm run build                   # Builder pour la prod
```

### Conventions

- Composants dans `src/app/` organisés par feature
- Les services sont utilisés pour toute communication avec l'API backend
- Lorsque que la logique métier est complexe, on peut créer un service Business
- Les entités provenant du backend sont gérées via des stores (SignalStore)
- Tests unitaires avec Jest
- Typage strict TypeScript
- Variables d'environnement dans `src/environments/`

#### Roles et Conventions des Components

- Role: Les composants sont responsables de la présentation de l'interface utilisateur
- Nommage des composants : `<nom-du-composant>.component.ts`
- Les composants sont composés de templates HTML et de styles SCSS
- Les composants sont testés avec Jest
- Les composants sont découpés en composants autonomes et réutilisables autant que possible
- Les composants très 'techniques' ayant une vocation transverses a l'application seront stockés dans le répertoire:
  `src/app/components`
- Les composants d'affichage seront eux organisés par feature

#### Roles Conventions des Services

- Role: Les services sont utilisés pour toute communication avec l'API backend
- Nommage des services : `<nom-du-service>.service.ts`
- Les méthodes crud des services sont nommées avec le verbe HTTP correspondant (e.g., `get`, `post`, `put`, `delete`)
- Les méthodes crud des services retournent une Observable
- Les méthodes crud des services sont uniquement appelés via des stores

#### Roles Conventions des Stores

- Role: Les stores sont utilisés pour gérer l'état de l'application de manière reactive et centralisée
- Nommage des stores : `<nom-du-store>.store.ts`
- Les stores sont composés de state, actions et selectors
- Les actions sont nommées avec le verbe HTTP correspondant (e.g., `get`, `post`, `put`, `delete`)
- Les selectors sont nommés avec le verbe HTTP correspondant (e.g., `get`, `post`, `put`, `delete`)
- Les messages d'erreur dans les stores sont des **clés i18n** (ex: `'accounts.errors.load'`), jamais du texte brut

#### Conventions i18n

L'application utilise un système de traduction custom sans dépendance externe. Voir `docs/tech/i18n.md` pour les détails.

- Tous les labels et textes visibles par l'utilisateur sont dans `public/i18n/fr.json`
- Utiliser le pipe `| translate` dans les templates : `{{ 'clé.de.traduction' | translate }}`
- Importer `TranslatePipe` dans le tableau `imports` de chaque composant standalone qui l'utilise
- Pour les enums : `{{ 'namespace.types.' + value | translate }}`
- Les stores stockent des clés i18n dans `error`, pas du texte brut
- Ajouter les clés dans `fr.json` avant d'écrire le template — jamais de texte en dur dans les templates

---

## Règles générales

- Ne jamais committer `application-local.properties`, `.env`, ou tout fichier contenant des secrets
- Toujours tester avant de proposer un commit
- Respecter les conventions de nommage existantes dans chaque module
- Commits en français, format conventionnel (feat:, fix:, etc.)
- Branches : feature/, fix/, refactor/
